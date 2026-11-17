// move-layout.js — Slot positions and layout config for move buttons
// Move data (name, effects, localization) comes from CityDB.movesList.
// This file only defines where buttons appear in the HUD footer.

/** Effect classes of narrative / session-flow moves, in display order. */
const SESSION_FX = ["MONOLOGUE", "FLASHBACK", "DOWNTIME", "SESSION_END"];

function _sessionRank(move) {
  const fx = String(move.system?.effect_class ?? "").split(/\s+/);
  const i = SESSION_FX.findIndex(k => fx.includes(k));
  return i;
}

/**
 * Organise CityDB.movesList into the HUD's pages (only non-empty ones):
 *   core    → the basic moves
 *   session → cinematic / session-flow moves (Opening Monologue, Flashback,
 *             Downtime, Session End / Credit Roll)
 *   special → every other Advanced move (theme-specific and custom moves)
 *   shb     → Stop Holding Back / Go Out in a Blaze / Sacrifice
 *
 * @param {Item[]} movesList  CityDB.movesList (already filtered to active system)
 * @param {(move: Item) => boolean} [canUse]  filter for Advanced moves
 * @returns {{ key: string, moves: Item[] }[]}
 */
export function organizeMoves(movesList, canUse = () => true) {
  const core     = movesList.filter(m => m.system.category === "Core");
  const advanced = movesList.filter(m => m.system.category === "Advanced" && canUse(m));
  const shb      = movesList.filter(m => m.system.category === "SHB");
  const session  = advanced.filter(m => _sessionRank(m) >= 0)
                           .sort((a, b) => _sessionRank(a) - _sessionRank(b));
  const special  = advanced.filter(m => _sessionRank(m) < 0);
  return [
    { key: "core", moves: core },
    { key: "session", moves: session },
    { key: "special", moves: special },
    { key: "shb", moves: shb },
  ].filter(g => g.moves.length);
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
    downtime: "Downtime.webp", sessionend: "Session End.webp",
    escapefrommemory: "Escape From Memory.webp", finallysomeanswers: "Finally Some Answers.webp",
    foreshadowing: "Foreshadow.webp", lookbehind: "Look Behind The Mist.webp",
    // GK variant must precede the generic key: lookup is first startsWith match
    makeahardchoicegk: "Make a Hard Choice - Gatekeeper.webp", makeahardchoice: "Hardchoice.webp",
    performancereview: "Performance Review.webp"
  },
  otherscape: {
    mitigate: "Mitigate Consequences.webp", quickoutcome: "Quick Outcome.webp",
    gooutinablaze1: "GOIAB-Significant.webp", gooutinablaze2: "GOIAB-NoReturn.webp",
    gooutinablaze3: "GOIAB-Ultimate.webp",
    trackedoutcome: "Tracked Outcome.webp", downtime: "Downtime-OS.webp", creditroll: "Session End-OS.webp"
  },
  legend: {
    quickoutcome: "Quick Way.webp", detailedoutcome: "Detailed.webp", reaction: "Reaction.webp",
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
