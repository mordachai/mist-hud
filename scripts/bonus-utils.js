// bonus-utils.js - Enhanced character-centric implementation
import { getImprovements } from "./mh-getters.js";
import { getCrewImprovements } from "./mh-getters.js";
import { MistHUD } from "./mist-hud.js";

/**
 * Checks if the move roll should be treated as Dynamite.
 * The dynamite roll is only triggered if:
 *  - The move matches an improvement (by abbreviation or selectable move name)
 *  - AND an activated tag from the corresponding theme is selected.
 *
 * @param {Actor} actor - The actor rolling the move.
 * @param {Object} move - The move config object (from moveConfig) being rolled.
 * @returns {boolean} - Returns true if dynamite should be enabled.
 */
export function checkRolls(actor, move, hud) {
  if (!actor || !move) return false;

  const moveAbbr = move.abbreviation;
  // Use the literal move name if provided; otherwise, fall back to move.name
  const moveKey = move.configKey || move.name;

  // Get improvements from actor and crew
  const improvementGroups = getImprovements(actor);
  const crewImprovementGroups = getCrewImprovements(actor);
  const actorImprovements = improvementGroups.reduce((arr, group) => arr.concat(group.improvements), []);
  const crewImprovements = crewImprovementGroups.reduce((arr, group) => arr.concat(group.improvements), []);
  const allImprovements = [...actorImprovements, ...crewImprovements];

  // Retrieve selected roll data from the MistHUD
  const rollData = hud.getSelectedRollData();

  // Combine power, crew power, and loadout tags
  const activatedTags = [
    ...(rollData.powerTags || []),
    ...(rollData.crewPowerTags || []),
    ...(rollData.loadoutTags || [])
  ];

  // Helper: Check if any activated tag belongs to the given themeId.
  // This assumes each tag object includes a property "themeId".
  const hasActivatedThemeTag = (themeId) => {
    const result = activatedTags.some(tag => {
      if (!tag.themeId) {
        return false;
      }
      return tag.themeId === themeId;
    });
    return result;
  };

  // Iterate over all improvements to see if any force Dynamite for this move.
  for (const improvement of allImprovements) {
    // Expect each improvement to include effect_class and theme_id from its system data.
    const effectClass = improvement.effect_class || (improvement.system && improvement.system.effect_class);
    const themeId = improvement.theme_id || (improvement.system && improvement.system.theme_id);
    if (!effectClass) continue;

    // Case 1: Always Dynamite for this move (ignores tag selection).
    if (effectClass.startsWith("ALWAYS_DYN_") && effectClass.endsWith(moveAbbr)) {
      return true;
    }

    // For improvements tied to a specific theme, require that at least one tag from that theme is activated.
    if (themeId && !hasActivatedThemeTag(themeId)) {
      continue;
    }

    // Case 2: Specific theme improvement keyed by move abbreviation.
    if (effectClass === `THEME_DYN_${moveAbbr}`) {
      return true;
    }

    // Case 3: Generic selectable dynamite improvement.
    // Compare the literal move key with the improvement's choice_item.
    const choiceItem = (improvement.choiceItem || (improvement.system && improvement.system.choice_item)) || "";
    if (effectClass === "THEME_DYN_SELECT" && choiceItem === moveKey) {
      return true;
    }
  }

  return false;
}

/**
 * BonusManager handles character-to-character help/hurt bonuses
 * Ensures reliable bonus tracking regardless of which user controls the characters
 */
export class BonusManager {
  static BONUS_SOCKET_EVENT = "module.mist-hud.bonus";
  static initialized = false;

  /**
   * Initialize the BonusManager
   */
  static init() {
    if (this.initialized) return;
    
    // Register a dedicated socket event for bonus handling
    game.socket.on(this.BONUS_SOCKET_EVENT, (data) => {
      BonusManager.handleSocketMessage(data);
    });
    
    // Add a new hook for when tokens are deleted
    Hooks.on("deleteToken", (tokenDoc) => {
      if (tokenDoc.actor) {
        BonusManager.handleTokenDeletion(tokenDoc);
      }
    });
    
    // Add a hook for scene changes
    Hooks.on("canvasReady", () => {
      BonusManager.verifySceneBonuses();
    });
    
    console.log("MistHUD: BonusManager initialized");
    this.initialized = true;
  }
  
  /**
   * Handle socket messages for bonuses
   * @param {Object} data - The message data
   */
  static async handleSocketMessage(data) {
    if (!data || !data.action) return;
    
    switch (data.action) {
      case "applyBonus":
        await BonusManager.updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, true);
        break;
        
      case "removeBonus":
        await BonusManager.updateActorBonuses(data.targetId, data.giverId, data.bonusType, data.amount, false);
        break;
        
      case "syncUI":
        BonusManager.updateCheckboxState(data.giverId, data.targetId, data.bonusType, data.active);
        break;
        
      case "clearAllBonuses":
        await BonusManager.clearActorBonuses(data.actorId);
        break;
    }
  }
  
  /**
   * Update the actor's bonuses
   * @param {string} targetId - The ID of the actor receiving the bonus
   * @param {string} giverId - The ID of the actor giving the bonus
   * @param {string} bonusType - The type of bonus ("help" or "hurt")
   * @param {number} amount - The amount of the bonus
   * @param {boolean} active - Whether to add or remove the bonus
   */
  static async updateActorBonuses(targetId, giverId, bonusType, amount, active) {
    const targetActor = game.actors.get(targetId);
    if (!targetActor || !targetActor.isOwner) return;
    
    // Get current bonuses
    const currentBonuses = targetActor.getFlag("mist-hud", "received-bonuses") || {};
    
    if (active) {
      // Add or update bonus
      currentBonuses[giverId] = {
        type: bonusType,
        amount: parseInt(amount),
        timestamp: Date.now(),
        sceneId: game.scenes.current?.id || "unknown",
        tokenId: game.actors.get(giverId)?.token?.id || null
      };
      
      console.log(`MistHUD: Added ${bonusType} bonus of ${amount} from ${game.actors.get(giverId)?.name} to ${targetActor.name}`);
    } else {
      // Remove bonus
      delete currentBonuses[giverId];
      console.log(`MistHUD: Removed bonus from ${game.actors.get(giverId)?.name} to ${targetActor.name}`);
    }
    
    // Update actor flag
    await targetActor.setFlag("mist-hud", "received-bonuses", currentBonuses);
    
    // Update any open HUDs for this actor
    const actorHud = globalThis.playerHudRegistry?.get(targetId);
    if (actorHud) {
      actorHud.render(true);
    }
  }
  
  /**
   * Apply a bonus from one character to another
   * @param {string} giverId - ID of the character giving the bonus
   * @param {string} targetId - ID of the character receiving the bonus
   * @param {string} bonusType - Type of bonus ('help' or 'hurt')
   * @param {number} amount - Amount of the bonus
   * @param {boolean} active - Whether to add or remove the bonus
   */
  static async applyBonus(giverId, targetId, bonusType, amount, active) {
    if (!giverId || !targetId) {
      console.error("MistHUD: Missing actor IDs for bonus application", { giverId, targetId });
      return;
    }
    
    const messageData = {
      action: active ? "applyBonus" : "removeBonus",
      giverId,
      targetId,
      bonusType,
      amount,
      userId: game.user.id
    };
    
    // Send the socket message
    game.socket.emit(this.BONUS_SOCKET_EVENT, messageData);
    
    // Also handle locally if we own the target actor
    const targetActor = game.actors.get(targetId);
    if (targetActor && targetActor.isOwner) {
      await this.updateActorBonuses(targetId, giverId, bonusType, amount, active);
    }
    
    // Send UI sync message to update checkbox state for all clients
    game.socket.emit(this.BONUS_SOCKET_EVENT, {
      action: "syncUI",
      giverId,
      targetId,
      bonusType,
      active
    });
    
    // Update local UI
    this.updateCheckboxState(giverId, targetId, bonusType, active);
  }
  
  /**
   * Clear all bonuses for an actor
   * @param {string} actorId - The actor ID
   */
  static async clearActorBonuses(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor || !actor.isOwner) return;
    
    // First, get existing bonuses to properly update UI elements
    const currentBonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
    
    // Remove the flag
    await actor.unsetFlag("mist-hud", "received-bonuses");
    
    // Notify about UI updates
    for (const giverId in currentBonuses) {
      const bonus = currentBonuses[giverId];
      this.updateCheckboxState(giverId, actorId, bonus.type, false);
    }
    
    // Update any open HUDs
    const actorHud = globalThis.playerHudRegistry?.get(actorId);
    if (actorHud) {
      actorHud.render(true);
    }
  }
  
  /**
   * Clear all bonuses for an actor and notify other clients
   * @param {string} actorId - The actor ID
   */
  static async clearAllBonuses(actorId) {
    // Send socket message first
    game.socket.emit(this.BONUS_SOCKET_EVENT, {
      action: "clearAllBonuses",
      actorId
    });
    
    // Then handle locally
    await this.clearActorBonuses(actorId);
  }
  
  /**
   * Update checkbox state in the UI
   * @param {string} giverId - The giver actor ID
   * @param {string} targetId - The target actor ID
   * @param {string} bonusType - The bonus type
   * @param {boolean} checked - Whether the checkbox should be checked
   */
  static updateCheckboxState(giverId, targetId, bonusType, checked) {
    const checkboxClass = bonusType === "help" ? ".help-toggle" : ".hurt-toggle";
    const selector = `${checkboxClass}[data-actor-id="${giverId}"][data-target-id="${targetId}"]`;
    
    document.querySelectorAll(selector).forEach(element => {
      element.checked = checked;
    });
  }
  
  /**
   * Handle token deletion by removing associated bonuses
   * @param {TokenDocument} tokenDoc - The deleted token document
   */
  static async handleTokenDeletion(tokenDoc) {
    const actorId = tokenDoc.actor?.id;
    if (!actorId) return;
    
    // Check if this actor has given any bonuses and remove them
    for (const actor of game.actors.contents) {
      const bonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
      
      if (bonuses[actorId]) {
        // This actor received a bonus from the deleted actor, remove it
        const updatedBonuses = foundry.utils.deepClone(bonuses);
        delete updatedBonuses[actorId];
        
        if (actor.isOwner) {
          await actor.setFlag("mist-hud", "received-bonuses", updatedBonuses);
          
          // Update any open HUDs
          const actorHud = globalThis.playerHudRegistry?.get(actor.id);
          if (actorHud) {
            actorHud.render(true);
          }
        }
      }
    }
    
    // Also clear all bonuses this actor received (they're gone now)
    if (tokenDoc.actor?.isOwner) {
      await this.clearActorBonuses(actorId);
    }
  }
  
  /**
   * Verify and clean up bonuses when changing scenes
   * Only keeps bonuses from tokens in the current scene
   */
  static async verifySceneBonuses() {
    const currentSceneId = game.scenes.current?.id;
    if (!currentSceneId) return;
    
    // Get all actor IDs present in the current scene
    const sceneActorIds = new Set();
    canvas.tokens.placeables.forEach(token => {
      if (token.actor) {
        sceneActorIds.add(token.actor.id);
      }
    });
    
    // Check each actor the user owns
    for (const actor of game.actors.contents) {
      if (!actor.isOwner) continue;
      
      const bonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
      let changed = false;
      const updatedBonuses = foundry.utils.deepClone(bonuses);
      
      // Remove bonuses from actors not in the current scene
      for (const giverId in updatedBonuses) {
        if (!sceneActorIds.has(giverId)) {
          delete updatedBonuses[giverId];
          changed = true;
        }
      }
      
      // Update if changes were made
      if (changed) {
        await actor.setFlag("mist-hud", "received-bonuses", updatedBonuses);
        
        // Update any open HUDs
        const actorHud = globalThis.playerHudRegistry?.get(actor.id);
        if (actorHud) {
          actorHud.render(true);
        }
      }
    }
  }
  
  /**
   * Calculate the total bonus value (help - hurt) for an actor
   * @param {string} actorId - The actor ID
   * @returns {number} - The total bonus value
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
 * Enhanced version of getReceivedBonuses that provides detailed bonus information
 * @param {Actor} actor - The actor to get bonuses for
 * @returns {Array} - Array of bonus details
 */
export function getReceivedBonuses(actor) {
  if (!actor) return [];
  
  const receivedBonuses = actor.getFlag("mist-hud", "received-bonuses") || {};
  const result = [];
  
  for (const giverId in receivedBonuses) {
    const bonus = receivedBonuses[giverId];
    const giverActor = game.actors.get(giverId);
    
    if (giverActor) {
      // Get token image (with fallbacks)
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

// Initialize the BonusManager when the module is loaded
Hooks.once("ready", () => {
  BonusManager.init();
});