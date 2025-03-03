/**
 * Simplified NPC Influence Manager
 * A utility for GM to view NPC influences across scenes
 * @class
 * @extends {Application}
 */

// Add this to your main module file (mist-hud.js or similar)

// Global function to open the NPC Influence Manager
game.mistHud = game.mistHud || {};
game.mistHud.openNPCInfluenceManager = async function() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can open the NPC Influence Manager");
    return;
  } 
  
  // Array of possible paths to try
  const paths = [
    '/modules/mist-hud/npc-influence-manager.js',
    '/modules/mist-hud/scripts/npc-influence-manager.js'
  ];
  
  let success = false;
  
  // Try each path in order
  for (const path of paths) {
    try {
      const module = await import(path);
      if (module && module.NPCInfluenceManager) {
        new module.NPCInfluenceManager().render(true);
        success = true;
        break;
      }
    } catch (e) {
      console.warn(`Could not load manager from ${path}`, e);
      // Continue to the next path
    }
  }
  
  // If no imports worked, try to find an existing instance
  if (!success) {
    const existingManager = Object.values(ui.windows).find(w => 
      w.constructor.name === "NPCInfluenceManager" || w.id === "npc-influence-manager"
    );
    
    if (existingManager) {
      existingManager.render(true);
      success = true;
    }
  }
  
  // If all else fails
  if (!success) {
    ui.notifications.error("Could not find or load the NPC Influence Manager");
  }
};

// Also register it as a global for convenience
globalThis.openNPCInfluenceManager = game.mistHud.openNPCInfluenceManager;

export class NPCInfluenceManager extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'npc-influence-manager',
      title: 'NPC Influence Viewer',
      template: 'modules/mist-hud/templates/npc-influence-manager.hbs',
      width: 550,
      height: 'auto',
      resizable: true,
      minimizable: true,
      classes: ['mist-hud', 'npc-influence-manager'],
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'all' }]
    });
  }

  /**
   * Get data for template rendering
   * @returns {Object} Template data
   */
  async getData() {
    // Get current scene
    const currentScene = canvas.scene;
    
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
    
    // Build data structure for the template - only for tokens in the scene
    const sceneNpcData = [];
    const sceneActorIds = new Set(); // Track actor IDs to avoid duplicating linked actors
    
    // Process each token in the scene
    for (const token of sceneTokens) {
      // Calculate influence directly from the token's current state
      // This ensures we have the most up-to-date influence values
      const calculatedInfluence = this._calculateTokenInfluence(token);
      
      // Check if there's cached influence data
      const hasInfluence = tokenInfluenceMap.has(token);
      const cachedInfluence = hasInfluence ? tokenInfluenceMap.get(token) : null;
      
      // Use calculated values as the primary source, fall back to cached values
      const influence = calculatedInfluence.totalInfluence || (cachedInfluence ? cachedInfluence.totalInfluence : 0);
      const tagInfluence = calculatedInfluence.tagInfluence || (cachedInfluence ? cachedInfluence.tagInfluence : 0);
      const statusInfluence = calculatedInfluence.statusInfluence || (cachedInfluence ? cachedInfluence.statusInfluence : 0);
      
      // Get collective size from actor system
      const collectiveSize = Number(token.actor.system.collectiveSize || token.actor.system.scale || 0);
      
      // Get all tags and statuses for this actor
      const tags = token.actor.items.filter(item => item.type === 'tag');
      const statuses = token.actor.items.filter(item => item.type === 'status');
      
      // Process tags to get their states
      const processedTags = tags.map(tag => {
        const tagState = tag.getFlag('mist-hud', 'tagState') || 'neutral';
        const isBurned = tag.system.burn_state === 1 || tag.system.burned;
        
        return {
          id: tag.id,
          name: tag.name,
          state: tagState,
          isBurned: isBurned
        };
      });
      
      // Process statuses to get their states and tiers
      const processedStatuses = statuses.map(status => {
        const statusType = status.getFlag('mist-hud', 'statusType') || status.system.specialType || 'neutral';
        const tier = Number(status.system.tier) || 1;
        
        return {
          id: status.id,
          name: status.name,
          state: statusType,
          tier: tier
        };
      });
      
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
        hasInfluence: hasInfluence || (influence !== 0),
        isLinked: token.document.actorLink,
        influence: influence,
        tagInfluence: tagInfluence,
        statusInfluence: statusInfluence,
        collectiveSize: collectiveSize,
        hasCollectiveSize: collectiveSize > 0,
        isInCurrentScene: true,
        tags: processedTags,
        statuses: processedStatuses,
        hasTags: processedTags.length > 0,
        hasStatuses: processedStatuses.length > 0
      });
    }
    
    // Filter for active NPCs in the scene with non-zero influence
    const activeSceneNpcs = sceneNpcData.filter(npc => npc.hasInfluence && npc.influence !== 0);
    
    // Sort both arrays alphabetically by name
    sceneNpcData.sort((a, b) => a.name.localeCompare(b.name));
    activeSceneNpcs.sort((a, b) => a.name.localeCompare(b.name));
    
    // Calculate the real-time total influence
    const recalculatedTotalInfluence = sceneNpcData.reduce((sum, npc) => {
      return sum + (Number(npc.influence) || 0);
    }, 0);
    
    return {
      totalInfluence: recalculatedTotalInfluence, // Use the recalculated value
      currentSceneName: currentScene?.name || "No Active Scene",
      sceneNpcs: sceneNpcData,
      activeSceneNpcs,
      hasSceneNpcs: sceneNpcData.length > 0,
      hasActiveSceneNpcs: activeSceneNpcs.length > 0,
      isGM: game && game.user ? game.user.isGM : false
    };
  }
  
  /**
   * Calculate influence values directly from a token
   * @param {Token} token The token to calculate influence for
   * @returns {Object} The calculated influence values
   * @private
   */
  _calculateTokenInfluence(token) {
    if (!token || !token.actor) return { tagInfluence: 0, statusInfluence: 0, totalInfluence: 0 };
    
    const actor = token.actor;
    
    // Get all tags and statuses
    const tags = actor.items.filter(item => item.type === 'tag');
    const statuses = actor.items.filter(item => item.type === 'status');
    
    // Calculate tag influence
    let tagInfluence = 0;
    for (const tag of tags) {
      const tagState = tag.getFlag('mist-hud', 'tagState') || 'neutral';
      
      if (tagState === 'positive') tagInfluence += 1;
      else if (tagState === 'negative') tagInfluence -= 1;
    }
    
    // Calculate status influence
    let statusInfluence = 0;
    for (const status of statuses) {
      const statusType = status.getFlag('mist-hud', 'statusType') || status.system.specialType || 'neutral';
      
      if (statusType !== 'neutral') {
        const tier = Number(status.system.tier) || 1;
        const collectiveSize = Number(actor.system.collectiveSize || actor.system.scale || 0);
        const modifiedTier = tier + collectiveSize;
        
        if (statusType === 'positive') statusInfluence += modifiedTier;
        else if (statusType === 'negative') statusInfluence -= modifiedTier;
      }
    }
    
    // Calculate total influence
    const totalInfluence = tagInfluence + statusInfluence;
    
    return { tagInfluence, statusInfluence, totalInfluence };
  }
  
  /**
   * Set up event listeners
   * @param {jQuery} html The form html
   */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Sync All button
    html.find('.sync-all-npcs').click(this._onSyncAll.bind(this));
    
    // Refresh UI button 
    html.find('.refresh-ui').click(() => {
      this.render(true);
      ui.notifications.info("NPC influence display refreshed");
    });
    
    // Click on NPC image to select and pan to token
    html.find('.npc-image').click(this._onNpcImageClick.bind(this));
    
    // Set up refresh when NPC data changes
    this._setupNpcDataRefresh();
  }
  
  /**
   * Setup hooks to refresh the display when NPC data changes
   * ONLY when the manager is already open
   * @private
   */
  _setupNpcDataRefresh() {
    // Store references to event handlers so they can be properly removed
    this._boundHandlers = {
      updateNpcInfluence: () => this.render(true),
      
      updateItem: (item, changes) => {
        // Only refresh if it's a tag or status on an NPC
        if (!item.parent || item.parent.type !== 'threat') return;
        if (!['tag', 'status'].includes(item.type)) return;
        
        this.render(true);
      },
      
      createItem: (item) => {
        // Only refresh if it's a tag or status on an NPC
        if (!item.parent || item.parent.type !== 'threat') return;
        if (!['tag', 'status'].includes(item.type)) return;
        
        this.render(true);
      },
      
      deleteItem: (item) => {
        // Only refresh if it's a tag or status on an NPC
        if (!item.parent || item.parent.type !== 'threat') return;
        if (!['tag', 'status'].includes(item.type)) return;
        
        this.render(true);
      },
      
      updateActor: (actor, changes) => {
        if (actor.type !== 'threat') return;
        
        // Check for ANY changes to the system data as it might include collectiveSize/scale
        if (changes.system) {
          // Render asynchronously to get the latest data
          setTimeout(() => this.render(true), 50);
        }
      },
      
      // Socket message handler
      socketMessage: (message) => {
        if (message.type === 'npcInfluence' || 
            message.type === 'refreshNpcInfluences' ||
            message.type === 'updateCollectiveSize') {
          this.render(true);
        }
      }
    };
    
    // Register all event handlers
    Hooks.on('updateNpcInfluence', this._boundHandlers.updateNpcInfluence);
    Hooks.on('updateItem', this._boundHandlers.updateItem);
    Hooks.on('createItem', this._boundHandlers.createItem);
    Hooks.on('deleteItem', this._boundHandlers.deleteItem);
    Hooks.on('updateActor', this._boundHandlers.updateActor);
    game.socket.on('module.mist-hud', this._boundHandlers.socketMessage);
  }
  
  /**
   * @override
   * Override close method to clean up event listeners
   */
  close() {
    // Clean up all event listeners when the window is closed
    if (this._boundHandlers) {
      Hooks.off('updateNpcInfluence', this._boundHandlers.updateNpcInfluence);
      Hooks.off('updateItem', this._boundHandlers.updateItem);
      Hooks.off('createItem', this._boundHandlers.createItem);
      Hooks.off('deleteItem', this._boundHandlers.deleteItem);
      Hooks.off('updateActor', this._boundHandlers.updateActor);
      game.socket.off('module.mist-hud', this._boundHandlers.socketMessage);
    }
    
    return super.close();
  }
  
  /**
   * Handle clicking on an NPC image to select and pan to token
   * @param {Event} event The click event
   * @private
   */
  _onNpcImageClick(event) {
    event.preventDefault();
    
    const tokenId = event.currentTarget.closest('.npc-item').dataset.tokenId;
    const actorId = event.currentTarget.closest('.npc-item').dataset.npcId;
    
    if (!tokenId || !canvas.ready) return;
    
    // Try to find the token in the scene
    const token = canvas.tokens.get(tokenId);
    
    if (token) {
      // Select the token
      token.control({releaseOthers: true});
      
      // Pan to the token
      canvas.animatePan({
        x: token.center.x,
        y: token.center.y,
        duration: 250
      });
      
      return;
    }
    
    // If token not found, try to find any token with the same actor
    if (actorId) {
      const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actorId);
      
      if (tokens.length > 0) {
        // Select the first token found
        tokens[0].control({releaseOthers: true});
        
        // Pan to the token
        canvas.animatePan({
          x: tokens[0].center.x,
          y: tokens[0].center.y,
          duration: 250
        });
      }
    }
  }
  
  /**
   * Handle sync all button click
   * @param {Event} event The click event
   * @private
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
      console.error("Failed to sync influences:", error);
      ui.notifications.error("Error synchronizing influences");
    }
    
    this.render(true);
  }
}