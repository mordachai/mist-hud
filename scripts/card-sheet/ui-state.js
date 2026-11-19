// ui-state.js — the card sheet's own UI state (plan § 6.2), per actor uuid,
// in the client setting cardSheetState:
//   { [actorUuid]: {
//       flipped: { [cardId]: true },   cards showing their back
//       front:   1 | 2,                the layer in front
//       deck:    { detached: bool, position: { left, top, width, height },
//                  hidden: bool (tucked behind the layers), top: itemId (the
//                  card last brought forward, in front of the stack) },
//       portrait: "hide" | "portrait" | "hero",   the portrait at the left
//   } }
// Shared by MistCardSheet and the detached TagsDeck window.

import { MODULE_ID, SETTINGS } from "../constants.js";

export function readUiState(actor) {
  try { return game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_STATE)?.[actor.uuid] ?? {}; }
  catch { return {}; }
}

/** Only the cards really flipped (drops leftovers of the old "-=key" writes). */
export function cleanFlips(flips) {
  return Object.fromEntries(Object.entries(flips ?? {}).filter(([, on]) => on === true));
}

/**
 * Change this actor's sheet state. `flipped: { [cardId]: bool }` sets or
 * clears a card's flip (cleared keys are deleted by hand: in v14
 * mergeObject leaves a ForcedDeletion object for "-=key", which reads as
 * truthy); `front` sets the front layer; `deck` merges into the deck state
 * (detached, position); `portrait` sets the portrait mode.
 */
export async function writeUiState(actor, { flipped, front, deck, portrait } = {}) {
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
  if (portrait !== undefined) state.portrait = portrait;
  if (deck) state.deck = { ...(state.deck ?? {}), ...deck };
  all[actor.uuid] = state;
  await game.settings.set(MODULE_ID, SETTINGS.CARD_SHEET_STATE, all);
}

/** The deck's state for this actor: { detached, position, hidden, top }. */
export function deckState(actor) {
  const deck = readUiState(actor).deck ?? {};
  return {
    detached: deck.detached === true,
    position: deck.position ?? null,
    hidden:   deck.hidden === true,
    top:      typeof deck.top === "string" ? deck.top : null,
  };
}

/** The portrait modes, in the order the header bar's Portrait button cycles them. */
export const PORTRAIT_MODES = ["hide", "portrait", "hero"];

/** This actor's portrait mode at the left of the sheet: "hide" (default), "portrait" or "hero". */
export function portraitMode(actor) {
  const mode = readUiState(actor).portrait;
  return PORTRAIT_MODES.includes(mode) ? mode : "hide";
}
