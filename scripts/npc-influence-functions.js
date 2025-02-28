// scripts/npc-influence-functions.js

// Create a simple logger
const logger = {
  debug: (...args) => console.debug("NPC-Influence |", ...args),
  info: (...args) => console.info("NPC-Influence |", ...args),
  warn: (...args) => console.warn("NPC-Influence |", ...args),
  error: (...args) => console.error("NPC-Influence |", ...args)
};

// Add this near the top of the file, outside any function
window.openNPCInfluenceManager = function() {
  if (!game || !game.user || !game.user.isGM) {
    ui.notifications.warn("Only the GM can manage NPC influences");
    return;
  }
  
  // Initialize the global influence cache if it doesn't exist
  globalThis.activeNpcInfluences = globalThis.activeNpcInfluences || {};
  
  // Dynamically import the manager to avoid circular dependencies
  import('./npc-influence-manager.js').then(module => {
    const NPCInfluenceManager = module.NPCInfluenceManager;
    new NPCInfluenceManager().render(true);
  }).catch(error => {
    console.error("Failed to load NPC Influence Manager:", error);
    ui.notifications.error("Failed to load NPC Influence Manager");
  });
};

// Also add it to globalThis for maximum compatibility
globalThis.openNPCInfluenceManager = window.openNPCInfluenceManager;

/**
* Initialize the global NPC influence cache with improved socket handling
* @function
*/
export function initializeNpcInfluenceCache() {
  // Create global cache if it doesn't exist
  globalThis.activeNpcInfluences = globalThis.activeNpcInfluences || {};
  
  // Initialize socket listeners for NPC influence
  game.socket.on('module.mist-hud', (message) => {
    if (message.type === 'npcInfluence') {
      // Store influence in global cache with the appropriate ID
      const influence = message.data;
      
      if (!influence) return;
      
      // Use tokenId as key for unlinked tokens, actorId otherwise
      const cacheKey = (influence.tokenId && !influence.actorLink) ? 
        influence.tokenId : influence.npcId;
      
      // Update the global cache with the latest influence data
      if (cacheKey) {
        globalThis.activeNpcInfluences[cacheKey] = influence;
        console.log(`Current active NPC influences:`, Object.values(globalThis.activeNpcInfluences));
        logger.debug(`Updated NPC influence: ${influence.npcName} (${influence.totalInfluence})`);
      }
      
      // If this is a deletion message, remove the NPC from cache
      if (message.action === 'delete') {
        // Handle both tokenId and npcId for deletion
        if (message.tokenId && !message.actorLink) {
          delete globalThis.activeNpcInfluences[message.tokenId];
        } else if (message.npcId) {
          delete globalThis.activeNpcInfluences[message.npcId];
        }
        logger.debug(`Removed NPC influence for ${message.npcName || message.npcId}`);
      }
    }
  });
  
  // If we're the GM, set up bulk sync handlers
  if (typeof game !== 'undefined' && game.user && game.user.isGM) {
    // Listen for bulk sync requests
    game.socket.on('module.mist-hud', (message) => {
      if (message.type === 'requestNpcInfluences' && message.userId) {
        // Gather all current influences
        const allInfluences = Object.values(globalThis.activeNpcInfluences);
        
        // Send back to the requesting user
        game.socket.emit('module.mist-hud', {
          type: 'bulkNpcInfluences',
          targetUserId: message.userId,
          data: allInfluences
        });
        
        logger.debug(`Sent ${allInfluences.length} NPC influences to user ${message.userId}`);
      }
    });
    
    // Add hook to sync influences on scene change
    Hooks.on('canvasReady', async () => {
      // Give a short delay for scene to fully load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Sync all tokens in the scene
      const syncResult = await syncTokenInfluences();
      logger.debug(`Auto-synced ${syncResult} tokens on scene change`);
      
      // Force a refresh of all clients
      game.socket.emit('module.mist-hud', {
        type: 'refreshNpcInfluences'
      });
    });
  } else {
    // Non-GM users request current influences when they connect
    game.socket.emit('module.mist-hud', {
      type: 'requestNpcInfluences',
      userId: game.user.id
    });
    
    // Handle scene changes by requesting a refresh
    Hooks.on('canvasReady', () => {
      game.socket.emit('module.mist-hud', {
        type: 'requestNpcInfluences',
        userId: game.user.id
      });
    });
    
    // Handle bulk influence data from GM
    game.socket.on('module.mist-hud', (message) => {
      if (message.type === 'bulkNpcInfluences' && message.targetUserId === game.user.id) {
        // Clear existing cache
        globalThis.activeNpcInfluences = {};
        
        if (Array.isArray(message.data)) {
          // First, deduplicate the array
          const uniqueInfluences = new Map();
          
          message.data.forEach(influence => {
            if (influence) {
              // Use tokenId as key for unlinked tokens, actorId otherwise
              const cacheKey = (influence.tokenId && !influence.actorLink) ? 
                influence.tokenId : influence.npcId;
                
              if (cacheKey && !uniqueInfluences.has(cacheKey)) {
                uniqueInfluences.set(cacheKey, influence);
              }
            }
          });
          
          // Now add to the global cache
          uniqueInfluences.forEach((influence, key) => {
            globalThis.activeNpcInfluences[key] = influence;
          });
        }
        
        logger.debug(`Received ${Object.keys(globalThis.activeNpcInfluences).length} unique NPC influences`);
        console.log(`Updated NPC influences:`, Object.values(globalThis.activeNpcInfluences));
      } else if (message.type === 'refreshNpcInfluences') {
        // Request a refresh of influences
        game.socket.emit('module.mist-hud', {
          type: 'requestNpcInfluences',
          userId: game.user.id
        });
      }
    });
  }
  
  // Add debug button to game controls for GMs
  if (typeof game !== 'undefined' && game.user && game.user.isGM) {
    Hooks.on('getSceneControlButtons', (controls) => {
      controls.find(c => c.name === "token")?.tools.push({
        name: "syncNpcInfluence",
        title: "Sync NPC Influences",
        icon: "fas fa-sync",
        button: true,
        onClick: async () => {
          const result = await syncTokenInfluences();
          ui.notifications.info(`Synchronized ${result} NPC influences`);
          
          // Force refresh on all clients
          game.socket.emit('module.mist-hud', {
            type: 'refreshNpcInfluences'
          });
        }
      });
    });
  }
}

/**
* Calculate total NPC influence for the current scene
* @function
* @param {Array} influences Array of influence objects (optional, defaults to result of getNpcInfluences)
* @returns {number} Total influence value
*/
export function calculateNpcInfluenceTotal(influences = null) {
  // If no influences provided, get them from current scene
  const sceneInfluences = influences || getNpcInfluences();
  
  if (!sceneInfluences || sceneInfluences.length === 0) {
    logger.debug("No NPC influences found in scene, returning 0");
    return 0;
  }
  
  // Create a Map to track token-specific influences
  const tokenInfluences = new Map();
  
  // Process each influence by token
  sceneInfluences.forEach(infl => {
    const key = infl._tokenId || infl.tokenId || infl.npcId;
    const name = infl._tokenName || infl.tokenName || infl.npcName || "Unknown";
    const value = Number(infl.totalInfluence) || 0;
    
    tokenInfluences.set(key, { name, value });
  });
  
  // Calculate total from all token influences
  let total = 0;
  logger.debug("DETAILED INFLUENCE BREAKDOWN:");
  
  tokenInfluences.forEach((data, key) => {
    logger.debug(`${data.name} (${key}): ${data.value}`);
    total += data.value;
  });
  
  logger.debug(`Total NPC influence calculated for scene: ${total}`);
  return total;
}

/**
* Get NPC influences from current scene only, with improved token handling
* @function
* @returns {Array} Array of influence objects for NPCs in the current scene
*/
export function getNpcInfluences() {
  // Access the global cache
  const influences = globalThis.activeNpcInfluences || {};
  
  // Debug log
  console.log(`Current active NPC influences:`, Object.values(influences));
  
  // Get all tokens in the current scene
  const currentSceneTokens = canvas.tokens.placeables
    .filter(t => t.actor && t.actor.type === 'threat');
  
  // Create a collection of valid influences
  const validInfluences = [];
  
  // Use a Set to track processed tokens specifically
  const processedTokenIds = new Set();
  
  // Process each token in the scene INDIVIDUALLY
  for (const token of currentSceneTokens) {
    // Skip if we've already processed this specific token
    if (processedTokenIds.has(token.id)) {
      continue;
    }
    
    let influence = null;
    
    // For unlinked tokens, look for influence by token ID first
    if (!token.document.actorLink && influences[token.id]) {
      influence = influences[token.id];
      processedTokenIds.add(token.id);
    } 
    // For linked tokens, handle differently to avoid skipping tokens with same actor
    else if (influences[token.actor.id]) {
      influence = influences[token.actor.id];
      
      // For linked tokens, we only process each individual token once
      processedTokenIds.add(token.id);
    }
    
    if (influence) {
      // Make a deep copy of the influence to prevent reference issues
      const influenceCopy = JSON.parse(JSON.stringify(influence));
      
      // Add extra identification for debugging
      influenceCopy._tokenId = token.id;
      influenceCopy._tokenName = token.name;
      
      validInfluences.push(influenceCopy);
    }
  }
  
  // Debug logs
  logger.debug(`Found ${validInfluences.length} active NPC influences in current scene`);
  console.log(`Scene NPC influences for calculation:`, validInfluences);
  
  return validInfluences;
}

/**
* Updates how to sync tokens in the scene
*/
async function syncTokenInfluences() {
    // Check if game and game.user are initialized
    if (!game || !game.user) {
      console.warn("Game not fully initialized; aborting sync");
      return 0;
  }
  
  // Now check GM status
  if (!game.user.isGM) return 0;
  
  // Find all threat-type tokens in the current scene
  const tokens = canvas.tokens.placeables.filter(t => t.actor && t.actor.type === 'threat');
  let syncCount = 0;
  
  for (const token of tokens) {
      // First, check if there's an existing HUD in the registry
      let npcHud = globalThis.npcHudRegistry?.get(token.id);
      
      // If not found by token ID, try actor ID
      if (!npcHud) {
          npcHud = globalThis.npcHudRegistry?.get(token.actor.id);
      }
      
      if (!npcHud) {
          try {
              // Use existing instances to avoid import problems
              
              // Try to find an NpcHUD by examining registry keys
              if (!npcHud && globalThis.npcHudRegistry && typeof globalThis.npcHudRegistry === 'object') {
                  // Get any NpcHUD instance from the registry
                  for (const [_, hudInstance] of Object.entries(globalThis.npcHudRegistry)) {
                      if (hudInstance && typeof hudInstance.setActor === 'function') {
                          // Use the constructor of an existing instance
                          const NpcHUD = hudInstance.constructor;
                          npcHud = new NpcHUD();
                          npcHud.setActor(token.actor, token);
                          break;
                      }
                  }
              }
              
              // If we still don't have a HUD, look for any existing instance in UI windows
              if (!npcHud) {
                  const existingWindow = Object.values(ui.windows).find(w => 
                      w.constructor.name === "NpcHUD");
                  
                  if (existingWindow) {
                      const NpcHUD = existingWindow.constructor;
                      npcHud = new NpcHUD();
                      npcHud.setActor(token.actor, token);
                  }
              }
              
              // Final fallback - try getting a reference from a global variable
              if (!npcHud) {
                  if (typeof game.modules.get('mist-hud').api?.getNpcHUD === 'function') {
                      // If the module has an API with a getNpcHUD method, use that
                      const NpcHUD = game.modules.get('mist-hud').api.getNpcHUD();
                      npcHud = new NpcHUD();
                      npcHud.setActor(token.actor, token);
                  } else if (globalThis.NpcHUD) {
                      // Try global scope
                      npcHud = new globalThis.NpcHUD();
                      npcHud.setActor(token.actor, token);
                  } else {
                      console.warn("Could not find NpcHUD class through any method for token:", token.name);
                      continue;
                  }
              }
          } catch (error) {
              console.error("Failed to create NPC HUD:", error);
              continue;
          }
      }
      
      // Calculate and emit influence
      if (npcHud && typeof npcHud.emitNpcInfluence === 'function') {
          try {
              await npcHud.emitNpcInfluence();
              syncCount++;
          } catch (error) {
              console.error(`Error emitting influence for ${token.name}:`, error);
          }
      } else {
          console.warn(`NPC HUD for ${token.actor.name} doesn't have emitNpcInfluence method`);
      }
      
      // Add a small delay to prevent socket congestion
      await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return syncCount;
}

// Export the function
export { syncTokenInfluences };

// Modify the debugNpcInfluences function to be token-aware
export function debugNpcInfluences() {
  const influences = globalThis.activeNpcInfluences || {};
  
  // Get all tokens in the current scene
  const currentSceneTokens = canvas.tokens.placeables
      .filter(t => t.actor && t.actor.type === 'threat');
  
  // Create a collection of valid influences
  const sceneInfluences = [];
  const tokenMap = new Map(); // Map to store token-to-influence relationships
  
  // Process each token in the scene
  for (const token of currentSceneTokens) {
      let influence = null;
      
      // For unlinked tokens, look for influence by token ID first
      if (!token.document.actorLink && influences[token.id]) {
          influence = influences[token.id];
      } 
      // For linked tokens or as fallback, check actor ID
      else if (influences[token.actor.id]) {
          influence = influences[token.actor.id];
      }
      
      if (influence) {
          sceneInfluences.push(influence);
          tokenMap.set(token, influence);
      }
  }
  
  // Get all influences for comparison
  const allInfluences = Object.values(influences);
  
  console.log("===== ACTIVE NPC INFLUENCES =====");
  console.log(`Current Scene: ${canvas.scene?.name || "No Active Scene"}`);
  console.log(`Found ${sceneInfluences.length} influences in current scene (${allInfluences.length} total in cache)`);
  
  console.log("--- CURRENT SCENE TOKENS WITH INFLUENCE ---");
  tokenMap.forEach((influence, token) => {
      console.log(`Token: "${token.name}" (${token.id}), Actor: "${token.actor.name}" (${token.actor.id})`);
      console.log(`  Influence: ${influence.totalInfluence} (Tags: ${influence.tagInfluence}, Statuses: ${influence.statusInfluence})`);
      console.log(`  Linked: ${token.document.actorLink}`);
  });
  
  if (allInfluences.length > sceneInfluences.length) {
      console.log("--- OTHER INFLUENCES (NOT APPLIED) ---");
      const otherInfluences = allInfluences.filter(infl => !sceneInfluences.includes(infl));
      otherInfluences.forEach(infl => {
          console.log(`${infl.npcName}: ${infl.totalInfluence} (not in current scene)`);
      });
  }
  
  const total = calculateNpcInfluenceTotal(sceneInfluences);
  console.log(`Total influence applied to rolls in current scene: ${total}`);
  console.log("===== END DEBUG =====");
  
  return { 
      sceneInfluences, 
      allInfluences,
      tokenMap,
      total,
      sceneName: canvas.scene?.name || "No Active Scene"
  };
}

// Handle actor deletion
Hooks.on('deleteActor', (actor, options, userId) => {
  // Only GMs should broadcast deletions
  if (!game.user.isGM) return;
  
  // Check if this is an NPC that might have influence
  if (actor.type === 'threat') {
      // If this NPC had influence in the global cache, remove it
      if (globalThis.activeNpcInfluences?.[actor.id]) {
          // Emit deletion message
          game.socket.emit('module.mist-hud', {
              type: 'npcInfluence',
              action: 'delete',
              npcId: actor.id,
              npcName: actor.name
          });
          
          // Remove from local cache too
          delete globalThis.activeNpcInfluences[actor.id];
          
          logger.debug(`NPC ${actor.name} deleted, removed influence`);
      }
  }
});

// Add hooks for influence-changing events
if (typeof game !== 'undefined' && game.user && game.user.isGM) {
  // For tag and status changes
  Hooks.on('updateItem', (item, changes, options, userId) => {
      // Only process if this is a tag or status on an NPC
      if (!item.parent || item.parent.type !== 'threat') return;
      if (!['tag', 'status'].includes(item.type)) return;
      
      // Check if certain fields changed that affect influence
      const relevantChanges = [
          'system.burn_state', 
          'system.burned', 
          'system.tier', 
          'system.specialType',
          'flags.mist-hud.tagState',
          'flags.mist-hud.statusType'
      ];
      
      // Check if any relevant field was changed
      let shouldUpdate = false;
      
      for (const field of relevantChanges) {
          const parts = field.split('.');
          let current = changes;
          let valid = true;
          
          for (const part of parts) {
              if (current[part] === undefined) {
                  valid = false;
                  break;
              }
              current = current[part];
          }
          
          if (valid) {
              shouldUpdate = true;
              break;
          }
      }
      
      if (shouldUpdate) {
          // Find the token in the current scene
          const tokens = canvas.tokens.placeables.filter(t => 
              t.actor && t.actor.id === item.parent.id
          );
          
          if (tokens.length > 0) {
              // Request a sync of all tokens
              syncTokenInfluences().then(() => {
                  // Notify clients to refresh
                  game.socket.emit('module.mist-hud', {
                      type: 'refreshNpcInfluences'
                  });
              });
          }
      }
  });
  
  // When tokens are created or deleted
  Hooks.on('createToken', (token, options, userId) => {
      if (token.actor?.type === 'threat') {
          // Add a delay to ensure the token is fully created
          setTimeout(() => {
              syncTokenInfluences().then(() => {
                  game.socket.emit('module.mist-hud', {
                      type: 'refreshNpcInfluences'
                  });
              });
          }, 500);
      }
  });
  
  Hooks.on('deleteToken', (token, options, userId) => {
      if (token.actor?.type === 'threat') {
          // Force a refresh for clients
          game.socket.emit('module.mist-hud', {
              type: 'refreshNpcInfluences'
          });
      }
  });
}

// Function to check and fix NPC influence cache
globalThis.checkAndFixNpcInfluences = function() {
  if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can check and fix NPC influences");
      return false;
  }
  
  console.log("Checking NPC influence cache for issues...");
  
  // Look for duplicates
  const influences = globalThis.activeNpcInfluences || {};
  const tokenIds = new Set();
  const actorIds = new Set();
  const duplicates = [];
  
  Object.entries(influences).forEach(([key, influence]) => {
      if (key.includes('.')) {
          // This is a token ID
          if (tokenIds.has(key)) {
              duplicates.push(key);
          } else {
              tokenIds.add(key);
          }
      } else {
          // This is an actor ID
          if (actorIds.has(key)) {
              duplicates.push(key);
          } else {
              actorIds.add(key);
          }
      }
  });
  
  if (duplicates.length > 0) {
      console.warn(`Found ${duplicates.length} duplicate influence entries`);
      console.log("Removing duplicates...");
      duplicates.forEach(key => {
          delete globalThis.activeNpcInfluences[key];
      });
  }
  
  // Force a full sync
  syncTokenInfluences().then(count => {
      console.log(`Synced ${count} tokens`);
      
      // Force clients to refresh
      game.socket.emit('module.mist-hud', {
          type: 'refreshNpcInfluences'
      });
      
      ui.notifications.info(`NPC influence cache checked and fixed`);
  });
  
  return true;
};

// Initialize on ready
Hooks.once('ready', () => {
  // Re-expose the function to ensure it's available after ready
  window.openNPCInfluenceManager = window.openNPCInfluenceManager || function() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can manage NPC influences");
      return;
    }
    
    import('./npc-influence-manager.js').then(module => {
      const NPCInfluenceManager = module.NPCInfluenceManager;
      new NPCInfluenceManager().render(true);
    }).catch(error => {
      console.error("Failed to load NPC Influence Manager:", error);
      ui.notifications.error("Failed to load NPC Influence Manager");
    });
  };
  
  // Also make it available on globalThis
  globalThis.openNPCInfluenceManager = window.openNPCInfluenceManager;
  
  // Initialize the cache
  initializeNpcInfluenceCache();
  
  // Expose debugging function globally
  globalThis.debugNpcInfluences = debugNpcInfluences;
});