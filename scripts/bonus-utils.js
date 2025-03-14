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
  static DEBUG = true;

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
    
    // Initialize checkbox state tracking
    if (!globalThis.mistHudCheckboxStates) {
      globalThis.mistHudCheckboxStates = new Map();
    }
  }

  /**
   * Safely register a socket listener using a global flag
   */
  static registerSocketListener() {
    if (!globalThis.mistHudSocketRegistered) {
      game.socket.on(this.SOCKET_NAME, (data) => {
        if (data && data.type === "bonusAction") {
          if (this.DEBUG) console.log(`%c[BonusManager] Socket received:`, "color: #6699ff", data);
          this.handleBonusSocketMessage(data);
        }
      });
      
      globalThis.mistHudSocketRegistered = true;
      if (this.DEBUG) console.log(`%c[BonusManager] Socket listener registered for ${this.SOCKET_NAME}`, "color: #33cc33");
    }
  }
  
  /**
   * Handle socket messages for bonuses
   */
  static async handleBonusSocketMessage(data) {
    if (!data || !data.action) {
      if (this.DEBUG) console.log(`%c[BonusManager] Invalid socket message received`, "color: #ff6666", data);
      return;
    }
    
    // Only GMs perform the actual actor updates
    const isGM = game.user.isGM;
    const username = game.user.name;
    
    if (this.DEBUG) console.log(`%c[BonusManager] Processing ${data.action} by ${username} (GM: ${isGM})`, "color: #cc99ff");
    
    switch (data.action) {
      case "applyBonus":
        if (isGM) {
          if (this.DEBUG) console.log(`%c[BonusManager] GM applying bonus from ${data.giverId} to ${data.targetId}: ${data.bonusType} ${data.amount}`, "color: #33cc33");
          await this.updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, true);
          
          // Notify all clients to update UI
          const syncData = {
            type: "bonusAction",
            action: "syncUI",
            targetId: data.targetId,
            giverId: data.giverId,
            bonusType: data.bonusType,
            active: true
          };
          
          if (this.DEBUG) console.log(`%c[BonusManager] GM emitting syncUI to all clients`, "color: #33cc33", syncData);
          game.socket.emit(this.SOCKET_NAME, syncData);
          
          // Send direct message to target actor's owner to update their HUD
          this.notifyTargetActorOwner(data.targetId, true);
        } else {
          if (this.DEBUG) console.log(`%c[BonusManager] Non-GM user received applyBonus message, ignoring`, "color: #ffcc00");
        }
        break;
        
      case "removeBonus":
        if (isGM) {
          if (this.DEBUG) console.log(`%c[BonusManager] GM removing bonus from ${data.giverId} to ${data.targetId}: ${data.bonusType}`, "color: #ff9900");
          await this.updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, false);
          
          // Notify all clients to update UI
          const syncData = {
            type: "bonusAction",
            action: "syncUI",
            targetId: data.targetId,
            giverId: data.giverId,
            bonusType: data.bonusType,
            active: false
          };
          
          if (this.DEBUG) console.log(`%c[BonusManager] GM emitting syncUI to all clients`, "color: #33cc33", syncData);
          game.socket.emit(this.SOCKET_NAME, syncData);
          
          // Send direct message to target actor's owner to update their HUD
          this.notifyTargetActorOwner(data.targetId, false);
        } else {
          if (this.DEBUG) console.log(`%c[BonusManager] Non-GM user received removeBonus message, ignoring`, "color: #ffcc00");
        }
        break;
        
      case "syncUI":
        if (this.DEBUG) console.log(`%c[BonusManager] SyncUI received: ${data.giverId} → ${data.targetId}, ${data.bonusType}, active: ${data.active}`, "color: #6699ff");

        // Update checkbox state only if this client owns the giver actor
        const giverActor = game.actors.get(data.giverId);
        if (giverActor?.isOwner) {
          this.updateCheckboxState(data.giverId, data.targetId, data.bonusType, data.active);
        }
        break;
        
      case "updateTargetHUD":
        if (this.DEBUG) console.log(`%c[BonusManager] Received updateTargetHUD for actor ${data.targetId}`, "color: #6699ff");
        
        // Check if current user owns this actor
        const targetActor = game.actors.get(data.targetId);
        if (targetActor && targetActor.isOwner) {
          if (this.DEBUG) console.log(`%c[BonusManager] User owns target actor ${targetActor.name}, refreshing HUD`, "color: #33cc33");
          
          // Get HUD from registry
          const targetHud = globalThis.playerHudRegistry?.get(data.targetId);
          if (targetHud) {
            if (this.DEBUG) console.log(`%c[BonusManager] Found HUD for ${targetActor.name}, rendering`, "color: #33cc33");
            targetHud.render(true);
          } else {
            if (this.DEBUG) console.log(`%c[BonusManager] No HUD found for ${targetActor.name}`, "color: #ff9900");
          }
        }
        break;
        
      case "clearAllBonuses":
        if (isGM) {
          if (this.DEBUG) console.log(`%c[BonusManager] GM clearing all bonuses for ${data.actorId}`, "color: #ff6666");
          await this.clearActorBonuses(data.actorId);
          game.socket.emit(this.SOCKET_NAME, {
            type: "bonusAction",
            action: "refreshHUDs"
          });
        }
        break;
        
      case "refreshHUDs":
        if (this.DEBUG) console.log(`%c[BonusManager] Refreshing all HUDs for current user`, "color: #33cc33");
        this.refreshAllHUDs();
        break;
    }
  }
  
  /**
   * Send a message to the owner of the target actor to update their HUD
   */
  static notifyTargetActorOwner(targetActorId, isAddingBonus) {
    const targetActor = game.actors.get(targetActorId);
    if (!targetActor) return;
    
    if (this.DEBUG) console.log(`%c[BonusManager] Sending notification to owner of ${targetActor.name}`, "color: #33cc33");
    
    // Emit a socket message for the target actor owner to update their HUD
    game.socket.emit(this.SOCKET_NAME, {
      type: "bonusAction",
      action: "updateTargetHUD",
      targetId: targetActorId,
      bonusUpdate: isAddingBonus
    });
  }
  
  /**
   * Update actor bonuses (GM only)
   */
  static async updateActorBonuses(targetId, giverId, bonusType, amount, active) {
    if (!game.user.isGM) {
      if (this.DEBUG) console.log(`%c[BonusManager] Non-GM attempted to update actor bonuses, aborted`, "color: #ff6666");
      return;
    }
    
    const targetActor = game.actors.get(targetId);
    if (!targetActor) {
      if (this.DEBUG) console.log(`%c[BonusManager] Target actor ${targetId} not found`, "color: #ff6666");
      return;
    }
    
    // Get current bonuses
    const currentBonuses = targetActor.getFlag("mist-hud", "received-bonuses") || {};
    const updatedBonuses = foundry.utils.deepClone(currentBonuses);
    
    if (this.DEBUG) console.log(`%c[BonusManager] Current bonuses for ${targetActor.name}:`, "color: #33cc33", currentBonuses);
    
    if (active) {
      // Add or update bonus
      updatedBonuses[giverId] = {
        type: bonusType,
        amount: parseInt(amount),
        timestamp: Date.now(),
        sceneId: game.scenes.current?.id || "unknown"
      };
      if (this.DEBUG) console.log(`%c[BonusManager] Adding bonus to ${targetActor.name} from ${giverId}: ${bonusType} ${amount}`, "color: #33cc33");
    } else {
      // Remove bonus
      if (updatedBonuses[giverId]) {
        if (this.DEBUG) console.log(`%c[BonusManager] Removing bonus from ${targetActor.name} given by ${giverId}`, "color: #ff9900");
        delete updatedBonuses[giverId];
      } else {
        if (this.DEBUG) console.log(`%c[BonusManager] No bonus found to remove from ${targetActor.name} given by ${giverId}`, "color: #ff6666");
      }
    }
    
    // Update the actor flag
    if (Object.keys(updatedBonuses).length === 0) {
      if (this.DEBUG) console.log(`%c[BonusManager] No bonuses left, clearing flag for ${targetActor.name}`, "color: #ff9900");
      await targetActor.unsetFlag("mist-hud", "received-bonuses");
    } else {
      if (this.DEBUG) console.log(`%c[BonusManager] Updating actor flags for ${targetActor.name}:`, "color: #33cc33", updatedBonuses);
      await targetActor.setFlag("mist-hud", "received-bonuses", updatedBonuses);
    }
  }
  
  /**
   * Apply a bonus between characters (main entry point for players)
   */
  static async applyBonus(giverId, targetId, bonusType, amount, active) {
    if (!giverId || !targetId) {
      if (this.DEBUG) console.log(`%c[BonusManager] Missing required IDs: giverId=${giverId}, targetId=${targetId}`, "color: #ff6666");
      return;
    }
    
    if (this.DEBUG) {
      console.log(`%c[BonusManager] ${game.user.name} triggering ${active ? 'apply' : 'remove'} bonus:`, "color: #6699ff", {
        giverId, 
        targetId, 
        bonusType, 
        amount, 
        active,
        isGM: game.user.isGM
      });
    }
    
    // Store the checkbox state locally for consistency
    const checkboxKey = `${giverId}-${targetId}-${bonusType}`;
    globalThis.mistHudCheckboxStates.set(checkboxKey, active);
    
    if (this.DEBUG) console.log(`%c[BonusManager] Stored checkbox state: ${checkboxKey}=${active}`, "color: #33cc33");
    
    // Send socket message to GM
    const socketData = {
      type: "bonusAction",
      action: active ? "applyBonus" : "removeBonus",
      giverId,
      targetId,
      bonusType,
      amount
    };
    
    if (this.DEBUG) console.log(`%c[BonusManager] Emitting socket message:`, "color: #33cc33", socketData);
    game.socket.emit(this.SOCKET_NAME, socketData);
    
    // If GM, process directly
    if (game.user.isGM) {
      if (this.DEBUG) console.log(`%c[BonusManager] User is GM, processing bonus update directly`, "color: #33cc33");
      await this.updateActorBonuses(targetId, giverId, bonusType, amount, active);
      
      // GM should also update the target actor's HUD if they own it
      const targetActor = game.actors.get(targetId);
      if (targetActor && targetActor.isOwner) {
        await this.refreshTargetHUD(targetId);
      }
    } else {
      if (this.DEBUG) console.log(`%c[BonusManager] User is not GM, waiting for GM to process`, "color: #ffcc00");
    }
  }
  
  /**
   * Update checkbox states in the UI
   */
  static updateCheckboxState(giverId, targetId, bonusType, checked) {
    const checkboxClass = bonusType === "help" ? ".help-toggle" : ".hurt-toggle";
    const selector = `${checkboxClass}[data-actor-id="${giverId}"][data-target-id="${targetId}"]`;
    
    // Get locally tracked state (if any)
    const checkboxKey = `${giverId}-${targetId}-${bonusType}`;
    const localState = globalThis.mistHudCheckboxStates.get(checkboxKey);
    
    // Only update if we don't have a local state or it matches the incoming state
    if (localState === undefined || localState === checked) {
      if (this.DEBUG) console.log(`%c[BonusManager] Updating checkboxes with selector: ${selector}, value: ${checked}`, "color: #6699ff");
      
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        if (this.DEBUG) console.log(`%c[BonusManager] No checkboxes found matching selector: ${selector}`, "color: #ff9900");
      } else {
        if (this.DEBUG) console.log(`%c[BonusManager] Found ${elements.length} checkboxes to update`, "color: #33cc33");
        
        elements.forEach(element => {
          element.checked = checked;
          if (this.DEBUG) console.log(`%c[BonusManager] Updated checkbox:`, "color: #33cc33", element);
        });
      }
    } else {
      if (this.DEBUG) console.log(`%c[BonusManager] Skipping checkbox update: local state=${localState}, incoming state=${checked}`, "color: #ff9900");
    }
  }
  
  /**
   * Refresh a specific actor's HUD
   */
  static refreshTargetHUD(actorId) {
    if (this.DEBUG) console.log(`%c[BonusManager] Refreshing HUD for actor ${actorId}`, "color: #6699ff");
    
    const actor = game.actors.get(actorId);
    if (!actor) {
      if (this.DEBUG) console.log(`%c[BonusManager] Actor ${actorId} not found`, "color: #ff6666");
      return;
    }

    // Only refresh HUD if the actor is owned by current user
    if (!actor.isOwner) {
      if (this.DEBUG) console.log(`%c[BonusManager] Current user is not owner of ${actor.name}, skipping HUD refresh`, "color: #ff9900");
      return;
    }

    // Get HUD from registry
    const targetHud = globalThis.playerHudRegistry?.get(actorId);
    
    if (!targetHud) {
      if (this.DEBUG) console.log(`%c[BonusManager] No HUD found for actor ${actor.name}`, "color: #ff9900");
      return;
    }
    
    if (this.DEBUG) console.log(`%c[BonusManager] Rendering HUD for ${actor.name}`, "color: #33cc33");
    targetHud.render(true);
  }
  
  /**
   * Refresh all HUDs for actors owned by the current user
   */
  static refreshAllHUDs() {
    if (this.DEBUG) console.log(`%c[BonusManager] Refreshing all HUDs for current user`, "color: #33cc33");
    
    // Only refresh HUDs from registry
    if (globalThis.playerHudRegistry) {
      const registryCount = globalThis.playerHudRegistry.size;
      if (this.DEBUG) console.log(`%c[BonusManager] Found ${registryCount} HUDs in registry`, "color: #6699ff");
      
      for (const [actorId, hud] of globalThis.playerHudRegistry.entries()) {
        const actor = game.actors.get(actorId);
        if (actor && actor.isOwner) {
          if (this.DEBUG) console.log(`%c[BonusManager] Rendering HUD for ${actor.name} from registry`, "color: #33cc33");
          hud.render(true);
        }
      }
    } else {
      if (this.DEBUG) console.log(`%c[BonusManager] No HUD registry found`, "color: #ff9900");
    }
  }
  
  /**
   * Clear all bonuses for an actor (GM only)
   */
  static async clearActorBonuses(actorId) {
    if (!game.user.isGM) {
      if (this.DEBUG) console.log(`%c[BonusManager] Non-GM attempted to clear bonuses, aborted`, "color: #ff6666");
      return;
    }
    
    const actor = game.actors.get(actorId);
    if (!actor) return;
    
    await actor.unsetFlag("mist-hud", "received-bonuses");
    if (this.DEBUG) console.log(`%c[BonusManager] Cleared all bonuses for ${actor.name}`, "color: #33cc33");
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
    if (!actor) {
      if (this.DEBUG) console.log(`%c[BonusManager] Cannot calculate total bonus: actor ${actorId} not found`, "color: #ff6666");
      return 0;
    }
    
    const bonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
    let helpTotal = 0;
    let hurtTotal = 0;
    
    if (this.DEBUG) console.log(`%c[BonusManager] Calculating total bonus for ${actor.name}:`, "color: #6699ff", bonuses);
    
    Object.values(bonuses).forEach(bonus => {
      if (bonus.type === "help") {
        helpTotal += bonus.amount;
      } else if (bonus.type === "hurt") {
        hurtTotal += bonus.amount;
      }
    });
    
    const total = helpTotal - hurtTotal;
    if (this.DEBUG) console.log(`%c[BonusManager] Total bonus for ${actor.name}: Help=${helpTotal}, Hurt=${hurtTotal}, Net=${total}`, "color: #33cc33");
    
    return total;
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