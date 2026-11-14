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
 * Button image per move, keyed by system then by normalized move-name prefix
 * (lower-case, letters/digits only). Matching by name + system is required:
 * abbreviations in the move items are empty or shared across systems.
 * Files live in ui/. Moves without an entry (e.g. Tracked/Detailed Outcome,
 * custom moves) fall back to the text button.
 */
const MOVE_IMAGES = {
  "city-of-mist": {
    changethegame: "Change the Game.webp", convince: "Convince.webp",
    facedanger: "Face Danger.webp", gotoetotoe: "Go Toe To Toe.webp",
    hitwith: "Hit with All You Got.webp", investigate: "Investigate.webp",
    lookbeyond: "Look Beyond the Mist.webp", sneakaround: "Sneak Around.webp",
    taketherisk: "Take the Risk.webp",
    stopholdingback1: "SHB-Significant.webp", stopholdingback2: "SHB-NoReturn.webp",
    stopholdingback3: "SHB-Ultimate.webp",
    openingmonologue: "Monologue.webp", flashback: "Flashback.webp",
    downtime: "Downtime.webp", sessionend: "Session End.webp"
  },
  otherscape: {
    mitigate: "Mitigate Consequences.webp", quickoutcome: "Quick Outcome.webp",
    gooutinablaze1: "GOIAB-Significant.webp", gooutinablaze2: "GOIAB-NoReturn.webp",
    gooutinablaze3: "GOIAB-Ultimate.webp",
    trackedoutcome: "Tracked Outcome.webp", downtime: "Downtime-OS.webp", creditroll: "Session End-OS.webp"
  },
  legend: {
    quickoutcome: "Quick Way.webp", detailedoutcome: "Detailed Way - Attack.webp", reaction: "Reaction.webp",
    sacrificepainful: "sacrifice-painful.webp", sacrificescarring: "sacrifice-scarring.webp",
    sacrificegrave: "sacrifice-grave.webp"
  }
};

/**
 * Return the image src for an image-mode move button.
 * Returns null when no image is known so the caller can show text instead.
 *
 * @param {Item} move
 * @returns {string|null}
 */
export function getMoveImageSrc(move) {
  const name = move.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const systems = String(move.system?.system_compatiblity ?? "").split(",").map(x => x.trim());
  for (const sys of systems) {
    const table = MOVE_IMAGES[sys];
    if (!table) continue;
    const key = Object.keys(table).find(k => name.startsWith(k));
    if (key) return `modules/mist-hud/ui/${table[key]}`;
  }
  return null;
}
