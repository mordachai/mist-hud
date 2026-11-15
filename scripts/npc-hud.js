import { initializeAccordions, registerNpcHelpers } from './npc-helpers.js';
import { detectActiveSystem } from './settings.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";

globalThis.activeNpcInfluences = globalThis.activeNpcInfluences || {};
let gameJustLoaded = true;

Hooks.once('ready', () => {
    // Mark the game as just loaded
    gameJustLoaded = true;
    
    // Reset the flag after a small delay to allow the game to fully initialize
    setTimeout(() => {
      gameJustLoaded = false;
      console.log("Game load period ended, NPC HUDs will now function normally");
    }, 2000); // 2 second delay
  });

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

// Global registry of open NPC HUD windows. Each HUD is stored under two keys:
// its token id (one HUD per token) and its actor id (points at the most
// recently opened HUD for that actor; unlinked tokens share the actor id).
const npcHudRegistry = new Map();

/** Every registered HUD exactly once. */
function allNpcHuds() {
  return new Set(npcHudRegistry.values());
}

/** Open HUDs showing exactly this actor (a synthetic token actor only matches its own token). */
function hudsForActor(actor) {
  if (!actor) return [];
  return [...allNpcHuds()].filter(hud =>
    hud.actor && (hud.actor === actor || hud.actor.uuid === actor.uuid));
}

/** Open HUDs whose actor has `templateActor` attached as a challenge template. */
function hudsUsingTemplate(templateActor) {
  if (!templateActor) return [];
  return [...allNpcHuds()].filter(hud => {
    if (!hud.actor || hud.actor === templateActor) return false;
    try {
      return (hud.actor.getAttachedTemplates?.() ?? []).some(t => t?.id === templateActor.id);
    } catch (e) {
      return false;
    }
  });
}

/**
 * Compute and broadcast the influence of one threat without opening a window.
 * Uses the open HUD for that actor if there is one, otherwise a throwaway
 * instance that is never rendered or registered.
 */
function emitInfluenceFor(actor, token = null) {
  if (!game.user.isGM) return;
  if (!actor || actor.type !== 'threat') return;

  const open = hudsForActor(actor);
  if (open.length) {
    open[0].emitNpcInfluence();
    return;
  }

  const headless = new NpcHUD();
  headless.actor = actor;
  headless.token = token ?? actor.token?.object ?? null;
  headless.emitNpcInfluence();
}



// Simple logging helper - won't break existing code
const logger = {
  debug: (...args) => console.debug("NPC-HUD |", ...args),
  info: (...args) => console.info("NPC-HUD |", ...args),
  warn: (...args) => console.warn("NPC-HUD |", ...args),
  error: (...args) => console.error("NPC-HUD |", ...args)
};

export class NpcHUD extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @type {Actor|null} */
    actor = null;
    /** @type {Token|null} */
    token = null;

    static DEFAULT_OPTIONS = {
        id: 'npc-hud',  // Overridden per token: openForToken() passes npc-hud-<tokenId>
        classes: ['npc-hud'],
        window: {
            frame: true,
            positioned: true,
            resizable: false,
            minimizable: true,
            title: "MistHUD.window.npcHud"
        },
        position: { width: 310, height: 'auto', left: 950, top: 120 }
    };

    static PARTS = {
        app: { template: 'modules/mist-hud/templates/npc-hud.hbs' }
    };

    get title() {
        return this.actor?.name || game.i18n.localize("MistHUD.window.npcHud");
    }

    /**
     * Open the HUD for a token, or bring the existing one to the front.
     * There is at most one HUD window per token.
     */
    static openForToken(token) {
        const actor = token?.actor;
        if (!actor || actor.type !== 'threat') return null;

        const existing = npcHudRegistry.get(token.id);
        if (existing && existing.token?.id === token.id) {
            existing.token = token;
            if (existing.rendered) {
                if (existing.minimized) existing.maximize();
                existing.bringToFront();
            } else {
                existing.render({ force: true });
            }
            return existing;
        }

        // Unique DOM id per token so several HUDs can be open at once, and a
        // cascaded start position so new windows do not stack exactly.
        const used = new Set([...allNpcHuds()].map(hud => hud._cascadeSlot));
        let slot = 0;
        while (used.has(slot)) slot++;
        const offset = 32 * (slot % 10);
        const base = NpcHUD.DEFAULT_OPTIONS.position;

        const hud = new NpcHUD({
            id: `npc-hud-${token.id ?? actor.id}`,
            position: { left: base.left + offset, top: base.top + offset }
        });
        hud._cascadeSlot = slot;
        hud.setActor(actor, token);
        return hud;
    }

    /**
     * @param {Actor} actor
     * @param {Token|null} token
     * @param {object} [options]
     * @param {boolean} [options.render=true]  false: only attach the actor (no window, no registry entry)
     */
    setActor(actor, token = null, { render = true } = {}) {
        if (!actor || actor.type !== 'threat') {
            logger.warn("Attempted to set an invalid actor.");
            return;
        }

        // Re-targeting a HUD that is already registered: drop its old keys first
        this._unregister();

        this.actor = actor;
        this.token = token;
        this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') ?? false;

        // Headless use (influence calculation only): no window, no registry entry.
        if (!render) return;

        if (actor.id) npcHudRegistry.set(actor.id, this);
        if (token?.id) npcHudRegistry.set(token.id, this);

        this.render({ force: true });
    }

    /** Remove this HUD's registry keys, leaving other HUDs of the same actor reachable. */
    _unregister() {
        const tokenId = this.token?.id;
        const actorId = this.actor?.id;
        if (tokenId && npcHudRegistry.get(tokenId) === this) {
          npcHudRegistry.delete(tokenId);
        }
        if (actorId && npcHudRegistry.get(actorId) === this) {
          npcHudRegistry.delete(actorId);
          // Another HUD may still be open for the same actor (unlinked tokens)
          const other = [...allNpcHuds()].find(hud => hud !== this && hud.actor?.id === actorId);
          if (other) npcHudRegistry.set(actorId, other);
        }
    }
    
    async _prepareContext(options) {
        const data = await super._prepareContext(options);
        if (!this.actor) return data;
    
        // Make sure the actor is fully loaded
        if (!this.actor.id || !this.actor.items) {
          console.warn("NpcHUD: Actor not fully loaded yet");
          return data; // Return early with minimal data
        }
    
        try {
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

            const activeSystem = data.activeSystem || "cityofmist";
            data.activeSystem = activeSystem;
          
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
        } catch (error) {
            console.error("Error in NpcHUD _prepareContext:", error);
            // Return minimal data that won't cause template errors
            data.spectrums = [];
            data.moveGroups = {};
            data.storyTags = [];
            data.hasStoryTags = false;
            data.statuses = [];
            data.collectiveBar = [];
            return data;
        }
    }
   
    _prepareBasicData(data) {
        // Pass npcAccordionState to the template
        data.npcAccordionState = game.settings.get('mist-hud', 'npcAccordionState');
    
        // Retrieve the prototype token name
        data.tokenName = this.actor.prototypeToken?.name || this.actor.name;
    
        data.isCollapsed = this.isCollapsed;
        data.name = this.actor.name;
        data.pronouns = this.actor.pronouns ?? [];
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
    
        // getSpectrums() also returns the limits of attached challenge templates.
        // (It pushes into the array returned by the `my_spectrums` getter, which is
        // a fresh filter() result on every call, so nothing accumulates.)
        data.spectrums = typeof this.actor.getSpectrums === 'function'
            ? [...this.actor.getSpectrums()]
            : this.actor.items.filter(i => i.type === 'spectrum');
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

    _prepareMovesData(data) {
        // getGMMoves() also returns the moves of attached challenge templates.
        // The HUD only displays moves (no edit/delete), so template-owned moves,
        // which belong to another actor, are never written to from here.
        const moves = typeof this.actor.getGMMoves === 'function'
            ? this.actor.getGMMoves()
            : this.actor.items.filter(i => i.type === 'gmmove');

        if (data.activeSystem === 'otherscape') {
            this._prepareOtherscapeMoves(data, moves);
        } else if (data.activeSystem === 'legend') {
            this._prepareLegendMoves(data, moves);
            this._prepareLegendCustomMoves(data);
        } else {
            this._prepareDefaultMoves(data, moves);
        }
    }

    _prepareOtherscapeMoves(data, moves) {
        // Group moves specifically for Otherscape
        const limits = [];
        const specials = [];
        const threats = [];
        const custom = [];

        // Collect soft moves and classify hard moves
        const softMoves = new Map();
        moves.forEach(move => {
            const subtype = move.system.subtype;
            if (subtype === "intrusion") {
                limits.push(move);
            } else if (subtype === "hard" && !move.system.superMoveId) {
                specials.push(move);
            } else if (subtype === "custom") {
                custom.push(move);
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
            Custom: custom,
        };
    }

    _prepareLegendMoves(data, moves) {
        // Group moves specifically for Legends in the Mist
        const limits = [];
        const specials = [];
        const threats = [];
        const custom = [];

        // Collect soft moves and classify other moves
        const softMoves = new Map();
        moves.forEach(move => {
            const subtype = move.system.subtype;
            if (subtype === "intrusion") {
                limits.push(move);
            } else if (subtype === "hard" && !move.system.superMoveId) {
                specials.push(move);
            } else if (subtype === "custom") {
                custom.push(move);
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

        // Assign grouped moves for Legend
        data.moveGroups = {
            Limits: limits,
            Specials: specials,
            Threats: threats,
            Custom: custom,
        };
    }

    _prepareLegendCustomMoves(data) {
        // Only process if we're in legend system and have custom moves
        if (data.activeSystem !== "legend" || !data.moveGroups.Custom?.length) return;

        // Map from marker → CSS class
        const ICON_MAP = {
            G: "mighty-greatness-icn",
            O: "mighty-origin-icn", 
            A: "mighty-adventure-icn"
        };

        // Process each custom move for Legend system
        data.moveGroups.Custom = data.moveGroups.Custom.map(move => {
            const desc = move.system.description || "";
            
            // For Legend system, always process the description 
            // Replace -X- or --X-- patterns with proper HTML, or use original description
            const processedDesc = desc.replace(/-{1,2}([GOA])-{1,2}\s*([^,\n]+)/g, (match, tag, text) => {
                const iconClass = ICON_MAP[tag];
                return `<span class="mighty-icon ${iconClass}"></span><span class="mighty-description">${text.trim()}</span>`;
            });
            
            // Create plain object with processed description
            return {
                _id: move._id,
                name: move.name,
                type: move.type,
                system: move.system,
                img: move.img,
                legendCustom: {
                    processedDescription: processedDesc
                }
            };
        });
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
        const statusMap = new Map();
      
        this.actor.items
          .filter((item) => item.type === 'status')
          .forEach((status) => {
            // Determine the status type (flag or system default)
            const statusType = status.getFlag('mist-hud', 'statusType') || status.system.specialType || 'neutral';
            const key = `${status.name}-${status.system.tier}`;
            if (!statusMap.has(key)) {
              const baseTier = Number(status.system.tier) || 1;
              
              // Don't add collectiveSize to any statuses in the NPC HUD status list
              statusMap.set(key, {
                id: status.id,
                statusName: status.name,
                statusTier: baseTier, // Use baseTier directly without adding collectiveSize
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
            this.render();
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
        this.render();
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
        this.render();
    }                

    _onRender(context, options) {
        super._onRender(context, options);
        const html = $(this.element);
        try {
            this.element.classList.toggle("collapsed", !!this.isCollapsed);

            // Initialize accordions
            initializeAccordions(this.element);

            // Inject custom header
            this.injectCustomHeader();
        
            // Close button
            html.find('.npc-close-button').click((event) => {
                event.stopPropagation();
                this.close();
            });


            //SCENE TAGS LISTENER WILL NOT USE FOR NOW
            // html.find('.npc-status-moves[data-scene-tag="true"], .npc-story-tag[data-scene-tag="true"]').on('click', async (event) => {
            //     event.stopPropagation();
            //     event.preventDefault();
                
            //     if (game.user.isGM) {
            //     try {
            //         await handleSceneTag($(event.currentTarget));
            //         ui.notifications.info("Added to scene tags/statuses");
            //     } catch (error) {
            //         console.error("Error adding to scene:", error);
            //         ui.notifications.error("Failed to add to scene");
            //     }
            //     }
            // });
            
            
            //For NPC Story Tags            
            html.find('.npc-story-tag:not(.not-clickable)')
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
                this.render();
                this.emitNpcInfluence();
            });

            //For NPC Statuses
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
                this.render();
                this.emitNpcInfluence();
            }); 
            
            // STATUSES AND STORY TAGS DRAGGABLE    
            
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
                // Prefer the data attributes ("name-X" has no numeric tier in its text)
                if (el.dataset.statusName) {
                    name = el.dataset.statusName;
                    tier = parseInt(el.dataset.tier, 10) || 1;
                }

                // Get temp/perm flags directly from the element
                const element = $(el);
                const isTemporary = element.attr('data-temporary') === 'true';
                const isPermanent = element.attr('data-permanent') === 'true';

                // Only add these properties if they are true
                const statusData = {
                    type: "status",
                    name,
                    tier,
                    actorId: this.actor?.id || null
                };
                
                // Add temp/perm only if they're true
                if (isTemporary) statusData.temporary = true;
                if (isPermanent) statusData.permanent = true;

                ev.dataTransfer.setData("text/plain", JSON.stringify(statusData));
                });
            });

            html.find('.npc-story-tag:not(.not-clickable), .npc-story-tag-moves:not(.not-clickable)').each((i, el) => {
                el.setAttribute('draggable', 'true');
                el.addEventListener('dragstart', (ev) => {
                  // Get tag data
                  const tagElement = $(el);
                  const name = tagElement.text().trim();
                  const tagId = tagElement.data('id');
                  const isInverted = tagElement.hasClass('inverted');
                  const cssClass = tagElement.hasClass('positive') ? 'positive' : 
                                  tagElement.hasClass('negative') ? 'negative' : '';
                  const actorId = this.actor?.id || null;
                  const temporary = tagElement.data('temporary') || false;
                  const permanent = tagElement.data('permanent') || false;
                  
                  // Build a data object
                  const tagData = {
                    type: "story-tag",
                    name,
                    isInverted,
                    actorId,
                    cssClass,
                    temporary,
                    permanent
                  };
                  
                  // Store it in the dataTransfer
                  ev.dataTransfer.setData("text/plain", JSON.stringify(tagData));
                });
            });

    
            // Create NPC Story Tag
            html.find('.create-npc-tag').on("click", async (event) => {
                await this._createStoryTagFromHUD(event);
                // Recalculate and emit NPC influence after creating new tag
                this.emitNpcInfluence();
            });
    
            // Right-click (contextmenu) to delete an NPC Story Tag
            html.find('.npc-story-tag:not(.not-clickable)').on('contextmenu', async (event) => {
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
                    this.render();
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
                    this.render();
                } catch (error) {
                    console.error("Error deleting status:", error);
                }
            });

            html.find('.npc-refresh-influence').on('click', (event) => {
                event.preventDefault();
                this.emitNpcInfluence();
                ui.notifications.info(game.i18n.format("MistHUD.notify.influenceEmitted", { name: this.actor.name }));
            });

            // Clicking a segment sets the collective size
            html.find('.npc-collective-bar .npc-collective-segment').click((event) => {
                const newValue = Number($(event.currentTarget).data('value'));
                this.getCollectiveSize().onBarClick(newValue);
            });
    
            // Clicking on the label resets the collective size
            html.find('.npc-collective-label').click((event) => {
                this.getCollectiveSize().onLabelClick();
            });
                
            // Prevent context menu actions (the root element persists across renders: bind once)
            if (!this._contextMenuBound) {
                this._contextMenuBound = true;
                this.element.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                });
            }
        } catch (error) {
            console.error("Error in NpcHUD _onRender:", error);
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

    _onClose(options) {
        // Remove references from registry (only the ones that point at this HUD)
        this._unregister();
        super._onClose?.(options);
    }

    injectCustomHeader() {
        const header = $(this.element).find('.window-header');
        if (!header.length) {
            logger.warn("Header element not found during injection!");
            return;
        }

        header.find('.window-title').hide();
        header.find('.mh-token-image, .mh-char-name, .mh-close-button').remove();

        // Built with DOM APIs (.attr/.text): the actor name and image path are user-editable.
        const name = this.actor?.name || 'Character';
        const src = this.token?.document?.texture?.src
            ?? this.actor?.prototypeToken?.texture?.src
            ?? this.actor?.img
            ?? 'icons/svg/mystery-man.svg';

        const tokenImg = $('<div class="mh-token-image"></div>')
            .append($('<img>').attr({ src, alt: name }));
        const charName = $('<div class="mh-char-name"></div>').text(name);

        // ApplicationV2 already provides the controls (⋮ menu, minimize, close).
        header.append(tokenImg, charName);
        header.addClass('mh-custom-header');
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
                obj = await owner.createNewStatus(game.i18n.localize("MistHUD.npcHud.unnamedStatus"));
            } else {
                const createdItems = await owner.createEmbeddedDocuments("Item", [{
                    name: game.i18n.localize("MistHUD.npcHud.unnamedStatus"),
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
            this.render();
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
              name: game.i18n.localize("MistHUD.npcHud.unnamedTag"),
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
            this.render();
        } catch (error) {
            console.error("Error in _createStoryTagFromHUD:", error);
        }
    }

}

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
            
            // Calculate and emit influence without opening a window
            emitInfluenceFor(token.actor, token);

            // Add a small delay to prevent socket congestion
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        logger.debug(`Synchronized influences for ${sceneTokenIds.length} NPCs in scene`);
    }
});

// Add a method to sync all influences (can be called manually if needed)
export async function syncAllNpcInfluences() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("MistHUD.notify.gmOnlySyncAll"));
        return;
    }
    
    // Find all NPC-type actors
    const npcActors = game.actors.filter(a => a.type === 'threat');
    
    let counter = 0;
    
    // Process each actor
    for (const actor of npcActors) {
        // Emit influence data without opening a window
        emitInfluenceFor(actor);
        counter++;
        
        // Add a small delay to prevent socket congestion
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    ui.notifications.info(game.i18n.format("MistHUD.notify.syncedNpcs", { count: counter }));
    return counter;
}

// Add a method to handle scene tags (can be integrated into your NpcHUD class)
async function handleSceneTag(tagElement) {
    console.log("handleSceneTag called for element:", tagElement);
    console.log("Scene tag attribute:", tagElement.attr('data-scene-tag'));
    
    // Only process tags marked as scene tags - use attr() instead of data()
    if (tagElement.attr('data-scene-tag') !== 'true') {
      console.log("Not a scene tag, returning");
      return;
    }
    
    // Determine if it's a status or a story tag
    const isStatus = tagElement.hasClass('npc-status-moves');
    
    try {
      if (isStatus) {
        // Handle status scene tag
        const statusName = tagElement.attr('data-status-name');
        const tier = parseInt(tagElement.attr('data-tier'), 10);
        const isTemporary = tagElement.attr('data-temporary') === 'true';
        const isPermanent = tagElement.attr('data-permanent') === 'true';
        
        console.log(`Creating scene status: ${statusName}-${tier}, temp: ${isTemporary}, perm: ${isPermanent}`);
        
        // Use the system's createSceneStatus function
        if (game.user.isGM) {
          // Pass optional parameters for temporary/permanent
          const options = {
            temporary: isTemporary,
            permanent: isPermanent
          };
          
          // Call the system function to create the scene status
          const createdStatus = await CityOfMist.createSceneStatus(statusName, tier, 0, options);
          
          if (createdStatus) {
            ui.notifications.info(game.i18n.format("MistHUD.notify.addedStatusToScene", { name: `${statusName}-${tier}` }));
            return createdStatus;
          }
        }
      } else {
        // Handle story tag
        const tagName = tagElement.text().trim();
        const isTemporary = tagElement.attr('data-temporary') === 'true';
        const isPermanent = tagElement.attr('data-permanent') === 'true';
        
        console.log(`Creating scene tag: ${tagName}, temp: ${isTemporary}, perm: ${isPermanent}`);
        
        // Use the system's createSceneTag function
        if (game.user.isGM) {
          // The system expects parameters in this order (name, options)
          const options = {
            temporary: isTemporary,
            permanent: isPermanent
          };
          
          // Call the system function to create the scene tag
          const createdTag = await CityOfMist.createSceneTag(tagName, options);
          
          if (createdTag) {
            ui.notifications.info(game.i18n.format("MistHUD.notify.addedTagToScene", { name: tagName }));
            return createdTag;
          }
        }
      }
    } catch (error) {
      console.error("Error adding to scene tags/statuses:", error);
      ui.notifications.error(game.i18n.localize("MistHUD.notify.addToSceneFailed"));
    }
}

// Add a command that can be run from the console
globalThis.syncAllNpcInfluences = syncAllNpcInfluences;

/**
 * Recompute and broadcast the influence of every threat token on the current
 * scene, without opening any window. GM only.
 * @returns {Promise<number>} number of tokens synchronised
 */
export async function syncSceneInfluences() {
    if (!game.user?.isGM || !canvas?.tokens) return 0;
    let count = 0;
    for (const token of canvas.tokens.placeables) {
        if (token.actor?.type !== 'threat') continue;
        emitInfluenceFor(token.actor, token);
        count++;
        await new Promise(resolve => setTimeout(resolve, 50)); // avoid socket congestion
    }
    return count;
}

// Register Handlebars helpers (once, from npc-helpers.js)
Hooks.once("init", () => {
    registerNpcHelpers();
});

// Hooks.on('controlToken', (token, controlled) => {
//     // If game just loaded, don't open HUDs
//     if (gameJustLoaded) {
//       console.log("Game just loaded - skipping HUD open");
//       return;
//     }
  
//     console.log("Token control changed:", token, controlled);
    
//     // Original hook behavior continues from here
//     if (controlled && token.actor && token.actor.type === 'character') {
//       // Check if the user has ownership of the token
//       if (!token.isOwner) {
//         console.log("User doesn't have ownership of the selected token");
//         return; // Do nothing if the user doesn't own the token
//       }
      
//       // Get all currently selected tokens
//       const selectedTokens = canvas.tokens.controlled;
      
//       // If we have exactly one token selected, show its HUD
//       if (selectedTokens.length === 1) {
//         // Close any existing HUDs first
//         for (const [actorId, hud] of playerHudRegistry.entries()) {
//           if (actorId !== token.actor.id) {
//             hud.close();
//           }
//         }
        
//         // Create or get the HUD for this actor
//         const hud = MistHUD.getOrCreateHudForActor(token.actor);
        
//         // Make sure it's rendered
//         if (hud && !hud.rendered) {
//           hud.render(true);
//         }
        
//         console.log("HUD result:", hud);
//       }
//     } else if (!controlled) {
//       // Only close if no tokens are selected
//       if (canvas.tokens.controlled.length === 0) {
//         const hud = playerHudRegistry.get(token.actor?.id);
//         if (hud) hud.close();
//       }
//     }
//   });

Hooks.on('renderTokenHUD', (app, html, data) => {
    // Skip if game just loaded or user is not GM
    if (gameJustLoaded || !game.user.isGM) return;

    // Get the token instance from the HUD rendering context
    const token = app.object;
    const actor = token.actor;
    if (actor && actor.type === 'threat') {
        // One HUD per token: opens it, or brings the existing one to the front
        NpcHUD.openForToken(token);
    }
});

Hooks.on('updateActor', (actor, data, options, userId) => {
    if (!game.user.isGM) return;

    // Re-render the HUDs of this actor, and of actors using it as a template
    for (const hud of [...hudsForActor(actor), ...hudsUsingTemplate(actor)]) {
        hud.render();
    }
});

// Listen for item updates
Hooks.on('updateItem', (item, data, options, userId) => {
    if (!item.parent) return;

    for (const hud of hudsForActor(item.parent)) {
        hud.render(); // Re-render the corresponding HUD
    }
    // Moves and limits of a challenge template are shown on the HUDs of the actors using it
    if (['gmmove', 'spectrum'].includes(item.type)) {
        for (const hud of hudsUsingTemplate(item.parent)) hud.render();
    }
});

// Optional: Handle actor deletion
Hooks.on('deleteActor', (actor, options, userId) => {
    // Unlinked tokens share the id of their base actor, so match by id here
    for (const hud of allNpcHuds()) {
        if (hud.actor?.id === actor.id) hud.close(); // close() also unregisters
    }
});

// Scene cleanup: close HUDs whose token is not on the scene that was just drawn
Hooks.on('canvasReady', () => {
    for (const hud of allNpcHuds()) {
        const tokenId = hud.token?.id;
        if (!tokenId) continue; // actor-only HUD, not tied to a scene

        const current = canvas.tokens?.get(tokenId);
        if (current) {
            // Same scene redrawn: the placeable was recreated, keep the reference fresh
            hud.token = current;
            continue;
        }
        try {
            hud.close();
        } catch (e) {
            console.warn(`Error cleaning up HUD for token ${tokenId}:`, e);
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
    // Recalculate and emit the new influence values (works with or without an open HUD)
    emitInfluenceFor(npc);
});

// Handle tag/status deletion
Hooks.on('deleteItem', (item, options, userId) => {
    // Only process if this is a tag or status on an NPC
    if (!item.parent || item.parent.type !== 'threat') return;
    if (!['tag', 'status'].includes(item.type)) return;
    
    // Get the parent NPC
    const npc = item.parent;
    
    // Find the matching HUD instance
    // Recalculate and emit the new influence values (works with or without an open HUD)
    emitInfluenceFor(npc);
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
    const hasFlagChanges = !!(changes.flags?.['mist-hud']?.tagState
        || changes.flags?.['mist-hud']?.statusType);
         
    // Check if any system changes affect influence
    const hasSystemChanges = Object.keys(changes.system || {})
        .some(key => relevantChanges.includes(`system.${key}`));
    
    // Only emit if relevant changes were made
    if (hasFlagChanges || hasSystemChanges) {
        // Find the matching HUD instance
        // Recalculate and emit the new influence values (works with or without an open HUD)
        emitInfluenceFor(npc);
    }
});
globalThis.npcHudRegistry = npcHudRegistry;
export default NpcHUD;
//export { NpcHUD };


