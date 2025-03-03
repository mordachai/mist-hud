/**
 * Robust NPC Influence Manager
 * A utility for GM to view NPC influences across scenes
 * @class
 * @extends {Application}
 */
export class NPCInfluenceManager extends Application {
  // Unique identifiers for the window
  static WINDOW_ID = 'npc-influence-manager';
  
  // Initialize static properties
  static _handlers = new Set();
  static _handlersInitialized = false;
  
  /**
   * Helper method to force refresh all managers and update all influences
   * @static
   */
  static _forceRefreshAllManagers() {
    // Don't do anything if there are no open managers
    if (!NPCInfluenceManager._handlers || !NPCInfluenceManager._handlers.size) return;
    
    // Get all tokens in the current scene
    if (!canvas || !canvas.tokens || !canvas.tokens.placeables) {
      console.warn("NPC Influence Manager | Canvas not ready for refresh");
      return;
    }
    
    const sceneTokens = canvas.tokens.placeables
      .filter(t => t && t.actor && t.actor.type === 'threat');
    
    // First, refresh all token influences
    for (const token of sceneTokens) {
      // Get the first active manager to use its calculation method
      if (!NPCInfluenceManager._handlers.size) break;
      
      let firstManager;
      try {
        firstManager = NPCInfluenceManager._handlers.values().next().value;
      } catch(e) {
        console.warn("NPC Influence Manager | Error getting manager instance:", e);
        continue;
      }
      
      if (!firstManager) continue;
      
      // Calculate influence directly
      const influence = firstManager._calculateTokenInfluence(token);
      
      // Try to emit the influence update if possible
      try {
        // Make sure we have all required values before emitting
        if (!token || !token.actor || !game.socket) continue;
        
        // Emit influence update over socket
        game.socket.emit('module.mist-hud', {
          type: 'npcInfluence',
          data: {
            npcId: token.actor.id,
            npcName: (token.name || token.actor.name || "Unknown NPC"),
            tokenId: token.id,
            tokenName: token.name || "Unknown Token",
            actorLink: token.document?.actorLink || false,
            tagInfluence: influence.tagInfluence || 0,
            statusInfluence: influence.statusInfluence || 0,
            totalInfluence: influence.totalInfluence || 0
          }
        });
      } catch (e) {
        console.warn(`Error emitting influence for ${token?.name || "unknown token"}:`, e);
      }
    }
    
    // Now render all manager instances
    if (NPCInfluenceManager._handlers) {
      NPCInfluenceManager._handlers.forEach(instance => {
        if (instance && !instance._isClosed) {
          try {
            instance.render(true);
          } catch (e) {
            console.warn("Error rendering instance:", e);
          }
        }
      });
    }
    
    console.log("NPC Influence Manager | Auto-refreshed all influences");
  }
  
  /**
   * Set up static event handlers that delegate to active instances
   * @private
   */
  static _setupStaticHandlers() {
    // Skip if already set up
    if (NPCInfluenceManager._handlersInitialized) return;
    
    // Create a more specific handler for NPC influence updates
    const handleNpcInfluence = (data) => {
      console.log("NPC Influence Manager | Influence update detected:", data);
      
      // Force a refresh of all active manager instances AND auto-refresh all NPCs
      NPCInfluenceManager._forceRefreshAllManagers();
    };
    
    // More granular handler for item changes
    const handleItemUpdate = (item, changes) => {
      // Only trigger for tags/statuses on threats
      if (!item || !item.parent || item.parent.type !== 'threat') return;
      if (!['tag', 'status'].includes(item.type)) return;
      
      // Check for specific changes that would affect influence
      let shouldUpdate = false;
      
      // Check for flag changes (tagState or statusType)
      if (changes.flags && changes.flags['mist-hud']) {
        if (changes.flags['mist-hud'].tagState || changes.flags['mist-hud'].statusType) {
          shouldUpdate = true;
        }
      }
      
      // Check for burn state changes
      if (changes.system && (changes.system.burn_state !== undefined || changes.system.burned !== undefined)) {
        shouldUpdate = true;
      }
      
      // Check for tier changes
      if (changes.system && changes.system.tier !== undefined) {
        shouldUpdate = true;
      }
      
      // Only trigger updates if relevant fields changed
      if (shouldUpdate) {
        console.log("NPC Influence Manager | Detected item change affecting influence:", item.name);
        // Short delay to let all changes apply, then do a full auto-refresh
        setTimeout(() => NPCInfluenceManager._forceRefreshAllManagers(), 50);
      }
    };
    
    // Handle adding/removing items (tags/statuses)
    const handleItemChange = (item) => {
      // Only trigger for tags/statuses on threats
      if (!item || !item.parent || item.parent.type !== 'threat') return;
      if (!['tag', 'status'].includes(item.type)) return;
      
      console.log("NPC Influence Manager | Detected item add/remove affecting influence:", item.name);
      // Short delay to let all changes apply, then do a full auto-refresh
      setTimeout(() => NPCInfluenceManager._forceRefreshAllManagers(), 50);
    };
    
    // Handle actor updates (for collective size changes)
    const handleActorUpdate = (actor, changes) => {
      if (!actor || actor.type !== 'threat') return;
      
      // Check if system data changed (which might include collectiveSize or scale)
      if (changes.system) {
        const systemChanges = changes.system;
        
        // Check for collective size or scale changes specifically
        if (systemChanges.collectiveSize !== undefined || systemChanges.scale !== undefined) {
          console.log("NPC Influence Manager | Detected collective size change for:", actor.name);
          // Short delay to let all changes apply, then do a full auto-refresh
          setTimeout(() => NPCInfluenceManager._forceRefreshAllManagers(), 50);
        }
      }
    };
    
    // Socket message handler with more specific behavior
    const handleSocketMessage = (message) => {
      if (!message || !message.type) return;
      
      if (message.type === 'npcInfluence') {
        // Handle influence updates from other users
        console.log("NPC Influence Manager | Received influence socket message:", 
                    message.data?.npcName || "Unknown NPC");
        
        // Slightly longer delay for network syncing, then do a full auto-refresh
        setTimeout(() => NPCInfluenceManager._forceRefreshAllManagers(), 100);
      }
      else if (message.type === 'refreshNpcInfluences' || message.type === 'updateCollectiveSize') {
        // Force an immediate refresh for all open managers
        console.log("NPC Influence Manager | Received refresh command from socket");
        // No delay needed for explicit refresh commands
        NPCInfluenceManager._forceRefreshAllManagers();
      }
    };
    
    // Set up the hooks - we NEVER remove these
    try {
      Hooks.on('updateNpcInfluence', handleNpcInfluence);
      Hooks.on('updateItem', handleItemUpdate);
      Hooks.on('createItem', handleItemChange);
      Hooks.on('deleteItem', handleItemChange);
      Hooks.on('updateActor', handleActorUpdate);
      
      if (game.socket && typeof game.socket.on === 'function') {
        game.socket.on('module.mist-hud', handleSocketMessage);
      }
      
      NPCInfluenceManager._handlersInitialized = true;
      console.log("NPC Influence Manager | Static handlers initialized");
    } catch (error) {
      console.error("NPC Influence Manager | Error setting up static handlers:", error);
    }
  }
  
  constructor() {
    super();
    
    // Initialize closed state
    this._isClosed = false;
    
    // Using a registry pattern for event handling
    // Instead of registering/unregistering hooks, we'll use a central static handler
    
    // Initialize handler registry if it doesn't exist
    if (!NPCInfluenceManager._handlers) {
      NPCInfluenceManager._handlers = new Set();
      NPCInfluenceManager._setupStaticHandlers();
    }
    
    // Add this instance to the registry
    NPCInfluenceManager._handlers.add(this);
    
    // Register in UI windows registry
    ui.windows[NPCInfluenceManager.WINDOW_ID] = this;
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: NPCInfluenceManager.WINDOW_ID,
      title: 'NPC Influence Viewer',
      template: 'modules/mist-hud/templates/npc-influence-manager.hbs',
      width: 450,
      height: 'auto',
      resizable: true,
      minimizable: true,
      classes: ['mist-hud', 'npc-influence-manager'],
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'active' }]
    });
  }

  /**
   * Get data for template rendering with improved real-time calculations
   * @returns {Object} Template data
   */
  async getData() {
    // Skip rendering if closed
    if (this._isClosed) return {};
    
    // Get current scene
    const currentScene = canvas?.scene;
    
    // Check if canvas and tokens are available
    if (!canvas || !canvas.tokens || !canvas.tokens.placeables) {
      console.warn("NPC Influence Manager | Canvas not ready for getData");
      return {
        totalInfluence: 0,
        currentSceneName: "No Active Scene",
        sceneNpcs: [],
        activeSceneNpcs: [],
        hasSceneNpcs: false,
        hasActiveSceneNpcs: false,
        isGM: game && game.user ? game.user.isGM : false
      };
    }
    
    // Get all tokens in the current scene
    const sceneTokens = canvas.tokens.placeables
      .filter(t => t && t.actor && t.actor.type === 'threat');
    
    // Create a map of tokens to their influences
    const tokenInfluenceMap = new Map();
    
    // Force a fresh calculation for all tokens rather than relying on cached values
    const calculatedInfluences = new Map();
    
    // First pass - calculate influences for all tokens
    for (const token of sceneTokens) {
      // Skip if we can't find the token's actor
      if (!token.actor) continue;
      
      // Calculate influence directly from token's current state
      const calculatedInfluence = this._calculateTokenInfluence(token);
      calculatedInfluences.set(token.id, calculatedInfluence);
      
      // For unlinked tokens, look for cached influence by token ID
      if (!token.document?.actorLink && globalThis.activeNpcInfluences?.[token.id]) {
        tokenInfluenceMap.set(token, globalThis.activeNpcInfluences[token.id]);
      } 
      // For linked tokens or as fallback, check actor ID in cache
      else if (globalThis.activeNpcInfluences?.[token.actor.id]) {
        tokenInfluenceMap.set(token, globalThis.activeNpcInfluences[token.actor.id]);
      }
    }
    
    // Calculate total influence using our freshly calculated values, not cached ones
    const totalCalculatedInfluence = Array.from(calculatedInfluences.values()).reduce((sum, infl) => {
      return sum + (Number(infl.totalInfluence) || 0);
    }, 0);
    
    // Build data structure for the template - only for tokens in the scene
    const sceneNpcData = [];
    const sceneActorIds = new Set(); // Track actor IDs to avoid duplicating linked actors
    
    // Process each token in the scene
    for (const token of sceneTokens) {
      // Skip if we can't find the token's actor
      if (!token.actor) continue;
      
      // Get the already calculated influence values
      const calculatedInfluence = calculatedInfluences.get(token.id) || 
        { tagInfluence: 0, statusInfluence: 0, totalInfluence: 0 };
      
      // Check if there's cached influence data
      const hasInfluence = tokenInfluenceMap.has(token);
      const cachedInfluence = hasInfluence ? tokenInfluenceMap.get(token) : null;
      
      // ALWAYS use calculated values for display, ignoring cached values
      // This ensures real-time accuracy
      const influence = calculatedInfluence.totalInfluence;
      const tagInfluence = calculatedInfluence.tagInfluence;
      const statusInfluence = calculatedInfluence.statusInfluence;
      
      // Get collective size from actor system
      const collectiveSize = Number(token.actor.system?.collectiveSize || token.actor.system?.scale || 0);
      
      // Get all tags and statuses for this actor - fresh from the actor data
      const tags = token.actor.items?.filter(item => item && item.type === 'tag') || [];
      const statuses = token.actor.items?.filter(item => item && item.type === 'status') || [];
      
      // Process tags to get their states
      const processedTags = tags.map(tag => {
        const tagState = tag.getFlag('mist-hud', 'tagState') || 'neutral';
        const isBurned = tag.system?.burn_state === 1 || tag.system?.burned;
        
        return {
          id: tag.id,
          name: tag.name,
          state: tagState,
          isBurned: isBurned
        };
      });
      
      // Process statuses to get their states and tiers
      const processedStatuses = statuses.map(status => {
        const statusType = status.getFlag('mist-hud', 'statusType') || status.system?.specialType || 'neutral';
        const tier = Number(status.system?.tier) || 1;
        
        return {
          id: status.id,
          name: status.name,
          state: statusType,
          tier: tier
        };
      });
      
      // For linked actors, only add once
      if (token.document?.actorLink) {
        if (sceneActorIds.has(token.actor.id)) continue;
        sceneActorIds.add(token.actor.id);
      }
      
      sceneNpcData.push({
        id: token.actor.id,
        tokenId: token.id,
        name: token.name || token.actor.name,
        img: token.document?.texture?.src || token.actor.img || 'icons/svg/mystery-man.svg',
        hasInfluence: (influence !== 0), // Use calculated influence, not cached
        isLinked: token.document?.actorLink || false,
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
    const activeSceneNpcs = sceneNpcData.filter(npc => npc.influence !== 0);
    
    // Sort both arrays alphabetically by name
    sceneNpcData.sort((a, b) => a.name.localeCompare(b.name));
    activeSceneNpcs.sort((a, b) => a.name.localeCompare(b.name));
    
    // Always use our totally freshly calculated values
    return {
      totalInfluence: totalCalculatedInfluence,
      currentSceneName: currentScene?.name || "No Active Scene",
      sceneNpcs: sceneNpcData,
      activeSceneNpcs,
      hasSceneNpcs: sceneNpcData.length > 0,
      hasActiveSceneNpcs: activeSceneNpcs.length > 0,
      isGM: game && game.user ? game.user.isGM : false
    };
  }
  
  /**
   * Calculate influence values directly from a token with improved handling
   * @param {Token} token The token to calculate influence for
   * @returns {Object} The calculated influence values
   * @private
   */
  _calculateTokenInfluence(token) {
    if (!token || !token.actor) return { tagInfluence: 0, statusInfluence: 0, totalInfluence: 0 };
    
    const actor = token.actor;
    
    // Get all tags and statuses - force a fresh query from the actor
    const tags = actor.items?.filter(item => item && item.type === 'tag') || [];
    const statuses = actor.items?.filter(item => item && item.type === 'status') || [];
    
    // Debug for visibility
    console.log(`NPC Influence Manager | Calculating influence for ${token.name || actor.name}:`, 
               {tags: tags.length, statuses: statuses.length});
    
    // Calculate tag influence
    let tagInfluence = 0;
    for (const tag of tags) {
      const tagState = tag.getFlag('mist-hud', 'tagState') || 'neutral';
      
      if (tagState === 'positive') tagInfluence += 1;
      else if (tagState === 'negative') tagInfluence -= 1;
      
      // Debug tag state
      if (tagState !== 'neutral') {
        console.log(`  Tag: ${tag.name}, State: ${tagState}, Burned: ${tag.system?.burn_state === 1 || tag.system?.burned}`);
      }
    }
    
    // Calculate status influence
    let statusInfluence = 0;
    for (const status of statuses) {
      const statusType = status.getFlag('mist-hud', 'statusType') || status.system?.specialType || 'neutral';
      
      if (statusType !== 'neutral') {
        const tier = Number(status.system?.tier) || 1;
        const collectiveSize = Number(actor.system?.collectiveSize || actor.system?.scale || 0);
        const modifiedTier = tier + collectiveSize;
        
        if (statusType === 'positive') statusInfluence += modifiedTier;
        else if (statusType === 'negative') statusInfluence -= modifiedTier;
        
        // Debug status influence
        console.log(`  Status: ${status.name}, Type: ${statusType}, Tier: ${tier}, Modified: ${modifiedTier}`);
      }
    }
    
    // Calculate total influence
    const totalInfluence = tagInfluence + statusInfluence;
    
    // Update the global influence cache to keep it in sync
    // This ensures other parts of the system use our freshly calculated values
    const updateCache = () => {
      try {
        if (globalThis.activeNpcInfluences) {
          if (token.document && !token.document.actorLink) {
            // For unlinked tokens, store by token ID
            globalThis.activeNpcInfluences[token.id] = {
              npcId: actor.id,
              npcName: token.name || actor.name,
              tokenId: token.id,
              tokenName: token.name,
              actorLink: false,
              tagInfluence: tagInfluence,
              statusInfluence: statusInfluence,
              totalInfluence: totalInfluence
            };
          } else {
            // For linked tokens, store by actor ID
            globalThis.activeNpcInfluences[actor.id] = {
              npcId: actor.id,
              npcName: actor.name,
              tokenId: token.id,
              tokenName: token.name,
              actorLink: true,
              tagInfluence: tagInfluence,
              statusInfluence: statusInfluence,
              totalInfluence: totalInfluence
            };
          }
        }
      } catch (e) {
        console.warn("NPC Influence Manager | Error updating influence cache:", e);
      }
    };
    
    // Update the cache with our fresh calculations
    updateCache();
    
    // Debug the result
    console.log(`  Total influence: ${totalInfluence} (Tags: ${tagInfluence}, Statuses: ${statusInfluence})`);
    
    return { tagInfluence, statusInfluence, totalInfluence };
  }
  
  /**
   * Set up event listeners
   * @param {jQuery} html The form html
   */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Early exit if the window is closed
    if (this._isClosed) return;
    
    // Sync All button
    html.find('.sync-all-npcs').click(this._onSyncAll.bind(this));
    
    // Refresh UI button - use this as our force refresh button
    html.find('.refresh-ui').click(() => {
      this._onForceRefresh();
    });
    
    // Click on NPC image to select and pan to token
    html.find('.npc-image').click(this._onNpcImageClick.bind(this));
  }
  
  /**
   * @override
   * Called when the application is rendered
   */
  async _render(...args) {
    // Skip rendering if marked as closed
    if (this._isClosed) return;
    
    // Otherwise, proceed with normal rendering
    await super._render(...args);
  }
  
  /**
   * Handle force refresh button
   * This recalculates all influences without relying on cached values
   * @private
   */
  async _onForceRefresh() {
    if (this._isClosed) return;
    
    if (!game || !game.user) {
      ui.notifications.warn("Game not initialized");
      return;
    }
    
    //ui.notifications.info("Force refreshing NPC influences...");
    
    // Use the static method to refresh all managers
    NPCInfluenceManager._forceRefreshAllManagers();
  }
  
  /**
   * Handle clicking on an NPC image to select and pan to token
   * @param {Event} event The click event
   * @private
   */
  _onNpcImageClick(event) {
    event.preventDefault();
    
    if (this._isClosed) return;
    
    // Make sure we have a valid event object
    if (!event || !event.currentTarget) return;
    
    // Find the closest npc-item element
    const npcItem = event.currentTarget.closest('.npc-item');
    if (!npcItem) return;
    
    const tokenId = npcItem.dataset.tokenId;
    const actorId = npcItem.dataset.npcId;
    
    if (!tokenId || !canvas || !canvas.ready) return;
    
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
    if (actorId && canvas.tokens && canvas.tokens.placeables) {
      const tokens = canvas.tokens.placeables.filter(t => t && t.actor && t.actor.id === actorId);
      
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
    
    if (this._isClosed) return;
    
    if (!game || !game.user || !game.user.isGM) {
      ui.notifications.warn("Only the GM can synchronize NPC influences");
      return;
    }
    
    //ui.notifications.info("Synchronizing NPCs in current scene...");
    
    try {
      // Try to import from the scripts directory
      const { syncTokenInfluences } = await import('./npc-influence-functions.js');
      const syncCount = await syncTokenInfluences();
      //ui.notifications.info(`Synchronized ${syncCount} NPCs in current scene`);
    } catch (error) {
      console.error("Failed to sync influences:", error);
      ui.notifications.error("Error synchronizing influences");
    }
    
    if (!this._isClosed) {
      this.render(true);
    }
  }
  
  /**
   * @override
   * Override close method with a completely hook-free implementation
   */
  async close(options={}) {
    // Mark as closed FIRST to prevent further renders
    this._isClosed = true;
    
    console.log("NPC Influence Manager | Closing manager window");
    
    try {
      // Remove this instance from the static handler registry
      if (NPCInfluenceManager._handlers) {
        NPCInfluenceManager._handlers.delete(this);
      }
      
      // Clean up UI windows references
      try {
        // Remove from UI windows registry 
        if (ui && ui.windows && ui.windows[this.appId]) {
          delete ui.windows[this.appId];
        }
        
        // Special handling for the static ID
        if (ui && ui.windows && ui.windows[NPCInfluenceManager.WINDOW_ID] === this) {
          delete ui.windows[NPCInfluenceManager.WINDOW_ID];
        }
      } catch (e) {
        console.warn("NPC Influence Manager | Error cleaning up window references:", e);
      }
      
      // Clean up DOM element if it exists
      try {
        if (this.element && this.element.length) {
          this.element.remove();
        }
      } catch (e) {
        console.warn("NPC Influence Manager | Error removing element:", e);
      }
      
      // Call the parent class's close method, but catch any errors
      try {
        return await super.close(options);
      } catch (error) {
        console.warn("NPC Influence Manager | Error in parent close:", error);
        return false;
      }
    } catch (error) {
      console.error("NPC Influence Manager | Error during close:", error);
      return false;
    }
  }
}

// Export the global opener function
export function openNPCInfluenceManager() {
  if (!game || !game.user || !game.user.isGM) {
    ui.notifications.warn("Only the GM can open the NPC Influence Manager");
    return;
  }
  
  // Check if an instance already exists
  const existingInstance = ui?.windows?.[NPCInfluenceManager.WINDOW_ID];
  if (existingInstance && !existingInstance._isClosed) {
    existingInstance.render(true);
    return;
  }
  
  // Create a new instance
  new NPCInfluenceManager().render(true);
}

// Register the global function for convenience
globalThis.openNPCInfluenceManager = openNPCInfluenceManager;