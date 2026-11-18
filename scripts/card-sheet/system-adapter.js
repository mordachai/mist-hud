// system-adapter.js — the card sheet's ONLY door into city-of-mist internals.
//
// Everything the card sheet needs from the system that is not a document
// method (CityRoll, CityDialogs, CityHelpers, SelectedTagsAndStatus, the
// system character sheet) goes through this file. When the system renames or
// moves something, this is the one place to fix (plan § 9).
//
// The files are imported dynamically, from the same URL the system serves
// them from, so we get the system's own class instances; a static import of a
// missing file would stop the whole module from loading. A failure is
// reported once, the card sheet itself keeps working (the move bar does not).

const SYSTEM_FILES = {
  CityRoll:              "city-roll.js",
  CityHelpers:           "city-helpers.js",
  CityDialogs:           "city-dialogs.js",
  SelectedTagsAndStatus: "selected-tags.js",
  CityCharacterSheet:    "city-character-sheet.js",
};

const api = {};
const failures = [];

const ready = Promise.all(Object.entries(SYSTEM_FILES).map(async ([name, file]) => {
  try {
    const mod = await import(foundry.utils.getRoute(`systems/city-of-mist/module/${file}`));
    if (!mod[name]) throw new Error(`${file} has no export named ${name}`);
    api[name] = mod[name];
  } catch (e) {
    console.error(`Mist HUD | Card sheet: failed to load system file ${file}:`, e);
    failures.push(file);
  }
}));

/** The loaded system classes, once they are all in. */
async function systemApi() {
  await ready;
  if (failures.length) {
    ui.notifications.error(game.i18n.format("MistHUD.notify.systemLoadFailed", { files: failures.join(", ") }));
    return null;
  }
  return api;
}

// ── Moves ────────────────────────────────────────────────────────────────────

/** The system's move list for the active game (CityHelpers.getMoves()). */
export async function getMoves() {
  const sys = await systemApi();
  return sys?.CityHelpers.getMoves() ?? [];
}

/**
 * Roll a move exactly as the system character sheet does
 * (CityCharacterSheet._executeMove, system 4.5.3):
 *   1. Stop Holding Back: SHBDialog (City of Mist) / BlazeDialog (Otherscape, Legend)
 *   2. CityRoll.execMove with the system's selection → the system roll dialog
 *   3. clear the system's selection
 *   4. the move's effect_classes (MONOLOGUE, SESSION_END, FLASHBACK, DOWNTIME)
 *
 * @param {Actor}  actor
 * @param {string} moveId
 * @param {string} activeSystem  getActiveSystem()
 * @returns {Promise<boolean>} true when the roll went through
 */
export async function rollMove(actor, moveId, activeSystem) {
  const sys = await systemApi();
  if (!sys) return false;
  const { CityHelpers, CityDialogs, CityRoll, SelectedTagsAndStatus } = sys;

  const move = CityHelpers.getMoves().find(m => m.id === moveId);
  if (!move) throw new Error(`Mist HUD | Card sheet: move ${moveId} not found`);

  let options = {};
  if (move.system.subtype === "SHB") {
    if (activeSystem === "city-of-mist") {
      const newtype = await CityDialogs.SHBDialog(actor);
      if (!newtype) return false;
      options = { newtype };
    } else {
      const theme = await CityDialogs.BlazeDialog(actor);
      if (!theme) return false;
      options = { newtype: theme.getThemeType(), BlazeThemeId: theme.id };
    }
  }

  const selected = SelectedTagsAndStatus.getPlayerActivatedTagsAndStatus();
  const roll = await CityRoll.execMove(moveId, actor, selected, options);
  if (roll == null) return false;

  SelectedTagsAndStatus.clearAllActivatedItems();
  await runMoveEffects(actor, move);
  return true;
}

/**
 * The move effects live as methods on the system character sheet
 * (monologue, sessionEnd, flashback, downtime). They only use `this.actor`
 * and each other, no private fields and no rendered sheet, so they are run
 * on a bare object built on that class's prototype, with `actor` set: the
 * system's own code runs, nothing is rendered and nothing is registered on
 * the actor's apps.
 */
async function runMoveEffects(actor, move) {
  const { CityCharacterSheet } = api;
  const host = Object.create(CityCharacterSheet.prototype, {
    actor: { value: actor, enumerable: true },
  });
  const methods = { DOWNTIME: "downtime", MONOLOGUE: "monologue", SESSION_END: "sessionEnd", FLASHBACK: "flashback" };
  for (const effect of move.effect_classes ?? []) {
    const method = methods[effect];
    if (method && typeof host[method] === "function") await host[method]();
  }
}

// ── Change log ───────────────────────────────────────────────────────────────

/**
 * Add an entry to the system's change log (the GM's modification log), as
 * the system sheet's handlers do after their writes.
 * @param {Actor}  actor
 * @param {string} message  already localized
 * @param {Item}   [object] the item the change is about
 */
export async function logModification(actor, message, object = null) {
  const sys = await systemApi();
  if (!sys) return;
  try {
    await sys.CityHelpers.modificationLog(actor, message, object);
  } catch (e) {
    console.warn("Mist HUD | Card sheet: change log entry failed:", e);
  }
}

// ── Selection ────────────────────────────────────────────────────────────────

/** The system's current tag/status selection (this client only). */
export function getSystemSelection() {
  return globalThis.SelectedTagsAndStatus?.getPlayerActivatedTagsAndStatus?.() ?? [];
}

// ── "Open system sheet" fallback (plan § 6.2, route 3) ───────────────────────

const systemSheets = new WeakMap();
const NO_FLIPS = Object.freeze([false, false, false, false, false, false, false, false]);

/**
 * The system's templates read `actor.sheet.flipped[n]` (setFlipped helper),
 * and `actor.sheet` is the card sheet when it is the actor's sheet. Give them
 * the flip state of the system sheet we opened, so its own flip buttons keep
 * working across re-renders.
 */
export function systemSheetFlips(actor) {
  return systemSheets.get(actor)?.flipped ?? NO_FLIPS;
}

/**
 * Open the system's own character sheet for this actor, whatever sheet is
 * set as the actor's default. One instance per actor, reused.
 */
export async function openSystemSheet(actor) {
  const sys = await systemApi();
  if (!sys) return;
  let sheet = systemSheets.get(actor);
  if (!sheet) {
    sheet = new sys.CityCharacterSheet(actor);
    systemSheets.set(actor, sheet);
  }
  sheet.render(true);
  sheet.bringToTop?.();
}
