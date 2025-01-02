import { initializeAccordions } from './accordion-handler.js';
import { detectActiveSystem } from './mh-settings.js';

export class NpcHUD extends Application {
    static instance = null;

    constructor(options = {}) {
        super(options);
        this.actor = null;
        this.isCollapsed = false;
    }

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

    setActor(actor) {
        if (!actor || actor.type !== 'threat') { // Adjust 'character' to your actual actor type
          console.warn("Attempted to set an invalid actor.");
          return;
        }
        this.actor = actor;
        this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') || false;
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
        data.tokenImage = this.actor.prototypeToken.texture.src;

        // Check if Description and Biography are non-empty
        const description = this.actor.system.description || "";
        const biography = this.actor.system.biography || "";
        const hasContent = description.trim().length > 0 || biography.trim().length > 0;

        data.hasDescriptionBiography = hasContent;
        data.descriptionBiography = `${description.trim()}${biography.trim() ?"" + biography.trim() : ""}`;
    
        
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
        data.moves = this.actor.items.filter(i => i.type === 'gmmove');

        data.moveGroups = data.moves.reduce((groups, move) => {
            let subtype = move.system.subtype || 'default';

            // Check the active system
            if (data.activeSystem === 'city-of-mist') {
                // City of Mist switch case
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
                }
            } else if (data.activeSystem === 'otherscape') {
                // Otherscape switch case
                switch (subtype) {
                    case 'soft':
                        subtype = "";
                        break;
                    case 'hard':
                        subtype = "Specials";
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
                }
            }

            // Group moves by subtype
            if (!groups[subtype]) groups[subtype] = [];
            groups[subtype].push(move);
            return groups;
        }, {});
    
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

    async toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        await this.actor.setFlag('mist-hud', 'isCollapsed', this.isCollapsed);
        this.saveHUDPosition();
        this.render(false);
    }

    async render(force = false, options = {}) {
        try {
          await super.render(true);
        } catch (error) {
          console.error("Deu Error during NpcHUD render:", error);
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

    // activateListeners(html) {
    //     super.activateListeners(html);

    //     // Initialize accordions
    //     initializeAccordions();

    //     // Find the window header within the entire element
    //     const header = this.element.find('.window-header');
        
    //     if (header.length === 0) {
    //         console.warn("Header element not found during injection!");
    //         return;
    //     }

    //     // Inject the custom header without passing any parameters
    //     this.injectCustomHeader();

    //        // Close button
    //     html.find('.npc-close-button').click((event) => {
    //         event.stopPropagation();
    //         this.saveHUDPosition();
    //         this.close();
    //     });
    
    //     // Story tag selection toggle
    //     html.find('.npc-story-tag').on('click', (event) => {
    //         event.stopPropagation();
    //         event.preventDefault();
    //         const tagElement = $(event.currentTarget);
    
    //         // Prevent selection if burned
    //         if (tagElement.hasClass('burned')) return;
    
    //         // Toggle the selected state
    //         tagElement.toggleClass('selected');
    //     });
    
    //     // Burn icon toggle for story tags
    //     html.find('.mh-burn-toggle').on('click', async (event) => {
    //         event.stopPropagation();
    //         event.preventDefault();
            
    //         const burnElement = $(event.currentTarget);
    //         const tagElement = burnElement.closest('.npc-story-tag');
    //         const tagId = tagElement.data('id');
    
    //         const currentState = burnElement.hasClass('burned') ? "burned" :
    //                              burnElement.hasClass('toBurn') ? "toBurn" : "unburned";
    
    //         // Determine new state
    //         const newState = currentState === "unburned" ? "toBurn" :
    //                          currentState === "toBurn" ? "burned" : "unburned";
    
    //         // Update the DOM classes for the icon and text
    //         burnElement.removeClass('unburned toBurn burned').addClass(newState);
    //         tagElement.removeClass('unburned toBurn burned selected').addClass(newState); // Also remove 'selected'
    
    //         // Update text state if necessary
    //         const newIcon = this.getIcon(newState);
    //         burnElement.html(newIcon);
    
    //         if (newState === "burned") {
    //             tagElement.removeClass('selected');
    //         }
    
    //         // Update the tag's state in the actor's data
    //         const tagItem = this.actor.items.get(tagId);
    //         if (tagItem) {
    //             const updatedState = newState === "burned";
    //             const burnState = newState === "toBurn" ? 1 : 0;
    //             await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
    //         }
    //     });
    
    //     this.element.on('contextmenu', (event) => {
    //         event.preventDefault();
    //         event.stopPropagation();
    //     });
    // }

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
    
        // Toggle state for NPC story tags
        html.find('.npc-story-tag').on('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
    
            const tagElement = $(event.currentTarget);
    
            // Toggle between `selected` and `burned`
            if (tagElement.hasClass('burned')) {
                tagElement.removeClass('burned').addClass('unburned');
            } else if (tagElement.hasClass('selected')) {
                tagElement.removeClass('selected').addClass('burned');
            } else {
                tagElement.addClass('selected');
            }
        });
    
        // Cycle status types for NPC statuses
        html.find('.npc-status').on('click', async (event) => {
            event.stopPropagation();
            event.preventDefault();
        
            const statusElement = $(event.currentTarget);
            const statusId = statusElement.data('status-id');
        
            // Cycle through status types: positive -> negative -> neutral
            const currentType = statusElement.attr('data-status-type');
            let newType = 'positive'; // Default to positive if neutral
        
            if (currentType === 'positive') {
                newType = 'negative';
            } else if (currentType === 'negative') {
                newType = 'neutral';
            }
        
            // Update the DOM
            statusElement.attr('data-status-type', newType);
            statusElement.removeClass('neutral positive negative').addClass(newType);
        
            // Update the actor's data
            const statusItem = this.actor.items.get(statusId);
            if (statusItem) {
                await statusItem.update({ "system.specialType": newType });
            }
        });        
    
        // Prevent context menu actions
        this.element.on('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
    }
    
    
}


// Register the parseStatus helper
Handlebars.registerHelper('parseStatus', function(description) {
    return new Handlebars.SafeString(
        description
            // First check if there are any (tc) markers
            .replace(/\(tc\)([\s\S]*?)\(\/tc\)/g, (match, content) => {
                // Process content within (tc)...(/tc)
                return content
                    .replace(/\(t\)(.*?)\(\/t\)/gs, (match, innerContent) => {
                        const processed = innerContent.trim().replace(/\[([^\]]+)\]/g, (match, tagContent) => {
                            const trimmedContent = tagContent.trim();
                            if (/^[a-zA-Z]+(?:[-\s][a-zA-Z]+)*-\d+$/.test(trimmedContent)) {
                                return `<span class="npc-status">${trimmedContent}</span>`;
                            }
                            if (/^[a-zA-Z]+(?:\s[a-zA-Z]+)*:\d+$/.test(trimmedContent)) {
                                return `<span class="npc-limit">${trimmedContent}</span>`;
                            }
                            return `<span class="npc-story-tag">${trimmedContent}</span>`;
                        });
                        return `<p class="npc-threat"><span class="npc-tc-marker">›</span> ${processed}</p>`;
                    })
                    .replace(/\(c\)(.*?)\(\/c\)/gs, (match, innerContent) => {
                        const processed = innerContent.trim().replace(/\[([^\]]+)\]/g, (match, tagContent) => {
                            const trimmedContent = tagContent.trim();
                            if (/^[a-zA-Z]+(?:[-\s][a-zA-Z]+)*-\d+$/.test(trimmedContent)) {
                                return `<span class="npc-status">${trimmedContent}</span>`;
                            }
                            if (/^[a-zA-Z]+(?:\s[a-zA-Z]+)*:\d+$/.test(trimmedContent)) {
                                return `<span class="npc-limit">${trimmedContent}</span>`;
                            }
                            return `<span class="npc-story-tag">${trimmedContent}</span>`;
                        });
                        return `<p class="npc-consequence"><span class="npc-tc-marker">»</span> ${processed}</p>`;
                    })
                    .replace(/\s*\n\s*/g, ' ') // Replace newlines with space inside (tc)
                    .replace(/<\/p>\s*<p>/g, '</p><p>'); // Clean up spacing between paragraphs
            })
            // For content outside (tc) or when no (tc) markers exist, apply simpler processing
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
            .replace(/\n/g, '</p><p>') // Handle regular newlines as paragraph breaks
    );
});

Handlebars.registerHelper('parseMaxTier', function (maxTier) {
    return maxTier === 999 ? '-' : maxTier;
});

Hooks.on('renderTokenHUD', (app, html, data) => {
    if (!game.user.isGM) return;

    const actor = game.actors.get(data.actorId);
    if (actor && actor.type === 'threat') {
        const hud = NpcHUD.getInstance(actor);
        hud.setActor(actor);
    }
});

export default NpcHUD;
