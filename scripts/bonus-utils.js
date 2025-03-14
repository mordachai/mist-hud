// bonus-utils.js - Streamlined GM-mediated bonus system
import { getImprovements } from "./mh-getters.js";
import { getCrewImprovements } from "./mh-getters.js";
import { MistHUD } from "./mist-hud.js";

// Keep the original checkRolls function unchanged
export function checkRolls(actor, move, hud) {
  // Original implementation
  if (!actor || !move) return false;
  
  const moveAbbr = move.abbreviation;
  const moveKey = move.configKey || move.name;

  const improvementGroups = getImprovements(actor);
  const crewImprovementGroups = getCrewImprovements(actor);
  const actorImprovements = improvementGroups.reduce((arr, group) => arr.concat(group.improvements), []);
  const crewImprovements = crewImprovementGroups.reduce((arr, group) => arr.concat(group.improvements), []);
  const allImprovements = [...actorImprovements, ...crewImprovements];

  const rollData = hud.getSelectedRollData();

  const activatedTags = [
    ...(rollData.powerTags || []),
    ...(rollData.crewPowerTags || []),
    ...(rollData.loadoutTags || [])
  ];

  const hasActivatedThemeTag = (themeId) => {
    return activatedTags.some(tag => tag.themeId === themeId);
  };

  for (const improvement of allImprovements) {
    const effectClass = improvement.effect_class || (improvement.system && improvement.system.effect_class);
    const themeId = improvement.theme_id || (improvement.system && improvement.system.theme_id);
    if (!effectClass) continue;

    if (effectClass.startsWith("ALWAYS_DYN_") && effectClass.endsWith(moveAbbr)) {
      return true;
    }

    if (themeId && !hasActivatedThemeTag(themeId)) {
      continue;
    }

    if (effectClass === `THEME_DYN_${moveAbbr}`) {
      return true;
    }

    const choiceItem = (improvement.choiceItem || (improvement.system && improvement.system.choice_item)) || "";
    if (effectClass === "THEME_DYN_SELECT" && choiceItem === moveKey) {
      return true;
    }
  }

  return false;
}

/**
 * BonusManager handles character-to-character help/hurt bonuses
 * Using a GM-mediated approach for permission control
 */
export class BonusManager {
  static SOCKET_NAME = "module.mist-hud";
  static initialized = false;

  /**
   * Initialize the BonusManager
   */
  static init() {
    if (this.initialized) return;
    
    // Register socket listener using helper method
    this.registerSocketListener();
    
    // Add hook for token deletion (GM-only)
    if (game.user.isGM) {
      Hooks.on("deleteToken", (tokenDoc) => {
        if (tokenDoc.actor) {
          this.handleTokenDeletion(tokenDoc);
        }
      });
    }
    
    // Add hook for scene changes
    Hooks.on("canvasReady", () => {
      if (game.user.isGM) {
        this.verifySceneBonuses();
      }
    });
    
    this.initialized = true;
  }

  /**
   * Safely register a socket listener using a global flag
   */
  static registerSocketListener() {
    if (!globalThis.mistHudSocketRegistered) {
      game.socket.on(this.SOCKET_NAME, (data) => {
        if (data && data.type === "bonusAction") {
          this.handleBonusSocketMessage(data);
        }
      });
      
      globalThis.mistHudSocketRegistered = true;
    }
  }
  
  /**
   * Handle socket messages for bonuses
   */
  static async handleBonusSocketMessage(data) {
    if (!data || !data.action) return;
    
    // Only GMs perform the actual actor updates
    const isGM = game.user.isGM;
    
    switch (data.action) {
      case "applyBonus":
        if (isGM) {
          await this.updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, true);
          // Notify all clients to update UI
          game.socket.emit(this.SOCKET_NAME, {
            type: "bonusAction",
            action: "syncUI",
            targetId: data.targetId,
            giverId: data.giverId,
            bonusType: data.bonusType,
            active: true
          });
        }
        break;
        
      case "removeBonus":
        if (isGM) {
          await this.updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, false);
          // Notify all clients to update UI
          game.socket.emit(this.SOCKET_NAME, {
            type: "bonusAction",
            action: "syncUI",
            targetId: data.targetId,
            giverId: data.giverId,
            bonusType: data.bonusType,
            active: false
          });
        }
        break;
        
      case "syncUI":
        // Update checkbox state and refresh HUDs
        this.updateCheckboxState(data.giverId, data.targetId, data.bonusType, data.active);
        this.refreshTargetHUD(data.targetId);
        break;
        
      case "clearAllBonuses":
        if (isGM) {
          await this.clearActorBonuses(data.actorId);
          game.socket.emit(this.SOCKET_NAME, {
            type: "bonusAction",
            action: "refreshHUDs"
          });
        }
        break;
        
      case "refreshHUDs":
        this.refreshAllHUDs();
        break;
    }
  }
  
  /**
   * Update actor bonuses (GM only)
   */
  static async updateActorBonuses(targetId, giverId, bonusType, amount, active) {
    if (!game.user.isGM) return;
    
    const targetActor = game.actors.get(targetId);
    if (!targetActor) return;
    
    // Get current bonuses
    const currentBonuses = targetActor.getFlag("mist-hud", "received-bonuses") || {};
    const updatedBonuses = foundry.utils.deepClone(currentBonuses);
    
    if (active) {
      // Add or update bonus
      updatedBonuses[giverId] = {
        type: bonusType,
        amount: parseInt(amount),
        timestamp: Date.now(),
        sceneId: game.scenes.current?.id || "unknown"
      };
    } else {
      // Remove bonus
      delete updatedBonuses[giverId];
    }
    
    // Update the actor flag
    await targetActor.setFlag("mist-hud", "received-bonuses", updatedBonuses);
  }
  
  /**
   * Apply a bonus between characters (main entry point for players)
   */
  static async applyBonus(giverId, targetId, bonusType, amount, active) {
    if (!giverId || !targetId) return;
    
    // Send socket message to GM
    game.socket.emit(this.SOCKET_NAME, {
      type: "bonusAction",
      action: active ? "applyBonus" : "removeBonus",
      giverId,
      targetId,
      bonusType,
      amount
    });
    
    // If GM, process directly
    if (game.user.isGM) {
      await this.updateActorBonuses(targetId, giverId, bonusType, amount, active);
      this.updateCheckboxState(giverId, targetId, bonusType, active);
      this.refreshTargetHUD(targetId);
    }
  }
  
  /**
   * Update checkbox states in the UI
   */
  static updateCheckboxState(giverId, targetId, bonusType, checked) {
    const checkboxClass = bonusType === "help" ? ".help-toggle" : ".hurt-toggle";
    const selector = `${checkboxClass}[data-actor-id="${giverId}"][data-target-id="${targetId}"]`;
    
    document.querySelectorAll(selector).forEach(element => {
      element.checked = checked;
    });
  }
  
  /**
   * Refresh a specific actor's HUD
   */
  static refreshTargetHUD(actorId) {
    const targetHud = globalThis.playerHudRegistry?.get(actorId);
    const actor = game.actors.get(actorId);
    
    if (actor && actor.isOwner && targetHud) {
      targetHud.render(true);
    }
  }
  
  /**
   * Refresh all HUDs for actors owned by the current user
   */
  static refreshAllHUDs() {
    if (globalThis.playerHudRegistry) {
      for (const [actorId, hud] of globalThis.playerHudRegistry.entries()) {
        const actor = game.actors.get(actorId);
        if (actor && actor.isOwner) {
          hud.render(true);
        }
      }
    }
  }
  
  /**
   * Clear all bonuses for an actor (GM only)
   */
  static async clearActorBonuses(actorId) {
    if (!game.user.isGM) return;
    
    const actor = game.actors.get(actorId);
    if (!actor) return;
    
    await actor.unsetFlag("mist-hud", "received-bonuses");
  }
  
  /**
   * Clear all bonuses for an actor and notify clients
   */
  static async clearAllBonuses(actorId) {
    // Send message to GM
    game.socket.emit(this.SOCKET_NAME, {
      type: "bonusAction",
      action: "clearAllBonuses",
      actorId
    });
    
    // If GM, handle directly
    if (game.user.isGM) {
      await this.clearActorBonuses(actorId);
      this.refreshAllHUDs();
    }
  }
  
  /**
   * Handle token deletion (GM only)
   */
  static async handleTokenDeletion(tokenDoc) {
    if (!game.user.isGM) return;
    
    const actorId = tokenDoc.actor?.id;
    if (!actorId) return;
    
    // Check if this actor has given any bonuses
    for (const actor of game.actors.contents) {
      const bonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
      
      if (bonuses[actorId]) {
        // Remove bonuses from this deleted actor
        const updatedBonuses = foundry.utils.deepClone(bonuses);
        delete updatedBonuses[actorId];
        await actor.setFlag("mist-hud", "received-bonuses", updatedBonuses);
      }
    }
    
    // Clear all bonuses the actor received
    await this.clearActorBonuses(actorId);
    
    // Notify clients to refresh HUDs
    game.socket.emit(this.SOCKET_NAME, {
      type: "bonusAction",
      action: "refreshHUDs"
    });
  }
  
  /**
   * Verify and clean up bonuses when changing scenes (GM only)
   */
  static async verifySceneBonuses() {
    if (!game.user.isGM) return;
    
    const currentSceneId = game.scenes.current?.id;
    if (!currentSceneId) return;
    
    // Get actor IDs in current scene
    const sceneActorIds = new Set();
    canvas.tokens.placeables.forEach(token => {
      if (token.actor) {
        sceneActorIds.add(token.actor.id);
      }
    });
    
    let anyChanges = false;
    
    // Check all actors
    for (const actor of game.actors.contents) {
      const bonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
      let changed = false;
      const updatedBonuses = foundry.utils.deepClone(bonuses);
      
      for (const giverId in updatedBonuses) {
        if (!sceneActorIds.has(giverId)) {
          delete updatedBonuses[giverId];
          changed = true;
          anyChanges = true;
        }
      }
      
      if (changed) {
        await actor.setFlag("mist-hud", "received-bonuses", updatedBonuses);
      }
    }
    
    if (anyChanges) {
      game.socket.emit(this.SOCKET_NAME, {
        type: "bonusAction",
        action: "refreshHUDs"
      });
    }
  }
  
  /**
   * Calculate the total bonus value for an actor
   */
  static calculateTotalBonus(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return 0;
    
    const bonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
    let helpTotal = 0;
    let hurtTotal = 0;
    
    Object.values(bonuses).forEach(bonus => {
      if (bonus.type === "help") {
        helpTotal += bonus.amount;
      } else if (bonus.type === "hurt") {
        hurtTotal += bonus.amount;
      }
    });
    
    return helpTotal - hurtTotal;
  }
}

/**
 * Get received bonuses for an actor
 */
export function getReceivedBonuses(actor) {
  if (!actor) return [];
  
  const receivedBonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
  const result = [];
  
  for (const giverId in receivedBonuses) {
    const bonus = receivedBonuses[giverId];
    const giverActor = game.actors.get(giverId);
    
    if (giverActor) {
      const tokenImage = 
        giverActor.token?.texture?.src || 
        giverActor.prototypeToken?.texture?.src || 
        giverActor.img;
      
      result.push({
        giverName: giverActor.name,
        giverToken: tokenImage,
        giverId,
        type: bonus.type,
        amount: bonus.amount,
        timestamp: bonus.timestamp || Date.now(),
        sceneId: bonus.sceneId || null
      });
    }
  }
  
  return result;
}

// Initialize on ready
Hooks.once("ready", () => {
  BonusManager.init();
});