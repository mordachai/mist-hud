import { initializeAccordions } from './accordion-handler.js';
import { detectActiveSystem } from './mh-settings.js';
import { StoryTagDisplayContainer } from "/systems/city-of-mist/module/story-tag-window.js";
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";

// Global registry to store NPC HUD instances by actor ID
const npcHudRegistry = new Map();

let clickTimer;
const clickDelay = 300; // milliseconds

export class NpcHUD extends Application {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
          id: 'npc-hud',
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
            console.warn("Attempted to set an invalid actor.");
            return;
        }
        this.actor = actor;
        this.token = token; // Save the token reference if provided
        this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') ?? false; // Ensure boolean default
        this.render(true);
    }  
    
    async getData() {
        const data = super.getData();
        if (!this.actor) return data;
    
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
    
        const system = await detectActiveSystem();
        data.activeSystem = system;
    
        // Dynamically set the spectrum/limit label
        if (system === "otherscape" || system === "legend") {
            data.spectrumLabel = "Limits";
        } else {
            data.spectrumLabel = "Spectrums";
        }
    
        data.spectrums = this.actor.items.filter(i => i.type === 'spectrum');
    
        // Retrieve and group Moves by subtype
        const moves = this.actor.items.filter(i => i.type === 'gmmove');
    
        if (data.activeSystem === 'otherscape') {
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
        } else {
            // Default grouping for City of Mist
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
    
        // Retrieve Story Tags
        data.storyTags = this.getStoryTags();
        data.hasStoryTags = data.storyTags.length > 0;
    
        // Retrieve Statuses
        data.statuses = this.getActorStatuses();
    
        return data;
    }
     
    getActorStatuses() {
        if (!this.actor) return [];
    
        const statusMap = new Map();
    
        this.actor.items
            .filter((item) => item.type === 'status')
            .forEach((status) => {
                const key = `${status.name}-${status.system.tier}`;
                if (!statusMap.has(key)) {
                    statusMap.set(key, {
                        id: status.id,
                        statusName: status.name,
                        statusTier: status.system.tier,
                        statusType: status.system.specialType || 'neutral',
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
            console.error(`Invalid or missing tag item for ID: ${tagId}`);
            return {
                id: tagId,
                burnState: "unburned",
                cssClass: "unburned",
                burnIcon: '<i class="fa-light fa-fire"></i>',
                permanent: false,
                temporary: false,
                isInverted: false,
                inversionIcon: tagType === 'story'
                    ? '<i class="fa-regular fa-angles-up"></i>'
                    : '<i class="fa-light fa-angles-down"></i>',
            };
        }
    
        let burnState;
        if (tagItem.system.burned) {
            burnState = "burned";
        } else if (tagItem.system.burn_state === 1) {
            burnState = "toBurn";
        } else {
            burnState = "unburned";
        }
    
        const cssClass = burnState;
        const burnIcon = burnState === "burned"
            ? '<i class="fa-solid fa-fire"></i>'
            : burnState === "toBurn"
            ? '<i class="fa-regular fa-fire"></i>'
            : '<i class="fa-light fa-fire"></i>';
    
        const permanent = tagItem.system.permanent || false;
        const temporary = tagItem.system.temporary || false;
        const isInverted = tagItem.system.inverted || false;
    
        const inversionIcon = isInverted
            ? '<i class="fa-light fa-angles-down"></i>'
            : (tagType === 'story' ? '<i class="fa-regular fa-angles-up"></i>' : '<i class="fa-light fa-angles-down"></i>');
    
        return {
            id: tagId,
            tagName: tagItem.name,
            burnState,
            cssClass,
            burnIcon,
            permanent,
            temporary,
            isInverted,
            inversionIcon,
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
                    console.error("Invalid tag item or missing system data in applyBurnState:", tag);
                    return null; // Skip invalid tags
                }
    
                // Apply burn state and handle inversion
                const processedTag = this.applyBurnState(this.actor, tag._id, 'story');
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
          console.error("Error during NpcHUD render:", error);
        }
    }    

    injectCustomHeader() {
    
        // Use this.element to access the entire application window
        const header = this.element.find('.window-header');
        const window_title = header.find('.window-title')[0];
        window_title.style.display = "None";
        if (header.length === 0) {
          console.warn("Header element not found during injection!");
          return;
        }
    
        // Clear existing header content
        header.empty();
        // we need to keep window title for compatibility to foundry Application render
        header.append(window_title);
      
        // Create custom header elements
        const tokenImgSrc = this.actor?.token?.texture.src || this.actor?.img || 'default-token.png';
    
        const tokenImg = $(`<div class="mh-token-image"><img src="${this.actor?.token?.texture.src || this.actor?.img}" alt="Character Token"></div>`);
        const charName = $(`<div class="mh-char-name">${this.actor?.name || 'Character'}</div>`);
        const closeButton = $(`<i class="mh-close-button fa-solid fa-xmark"></i>`); // Using FontAwesome for the close icon
      
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

    activateListeners(html) {
        super.activateListeners(html);
    
        // Initialize accordions
        initializeAccordions();
    
        // Inject custom header
        this.injectCustomHeader();
    
        // Close button
        html.find('.npc-close-button').click((event) => {
            event.stopPropagation();
            this.saveHUDPosition();
            this.close();
        });

        html.find('.npc-story-tag')
        .on('click', (event) => {
          event.stopPropagation();
          event.preventDefault();
          // Clear any existing timer.
          if (clickTimer) clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            // Use the method on the HUD instance.
            this._toggleTagState($(event.currentTarget));
            clickTimer = null;
          }, clickDelay);
        })
        .on('dblclick', async (event) => {
          event.stopPropagation();
          event.preventDefault();
          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
          }
          const tagId = $(event.currentTarget).data('id');
          const actor = this.actor;
          if (!actor) return;
          const tag = actor.items.get(tagId);
          if (!tag) {
            console.error(`Tag with ID ${tagId} not found on the unlinked actor.`);
            return;
          }
          await CityDialogs.itemEditDialog(tag);
          this.render(false);
        });

        html.find('.npc-status')
        .on('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(async () => {
            await this._toggleStatusState($(event.currentTarget));
            clickTimer = null;
            }, clickDelay);
        })
        .on('dblclick', async (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            }
            const statusId = $(event.currentTarget).data('status-id');
            const actor = this.actor;
            if (!actor) return;
            const status = actor.items.get(statusId);
            if (!status) {
            console.error(`Status with ID ${statusId} not found on the unlinked actor.`);
            return;
            }
            await CityDialogs.itemEditDialog(status);
            this.render(false);
        });           

        html.find('.npc-status').each((i, el) => {
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
        html.find('.create-npc-tag').on("click", this._createStoryTagFromHUD.bind(this));

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
            
            await actor.deleteEmbeddedDocuments("Item", [tagId]);
            this.render(false);
        });        

        // Create NPC Status
        html.find('.create-npc-status').on("click", this._createStatusFromHUD.bind(this));

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
            
            // Assumes your actor has a method `deleteStatus`
            await actor.deleteEmbeddedDocuments("Item", [statusId]);
            this.render(false); // Refresh the HUD after deletion
        });
            
        // Prevent context menu actions
        this.element.on('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
    }

    async _toggleTagState(tagElement) {
        // Retrieve the tag ID from the element.
        const tagId = tagElement.data('id');
        // Use the HUD's actor property.
        const actor = this.actor;
        if (!actor) return;
        
        const tagItem = actor.items.get(tagId);
        if (!tagItem) return;
        
        // Determine the new state.
        // We'll assume three states: "unburned" (default), "selected", and "burned".
        let newState;
        if (tagElement.hasClass('burned')) {
          newState = 'unburned';
        } else if (tagElement.hasClass('selected')) {
          newState = 'burned';
        } else {
          newState = 'selected';
        }
        
        // Update the DOM: remove the possible classes and add the new one.
        tagElement.removeClass('unburned selected burned').addClass(newState);
        
        // Define the data to update based on the new state.
        let updateData = {};
        if (newState === 'burned') {
          updateData = { "system.burn_state": 2, "system.burned": true };
        } else if (newState === 'selected') {
          updateData = { "system.burn_state": 1, "system.burned": false };
        } else {  // unburned
          updateData = { "system.burn_state": 0, "system.burned": false };
        }
        
        // Update the embedded tag document so that the state is saved.
        await tagItem.update(updateData);
        // Re-render the HUD so that the state persists on subsequent renders.
        this.render(false);
    }
      
    async _toggleStatusState(statusElement) {
    // Retrieve the status ID from the element.
    const statusId = statusElement.data('status-id');
    const actor = this.actor;
    if (!actor) return;
    
    const statusItem = actor.items.get(statusId);
    if (!statusItem) return;
    
    // Cycle through the types: positive -> negative -> neutral -> positive...
    const currentType = statusElement.attr('data-status-type') || 'neutral';
    let newType;
    if (currentType === 'positive') {
        newType = 'negative';
    } else if (currentType === 'negative') {
        newType = 'neutral';
    } else {
        newType = 'positive';
    }
    
    // Update the DOM.
    statusElement.attr('data-status-type', newType);
    statusElement.removeClass('neutral positive negative').addClass(newType);
    
    // Update the embedded status document.
    await statusItem.update({ "system.specialType": newType });
    }

    async _createStatusFromHUD(event) {
        event.stopPropagation();
      
        const owner = this.actor;
        if (!owner) {
            console.error("Actor not found for status creation.");
            return;
        }
      
        // Create a new status with a default name
        const obj = await owner.createNewStatus("Unnamed Status");
        if (!obj) {
            console.error("Failed to create a new status.");
            return;
        }
      
        // Retrieve the newly created status
        const status = owner.getStatus(obj.id);
        if (!status) {
            console.error(`Status with ID ${obj.id} not found.`);
            return;
        }
      
        // Open the dialog to edit the status
        const updateObj = await CityHelpers.itemDialog(status);
        if (updateObj) {
            CityHelpers.modificationLog(owner, "Created", status, `${status.system.amount || ""}`);
        } else {
            // Delete the status if the dialog is canceled
            await owner.deleteStatus(obj.id);
        }
      
        // Refresh the HUD to display the new status
        this.render(false);
    }

    async _createStoryTagFromHUD(event) {
        event.stopPropagation();
        
        const owner = this.actor;
        if (!owner) {
            console.error("Actor not found for tag creation.");
            return;
        }
      
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
        const tag = owner.getEmbeddedDocument("Item", created[0].id);
        if (!tag) {
          console.error(`Tag with ID ${created[0].id} not found.`);
          return;
        }
        
        // Open the dialog to edit the tag.
        // (Using CityDialogs.itemEditDialog as in your player HUD.)
        const updateObj = await CityDialogs.itemEditDialog(tag);
        if (updateObj) {
          // Optionally log or handle the successful update here.
          console.log("Tag updated:", tag);
        } else {
          // If the dialog is cancelled, delete the tag.
          await owner.deleteEmbeddedDocuments("Item", [created[0].id]);
        }
        
        // Refresh the HUD.
        this.render(false);
    }      
   
}

  
  

Hooks.once("init", () => {
    console.log("Registering Handlebars helpers...");

    Handlebars.registerHelper("parseMaxTier", function (maxTier) {
        return maxTier === 999 ? "-" : maxTier;
    });

    Handlebars.registerHelper("parseStatus", function (description) {
        return new Handlebars.SafeString(
            description
                .replace(/\[([^\]]+)\]/g, (match, content) => {
                    const trimmedContent = content.trim();
                    if (/^[a-zA-Z]+(?:[-\s][a-zA-Z]+)*-\d+$/.test(trimmedContent)) {
                        return `<span class="npc-status">${trimmedContent}</span>`;
                    }
                    if (/^[a-zA-Z]+(?:\s[a-zA-Z]+)*:\d+$/.test(trimmedContent)) {
                        return `<span class="npc-limit">${trimmedContent}</span>`;
                    }
                    return `<span class="npc-story-tag">${trimmedContent}</span>`;
                })
                .replace(/^\s*$/gm, '') // Remove empty lines
                .replace(/\n+/g, '</p><p>') // Replace newlines with paragraph breaks
                .replace(/^<\/p><p>/, '') // Remove leading <p> if the first line is empty
                .replace(/<p><\/p>/g, '') // Remove empty <p> elements
        );
    });
});

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


export default NpcHUD;
