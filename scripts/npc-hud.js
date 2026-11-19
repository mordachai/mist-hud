import { initializeAccordions, parseMoveText, registerNpcHelpers } from './npc-helpers.js';
import { detectActiveSystem } from './settings.js';
import { attachFoldBehaviour, scheduleFold, cancelFold } from './hud-fold.js';
import { bindDropTarget } from './drop-relay.js';
import { HudSettingsForm } from './settings-forms.js';
import { getSelectionDirection, setSelectionDirection, selectionInfluence } from './hud-state.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";

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

/** "positive" / "negative" / "" for a selection direction (1 / -1 / 0). */
function directionClass(direction) {
  if (direction > 0) return 'positive';
  if (direction < 0) return 'negative';
  return '';
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
            title: "MistHUD.window.npcHud",
            // The ⋮ menu: the HUD Settings form (fixes phase 5).
            controls: [{
                icon: "fa-solid fa-gear",
                label: "MistHUD.settingsForm.hud.title",
                action: "openHudSettings",
            }],
        },
        position: { width: 310, height: 'auto', left: 950, top: 120 },
        actions: {
            openSheet: NpcHUD.#onOpenSheet,
            openHudSettings: () => HudSettingsForm.open(),
        },
    };

    /** Close every open NPC HUD (the "HUD for NPCs" setting turned off). */
    static closeAll() {
        for (const hud of allNpcHuds()) {
            if (hud.rendered) void hud.close();
        }
    }

    /** Header button: open the actor's sheet and close the HUD. */
    static async #onOpenSheet(event) {
        event.preventDefault();
        const actor = this.actor;
        await this.close();
        actor?.sheet?.render(true);
    }

    static PARTS = {
        app: { template: 'modules/mist-hud/templates/npc-hud.hbs' }
    };

    get title() {
        return this.actor?.name || game.i18n.localize("MistHUD.window.npcHud");
    }

    /**
     * Open the HUD for a token, or bring the existing one to the front.
     * There is at most one HUD window per token. Without a token (sheet opened
     * from the sidebar, no token on the scene) the HUD is tied to the actor only.
     */
    static toggleForToken(token, actor = token?.actor) {
        const existing = npcHudRegistry.get(token?.id ?? actor?.id);
        const same = existing && (token ? existing.token?.id === token.id : !existing.token);
        if (same && existing.rendered && !existing.minimized) return existing.minimize();
        return NpcHUD.openForToken(token, actor);
    }

    static openForToken(token, actor = token?.actor) {
        if (!actor || actor.type !== 'threat') return null;

        const existing = npcHudRegistry.get(token?.id ?? actor.id);
        if (existing && (token ? existing.token?.id === token.id : !existing.token)) {
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
            id: `npc-hud-${token?.id ?? actor.id}`,
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
    
            const { tagInfluence, statusInfluence, totalInfluence } = selectionInfluence(this.actor);

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
            // The text runs to the next comma or line break; commas inside [brackets] don't count.
            const withIcons = desc.replace(/-{1,2}([GOA])-{1,2}\s*((?:\[[^\]]*\]|[^,\n])+)/g, (match, tag, text) => {
                const iconClass = ICON_MAP[tag];
                return `<span class="mighty-icon ${iconClass}"></span><span class="mighty-description">${text.trim()}</span>`;
            });

            // Then the shared move-text notation ([tag], [status-2], $name, ...).
            // No header: a Might line already carries its own icon.
            const processedDesc = parseMoveText(withIcons, {
                collectiveSize: this.actor.system.collectiveSize,
                name: data.name,
                pronouns: data.pronouns,
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
            // Selected for or against in the system's selection
            const statusType = directionClass(getSelectionDirection(status)) || 'neutral';
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
        
        // Burned (system test), else selected for/against in the system's selection
        const burned = tagItem.isBurned?.() ?? (!!tagItem.system.burned && tagItem.system.burn_state !== 0);
        const tagFlag = burned ? 'neutral' : (directionClass(getSelectionDirection(tagItem)) || 'neutral');
        const cssClass = burned ? 'burned' : (tagFlag === 'neutral' ? '' : tagFlag);

        return {
          id: tagId,
          tagName: tagItem.name,
          burnState: burned ? 1 : 0,
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

    /**
     * Click on a story tag. Cycle: neutral → negative → positive → burned → neutral.
     * Selection goes through the system's SelectedTagsAndStatus and burning
     * through the system's tag.burnTag(), so the token tooltip, the sheets and
     * the influence viewer all show the same state.
     */
    async _toggleTagState(tagElement) {
        const tag = this.actor?.items.get(tagElement.data('id'));
        if (!tag) return;

        try {
            if (tag.isBurned()) {
                await tag.burnTag(0);
            } else {
                const direction = getSelectionDirection(tag);
                if (direction === 0) setSelectionDirection(tag, -1);
                else if (direction < 0) setSelectionDirection(tag, 1);
                else {
                    setSelectionDirection(tag, 0);
                    await tag.burnTag(1);
                }
            }
        } catch (error) {
            console.error("Error updating tag state:", error);
        }
        this._afterSelectionChange();
    }

    /** Click on a status. Cycle: neutral → negative → positive → neutral (system selection). */
    async _toggleStatusState(statusElement) {
        const status = this.actor?.items.get(statusElement.data('status-id'));
        if (!status) return;

        const direction = getSelectionDirection(status);
        setSelectionDirection(status, direction === 0 ? -1 : direction < 0 ? 1 : 0);
        this._afterSelectionChange();
    }

    /** The system's sheets do not listen to selection changes: redraw this actor's open sheet. */
    _afterSelectionChange() {
        this.render();
        const sheet = this.actor?.sheet;
        if (sheet?.rendered) sheet.render(false);
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

                // Right-click sits next to click-to-select: confirm before
                // deleting, as the player HUD does.
                const name = Handlebars.escapeExpression(actor.items.get(tagId)?.name ?? "");
                const ok = await foundry.applications.api.DialogV2.confirm({
                    window: { title: game.i18n.localize("MistHUD.hud.deleteTag") },
                    content: `<p>${game.i18n.format("MistHUD.hud.deleteTagConfirm", { tag: name })}</p>`,
                });
                if (!ok) return;

                try {
                    await actor.deleteEmbeddedDocuments("Item", [tagId]);
                    this.render();
                } catch (error) {
                    console.error("Error deleting tag:", error);
                }
            });        
    
            // Create NPC Status
            html.find('.create-npc-status').on("click", async (event) => {
                await this._createStatusFromHUD(event);
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
                
                // Right-click sits next to click-to-select: confirm before deleting.
                const { statusName, tier } = event.currentTarget.dataset;
                const label = Handlebars.escapeExpression(`${statusName ?? ""}-${tier ?? ""}`);
                const ok = await foundry.applications.api.DialogV2.confirm({
                    window: { title: game.i18n.localize("MistHUD.hud.deleteStatus") },
                    content: `<p>${game.i18n.format("MistHUD.hud.deleteStatusConfirm", { status: label })}</p>`,
                });
                if (!ok) return;

                try {
                    // Delete the status
                    await actor.deleteEmbeddedDocuments("Item", [statusId]);
                    this.render();
                } catch (error) {
                    console.error("Error deleting status:", error);
                }
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

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        attachFoldBehaviour(this);
        // Deck cards and system draggables (chat statuses, tags) dropped on the
        // HUD go to its actor, the system's way (non-owners ask a GM).
        bindDropTarget(this.element, () => this.actor);
    }

    async maximize() {
        await super.maximize();
        scheduleFold(this);
    }

    _onClose(options) {
        cancelFold(this);
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
        header.find('.mh-token-image, .mh-char-name, .mh-close-button, .mh-open-sheet').remove();

        // Open-sheet button, placed before the ⋮ menu (handled by the openSheet action).
        if (this.actor?.sheet) {
            const label = game.i18n.localize('MistHUD.hud.openSheet');
            const btn = $('<button type="button" class="header-control icon fa-solid fa-id-card mh-open-sheet" data-action="openSheet"></button>')
                .attr({ 'data-tooltip': label, 'aria-label': label });
            const firstControl = header.find('.header-control').first();
            if (firstControl.length) firstControl.before(btn);
            else header.append(btn);
        }

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

// Register Handlebars helpers (once, from npc-helpers.js)
Hooks.once("init", () => {
    registerNpcHelpers();
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

// Selection changes (this HUD, the system's sheets, token tooltip, scene tags
// window) redraw every open NPC HUD. Debounced: one click can fire several hooks.
let _selectionRenderTimer = null;
function _rerenderNpcHudsSoon() {
    clearTimeout(_selectionRenderTimer);
    _selectionRenderTimer = setTimeout(() => {
        for (const hud of allNpcHuds()) if (hud.rendered) hud.render();
    }, 50);
}
Hooks.on("TagOrStatusSelected",     _rerenderNpcHudsSoon);
Hooks.on("TagOrStatusSelectChange", _rerenderNpcHudsSoon);

globalThis.npcHudRegistry = npcHudRegistry;
export default NpcHUD;
//export { NpcHUD };


