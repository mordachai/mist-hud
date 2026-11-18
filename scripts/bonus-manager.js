// bonus-manager.js — GM-mediated help/hurt bonus system
// Refactored from bonus-utils.js: handler-map pattern, no DEBUG logs.
//
// Flow:
//   Player clicks help/hurt checkbox → applyBonus() → socket to GM
//   GM receives socket → updateActorBonuses() → writes actor flag → syncUI to all clients
//   All clients update checkboxes + HUD re-renders via updateActor hook

import { SOCKET_NAME, MODULE_ID, FLAG_KEYS } from "./constants.js";
import {
  playerHudRegistry, hudsForActorId, bonusActorFor, bonusOfferKey, juiceFor, splitJuice,
} from "./hud-state.js";

/** @type {Map<string, boolean>} key: `${giverId}-${targetId}-${type}` */
const _checkboxStates = new Map();

let _initialized = false;

// ── Public API ────────────────────────────────────────────────────────────────

export class BonusManager {
  static SOCKET_NAME = SOCKET_NAME;

  static init() {
    if (_initialized) return;
    _registerSocketListener();
    // A roll from the system sheet goes through the system's roll dialog: add
    // the HUD offers there too.
    Hooks.on("renderRollDialog", dialog => void _offerToSheetRoll(dialog));
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
      ui.notifications.warn(game.i18n.localize("MistHUD.notify.bonusPartiesUnknown"));
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
   * Clear every help/hurt bonus an actor has received (after it was used in a
   * roll). Only a GM may write the flag, so players ask over the socket.
   *
   * @param {string} actorId
   */
  static async clearBonuses(actorId) {
    if (!actorId) return;
    if (game.user.isGM) {
      await _handlers.clearAllBonuses({ actorId });
    } else {
      game.socket.emit(SOCKET_NAME, { type: "bonusAction", action: "clearAllBonuses", actorId });
    }
  }

  static refreshAllHUDs() {
    for (const hud of playerHudRegistry.values()) {
      if (hud.rendered) hud.render({ force: true });
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
    // Unlinked tokens of the target actor have their own HUDs, so refresh all of them
    for (const hud of hudsForActorId(data.targetId)) {
      if (hud.rendered) hud.render({ force: true });
    }
  },

  clearAllBonuses: async data => {
    if (!game.user.isGM) return;
    await _clearActorBonuses(data.actorId);
    // Forget local checkbox intent for this target, then refresh everyone
    // (socket messages do not come back to the sender, so refresh here too).
    for (const key of _checkboxStates.keys()) {
      if (key.split("-")[1] === data.actorId) _checkboxStates.delete(key);
    }
    game.socket.emit(SOCKET_NAME, { type: "bonusAction", action: "refreshHUDs" });
    BonusManager.refreshAllHUDs();
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
  if (!target || !["help", "hurt"].includes(bonusType)) return;
  const path = `${FLAG_KEYS.RECEIVED_BONUSES}.${bonusOfferKey(giverId, bonusType)}`;

  if (!active) {
    if (target.getFlag(MODULE_ID, path) !== undefined) await target.unsetFlag(MODULE_ID, path);
    return;
  }

  // The giver can offer at most the juice they hold toward this target
  // (the system's CityActor.getHelpHurtFor); the GM checks it, not the player.
  const giver = game.actors.get(giverId);
  const juice = juiceFor(giver, bonusType, targetId);
  const max   = juice.reduce((acc, j) => acc + (Number(j.system.amount) || 0), 0);
  const used  = Math.min(max, Math.max(0, parseInt(amount) || 0));
  if (used <= 0) {
    if (target.getFlag(MODULE_ID, path) !== undefined) await target.unsetFlag(MODULE_ID, path);
    return;
  }

  await target.setFlag(MODULE_ID, path, {
    giverId,
    type:      bonusType,
    amount:    used,
    juice:     splitJuice(juice, used),
    timestamp: Date.now(),
    sceneId:   game.scenes.current?.id ?? "unknown",
  });
}

async function _clearActorBonuses(actorId) {
  if (!game.user.isGM) return;
  const actor = game.actors.get(actorId);
  if (actor?.getFlag(MODULE_ID, FLAG_KEYS.RECEIVED_BONUSES) !== undefined) {
    await actor.unsetFlag(MODULE_ID, FLAG_KEYS.RECEIVED_BONUSES);
  }
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

// ── Sheet rolls (the system's RollDialog) ─────────────────────────────────────

/** Roll dialogs that already got the HUD offers. */
const _offeredDialogs = new WeakSet();

/**
 * Put the offers the rolling character holds into the system's roll dialog,
 * through the dialog's own RollDialog.activateHelpHurt (the same call the
 * system makes when a player answers its Help/Hurt request). The dialog then
 * hands them to CityRoll, which spends the juice after the roll. Confirming
 * the dialog uses up the offers.
 */
async function _offerToSheetRoll(dialog) {
  if (!dialog?.actor || typeof dialog.activateHelpHurt !== "function") return;
  if (_offeredDialogs.has(dialog)) return;
  _offeredDialogs.add(dialog);

  const target = bonusActorFor(dialog.actor);
  const offers = Object.entries(target?.getFlag(MODULE_ID, FLAG_KEYS.RECEIVED_BONUSES) || {});
  if (!offers.length) return;

  const submit = dialog.submit;
  dialog.submit = function (button, ...rest) {
    if (button && button === this.data?.buttons?.one) BonusManager.clearBonuses(target.id);
    return submit.call(this, button, ...rest);
  };

  // Let the dialog finish its first render before changing its list.
  await new Promise(resolve => setTimeout(resolve, 0));
  for (const [key, offer] of offers) {
    const type   = offer?.type === "hurt" ? "hurt" : "help";
    const giver  = game.actors.get(offer?.giverId ?? key);
    const held   = juiceFor(giver, type, target.id)
      .reduce((acc, j) => acc + (Number(j.system.amount) || 0), 0);
    const amount = Math.min(held, Math.abs(Number(offer?.amount)) || 0);
    if (!giver || amount <= 0) continue;
    try {
      await dialog.activateHelpHurt(giver, amount, type === "help" ? 1 : -1, target.id);
    } catch (e) {
      console.warn(`Mist HUD | Could not add ${type} from ${giver.name} to the roll:`, e);
    }
  }
}

// ── Cleanup helpers ───────────────────────────────────────────────────────────

async function _handleTokenDeletion(tokenDoc) {
  if (!game.user.isGM) return;
  const actorId = tokenDoc.actor?.id;
  if (!actorId) return;

  // Remove all bonuses given by this actor
  for (const actor of game.actors) {
    const offers = actor.getFlag(MODULE_ID, FLAG_KEYS.RECEIVED_BONUSES) || {};
    for (const [key, offer] of Object.entries(offers)) {
      if ((offer?.giverId ?? key) !== actorId) continue;
      await actor.unsetFlag(MODULE_ID, `${FLAG_KEYS.RECEIVED_BONUSES}.${key}`);
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
  return actor?.getFlag(MODULE_ID, FLAG_KEYS.RECEIVED_BONUSES) || {};
}
