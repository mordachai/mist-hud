// edit-actions.js — the card sheet's edit actions (plan § 6.2, phase 3).
//
// One handler per system sheet handler, doing what the system does: the same
// checks, the same document methods, the same dialogs (through
// system-adapter.js) and the same change-log entries. The log messages are
// the system's own English literals, so the GM's log reads the same whichever
// sheet made the change.
//
// Every handler is an ApplicationV2 action (`this` is the MistCardSheet).
// A theme card carries data-theme-id and data-owner-id: a crew or extra
// theme belongs to another actor (the crew, a danger), so every write goes to
// that owner and needs ownership of it.

import {
  confirmBox, singleChoiceBox, themeBookSelector, tagOrImprovementChoice,
  itemEditDialog, improvementDialog, autoAwardImpForWeakness, buildUpImprovementChoices,
  sendImprovementToChat, themeDeleteChoice, logModification,
} from "./system-adapter.js";

const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** One dialog flow at a time per sheet: a second click while a dialog is open does nothing. */
const busy = new WeakSet();

export async function once(sheet, fn) {
  if (busy.has(sheet)) return;
  busy.add(sheet);
  try {
    return await fn();
  } finally {
    busy.delete(sheet);
  }
}

/** The card a control sits in, its owner (the sheet's actor, a crew, a danger) and theme. */
function cardOf(sheet, target) {
  const card = target.closest(".mh-cs-card");
  const ownerId = card?.dataset.ownerId;
  const owner = !ownerId || ownerId === sheet.actor.id ? sheet.actor : game.actors.get(ownerId);
  const themeId = card?.dataset.themeId;
  const theme = themeId ? owner?.items.get(themeId) : null;
  return { card, owner, theme };
}

/** The owner, if this user may change it; warns otherwise. */
function ownedOwner(sheet, target) {
  const ctx = cardOf(sheet, target);
  if (!ctx.owner?.isOwner) {
    ui.notifications.warn(L("MistHUD.cardSheet.notOwner"));
    return null;
  }
  return ctx;
}

const tagOf = (owner, target) => owner.items.get(target.closest("[data-tag-id]")?.dataset.tagId);
const improvementOf = (owner, target) =>
  owner.items.get(target.closest("[data-improvement-id]")?.dataset.improvementId);

// ── Lock ─────────────────────────────────────────────────────────────────────

/** Header control: play mode (locked) ⇄ edit mode (unlocked); the system's own toggle. */
export async function toggleLock() {
  if (!this.actor.isOwner) return;
  await this.actor.toggleLockState();
}

// ── Tracks: attention, crack/fade, milestone ─────────────────────────────────

const TRACK_ADD    = { attention: "addAttention",    crack: "addFade",    milestone: "addMilestone" };
const TRACK_REMOVE = { attention: "removeAttention", crack: "removeFade", milestone: "removeMilestone" };

/** + on a track (CityActorSheet._addAttentionOrFade). The actor methods log themselves. */
export async function addTrack(event, target) {
  const ctx = ownedOwner(this, target);
  const method = TRACK_ADD[target.dataset.track];
  if (!ctx?.theme || !method) return;
  await once(this, () => ctx.owner[method](ctx.theme.id));
}

/** − on a track (CityActorSheet._removeAttentionOrFade). */
export async function removeTrack(event, target) {
  const ctx = ownedOwner(this, target);
  const method = TRACK_REMOVE[target.dataset.track];
  if (!ctx?.theme || !method) return;
  await once(this, () => ctx.owner[method](ctx.theme.id));
}

/** Spend an upgrade to clear crack/fade (CityActorSheet._resetFade). */
export async function resetFade(event, target) {
  const ctx = ownedOwner(this, target);
  if (!ctx?.theme) return;
  await once(this, async () => {
    const ok = await confirmBox(L("MistHUD.cardSheet.resetFade"),
      L("MistHUD.cardSheet.confirm.resetFade", { name: ctx.theme.name }));
    if (!ok) return;
    await ctx.owner.resetFade(ctx.theme.id);
    await logModification(ctx.owner, "Spent Theme Upgrade to Reset Fade", ctx.theme);
  });
}

// ── Theme fields ─────────────────────────────────────────────────────────────

/** Theme type: cycle through the game's theme types (only themebooks without a fixed type). */
export async function toggleThemeType(event, target) {
  const ctx = ownedOwner(this, target);
  if (!ctx?.theme) return;
  await once(this, () => ctx.theme.toggleThemeType());
}

/**
 * Inline text fields of a theme (change/blur): its name
 * (CityActorSheet._themebookNameInput) and its identity / mystery
 * (_themeChangeInput → theme.setField).
 */
export async function changeThemeField(sheet, input) {
  const ctx = cardOf(sheet, input);
  if (!ctx.theme || !ctx.owner?.isOwner) return;
  const value = input.value;
  if (input.dataset.edit === "themeName") {
    if (value === ctx.theme.name) return;
    await ctx.theme.update({ name: value });
  } else if (input.dataset.edit === "themeField") {
    const field = input.dataset.field;
    if (!field || value === (ctx.theme.system[field] ?? "")) return;
    await ctx.theme.setField(field, value);
  }
}

/** Edit the theme's themebook (CitySheet._editThemeBook; a kit's own themebook too). */
export async function editThemebook(event, target) {
  const ctx = ownedOwner(this, target);
  const tbOrKit = ctx?.theme?.getThemebookOrTK?.();
  if (!tbOrKit) return;
  const tb = tbOrKit.system.type === "themekit" ? tbOrKit.getThemebookOrTK() : tbOrKit;
  if (tb) await itemEditDialog(tb);
}

/** Edit the theme kit (CitySheet._editThemeKit): on a player character, the MC only. */
export async function editThemekit(event, target) {
  const ctx = ownedOwner(this, target);
  const tk = ctx?.theme?.getThemebookOrTK?.();
  if (!tk?.isThemeKit?.()) return;
  if (this.actor.isPC?.() && !game.user.isGM) {
    ui.notifications.warn(L("CityOfMist.error.MCEditOnly"));
    return;
  }
  await itemEditDialog(tk);
}

// ── Themes ───────────────────────────────────────────────────────────────────

/** An empty slot of layer 1: pick a themebook, create the theme (CitySheet._addThemeBook). */
export async function addTheme() {
  if (!this.actor.isOwner) return;
  await once(this, async () => {
    const themebook = await themeBookSelector(this.actor);
    if (!themebook) return;
    await this.actor.createNewTheme(`Unnamed ${themebook.displayedName ?? ""} Theme`, themebook);
  });
}

/**
 * Delete a theme (CityActorSheet._deleteTheme). A new character just
 * confirms; afterwards the system's delete / replace / cancel choice, where
 * "replace" awards build-up points (actor.deleteTheme logs that itself).
 */
export async function deleteTheme(event, target) {
  const ctx = ownedOwner(this, target);
  if (!ctx?.theme) return;
  const { owner, theme } = ctx;
  await once(this, async () => {
    if (owner.isNewCharacter?.()) {
      const ok = await confirmBox(L("CityOfMist.dialog.actorSheet.deleteTheme.title"),
        L("MistHUD.cardSheet.confirm.deleteTheme", { name: theme.name }));
      if (!ok) return;
      await owner.deleteTheme(theme.id, false);
      await logModification(owner, "Deleted", theme);
      return;
    }
    const choice = await themeDeleteChoice(theme.name);
    if (choice === "replace") {
      await owner.deleteTheme(theme.id, true);
    } else if (choice === "delete") {
      const ok = await confirmBox(L("CityOfMist.dialog.actorSheet.deleteTheme.title"),
        L("CityOfMist.dialog.actorSheet.deleteTheme.body"));
      if (ok) await owner.deleteTheme(theme.id, false);
    }
  });
}

/** Open the crew's or the danger's own sheet (CityCharacterSheet.openOwnerSheet). */
export async function openOwnerSheet(event, target) {
  const { owner } = cardOf(this, target);
  if (!owner || owner.id === this.actor.id) return;
  await owner.sheet?.render(true);
}

// ── Tags ─────────────────────────────────────────────────────────────────────

/**
 * Answer one of the themebook's tag questions (CityActorSheet._createTagOrImprovement):
 * a power tag spends an upgrade; a second weakness tag may award an
 * improvement (the system setting, or the system's question). owner.addTag
 * opens the tag's edit dialog and logs it.
 */
export async function addTag(event, target) {
  const ctx = ownedOwner(this, target);
  const subtype = target.dataset.subtype;
  if (!ctx?.theme || (subtype !== "power" && subtype !== "weakness")) return;
  const { owner, theme } = ctx;
  await once(this, async () => {
    const choice = await tagOrImprovementChoice(owner, theme, "tag", subtype);
    if (choice == null) return;
    let awardImprovement = false;
    if (subtype === "weakness" && theme.weaknessTags.length >= 1) {
      awardImprovement = (await autoAwardImpForWeakness()) || await confirmBox(
        L("CityOfMist.dialog.addTag.confirmExtraImprovementOnWeakness.title"),
        L("CityOfMist.dialog.addTag.confirmExtraImprovementOnWeakness.body"),
        { onClose: "reject" });
      if (awardImprovement == null) return;   // closed: the system aborts too
    }
    await owner.addTag(theme.id, subtype, choice, { awardImprovement });
  });
}

/** A bonus power tag, outside the themebook questions (CityActorSheet._createBonusTag). */
export async function addBonusTag(event, target) {
  const ctx = ownedOwner(this, target);
  if (!ctx?.theme) return;
  await once(this, () => ctx.owner.addTag(ctx.theme.id, "bonus", null, { awardImprovement: false }));
}

/** Edit a tag (HTMLHandlers.tagEdit): not a theme kit's tags. */
export async function editTag(event, target) {
  const ctx = cardOf(this, target);
  const tag = ctx.owner && tagOf(ctx.owner, target);
  await editTagItem(tag);
}

/** HTMLHandlers.tagEdit on one tag (theme cards and the deck's story tags). */
export async function editTagItem(tag) {
  if (!tag) return;
  if (!tag.isOwner) {
    ui.notifications.error(L("CityOfMist.error.dontOwnTag"));
    return;
  }
  if (tag.getThemebookOrTK?.()?.isThemeKit?.()) {
    ui.notifications.notify(L("CityOfMist.error.themeKitTagEdit"));
    return;
  }
  await itemEditDialog(tag);
}

/**
 * Delete a tag (HTMLHandlers.deleteTag; right-click skips the confirmation,
 * as on the system sheet). A tag with subtags stays; deleting a second
 * weakness tag may take back its improvement. actor.deleteTag logs it.
 */
export async function deleteTag(event, target) {
  const ctx = cardOf(this, target);
  const tag = ctx.owner && tagOf(ctx.owner, target);
  await deleteTagItem(this, ctx.owner, tag, { skipConfirm: event.button === 2 });
}

/** HTMLHandlers.deleteTag on one tag (theme cards and the deck's story tags). */
export async function deleteTagItem(sheet, owner, tag, { skipConfirm = false } = {}) {
  const ctx = { owner };
  if (!tag) return;
  if (!tag.isOwner) {
    ui.notifications.error(L("CityOfMist.error.dontOwnTag"));
    return;
  }
  if ((tag.subtags?.length ?? 0) > 0) {
    ui.notifications.warn(L("MistHUD.cardSheet.deleteSubtagsFirst"));
    return;
  }
  await once(sheet, async () => {
    if (!skipConfirm && !await confirmBox(L("MistHUD.cardSheet.deleteTag"),
      L("MistHUD.cardSheet.confirm.deleteTag", { name: tag.name }))) return;
    let removeImprovement = false;
    if (tag.isWeaknessTag?.() && (tag.theme?.weaknessTags.length ?? 0) >= 2) {
      removeImprovement = (await autoAwardImpForWeakness()) || await confirmBox(
        L("CityOfMist.dialog.deleteTag.confirmExtraImprovementOnWeakness.title"),
        L("CityOfMist.dialog.deleteTag.confirmExtraImprovementOnWeakness.body"),
        { onClose: "reject" });
      if (removeImprovement == null) return;
    }
    await ctx.owner.deleteTag(tag.id, { removeImprovement });
  });
}

/** Burn an unburned tag, or unburn a burned one (HTMLHandlers.burnTag / unburnTag). */
export async function burnTag(event, target) {
  const ctx = ownedOwner(this, target);
  const tag = ctx && tagOf(ctx.owner, target);
  await burnTagItem(this, ctx?.owner, tag);
}

/** Burn / unburn one tag after the system's confirmation (theme cards and the deck's story tags). */
export async function burnTagItem(sheet, owner, tag) {
  if (!tag || !owner?.isOwner) return;
  const ctx = { owner };
  await once(sheet, async () => {
    if (Number(tag.system.burn_state) === 0) {
      if (!tag.isBurnable) return;
      if (!await confirmBox(L("MistHUD.cardSheet.burnTitle", { name: tag.name }),
        L("MistHUD.cardSheet.confirm.burn", { name: tag.name }))) return;
      await ctx.owner.burnTag(tag.id);
      await logModification(ctx.owner, "Burned", tag);
    } else {
      if (!await confirmBox(L("MistHUD.cardSheet.unburnTitle"),
        L("MistHUD.cardSheet.confirm.unburn", { name: tag.name }))) return;
      await ctx.owner.burnTag(tag.id, 0);
      await logModification(ctx.owner, "Unburned", tag);
    }
  });
}

// ── Improvements ─────────────────────────────────────────────────────────────

/** Pick one of the themebook's improvements (CityActorSheet._createTagOrImprovement). */
export async function addImprovement(event, target) {
  const ctx = ownedOwner(this, target);
  if (!ctx?.theme) return;
  const { owner, theme } = ctx;
  await once(this, async () => {
    const choice = await tagOrImprovementChoice(owner, theme, "improvement");
    if (choice == null) return;
    const created = await owner.addImprovement(theme.id, Number(choice));
    const imp = created && owner.items.get(created.id ?? created[0]?.id);
    if (!imp) return;
    await improvementDialog(imp);
    await logModification(owner, "Created", imp);
  });
}

/** Edit an improvement (CityActorSheet._improvementEdit): reloaded from the compendium if never chosen. */
export async function editImprovement(event, target) {
  const ctx = ownedOwner(this, target);
  const imp = ctx && improvementOf(ctx.owner, target);
  if (!imp) return;
  await once(this, async () => {
    if (!imp.system.chosen) await imp.reloadImprovementFromCompendium();
    await improvementDialog(imp);
  });
}

/** Delete an improvement after a confirmation (CityActorSheet._deleteImprovement); its upgrade comes back. */
export async function deleteImprovement(event, target) {
  const ctx = ownedOwner(this, target);
  const imp = ctx && improvementOf(ctx.owner, target);
  if (!imp) return;
  await once(this, async () => {
    if (!await confirmBox(L("CityOfMist.command.deleteImprovement"),
      L("MistHUD.cardSheet.confirm.deleteImprovement", { name: imp.name }))) return;
    await ctx.owner.deleteImprovement(imp.id);
    await logModification(ctx.owner, "Deleted", imp);
  });
}

/** Post an improvement to chat and spend a use (CityActorSheet._sendImprovementToChat). */
export async function sendImprovement(event, target) {
  const ctx = ownedOwner(this, target);
  const imp = ctx && improvementOf(ctx.owner, target);
  if (!imp) return;
  await once(this, () => sendImprovementToChat(this.actor, imp));
}

// ── Build-up (character card) ────────────────────────────────────────────────

/** The game's build-up improvements, minus those the character has (CityCharacterSheet.chooseBuildUpImprovement). */
async function chooseBuildUpImprovement(actor, { filterOwned }) {
  const owned = actor.getBuildUpImprovements?.() ?? [];
  const list = (await buildUpImprovementChoices())
    .filter(x => !filterOwned || !owned.find(y => y.name === x.name))
    .map(x => ({
      id:          x.id,
      data:        [x.localizedName ?? x.name],
      description: x.description ?? x.system?.description ?? "",
    }));
  return singleChoiceBox(list, L("MistHUD.cardSheet.chooseBuildUpImprovement"));
}

/**
 * + build-up point (CityCharacterSheet._buildUpIncrement), then pick an
 * improvement for every unspent build-up improvement.
 */
export async function incBuildUp() {
  const actor = this.actor;
  if (!actor.isOwner || actor.type !== "character") return;
  await once(this, async () => {
    if (await confirmBox(L("MistHUD.cardSheet.addBuildUp"),
      L("MistHUD.cardSheet.confirm.addBuildUp", { name: actor.name }))) {
      await actor.incBuildUp();
      await logModification(actor, "Build Up Point Added", null, `Current ${actor.getBuildUp()}`);
    }
    while ((actor.system.unspentBU ?? 0) > 0) {
      const impId = await chooseBuildUpImprovement(actor, { filterOwned: true });
      if (impId == null) break;
      await actor.addBuildUpImprovement(impId);
    }
  });
}

/** − build-up point (CityCharacterSheet._buildUpDecrement). */
export async function decBuildUp() {
  const actor = this.actor;
  if (!actor.isOwner || actor.type !== "character") return;
  await once(this, async () => {
    if (!await confirmBox(L("MistHUD.cardSheet.removeBuildUp"),
      L("MistHUD.cardSheet.confirm.removeBuildUp", { name: actor.name }))) return;
    await actor.decBuildUp();
    await logModification(actor, `Build Up Point Removed (Current ${actor.getBuildUp()}`);
  });
}

/** Spend an unspent build-up improvement (CityCharacterSheet._addBUImprovement). */
export async function addBUImprovement() {
  const actor = this.actor;
  if (!actor.isOwner) return;
  await once(this, async () => {
    const choice = await chooseBuildUpImprovement(actor, { filterOwned: false });
    if (!choice) return;
    const imp = await actor.addBuildUpImprovement(choice);
    await logModification(actor, "Added", Array.isArray(imp) ? imp[0] : imp);
  });
}

// ── Character fields ─────────────────────────────────────────────────────────

/** The character card's fields the sheet may write (no system method exists for them). */
const ACTOR_FIELDS = new Set(["name", "system.mythos", "system.logos", "system.short_description", "system.biography"]);

/** Inline text fields of the character card (change/blur), and the biography editor (save). */
export async function changeActorField(sheet, input) {
  const actor = sheet.actor;
  const field = input.dataset.field ?? input.name;
  if (!actor.isOwner || !ACTOR_FIELDS.has(field)) return;
  const value = input.value ?? "";
  if (value === (foundry.utils.getProperty(actor, field) ?? "")) return;
  if (field === "name" && !value.trim()) {
    input.value = actor.name;
    return;
  }
  await actor.update({ [field]: value });
}

/** Every action above, for MistCardSheet.DEFAULT_OPTIONS.actions. */
export const EDIT_ACTIONS = {
  toggleLock,
  addTrack, removeTrack, resetFade,
  toggleThemeType, editThemebook, editThemekit,
  addTheme, deleteTheme, openOwnerSheet,
  addTag, addBonusTag, editTag,
  // Right-click deletes without the confirmation, like the system sheet.
  deleteTag: { handler: deleteTag, buttons: [0, 2] },
  burnTag,
  addImprovement, editImprovement, deleteImprovement, sendImprovement,
  incBuildUp, decBuildUp, addBUImprovement,
};
