// tags-deck.js — the card sheet's tags-deck (plan § 2, § 7; phase 5).
//
// What the character picks up during play, one tracking card per item:
// statuses, story tags, juice and clues (City of Mist; Help and Hurt are
// juice too, but they live on the character card, fixes 2026-11-19;
// Legend and Otherscape get statuses and story tags only). The deck has
// three views on the sheet:
//   - "stack":  every card cascaded behind the layers, at the right of the
//               sheet; only the red bands show (with the card's name), the
//               last card shows whole. Clicking a card brings it forward.
//   - "focus":  one card brought forward, big, in front of the layers, to
//               work on; "Back to the deck" (or Esc, or a click outside)
//               sends it back.
//   - "spread": every card laid out in front of the sheet, one column per
//               type, with the create buttons in the column headers.
// The deck can be detached into its own frameless window (TagsDeck, below),
// which always shows the spread columns, every card worked on in place;
// the sheet then shows a placeholder.
//
// Everything is done on the card itself (user, 2026-11-18), no system
// dialogs: the name on the TAG line is a field, a new card starts blank,
// clicking a box sets the status (or the amount), the small − / + under the
// box printed 6 change one tier with the system's status math, a clue's
// source / method are small fields under the name, and delete / use / burn
// ask "sure?" on the button itself. The look (fixes phase 2, 2026-11-19):
// partial / temporary / permanent / crispy are toggle icons on the footer
// band, the + / − squares in the top-right corner select the card for the
// roll, the card's type is crossed on the type marker (marker-x.svg).
// Fixes 2026-11-19 (after phase 2): the number follows the name ("NAME-3"
// for a status, "NAME (2)" for a clue or juice); the toolbar's + opens a
// blank card forward (a draft, not an item yet) whose type is picked on its
// type marker, and naming it creates the item; the card last brought
// forward stays in front of the stack; the deck can be tucked behind the
// layers (hide / unhide).
//
// The system stays the source of truth: reads come from getters.js
// (getDeckItems), writes go through document methods (createNewStatus,
// addStatus, setBoxesChecked, spendClue, deleteTag…) and system-adapter.js,
// with the system sheet's change-log entries. Every action handler is an
// ApplicationV2 action: `this` is the MistCardSheet or the TagsDeck window,
// both of which have `actor`, `editMode`, `renderDeck()` and the deck's UI
// state (deckView, deckFocus, deckNew, deckArmed).

import { MODULE_ID, SETTINGS, getActiveSystem } from "../constants.js";
import { getDeckItems } from "../getters.js";
import { isEditMode, selectionView } from "./card-sheet-context.js";
import {
  logModification, statusBoxes, setStatusBoxes, setRollDirection,
  getSystemSelection, addDragFunctionality,
} from "./system-adapter.js";
import { bindDropTarget } from "../drop-relay.js";
import { once } from "./edit-actions.js";
import { writeUiState, deckState } from "./ui-state.js";
import { watchFit } from "./card-fit.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

const TEMPLATE_DIR = "modules/mist-hud/templates/card-sheet";

/** The deck's templates (added to CARD_SHEET_TEMPLATES in card-sheet.js). */
export const DECK_TEMPLATES = {
  part:    `${TEMPLATE_DIR}/tags-deck.hbs`,
  columns: `${TEMPLATE_DIR}/deck-columns.hbs`,
  card:    `${TEMPLATE_DIR}/deck-card.hbs`,
};

// ── What goes in the deck, per game ──────────────────────────────────────────

/** The deck's card types, in display order. */
const DECK_KINDS = {
  "city-of-mist": ["status", "tag", "juice", "clue"],
};
const DEFAULT_KINDS = ["status", "tag"];

const KIND_INFO = {
  status: { label: "CityOfMist.terms.statuses",  one: "CityOfMist.terms.status", icon: "fa-kit-medical", empty: "MistHUD.cardSheet.deck.noStatuses" },
  tag:    { label: "CityOfMist.terms.storyTags", one: "CityOfMist.terms.tag",    icon: "fa-tag",         empty: "MistHUD.cardSheet.noStoryTags" },
  juice:  { label: "CityOfMist.terms.juice",     one: "CityOfMist.terms.juice",  icon: "fa-jar",         empty: "MistHUD.cardSheet.deck.noJuice" },
  clue:   { label: "CityOfMist.terms.clues",     one: "CityOfMist.terms.clue",   icon: "fa-magnifying-glass", empty: "MistHUD.cardSheet.deck.noClues" },
};

/** The create buttons of each column (the system sheet's create-* links). */
const CREATES = {
  status: [{ subtype: "", icon: "fa-plus", label: "MistHUD.cardSheet.deck.createStatus" }],
  tag:    [{ subtype: "", icon: "fa-plus", label: "MistHUD.cardSheet.deck.createStoryTag" }],
  juice:  [{ subtype: "", icon: "fa-plus", label: "MistHUD.cardSheet.deck.createJuice" }],
  clue:   [{ subtype: "", icon: "fa-plus", label: "MistHUD.cardSheet.deck.createClue" }],
};

/** The type marker's icons on the card art, left to right (plan § 7). Legend
 *  (phase 6): the leaf's colour says the type, the marker is only the blank
 *  card's type picker. */
const MARKER_ORDERS = {
  "city-of-mist": ["clue", "juice", "tag", "status"],
};
const DEFAULT_MARKER_ORDER = ["status", "tag"];
const markerOrder = () => MARKER_ORDERS[getActiveSystem()] ?? DEFAULT_MARKER_ORDER;

/** The id of the blank card the toolbar's + brings forward (no item yet). */
export const DRAFT_ID = "draft";

/**
 * The tracking card's boxes: the box (1-based) holding each tier's number
 * (tier 1–6; tier 5 = OUT, tier 6 = MC). The last one is the box count.
 */
const TIER_BOXES_BY_SYSTEM = {
  "city-of-mist": [1, 2, 4, 7, 11, 16],
};
/** Legend and Otherscape (mist-engine statuses): one box per tier, 6 boxes. */
const DEFAULT_TIER_BOXES = [1, 2, 3, 4, 5, 6];
const tierBoxes = () => TIER_BOXES_BY_SYSTEM[getActiveSystem()] ?? DEFAULT_TIER_BOXES;
/** Games whose status cards mark only the current tier's box (user, 2026-11-20). */
const SINGLE_BOX_SYSTEMS = new Set(["legend"]);
const singleBox = () => ({ single: SINGLE_BOX_SYSTEMS.has(getActiveSystem()) });

/**
 * The boxes a clue or juice amount fills: the same mapping as a status
 * without pips (fixes 2026-11-19). Amount n fills boxes 1 to C(n), the box
 * printed "n" (C = TIER_BOXES); 6 or more fills them all. The stored amount
 * is not changed.
 */
const amountFill = amount => {
  const n = Math.max(0, Math.trunc(Number(amount) || 0));
  const tiers = tierBoxes();
  return n ? tiers[Math.min(n, tiers.length) - 1] : 0;
};
const amountBoxes = amount => {
  const filled = amountFill(amount);
  return Array.from({ length: tierBoxes().at(-1) }, (_, i) => i < filled);
};

/**
 * A click on box `box` (1-based) of a clue or juice: the highest number
 * printed at or before it (box 7 → 4, box 5 → 3). Clicking the last filled
 * tier box again lowers the amount by one.
 */
function amountForBox(box, current) {
  const amount = Math.max(0, Math.trunc(Number(current) || 0));
  if (amount > 0 && box === amountFill(amount)) return amount - 1;
  return tierBoxes().filter(b => b <= box).length;
}

/** How long a "sure?" button stays armed. */
const ARM_MS = 3000;

// ── Render context ───────────────────────────────────────────────────────────

/**
 * The controls of a deck card, for its owner, in two groups:
 *   - steps: the small − / + under the box printed 6 (a status, clue or
 *     juice);
 *   - tools: on the footer band, at the right: burn on a story tag while
 *     locked, "use" on a clue (players only, checked on click; a magnifier
 *     and "USE"), and a trash on every card in both modes (fixes
 *     2026-11-19; not on a collective status, which the system keeps in
 *     step with the collective size).
 * Delete, use and burn ask "sure?" on the button (`armed`).
 */
function cardTools(kind, row, own, edit, armedKey) {
  if (!own) return { steps: [], tools: [] };
  const tool = (action, icon, label, extra = {}) => ({
    // format, not localize: some labels name the card ("Burn {name}").
    action, icon, label: game.i18n.format(label, { name: row.name ?? row.item?.name ?? "" }), ...extra,
    armed: armedKey === `${row.id}:${action}`,
    sure: L("MistHUD.cardSheet.deck.sure"),
  });
  const steps = kind === "tag" ? [] : [
    tool("stepDeckCard", "fa-minus", kind === "status" ? "MistHUD.cardSheet.deck.subtractTier" : "MistHUD.cardSheet.deck.subtractOne", { step: -1 }),
    tool("stepDeckCard", "fa-plus", kind === "status" ? "MistHUD.cardSheet.deck.addTier" : "MistHUD.cardSheet.deck.addOne", { step: 1 }),
  ];
  const del = label => tool("deleteDeckCard", "fa-trash", label, { danger: true, confirm: true });
  const tools = [];
  switch (kind) {
    case "status":
      if (!row.specialType) tools.push(del("MistHUD.cardSheet.deck.deleteHint"));
      break;
    case "tag":
      if (!edit) {
        if (row.burnState === "unburned" && row.item?.isBurnable) {
          tools.push(tool("burnDeckTag", "fa-fire", "MistHUD.cardSheet.burnTitle", { confirm: true }));
        } else if (row.burnState !== "unburned") {
          tools.push(tool("burnDeckTag", "fa-rotate-left", "MistHUD.cardSheet.unburnTitle", { confirm: true }));
        }
      }
      tools.push(del("MistHUD.cardSheet.deck.deleteHint"));
      break;
    case "clue":
      if (row.amount > 0) {
        tools.push(tool("useClue", "fa-magnifying-glass", "MistHUD.cardSheet.deck.useClue", {
          confirm: true, text: L("MistHUD.cardSheet.deck.use"),
        }));
      }
      tools.push(del("MistHUD.cardSheet.deck.delete"));
      break;
    case "juice":
      tools.push(del("MistHUD.cardSheet.deck.delete"));
      break;
  }
  // The tooltip of an armed button says what the next click does.
  for (const t of tools) if (t.armed) t.label = L("MistHUD.cardSheet.deck.sureHint", { action: t.label });
  return { steps, tools };
}

/**
 * A status or story tag card is a system draggable (fixes 2026-11-19): the
 * same data the system's chat statuses and tags carry
 * (DragAndDrop.htmlDraggableStatus / htmlDraggableTag), so it drops on any
 * sheet, token or HUD the system's way (drop-relay.js). A card not named
 * yet is not draggable.
 */
function dragData(actor, kind, row, isNew) {
  if (isNew || !row.item || (kind !== "status" && kind !== "tag")) return null;
  const options = kind === "status"
    ? { tier: Math.max(1, Number(row.tier) || 0) }
    : { temporary: !!row.temporary, permanent: !!row.permanent };
  return {
    type:    kind,
    name:    row.item.name,
    options: JSON.stringify(options),
    source:  actor.uuid,
  };
}

/**
 * The on / off fields, as toggle icons on the footer band (fixes phase 2),
 * only where the system has the field: partial on a clue, temporary /
 * permanent on a status or a story tag, crispy on a story tag.
 */
const FLAG_INFO = {
  partial:   { icon: "fa-puzzle-piece",   label: "MistHUD.cardSheet.deck.partial" },
  temporary: { icon: "fa-hourglass-half", label: "CityOfMist.terms.temporary" },
  permanent: { icon: "fa-gem",            label: "CityOfMist.terms.permanent" },
  crispy:    { icon: "fa-leaf",           label: "MistHUD.cardSheet.deck.crispy" },
};
const flag = (field, on) => {
  const label = L(FLAG_INFO[field].label);
  return {
    field, label, on: !!on,
    icon:    FLAG_INFO[field].icon,
    tooltip: `${label}: ${L(on ? "MistHUD.cardSheet.deck.flagOn" : "MistHUD.cardSheet.deck.flagOff")}`,
  };
};

/** One deck card. */
function deckCard(actor, kind, row, { own, edit, newId, armedKey }) {
  const info = KIND_INFO[kind];
  const isNew = row.id === newId;
  const card = {
    id:        row.id,
    kind,
    kindLabel: L(info.label),
    name:      row.name,
    rawName:   row.item?.name ?? row.name,
    isNew,
    own,
    // The fields (name, the small fields) are inputs in edit mode and on a
    // new card; on a card worked on (brought forward, the deck window) too.
    editable:  own && (edit || isNew),
    // The number after the name on the band: "-3" (status), " (2)" (clue, juice).
    suffix:    "",
    boxes:     amountBoxes(0),
    boxEdit:   own,
    markers:   markerOrder().map(key => ({ key, on: key === kind })),
    ...cardTools(kind, row, own, edit, armedKey),
    flags:     [],
    texts:     [],
    notes:     [],
    selectable: false,
    selection: "",
  };
  switch (kind) {
    case "status": {
      const sel = selectionView(row.item, edit);
      Object.assign(card, sel, {
        suffix: `-${row.tier}`,
        boxes: statusBoxes(row.item, tierBoxes(), singleBox()),
        flags: [flag("temporary", row.temporary), flag("permanent", row.permanent)],
      });
      break;
    }
    case "tag": {
      const sel = selectionView(row.item, edit);
      Object.assign(card, sel, {
        burned:    row.burnState === "burned",
        burnState: row.burnState,
        boxEdit:   false,
        flags: [flag("temporary", row.temporary), flag("permanent", row.permanent), flag("crispy", row.crispy)],
      });
      break;
    }
    case "juice":
      Object.assign(card, {
        suffix: `\u00a0(${row.amount})`,
        boxes: amountBoxes(row.amount),
      });
      break;
    case "clue":
      Object.assign(card, {
        suffix: `\u00a0(${row.amount})`,
        boxes: amountBoxes(row.amount),
        flags: [flag("partial", row.partial)],
        texts: [
          { field: "source", value: row.item?.system?.source ?? "", placeholder: L("CityOfMist.terms.clueSource") },
          { field: "method", value: row.item?.system?.method ?? "", placeholder: L("CityOfMist.terms.clueMethod") },
        ],
      });
      break;
  }
  // A clue's source and method, as text when they are not editable.
  card.notes = card.texts.map(t => t.value).filter(Boolean);
  card.hasFields = card.texts.length > 0;
  card.flagsOn = card.flags.some(f => f.on);
  // Play mode: the + / − squares in the top-right corner select a status or
  // a story tag for the roll (fixes phase 2; they replace the name buttons).
  if (card.selectable) {
    const value = kind === "status" ? row.tier : 1;
    card.select = [1, -1].map(direction => {
      const on = card.selection === (direction > 0 ? "positive" : "negative");
      const label = L(direction > 0 ? "MistHUD.cardSheet.deck.selectPositive" : "MistHUD.cardSheet.deck.selectNegative",
        { value: `${direction > 0 ? "+" : "−"}${value}` });
      return {
        direction, on, label,
        icon:    direction > 0 ? "fa-square-plus" : "fa-square-minus",
        tooltip: on ? `${label}<br>${L("MistHUD.cardSheet.deck.selectClear")}` : label,
      };
    });
  } else if (card.noSelect) {
    card.selectTooltip = L("MistHUD.cardSheet.burnedNoSelect");
  }
  card.focusLabel = L("MistHUD.cardSheet.deck.bringForward", { name: card.name });
  card.namePlaceholder = L("MistHUD.cardSheet.deck.namePlaceholder");
  card.boxLabel = L(kind === "status" ? "MistHUD.cardSheet.deck.boxStatus" : "MistHUD.cardSheet.deck.boxAmount");
  card.drag = dragData(actor, kind, row, isNew);
  return card;
}

/**
 * The blank card the toolbar's + brings forward: not an item yet. Its type
 * is picked on the type marker (the icons in the top-right corner), its
 * name typed on the TAG line; Enter (or "Create") makes the item.
 * @param {string}   kind   the type picked so far
 * @param {string}   name   what was typed so far
 * @param {string[]} kinds  the deck's types in this game
 */
function draftCard(kind, name, kinds) {
  return {
    id:        DRAFT_ID,
    kind,
    kindLabel: L(KIND_INFO[kind].label),
    name:      "",
    rawName:   name ?? "",
    isDraft:   true,
    own:       true,
    editable:  true,
    suffix:    "",
    boxes:     amountBoxes(0),
    boxEdit:   false,
    markers:   markerOrder().map(key => ({
      key, on: key === kind,
      pick:  kinds.includes(key),
      label: L(KIND_INFO[key].one),
    })),
    steps: [], tools: [], flags: [], texts: [], notes: [],
    hasFields: false,
    flagsOn:   false,
    selectable: false,
    selection: "",
    drag:      null,
    namePlaceholder: L("MistHUD.cardSheet.deck.namePlaceholder"),
    pickHint:  L("MistHUD.cardSheet.deck.pickType"),
    createLabel: L("MistHUD.cardSheet.deck.create"),
  };
}

/** Help and Hurt are on the character card, not in the deck. */
const isHelpHurt = row => row.subtype === "help" || row.subtype === "hurt";

const ROWS = {
  status: deck => deck.statuses,
  tag:    deck => deck.storyTags,
  juice:  deck => deck.juice.filter(row => !isHelpHurt(row)),
  clue:   deck => deck.clues,
};

/**
 * The deck's render context.
 * @param {Actor}  actor
 * @param {object} [options]
 * @param {"stack"|"focus"|"spread"} [options.view]
 * @param {string}  [options.focusId]  the card brought forward ("focus")
 * @param {boolean} [options.inWindow] the detached window (always spread)
 * @param {string}  [options.newId]    a card just created (blank name, focused)
 * @param {string}  [options.armed]    "<itemId>:<action>" of a button asking "sure?"
 * @param {{kind: string, name: string}} [options.draft]  the blank card forward (focusId DRAFT_ID)
 */
export function buildDeckContext(actor, { view = "stack", focusId = null, inWindow = false, newId = null, armed = null, draft = null } = {}) {
  const own = !!actor?.isOwner;
  const edit = own && isEditMode(actor);
  const items = getDeckItems(actor);
  const kinds = DECK_KINDS[getActiveSystem()] ?? DEFAULT_KINDS;
  const groups = kinds.map(kind => {
    const info = KIND_INFO[kind];
    return {
      kind,
      icon:    info.icon,
      label:   L(info.label),
      empty:   L(info.empty),
      creates: own ? CREATES[kind].map(c => ({ ...c, label: L(c.label) })) : [],
      cards:   ROWS[kind](items).map(row => deckCard(actor, kind, row, { own, edit, newId, armedKey: armed })),
    };
  });
  const cards = groups.flatMap(g => g.cards);
  const state = deckState(actor);
  const isDraft = own && view === "focus" && focusId === DRAFT_ID && draft && kinds.includes(draft.kind);
  const focus = isDraft ? draftCard(draft.kind, draft.name, kinds)
    : view === "focus" ? cards.find(c => c.id === focusId) ?? null : null;
  const shown = inWindow ? "spread" : focus ? "focus" : view === "spread" ? "spread" : "stack";
  // The stack: the card last brought forward stays in front (the whole one).
  const top = cards.find(c => c.id === state.top);
  const stack = top ? [...cards.filter(c => c !== top), top] : cards;
  return {
    view:     shown,
    spread:   shown === "spread",
    inWindow,
    detached: !inWindow && state.detached,
    hidden:   !inWindow && state.hidden,
    own,
    edit,
    groups,
    cards,
    stack,
    focus,
    counts:   groups.map(g => ({ kind: g.kind, icon: g.icon, label: g.label, count: g.cards.length })),
    // The toolbar's + menu: a blank card of each type, in the type marker's order.
    adds:     own ? markerOrder().filter(k => kinds.includes(k)).map(kind => ({ kind, icon: KIND_INFO[kind].icon, label: L(KIND_INFO[kind].one) })) : [],
    addLabel: L("MistHUD.cardSheet.deck.newCard"),
    hideLabel: L(state.hidden ? "MistHUD.cardSheet.deck.unhide" : "MistHUD.cardSheet.deck.hide"),
  };
}

// ── Roll modifier totals (near the move buttons) ─────────────────────────────

/** Is this selection row one of the character's deck cards (a status or a story tag of its own)? */
function isDeckRow(actor, row) {
  if (row.ownerId !== actor.id) return false;
  if (row.type === "status") return true;
  return row.type === "tag" && actor.items.get(row.id)?.system?.subtype === "story";
}

/**
 * What a list of selected rows adds to a roll, counted as the system's roll
 * does (CityRoll, system 4.5.3): every tag (and juice / modifier) adds its
 * amount; of the statuses only the highest positive and the lowest negative
 * count.
 */
function rollValue(rows) {
  let total = 0;
  let maxPos = 0;
  let minNeg = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (row.type === "status") {
      if (amount > maxPos) maxPos = amount;
      if (amount < minNeg) minNeg = amount;
    } else {
      total += amount;
    }
  }
  return total + maxPos + minNeg;
}

const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/**
 * The totals shown next to the move bar for this actor's sheet, per the
 * client setting: "cards" (the selected deck cards only, default), "split"
 * (the other selected tags, then the deck cards) or "all" (the whole
 * selection, as the roll counts it).
 * @returns {{label: string, value: string, sign: string}[]}
 */
export function selectionTotals(actor) {
  let mode = "cards";
  try { mode = game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_MOD_TOTAL) ?? "cards"; } catch { /* default */ }
  const rows = getSystemSelection();
  const cards = rows.filter(r => isDeckRow(actor, r));
  const others = rows.filter(r => !isDeckRow(actor, r));
  const entry = (label, n) => ({ label: L(label), value: signed(n), sign: n > 0 ? "positive" : n < 0 ? "negative" : "zero" });
  switch (mode) {
    case "all":   return [entry("MistHUD.cardSheet.total.all", rollValue(rows))];
    case "split": return [entry("MistHUD.cardSheet.total.tags", rollValue(others)), entry("MistHUD.cardSheet.total.cards", rollValue(cards))];
    default:      return [entry("MistHUD.cardSheet.total.cards", rollValue(cards))];
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** The deck item a control sits on (deck items always belong to the sheet's actor). */
function itemAt(app, target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  return id ? app.actor.items.get(id) ?? null : null;
}

/** The actor, if this user may change it; warns otherwise. */
function ownedActor(app) {
  if (!app.actor?.isOwner) {
    ui.notifications.warn(L("MistHUD.cardSheet.notOwner"));
    return null;
  }
  return app.actor;
}

/** "Tier-pips" of a status, as the system's edit log writes it. */
const statusString = s => `${s.name}-${s.system.tier}${+s.system.pips ? `.${s.system.pips}` : ""}`;

/**
 * The on-card "sure?": the first click arms the button (red, "Sure?") for
 * three seconds, the second one goes through. Right click goes through at
 * once where the system skips its confirmation (delete).
 * @returns {boolean} true when the action should run now
 */
function confirmed(app, event, target, { rightClickSkips = false } = {}) {
  if (rightClickSkips && event.button === 2) return true;
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  const key = `${id}:${target.dataset.action}`;
  if (app.deckArmed?.key === key && app.deckArmed.until > Date.now()) {
    app.deckArmed = null;
    return true;
  }
  app.deckArmed = { key, until: Date.now() + ARM_MS };
  app.renderDeck({ keepView: true });
  setTimeout(() => {
    if (app.deckArmed?.key !== key) return;
    app.deckArmed = null;
    if (app.rendered) app.renderDeck({ keepView: true });
  }, ARM_MS);
  return false;
}

/**
 * Click on a card of the stack (or a band in the spread): bring it forward.
 * It then stays in front of the stack until another one is brought forward.
 */
async function focusDeckCard(event, target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  if (!id || id === DRAFT_ID || !this.isMistCardSheet) return;
  this.deckView = "focus";
  this.deckFocus = id;
  this.deckDraft = null;
  await writeUiState(this.actor, { deck: { top: id } });
  this.renderDeck();
}

/**
 * Back to the stack (the forward card goes back, the spread closes). A blank
 * card with a name typed is made first (a typed name is a card); left
 * unnamed, it is dropped.
 */
export function backToStack(app) {
  const draft = app.deckDraft;
  if (draft) {
    const name = String(draftInput(app)?.value ?? draft.name ?? "").trim();
    if (draft.creating || name) {
      draft.leave = true;
      if (!draft.creating) void createFromDraft(app, name);
      return;
    }
  }
  if (app.deckView === "stack" && !app.deckDraft) return;
  app.deckView = "stack";
  app.deckFocus = null;
  app.deckDraft = null;
  app.renderDeck();
}

function closeDeckView() {
  backToStack(this);
}

/** The toolbar's hide / unhide: the deck tucked behind the layers, only its unhide button and a strip of the cards showing. */
async function toggleDeckHidden() {
  if (!this.isMistCardSheet) return;
  await writeUiState(this.actor, { deck: { hidden: !deckState(this.actor).hidden } });
  this.renderDeck();
}

/**
 * The toolbar's + menu: a blank card of that type, forward (not an item
 * yet). The type can still be changed on its type marker.
 */
function draftDeckCard(event, target) {
  const kind = target.dataset.kind;
  if (!this.isMistCardSheet || !KIND_INFO[kind] || !ownedActor(this)) return;
  target.closest("details")?.removeAttribute("open");
  this.deckDraft = { kind, name: "" };
  this.deckView = "focus";
  this.deckFocus = DRAFT_ID;
  this.renderDeck();
}

/** A type marker of the blank card: that type. What was typed is kept. */
function draftDeckKind(event, target) {
  const kind = target.dataset.kind;
  this.deckPicking = false;
  if (!this.deckDraft || this.deckDraft.creating || !KIND_INFO[kind]) return;
  const input = draftInput(this);
  if (input) this.deckDraft.name = input.value;
  this.deckDraft.kind = kind;
  this.renderDeck();
}

/** The blank card's "Create" button. */
function createDeckDraft() {
  return createFromDraft(this, draftInput(this)?.value);
}

const draftInput = app => app.element?.querySelector(`[data-item-id="${DRAFT_ID}"] input[data-deck-field="name"]`) ?? null;

/**
 * The blank card is named (Enter, "Create", or leaving its name field with a
 * name typed): the item is made with the system's own creation methods (as
 * createDeckItem), logged "Created", and brought forward (and to the front
 * of the stack) to be set: its boxes, toggles, a clue's source. Left on the
 * way out (backToStack: draft.leave), it goes to the stack instead.
 * @param {object} [options]
 * @param {boolean} [options.quiet]  no warning when the name is empty
 */
async function createFromDraft(app, typed, { quiet = false } = {}) {
  const draft = app.deckDraft;
  const actor = ownedActor(app);
  if (!draft || draft.creating || !actor) return;
  const name = String(typed ?? draft.name ?? "").trim();
  if (!name) {
    if (quiet) return;
    ui.notifications.warn(L("MistHUD.cardSheet.deck.nameFirst"));
    draftInput(app)?.focus();
    return;
  }
  draft.name = name;
  draft.creating = true;
  try {
    await once(app, async () => {
      let created = null;
      switch (draft.kind) {
        case "status": created = await actor.createNewStatus(name); break;
        case "tag":    created = await actor.createStoryTag(name); break;
        case "clue":   created = await actor.createNewClue({ name }); break;
        case "juice":  created = await actor.createNewJuice(name); break;
      }
      if (!created?.id) return;
      const after = created.type === "status" ? `tier  ${created.system.tier}`
        : created.type === "clue" || created.type === "juice" ? `${created.system.amount}` : undefined;
      await logModification(actor, "Created", created, after);
      if (app.deckDraft === draft) app.deckDraft = null;
      app.deckView = draft.leave ? "stack" : "focus";
      app.deckFocus = draft.leave ? null : created.id;
      await writeUiState(actor, { deck: { top: created.id } });
      if (created.type === "tag") app.render({ parts: ["layer2", "deck"] });
      else app.renderDeck();
    });
  } finally {
    draft.creating = false;
  }
}

/** The toolbar's spread button: lay every card out in front of the sheet, or put them back. */
function spreadDeck() {
  this.deckView = this.deckView === "spread" ? "stack" : "spread";
  this.deckFocus = null;
  this.renderDeck();
}

/**
 * The + / − squares in a card's top-right corner (play mode): select the
 * status or story tag for the next roll in that direction; the same square
 * again clears it, the other one switches it (system-adapter
 * setRollDirection).
 */
function selectDeckCard(event, target) {
  if (this.editMode) return;
  const item = itemAt(this, target);
  const direction = Number(target.dataset.direction);
  if (!item || (item.type !== "status" && item.type !== "tag")) return;
  event.preventDefault();
  setRollDirection(item, direction);
}

/**
 * New status / story tag / juice / clue, with the system's own creation
 * methods (HTMLHandlers.createStatus / createStoryTag,
 * CityActorSheet._createClue / _createJuiceOfType), but no dialog: the new
 * card shows up with an empty name field, focused. Naming it logs
 * "Created"; leaving the name empty (or Esc) deletes it again.
 * The character card's story tag "+" uses it too (data-origin="character"):
 * the new tag's name field is then on the character card.
 */
async function createDeckItem(event, target) {
  const actor = ownedActor(this);
  if (!actor) return;
  const kind = target.dataset.kind;
  const onCharacter = kind === "tag" && target.dataset.origin === "character" && this.isMistCardSheet;
  await once(this, async () => {
    let created = null;
    switch (kind) {
      case "status": created = await actor.createNewStatus("Unnamed Status"); break;
      case "tag":    created = await actor.createStoryTag(); break;
      case "clue":   created = await actor.createNewClue({ name: "Unnamed Clue" }); break;
      case "juice":  created = await actor.createNewJuice("Unnamed Juice"); break;
    }
    if (!created?.id) return;
    this.deckNew = created.id;
    this.deckNewOrigin = onCharacter ? "character" : "deck";
    // A story tag shows on the character card too.
    if (kind === "tag" && this.isMistCardSheet) this.render({ parts: ["layer2", "deck"] });
    else this.renderDeck({ keepView: true });
  });
}

/**
 * Click on a box: a status is set to that many boxes checked (the system's
 * setBoxesChecked; one box per tier in the mist-engine model; clicking the
 * last checked box unchecks it), a clue or juice to the highest number
 * printed at or before the box (amountForBox).
 */
async function setDeckBoxes(event, target) {
  const item = itemAt(this, target);
  const actor = ownedActor(this);
  if (!item || !actor) return;
  const box = Number(target.dataset.box) + 1;
  if (!(box >= 1)) return;
  await once(this, async () => {
    if (item.type === "status") {
      const before = statusString(item);
      if (await setStatusBoxes(item, box, tierBoxes(), singleBox())) {
        await logModification(actor, "Edited", item, `${before} edited --> ${statusString(item)})`);
      }
    } else if (item.type === "clue" || item.type === "juice") {
      const next = amountForBox(box, item.system.amount);
      if (next !== (Number(item.system.amount) || 0)) await item.update({ "system.amount": next });
    }
  });
}

/**
 * − / + on a card: a status loses or gains one tier with the system's status
 * math (status.subtractStatus / addStatus, which log it; down to tier 0
 * removes it, as in the system); a clue or juice one point.
 */
async function stepDeckCard(event, target) {
  const item = itemAt(this, target);
  const actor = ownedActor(this);
  const step = Number(target.dataset.step);
  if (!item || !actor || !step) return;
  await once(this, async () => {
    if (item.type === "status") {
      if (step > 0) await item.addStatus(1, { newName: item.name });
      else await item.subtractStatus(1);
    } else if (item.type === "clue" || item.type === "juice") {
      const amount = Math.max(0, (Number(item.system.amount) || 0) + step);
      await item.update({ "system.amount": amount });
    }
  });
}

/** The toggle icons on the footer band: temporary, permanent (statuses, story tags), crispy (story tags), partial (clues). */
async function toggleDeckFlag(event, target) {
  const item = itemAt(this, target);
  const field = target.dataset.field;
  if (!item || !ownedActor(this) || !(field in FLAG_INFO)) return;
  await item.update({ [`system.${field}`]: !item.system[field] });
}

/**
 * Delete a deck card, after "sure?" on the button (right click on a status
 * or a story tag: at once, as the system sheet's delete). Logged as the
 * system sheet does.
 */
async function deleteDeckCard(event, target) {
  const item = itemAt(this, target);
  const actor = ownedActor(this);
  if (!item || !actor) return;
  if (!confirmed(this, event, target, { rightClickSkips: item.type === "status" || item.type === "tag" })) return;
  await once(this, async () => {
    switch (item.type) {
      case "status":
        await logModification(actor, "Deleted", item, `tier ${item.system.tier}`);
        await actor.deleteStatus(item.id);
        break;
      case "tag":
        // actor.deleteTag logs it.
        await actor.deleteTag(item.id, { removeImprovement: false });
        break;
      case "clue":
        await actor.deleteClue(item.id);
        await logModification(actor, "Removed", item);
        break;
      case "juice":
        await actor.deleteJuice(item.id);
        await logModification(actor, "Removed", item);
        break;
    }
  });
}

/** Spend a clue (CityActorSheet._useClue): players only, after "sure?" on the button. */
async function useClue(event, target) {
  const clue = itemAt(this, target);
  if (clue?.type !== "clue" || !ownedActor(this)) return;
  if (game.user.isGM) {
    ui.notifications.warn(L("MistHUD.cardSheet.deck.cluePlayersOnly"));
    return;
  }
  if (!confirmed(this, event, target)) return;
  await once(this, () => clue.spendClue());
}

/** Burn / unburn a story tag (HTMLHandlers.burnTag / unburnTag), after "sure?" on the button. */
async function burnDeckTag(event, target) {
  const tag = itemAt(this, target);
  const actor = ownedActor(this);
  if (tag?.type !== "tag" || !actor) return;
  if (!confirmed(this, event, target)) return;
  await once(this, async () => {
    if (Number(tag.system.burn_state) === 0) {
      if (!tag.isBurnable) return;
      await actor.burnTag(tag.id);
      await logModification(actor, "Burned", tag);
    } else {
      await actor.burnTag(tag.id, 0);
      await logModification(actor, "Unburned", tag);
    }
  });
}

/** Detach the deck into its own window; the sheet shows a placeholder. */
async function detachDeck() {
  const actor = this.actor;
  this.deckView = "stack";
  this.deckFocus = null;
  await writeUiState(actor, { deck: { detached: true } });
  openDeckWindow(actor);
  refreshDeckParts(actor);
}

/** Attach the deck again (the placeholder, or the window's attach control). */
async function attachDeckAction() {
  await attachDeck(this.actor);
}

/** Every deck action, for MistCardSheet and TagsDeck (`this` is the app). */
export const DECK_ACTIONS = {
  focusDeckCard,
  closeDeckView,
  spreadDeck,
  toggleDeckHidden,
  draftDeckCard,
  draftDeckKind,
  createDeckDraft,
  selectDeckCard,
  createDeckItem,
  setDeckBoxes,
  stepDeckCard,
  toggleDeckFlag,
  // Right-click deletes a status or a story tag at once, like the system sheet.
  deleteDeckCard: { handler: deleteDeckCard, buttons: [0, 2] },
  useClue,
  burnDeckTag,
  detachDeck,
  attachDeck: attachDeckAction,
};

// ── The fields on a card (name, clue source / method) ──────────────────────

/**
 * A field of a deck card changed (Enter or leaving it). The name: renamed
 * (a status or clue / juice logged as the system's edit dialog does); a new
 * card is logged as created, or deleted again when left empty.
 */
async function changeDeckField(app, input) {
  // The blank card: a typed name makes the card (not everyone sees the
  // buttons below it), unless a type marker is being clicked: the type
  // changes first, and the card is made when the name is left again.
  if (input.closest(`[data-item-id="${DRAFT_ID}"]`)) {
    if (!app.deckDraft || input.dataset.deckField !== "name") return;
    app.deckDraft.name = input.value ?? "";
    if (!app.deckPicking) void createFromDraft(app, input.value, { quiet: true });
    return;
  }
  const item = itemAt(app, input);
  const actor = app.actor;
  if (!item || !actor?.isOwner) return;
  const field = input.dataset.deckField;
  const value = input.value ?? "";
  switch (field) {
    case "name": {
      const name = value.trim();
      const isNew = app.deckNew === item.id;
      if (!name) {
        if (isNew) await dropNewCard(app, item);
        else input.value = item.name;
        return;
      }
      if (isNew) app.deckNew = null;
      if (name === item.name && !isNew) return;
      const before = item.type === "status" ? statusString(item) : `${item.name} (${item.system.amount})`;
      // Named with its default name: no update, so no re-render; the name
      // field still has to go (on the character card for a story tag).
      if (isNew && name === item.name && app.isMistCardSheet) app.render({ parts: ["layer2", "deck"] });
      await item.update({ name });
      if (isNew) {
        const after = item.type === "status" ? `tier  ${item.system.tier}`
          : item.type === "clue" ? `${item.system.amount}${item.system.partial ? ", partial" : ""}`
          : item.type === "juice" ? `${item.system.amount}` : undefined;
        await logModification(actor, "Created", item, after);
      } else if (item.type === "status") {
        await logModification(actor, "Edited", item, `${before} edited --> ${statusString(item)})`);
      } else if (item.type === "clue" || item.type === "juice") {
        await logModification(actor, "Edited", item, `${before} edited --> ${item.name} (${item.system.amount})`);
      }
      return;
    }
    case "source":
    case "method":
      if (value !== (item.system[field] ?? "")) await item.update({ [`system.${field}`]: value });
      return;
  }
}

/** A new card left without a name: it goes away again (as the system deletes a cancelled one). */
async function dropNewCard(app, item) {
  if (app.deckNew !== item.id) return;
  app.deckNew = null;
  await item.delete();
}

// ── Shared listeners (sheet and window) ──────────────────────────────────────

/**
 * Once per window: the card fields (change, Enter, Esc, leaving a new
 * card's empty name), and system draggables (chat statuses and tags, scene
 * tags) dropped on the window, which go to the actor the system's way
 * (CitySheet._dragDropEvent). The drop is caught before the sheet's own
 * DragDrop, which the system patches to drop on the canvas token under the
 * pointer. The sheet also gets Esc / a click beside the cards to close its
 * focus or spread view.
 * @param {ApplicationV2} app  the sheet or the deck window
 */
export function bindDeckListeners(app, { views = true } = {}) {
  const el = app.element;
  if (views) bindViewListeners(app);
  el.addEventListener("change", event => {
    const input = event.target.closest?.("[data-deck-field]");
    if (input) void changeDeckField(app, input);
  });
  el.addEventListener("keydown", event => {
    const input = event.target.closest?.("input[data-deck-field]");
    if (!input) return;
    if (input.closest(`[data-item-id="${DRAFT_ID}"]`)) {
      if (event.key === "Enter") {
        event.preventDefault();
        void createFromDraft(app, input.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        backToStack(app);
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      const item = itemAt(app, input);
      if (input.dataset.deckField === "name" && item && app.deckNew === item.id) {
        void dropNewCard(app, item);
        return;
      }
      input.value = input.defaultValue;
      input.blur();
    }
  });
  // A new card's name left empty (no "change" fires for an unchanged empty field).
  el.addEventListener("focusout", event => {
    const input = event.target.closest?.('input[data-deck-field="name"]');
    if (!input || input.value.trim()) return;
    setTimeout(() => {
      if (!input.isConnected || document.activeElement === input) return;
      const item = itemAt(app, input);
      if (item && app.deckNew === item.id) void dropNewCard(app, item);
    }, 0);
  });
  // System draggables dropped here go to the actor (a deck card of this
  // actor does nothing); non-owners ask a GM (drop-relay.js).
  bindDropTarget(el, () => app.actor);
  // A deck card dragged out: the browser needs some data to start the drag
  // (Firefox). Capture phase: the system's own dragstart stops the event at
  // the card. On the sheet, the core's DragDrop then puts the item there.
  el.addEventListener("dragstart", event => {
    const card = event.target.closest?.(".mh-cs-deck-card.draggable");
    if (!card || !event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", card.dataset.name ?? "");
  }, { capture: true });
  // A type marker of the blank card pressed: its name field's "change"
  // (fired before the click) keeps the name without making the card yet.
  el.addEventListener("pointerdown", event => {
    if (!event.target.closest?.(".mh-cs-deck-markers-pick")) return;
    app.deckPicking = true;
    window.addEventListener("pointerup", () => setTimeout(() => { app.deckPicking = false; }, 300), { once: true });
  }, { capture: true });
  // A draggable card can't have its text fields selected with the mouse:
  // the card stops being draggable while a field is pressed.
  el.addEventListener("pointerdown", event => {
    if (!event.target.closest?.("input, select, textarea")) return;
    const card = event.target.closest(".mh-cs-deck-card[draggable='true']");
    if (!card) return;
    card.draggable = false;
    window.addEventListener("pointerup", () => { card.draggable = true; }, { once: true });
  }, { capture: true });
}

/**
 * Esc while a sheet shows a card forward or the spread deck: back to the
 * stack. Caught on the window (capture), before the core's Esc, which would
 * close the sheet (the focus is often outside it after a re-render).
 */
let escapeBound = false;
function bindEscape() {
  if (escapeBound) return;
  escapeBound = true;
  window.addEventListener("keydown", event => {
    if (event.key !== "Escape" || event.repeat) return;
    if (event.target.closest?.("input, textarea, select, prose-mirror, [contenteditable]")) return;
    const app = [...foundry.applications.instances.values()]
      .filter(a => a.isMistCardSheet && a.rendered && a.deckView && a.deckView !== "stack")
      .sort((a, b) => (Number(b.element?.style.zIndex) || 0) - (Number(a.element?.style.zIndex) || 0))[0];
    if (!app) return;
    event.preventDefault();
    event.stopPropagation();
    backToStack(app);
  }, { capture: true });
}

/** Esc, or a click beside the cards, closes the focus / spread view (the sheet only). */
function bindViewListeners(app) {
  const el = app.element;
  bindEscape();
  el.addEventListener("click", event => {
    if (!event.target.matches?.(".mh-cs-deck-overlay, .mh-cs-deck-overlay > .mh-cs-deck-columns, .mh-cs-deck-column, .mh-cs-deck-list, .mh-cs-deck-focus")) return;
    if (app.deckView === "stack") return;
    backToStack(app);
  });
  // The toolbar's + menu closes on a click anywhere else.
  el.addEventListener("pointerdown", event => {
    for (const menu of el.querySelectorAll("details.mh-cs-deck-add[open]")) {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    }
  });
}

/**
 * After the deck renders: a new card's name field takes the focus; on the
 * sheet, while a card is forward or the deck is spread, the focus moves
 * into it (its "Back to the deck" button) unless it already is in the sheet.
 */
export function focusDeckView(app) {
  if (app.deckDraft) {
    const input = draftInput(app);
    if (input) {
      input.focus({ preventScroll: true });
      const end = input.value.length;
      try { input.setSelectionRange(end, end); } catch { /* not a text field */ }
      return;
    }
  }
  if (app.deckNew) {
    const input = app.element.querySelector(`[data-item-id="${app.deckNew}"] input[data-deck-field="name"]`);
    if (input) {
      input.focus({ preventScroll: false });
      return;
    }
  }
  if (!app.deckView || app.deckView === "stack") return;
  if (app.element.contains(document.activeElement) && document.activeElement !== app.element) return;
  app.element.querySelector(".mh-cs-deck-back, .mh-cs-deck-close")?.focus({ preventScroll: true });
}

/** After each render: system draggables inside the window (DragAndDrop.addDragFunctionality). */
export function deckRendered(app) {
  void addDragFunctionality(app.element);
}

// ── Detached window ──────────────────────────────────────────────────────────

const windowId = actor => `mh-tags-deck-${actor.uuid.replaceAll(".", "-")}`;

/** The open deck window of this actor, if any. */
export function deckWindowFor(actor) {
  return foundry.applications.instances.get(windowId(actor)) ?? null;
}

/** Open (or bring up) this actor's deck window. */
export function openDeckWindow(actor) {
  const existing = deckWindowFor(actor);
  if (existing) {
    existing.render({ force: true });
    existing.bringToFront?.();
    return existing;
  }
  const app = new TagsDeck({ actor });
  app.render({ force: true });
  return app;
}

/** Attach the deck again: the window closes, the sheets show the deck. */
export async function attachDeck(actor) {
  await writeUiState(actor, { deck: { detached: false } });
  const win = deckWindowFor(actor);
  if (win) await win.close({ keepState: true });
  refreshDeckParts(actor);
}

/** Re-render the deck part of this actor's open card sheets. */
function refreshDeckParts(actor) {
  for (const app of foundry.applications.instances.values()) {
    if (app.rendered && app.isMistCardSheet && app.actor?.uuid === actor.uuid) app.render({ parts: ["deck"] });
  }
}

/** Re-render this actor's open deck window (its items or lock changed). */
export function refreshDeckWindow(actor) {
  if (!actor) return;
  const win = deckWindowFor(actor);
  if (win?.rendered) win.render();
}

/** Re-render every open deck window (the selection changed). */
export function refreshAllDeckWindows() {
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof TagsDeck && app.rendered) app.render();
  }
}

/**
 * The detached tags-deck: a frameless floating window (like the sheet) with
 * a small dark band as drag handle, holding the attach and close controls.
 * It always shows the spread columns, every card worked on in place.
 * Closing it attaches the deck again. Its position is kept per actor
 * (cardSheetState).
 */
export class TagsDeck extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mh-card-sheet", "mh-cs-deck-window"],
    position: { width: 900, height: 560 },
    window: { resizable: true, minimizable: false },
    actions: { ...DECK_ACTIONS },
  };

  static PARTS = {
    deck: { template: DECK_TEMPLATES.columns },
  };

  #actor;
  #keepState = false;
  /** card-fit.js watcher of the cards' names. */
  #unwatchFit = null;

  /** The window always shows the spread columns. */
  deckView = "spread";
  deckFocus = null;
  /** A card just created (blank name, focused). */
  deckNew = null;
  /** A button asking "sure?": { key, until }. */
  deckArmed = null;

  /** @param {{actor: Actor}} options  (the actor is kept apart: AppV2 deep-merges its options) */
  constructor({ actor, ...options } = {}) {
    const saved = deckState(actor).position;
    super({
      ...options,
      id: windowId(actor),
      ...(saved ? { position: { ...saved } } : {}),
    });
    this.#actor = actor;
  }

  get actor() {
    return this.#actor;
  }

  get title() {
    return L("MistHUD.cardSheet.deck.windowTitle", { name: this.#actor?.name ?? "" });
  }

  get editMode() {
    return isEditMode(this.#actor);
  }

  renderDeck() {
    this.deckView = "spread";
    this.deckFocus = null;
    return this.render();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.uid = this.id;
    // Every card in the window is worked on in place (like a card brought forward).
    context.work = true;
    context.deck = buildDeckContext(this.#actor, {
      inWindow: true,
      newId:    this.deckNew,
      armed:    this.deckArmed?.until > Date.now() ? this.deckArmed.key : null,
    });
    return context;
  }

  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    frame.dataset.mode = this.editMode ? "edit" : "play";
    const header = frame.querySelector(".window-header");
    const close = header?.querySelector('[data-action="close"]');
    const button = document.createElement("button");
    button.type = "button";
    button.className = "header-control icon fa-solid fa-right-to-bracket mh-cs-deck-attach";
    button.dataset.action = "attachDeck";
    const label = L("MistHUD.cardSheet.deck.attach");
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    if (close) close.before(button);
    else header?.append(button);
    return frame;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    bindDeckListeners(this, { views: false });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.dataset.mode = this.editMode ? "edit" : "play";
    deckRendered(this);
    focusDeckView(this);
    // The cards' names are fitted to their band (card-fit.js).
    this.#unwatchFit?.();
    this.#unwatchFit = watchFit(this.element.querySelector(".window-content"));
  }

  setPosition(position) {
    const result = super.setPosition(position);
    this.#savePosition();
    return result;
  }

  #savePosition = foundry.utils.debounce(() => {
    if (!this.rendered || !this.#actor) return;
    const { left, top, width, height } = this.position;
    void writeUiState(this.#actor, { deck: { position: { left, top, width, height } } });
  }, 500);

  async close(options = {}) {
    this.#keepState = !!options.keepState;
    return super.close(options);
  }

  /** Closed by its × (not by attach, or by its sheet closing): the deck goes back to the sheet. */
  _onClose(options) {
    super._onClose(options);
    this.#unwatchFit?.();
    this.#unwatchFit = null;
    if (this.#keepState || !this.#actor) return;
    void writeUiState(this.#actor, { deck: { detached: false } }).then(() => refreshDeckParts(this.#actor));
  }
}
