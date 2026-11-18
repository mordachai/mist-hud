// card-sheet.js — MistCardSheet, the alternative character sheet (docs/card-sheet-plan.md).
//
// ApplicationV2 actor sheet registered next to the system's sheet (init.js),
// picked per actor in the Sheet selector. The system stays the source of
// truth: reads go through getters.js, writes through document methods, and
// anything else through system-adapter.js.
//
// Move bar, layer 1 (the four main themes), layer 2 (character card, crew
// themes, every extra theme), flip cards, the layer swap, the active-extra
// switch, the "Open system sheet" header button, and edit mode (phase 3):
// the system's lock (`actor.system.locked`; unlocked = edit mode) toggled by
// a header control, inline inputs saved on change, and the edit actions of
// edit-actions.js. The window carries data-mode="play" | "edit". Play mode
// (phase 4): clicking a tag name selects it in the system's selection
// (play-actions.js), and a selection change re-renders both layers.

import { MODULE_ID, SETTINGS } from "../constants.js";
import { buildLayer1Context, buildLayer2Context, isEditMode } from "./card-sheet-context.js";
import { watchFit } from "./card-fit.js";
import { prepareMoveBar, executeMove } from "./move-bar.js";
import {
  openSystemSheet, systemSheetFlips, logModification, creationLocation, statusDrop,
} from "./system-adapter.js";
import { EDIT_ACTIONS, changeThemeField, changeActorField } from "./edit-actions.js";
import { PLAY_ACTIONS } from "./play-actions.js";

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
  `${TEMPLATE_DIR}/improvement.hbs`,
  `${TEMPLATE_DIR}/tag-name.hbs`,
];

const LAYER_PARTS = ["layer1", "layer2"];

/** Everything inside a card that scrolls; its position is kept across re-renders. */
const SCROLLERS = ".mh-cs-scroll, .mh-cs-weakness-tags, .mh-cs-motivation-text, .mh-cs-title-input, .mh-cs-short-desc, .mh-cs-bu-improvements";

/** Actor fields shown on layer 2 only (the character card): a change re-renders layer 2 alone. */
const LAYER2_ACTOR_FIELDS = new Set([
  "name", "system.mythos", "system.logos", "system.short_description", "system.biography",
  "system.buildup", "system.unspentBU",
]);

/** Theme fields that change only that theme's card (not the layer order or art). */
const THEME_TEXT_FIELDS = new Set(["name", "system.mystery"]);

// ── Sheet UI state (client setting, per actor uuid; plan § 6.2) ──────────────
// { [actorUuid]: { flipped: { [cardId]: true }, front: 1 | 2 } }

function readUiState(actor) {
  try { return game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_STATE)?.[actor.uuid] ?? {}; }
  catch { return {}; }
}

/**
 * Change this actor's sheet state. `flipped: { [cardId]: bool }` sets or
 * clears a card's flip (cleared keys are deleted by hand: in v14
 * mergeObject leaves a ForcedDeletion object for "-=key", which reads as
 * truthy); `front` sets the front layer.
 */
async function writeUiState(actor, { flipped, front } = {}) {
  let all;
  try { all = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_STATE) ?? {}); }
  catch { return; }
  const state = all[actor.uuid] ?? {};
  if (flipped) {
    const flips = cleanFlips(state.flipped);
    for (const [cardId, on] of Object.entries(flipped)) {
      if (on) flips[cardId] = true;
      else delete flips[cardId];
    }
    state.flipped = flips;
  }
  if (front !== undefined) state.front = front;
  all[actor.uuid] = state;
  await game.settings.set(MODULE_ID, SETTINGS.CARD_SHEET_STATE, all);
}

/** Only the cards really flipped (drops leftovers of the old "-=key" writes). */
function cleanFlips(flips) {
  return Object.fromEntries(Object.entries(flips ?? {}).filter(([, on]) => on === true));
}

export class MistCardSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mh-card-sheet"],
    // Reference size (user, 2026-11-18): four ~204 x 520 City of Mist cards
    // (art 473 x 1203) with 12px gaps, under the 56px band and the 8px gap,
    // plus the back layer's header bands peeking out above (0.2 card widths
    // = 41px) and 6/12px room for the shadows. The height sets the card size
    // (content height − 64 = card width × (1203/473 + 0.2)). A smaller window
    // scales the cards down (container queries on the window content).
    position: { width: 880, height: 637 },
    window: { resizable: true },
    // Every write goes through its own change handler or action; a form
    // submit (Enter in an input) writes nothing.
    form: { handler: MistCardSheet.#onSubmitForm, submitOnChange: false, closeOnSubmit: false },
    actions: {
      rollMove:        MistCardSheet.#onRollMove,
      nextMoveGroup:   MistCardSheet.#onNextMoveGroup,
      openSystemSheet: MistCardSheet.#onOpenSystemSheet,
      flipCard:        MistCardSheet.#onFlipCard,
      showLayer:       MistCardSheet.#onShowLayer,
      setActiveExtra:  MistCardSheet.#onSetActiveExtra,
      ...EDIT_ACTIONS,
      ...PLAY_ACTIONS,
    },
  };

  // Scroll positions are kept by _preSyncPartState for every list (not only
  // the first match of a selector, as PARTS.scrollable does).
  static PARTS = {
    moves:  { template: CARD_SHEET_TEMPLATES[0] },
    layer1: { template: CARD_SHEET_TEMPLATES[1] },
    layer2: { template: CARD_SHEET_TEMPLATES[2] },
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
    return cleanFlips(readUiState(this.actor).flipped);
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

  /** Edit mode: the system's unlocked state (plan § 6.2, "Lock state"). */
  get editMode() {
    return isEditMode(this.actor);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    // Prefix of the inputs' ids, so the focus survives a re-render.
    context.uid = this.id;
    return context;
  }

  // ── Re-rendering only what changed ──────────────────────────────────────────
  // A document update re-renders the whole sheet. For the changes the card
  // sheet makes itself (a theme's name or mystery, a tag, an improvement, a
  // character field), only the layer that shows them is rendered again.

  _configureRenderOptions(options) {
    if (!options.isFirstRender && !options.parts && options.renderContext) {
      const parts = this.#partsFor(options.renderContext, options.renderData);
      if (parts) options.parts = parts;
    }
    super._configureRenderOptions(options);
  }

  /** The parts a document change shows in, or null when unsure (render everything). */
  #partsFor(renderContext, renderData) {
    const match = /^(create|update|delete)(item|items)$/i.exec(renderContext);
    // The changed fields, without the id and the bookkeeping (_stats.modifiedTime…).
    const changedKeys = change => Object.keys(foundry.utils.flattenObject(change ?? {}))
      .filter(k => k !== "_id" && !k.startsWith("_stats"));
    if (renderContext === "updateActor") {
      const keys = changedKeys(renderData);
      if (!keys.length) return null;
      if (keys.every(k => LAYER2_ACTOR_FIELDS.has(k))) return ["layer2"];
      if (keys.every(k => k === "system.locked")) return LAYER_PARTS;
      return null;
    }
    if (!match || match[1].toLowerCase() === "delete") return null;
    const changes = Array.isArray(renderData) ? renderData : [renderData];
    const main = new Set((this.actor.mainThemes ?? []).map(t => t.id));
    const parts = new Set();
    for (const change of changes) {
      const item = this.actor.items.get(change?._id);
      if (!item) return null;
      if (item.type === "theme") {
        // A rename or a new mystery: that card only. Anything else (type,
        // extra flag) may move it: both layers.
        const keys = changedKeys(change);
        if (match[1].toLowerCase() !== "update" || !keys.every(k => THEME_TEXT_FIELDS.has(k))) return null;
        parts.add(main.has(item.id) ? "layer1" : "layer2");
      } else if (item.type === "tag" || item.type === "improvement") {
        const themeId = item.system?.theme_id;
        parts.add(themeId && main.has(themeId) ? "layer1" : "layer2");
      } else {
        // Statuses, juice, clues…: not on the cards yet (the deck is phase 5).
        return null;
      }
    }
    return parts.size ? [...parts] : null;
  }

  // ── Focus, typing and scroll positions across a re-render ──────────────────
  // The core keeps the focused element (by id) and the first match of each
  // PARTS.scrollable selector. The card sheet also keeps what was typed but
  // not yet saved in the focused input, its caret, and the scroll position of
  // every list in every card.

  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    const focus = priorElement.querySelector(":focus");
    if (focus?.id && (focus instanceof HTMLInputElement || focus instanceof HTMLTextAreaElement)) {
      state.mhTyped = {
        id:     focus.id,
        typed:  focus.value !== focus.defaultValue ? focus.value : null,
        start:  focus.selectionStart,
        end:    focus.selectionEnd,
      };
    }
    state.mhScroll = [];
    for (const el of priorElement.querySelectorAll(SCROLLERS)) {
      if (!el.scrollTop && !el.scrollLeft) continue;
      const key = scrollKey(el);
      if (key) state.mhScroll.push([key, el.scrollTop, el.scrollLeft]);
    }
  }

  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    const typed = state.mhTyped;
    const input = typed && newElement.querySelector(`#${CSS.escape(typed.id)}`);
    if (input) {
      if (typed.typed != null) input.value = typed.typed;
      try { input.setSelectionRange(typed.start, typed.end); } catch { /* not a text field */ }
    }
    if (!state.mhScroll?.length) return;
    const byKey = new Map([...newElement.querySelectorAll(SCROLLERS)].map(el => [scrollKey(el), el]));
    for (const [key, top, left] of state.mhScroll) {
      const el = byKey.get(key);
      if (el) Object.assign(el, { scrollTop: top, scrollLeft: left });
    }
  }

  // ── Inline inputs (edit mode) ───────────────────────────────────────────────

  /**
   * An inline input changed (on blur, or Enter): save it with the document
   * method. The theme's name and mystery go to the theme (which may belong
   * to a crew or a danger); the character card's fields and the biography
   * editor's save go to the actor.
   */
  _onChangeForm(formConfig, event) {
    const el = event.target;
    switch (el?.dataset?.edit) {
      case "themeName":
      case "themeField":
        changeThemeField(this, el);
        return;
      case "actor":
        changeActorField(this, el);
        return;
    }
    super._onChangeForm(formConfig, event);
  }

  static async #onSubmitForm() {}

  // ── Drops ───────────────────────────────────────────────────────────────────

  /**
   * An item dropped on a card, as the system sheet's _onDropItem: a
   * themebook or a theme kit becomes a new theme (main or extra, asked for
   * player characters), a tag a story tag, a status merges into one of the
   * same name. Anything else is ignored (no raw copy on the actor).
   */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner || !item) return null;
    const type = item.system?.type ?? item.type;
    switch (type) {
      case "themekit": {
        const where = await creationLocation(this.actor);
        if (where) await this.actor.addThemeKit(item, where === "extra");
        return null;
      }
      case "themebook": {
        const tb = await super._onDropItem(event, item);
        if (!tb) return null;
        const where = await creationLocation(this.actor);
        if (where) await this.actor.createNewTheme(`Unnamed ${tb.displayedName ?? ""} Theme`, tb, where === "extra");
        return tb;
      }
      case "tag":
        await this.actor.createStoryTag(item.name, true);
        return null;
      case "status":
        await statusDrop(this.actor, item.name, { tier: item.tier });
        return null;
      default:
        console.log(`Mist HUD | Card sheet: unsupported drop type ${type}`);
        return null;
    }
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
    this.#syncLockControl();
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
    // Inline inputs: Enter saves (blur fires "change"; Shift+Enter is a new
    // line in the mystery), Escape drops what was typed.
    this.element.addEventListener("keydown", event => {
      const input = event.target;
      if (!input?.dataset?.edit || !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
      if (event.key === "Enter" && !(event.shiftKey && input.dataset.edit === "themeField")) {
        event.preventDefault();
        input.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        input.value = input.defaultValue;
        input.blur();
      }
    });
  }

  /** The header lock control and data-mode follow the system's lock. */
  #syncLockControl() {
    const edit = this.editMode;
    this.element.dataset.mode = edit ? "edit" : "play";
    const button = this.element.querySelector(".window-header .mh-cs-lock");
    if (!button) return;
    const label = game.i18n.localize(edit ? "MistHUD.cardSheet.lockSheet" : "MistHUD.cardSheet.unlockSheet");
    button.classList.toggle("fa-lock-open", edit);
    button.classList.toggle("fa-lock", !edit);
    button.classList.toggle("active", edit);
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(edit));
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
    frame.dataset.mode = this.editMode ? "edit" : "play";
    const header = frame.querySelector(".window-header");
    const close = header?.querySelector('[data-action="close"]');
    const addControl = (className, action, label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `header-control icon fa-solid ${className}`;
      button.dataset.action = action;
      button.dataset.tooltip = label;
      button.setAttribute("aria-label", label);
      if (close) close.before(button);
      else header?.append(button);
      return button;
    };
    // Play mode ⇄ edit mode: the system's lock (icon kept in sync by #syncLockControl).
    if (this.document.isOwner) {
      addControl("fa-lock mh-cs-lock", "toggleLock", game.i18n.localize("MistHUD.cardSheet.unlockSheet"));
    }
    if (this.document.isOwner || game.user.isGM) {
      addControl("fa-book-open mh-cs-open-system", "openSystemSheet",
        game.i18n.localize("MistHUD.cardSheet.openSystemSheet"));
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
    await writeUiState(this.actor, { flipped: { [cardId]: flipped } });
  }
}

/** Where a scrolling element sits: its card, its face and its place among the face's scrollers. */
function scrollKey(el) {
  const card = el.closest("[data-card-id]");
  const face = el.closest(".mh-cs-face");
  if (!card || !face) return null;
  const index = [...face.querySelectorAll(SCROLLERS)].indexOf(el);
  return `${card.dataset.cardId}|${face.classList.contains("mh-cs-back") ? "back" : "front"}|${index}`;
}

/**
 * Re-render open card sheets when the system's tag/status selection changes
 * (TagOrStatusSelected / TagOrStatusSelectChange). One click can fire both
 * hooks (switching a tag's direction removes it, then selects it again), so
 * the renders are gathered into one.
 */
export const refreshCardSheets = foundry.utils.debounce(() => {
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof MistCardSheet && app.rendered) app.render({ parts: LAYER_PARTS });
  }
}, 20);

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
