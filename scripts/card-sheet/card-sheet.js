// card-sheet.js — MistCardSheet, the alternative character sheet (docs/card-sheet-plan.md).
//
// ApplicationV2 actor sheet registered next to the system's sheet (init.js),
// picked per actor in the Sheet selector. The system stays the source of
// truth: reads go through getters.js, writes through document methods, and
// anything else through system-adapter.js.
//
// Phase 2: move bar, layer 1 (the four main themes), layer 2 (character
// card, crew themes, every extra theme), flip cards, the layer swap, the
// active-extra switch, and the "Open system sheet" header button. Read-only
// otherwise (edit mode is phase 3).

import { MODULE_ID, SETTINGS } from "../constants.js";
import { buildLayer1Context, buildLayer2Context } from "./card-sheet-context.js";
import { watchFit } from "./card-fit.js";
import { prepareMoveBar, executeMove } from "./move-bar.js";
import { openSystemSheet, systemSheetFlips, logModification } from "./system-adapter.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TEMPLATE_DIR = "modules/mist-hud/templates/card-sheet";

/** Every card sheet template and partial, preloaded in init.js. */
export const CARD_SHEET_TEMPLATES = [
  `${TEMPLATE_DIR}/move-bar.hbs`,
  `${TEMPLATE_DIR}/layer1.hbs`,
  `${TEMPLATE_DIR}/layer2.hbs`,
  `${TEMPLATE_DIR}/theme-card.hbs`,
  `${TEMPLATE_DIR}/character-card.hbs`,
  `${TEMPLATE_DIR}/card-band.hbs`,
  `${TEMPLATE_DIR}/peek-tab.hbs`,
];

const LAYER_PARTS = ["layer1", "layer2"];

// ── Sheet UI state (client setting, per actor uuid; plan § 6.2) ──────────────
// { [actorUuid]: { flipped: { [cardId]: true }, front: 1 | 2 } }

function readUiState(actor) {
  try { return game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_STATE)?.[actor.uuid] ?? {}; }
  catch { return {}; }
}

async function writeUiState(actor, change) {
  let all;
  try { all = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_STATE) ?? {}); }
  catch { return; }
  all[actor.uuid] = foundry.utils.mergeObject(all[actor.uuid] ?? {}, change, { performDeletions: true });
  await game.settings.set(MODULE_ID, SETTINGS.CARD_SHEET_STATE, all);
}

export class MistCardSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mh-card-sheet"],
    // Reference size: four 244 x 620 City of Mist cards (art 473 x 1203) with
    // 12px gaps, under the 56px band and the 8px gap, plus the back layer's
    // header bands peeking out above (0.2 card widths = 49px) and 6/12px room
    // for the shadows. A smaller window scales the cards down (container
    // queries on the window content).
    position: { width: 1024, height: 745 },
    window: { resizable: true },
    actions: {
      rollMove:        MistCardSheet.#onRollMove,
      nextMoveGroup:   MistCardSheet.#onNextMoveGroup,
      openSystemSheet: MistCardSheet.#onOpenSystemSheet,
      flipCard:        MistCardSheet.#onFlipCard,
      showLayer:       MistCardSheet.#onShowLayer,
      setActiveExtra:  MistCardSheet.#onSetActiveExtra,
    },
  };

  static PARTS = {
    moves:  { template: CARD_SHEET_TEMPLATES[0] },
    layer1: { template: CARD_SHEET_TEMPLATES[1], scrollable: [".mh-cs-scroll"] },
    layer2: { template: CARD_SHEET_TEMPLATES[2], scrollable: [".mh-cs-scroll"] },
  };

  // ── What the system expects of `actor.sheet` ────────────────────────────────
  // The system treats `actor.sheet` as its own V1 sheet in two places:
  //  - CityDB / CityHelpers refresh a character's sheet when its crew or
  //    extra changes, only if `actor.sheet._state > 0` (V1 render state);
  //  - the setFlipped template helper reads `actor.sheet.flipped[n]`.
  // The card sheet's own flip state is `cardFlips` (below), not `flipped`.

  get _state() {
    return this.state;
  }

  get flipped() {
    return systemSheetFlips(this.actor);
  }

  /** The card sheet's flipped cards: { [cardId]: true } (client setting). */
  get cardFlips() {
    return readUiState(this.actor).flipped ?? {};
  }

  /** The layer in front: 1 (main themes) or 2 (character, crew, extras). */
  get frontLayer() {
    return readUiState(this.actor).front === 2 ? 2 : 1;
  }

  /** Ids of the other actors whose themes layer 2 shows (crew, dangers). */
  get linkedOwners() {
    return this.#linkedOwners;
  }

  /** Which move group the chevron is showing (client UI state, kept across renders). */
  #moveGroup = 0;
  #rolling = false;
  #switchingExtra = false;
  /** card-fit.js watchers, per layer part. */
  #unwatchFit = {};
  #linkedOwners = new Set();

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    return context;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch (partId) {
      case "moves":
        context.moveBar = await prepareMoveBar(this.actor, this.#moveGroup);
        this.#moveGroup = context.moveBar.current;
        break;
      case "layer1":
        Object.assign(context, buildLayer1Context(this.actor, this.cardFlips));
        context.back = this.frontLayer !== 1;
        break;
      case "layer2": {
        const layer2 = await buildLayer2Context(this.actor, this.cardFlips);
        this.#linkedOwners = new Set(layer2.owners);
        Object.assign(context, layer2);
        context.back = this.frontLayer !== 2;
        break;
      }
    }
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.dataset.front = String(this.frontLayer);
    for (const part of LAYER_PARTS) {
      if (options.parts && !options.parts.includes(part)) continue;
      this.#unwatchFit[part]?.();
      this.#unwatchFit[part] = watchFit(this.element.querySelector(`.mh-cs-${part}`));
    }
  }

  /** Once per window: Enter / Space on a card's header band flips it (the
   *  click goes through the flipCard action). */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const band = event.target.closest?.('[data-action="flipCard"]');
      if (!band || event.repeat) return;
      // Keep Space from reaching the core keybindings (pause).
      event.preventDefault();
      event.stopPropagation();
      this.#flipCard(band.closest(".mh-cs-card"), { focus: true });
    });
  }

  _onClose(options) {
    for (const unwatch of Object.values(this.#unwatchFit)) unwatch?.();
    this.#unwatchFit = {};
    super._onClose(options);
  }

  /** Header button: "Open system sheet", for actions the card sheet does not have yet. */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    // Which layer is in front, before the first paint (no swap animation on open).
    frame.dataset.front = String(this.frontLayer);
    if (this.document.isOwner || game.user.isGM) {
      const label = game.i18n.localize("MistHUD.cardSheet.openSystemSheet");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "header-control icon fa-solid fa-book-open mh-cs-open-system";
      button.dataset.action = "openSystemSheet";
      button.dataset.tooltip = label;
      button.setAttribute("aria-label", label);
      const close = frame.querySelector('.window-header [data-action="close"]');
      if (close) close.before(button);
      else frame.querySelector(".window-header")?.append(button);
    }
    return frame;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  static async #onRollMove(event, target) {
    const moveId = target.dataset.moveId;
    if (!moveId || this.#rolling) return;
    this.#rolling = true;
    try {
      await executeMove(this.actor, moveId);
    } finally {
      this.#rolling = false;
      // The system clears its selection without a hook; show the empty selection.
      if (this.rendered) this.render({ parts: LAYER_PARTS });
    }
  }

  static #onNextMoveGroup() {
    this.#moveGroup += 1;
    this.render({ parts: ["moves"] });
  }

  static #onOpenSystemSheet() {
    openSystemSheet(this.actor);
  }

  /**
   * A peek tab of the back layer: bring that layer to the front. The layers
   * swap in place (CSS transition on the root's data-front), no re-render.
   */
  static async #onShowLayer(event, target) {
    const layer = Number(target.dataset.layer) === 2 ? 2 : 1;
    if (this.element.dataset.front === String(layer)) return;
    this.element.dataset.front = String(layer);
    for (const n of [1, 2]) {
      for (const inner of this.element.querySelectorAll(`.mh-cs-layer${n} .mh-cs-card-inner`)) {
        inner.toggleAttribute("inert", n !== layer);
      }
    }
    // From the keyboard (detail 0), the focus follows to the same card's band.
    if (event.detail === 0) {
      const card = target.closest(".mh-cs-card");
      const face = card?.classList.contains("flipped") ? ".mh-cs-back" : ".mh-cs-front";
      card?.querySelector(`${face} [data-action="flipCard"]`)?.focus();
    }
    await writeUiState(this.actor, { front: layer });
  }

  /**
   * Make another extra theme the active one (the one the system rolls with),
   * the way the system sheet does: actor.setExtraThemeId, then the change log
   * entry (players only, like the system's extra selector).
   */
  static async #onSetActiveExtra(event, target) {
    const themeId = target.dataset.themeId;
    if (!themeId || this.#switchingExtra || !this.actor.isOwner) return;
    const theme = this.actor.allLinkedExtraThemes?.find(t => t.id === themeId);
    if (!theme) return;
    this.#switchingExtra = true;
    try {
      await this.actor.setExtraThemeId(themeId);
      if (!game.user.isGM) {
        await logModification(this.actor, game.i18n.localize("CityOfMist.logger.action.changeActiveExtra"), theme);
      }
    } finally {
      this.#switchingExtra = false;
    }
  }

  /** Click on a card's header band: flip that card. */
  static #onFlipCard(event, target) {
    return this.#flipCard(target.closest(".mh-cs-card"));
  }

  /**
   * Flip one card in place (no re-render) and remember it for this actor.
   * The face turned away is made inert (no clicks, no tab stop); from the
   * keyboard, the focus follows to the header band of the face now showing.
   */
  async #flipCard(card, { focus = false } = {}) {
    const cardId = card?.dataset.cardId;
    if (!cardId) return;
    const flipped = !card.classList.contains("flipped");
    // will-change only while the card turns (plan § 7)
    card.classList.add("flipping");
    card.classList.toggle("flipped", flipped);
    const front = card.querySelector(".mh-cs-front");
    const back = card.querySelector(".mh-cs-back");
    front?.toggleAttribute("inert", flipped);
    back?.toggleAttribute("inert", !flipped);
    if (focus) (flipped ? back : front)?.querySelector('[data-action="flipCard"]')?.focus();
    const inner = card.querySelector(".mh-cs-card-inner");
    const done = () => card.classList.remove("flipping");
    if (inner) inner.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 1000);
    await writeUiState(this.actor, { flipped: { [flipped ? cardId : `-=${cardId}`]: flipped || null } });
  }
}

/** Re-render open card sheets when the system's tag/status selection changes. */
export function refreshCardSheets() {
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof MistCardSheet && app.rendered) app.render({ parts: LAYER_PARTS });
  }
}

/**
 * Re-render layer 2 of open card sheets that show a theme of this actor (a
 * crew or a danger). The system only refreshes a character's sheet for its
 * active crew and active extra; layer 2 shows all of them.
 * @param {Actor} owner
 */
export function refreshCardSheetsForOwner(owner) {
  if (!owner?.id) return;
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof MistCardSheet && app.rendered && app.actor?.id !== owner.id
        && app.linkedOwners.has(owner.id)) {
      app.render({ parts: ["layer2"] });
    }
  }
}

/** Re-render open card sheets once the system's database is in (themebooks
 *  and moves): a sheet opened right after the world loads renders before
 *  CityDB has them, with no move bar and no theme types. */
export function refreshCardSheetsOnDBLoad() {
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof MistCardSheet && app.rendered) app.render();
  }
}
