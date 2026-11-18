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

import { getSelectionDirection, setSelectionDirection } from "../hud-state.js";

const SYSTEM_FILES = {
  CityRoll:              "city-roll.js",
  CityHelpers:           "city-helpers.js",
  CityDialogs:           "city-dialogs.js",
  SelectedTagsAndStatus: "selected-tags.js",
  CityCharacterSheet:    "city-character-sheet.js",
  HTMLTools:             "tools/HTMLTools.js",
  CitySettings:          "settings.js",
  DragAndDrop:           "dragAndDrop.js",
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

// ── Dialogs (edit mode, phase 3) ─────────────────────────────────────────────

/**
 * The system's yes/no box (HTMLTools.confirmBox).
 * @param {string} title
 * @param {string} text
 * @param {object} [options]
 * @param {"false"|"true"|"reject"} [options.onClose]  what closing the box means;
 *   "reject" (the system's choice for its weakness-improvement questions)
 *   makes this return null, so the caller aborts the whole action.
 * @returns {Promise<boolean|null>}
 */
export async function confirmBox(title, text, { onClose } = {}) {
  const sys = await systemApi();
  if (!sys) return false;
  try {
    return await sys.HTMLTools.confirmBox(title, text, onClose ? { onClose } : {});
  } catch {
    return null;
  }
}

/**
 * The system's single-choice list (HTMLTools.singleChoiceBox).
 * @param {{id: string, data: string[], description?: string}[]} list
 * @param {string} header
 * @returns {Promise<string|null|undefined>} the chosen id
 */
export async function singleChoiceBox(list, header) {
  const sys = await systemApi();
  if (!sys) return null;
  return sys.HTMLTools.singleChoiceBox(list, header);
}

/** Pick a themebook or theme kit for a new theme (CityDialogs.themeBookSelector). */
export async function themeBookSelector(actor) {
  const sys = await systemApi();
  if (!sys) return null;
  return sys.CityDialogs.themeBookSelector(actor);
}

/**
 * The themebook's unanswered tag questions, or its unchosen improvements
 * (CityDialogs.improvementOrTagChoiceList).
 * @param {Actor}  owner     the theme's actor
 * @param {Item}   theme
 * @param {"tag"|"improvement"} itemType
 * @param {"power"|"weakness"} [subtype]  tags only
 * @returns {Promise<string|null>} the question letter or improvement number
 */
export async function tagOrImprovementChoice(owner, theme, itemType, subtype) {
  const sys = await systemApi();
  if (!sys) return null;
  return sys.CityDialogs.improvementOrTagChoiceList(owner, theme, itemType, subtype);
}

/** The system's item edit dialog (CityDialogs.itemEditDialog): tags, themebooks, kits. */
export async function itemEditDialog(item) {
  const sys = await systemApi();
  if (!sys) return null;
  return sys.CityDialogs.itemEditDialog(item);
}

/** The system's item dialog for improvements (CityHelpers.itemDialog). */
export async function itemDialog(item) {
  const sys = await systemApi();
  if (!sys) return null;
  return sys.CityHelpers.itemDialog(item);
}

/** The system setting "award an improvement for a second weakness tag" (no question asked). */
export async function autoAwardImpForWeakness() {
  const sys = await systemApi();
  return !!sys?.CitySettings.autoAwardImpForWeakness();
}

/** Every build-up improvement the active game offers (CityHelpers.getBuildUpImprovements). */
export async function buildUpImprovementChoices() {
  const sys = await systemApi();
  return sys?.CityHelpers.getBuildUpImprovements() ?? [];
}

/**
 * Where a dropped themebook or theme kit goes, as the system sheet asks
 * (CitySheet.getCreationLocation): a main theme or an extra. Only player
 * characters are asked; anyone else gets a main theme.
 * @returns {Promise<"main"|"extra"|undefined>}
 */
export async function creationLocation(actor) {
  if (!actor.isPC?.()) return "main";
  const choices = [
    { id: "main",  data: [game.i18n.localize("CityOfMist.terms.mainTheme")] },
    { id: "extra", data: [game.i18n.localize("CityOfMist.terms.extra")] },
  ];
  const choice = await singleChoiceBox(choices, game.i18n.localize("MistHUD.cardSheet.chooseThemeLocation"));
  return choice === "main" || choice === "extra" ? choice : undefined;
}

/**
 * Post an improvement to chat with its "Use" button, as the system sheet's
 * improvement name does (CityActorSheet._sendImprovementToChat), and spend a
 * use when the player sends it.
 * @param {Actor} speaker  the sheet's character
 * @param {Item}  imp
 */
export async function sendImprovementToChat(speaker, imp) {
  const sys = await systemApi();
  if (!sys) return false;
  const html = await foundry.applications.handlebars.renderTemplate(
    "systems/city-of-mist/templates/improvement-chat-description.html",
    { improvement: imp, data: imp.system });
  const uses = imp.getImprovementUses();
  const usesStr = uses < 9999 ? `(uses left ${uses})` : "";
  const options = {
    label:   `${game.i18n.localize("CityOfMist.command.use")} ${usesStr}`,
    disable: uses <= 0,
    speaker: { actor: speaker, alias: speaker.getDisplayedName?.() ?? speaker.name },
  };
  const title = String(imp.displayedName ?? imp.name);
  if (await sys.CityHelpers.sendToChatBox(title, html, options)) {
    if (uses < 9999) await imp.decrementImprovementUses();
    return true;
  }
  return false;
}

/** A status dropped on the sheet: merged into a status of the same name, as the system does. */
export async function statusDrop(actor, name, options) {
  const sys = await systemApi();
  if (!sys) return;
  return sys.DragAndDrop.statusDrop(actor, name, options);
}

/**
 * The active game's own terms for the build-up track, localized
 * (SystemModule.active.gameTerms(): City of Mist "Moment of Evolution",
 * "Build Up Points"; Otherscape "Evolution Points"…).
 * @returns {{evolution: string, buildUpPoints: string}}
 */
export function gameTerms() {
  let terms = {};
  try { terms = globalThis.SystemModule?.active?.gameTerms?.() ?? {}; } catch { terms = {}; }
  const loc = key => (key ? game.i18n.localize(key) : "");
  return {
    evolution:     loc(terms.evolution) || game.i18n.localize("MistHUD.cardSheet.buildUpImprovements"),
    buildUpPoints: loc(terms.buildUpPoints) || game.i18n.localize("CityOfMist.terms.buildup"),
  };
}

/**
 * The system's delete / replace / cancel choice for a theme
 * (CitySheet.themeDeleteChoicePrompt, a V1 Dialog), rebuilt as a DialogV2
 * with the system's own labels. "replace" awards build-up points.
 * @returns {Promise<"delete"|"replace"|null>}
 */
export async function themeDeleteChoice(themeName) {
  const name = foundry.utils.escapeHTML?.(themeName) ?? Handlebars.escapeExpression(themeName);
  const loc = key => game.i18n.localize(`CityOfMist.dialog.actorSheet.deleteTheme.option.${key}`);
  const choice = await foundry.applications.api.DialogV2.wait({
    window:  { title: game.i18n.format("MistHUD.cardSheet.deleteThemeTitle", { name: themeName }) },
    classes: ["mh-cs-dialog"],
    content: `<p>${game.i18n.format("MistHUD.cardSheet.deleteThemeChoice", { name })}</p>`,
    buttons: [
      { action: "delete",  label: loc(0), icon: "fa-solid fa-trash" },
      { action: "replace", label: loc(1), icon: "fa-solid fa-arrows-rotate", default: true },
      { action: "cancel",  label: loc(2), icon: "fa-solid fa-xmark" },
    ],
    rejectClose: false,
  });
  return choice === "delete" || choice === "replace" ? choice : null;
}

// ── Selection ────────────────────────────────────────────────────────────────

/** The system's current tag/status selection (this client only). */
export function getSystemSelection() {
  return globalThis.SelectedTagsAndStatus?.getPlayerActivatedTagsAndStatus?.() ?? [];
}

/** The system's selection class: the loaded module, or the global it also sets. */
const selectionApi = () => api.SelectedTagsAndStatus ?? globalThis.SelectedTagsAndStatus ?? null;

/**
 * Whether the system lets this tag be selected at all: the system sheet binds
 * selection on `.name:not(.burned-tag)`, and `burned-tag` is any burn_state
 * above 0 (to burn or burned).
 */
export function isTagSelectable(tag) {
  return !!tag && !(Number(tag.system?.burn_state) > 0);
}

/**
 * Click on a tag name, as the system sheet's SelectedTagsAndStatus
 * ._selectTagHandler (system 4.5.3): the direction is the tag's default one
 * (power and the character's story tags +1, weakness −1), reversed on a right
 * click; the same direction again clears it, the other one switches it.
 * The system's checks run first (loadout not loaded, linked tags), so a
 * refused click leaves the selection as it was; an open roll or tag review
 * dialog may take the tag instead (preTagOrStatusSelected), as on the system
 * sheet. Plays the system's tag on / off sound.
 * @param {Item}    tag
 * @param {Actor}   owner     the tag's actor (the character, a crew, a danger)
 * @param {boolean} invert    right click
 * @returns {number|null} the tag's direction now (1, -1, 0), or null if refused
 */
export function toggleTagSelection(tag, owner, invert = false) {
  const sts = selectionApi();
  if (!sts || !isTagSelectable(tag)) return null;
  let direction = sts.getDefaultTagDirection(tag, owner) || -1;
  if (invert) direction *= -1;
  const target = getSelectionDirection(tag) === direction ? 0 : direction;
  if (target !== 0 && !sts.checkValidityForSelect(tag, target)) return null;
  if (!setSelectionDirection(tag, target)) return null;
  playTagSound(target !== 0);
  return target;
}

/** The system's tag on / off sound; not awaited (it waits for the browser's audio unlock). */
function playTagSound(on) {
  const helpers = api.CityHelpers;
  try { void (on ? helpers?.playTagOn?.() : helpers?.playTagOff?.())?.catch?.(() => {}); }
  catch { /* no sound */ }
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
