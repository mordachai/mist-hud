// play-actions.js — the card sheet's play-mode actions (plan § 6.2, phase 4).
//
// Play mode is the system's locked state. Clicking a tag name selects it for
// the next roll in the system's SelectedTagsAndStatus, as the system sheet's
// `.item-selection-context .tag .name` handler does: left click = the tag's
// default direction, right click = reversed, the same click again clears it.
// The selection is the system's (client-local), so the token tooltip, the
// influence viewer and the roll dialog show it too. The sheet re-renders from
// the TagOrStatusSelected / TagOrStatusSelectChange hooks (init.js).
//
// Every handler is an ApplicationV2 action (`this` is the MistCardSheet).

import { toggleTagSelection, isTagSelectable } from "./system-adapter.js";

/** The tag a control sits on and its actor (the character, a crew, a danger). */
function tagAt(sheet, target) {
  const card = target.closest(".mh-cs-card");
  const ownerId = card?.dataset.ownerId;
  const owner = !ownerId || ownerId === sheet.actor.id ? sheet.actor : game.actors.get(ownerId);
  const tag = owner?.items.get(target.closest("[data-tag-id]")?.dataset.tagId);
  return { owner, tag };
}

/** Click (+ its default direction) or right-click (reversed) on a tag name. */
function selectTag(event, target) {
  if (this.editMode) return;
  const { owner, tag } = tagAt(this, target);
  if (!tag || !isTagSelectable(tag)) return;
  event.preventDefault();
  toggleTagSelection(tag, owner, event.button === 2);
}

export const PLAY_ACTIONS = {
  selectTag: { handler: selectTag, buttons: [0, 2] },
};
