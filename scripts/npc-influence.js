// npc-influence.js — Single entry point for NPC influence management.
// Re-exports NPCInfluenceManager from npc-influence-manager.js and exposes
// the canonical openNPCInfluenceManager() function.

import { NPCInfluenceManager } from "./npc-influence-manager.js";

export { NPCInfluenceManager };

/**
 * Open (or focus) the NPC Influence Manager window.
 * GM-only. Called from scene controls and the globalThis helper.
 */
export function openNPCInfluenceManager() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MistHUD.notify.gmOnlyViewer"));
    return;
  }
  (NPCInfluenceManager.instance ?? new NPCInfluenceManager()).render({ force: true });
}
