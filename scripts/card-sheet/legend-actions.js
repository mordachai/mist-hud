// legend-actions.js — the Legend in the Mist parts of the card sheet (phase 6).
//
// The Hero card's Fellowship relationships and the backpack card.
//
// Relationships are the system's relationship tags (subtype "relationship",
// actor.createRelationshipTag); the companion is the module flag
// RELATIONSHIP_TARGET on the tag, as in the HUD (getters.getRelationshipTags).
//   - "+" in the heading (no companion) or on a companion's empty row makes
//     the tag; its name is typed in place, like a story tag made on the
//     character card (tags-deck.js changeDeckField: an empty name deletes it);
//   - edit mode: the companion is a pick list (changeRelationshipTarget), the
//     name a field, the trash the theme cards' deleteTag.
//
// The backpack is the system's loadout theme (actor.loadout):
//   - toggleBackpack: brings the card forward / tucks it back (no re-render);
//   - toggleLoadoutTag: carried or left at home (actor.toggleLoadoutTagActivation);
//   - addLoadoutTag / addLoadoutWeakness: the system's CityActorSheet
//     #createLoadoutTag / #createLoadoutWeakness (create, edit dialog, delete
//     on cancel);
//   - createBackpack: actor.createLoadoutTheme() when the actor has none.

import { MODULE_ID, FLAG_KEYS } from "../constants.js";
import { once } from "./edit-actions.js";
import { itemEditDialog } from "./system-adapter.js";

const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function ownedActor(sheet) {
  if (!sheet.actor?.isOwner) {
    ui.notifications.warn(L("MistHUD.cardSheet.notOwner"));
    return null;
  }
  return sheet.actor;
}

// ── Fellowship relationships ─────────────────────────────────────────────────

/** "+": a new relationship tag (for the row's companion, if any), named in place. */
async function addRelationship(event, target) {
  const actor = ownedActor(this);
  if (!actor) return;
  const targetId = target.dataset.targetId || null;
  await once(this, async () => {
    const created = await actor.createRelationshipTag(L("MistHUD.hud.newRelationship"));
    const tag = actor.items.get(Array.isArray(created) ? created[0]?.id : created?.id);
    if (!tag) return;
    if (targetId) await tag.setFlag(MODULE_ID, FLAG_KEYS.RELATIONSHIP_TARGET, targetId);
    this.deckNew = tag.id;
    this.deckNewOrigin = "character";
    await this.render({ parts: ["layer2"] });
    const input = this.element.querySelector(`.mh-cs-rel-row[data-item-id="${tag.id}"] .mh-cs-rel-input`);
    input?.focus();
  });
}

/** Edit mode: a relationship's companion picked in its list. */
export async function changeRelationshipTarget(sheet, select) {
  const actor = sheet.actor;
  if (!actor?.isOwner) return;
  const tag = actor.items.get(select.closest("[data-tag-id]")?.dataset.tagId);
  if (!tag) return;
  const id = select.value;
  if (id) await tag.setFlag(MODULE_ID, FLAG_KEYS.RELATIONSHIP_TARGET, id);
  else await tag.unsetFlag(MODULE_ID, FLAG_KEYS.RELATIONSHIP_TARGET);
}

// ── Backpack ─────────────────────────────────────────────────────────────────

/** Bring the backpack card forward, or tuck it back behind the front layer. */
export function toggleBackpack(sheet, open) {
  const el = sheet.element;
  const now = open ?? el.dataset.backpack !== "open";
  el.dataset.backpack = now ? "open" : "closed";
  el.querySelector(".mh-cs-backpack-card .mh-cs-band-top")?.setAttribute("aria-expanded", String(now));
}

function toggleBackpackAction() {
  toggleBackpack(this);
}

function loadoutTagAt(sheet, target) {
  const id = target.closest("[data-tag-id]")?.dataset.tagId;
  return id ? sheet.actor.items.get(id) : null;
}

async function toggleLoadoutTag(event, target) {
  const actor = ownedActor(this);
  const tag = actor && loadoutTagAt(this, target);
  if (!tag) return;
  await once(this, () => actor.toggleLoadoutTagActivation(tag.id));
}

/** A new tag made with the system's method, then its edit dialog; deleted if cancelled. */
async function createThenEdit(actor, created) {
  const tag = actor.items.get(Array.isArray(created) ? created[0]?.id : created?.id);
  if (!tag) return;
  const updated = await itemEditDialog(tag);
  if (!updated && actor.items.get(tag.id)) await actor.deleteTag(tag.id);
}

async function addLoadoutTag() {
  const actor = ownedActor(this);
  if (!actor?.loadout) return;
  await once(this, async () => createThenEdit(actor, await actor.createLoadoutTag()));
}

async function addLoadoutWeakness(event, target) {
  const actor = ownedActor(this);
  const tag = actor?.loadout && loadoutTagAt(this, target);
  if (!tag) return;
  await once(this, async () => createThenEdit(actor, await actor.createLoadoutWeakness(tag.id)));
}

async function createBackpack() {
  const actor = ownedActor(this);
  if (!actor || actor.loadout) return;
  await once(this, () => actor.createLoadoutTheme());
}

export const LEGEND_ACTIONS = {
  addRelationship,
  toggleBackpack:     toggleBackpackAction,
  toggleLoadoutTag,
  addLoadoutTag,
  addLoadoutWeakness,
  createBackpack,
};

