import { initializeAccordions } from './accordion-handler.js';
import { detectActiveSystem } from './mh-settings.js';
import { StoryTagDisplayContainer } from "/systems/city-of-mist/module/story-tag-window.js";
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";

globalThis.activeNpcInfluences = globalThis.activeNpcInfluences || {};

// Add hooks to handle NPC and item lifecycle events
Hooks.on('deleteActor', (actor, options, userId) => {
// Only GMs should broadcast deletions
if (!game.user.isGM) return;

// Check if this is an NPC that might have influence
if (actor.type === 'threat') {
    // If this NPC had influence in the global cache, remove it
    if (globalThis.activeNpcInfluences[actor.id]) {
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

// Global registry to store NPC HUD instances by actor ID
const npcHudRegistry = new Map();



// Simple logging helper - won't break existing code
const logger = {
  debug: (...args) => console.debug("NPC-HUD |", ...args),
  info: (...args) => console.info("NPC-HUD |", ...args),
  warn: (...args) => console.warn("NPC-HUD |", ...args),
  error: (...args) => console.error("NPC-HUD |", ...args)
};

function generateRandomId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export class NpcHUD extends Application {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
          id: 'npc-hud',  // Keep original ID to maintain compatibility
          template: 'modules/mist-hud/templates/npc-hud.hbs',
          classes: ['npc-hud'],
          header: true,
          resizable: false,
          popOut: true,
          minimizable: true,
          width: 310,
          height: 'auto',
          dragDrop: [{ dragSelector: '.window-header' }],
        });
    }

    static getInstance() {
        if (!NpcHUD.instance) {
          NpcHUD.instance = new NpcHUD();
        }
        return NpcHUD.instance;
    }

    setActor(actor, token = null) {
        if (!actor || actor.type !== 'threat') { 
          logger.warn("Attempted to set an invalid actor.");
          return;
        }
        this.actor = actor;
        this.token = token;
        this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') ?? false;
        
        // Store in registry
        if (actor.id) {
          npcHudRegistry.set(actor.id, this);
          logger.debug(`Registered NPC HUD by actor ID: ${actor.id}, Name: ${actor.name}`);
        }
        if (token?.id) {
          npcHudRegistry.set(token.id, this);
          logger.debug(`Registered NPC HUD by token ID: ${token.id}`);
        }
        
        // Log registry size
        logger.debug(`Registry size now: ${npcHudRegistry.size}`);
        
        this.render(true);
      }
    
    // Break down getData into smaller, more manageable functions
    async getData() {
        const data = super.getData();
        if (!this.actor) return data;
    
        // Basic data preparation
        this._prepareBasicData(data);
        
        // System-specific data preparation
        await this._prepareSystemData(data);
        
        // Prepare moves data
        this._prepareMovesData(data);
        
        // Prepare additional data (story tags, statuses)
        this._prepareAdditionalData(data);

        const tagInfluence = this.calculateNpcTagInfluence();
        const statusInfluence = this.calculateNpcStatusInfluence();
        const totalInfluence = tagInfluence + statusInfluence;

        const collective = this.getCollectiveSize();
        data.collectiveSize = collective.value;
      
        // Create an array for the collective bar (values 1 to 6)
        data.collectiveBar = [];
        for (let i = 1; i <= collective.max; i++) {
          data.collectiveBar.push({
            value: i,
            active: i <= collective.value  // Mark as active if i is less than or equal to the current value
          });
        }

        data.collectiveLabel = (data.activeSystem === "otherscape")
        ? game.i18n.localize("Otherscape.terms.collective")
        : game.i18n.localize("CityOfMist.terms.collectiveSize");
        
        // Add influence data to template
        data.tagInfluence = tagInfluence;
        data.statusInfluence = statusInfluence;
        data.totalInfluence = totalInfluence;
        data.influentialTags = this.influentialTags || [];
        data.influentialStatuses = this.influentialStatuses || [];
        
        return data;
    }
   
    _prepareBasicData(data) {
        // Pass npcAccordionState to the template
        data.npcAccordionState = game.settings.get('mist-hud', 'npcAccordionState');
    
        // Retrieve the prototype token name
        data.tokenName = this.actor.prototypeToken?.name || this.actor.name;
    
        data.isCollapsed = this.isCollapsed;
        data.name = this.actor.name;
        data.mythos = this.actor.system.mythos;
        data.tokenImage = (this.token && this.token.texture && this.token.texture.src)
            ? this.token.texture.src
            : this.actor.prototypeToken?.texture.src;
    
        // Check if Description and Biography are non-empty
        const description = this.actor.system.description || "";
        const biography = this.actor.system.biography || "";
        const hasContent = description.trim().length > 0 || biography.trim().length > 0;
    
        data.hasDescriptionBiography = hasContent;
        data.descriptionBiography = `${description.trim()}${biography.trim() ? "" + biography.trim() : ""}`;
    }
    
    async _prepareSystemData(data) {
        const system = await detectActiveSystem();
        data.activeSystem = system;
    
        // Dynamically set the spectrum/limit label
        if (system === "otherscape" || system === "legend") {
            data.spectrumLabel = "Limits";
        } else {
            data.spectrumLabel = game.i18n.localize("CityOfMist.terms.spectrums");
        }
    
        data.spectrums = this.actor.items.filter(i => i.type === 'spectrum');
    }
    
    _prepareMovesData(data) {
        // Retrieve and group Moves by subtype
        const moves = this.actor.items.filter(i => i.type === 'gmmove');
    
        if (data.activeSystem === 'otherscape') {
            this._prepareOtherscapeMoves(data, moves);
        } else {
            // Default grouping for City of Mist
            this._prepareDefaultMoves(data, moves);
        }
    }
    
    _prepareOtherscapeMoves(data, moves) {
        // Group moves specifically for Otherscape
        const limits = [];
        const specials = [];
        const threats = [];

        // Collect soft moves and classify hard moves
        const softMoves = new Map();
        moves.forEach(move => {
            const subtype = move.system.subtype;
            if (subtype === "intrusion") {
                limits.push(move);
            } else if (subtype === "hard" && !move.system.superMoveId) {
                specials.push(move);
            } else if (subtype === "soft") {
                softMoves.set(move._id, { ...move, consequences: [] });
            }
        });

        // Link hard moves to their corresponding soft move
        moves.forEach(move => {
            if (move.system.subtype === "hard" && move.system.superMoveId) {
                const parentId = move.system.superMoveId;
                if (softMoves.has(parentId)) {
                    softMoves.get(parentId).consequences.push(move);
                }
            }
        });

        // Add soft moves with consequences to threats
        threats.push(...Array.from(softMoves.values()));

        // Assign grouped moves for Otherscape
        data.moveGroups = {
            Limits: limits,
            Specials: specials,
            Threats: threats,
        };
    }
    
    _prepareDefaultMoves(data, moves) {
        data.moveGroups = moves.reduce((groups, move) => {
            let subtype = move.system.subtype || 'default';

            // City of Mist grouping logic
            switch (subtype) {
                case 'soft':
                    subtype = game.i18n.localize("CityOfMist.terms.softMove");
                    break;
                case 'hard':
                    subtype = game.i18n.localize("CityOfMist.terms.hardMoves");
                    break;
                case 'intrusion':
                    subtype = game.i18n.localize("CityOfMist.terms.intrusions");
                    break;
                case 'downtime':
                    subtype = game.i18n.localize("CityOfMist.terms.downtimeMoves");
                    break;
                case 'custom':
                    subtype = game.i18n.localize("CityOfMist.terms.customMoves");
                    break;
                case 'entrance':
                    subtype = game.i18n.localize("CityOfMist.terms.enterScene");
                    break;
                default:
                    subtype = "default";
                    break;
            }

            if (!groups[subtype]) groups[subtype] = [];
            groups[subtype].push(move);
            return groups;
        }, {});
    }
    
    _prepareAdditionalData(data) {
        // Retrieve Story Tags
        data.storyTags = this.getStoryTags();
        data.hasStoryTags = data.storyTags.length > 0;
    
        // Retrieve Statuses
        data.statuses = this.getActorStatuses();
    }    
    
    getCollectiveSize() {
        if (!this.actor || !this.actor.system) {
          return { value: 0, min: 1, max: 6, cssClasses: "npc-status npc-status-move" };
        }
        const value = Number(this.actor.system.collectiveSize ?? 0);
        return {
          value,
          min: 1,
          max: 6,
          cssClasses: "npc-status npc-status-move",
          onBarClick: (newValue) => {
            const clampedValue = Math.max(1, Math.min(newValue, 6));
            this.actor.update({ "system.collectiveSize": clampedValue });
          },
          onLabelClick: () => this.actor.update({ "system.collectiveSize": 0 })
        };
    }
      
    getActorStatuses() {
        if (!this.actor) return [];
        const collectiveSize = Number(this.actor.system.collectiveSize || 0);
        const statusMap = new Map();
      
        this.actor.items
          .filter((item) => item.type === 'status')
          .forEach((status) => {
            // Determine the status type (flag or system default)
            const statusType = status.getFlag('mist-hud', 'statusType') || status.system.specialType || 'neutral';
            const key = `${status.name}-${status.system.tier}`;
            if (!statusMap.has(key)) {
              const baseTier = Number(status.system.tier) || 1;
              // Add collectiveSize to the base tier
              const modifiedTier = baseTier + collectiveSize;
              statusMap.set(key, {
                id: status.id,
                statusName: status.name,
                statusTier: modifiedTier,
                statusType,
                temporary: !!status.system.temporary,
                permanent: !!status.system.permanent
              });
            }
          });
          
        return Array.from(statusMap.values());
    }      
    
    applyBurnState(actor, tagId, tagType) {
        const tagItem = actor.items.get(tagId);
        if (!tagItem || !tagItem.system) {
          logger.error(`Invalid or missing tag item for ID: ${tagId}`);
          return null;
        }
        
        // Determine the burn state: 0 (normal) or 1 (burned)
        const burnState = tagItem.system.burn_state === 1 ? 1 : 0;
        
        // Get the tag's positive/negative flag from the "mist-hud" namespace.
        // Defaults to "neutral" if not set.
        const tagFlag = tagItem.getFlag('mist-hud', 'tagState') || 'neutral';
      
        // Determine the appropriate CSS class based on the burn state and flag.
        let cssClass = '';
        if (burnState === 1) {
          cssClass = 'burned';
        } else {
          // Use the flag to determine the visual modifier.
          if (tagFlag === 'negative') {
            cssClass = 'negative';
          } else if (tagFlag === 'positive') {
            cssClass = 'positive';
          } else {
            cssClass = ''; // neutral state, no extra class
          }
        }
        
        return {
          id: tagId,
          tagName: tagItem.name,
          burnState,  // 0 for normal, 1 for burned
          cssClass,
          tagFlag,    // "neutral", "negative", or "positive"
          permanent: tagItem.system.permanent || false,
          temporary: tagItem.system.temporary || false,
        };
    }      
    
    getStoryTags() {
        if (!this.actor) return [];
    
        // Get all tag items
        const items = this.actor.items.contents;
        const tagItems = items.filter(item => item.type === 'tag');
    
        // Filter and process only the story tags
        const storyTags = tagItems.filter(tag => tag.system.subtype === 'story')
            .map(tag => {
                if (!tag || !tag._id || !tag.system) {
                    logger.error("Invalid tag item or missing system data in applyBurnState:", tag);
                    return null; // Skip invalid tags
                }
    
                // Apply burn state and handle inversion
                const processedTag = this.applyBurnState(this.actor, tag._id, 'story');
                if (!processedTag) return null;
                
                processedTag.tagName = tag.name;
                processedTag.tagDescription = tag.system.description || '';
                processedTag.isInverted = tag.system.inverted || false;
                processedTag.inversionIcon = processedTag.isInverted 
                    ? '<i class="fa-light fa-angles-up"></i>' 
                    : '<i class="fa-light fa-angles-down"></i>';
                return processedTag;
            }).filter(Boolean); // Remove any null or invalid entries
    
        return storyTags;
    }

    // Generic method to toggle states of tag/status items
    async _toggleItemState(element, itemType, flagName, states, systemProperty = null) {
        const itemId = itemType === 'tag' ? element.data('id') : element.data('status-id');
        
        if (!itemId) {
            logger.error(`No item ID found for ${itemType}`);
            return;
        }
        
        const actor = this.actor;
        if (!actor) {
            logger.error(`No actor found in _toggle${itemType}State`);
            return;
        }
        
        const item = actor.items.get(itemId);
        if (!item) {
            logger.error(`${itemType} with ID ${itemId} not found`);
            return;
        }
        
        // Get current state
        const currentState = item.getFlag('mist-hud', flagName) || states[0];
        const stateIndex = states.indexOf(currentState);
        const newState = states[(stateIndex + 1) % states.length];
        
        try {
            // Update flag
            await item.setFlag('mist-hud', flagName, newState);
            
            // Update system property if provided
            if (systemProperty) {
                const updateData = {};
                updateData[systemProperty] = newState;
                await item.update(updateData);
            }
            
            // Special handling for burned state if needed
            if (itemType === 'tag' && newState === 'burned') {
                await item.update({
                    "system.burn_state": 1,
                    "system.burned": true
                });
            } else if (itemType === 'tag') {
                await item.update({
                    "system.burn_state": 0,
                    "system.burned": false
                });
            }
            
            // Re-render
            this.render(false);
        } catch (error) {
            logger.error(`Error updating ${itemType} state:`, error);
        }
    }
    
    // Modified _toggleTagState to emit influence after tag state change
    async _toggleTagState(tagElement) {
        console.log("Toggling tag state for element:", tagElement);
        // Retrieve the tag ID and corresponding tag item.
        const tagId = tagElement.data('id');
        const actor = this.actor;
        if (!actor) {
            console.error("No actor found in _toggleTagState");
            return;
        }
        const tagItem = actor.items.get(tagId);
        if (!tagItem) {
            console.error(`Tag with ID ${tagId} not found`);
            return;
        }
        
        // Get the current flag value (defaulting to "neutral")
        let currentFlag = tagItem.getFlag('mist-hud', 'tagState') || 'neutral';
        // Also, check if the tag is burned
        let isBurned = tagItem.system.burn_state === 1;
        console.log(`Current tag flag: ${currentFlag}, isBurned: ${isBurned}`);
        
        // Determine the new state in the cycle: neutral → negative → positive → burned → neutral.
        let newState;
        if (isBurned) {
            newState = 'neutral';
        } else if (currentFlag === 'neutral') {
            newState = 'negative';
        } else if (currentFlag === 'negative') {
            newState = 'positive';
        } else if (currentFlag === 'positive') {
            newState = 'burned';
        }
        console.log(`New state determined: ${newState}`);
        
        // Update the DOM: remove existing state classes and add the appropriate one.
        tagElement.removeClass('negative positive burned');
        if (newState === 'negative') {
            tagElement.addClass('negative');
        } else if (newState === 'positive') {
            tagElement.addClass('positive');
        } else if (newState === 'burned') {
            tagElement.addClass('burned');
        }
        console.log("Updated DOM classes:", tagElement.attr('class'));
        
        // Update the tag item accordingly.
        try {
            if (newState === 'negative') {
            console.log("Setting state to negative");
            await tagItem.setFlag('mist-hud', 'tagState', 'negative');
            await tagItem.update({
                "system.burn_state": 0,
                "system.burned": false
            });
            } else if (newState === 'positive') {
            console.log("Setting state to positive");
            await tagItem.setFlag('mist-hud', 'tagState', 'positive');
            await tagItem.update({
                "system.burn_state": 0,
                "system.burned": false
            });
            } else if (newState === 'burned') {
            console.log("Setting state to burned");
            await tagItem.setFlag('mist-hud', 'tagState', 'neutral'); // clear the flag when burned
            await tagItem.update({
                "system.burn_state": 1,
                "system.burned": true
            });
            } else if (newState === 'neutral') {
            console.log("Setting state to neutral");
            await tagItem.setFlag('mist-hud', 'tagState', 'neutral');
            await tagItem.update({
                "system.burn_state": 0,
                "system.burned": false
            });
            }
            console.log("Tag update successful for tag ID:", tagId);
            
            // After tag state is updated, recalculate and emit NPC influence
            this.emitNpcInfluence();
            
        } catch (error) {
            console.error("Error updating tag state:", error);
        }
        
        // Re-render the HUD to reflect the change.
        this.render(false);
    }

    // Modified _toggleStatusState to emit influence after status state change
    async _toggleStatusState(statusElement) {
        console.log("Toggling status state for element:", statusElement);
        // Retrieve the status ID and corresponding status item.
        const statusId = statusElement.data('status-id');
        const actor = this.actor;
        if (!actor) {
            console.error("No actor found in _toggleStatusState");
            return;
        }
        const statusItem = actor.items.get(statusId);
        if (!statusItem) {
            console.error(`Status item with ID ${statusId} not found`);
            return;
        }
        
        // Get the current type from the flag (falling back to system field or "neutral")
        const currentType = statusItem.getFlag('mist-hud', 'statusType') || statusItem.system.specialType || 'neutral';
        console.log("Current status type (from flag or system):", currentType);
        
        let newType;
        // Cycle: neutral → negative → positive → neutral.
        if (currentType === 'neutral') {
            newType = 'negative';
        } else if (currentType === 'negative') {
            newType = 'positive';
        } else if (currentType === 'positive') {
            newType = 'neutral';
        }
        console.log("New status type determined:", newType);
        
        // Update the DOM: update the data attribute and adjust CSS classes.
        statusElement.attr('data-status-type', newType);
        // Remove any extra state classes, but keep the base "npc-status"
        statusElement.removeClass('negative positive neutral');
        if (newType !== 'neutral') {
            statusElement.addClass(newType);
        }
        console.log("Updated element classes:", statusElement.attr('class'));
        
        // Save the new state in the status document by updating the flag and optionally the system field.
        try {
            await statusItem.setFlag('mist-hud', 'statusType', newType);
            // Optionally update system.specialType as well (if needed for other parts of your system)
            await statusItem.update({ "system.specialType": newType });
            console.log(`Status item ${statusId} updated to: ${newType}`);
            
            // After status state is updated, recalculate and emit NPC influence
            this.emitNpcInfluence();
            
        } catch (error) {
            console.error("Error updating status item:", error);
        }
        
        // Re-render the HUD to reflect the change
        this.render(false);
    }                

    activateListeners(html) {
        try {
            super.activateListeners(html);
        
            // Initialize accordions
            initializeAccordions();
        
            // Inject custom header
            this.injectCustomHeader();
        
            // Close button
            html.find('.npc-close-button').click((event) => {
                event.stopPropagation();
                this.close();
            });
    
            // For NPC Story Tags
            html.find('.npc-story-tag')
            .on('click', (event) => {
                event.stopPropagation();
                event.preventDefault();
                // If it's a single click, toggle the tag state immediately.
                if (event.detail === 1) {
                this._toggleTagState($(event.currentTarget));
                }
            })
            .on('dblclick', async (event) => {
                event.stopPropagation();
                event.preventDefault();
                const tagId = $(event.currentTarget).data('id');
                const actor = this.actor;
                if (!actor) return;
                const tag = actor.items.get(tagId);
                if (!tag) {
                console.error(`Tag with ID ${tagId} not found on the actor.`);
                return;
                }                
                if (CityDialogs?.itemEditDialog) {
                    await CityDialogs.itemEditDialog(tag);
                } else {
                    tag.sheet.render(true);
                }
                this.render(false);
                this.emitNpcInfluence();
            });
    
            // For NPC Statuses
            html.find('.npc-status')
            .on('click', (event) => {
                event.stopPropagation();
                event.preventDefault();
                if (event.detail === 1) {
                this._toggleStatusState($(event.currentTarget));
                }
            })
            .on('dblclick', async (event) => {
                event.stopPropagation();
                event.preventDefault();
                const statusId = $(event.currentTarget).data('status-id');
                const actor = this.actor;
                if (!actor) return;
                const status = actor.items.get(statusId);
                if (!status) {
                console.error(`Status with ID ${statusId} not found on the actor.`);
                return;
                }
                
                if (CityDialogs?.itemEditDialog) {
                    await CityDialogs.itemEditDialog(status);
                } else {
                    status.sheet.render(true);
                }
                this.render(false);
                this.emitNpcInfluence();
            });       
    
            // Setup drag-and-drop for statuses
            html.find('.npc-status, .npc-status-moves').each((i, el) => {
                el.setAttribute('draggable', 'true');
                el.addEventListener('dragstart', (ev) => {
                  const text = el.textContent.trim();
                  let name = text;
                  let tier = 1;
            
                  const match = text.match(/^(.*?)-(\d+)$/);
                  if (match) {
                    name = match[1];
                    tier = parseInt(match[2], 10);
                  }
            
                  const statusData = {
                    type: "status",
                    name,
                    tier,
                    actorId: this.actor?.id || null
                  };
            
                  ev.dataTransfer.setData("text/plain", JSON.stringify(statusData));
                });
            });
    
            // Create NPC Story Tag
            html.find('.create-npc-tag').on("click", async (event) => {
                await this._createStoryTagFromHUD(event);
                // Recalculate and emit NPC influence after creating new tag
                this.emitNpcInfluence();
            });
    
            // Right-click (contextmenu) to delete an NPC Story Tag
            html.find('.npc-story-tag').on('contextmenu', async (event) => {
                event.preventDefault();
                const tagId = $(event.currentTarget).data('id');
                
                if (!tagId) {
                    console.error("Missing tagId for NPC story tag deletion.");
                    return;
                }
                
                // Use the unlinked actor directly
                const actor = this.actor;
                if (!actor) {
                    console.error("Actor not found on NPC HUD.");
                    return;
                }               
                
                try {
                    await actor.deleteEmbeddedDocuments("Item", [tagId]);
                    this.emitNpcInfluence();
                    this.render(false);
                } catch (error) {
                    console.error("Error deleting tag:", error);
                }
            });        
    
            // Create NPC Status
            html.find('.create-npc-status').on("click", async (event) => {
                await this._createStatusFromHUD(event);
                // Recalculate and emit NPC influence after creating new status
                this.emitNpcInfluence();
            });
    
            // Right-click (contextmenu) to delete an NPC Status
            html.find('.npc-status').on('contextmenu', async (event) => {
                event.preventDefault();
                const statusId = $(event.currentTarget).data('status-id');
                const actorId = this.actor?.id;
                
                if (!statusId || !actorId) {
                    console.error("Missing statusId or actorId for NPC status deletion.");
                    return;
                }
                
                const actor = this.actor;
                if (!actor) {
                    console.error(`Actor with ID ${actorId} not found.`);
                    return;
                }
                
                try {
                    // Delete the status
                    await actor.deleteEmbeddedDocuments("Item", [statusId]);
                    this.emitNpcInfluence();
                    this.render(false);
                } catch (error) {
                    console.error("Error deleting status:", error);
                }
            });

            html.find('.npc-refresh-influence').on('click', (event) => {
                event.preventDefault();
                this.emitNpcInfluence();
                ui.notifications.info(`NPC influence from ${this.actor.name} updated and emitted to players.`);
            });

            // Clicking a segment sets the collective size
            html.find('.npc-collective-bar .collective-segment').click((event) => {
                const newValue = Number($(event.currentTarget).data('value'));
                this.getCollectiveSize().onBarClick(newValue);
            });
    
            // Clicking on the label resets the collective size
            html.find('.npc-collective-label').click((event) => {
                this.getCollectiveSize().onLabelClick();
            });
                
            // Prevent context menu actions
            this.element.on('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
        } catch (error) {
            console.error("Error in activateListeners:", error);
        }
    }

    // Calculate NPC Influence from Story Tags
    calculateNpcTagInfluence() {
        if (!this.actor) return 0;
        
        // Get all story tags
        const storyTags = this.getStoryTags();
        
        // Filter for positive and negative tags only
        const influentialTags = storyTags.filter(tag => 
            tag.tagFlag === 'positive' || tag.tagFlag === 'negative');
        
        // Calculate the total influence value
        // Positive tags = +1, Negative tags = -1
        let totalInfluence = 0;
        
        influentialTags.forEach(tag => {
            if (tag.tagFlag === 'positive') {
                totalInfluence += 1;
            } else if (tag.tagFlag === 'negative') {
                totalInfluence -= 1;
            }
        });
        
        // Store the influentialTags for reference
        this.influentialTags = influentialTags;
        
        return totalInfluence;
    }

    // Calculate NPC Influence from Statuses
    calculateNpcStatusInfluence() {
        if (!this.actor) return 0;
        
        // Get all statuses
        const statuses = this.getActorStatuses();
        
        // Filter for positive and negative statuses only
        const influentialStatuses = statuses.filter(status => 
            status.statusType === 'positive' || status.statusType === 'negative');
        
        // Calculate the total influence value
        // The influence value is the tier of the status
        // Positive status adds the tier value, negative status subtracts it
        let totalInfluence = 0;
        
        influentialStatuses.forEach(status => {
            if (status.statusType === 'positive') {
                totalInfluence += status.statusTier;
            } else if (status.statusType === 'negative') {
                totalInfluence -= status.statusTier;
            }
        });
        
        // Store the influentialStatuses for reference
        this.influentialStatuses = influentialStatuses;
        
        return totalInfluence;
    }

    // Calculate total NPC Influence (tags + statuses)
    calculateTotalNpcInfluence() {
        const tagInfluence = this.calculateNpcTagInfluence();
        const statusInfluence = this.calculateNpcStatusInfluence();
        
        console.log(`Tag Influence: ${tagInfluence}, Status Influence: ${statusInfluence}`);
        return tagInfluence + statusInfluence;
    }

    // Emit combined NPC Influence to connected players
    emitNpcInfluence() {
        if (!this.actor) return;
        
        // Calculate current influence values
        const tagInfluence = this.calculateNpcTagInfluence();
        const statusInfluence = this.calculateNpcStatusInfluence();
        const totalInfluence = tagInfluence + statusInfluence;
        
        // Get actor ID for reference
        const npcId = this.actor.id;
        const npcName = this.actor.name;
        
        // Create influence data object with token awareness
        const influenceData = {
            npcId,
            npcName,
            // If this HUD is associated with a token, add token data
            tokenId: this.token ? this.token.id : null,
            tokenName: this.token ? this.token.name : null,
            actorLink: this.token ? this.token.document.actorLink : true,
            tagInfluence,
            statusInfluence,
            totalInfluence,
            influentialTags: this.influentialTags || [],
            influentialStatuses: this.influentialStatuses || [],
            timestamp: Date.now()
        };
        
        // Store the current influence value in the actor's flags (for GM reference)
        this.actor.setFlag('mist-hud', 'npcInfluence', influenceData)
        .then(() => {
          console.log(`NPC influence updated for ${npcName}: ${totalInfluence}`);
          
          // Update global cache
          if (this.token && !this.token.document.actorLink) {
            globalThis.activeNpcInfluences[this.token.id] = influenceData;
          } else {
            globalThis.activeNpcInfluences[npcId] = influenceData;
          }
          
          // Emit via socket to all connected players
          game.socket.emit('module.mist-hud', {
            type: 'npcInfluence',
            data: influenceData
          });
          
          // Notify clients of change (only if GM)
          if (game.user.isGM) {
            game.socket.emit('module.mist-hud', {
              type: 'npcInfluenceUpdated'
            });
          }
        })
        .catch(error => {
          console.error("Error updating NPC influence flag:", error);
        });
    }

    async render(force = false, options = {}) {
        try {
          await super.render(force, options);
          // After rendering, check the isCollapsed flag.
          if (this.isCollapsed) {
            this.element.addClass("collapsed");
          } else {
            this.element.removeClass("collapsed");
          }
        } catch (error) {
          logger.error("Error during NpcHUD render:", error);
        }
    }    

    async close(options) {
        try {
          // Remove references from registry
          if (this.actor?.id) {
            npcHudRegistry.delete(this.actor.id);
            logger.debug(`Removed NPC HUD from registry for actor ID: ${this.actor.id}`);
          }
          if (this.token?.id) {
            npcHudRegistry.delete(this.token.id);
            logger.debug(`Removed NPC HUD from registry for token ID: ${this.token.id}`);
          }
          
          // Log registry size
          logger.debug(`Registry size now: ${npcHudRegistry.size}`);
          
          // Clean up event handlers
          if (this.element) {
            this.element.off('contextmenu');
          }
          
          return await super.close(options);
        } catch (err) {
          logger.error("Error closing NPC HUD:", err);
          return false;
        }
      }

    injectCustomHeader() {
        // Use this.element to access the entire application window
        const header = this.element.find('.window-header');
        const window_title = header.find('.window-title')[0];
        if (window_title) window_title.style.display = "None";
        
        if (header.length === 0) {
          logger.warn("Header element not found during injection!");
          return;
        }
    
        // Clear existing header content
        header.empty();
        // we need to keep window title for compatibility to foundry Application render
        header.append(window_title);
      
        // Create custom header elements
        const tokenImgSrc = this.actor?.token?.texture.src || this.actor?.img || 'icons/svg/mystery-man.svg';
    
        const tokenImg = $(`<div class="mh-token-image"><img src="${tokenImgSrc}" alt="${this.actor?.name || 'Character'} Token"></div>`);
        const charName = $(`<div class="mh-char-name">${this.actor?.name || 'Character'}</div>`);
        const closeButton = $(`<i class="mh-close-button fa-solid fa-xmark"></i>`);
      
        // Append custom elements to the header
        header.append(tokenImg, charName, closeButton);

        // Add event listener to the close button
        closeButton.on("click", () => this.close());
   
        // Add a custom class for additional styling if needed
        header.addClass('mh-custom-header');
      
        // Handle minimized state
        const minimizedState = this.element.find('.window-title');
        if (minimizedState.length) {
          minimizedState.empty(); // Clear default content
          minimizedState.append(tokenImg.clone(), closeButton.clone()); // Add image and close button

          // Rebind close event for the minimized state button
          minimizedState.find('.mh-close-button').on("click", () => this.close());
        }
    }
       
    async _createStatusFromHUD(event) {
        event.stopPropagation();
      
        const owner = this.actor;
        if (!owner) {
            console.error("Actor not found for status creation.");
            return;
        }
      
        try {
            // Create a new status with a default name
            let obj;
            if (owner.createNewStatus) {
                obj = await owner.createNewStatus("Unnamed Status");
            } else {
                const createdItems = await owner.createEmbeddedDocuments("Item", [{
                    name: "Unnamed Status",
                    type: "status",
                    system: {
                        tier: 1
                    }
                }]);
                obj = createdItems[0];
            }
      
            if (!obj) {
                console.error("Failed to create a new status.");
                return;
            }
          
            // Retrieve the newly created status
            const status = owner.getStatus ? 
                          owner.getStatus(obj.id) : 
                          owner.items.get(obj.id);
                          
            if (!status) {
                console.error(`Status with ID ${obj.id} not found.`);
                return;
            }
            
            // Try different methods for editing depending on available API
            let updated = false;
            if (CityDialogs?.itemEditDialog) {
                updated = await CityDialogs.itemEditDialog(status);
            } else if (window.CityHelpers?.itemDialog) {
                updated = await window.CityHelpers.itemDialog(status);
            } else {
                // Fallback to default item sheet
                status.sheet.render(true);
                updated = true;
            }
          
            if (!updated) {
                // Delete the status if the dialog is canceled
                if (owner.deleteStatus) {
                    await owner.deleteStatus(obj.id);
                } else {
                    await owner.deleteEmbeddedDocuments("Item", [obj.id]);
                }
            }
          
            // Refresh the HUD
            this.render(false);
        } catch (error) {
            console.error("Error in _createStatusFromHUD:", error);
        }
    }

    async _createStoryTagFromHUD(event) {
        event.stopPropagation();
        
        const owner = this.actor;
        if (!owner) {
            console.error("Actor not found for tag creation.");
            return;
        }
      
        try {
            // Define default data for a new tag.
            // Adjust the type and system defaults as needed for your system.
            const tagData = {
              name: "Unnamed Tag",
              type: "tag",  // Use the appropriate type for story tags
              system: {
                description: "",
                subtype: "story",
                // ... other default fields
              }
            };
          
            // Create the tag as an embedded document on the actor.
            let created = await owner.createEmbeddedDocuments("Item", [tagData]);
            if (!created || !created[0]) {
              console.error("Failed to create a new story tag.");
              return;
            }
            
            // Retrieve the newly created tag.
            const tag = owner.getEmbeddedDocument ? 
                      owner.getEmbeddedDocument("Item", created[0].id) : 
                      owner.items.get(created[0].id);
                      
            if (!tag) {
              console.error(`Tag with ID ${created[0].id} not found.`);
              return;
            }
            
            // Open the dialog to edit the tag.
            let updated = false;
            if (CityDialogs?.itemEditDialog) {
                updated = await CityDialogs.itemEditDialog(tag);
            } else {
                // Fallback to default item sheet
                tag.sheet.render(true);
                updated = true;
            }
            
            if (!updated) {
              // If the dialog is cancelled, delete the tag.
              await owner.deleteEmbeddedDocuments("Item", [created[0].id]);
            }
            
            // Refresh the HUD.
            this.render(false);
        } catch (error) {
            console.error("Error in _createStoryTagFromHUD:", error);
        }
    }

}

async function runFullNpcHudRegistryTest() {
    console.group("NPC HUD Registry Test Suite");
    
    // Test 1: Basic Registry State
    console.log("Test 1: Current Registry State");
    const initial = testNpcHudRegistry();
    
    // Test 2: Actor Select Test
    console.log("\nTest 2: Actor Selection Test");
    const testActor = game.actors.find(a => a.type === 'threat');
    if (testActor) {
      console.log(`Testing with actor: ${testActor.name}`);
      const hud = new NpcHUD();
      hud.setActor(testActor);
      await new Promise(r => setTimeout(r, 100)); // Give time to render
      
      const afterOpen = testNpcHudRegistry();
      console.log(`Registry size change: ${initial.size} → ${afterOpen.size}`);
      
      // Check if properly registered
      const hasEntry = npcHudRegistry.has(testActor.id);
      console.log(`Actor properly registered: ${hasEntry}`);
      
      // Test 3: Closing Test
      console.log("\nTest 3: HUD Closing Test");
      await hud.close();
      await new Promise(r => setTimeout(r, 100)); // Give time to close
      
      const afterClose = testNpcHudRegistry();
      console.log(`Registry size change: ${afterOpen.size} → ${afterClose.size}`);
      
      // Check if properly removed
      const stillHasEntry = npcHudRegistry.has(testActor.id);
      console.log(`Actor properly removed: ${!stillHasEntry}`);
    } else {
      console.warn("No threat actors found for testing");
    }
    
    // Test 4: Registry-Instance Relationship Test
    console.log("\nTest 4: Registry-Instance Relationship Test");
    const mismatchedEntries = [];
    for (const [id, instance] of npcHudRegistry.entries()) {
      if (instance.actor && instance.actor.id !== id && !id.startsWith("Token.")) {
        mismatchedEntries.push({
          registryId: id,
          actorId: instance.actor.id
        });
      }
    }
    
    if (mismatchedEntries.length > 0) {
      console.warn("Mismatched registry entries found:", mismatchedEntries);
    } else {
      console.log("All registry entries match their instances correctly");
    }
    
    console.groupEnd();
  }

// Synchronize all NPC influences when a scene loads
Hooks.on('canvasReady', async () => {
    // Only GM should recalculate and broadcast all influences
    if (game.user.isGM) {
        // Find all threat-type NPCs in the current scene
        const sceneTokenIds = canvas.tokens.placeables
            .filter(t => t.actor && t.actor.type === 'threat')
            .map(t => t.id);
            
        // Find all corresponding HUDs
        for (const tokenId of sceneTokenIds) {
            const token = canvas.tokens.get(tokenId);
            if (!token || !token.actor) continue;
            
            // Get or create HUD instance
            let npcHud = npcHudRegistry.get(tokenId) || npcHudRegistry.get(token.actor.id);
            
            // If no HUD exists, create one
            if (!npcHud) {
                npcHud = new NpcHUD();
                npcHud.setActor(token.actor, token);
            }
            
            // Calculate and emit influence
            npcHud.emitNpcInfluence();
            
            // Add a small delay to prevent socket congestion
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        logger.debug(`Synchronized influences for ${sceneTokenIds.length} NPCs in scene`);
    }
});

// Add a method to sync all influences (can be called manually if needed)
export async function syncAllNpcInfluences() {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can synchronize all NPC influences");
        return;
    }
    
    // Find all NPC-type actors
    const npcActors = game.actors.filter(a => a.type === 'threat');
    
    let counter = 0;
    
    // Process each actor
    for (const actor of npcActors) {
        // Find existing HUD or create new one
        let npcHud = npcHudRegistry.get(actor.id);
        
        if (!npcHud) {
            npcHud = new NpcHUD();
            npcHud.setActor(actor);
        }
        
        // Emit influence data
        npcHud.emitNpcInfluence();
        counter++;
        
        // Add a small delay to prevent socket congestion
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    ui.notifications.info(`Synchronized influences for ${counter} NPCs`);
    return counter;
}

// Add a command that can be run from the console
globalThis.syncAllNpcInfluences = syncAllNpcInfluences;

// Re-register the original hooks in the original way
Hooks.once("init", () => {
    Handlebars.registerHelper("parseMaxTier", function (maxTier) {
        return maxTier === 999 ? "-" : maxTier;
    });

    Handlebars.registerHelper("parseStatus", function (description, options) {
        // Retrieve collectiveSize from the root data context (provided by getData)
        const collectiveSize = Number(options.data.root.collectiveSize || 0);
        return new Handlebars.SafeString(
          description
            .replace(/\[([^\]]+)\]/g, (match, content) => {
              const trimmedContent = content.trim();
              const statusRegex = /^([a-zA-Z]+(?:[-\s][a-zA-Z]+)*)-(\d+)$/;
              if (statusRegex.test(trimmedContent)) {
                const randomId = generateRandomId();
                const matches = trimmedContent.match(statusRegex);
                const statusName = matches[1];
                const baseTier = Number(matches[2]);
                // Calculate the modified tier by adding collectiveSize
                const newTier = baseTier + collectiveSize;
                return `<span class="npc-status-moves" data-status-name="${statusName}" data-tier="${newTier}" data-status-id="${randomId}" data-temporary="false" data-permanent="false">${statusName}-${newTier}</span>`;
              }
              if (/^[a-zA-Z]+(?:\s[a-zA-Z]+)*:\d+$/.test(trimmedContent)) {
                return `<span class="npc-limit">${trimmedContent}</span>`;
              }
              return `<span class="npc-story-tag">${trimmedContent}</span>`;
            })
            .replace(/\s*$/gm, '')
            .replace(/\n+/g, '</p><p>')
            .replace(/^<\/p><p>/, '')
            .replace(/<p><\/p>/g, '')
        );
      });
      




    // Handlebars.registerHelper("parseStatus", function (description) {
    //     return new Handlebars.SafeString(
    //         description
    //         .replace(/\[([^\]]+)\]/g, (match, content) => {
    //           const trimmedContent = content.trim();
    //           // Expect statuses formatted as "Name-Number"
    //           const statusRegex = /^([a-zA-Z]+(?:[-\s][a-zA-Z]+)*)-(\d+)$/;
    //           if (statusRegex.test(trimmedContent)) {
    //             const randomId = generateRandomId();
    //             const matches = trimmedContent.match(statusRegex);
    //             const statusName = matches[1];
    //             const baseTier = Number(matches[2]);
    //             // Calculate new tier by adding collectiveSize
    //             const newTier = baseTier + collectiveSize;
    //             return `<span class="npc-status-moves" data-status-name="${statusName}" data-tier="${newTier}" data-status-id="${randomId}" data-temporary="false" data-permanent="false">${statusName}-${newTier}</span>`;
    //           }
    //             if (/^[a-zA-Z]+(?:\s[a-zA-Z]+)*:\d+$/.test(trimmedContent)) {
    //               return `<span class="npc-limit">${trimmedContent}</span>`;
    //             }
    //             return `<span class="npc-story-tag">${trimmedContent}</span>`;
    //           })
    //           .replace(/\s*$/gm, '')
    //           .replace(/\n+/g, '</p><p>')
    //           .replace(/^<\/p><p>/, '')
    //           .replace(/<p><\/p>/g, '')
    //       );
    // });
});

// Keep the original hook registration format
Hooks.on('renderTokenHUD', (app, html, data) => {
    if (!game.user.isGM) return;

    // Get the token instance from the HUD rendering context
    const token = app.object;
    const actor = token.actor;
    if (actor && actor.type === 'threat') {
        // Create a new HUD instance for this actor/token and pass both
        const hud = new NpcHUD();
        hud.setActor(actor, token);
        hud.render(true);
        
        // Save this instance in the registry (here keyed by the token id)
        npcHudRegistry.set(token.id, hud);
    }
});

Hooks.on('updateActor', (actor, data, options, userId) => {
    if (!game.user.isGM) return;

    // Get the HUD instance for this actor (if it exists)
    const hud = npcHudRegistry.get(actor.id);
    if (hud) {
        hud.render(false); // Re-render this specific HUD
    }
});

// Listen for item updates
Hooks.on('updateItem', (item, data, options, userId) => {
    if (!item.parent) return;
    
    const hud = npcHudRegistry.get(item.parent.id);
    if (hud) {
        hud.render(false); // Re-render the corresponding HUD
    }
});

// Optional: Handle actor deletion
Hooks.on('deleteActor', (actor, options, userId) => {
    const hud = npcHudRegistry.get(actor.id);
    if (hud) {
        hud.close();       // Close the HUD window
        npcHudRegistry.delete(actor.id);  // Remove it from our registry
    }
});

// Add scene cleanup
Hooks.on('canvasReady', () => {
    // Optional: Clear HUDs when changing scenes
    // This helps avoid stale HUDs persisting across scene changes
    for (const [id, hud] of npcHudRegistry.entries()) {
        // Check if this is a token ID and the token no longer exists on the current scene
        const isTokenId = id.startsWith('Token.');
        if (isTokenId && !canvas.tokens.get(id)) {
            try {
                hud.close();
                npcHudRegistry.delete(id);
            } catch (e) {
                console.warn(`Error cleaning up HUD for ${id}:`, e);
            }
        }
    }
});

// Handle tag/status creation
Hooks.on('createItem', (item, options, userId) => {
    // Only process if this is a tag or status on an NPC
    if (!item.parent || item.parent.type !== 'threat') return;
    if (!['tag', 'status'].includes(item.type)) return;
    
    // Get the parent NPC
    const npc = item.parent;
    
    // Find the matching HUD instance
    const npcHud = npcHudRegistry.get(npc.id);
    if (npcHud) {
        // Recalculate and emit the new influence values
        npcHud.emitNpcInfluence();
    }
});

// Handle tag/status deletion
Hooks.on('deleteItem', (item, options, userId) => {
    // Only process if this is a tag or status on an NPC
    if (!item.parent || item.parent.type !== 'threat') return;
    if (!['tag', 'status'].includes(item.type)) return;
    
    // Get the parent NPC
    const npc = item.parent;
    
    // Find the matching HUD instance
    const npcHud = npcHudRegistry.get(npc.id);
    if (npcHud) {
        // Recalculate and emit the new influence values
        npcHud.emitNpcInfluence();
    }
});

// Handle modifications to tag/status properties
Hooks.on('updateItem', (item, changes, options, userId) => {
    // Only process if this is a tag or status on an NPC
    if (!item.parent || item.parent.type !== 'threat') return;
    if (!['tag', 'status'].includes(item.type)) return;
    
    // Get the parent NPC
    const npc = item.parent;
    
    // Check if any relevant fields were changed
    const relevantChanges = [
        'system.burn_state', 
        'system.burned', 
        'system.tier', 
        'system.specialType'
    ];
    
    // Check for flag changes
    const hasFlagChanges = options.flags && 
        (options.flags['mist-hud']?.tagState || 
         options.flags['mist-hud']?.statusType);
         
    // Check if any system changes affect influence
    const hasSystemChanges = Object.keys(changes.system || {})
        .some(key => relevantChanges.includes(`system.${key}`));
    
    // Only emit if relevant changes were made
    if (hasFlagChanges || hasSystemChanges) {
        // Find the matching HUD instance
        const npcHud = npcHudRegistry.get(npc.id);
        if (npcHud) {
            // Recalculate and emit the new influence values
            npcHud.emitNpcInfluence();
        }
    }
});
globalThis.npcHudRegistry = npcHudRegistry;
export default NpcHUD;
//export { NpcHUD };


