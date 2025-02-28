// scripts/npc-influence-manager.js

// Create a simple logger
const logger = {
    debug: (...args) => console.debug("NPC-Manager |", ...args),
    info: (...args) => console.info("NPC-Manager |", ...args),
    warn: (...args) => console.warn("NPC-Manager |", ...args),
    error: (...args) => console.error("NPC-Manager |", ...args)
};

/**
 * NPC Influence Manager
 * A utility for GM to manage NPC influences across scenes
 * @class
 * @extends {Application}
 */
export class NPCInfluenceManager extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'npc-influence-manager',
      title: 'NPC Influence Manager',
      template: 'modules/mist-hud/templates/npc-influence-manager.hbs',
      width: 550,
      height: 'auto',
      resizable: true,
      minimizable: true,
      classes: ['mist-hud', 'npc-influence-manager'],
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'scene' }]
    });
  }

  /**
   * Get data for template rendering with token awareness
   * @returns {Object} Template data
   */
  async getData() {
    // Get current scene
    const currentScene = canvas.scene;
    
    // Get all NPCs with active influence (from all scenes)
    const allInfluences = Object.values(globalThis.activeNpcInfluences || {});
    
    // Get all tokens in the current scene
    const sceneTokens = canvas.tokens.placeables
      .filter(t => t.actor && t.actor.type === 'threat');
    
    // Create a map of tokens to their influences
    const tokenInfluenceMap = new Map();
    
    // Process each token in the scene
    for (const token of sceneTokens) {
      // For unlinked tokens, look for influence by token ID first
      if (!token.document.actorLink && globalThis.activeNpcInfluences[token.id]) {
        tokenInfluenceMap.set(token, globalThis.activeNpcInfluences[token.id]);
      } 
      // For linked tokens or as fallback, check actor ID
      else if (globalThis.activeNpcInfluences[token.actor.id]) {
        tokenInfluenceMap.set(token, globalThis.activeNpcInfluences[token.actor.id]);
      }
    }
    
    // Get scene influences from the map
    const sceneInfluences = Array.from(tokenInfluenceMap.values());
    
    // Calculate total influence FOR THE CURRENT SCENE ONLY
    const totalInfluence = sceneInfluences.reduce((sum, infl) => {
      return sum + (Number(infl.totalInfluence) || 0);
    }, 0);
    
    // Build data structure for the template
    const sceneNpcData = [];
    const sceneActorIds = new Set(); // Track actor IDs to avoid duplicating linked actors
    
    // Process each token in the scene
    for (const token of sceneTokens) {
      const hasInfluence = tokenInfluenceMap.has(token);
      const influence = hasInfluence ? tokenInfluenceMap.get(token) : null;
      
      // For linked actors, only add once
      if (token.document.actorLink) {
        if (sceneActorIds.has(token.actor.id)) continue;
        sceneActorIds.add(token.actor.id);
      }
      
      sceneNpcData.push({
        id: token.actor.id,
        tokenId: token.id,
        name: token.name || token.actor.name,
        img: token.document.texture.src || token.actor.img || 'icons/svg/mystery-man.svg',
        hasInfluence: hasInfluence,
        isLinked: token.document.actorLink,
        influence: influence ? influence.totalInfluence : 0,
        tagInfluence: influence ? influence.tagInfluence : 0,
        statusInfluence: influence ? influence.statusInfluence : 0,
        isInCurrentScene: true,
        hasDetails: !!(influence && 
                    (influence.influentialTags?.length || 
                    influence.influentialStatuses?.length))
      });
    }
    
    // Get all influences (including from other scenes)
    const allNpcData = [];
    const processedIds = new Set(); // Track what we've already added
    
    // First, add all tokens from the current scene
    for (const npc of sceneNpcData) {
      allNpcData.push(npc);
      // Mark these as processed (using token ID for unlinked, actor ID for linked)
      if (npc.isLinked) {
        processedIds.add(npc.id);
      } else {
        processedIds.add(npc.tokenId);
      }
    }
    
    // Then add any other influences not already included
    for (const [id, influence] of Object.entries(globalThis.activeNpcInfluences)) {
      // Skip if we already included this entity
      if (processedIds.has(id)) continue;
      
      // Determine if this is a token or actor ID
      const isToken = id.includes('.');
      const actor = isToken ? null : game.actors.get(id);
      
      if (actor) {
        // This is an actor-based influence
        allNpcData.push({
          id: actor.id,
          tokenId: null,
          name: actor.name,
          img: actor.img || 'icons/svg/mystery-man.svg',
          hasInfluence: true,
          isLinked: true,
          influence: influence.totalInfluence,
          tagInfluence: influence.tagInfluence,
          statusInfluence: influence.statusInfluence,
          isInCurrentScene: false,
          hasDetails: !!(influence.influentialTags?.length || 
                        influence.influentialStatuses?.length)
        });
        processedIds.add(actor.id);
      } else if (isToken) {
        // This is a token-based influence
        allNpcData.push({
          id: influence.npcId,
          tokenId: id,
          name: influence.tokenName || influence.npcName,
          img: 'icons/svg/mystery-man.svg', // Default image for tokens not in scene
          hasInfluence: true,
          isLinked: false,
          influence: influence.totalInfluence,
          tagInfluence: influence.tagInfluence,
          statusInfluence: influence.statusInfluence,
          isInCurrentScene: false,
          hasDetails: !!(influence.influentialTags?.length || 
                        influence.influentialStatuses?.length)
        });
        processedIds.add(id);
      }
    }
    
    // Filter into active NPCs and active scene NPCs
    const activeNpcs = allNpcData.filter(npc => npc.hasInfluence);
    const activeSceneNpcs = sceneNpcData.filter(npc => npc.hasInfluence);
    
    return {
      totalInfluence,
      currentSceneName: currentScene?.name || "No Active Scene",
      activeNpcs,
      sceneNpcs: sceneNpcData,
      allNpcs: allNpcData,
      activeSceneNpcs,
      hasActiveNpcs: activeNpcs.length > 0,
      hasSceneNpcs: sceneNpcData.length > 0,
      hasAllNpcs: allNpcData.length > 0,
      hasActiveSceneNpcs: activeSceneNpcs.length > 0,
      isGM: game && game.user ? game.user.isGM : false
    };
  }
  
  /**
   * Set up event listeners
   * @param {jQuery} html The form html
   */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Sync All button
    html.find('.sync-all-npcs').click(this._onSyncAll.bind(this));
    
    // Toggle NPC influence buttons
    html.find('.toggle-influence').click(this._onToggleInfluence.bind(this));
    
    // View details button
    html.find('.view-details').click(this._onViewDetails.bind(this));
    
    // Clear All button
    html.find('.clear-all-influences').click(this._onClearAll.bind(this));
    
    // Refresh UI button
    html.find('.refresh-ui').click(() => this.render(true));
  }
  
  /**
   * Handle sync all button click with token awareness
   * @param {Event} event The click event
   */
  async _onSyncAll(event) {
    event.preventDefault();
    
    if (!game || !game.user || !game.user.isGM) {
      ui.notifications.warn("Only the GM can synchronize NPC influences");
      return;
    }
    
    ui.notifications.info("Synchronizing NPCs in current scene...");
    
    try {
      // Try to import the syncTokenInfluences function
      const { syncTokenInfluences } = await import('./npc-influence-functions.js');
      const syncCount = await syncTokenInfluences();
      ui.notifications.info(`Synchronized ${syncCount} NPCs in current scene`);
    } catch (error) {
      logger.error("Failed to sync influences:", error);
      ui.notifications.error("Error synchronizing influences");
      
      // Fallback implementation
      // Find all threat-type tokens in the current scene
      const tokens = canvas.tokens.placeables.filter(t => t.actor && t.actor.type === 'threat');
      let syncCount = 0;
      
      for (const token of tokens) {
        try {
          // Get or create NPC HUD
          const NpcHUD = game.modules.get("mist-hud").api?.NpcHUD || globalThis.NpcHUD;
          if (!NpcHUD) continue;
          
          let npcHud = globalThis.npcHudRegistry?.get(token.id) || 
                      globalThis.npcHudRegistry?.get(token.actor.id);
                      
          if (!npcHud) {
            npcHud = new NpcHUD();
            npcHud.setActor(token.actor, token);
          }
          
          // Emit influence
          if (typeof npcHud.emitNpcInfluence === 'function') {
            await npcHud.emitNpcInfluence();
            syncCount++;
          }
        } catch (e) {
          console.error(`Error syncing token ${token.id}:`, e);
        }
      }
      
      ui.notifications.info(`Synchronized ${syncCount} NPCs in current scene`);
    }
    
    this.render(true);
  }
  
  /**
   * Handle toggle influence button click with token awareness
   * @param {Event} event The click event
   */
  async _onToggleInfluence(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    const tokenId = event.currentTarget.dataset.tokenId;
    const isLinked = event.currentTarget.dataset.isLinked === 'true';
    
    // Determine which ID to use for lookup
    const lookupId = !isLinked && tokenId ? tokenId : actorId;
    
    // Get actor
    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error("NPC not found");
      return;
    }
    
    // Get token if available
    const token = tokenId ? canvas.tokens.get(tokenId) : null;
    
    const hasInfluence = event.currentTarget.dataset.hasInfluence === 'true';
    
    if (hasInfluence) {
      // Remove from influence cache
      if (globalThis.activeNpcInfluences[lookupId]) {
        delete globalThis.activeNpcInfluences[lookupId];
        
        // Notify all clients
        game.socket.emit('module.mist-hud', {
          type: 'npcInfluence',
          action: 'delete',
          npcId: actorId,
          tokenId: tokenId,
          npcName: token?.name || actor.name
        });
        
        ui.notifications.info(`Removed ${token?.name || actor.name}'s influence`);
      }
    } else {
      // Find or create a HUD for this token/actor
      try {
        const NpcHUD = game.modules.get("mist-hud").api?.NpcHUD || globalThis.NpcHUD;
        if (!NpcHUD) {
          logger.error("NpcHUD class not found");
          ui.notifications.error("Error: NpcHUD class not found");
          return;
        }
        
        // Check registry
        let npcHud = tokenId ? globalThis.npcHudRegistry?.get(tokenId) : null;
        if (!npcHud) npcHud = globalThis.npcHudRegistry?.get(actorId);
        
        if (!npcHud) {
          // Create a temporary HUD
          npcHud = new NpcHUD();
          npcHud.setActor(actor, token);
        }
        
        // Calculate and emit influence
        if (typeof npcHud.emitNpcInfluence === 'function') {
          npcHud.emitNpcInfluence();
          ui.notifications.info(`Added ${token?.name || actor.name}'s influence`);
        } else {
          logger.error(`NPC HUD doesn't have emitNpcInfluence method`);
          ui.notifications.error("Error calculating influence");
        }
      } catch (error) {
        logger.error("Failed to create NPC HUD:", error);
        ui.notifications.error("Error adding influence");
      }
    }
    
    this.render(true);
  }
  
  /**
   * Handle view details button click
   * @param {Event} event The click event
   */
  _onViewDetails(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    const influence = globalThis.activeNpcInfluences[actorId];
    
    if (!influence) {
      ui.notifications.warn("No influence details found");
      return;
    }
    
    // Create a formatted HTML content for the dialog
    let content = `<h2>${influence.npcName}</h2>`;
    content += `<p><strong>Total Influence:</strong> ${influence.totalInfluence}</p>`;
    content += `<p><strong>Tag Influence:</strong> ${influence.tagInfluence}</p>`;
    content += `<p><strong>Status Influence:</strong> ${influence.statusInfluence}</p>`;
    
    // Show influential tags
    if (influence.influentialTags && influence.influentialTags.length > 0) {
      content += `<h3>Influential Tags</h3><ul>`;
      influence.influentialTags.forEach(tag => {
        const type = tag.tagFlag === 'positive' ? 'Positive' : 'Negative';
        content += `<li><strong>${tag.tagName}</strong>: ${type} (${tag.tagFlag === 'positive' ? '+1' : '-1'})</li>`;
      });
      content += `</ul>`;
    }
    
    // Show influential statuses
    if (influence.influentialStatuses && influence.influentialStatuses.length > 0) {
      content += `<h3>Influential Statuses</h3><ul>`;
      influence.influentialStatuses.forEach(status => {
        const effect = status.statusType === 'positive' ? `+${status.statusTier}` : `-${status.statusTier}`;
        content += `<li><strong>${status.statusName}-${status.statusTier}</strong>: ${status.statusType} (${effect})</li>`;
      });
      content += `</ul>`;
    }
    
    // Show in dialog
    new Dialog({
      title: "NPC Influence Details",
      content: content,
      buttons: {
        close: {
          label: "Close"
        },
        edit: {
          label: "Edit NPC",
          callback: () => {
            const actor = game.actors.get(actorId);
            if (actor) actor.sheet.render(true);
          }
        }
      },
      default: "close",
      width: 400
    }).render(true);
  }
  
  /**
   * Handle clear all button click
   * @param {Event} event The click event
   */
  _onClearAll(event) {
    event.preventDefault();
    
    if (!game || !game.user || !game.user.isGM) {
      ui.notifications.warn("Only the GM can clear all NPC influences");
      return;
    }
    
    new Dialog({
      title: "Clear All NPC Influences",
      content: "<p>Are you sure you want to remove all NPC influences? This will affect all players' rolls.</p>",
      buttons: {
        yes: {
          label: "Yes, Clear All",
          callback: () => this._clearAllInfluences()
        },
        no: {
          label: "Cancel"
        }
      },
      default: "no"
    }).render(true);
  }
  
  /**
   * Clear all influences
   * @private
   */
  _clearAllInfluences() {
    const npcIds = Object.keys(globalThis.activeNpcInfluences);
    
    // Clear global cache
    globalThis.activeNpcInfluences = {};
    
    // Notify all clients about each deleted influence
    for (const npcId of npcIds) {
      game.socket.emit('module.mist-hud', {
        type: 'npcInfluence',
        action: 'delete',
        npcId
      });
    }
    
    ui.notifications.info(`Cleared influences for ${npcIds.length} NPCs`);
    this.render(true);
  }
}

// Add scene change listener for managers
Hooks.on('canvasReady', () => {
  // Find and update any open influence managers
  Object.values(ui.windows)
    .filter(w => w instanceof NPCInfluenceManager)
    .forEach(w => w.render(false));
});

// Create a macro when the module is ready
Hooks.once('ready', () => {
  // Add a macro to the macro directory if it doesn't exist (for GMs only)
  // Make sure game and game.user are available
  if (!game || !game.user) return;

  if (game.user.isGM) {
    // Check if macro already exists
    const existingMacro = game.macros.find(m => 
      m.name === "NPC Influence Manager" && 
      m.command.includes("openNPCInfluenceManager")
    );
    
    if (!existingMacro) {
      Macro.create({
        name: "NPC Influence Manager",
        type: "script",
        img: "icons/creatures/unholy/demons-horned-glowing-pink.webp",
        command: "openNPCInfluenceManager();",
        flags: {
          "mist-hud": {
            description: "Opens the NPC Influence Manager to control which NPCs affect player rolls"
          }
        }
      }).then(macro => {
        logger.info("Created NPC Influence Manager macro");
      }).catch(error => {
        logger.error("Failed to create macro:", error);
      });
    }
  }
});
