// move-layout.js — Slot positions and layout config for move buttons
// Move data (name, effects, localization) comes from CityDB.movesList.
// This file only defines where buttons appear in the HUD footer.

/**
 * Returns the moves from CityDB.movesList organised for display.
 * Core moves → primary row, Advanced/SHB → secondary row.
 *
 * @param {Item[]} movesList  CityDB.movesList (already filtered to active system)
 * @returns {{ core: Item[], advanced: Item[], shb: Item[] }}
 */
export function organizeMoves(movesList) {
  const core     = movesList.filter(m => m.system.category === "Core");
  const advanced = movesList.filter(m => m.system.category === "Advanced");
  const shb      = movesList.filter(m => m.system.category === "SHB");
  return { core, advanced, shb };
}

/**
 * Return the short label to show on a text-mode move button.
 * Uses system.abbreviation if present, otherwise first 3 chars of name.
 *
 * @param {Item} move
 * @returns {string}
 */
export function getMoveAbbreviation(move) {
  if (move.system?.abbreviation?.trim()) return move.system.abbreviation.trim();
  return move.name.slice(0, 3).toUpperCase();
}

/**
 * Return the image src for an image-mode move button.
 * Falls back to null so the caller can decide to show text instead.
 *
 * @param {Item} move
 * @returns {string|null}
 */
export function getMoveImageSrc(move) {
  const abbr = move.system?.abbreviation?.trim();
  if (abbr) {
    // Convention: ui/<Abbreviation>.webp  (e.g. "CHANGE" → "ui/CHANGE.webp")
    return `modules/mist-hud/ui/${abbr}.webp`;
  }
  // Fall back to a safe name-based path
  const safeName = move.name.replace(/[^a-zA-Z0-9 ]/g, "");
  return `modules/mist-hud/ui/${safeName}.webp`;
}
