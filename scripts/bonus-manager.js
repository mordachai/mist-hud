// bonus-manager.js — GM-mediated help/hurt bonus system
// Refactored from bonus-utils.js: handler-map pattern, no DEBUG logs.
//
// Flow:
//   Player clicks help/hurt checkbox → applyBonus() → socket to GM
//   GM receives socket → updateActorBonuses() → writes actor flag → syncUI to all clients
//   All clients update checkboxes + HUD re-renders via updateActor hook

import { SOCKET_NAME } from "./constants.js";
import { getImprovements, getCrewImprovements } from "./getters.js";

/** @type {Map<string, boolean>} key: `${giverId}-${targetId}-${type}` */
const _checkboxStates = new Map();

let _initialized = false;

// ── Public API ────────────────────────────────────────────────────────────────

export class BonusManager {
  static SOCKET_NAME = SOCKET_NAME;

  static init() {
    if (_initialized) return;
    _registerSocketListener();
    if (game.user.isGM) {
      Hooks.on("deleteToken", tokenDoc => {
        if (tokenDoc.actor) _handleTokenDeletion(tokenDoc);
      });
      Hooks.on("canvasReady", () => _verifySceneBonuses());
    }
    _initialized = true;
  }

  /**
   * Apply or remove a help/hurt bonus.
   * Called directly from the HUD checkbox handler.
   *
   * @param {string}  giverId   Actor ID giving the bonus
   * @param {string}  targetId  Actor ID receiving the bonus
   * @param {string}  bonusType "help" | "hurt"
   * @param {number}  amount
   * @param {boolean} active    true = apply, false = remove
   */
  static async applyBonus(giverId, targetId, bonusType, amount, active) {
    if (!giverId || !targetId) {
      ui.notifications.warn("Mist HUD: Cannot determine bonus parties");
      return;
    }
    _checkboxStates.set(`${giverId}-${targetId}-${bonusType}`, active);

    game.socket.emit(SOCKET_NAME, {
      type: "bonusAction",
      action: active ? "applyBonus" : "removeBonus",
      giverId, targetId, bonusType, amount,
    });

    // GMs also process directly
    if (game.user.isGM) {
      await _updateActorBonuses(targetId, giverId, bonusType, amount, active);
      _notifyTargetOwner(targetId);
    }
  }

  /**
   * Determine if a particular move is always Dynamite due to improvements.
   *
   * @param {CityActor} actor
   * @param {{ abbreviation: string, configKey?: string, name?: string }} move
   * @param {{ getSelectedRollData: Function }} hud
   * @returns {boolean}
   */
  static checkRolls(actor, move, hud) {
    if (!actor || !move) return false;

    const moveAbbr = move.abbreviation;
    const moveKey  = move.configKey || move.name || "";

    const improvGroups  = getImprovements(actor);
    const crewGroups    = getCrewImprovements(actor);
    const allImprovs    = [
      ...improvGroups.flatMap(g => g.improvements),
      ...crewGroups.flatMap(g => g.improvements),
    ];

    const rollData = hud.getSelectedRollData?.() ?? {};
    const activated = [
      ...(rollData.powerTags    ?? []),
      ...(rollData.crewPowerTags ?? []),
      ...(rollData.loadoutTags  ?? []),
    ];
    const hasThemeTag = themeId => activated.some(t => t.themeId === themeId);

    for (const imp of allImprovs) {
      const fx      = imp.effect_class  ?? imp.system?.effect_class;
      const themeId = imp.theme_id      ?? imp.system?.theme_id;
      if (!fx) continue;

      if (fx.startsWith("ALWAYS_DYN_") && fx.endsWith(moveAbbr)) return true;
      if (themeId && !hasThemeTag(themeId)) continue;
      if (fx === `THEME_DYN_${moveAbbr}`) return true;

      const choice = imp.choiceItem ?? imp.system?.choice_item ?? "";
      if (fx === "THEME_DYN_SELECT" && choice === moveKey) return true;
    }

    return false;
  }

  static refreshAllHUDs() {
    for (const hud of (globalThis.playerHudRegistry?.values() ?? [])) {
      hud.render({ force: true });
    }
  }
}

// ── Private socket handling ───────────────────────────────────────────────────

const _handlers = {
  applyBonus: async data => {
    if (!game.user.isGM) return;
    await _updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, true);
    game.socket.emit(SOCKET_NAME, { type: "bonusAction", action: "syncUI",
      targetId: data.targetId, giverId: data.giverId, bonusType: data.bonusType, active: true });
    _notifyTargetOwner(data.targetId);
  },

  removeBonus: async data => {
    if (!game.user.isGM) return;
    await _updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, false);
    game.socket.emit(SOCKET_NAME, { type: "bonusAction", action: "syncUI",
      targetId: data.targetId, giverId: data.giverId, bonusType: data.bonusType, active: false });
    _notifyTargetOwner(data.targetId);
  },

  syncUI: data => {
    const giverActor = game.actors.get(data.giverId);
    if (giverActor?.isOwner) {
      _updateCheckboxUI(data.giverId, data.targetId, data.bonusType, data.active);
    }
  },

  updateTargetHUD: data => {
    const actor = game.actors.get(data.targetId);
    if (!actor?.isOwner) return;
    const hud = globalThis.playerHudRegistry?.get(data.targetId);
    if (hud) hud.render({ force: true });
  },

  clearAllBonuses: async data => {
    if (!game.user.isGM) return;
    await _clearActorBonuses(data.actorId);
    game.socket.emit(SOCKET_NAME, { type: "bonusAction", action: "refreshHUDs" });
  },

  refreshHUDs: () => BonusManager.refreshAllHUDs(),
};

function _registerSocketListener() {
  if (globalThis._mistHudBonusSocketRegistered) return;
  game.socket.on(SOCKET_NAME, data => {
    if (data?.type === "bonusAction" && _handlers[data.action]) {
      _handlers[data.action](data);
    }
  });
  globalThis._mistHudBonusSocketRegistered = true;
}

// ── Actor flag mutations (GM only) ────────────────────────────────────────────

async function _updateActorBonuses(targetId, giverId, bonusType, amount, active) {
  if (!game.user.isGM) return;
  const target = game.actors.get(targetId);
  if (!target) return;

  const current = foundry.utils.deepClone(target.getFlag("mist-hud", "received-bonuses") || {});

  if (active) {
    current[giverId] = {
      type: bonusType,
      amount: parseInt(amount),
      timestamp: Date.now(),
      sceneId: game.scenes.current?.id ?? "unknown",
    };
  } else {
    delete current[giverId];
  }

  if (Object.keys(current).length === 0) {
    await target.unsetFlag("mist-hud", "received-bonuses");
  } else {
    await target.setFlag("mist-hud", "received-bonuses", current);
  }
}

async function _clearActorBonuses(actorId) {
  if (!game.user.isGM) return;
  const actor = game.actors.get(actorId);
  if (actor) await actor.unsetFlag("mist-hud", "received-bonuses");
}

function _notifyTargetOwner(targetId) {
  game.socket.emit(SOCKET_NAME, { type: "bonusAction", action: "updateTargetHUD", targetId });
}

function _updateCheckboxUI(giverId, targetId, bonusType, checked) {
  const key      = `${giverId}-${targetId}-${bonusType}`;
  const local    = _checkboxStates.get(key);
  if (local !== undefined && local !== checked) return;

  const cls = bonusType === "help" ? ".help-toggle" : ".hurt-toggle";
  document.querySelectorAll(
    `${cls}[data-actor-id="${giverId}"][data-target-id="${targetId}"]`
  ).forEach(el => { el.checked = checked; });
}

// ── Cleanup helpers ───────────────────────────────────────────────────────────

async function _handleTokenDeletion(tokenDoc) {
  if (!game.user.isGM) return;
  const actorId = tokenDoc.actor?.id;
  if (!actorId) return;

  // Remove all bonuses given by this actor
  for (const actor of game.actors) {
    const bonuses = foundry.utils.deepClone(actor.getFlag("mist-hud", "received-bonuses") || {});
    if (bonuses[actorId]) {
      delete bonuses[actorId];
      if (Object.keys(bonuses).length === 0) {
        await actor.unsetFlag("mist-hud", "received-bonuses");
      } else {
        await actor.setFlag("mist-hud", "received-bonuses", bonuses);
      }
    }
  }

  // Clear the deleted actor's own received bonuses
  await _clearActorBonuses(actorId);
}

async function _verifySceneBonuses() {
  // No-op: actor flag-based bonuses persist across scenes intentionally.
  // If we ever add scene-scoped bonus logic, implement it here.
}

// ── Legacy export for backward compatibility ──────────────────────────────────
export function getReceivedBonuses(actor) {
  return actor?.getFlag("mist-hud", "received-bonuses") || {};
}
