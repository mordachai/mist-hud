// npc-influence.js — Single entry point for NPC influence management.
// Re-exports NPCInfluenceManager from npc-influence-manager.js and exposes
// the canonical openNPCInfluenceManager() function.

export { NPCInfluenceManager } from "./npc-influence-manager.js";

/**
 * Open (or focus) the NPC Influence Manager window.
 * GM-only. Called from scene controls and the globalThis helper.
 */
export function openNPCInfluenceManager() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can open the NPC Influence Manager");
    return;
  }
  const id = "npc-influence-manager";
  const existing = foundry.applications?.instances?.get(id)
                   ?? Object.values(ui.windows ?? {}).find(w => w.id === id);
  if (existing) { existing.render(true); return; }
  // Fall back to the legacy Application constructor
  import("./npc-influence-manager.js").then(({ NPCInfluenceManager }) => {
    new NPCInfluenceManager().render(true);
  });
}
