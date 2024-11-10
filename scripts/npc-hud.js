import { makeDraggable, getHUDPosition } from './mh-drag-pos.js';
import { initializeAccordions } from './accordion-handler.js';

class NpcHUD extends Application {
    static hudInstances = {};

    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.isCollapsed = false;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'npc-hud',
            template: 'modules/mist-hud/templates/npc-hud.hbs',
            classes: ['npc-hud'],
            popOut: false,
            width: 300,
            height: 'auto',
        });
    }

    static getInstance(actor) {
        if (NpcHUD.hudInstances[actor.id]) {
            return NpcHUD.hudInstances[actor.id];
        } else {
            const hud = new NpcHUD(actor);
            NpcHUD.hudInstances[actor.id] = hud;
            return hud;
        }
    }

    async setActor(actor) {
        if (!actor || actor.type !== 'threat') return;
        this.actor = actor;

        const userId = game.user.id;
        const savedPosition = actor.getFlag('mist-hud', `hudPosition.${userId}`) || { left: 150, top: 100 };
        this.position.left = parseInt(savedPosition.left, 10);
        this.position.top = parseInt(savedPosition.top, 10);
        this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') || false;

        await this.render(true);
    }

    saveHUDPosition() {
        const userId = game.user.id;
        const position = {
            left: parseInt(this.element.css('left'), 10),
            top: parseInt(this.element.css('top'), 10)
        };

        this.actor.setFlag('mist-hud', `hudPosition.${userId}`, position);
    }

    getData() {
        const data = super.getData();
        if (!this.actor) return data;
    
        // Retrieve the prototype token name
        data.tokenName = this.actor.prototypeToken?.name || this.actor.name;
        
        data.isCollapsed = this.isCollapsed;
        data.name = this.actor.name;
        data.mythos = this.actor.system.mythos;
        data.tokenImage = this.actor.prototypeToken.texture.src;

        // Retrieve system description and biography
        data.description = this.actor.system.description || "<p>No description available.</p>";
        data.biography = this.actor.system.biography || "<p>No biography available.</p>";
    
        // Retrieve Spectrums
        data.spectrums = this.actor.items.filter(i => i.type === 'spectrum');
    
        // Retrieve and group Moves by subtype
        data.moves = this.actor.items.filter(i => i.type === 'gmmove');
        data.moveGroups = data.moves.reduce((groups, move) => {
            const subtype = move.system.subtype || 'default';
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
 
   
    activateListeners(html) {
        super.activateListeners(html);

        // Initialize accordions
        initializeAccordions({ onlyOneOpen: true });
    
        const hudElement = html[0];
        const dragHandles = [
            hudElement.querySelector('.npc-hud-header'),
            hudElement.querySelector('.mh-token-image'),
        ];
    
        dragHandles.forEach((dragHandle) => {
            if (dragHandle) {
                makeDraggable(hudElement, dragHandle, this.actor?.id, {
                    stop: () => this.saveHUDPosition()
                });
            }
        });
    
        // Collapse button toggle
        html.find('.npc-collapse-button').click((event) => {
            event.stopPropagation();
            this.toggleCollapse();
        });
    
        // Close button
        html.find('.npc-close-button').click((event) => {
            event.stopPropagation();
            this.saveHUDPosition();
            this.close();
        });
    
        // Story tag selection toggle
        html.find('.mh-story-tag').on('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            const tagElement = $(event.currentTarget);
    
            // Prevent selection if burned
            if (tagElement.hasClass('burned')) return;
    
            // Toggle the selected state
            tagElement.toggleClass('selected');
        });
    
        // Burn icon toggle for story tags
        html.find('.mh-burn-toggle').on('click', async (event) => {
            event.stopPropagation();
            event.preventDefault();
            
            const burnElement = $(event.currentTarget);
            const tagElement = burnElement.closest('.mh-story-tag');
            const tagId = tagElement.data('id');
    
            const currentState = burnElement.hasClass('burned') ? "burned" :
                                 burnElement.hasClass('toBurn') ? "toBurn" : "unburned";
    
            // Determine new state
            const newState = currentState === "unburned" ? "toBurn" :
                             currentState === "toBurn" ? "burned" : "unburned";
    
            // Update the DOM classes for the icon and text
            burnElement.removeClass('unburned toBurn burned').addClass(newState);
            tagElement.removeClass('unburned toBurn burned selected').addClass(newState); // Also remove 'selected'
    
            // Update text state if necessary
            const newIcon = this.getIcon(newState);
            burnElement.html(newIcon);
    
            if (newState === "burned") {
                tagElement.removeClass('selected');
            }
    
            // Update the tag's state in the actor's data
            const tagItem = this.actor.items.get(tagId);
            if (tagItem) {
                const updatedState = newState === "burned";
                const burnState = newState === "toBurn" ? 1 : 0;
                await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
            }
        });
    
        this.element.on('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
    }
    
    // Helper method for icon retrieval
    getIcon(state) {
        switch (state) {
            case "unburned":
                return '<i class="fa-light fa-fire"></i>';
            case "toBurn":
                return '<i class="fa-regular fa-fire"></i>';
            case "burned":
                return '<i class="fa-solid fa-fire"></i>';
            default:
                return '<i class="fa-light fa-fire"></i>';
        }
    }
    

    async toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        await this.actor.setFlag('mist-hud', 'isCollapsed', this.isCollapsed);
        this.saveHUDPosition();
        this.render(false);
    }

    async close(options = {}) {
        if (NpcHUD.hudInstances[this.actor.id]) {
            delete NpcHUD.hudInstances[this.actor.id];
        }
        await super.close(options);
    }

    constrainPosition(position) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const hudWidth = this.element.width();
        const hudHeight = this.element.height();

        position.left = Math.max(0, Math.min(position.left, windowWidth - hudWidth));
        position.top = Math.max(0, Math.min(position.top, windowHeight - hudHeight));

        return position;
    }

    async _render(force = false, options = {}) {
        if (!this.actor) return;
        console.log("Rendering minimal HUD for actor:", this.actor.name);
    
        await super._render(force, options);
    
        if (!this.element.parent().length) {
            console.log("Appending minimal HUD to the body");
            $('body').append(this.element);
        }
    }
    
    
}

// Register the parseStatus helper
Handlebars.registerHelper('parseStatus', function(description) {
    return new Handlebars.SafeString(
        description.replace(/\[([^\]]+)\]/g, '<span class="npc-status">$1</span>')
    );
});


Hooks.on('renderTokenHUD', (app, html, data) => {
    if (!game.user.isGM) return;
    console.log("renderTokenHUD triggered");

    const actor = game.actors.get(data.actorId);
    if (actor && actor.type === 'threat') {
        const hud = NpcHUD.getInstance(actor);
        hud.setActor(actor);
    }
});

export default NpcHUD;
