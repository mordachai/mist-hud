// hud-state.js — In-memory selection state for the player HUD
// Does NOT persist to actor flags (ephemeral within a session).
// When a re-render happens, the HUD restores visual state from this registry.

import { MODULE_ID } from "./constants.js";

export class HUDState {
  /** @type {Set<string>} tag item IDs selected for the next roll */
  selectedTags   = new Set();

  /** @type {Set<string>} tag IDs the player has inverted (weakness ↔ power) */
  invertedTags   = new Set();

  /** @type {Map<string, 'positive'|'negative'|'neutral'>} statusId → state */
  statusStates   = new Map();

  /** @type {number} flat modifier (+/-) */
  modifier       = 0;

  // ─── Build ActivatedTagFormat[] for CityRoll.execRoll() ──────────────────

  /**
   * Build the selectedList array that CityRoll.execRoll() expects.
   *
   * @param {CityActor} actor  The player's character actor
   * @returns {object[]}
   */
  toActivatedTagFormat(actor) {
    const list = [];

    // Tags
    for (const id of this.selectedTags) {
      const tag = this._resolveTag(id, actor);
      if (!tag) continue;
      if (tag.system.burned) continue; // skip already-burned tags

      const tagOwner = tag.parent;
      const isInverted = this.invertedTags.has(id);
      const amount = this._tagAmount(tag, isInverted);

      list.push({
        name:        tag.name,
        id,
        amount,
        ownerId:     tagOwner?.id ?? undefined,
        tagId:       id,
        type:        "tag",
        description: tag.system.description || "",
        subtype:     tag.system.subtype || "",
        strikeout:   false,
        tokenId:     tagOwner?.token?.id ?? "",
        crispy:      !!(tag.system.crispy || tag.system.temporary),
      });
    }

    // Statuses
    for (const [id, state] of this.statusStates) {
      if (state === "neutral") continue;

      const status = actor.items.get(id)
        ?? this._findStatusInAnyOwnedActor(id, actor);
      if (!status) continue;

      const tier   = status.system.tier ?? 1;
      const amount = state === "positive" ? tier : -tier;

      list.push({
        name:      status.name,
        id,
        amount,
        ownerId:   status.parent?.id ?? actor.id,
        tagId:     undefined,
        type:      "status",
        subtype:   state,
        strikeout: false,
        tokenId:   status.parent?.token?.id ?? "",
        crispy:    !!(status.system.temporary),
      });
    }

    return list;
  }

  /**
   * Find whether any tag in selectedTags is marked for burning (burn_state === 1).
   * Returns the ID of the first "toBurn" tag, or null.
   *
   * @param {CityActor} actor
   * @returns {string|null}
   */
  getBurnTagId(actor) {
    for (const id of this.selectedTags) {
      const tag = this._resolveTag(id, actor);
      if (tag && tag.system.burn_state === 1 && !tag.system.burned) return id;
    }
    return null;
  }

  // ─── Preview power (informational, not authoritative) ─────────────────────

  previewPower() {
    let power = this.modifier;
    // Each selected tag is roughly ±1; statuses add their tier
    // This is a rough UI indicator only – the real calc is done by CityRoll
    power += this.selectedTags.size;
    power -= (this.invertedTags.size * 2); // inverted weaknesses still deduct
    for (const [, state] of this.statusStates) {
      if (state !== "neutral") power += (state === "positive" ? 1 : -1);
    }
    return power;
  }

  // ─── State management ─────────────────────────────────────────────────────

  toggleTag(id) {
    if (this.selectedTags.has(id)) {
      this.selectedTags.delete(id);
    } else {
      this.selectedTags.add(id);
    }
  }

  toggleInverted(id) {
    if (this.invertedTags.has(id)) {
      this.invertedTags.delete(id);
    } else {
      this.invertedTags.add(id);
    }
  }

  cycleStatus(id) {
    const current = this.statusStates.get(id) ?? "neutral";
    const next = current === "neutral" ? "negative"
               : current === "negative" ? "positive"
               : "neutral";
    this.statusStates.set(id, next);
    return next;
  }

  clear() {
    this.selectedTags.clear();
    this.invertedTags.clear();
    this.statusStates.clear();
    this.modifier = 0;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Find a tag item by ID, checking the main actor and all accessible crew actors.
   *
   * @param {string}     id
   * @param {CityActor}  actor
   * @returns {CityItem|null}
   */
  _resolveTag(id, actor) {
    // Own items first
    const own = actor.items.get(id);
    if (own) return own;

    // Crew actors owned by the same non-GM users
    const nonGMOwners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
    for (const crew of game.actors.filter(a => a.type === "crew")) {
      if (nonGMOwners.some(u => crew.testUserPermission(u, "OWNER"))) {
        const crewTag = crew.items.get(id);
        if (crewTag) return crewTag;
      }
    }
    return null;
  }

  /**
   * Find a status by ID in any actor owned by the same users (e.g. crew actor).
   */
  _findStatusInAnyOwnedActor(id, actor) {
    const nonGMOwners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
    for (const other of game.actors) {
      if (nonGMOwners.some(u => other.testUserPermission(u, "OWNER"))) {
        const s = other.items.get(id);
        if (s) return s;
      }
    }
    return null;
  }

  /**
   * Determine the modifier amount for a tag.
   * Power / loadout / story (positive) → +1
   * Weakness (not inverted) → -1; inverted → +1
   * Story (inverted) → -1
   *
   * @param {CityItem}  tag
   * @param {boolean}   isInverted
   * @returns {number}
   */
  _tagAmount(tag, isInverted) {
    const subtype = tag.system.subtype || "";
    if (subtype === "weakness") return isInverted ? 1 : -1;
    if (subtype === "story")    return isInverted ? -1 : 1;
    return 1; // power, loadout, crew-power
  }
}

// ─── Module-level registry (one HUDState per actorId) ─────────────────────────

/** @type {Map<string, HUDState>} */
export const hudStateRegistry = new Map();

/**
 * Get the HUDState for an actor, creating it if necessary.
 *
 * @param {string} actorId
 * @returns {HUDState}
 */
export function getOrCreateState(actorId) {
  if (!hudStateRegistry.has(actorId)) {
    hudStateRegistry.set(actorId, new HUDState());
  }
  return hudStateRegistry.get(actorId);
}
