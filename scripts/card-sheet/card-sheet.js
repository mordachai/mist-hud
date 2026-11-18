// card-sheet.js — MistCardSheet, the alternative character sheet (docs/card-sheet-plan.md).
//
// ApplicationV2 actor sheet registered next to the system's sheet (init.js),
// picked per actor in the Sheet selector. The system stays the source of
// truth: reads go through getters.js, writes through document methods, and
// anything else through system-adapter.js.
//
// Phase 1: move bar + layer 1 (the four main themes as flip cards, read-only)
// + "Open system sheet" header button.

import { MODULE_ID, SETTINGS } from "../constants.js";
import { buildLayer1Context } from "./card-sheet-context.js";
import { watchFit } from "./card-fit.js";
import { prepareMoveBar, executeMove } from "./move-bar.js";
import { openSystemSheet, systemSheetFlips } from "./system-adapter.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TEMPLATE_DIR = "modules/mist-hud/templates/card-sheet";

/** Every card sheet template and partial, preloaded in init.js. */
export const CARD_SHEET_TEMPLATES = [
  `${TEMPLATE_DIR}/move-bar.hbs`,
  `${TEMPLATE_DIR}/layer1.hbs`,
  `${TEMPLATE_DIR}/theme-card.hbs`,
];

// ── Sheet UI state (client setting, per actor uuid; plan § 6.2) ──────────────
// { [actorUuid]: { flipped: { [cardId]: true } } }

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
    // 12px gaps, under the 56px band, plus 6/12px room for the shadows.
    // A smaller window scales the cards down (container queries).
    position: { width: 1024, height: 696 },
    window: { resizable: true },
    actions: {
      rollMove:        MistCardSheet.#onRollMove,
      nextMoveGroup:   MistCardSheet.#onNextMoveGroup,
      openSystemSheet: MistCardSheet.#onOpenSystemSheet,
      flipCard:        MistCardSheet.#onFlipCard,
    },
  };

  static PARTS = {
    moves:  { template: CARD_SHEET_TEMPLATES[0] },
    layer1: { template: CARD_SHEET_TEMPLATES[1], scrollable: [".mh-cs-scroll"] },
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

  /** Which move group the chevron is showing (client UI state, kept across renders). */
  #moveGroup = 0;
  #rolling = false;
  #unwatchFit = null;

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
        break;
    }
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (options.parts?.includes("layer1") ?? true) {
      this.#unwatchFit?.();
      this.#unwatchFit = watchFit(this.element.querySelector(".mh-cs-layer1"));
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
    this.#unwatchFit?.();
    this.#unwatchFit = null;
    super._onClose(options);
  }

  /** Header button: "Open system sheet", for actions the card sheet does not have yet. */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
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
      if (this.rendered) this.render({ parts: ["layer1"] });
    }
  }

  static #onNextMoveGroup() {
    this.#moveGroup += 1;
    this.render({ parts: ["moves"] });
  }

  static #onOpenSystemSheet() {
    openSystemSheet(this.actor);
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
    if (app instanceof MistCardSheet && app.rendered) app.render({ parts: ["layer1"] });
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
