// hud-state.js — In-memory selection state for the player HUD
// Does NOT persist to actor flags (ephemeral within a session).
// When a re-render happens, the HUD restores visual state from this registry.

import { MODULE_ID } from "./constants.js";

// ── HUD keys ─────────────────────────────────────────────────────────────────
// A HUD (and its selection state) belongs to one token's actor. Linked tokens
// share the world actor, so they share one HUD keyed by actor id. An unlinked
// token owns a synthetic copy of the actor (actor.isToken), so it is keyed by
// its token id instead, otherwise all unlinked tokens of one actor would share
// a single HUD and a single selection.

/** Registry key for an actor: token id for an unlinked token actor, else actor id. */
export function hudKey(actor) {
  if (!actor) return undefined;
  return actor.isToken && actor.token?.id ? actor.token.id : actor.id;
}

/** Inverse of hudKey(): the actor for a registry key (world actor, or an unlinked token's actor on the viewed scene). */
export function resolveActorByKey(key) {
  if (!key) return null;
  return game.actors.get(key) ?? canvas?.scene?.tokens?.get(key)?.actor ?? null;
}

// ── Player HUD registry (one PlayerHUD per hudKey) ───────────────────────────
// Lives here (not in player-hud.js) so bonus-manager.js can reach it without
// importing player-hud.js, which itself imports bonus-manager.js.
/** @type {Map<string, object>} */
export const playerHudRegistry = new Map();

/** Open HUDs showing any token of this world actor (linked, or unlinked copies of it). */
export function hudsForActorId(actorId) {
  return [...playerHudRegistry.values()].filter(hud => hud.actor?.id === actorId);
}

/**
 * The actor that holds help/hurt bonuses for `actor`. Bonuses are granted to a
 * character (the system's juice items target world-actor ids, and the GM writes
 * the flag on the world actor), so an unlinked token reads its base actor.
 */
export function bonusActorFor(actor) {
  return game.actors.get(actor?.id) ?? actor;
}

// ── System bridges ───────────────────────────────────────────────────────────

/** Same test as the system's CitySettings.isOtherscapeBurn(). */
export function isOtherscapeBurn() {
  try {
    return game.settings.get("city-of-mist", "tagBurn") === "mist-engine";
  } catch {
    return false;
  }
}

/**
 * Tags/statuses the player selected through the system's own UI (scene tags
 * window, sheets). The system exposes the class as window.SelectedTagsAndStatus.
 * @returns {object[]} copies, safe to mutate
 */
export function getSystemSelection() {
  try {
    const rows = globalThis.SelectedTagsAndStatus?.getPlayerActivatedTagsAndStatus?.() ?? [];
    return rows.map(r => ({ ...r }));
  } catch (e) {
    console.warn("Mist HUD | Could not read the system's tag selection:", e);
    return [];
  }
}

export function clearSystemSelection() {
  try {
    globalThis.SelectedTagsAndStatus?.clearAllActivatedItems?.();
  } catch (e) {
    console.warn("Mist HUD | Could not clear the system's tag selection:", e);
  }
}

/**
 * Same test as the system's CityItem.isBurned(): a tag is burned only when
 * `burned` is true AND `burn_state` is not 0 (burn_state 1 = "to burn",
 * 2 = burned, 0 = unburned).
 */
export function isTagBurned(tag) {
  return !!tag?.system?.burned && tag.system.burn_state !== 0;
}

function _modifierRow(id, name, amount) {
  return { id, name, amount, ownerId: null, tagId: null, type: "modifier", strikeout: false };
}

/**
 * Help/hurt bonuses other players granted to this actor (GM-written flag).
 * @returns {object[]} "modifier" rows for CityRoll
 */
export function getReceivedBonusRows(actor) {
  const bonuses = bonusActorFor(actor)?.getFlag(MODULE_ID, "received-bonuses") || {};
  const rows = [];
  for (const [giverId, bonus] of Object.entries(bonuses)) {
    const amount = Math.abs(Number(bonus?.amount)) || 0;
    if (!amount) continue;
    const hurt  = bonus.type === "hurt";
    const giver = game.actors.get(giverId)?.name ?? "?";
    rows.push(_modifierRow(
      `mist-hud-${hurt ? "hurt" : "help"}-${giverId}`,
      `${hurt ? "Hurt" : "Help"} (${giver})`,
      hurt ? -amount : amount,
    ));
  }
  return rows;
}

/**
 * NPC influence for the threat tokens on the current scene, read from the
 * cache the GM broadcasts (globalThis.activeNpcInfluences). One row per token,
 * unlinked tokens keyed by token id, linked ones by actor id.
 * @returns {object[]} "modifier" rows for CityRoll
 */
export function getNpcInfluenceRows() {
  const cache = globalThis.activeNpcInfluences || {};
  const rows  = [];
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor?.type !== "threat") continue;
    const influence = (!token.document.actorLink && cache[token.id]) || cache[token.actor.id];
    const amount    = Number(influence?.totalInfluence) || 0;
    if (!amount) continue;
    rows.push(_modifierRow(`mist-hud-npc-${token.id}`, token.name || influence.npcName || "NPC", amount));
  }
  return rows;
}

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
      if (isTagBurned(tag)) continue; // skip already-burned tags

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
   * IDs of every selected tag marked for burning (burn_state === 1, not yet burned).
   *
   * @param {CityActor} actor
   * @returns {string[]}
   */
  getBurnTagIds(actor) {
    const ids = [];
    for (const id of this.selectedTags) {
      const tag = this._resolveTag(id, actor);
      if (tag && tag.system.burn_state === 1 && !isTagBurned(tag)) ids.push(id);
    }
    return ids;
  }

  /**
   * ID of the first "toBurn" tag, or null. This is CityRoll's `burnTag` option.
   *
   * @param {CityActor} actor
   * @returns {string|null}
   */
  getBurnTagId(actor) {
    return this.getBurnTagIds(actor)[0] ?? null;
  }

  // ─── Full roll list ───────────────────────────────────────────────────────

  /**
   * Everything a roll uses, in CityRoll's selectedList format: the HUD
   * selection, the system's own selection (scene tags etc.) and, when
   * `modifiers` is true, received help/hurt and NPC influence.
   *
   * Burn: the first to-burn tag is CityRoll's `burnTag` (it gives it +3 and
   * burns it). Under Otherscape/LitM burn rules several tags can be burned at
   * once; CityRoll only handles one, so the extra ones get amount 3 here and
   * are returned in `extraBurn` for the caller to burn after the roll.
   *
   * @param {CityActor} actor
   * @param {{modifiers?: boolean}} [opts]
   * @returns {{list: object[], burnIds: string[], extraBurn: string[], usedBonuses: boolean}}
   */
  buildRollList(actor, { modifiers = true } = {}) {
    const list    = this.toActivatedTagFormat(actor);
    const burnIds = this.getBurnTagIds(actor);
    const multi   = isOtherscapeBurn();

    burnIds.forEach((id, i) => {
      if (i > 0 && !multi) return;
      const row = list.find(x => x.tagId === id);
      if (row) row.amount = 3;
    });
    const extraBurn = multi ? burnIds.slice(1) : [];

    // System selection, minus anything already picked in the HUD
    const seen = new Set(list.map(x => `${x.id}|${x.tokenId || ""}`));
    for (const row of getSystemSelection()) {
      const key = `${row.id}|${row.tokenId || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(row);
    }

    let usedBonuses = false;
    if (modifiers) {
      const bonusRows = getReceivedBonusRows(actor);
      usedBonuses = bonusRows.length > 0;
      list.push(...bonusRows, ...getNpcInfluenceRows());
    }

    return { list, burnIds, extraBurn, usedBonuses };
  }

  // ─── Preview power (informational, not authoritative) ─────────────────────

  /**
   * Power of a standard roll with the current selection, summed the way
   * CityRoll does it: all tags (only the burnt one under classic burn rules),
   * the best positive and the worst negative status, every other modifier,
   * and the flat modifier. Caps and grit mode are applied by CityRoll only.
   *
   * @param {CityActor} actor
   * @returns {number}
   */
  previewPower(actor) {
    if (!actor) return this.modifier;
    const { list, burnIds } = this.buildRollList(actor);

    let tags = list.filter(x => x.type === "tag");
    if (burnIds.length && !isOtherscapeBurn()) tags = tags.filter(x => x.tagId === burnIds[0]);

    const statuses = list.filter(x => x.type === "status").map(x => x.amount);
    const best     = Math.max(0, ...statuses);
    const worst    = Math.min(0, ...statuses);

    const others = list.filter(x => x.type !== "tag" && x.type !== "status");
    const sum    = rows => rows.reduce((acc, x) => acc + (Number(x.amount) || 0), 0);

    return sum(tags) + best + worst + sum(others) + this.modifier;
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

// ─── Module-level registry (one HUDState per hudKey) ──────────────────────────

/** @type {Map<string, HUDState>} */
export const hudStateRegistry = new Map();

/**
 * Get the HUDState for a HUD key (see hudKey()), creating it if necessary.
 *
 * @param {string} key
 * @returns {HUDState}
 */
export function getOrCreateState(key) {
  if (!hudStateRegistry.has(key)) {
    hudStateRegistry.set(key, new HUDState());
  }
  return hudStateRegistry.get(key);
}
