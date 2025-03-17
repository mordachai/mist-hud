// mist-hud.js

import { essenceDescriptions } from './mh-theme-config.js';
import { StoryTagDisplayContainer } from "/systems/city-of-mist/module/story-tag-window.js";
import { CityHelpers } from "/systems/city-of-mist/module/city-helpers.js";
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";
import { moveConfig } from "./mh-theme-config.js";
import statusScreenApp from "./statusScreenApp.js";
import { TokenStatusNotification } from './token-status-notification.js';
import { TokenTagNotification } from './token-tag-notification.js';
import { showTooltip, hideTooltip } from './tooltip.js';
import { 
  getMysteryFromTheme,
  getCrewThemes,
  getThemesAndTags, 
  getImprovements,
  getCrewImprovements,
  getActorStatuses, 
  getJuiceAndClues, 
  getEssence, 
  getLoadoutTags,
} from './mh-getters.js';
import { BonusManager } from "./bonus-utils.js";
import { getReceivedBonuses } from "./bonus-utils.js";
import { NPCInfluenceManager, openNPCInfluenceManager } from './npc-influence-manager.js';

globalThis.playerHudRegistry = new Map();

// Register Handlebars helper for localizeTheme
Handlebars.registerHelper('localizeTheme', function(themebookName) {
  return localizeTheme(themebookName);
});

Handlebars.registerHelper("times", function(n, block) {
  let output = "";
  for (let i = 0; i < n; i++) {
      output += block.fn(i);
  }
  return output;
});

async function handleTagClick(event, tagType, hudInstance) {
  event.stopPropagation();
  event.preventDefault();
  const tagElement = $(event.currentTarget);

  // Prevent toggling if the tag is already burned
  if (tagElement.hasClass('burned')) return;

  const tagId = tagElement.data('id');
  if (!tagId) {
      console.error("Tag element is missing a data-id attribute.");
      return;
  }

  // Get the current actor from the MistHUD instance.
  const actor = hudInstance.actor;
  if (!actor) return;

  // Check if the clicked tag is from a crew theme.
  const isCrewTag = tagElement.closest('.theme-container').hasClass('Crew');

  const isCrispy = tagElement.hasClass("mh-crispy");

  // Retrieve current selected tags.
  // For non-crew tags, we store an array of IDs.
  let selectedTags = actor.getFlag('mist-hud', 'selected-tags') || [];
  // For crew tags, we now want to store a full object.
  let selectedCrewTags = actor.getFlag('mist-hud', 'selected-crew-tags') || [];

  if (tagElement.hasClass('selected')) {
      // **Deselect the tag**
      tagElement.removeClass('selected');
      selectedTags = selectedTags.filter(id => id !== tagId);
      if (isCrewTag) {
          // When deselecting a crew tag, remove any object whose id matches.
          selectedCrewTags = selectedCrewTags.filter(tagObj => tagObj.id !== tagId);
      }

      // ✅ If a Crew Tag is deselected, reset its burn icon.
      if (isCrewTag) {
          tagElement.find('.mh-burn-toggle').removeClass('unburned').addClass('toBurn');
          if (isCrispy) {
              tagElement.addClass('mh-crispy'); 
          }
      }
  } else {
      // **Select the tag**
      tagElement.addClass('selected');
      if (!selectedTags.includes(tagId)) {
          selectedTags.push(tagId);
      }
      if (isCrewTag) {
          // Instead of storing just the tagId, store a full object.
          // First, check if an object with this id is already stored.
          const alreadySelected = selectedCrewTags.some(tagObj => tagObj.id === tagId);
          if (!alreadySelected) {
              // Use the actor's activeCrew getter to determine the active crew.
              const activeCrew = actor.activeCrew;
              const activeCrewId = activeCrew ? activeCrew.id : null;
              
              // Build the crew tag object.
              const crewTagObj = {
                  id: tagId,
                  // Use the tag element's text (trimmed) as the tag name.
                  tagName: tagElement.text().trim(),
                  crispy: isCrispy,
                  actorId: activeCrewId
              };
              selectedCrewTags.push(crewTagObj);
          }
      }

      // ✅ If a Crew Tag is selected, set its burn icon to "toBurn"
      if (isCrewTag) {
          tagElement.find('.mh-burn-toggle').removeClass('unburned').addClass('toBurn');
      }
  }

  // Persist the updated selections.
  await actor.setFlag('mist-hud', 'selected-tags', selectedTags);
  if (isCrewTag) {
      await actor.setFlag('mist-hud', 'selected-crew-tags', selectedCrewTags);
  }

  // Recalculate total power.
  hudInstance.calculateTotalPower();
}

function toggleInversion(tagElement, inversionIconConfig, hudInstance) {
  // Toggle the 'inverted' class on the tag element
  tagElement.toggleClass('inverted');
  
  // Get the current state AFTER toggling
  const isInverted = tagElement.hasClass('inverted');
  
  // Set the appropriate icon based on the current state
  const inversionIcon = isInverted 
    ? inversionIconConfig.inverted 
    : inversionIconConfig.default;
  
  tagElement.find(inversionIconConfig.selector).html(inversionIcon);
  
  // Recalculate power after the state change
  hudInstance.calculateTotalPower();
  
  // Store the inverted state in actor flags
  const tagId = tagElement.data('id');
  if (tagId && hudInstance.actor) {
    // Get current inverted tags flag or initialize with empty object
    const invertedTags = hudInstance.actor.getFlag('mist-hud', 'inverted-tags') || {};
    
    if (isInverted) {
      // Add to inverted tags
      invertedTags[tagId] = true;
    } else {
      // Remove from inverted tags
      delete invertedTags[tagId];
    }
    
    // Save updated flags
    hudInstance.actor.setFlag('mist-hud', 'inverted-tags', invertedTags);
  }
}

Hooks.once('ready', () => {
  // Initialize global cache for NPC influences
  globalThis.activeNpcInfluences = {};
  
  // Set up socket listener for NPC influence only (bonuses are now handled by BonusManager)
  game.socket.on("module.mist-hud", async data => {
    // Handle NPC influence data
    if (data.type === "npcInfluence") {
      const influenceData = data.data;
      
      // Store in the global cache with the NPC ID as the key
      globalThis.activeNpcInfluences[influenceData.npcId] = influenceData;
      
      console.log(`Received NPC influence: ${influenceData.npcName} (${influenceData.npcId}) = ${influenceData.totalInfluence}`);
      console.log(`Current active NPC influences:`, Object.values(globalThis.activeNpcInfluences));
    }
  });
  
  console.log("Mist HUD socket listeners initialized");
});
export class MistHUD extends Application {
  static instance = null;

  constructor(options = {}) {
    super(options);
    this.actor = null;
    this.isMinimized = true;
    this.modifier = 0;
  }

  async minimize() {
    const result = await super.minimize();
    return result;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'mist-hud',
      template: 'modules/mist-hud/templates/mh-hud.hbs',
      classes: ['mh-hud'],
      header: true,
      resizable: false,
      popOut: true,
      minimizable: true,
      // width: 250,
      height: 'auto',
      dragDrop: [{ dragSelector: '.window-header' }],
    });
  }
  
  static getOrCreateHudForActor(actor) {
    if (!actor) return null;
    
    let hud = playerHudRegistry.get(actor.id);
    if (!hud) {
      hud = new MistHUD();
      hud.setActor(actor);
    }
    return hud;
  }
  
  // Update setActor to register the HUD
  setActor(actor) {
    if (!actor || actor.type !== 'character') {
      console.warn("Attempted to set an invalid actor.");
      return;
    }
    this.actor = actor;
    this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') || false;
    
    // Add to registry
    playerHudRegistry.set(actor.id, this);
    
    this.render(true);
  }

  async render(force = false, options = {}) {
    try {
      await super.render(force, options);
      // After rendering, if the HUD is collapsed, add a "collapsed" class.
      if (this.isCollapsed) {
        this.element.addClass("collapsed");
      } else {
        this.element.removeClass("collapsed");
      }
    } catch (error) {
      console.error("Error during MistHUD render:", error);
    }
  }

  // Update close to remove from registry
  async close(options) {
    if (this.actor?.id) {
      playerHudRegistry.delete(this.actor.id);
    }
    return super.close(options);
  }

  static setActiveHud(hudInstance) {
    MistHUD.activeHud = hudInstance;
  }
  
  static getActiveHud() {
    return MistHUD.activeHud || 
      (canvas.tokens.controlled[0]?.actor && 
       playerHudRegistry.get(canvas.tokens.controlled[0].actor.id));
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
    // const tokenImgSrc = this.actor?.token?.texture.src || this.actor?.img || 'default-token.png';

    const tokenImg = $(`<div class="mh-token-image"><img src="${this.actor?.token?.texture.src || this.actor?.img}" alt="Character Token"></div>`);
    const charName = $(`<div class="mh-char-name">${this.actor?.name || 'Character'}</div>`);
    // const collapseButton = $(`<i class="mh-collapse-button fa-thin fa-caret-down"></i>`);
    const closeButton = $(`<i class="mh-close-button fa-solid fa-xmark"></i>`);
  
    // Append custom elements to the header
    header.append(tokenImg, charName, closeButton); //, collapseButton);
  
    // Add event listener to the close button
    closeButton.on("click", () => this.close());

    // Add event listener to the collapse button
    // collapseButton.on("click", () => this.isCollapsed());

    // Add a custom class for additional styling if needed
    header.addClass('mh-custom-header');
  
    // Handle minimized state
    const minimizedState = this.element.find('.window-title');
    if (minimizedState.length) {
      minimizedState.empty(); // Clear default content
      minimizedState.append(tokenImg.clone(), closeButton.clone()); // collapseButton.clone());
  
      // Rebind close event for the minimized state button
      minimizedState.find('.mh-close-button').on("click", () => this.close());
      // minimizedState.find('.mh-collapse-button').on("click", () => this.isCollapsed());
    }
  }
    
  activateListeners(html) {
    super.activateListeners(html);
    this.addHUDListeners(html);
    this.addModifierListeners(html);
    this.addTooltipListeners(html);

    const hudInstance = this;

    const slidingPanel = html.find('.mh-sliding-panel')[0];  // Use class instead of ID
    const panelEar = html.find('.mh-panel-ear')[0];          // Use class instead of ID
  
    if (panelEar && slidingPanel) {
      panelEar.addEventListener('click', () => {
        slidingPanel.classList.toggle('open');
      });
    }

  // Find the window header within the entire element
  const header = this.element.find('.window-header');
  
  if (header.length === 0) {
    return;
  }
  
  // Inject the custom header without passing any parameters
  this.injectCustomHeader();
  
    html.find('.mh-power-tag').on('click', (event) => handleTagClick(event, 'power', this));
    html.find('.mh-story-tag').on('click', (event) => handleTagClick(event, 'story', this));
    html.find('.mh-loadout-tag').on('click', (event) => handleTagClick(event, 'loadout', this));
    html.find('.mh-pwrcrew-tag').on('click', (event) => { handleTagClick(event, 'power', this); });
    html.find('.mh-wkcrew-tag').on('click', (event) => { handleTagClick(event, 'weakness', this); });

    html.find('.mh-weakness-toggle').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const invertElement = $(event.currentTarget);
      const tagElement = invertElement.closest('.mh-weakness-tag');
      
      // Don't toggle if burned
      if (tagElement.hasClass('burned')) return;
      
      toggleInversion(tagElement, {
        inverted: '<i class="fa-light fa-angles-up"></i>', // Up for inverted
        default: '<i class="fa-light fa-angles-down"></i>', // Down for default
        selector: '.mh-weakness-toggle'
      }, hudInstance);
    });

    html.find('.mh-weakness-tag').on('click', (event) => {
      // Only handle clicks on the tag itself, not on child elements like the toggle
      if (event.target === event.currentTarget || !$(event.target).closest('.mh-weakness-toggle').length) {
        handleTagClick(event, 'weakness', hudInstance);
      }
    });

    html.find('.mh-story-tag').each((index, element) => {
      const $tagElement = $(element);
      const isInverted = $tagElement.hasClass('inverted');
      const $toggleIcon = $tagElement.find('.mh-story-toggle');
      
      // Set initial icon based on the current inversion state
      if (isInverted) {
        $toggleIcon.html('<i class="fa-light fa-angles-down"></i>'); // Down for inverted/negative
      } else {
        $toggleIcon.html('<i class="fa-light fa-angles-up"></i>'); // Up for default/positive
      }
    });

    html.find('.mh-story-toggle').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const invertElement = $(event.currentTarget);
      const tagElement = invertElement.closest('.mh-story-tag');
      
      // Don't toggle if burned
      if (tagElement.hasClass('burned')) return;
      
      toggleInversion(tagElement, {
        inverted: '<i class="fa-light fa-angles-down"></i>', // Down arrow for inverted/negative
        default: '<i class="fa-light fa-angles-up"></i>',    // Up arrow for default/positive
        selector: '.mh-story-toggle'
      }, hudInstance);
    });

    
    html.find('.mh-burn-toggle').on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
    
      const burnElement = $(event.currentTarget);
      const tagElement = burnElement.closest('.mh-power-tag, .mh-story-tag, .mh-loadout-tag');
      const tagId = tagElement.data('id');
      if (!tagId) return;
    
      let tagActor = hudInstance.actor;
    
      // If this tag is a crew tag, get the crew actor using the data attribute.
      if (tagElement.hasClass('Crew')) {
        const crewId = tagElement.data('actor-id');
        if (crewId) {
          const found = game.actors.get(crewId);
          if (found) tagActor = found;
        }
      }
    
      if (!tagActor) return;
    
      // Determine current state from the DOM.
      const currentState = burnElement.hasClass('burned')
        ? "burned"
        : burnElement.hasClass('toBurn')
          ? "toBurn"
          : "unburned";
    
      // Cycle states: unburned -> toBurn -> burned -> unburned
      const newState = currentState === "unburned"
        ? "toBurn"
        : currentState === "toBurn"
          ? "burned"
          : "unburned";
    
      // Update the DOM classes for both the burn toggle and the tag element.
      burnElement.removeClass('unburned toBurn burned').addClass(newState);
      tagElement.removeClass('unburned toBurn burned').addClass(newState);
    
      // Update selection flags based on new state.
      if (newState === "toBurn") {
        // Force selection if set to "toBurn"
        tagElement.addClass('selected');
        let selectedTags = tagActor.getFlag('mist-hud', 'selected-tags') || [];
        if (!selectedTags.includes(tagId)) {
          selectedTags.push(tagId);
        }
        await tagActor.setFlag('mist-hud', 'selected-tags', selectedTags);
      } else if (newState === "burned") {
        // When burned, deselect the tag.
        tagElement.removeClass('selected');
        let selectedTags = tagActor.getFlag('mist-hud', 'selected-tags') || [];
        selectedTags = selectedTags.filter(id => id !== tagId);
        await tagActor.setFlag('mist-hud', 'selected-tags', selectedTags);
      }
      // (If newState is "unburned", leave the selection as is.)
    
      // Now update the tag's embedded document on the correct actor.
      const tagItem = tagActor.items.get(tagId);
      if (tagItem) {
        const updatedState = newState === "burned"; // true if burned, false otherwise.
        const burnState = newState === "toBurn" ? 1 : 0; // numeric burn state.
        await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
      } else {
        console.warn(`[Burn Debug] Tag item not found on actor '${tagActor.name}' for tag ID: ${tagId}`);
      }
    
      // Recalculate total power.
      hudInstance.calculateTotalPower();
    });

    html.find('.mh-status').on('click', async (event) => {
      event.stopPropagation(); // Stop the event from propagating to parent elements
      event.preventDefault();
  
      const statusElement = $(event.currentTarget);
      const statusId = statusElement.data('status-id');
  
      if (!statusId) {
          console.error("Missing status ID for state update.");
          return;
      }
  
      // Cycle through states: neutral -> negative -> positive -> neutral
      let newState = 'neutral';
      if (statusElement.hasClass('neutral')) {
          newState = 'negative';
          statusElement.removeClass('neutral').addClass('negative selected');
      } else if (statusElement.hasClass('negative')) {
          newState = 'positive';
          statusElement.removeClass('negative').addClass('positive selected');
      } else if (statusElement.hasClass('positive')) {
          newState = 'neutral';
          statusElement.removeClass('positive selected').addClass('neutral');
      }
  
      // Add or remove the `selected` class based on state
      if (newState === 'neutral') {
          statusElement.removeClass('selected'); // Neutral status is not selected
      } else {
          statusElement.addClass('selected'); // Non-neutral statuses are selected
      }
  
      // Persist state to actor flags
      const savedStates = this.actor.getFlag('mist-hud', 'status-states') || {};
      savedStates[statusId] = {
          state: newState,
          selected: newState !== 'neutral' // Selected if not neutral
      };
      await this.actor.setFlag('mist-hud', 'status-states', savedStates);
  
  
      // Recalculate total power after updating the status
      this.calculateTotalPower();
    });      

    html.find('.help-toggle, .hurt-toggle').on('change', function(event) {
      const toggle = event.currentTarget;
      const isChecked = toggle.checked;
      const targetActorId = toggle.dataset.targetId;
      const bonusType = toggle.classList.contains('help-toggle') ? 'help' : 'hurt';
      const amount = Number(toggle.dataset.amount);

      // Get the actor giving the bonus
      const giverActorId = toggle.dataset.actorId || this.actor?.id;
      
      if (!giverActorId || !targetActorId) {
        // If we're missing required IDs, revert the toggle and show a warning
        if (!giverActorId) ui.notifications.warn("Cannot determine which character is giving the bonus");
        if (!targetActorId) ui.notifications.warn("Cannot determine which character should receive the bonus");
        toggle.checked = !isChecked;
        return;
      }

      // Use BonusManager to handle the bonus change
      BonusManager.applyBonus(giverActorId, targetActorId, bonusType, amount, isChecked);
    });

    // Add listener for clue creation and deletion deletion
    html.find('.clue-delete').on("click", this._deleteClueFromHUD.bind(this));
    html.find('.create-clue').on("click", this._createClueFromHUD.bind(this));

    // Add listeners for juice creation and deletion
    html.find('.juice-delete').on("click", this._deleteJuiceFromHUD.bind(this));
    html.find('.create-juice').on("click", this._createJuiceFromHUD.bind(this));

    // Reset button functionality
    // html.on("click", ".toggle-expended", async (event) => {
    //     event.preventDefault();
    //     const button = $(event.currentTarget);
    //     const itemId = button.data("itemId");
    //     const actorId = button.data("actorId");
    //     const actor = game.actors.get(actorId);

    //     if (actor) {
    //         const item = actor.items.get(itemId);
    //         if (item) {
    //             const max = item.system.uses?.max || 0;
    //             if (max > 0) {
    //                 await item.update({ "system.uses.current": max });
    //                 ui.notifications.info(`Reset uses of "${item.name}" to ${max}.`);
    //                 hudInstance.render(); // Re-render the HUD to reflect changes
    //             }
    //         }
    //     }
    // });
    
    html.find('.mh-create-story-tag').on("click", this._createStoryTagFromHUD.bind(this));

    // Right-click to delete story tags
    html.find('.mh-story-tag').on('contextmenu', async (event) => {
        event.preventDefault();
        const tagId = $(event.currentTarget).data('id');
        const actorId = this.actor?.id;

        if (!tagId || !actorId) {
            console.error("Missing tagId or actorId for story tag deletion.");
            return;
        }

        const actor = game.actors.get(actorId);
        if (!actor) {
            console.error(`Actor with ID ${actorId} not found.`);
            return;
        }

        await actor.deleteTag(tagId);
        this.render(false); // Refresh the HUD
    });

    //Double click to edit story tags
    html.find('.mh-story-tag').on('dblclick', async (event) => {
      event.preventDefault();
      const tagId = $(event.currentTarget).data('id');
      const actorId = this.actor?.id;
  
      if (!tagId || !actorId) {
          console.error("Missing tagId or actorId for story tag editing.");
          return;
      }
  
      const actor = game.actors.get(actorId);
      const tag = actor?.getTag(tagId);
      if (!tag) {
          console.error(`Tag with ID ${tagId} not found on actor ${actorId}.`);
          return;
      }
  
      await CityDialogs.itemEditDialog(tag); // Open the edit dialog
      this.render(false); // Refresh the HUD
    });

    html.find('.mh-create-status').on("click", this._createStatusFromHUD.bind(this));

    // Right-click to delete statuses
    html.find('.mh-status').on('contextmenu', async (event) => {
      event.preventDefault();
      const statusId = $(event.currentTarget).data('status-id'); // Get statusId from data attribute
      const actorId = this.actor?.id; // Retrieve actor ID from the current actor
  
      if (!statusId || !actorId) {
          console.error("Missing statusId or actorId for status deletion.");
          return;
      }
  
      const actor = game.actors.get(actorId);
      if (!actor) {
          console.error(`Actor with ID ${actorId} not found.`);
          return;
      }
  
      await actor.deleteStatus(statusId);
      this.render(false); // Refresh the HUD
    });
    
    //Double click to edit statuses
    html.find('.mh-status').on('dblclick', async (event) => {
        event.preventDefault();
        const statusId = $(event.currentTarget).data('status-id');
        const actorId = this.actor?.id;
    
        if (!statusId || !actorId) {
            console.error("Missing statusId or actorId for status editing.");
            return;
        }
    
        const actor = game.actors.get(actorId);
        const status = actor?.getStatus(statusId);
        if (!status) {
            console.error(`Status with ID ${statusId} not found on actor ${actorId}.`);
            return;
        }
    
        await CityDialogs.itemEditDialog(status); // Open the edit dialog
        this.render(false); // Refresh the HUD
    });


    // STATUSES AND STORY TAGS DRAGGABLE

    html.find('.mh-status, .mh-status-moves').each((i, el) => {
      el.setAttribute('draggable', 'true');

      el.addEventListener('dragstart', (ev) => {
        // 1) Gather the data
        const name = el.dataset.statusName;   // "status" or whatever is stored
        const tier = parseInt(el.dataset.tier) || 1;
        const actorId = el.dataset.ownerId || this.actor?.id || null;

        // 2) Build a data object
        const statusData = {
          type: "status",
          name,
          tier,
          actorId
        };

        // 3) Store it in the dataTransfer
        ev.dataTransfer.setData("text/plain", JSON.stringify(statusData));
      });
    });

    html.find('.mh-story-tag').each((i, el) => {
      el.setAttribute('draggable', 'true');
    
      el.addEventListener('dragstart', (ev) => {
        // Get tag data
        const tagElement = $(el);
        const name = tagElement.text().trim();
        const isInverted = tagElement.hasClass('inverted');
        const actorId = tagElement.data('actor-id') || this.actor?.id || null;
        const temporary = tagElement.data('temporary') || false;
        const permanent = tagElement.data('permanent') || false;
        
        // Build a data object
        const tagData = {
          type: "story-tag", // Use "story-tag" to differentiate from statuses
          name,
          isInverted,
          actorId,
          temporary,
          permanent
        };
        
        // Store it in the dataTransfer
        ev.dataTransfer.setData("text/plain", JSON.stringify(tagData));
      });
    });


    // ==============================
    // Double-click to edit Clues
    // ==============================
    html.find('.clue-container').on('dblclick', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      // 1) Grab Clue and Actor IDs from data attributes
      const clueId = $(event.currentTarget).data('clue-id');
      // Some templates store actor ID in data-owner-id or fallback to this.actor.id
      const actorId = $(event.currentTarget).data('owner-id') || this.actor?.id;

      if (!clueId || !actorId) {
        console.error("Missing clueId or actorId for clue editing.", { clueId, actorId });
        return;
      }

      // 2) Retrieve the Actor
      const actor = game.actors.get(actorId);
      if (!actor) {
        console.error(`Actor with ID ${actorId} not found.`);
        return;
      }

      // 3) Retrieve the Clue item
      const clue = actor.getClue(clueId);
      if (!clue) {
        console.error(`Clue with ID ${clueId} not found on actor ${actorId}.`);
        return;
      }

      // 4) Open the dialog to edit this Clue
      //    (CityDialogs.itemEditDialog calls the same form as a typical sheet edit)
      await CityDialogs.itemEditDialog(clue);

      // 5) Re-render the HUD so it shows any updated data
      this.render(false);
    });

    html.find('.juice-container').on('dblclick', async (event) => {
      event.preventDefault();
      event.stopPropagation();
    
      // 1) Get the Juice ID and Actor ID from data attributes
      const juiceId = $(event.currentTarget).data('juice-id');
      const actorId = $(event.currentTarget).data('owner-id') || this.actor?.id;
    
      if (!juiceId || !actorId) {
        console.error("Missing juiceId or actorId for juice editing.", { juiceId, actorId });
        return;
      }
    
      // 2) Retrieve the actor
      const actor = game.actors.get(actorId);
      if (!actor) {
        console.error(`Actor with ID ${actorId} not found.`);
        return;
      }
    
      // 3) Retrieve the juice item
      const juice = actor.getJuice(juiceId);
      if (!juice) {
        console.error(`Juice with ID ${juiceId} not found on actor ${actorId}.`);
        return;
      }
    
      // 4) Store the old name/amount for logging
      const oldname = juice.name;
      const oldamount = juice.system.amount;
    
      // 5) Use the same dialog the system uses
      //    (this is basically what _juiceEdit does internally)
      const updateObj = await CityDialogs.itemEditDialog(juice);
    
      // 6) If user saved changes, log them
      if (updateObj) {
        CityHelpers.modificationLog(
          actor,
          "Edited",
          juice,
          `${oldname} (${oldamount}) edited --> ${updateObj.name} (${updateObj.system.amount})`
        );
      }
    
      // 7) Re-render HUD so it shows the updated juice
      this.render(false);
    });
        
    this.element.on('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    // Re-inject the roll bar so it shows up after every render
    this.injectRollBar(html);
  
  }
  
  getData(options) {
    const data = super.getData(options);
    if (!this.actor) return data;
  
    data.actor = this.actor;
    data.token = canvas.tokens.controlled[0] || null;
    data.scene = game.scenes.current || null;

 
    const activeSystem = game.settings.get("city-of-mist", "system");
    data.activeSystem = activeSystem;
    data.isCityOfMist = activeSystem === "city-of-mist";
    data.isOtherscape = activeSystem === "otherscape";
  
    // Get the persisted selected tag IDs (assumed to be stored as an array)
    const selectedTags = this.actor.getFlag('mist-hud', 'selected-tags') || [];
    const selectedCrewTags = this.actor.getFlag('mist-hud', 'selected-crew-tags') || [];
  
    const themesAndTags = getThemesAndTags(this.actor);

    themesAndTags.themes = themesAndTags.themes.map(theme => {
      // Make sure nascent property is passed to the template
      const nascent = theme.system?.nascent || false;
      
      return {
        ...theme,
        nascent: nascent,  // Add this property explicitly for the template
        powerTags: theme.powerTags?.map(tag => ({
          ...tag,
          selected: selectedTags.includes(tag.id)
        })),
        weaknessTags: theme.weaknessTags?.map(tag => {
          const invertedTags = this.actor.getFlag('mist-hud', 'inverted-tags') || {};
          return {
            ...tag,
            selected: selectedTags.includes(tag.id),
            inverted: !!invertedTags[tag.id]
          };
        })
      };
    });
  
    data.crewThemes = themesAndTags.crewThemes.map(crewTheme => {
      const nascent = crewTheme.system?.nascent || false;
      
      return {
        ...crewTheme,
        nascent: nascent,  // Add the nascent property here too
        powerTags: crewTheme.powerTags?.map(tag => ({
          ...tag,
          selected: selectedCrewTags.some(ct => ct.id === tag.id),
          crispy: tag.crispy
        })),
        weaknessTags: crewTheme.weaknessTags?.map(tag => ({
          ...tag,
          selected: selectedCrewTags.some(ct => ct.id === tag.id)
        }))
      };
    });    
  
    // Update story tags to include the selected property:
    themesAndTags.storyTags = themesAndTags.storyTags.map(tag => {
      const isInverted = tag.system && tag.system.isInverted;
      return {
        ...tag,
        selected: selectedTags.includes(tag.id),
        inverted: isInverted
      };
    });
  
    // Get and update loadout tags:
    const loadoutTags = getLoadoutTags(this.actor).map(tag => ({
      ...tag,
      selected: selectedTags.includes(tag.id)
    }));
  
    data.themes = themesAndTags.themes;
    data.storyTags = themesAndTags.storyTags;
    data.hasStoryTags = !!(themesAndTags.storyTags && themesAndTags.storyTags.length > 0);
    data.loadoutTags = loadoutTags;
    data.crewThemes = themesAndTags.crewThemes;
    data.hasCrewThemes = data.crewThemes && data.crewThemes.length > 0;
    
    // Process statuses:
    const rawStatuses = getActorStatuses(this.actor);
    const savedStates = this.actor.getFlag('mist-hud', 'status-states') || {};
    data.statuses = rawStatuses.map(st => ({
      ...st,
      statusType: savedStates[st.id]?.state || "neutral",
      selected: savedStates[st.id]?.selected || false,
    }));
  
    if (data.isCityOfMist) {
      const { helpItems, hurtItems, clueItems, juiceItems } = getJuiceAndClues(this.actor);
      data.helpItems = helpItems;
      data.hurtItems = hurtItems;
      data.clueItems = clueItems;
      data.juiceItems = juiceItems;
    } else if (data.isOtherscape) {
      const themes = this.actor.items.contents.filter(item => item.type === "theme");
      const essenceData = getEssence(themes);
      if (essenceData?.essence) {
        data.essence = essenceData.essence;
        data.essenceClass = essenceData.className;
        data.essenceImage = essenceData.imageName;
        data.essenceText = new Handlebars.SafeString(
          essenceDescriptions[essenceData.essence] || essenceDescriptions["Undefined"]
        );
      } else {
        console.error("getEssence returned invalid data:", essenceData);
      }
    }
  
  // Retrieve the bonuses from the actor flag.
  const receivedBonusesObj = this.actor.getFlag('mist-hud', 'received-bonuses') || {};
  const bonusMessages = [];

  // Iterate over each bonus keyed by the giver's actor id.
  for (const giverId in receivedBonusesObj) {
    const bonus = receivedBonusesObj[giverId];
    // Get the giver actor
    const giverActor = game.actors.get(giverId);
    if (giverActor) {
      // Get the token image: try the token, then prototypeToken, then fallback to actor.img.
      const tokenImage = giverActor.token?.texture?.src || giverActor.prototypeToken?.texture?.src || giverActor.img;
      //console.log(`Bonus from ${giverActor.name} (${giverId}): token image = ${tokenImage}`);
      bonusMessages.push({
        type: bonus.type,       // "help" or "hurt"
        amount: bonus.amount,
        giverName: giverActor.name,
        giverToken: tokenImage
      });
    }
  }

    data.helpHurtMessages = bonusMessages.length ? bonusMessages : null;
  
    // Regular improvements getter
    const improvements = getImprovements(this.actor);
    data.improvements = improvements;
    data.hasImprovements = improvements.length > 0;

    // Crew improvements getter (for crew themes)
    const crewImprovements = getCrewImprovements(this.actor);
    data.crewImprovements = crewImprovements;
    data.hasCrewImprovements = crewImprovements.length > 0;
  
    return data;
  }  

  async _updateHUDPreservePanel(force = false) {
    // Check if the panel is open before render
    const slidingPanel = document.getElementById('mh-sliding-panel');
    const panelWasOpen = slidingPanel && slidingPanel.classList.contains('open');
    
    // Render the HUD
    await this.render(force);
    
    // If the panel was open, re-open it after rendering
    if (panelWasOpen) {
      const newPanel = document.getElementById('mh-sliding-panel');
      if (newPanel) {
        newPanel.classList.add('open');
      }
    }
  }

  async _createClueFromHUD(event) {
    event.stopPropagation();

    const owner = this.actor;
    if (!owner) {
        console.error("Actor not found for clue creation.");
        return;
    }

    // Create a new clue with a default name
    const obj = await owner.createNewClue({ name: "Unnamed Clue" });
    if (!obj) {
        console.error("Failed to create a new clue.");
        return;
    }

    // Retrieve the newly created clue
    const clue = owner.getClue(obj.id);
    if (!clue) {
        console.error(`Clue with ID ${obj.id} not found.`);
        return;
    }

    // Open the Clue/Journal Dialog (CJDialog) to edit the clue using CityHelpers
    const updateObj = await CityHelpers.itemDialog(clue); // Replaced CJDialog
    if (updateObj) {
        // Log the creation if the user completes the dialog
        const partialStr = clue.system.partial ? ", partial" : "";
        CityHelpers.modificationLog(owner, "Created", clue, `${clue.system.amount}${partialStr}`);
    } else {
        // Delete the clue if the dialog is canceled
        await owner.deleteClue(obj.id);
    }

    // Use the updated render method
    await this._updateHUDPreservePanel(false);
  }

  async _deleteClueFromHUD(event) {
    event.stopPropagation();
    
    // Get the clue and actor data from the clicked element
    const clueId = event.currentTarget.closest("[data-clue-id]")?.dataset.clueId;
    const actorId = event.currentTarget.closest("[data-owner-id]")?.dataset.ownerId;

    if (!clueId || !actorId) {
        console.error("Missing data attributes for clue deletion:", { clueId, actorId });
        return;
    }

    // Retrieve the actor
    const owner = game.actors.get(actorId);
    if (!owner) {
        console.error(`Actor with ID ${actorId} not found`);
        return;
    }

    // Retrieve and delete the clue
    const clue = owner.getClue(clueId);
    if (!clue) {
        console.error(`Clue with ID ${clueId} not found on actor ${actorId}`);
        return;
    }

    await owner.deleteClue(clueId);

    // Log the modification
    CityHelpers.modificationLog(owner, "Removed", clue);

    // Use the updated render method
    await this._updateHUDPreservePanel(false);
  }

  async _createJuiceFromHUD(event) {
    event.stopPropagation();

    const owner = this.actor;
    if (!owner) {
        console.error("Actor not found for juice creation.");
        return;
    }

    // Create a new juice item
    const obj = await owner.createNewJuice("Unnamed Juice");
    if (!obj) {
        console.error("Failed to create a new juice.");
        return;
    }

    // Retrieve the newly created juice
    const juice = owner.getJuice(obj.id);
    if (!juice) {
        console.error(`Juice with ID ${obj.id} not found.`);
        return;
    }

    // Open the Juice/Journal Dialog (CJDialog) to edit the juice
    const updateObj = await CityHelpers.itemDialog(juice);
    if (updateObj) {
        CityHelpers.modificationLog(owner, "Created", juice, `${juice.system.amount}`);
    } else {
        // Delete the juice if the dialog is canceled
        await owner.deleteJuice(obj.id);
    }

    // Use the updated render method
    await this._updateHUDPreservePanel(false);
  }

  async _deleteJuiceFromHUD(event) {
    event.stopPropagation();

    const juiceId = event.currentTarget.closest("[data-juice-id]")?.dataset.juiceId;
    const actorId = event.currentTarget.closest("[data-owner-id]")?.dataset.ownerId;

    if (!juiceId || !actorId) {
        console.error("Missing data attributes for juice deletion:", { juiceId, actorId });
        return;
    }

    // Retrieve the actor
    const owner = game.actors.get(actorId);
    if (!owner) {
        console.error(`Actor with ID ${actorId} not found`);
        return;
    }

    // Retrieve and delete the juice
    const juice = owner.getJuice(juiceId);
    if (!juice) {
        console.error(`Juice with ID ${juiceId} not found on actor ${actorId}`);
        return;
    }

    await owner.deleteJuice(juiceId);
    CityHelpers.modificationLog(owner, "Removed", juice);

    // Use the updated render method
    await this._updateHUDPreservePanel(false);
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

    try {
        const createdTag = await StoryTagDisplayContainer.prototype.createStoryTag(event);
        this.render(false);
    } catch (err) {
        console.error("Error creating a story tag:", err);
    }
  }  
  
  addTooltipListeners(html) {
    html.find('.mh-theme-icon').each((index, element) => {
      const $element = $(element);
      const themeId = $element.data('theme-id');
      const themeType = $element.data('theme-type');
  
      // Remove any existing hover events to prevent duplicates
      $element.off('mouseenter mouseleave');
  
      $element.on({
        mouseenter: async (event) => {
          // Cancel any existing tooltip
          if (this.currentTooltip) {
            hideTooltip(this.currentTooltip);
            this.currentTooltip = null;
          }
  
          try {
            let data;
            if (themeType === "crew") {
              const crewThemes = getCrewThemes(this.actor);
              data = crewThemes.find(theme => theme.id === themeId);
              if (!data) {
                data = { mysteryText: "No mystery defined." };
              }
            } else {
              data = getMysteryFromTheme(this.actor, themeId);
            }
  
            // Create and store the new tooltip
            this.currentTooltip = await showTooltip(event, data);
          } catch (error) {
            console.error('Error creating tooltip:', error);
            this.currentTooltip = null;
          }
        },
        mouseleave: () => {
          // Ensure tooltip is removed on mouse leave
          if (this.currentTooltip) {
            hideTooltip(this.currentTooltip);
            this.currentTooltip = null;
          }
        }
      });
    });
  }
  
  calculateTotalPower() {
    let totalPower = 0;

    // Fetch saved states for statuses
    const savedStates = this.actor.getFlag('mist-hud', 'status-states') || {};

    // Calculate power tags
    $('.mh-power-tag.selected').each((index, element) => {
        const tagElement = $(element);
        const burnElement = tagElement.find('.mh-burn-toggle');

        if (burnElement.hasClass('toBurn')) {
            totalPower += 3;  // Burned power tag selected adds +3
        } else {
            totalPower += 1;  // Regular power tag selected adds +1
        }
    });

    // Calculate loadout tags
    $('.mh-loadout-tag.selected').each((index, element) => {
        const tagElement = $(element);
        const burnElement = tagElement.find('.mh-burn-toggle');

        if (burnElement.hasClass('toBurn')) {
            totalPower += 3;  // Burned loadout tag selected adds +3
        } else {
            totalPower += 1;  // Regular loadout tag selected adds +1
        }
    });

    // Calculate weakness tags
    $('.mh-weakness-tag.selected').each((index, element) => {
        const tagElement = $(element);
        if (tagElement.hasClass('inverted')) {
            totalPower += 1;  // Inverted weakness tag adds +1
        } else {
            totalPower -= 1;  // Normal weakness tag adds -1
        }
    });

    // Calculate story tags
    $('.mh-story-tag.selected').each((index, element) => {
        const tagElement = $(element);
        const isInverted = tagElement.hasClass('inverted');
        const burnElement = tagElement.find('.mh-burn-toggle');
        const isToBurn = burnElement.hasClass('toBurn');

        if (isInverted) {
            totalPower -= 1;  // Inverted story tag adds -1
        } else {
            totalPower += 1;  // Regular story tag adds +1
        }

        // Apply additional value if `toBurn` is active and not inverted
        if (isToBurn && !isInverted) {
            totalPower += 3;  // `toBurn` story tag selected adds +3 if not inverted
        }
    });

    // Calculate status values using saved states
    $('.mh-status').each((index, element) => {
        const statusElement = $(element);
        const statusId = statusElement.data('status-id');
        const tier = parseInt(statusElement.data('tier')) || 0;

        // Use saved state if available; fallback to class-based state
        const state = savedStates[statusId] || 
                      (statusElement.hasClass('positive') ? 'positive' :
                      statusElement.hasClass('negative') ? 'negative' : 'neutral');

        if (state === 'positive') {
            totalPower += tier;  // Positive status adds its tier value
        } else if (state === 'negative') {
            totalPower -= tier;  // Negative status subtracts its tier value
        }
    });

    // Add modifier to total power
    totalPower += this.modifier || 0;  // Modifier can be positive or negative

    // Correctly process scene statuses
    const sceneStatuses = getSceneStatuses();
    const scenePower = sceneStatuses.reduce(
        (acc, status) => acc + (status.type === 'positive' ? status.tier : -status.tier),
        0
    );
    totalPower += scenePower;

    return totalPower;
  }
  
  formatTagsHierarchy(tags, subTagsByParent) {
    return tags.map((tag) => {
        // Format the parent tag
        const tagData = this.formatTagData(tag);

        // Check if the tag has any subtags and format them
        const subtags = subTagsByParent[tag.id] || [];
        const formattedSubtags = subtags.map((subtag) => {
            const subtagData = this.formatTagData(subtag);
            subtagData.isSubtag = true; // Mark it as a subtag
            return subtagData;
        });

        // Attach subtags to the parent tag
        tagData.subtags = formattedSubtags;
        return tagData;
    });
  }

  formatTagData(tag) {
      return {
          id: tag.id,
          tagName: tag.name,
          isSelected: false,
          burnState: tag.system.burn_state || 0,
          burnIcon: MistHUD.getIcon(tag.system.burn_state || 0, 'burn'),
          isInverted: tag.system.isInverted || false,
          weaknessIcon: MistHUD.getIcon(tag.system.isInverted, 'weakness'),
          isSubtag: false,  // Default to false, but this will be set to true for subtags
          activatedLoadout: tag.system.activated_loadout || false,  // New: Whether the loadout tag is activated
      };
  }
 
  updateModifierDisplay() {
    const modifierInput = this.element.find('#mh-mod-value');
    if (modifierInput.length) {
      modifierInput.val(this.modifier);
    } else {
      console.warn("Modifier input element not found.");
    }
  }

  addModifierListeners(html) {
    // Listener for decreasing the modifier
    html.find('#mh-mod-decrease').click(() => {
      this.modifier--;
      this.updateModifierDisplay();
    });
  
    // Listener for increasing the modifier
    html.find('#mh-mod-increase').click(() => {
      this.modifier++;
      this.updateModifierDisplay();
    });

    html.find('.mh-loadout-toggle').change((event) => {
      const tagId = $(event.currentTarget).data('id');
      const isChecked = $(event.currentTarget).is(':checked');
      
      const tag = this.actor.items.get(tagId);
      if (tag) {
        tag.update({ 'system.activated_loadout': isChecked });
      }
    });
  
    // Initialize the modifier value on render
    this.updateModifierDisplay();
  }
  
  // Function to add HUD Listeners for collapse/close buttons
  addHUDListeners(html) {
    html.find('.mh-close-button').click(() => {
      this.close();
    });
  }
  
  getSelectedRollData() {
    // Fetch selected power tags
    const powerTags = this.element.find('.mh-power-tag.selected').map((i, el) => ({
      tagName: $(el).text().trim(),
      id: $(el).data('id'),
      actorId: $(el).data('actor-id'),
      themeId: $(el).data('theme-id'),
      stateClass: $(el).find('.mh-burn-toggle').hasClass('toBurn') ? "to-burn" :
                  $(el).find('.mh-burn-toggle').hasClass('burned') ? "burned" : "selected",
      crispy: $(el).hasClass('mh-crispy') || ($(el).data('crispy') === true)

    })).get();

    const weaknessTags = this.element.find('.mh-weakness-tag.selected').map((i, el) => ({
        tagName: $(el).text().trim(),
        id: $(el).data('id'),
        actorId: $(el).data('actor-id'),
        themeId: $(el).data('theme-id'), 
        stateClass: $(el).hasClass('inverted') ? "inverted" : "normal"
    })).get();

    const crewPowerTags = this.element.find('.mh-power-tag.Crew.selected').map((i, el) => ({
      tagName: $(el).text().trim(),
      id: $(el).data('id'),
      actorId: $(el).data('actor-id'),
      themeId: $(el).data('theme-id'),
      stateClass: $(el).find('.mh-burn-toggle').hasClass('toBurn') 
                  ? "to-burn" 
                  : $(el).find('.mh-burn-toggle').hasClass('burned') 
                    ? "burned" 
                    : "selected",
      crispy: $(el).hasClass('mh-crispy') || ($(el).data('crispy') === true)
    })).get();

    const crewWeaknessTags = this.element.find('.mh-weakness-tag.Crew.selected').map((i, el) => ({
        tagName: $(el).text().trim(),
        id: $(el).data('id'),
        actorId: $(el).data('actor-id'),
        themeId: $(el).data('theme-id'),
        stateClass: $(el).hasClass('inverted') ? "inverted" : "normal"
    })).get();

    const storyTags = this.element.find('.mh-story-tag.selected').map((i, el) => {
      const tagElement = $(el);
      const isInverted = tagElement.hasClass('inverted');
      const burnElement = tagElement.find('.mh-burn-toggle');

      let stateClass;
      if (burnElement.hasClass('burned')) {
          stateClass = "burned";
      } else if (burnElement.hasClass('toBurn')) {
          stateClass = "to-burn";
      } else {
          stateClass = isInverted ? "inverted" : "selected";
      }

      return {
          tagName: tagElement.text().trim(),
          id: tagElement.data('id'),
          actorId: tagElement.data('actor-id'),
          themeId: tagElement.data('theme-id'),
          stateClass,
          temporary: $(el).data('temporary') || false,
          permanent: $(el).data('permanent') || false
      };
    }).get();

    const loadoutTags = this.element.find('.mh-loadout-tag.selected').map((i, el) => {
        const tagElement = $(el);
        const burnElement = tagElement.find('.mh-burn-toggle');

        let stateClass;
        if (burnElement.hasClass('burned')) {
            stateClass = "burned";
        } else if (burnElement.hasClass('toBurn')) {
            stateClass = "to-burn";
        } else {
            stateClass = "selected";
        }

        return {
            tagName: tagElement.text().trim(),
            id: tagElement.data('id'),
            themeId: $(el).data('theme-id'),
            actorId: $(el).data('actor-id'),
            stateClass
        };
    }).get();

    const selectedStatuses = this.element.find('.mh-status.selected').map((i, el) => {
      const name = $(el).attr('data-status-name') || $(el).data('statusName');
      const tier = parseInt($(el).data('tier')) || 0;
      const typeClass = $(el).hasClass('positive') ? "positive" :
                        $(el).hasClass('negative') ? "negative" : "neutral";
  
  
      return {
          name,
          tier,
          typeClass,
          temporary: $(el).data('temporary') || false,
          permanent: $(el).data('permanent') || false
      };
  }).get();  
  
    const modifier = this.modifier || 0;

    const scnTags = getScnTags();

    const sceneStatuses = getSceneStatuses().filter(sceneStatus => sceneStatus.isSelected).map(sceneStatus => ({
        name: sceneStatus.name,
        tier: sceneStatus.tier,
        typeClass: sceneStatus.type === "positive" ? "scene-positive" : "scene-negative",
        temporary: sceneStatus.temporary,
        permanent: sceneStatus.permanent
    }));

    // Return all gathered data
    return {
        powerTags,
        weaknessTags,
        crewPowerTags,
        crewWeaknessTags,
        storyTags,
        loadoutTags,
        statuses: selectedStatuses,
        sceneStatuses,
        scnTags,
        modifier: modifier ? modifier : null
    };
  }

  injectRollBar(html) {
    // Remove any existing roll bar to avoid duplicates
    html.find(".mh-roll-bar").remove();
  
    // Check if roll buttons should be in the hotbar instead of the HUD
    const useHotbar = game.settings.get("mist-hud", "useHotbarForRolls");
    if (useHotbar) return; // Skip rendering roll buttons in the HUD
  
    // Get user setting for text or image display
    const useText = game.settings.get("mist-hud", "useTextButtons");
    const activeSystem = game.settings.get("city-of-mist", "system");
  
    // Create roll bar and move containers
    const rollBar = $(`<div class="mh-roll-bar"></div>`);
    const coreMovesContainer = $(`<div class="mh-roll-container core-moves"></div>`);
    const specialMovesContainer = $(`<div class="mh-roll-container special-moves"></div>`);
  
    // Populate moves
    Object.keys(moveConfig).forEach(moveName => {
      const moveData = moveConfig[moveName];
      if (!moveData || !moveData.name || moveData.system !== activeSystem) return;
      
      const translatedName = game.i18n.localize(moveData.name);
      let tooltipText = translatedName;
      let buttonContent;
      let buttonClass = "mh-roll-button";
      
      if (moveData.subtitle) {
        const translatedSubtitle = game.i18n.localize(moveData.subtitle);
        tooltipText += ` - ${translatedSubtitle}`;
      }
      
      if (!useText && moveData.image) {
        buttonContent = `<img src="modules/mist-hud/ui/${moveData.image}" alt="${translatedName}" class="mh-roll-img">`;
        buttonClass += " mh-roll-button-img";
      } else {
        const shortName = translatedName.slice(0, 3).toUpperCase();
        let subtitleRow = "";
        if (moveData.subtitle) {
          const translatedSubtitle = game.i18n.localize(moveData.subtitle);
          const shortSubtitle = translatedSubtitle.slice(0, 3).toUpperCase();
          subtitleRow = `<div class="mh-roll-sub">${shortSubtitle}</div>`;
        }
        buttonContent = `<div class="mh-roll-main">${shortName}</div>${subtitleRow}`;
      }
      
      const button = $(`
        <button class="${buttonClass}" data-move="${moveName}" title="${tooltipText}">
          ${buttonContent}
        </button>
      `);
      
      button.on("click", () => {
        (globalThis.CityOfMistRolls || CityOfMistRolls).executeMove(moveName);
      });
      
      if (moveData.slot >= 1 && moveData.slot <= 10) {
        coreMovesContainer.append(button);
      } else if (moveData.slot >= 11 && moveData.slot <= 20) {
        specialMovesContainer.append(button);
      }
    });
    
    specialMovesContainer.hide();
    
    const coreMovesText = game.i18n.localize("CityOfMist.terms.coreMoves");
    const specialMovesText = game.i18n.localize("CityOfMist.terms.specialMoves");
    
    // Dynamite Toggle Button
    const rollIsDynamiteButton = $(`
      <button class="mh-roll-button-img mh-dynamite-toggle" title="${game.i18n.localize ("CityOfMist.terms.dynamite")}!" style="display: ${activeSystem === "city-of-mist" ? "flex" : "none"};">
        <img src="modules/mist-hud/ui/Dynamite-OFF.webp" alt="Roll Is Dynamite" class="mh-roll-img">
      </button>
    `);
    
    rollIsDynamiteButton.on("click", async () => {
      if (!game.settings.settings.has("mist-hud.rollIsDynamite")) return;
      
      const currentState = game.settings.get("mist-hud", "rollIsDynamite");
      const newState = !currentState;
      await game.settings.set("mist-hud", "rollIsDynamite", newState);
      rollIsDynamiteButton.find("img").attr("src", newState 
        ? "modules/mist-hud/ui/Dynamite-ON.webp" 
        : "modules/mist-hud/ui/Dynamite-OFF.webp");
    });
    
    // Page toggle button
    const toggleButton = $(`
      <button class="mh-roll-toggle" title="${specialMovesText}">
        <i class="fa-solid fa-caret-up"></i>
      </button>
    `);
    
    let isCoreMovesVisible = true;
    toggleButton.on("click", () => {
      if (isCoreMovesVisible) {
        coreMovesContainer.slideUp(300, () => {
          specialMovesContainer.slideDown(300);
        });
        toggleButton.find("i").removeClass("fa-caret-up").addClass("fa-caret-down");
        toggleButton.attr("title", coreMovesText);
      } else {
        specialMovesContainer.slideUp(300, () => {
          coreMovesContainer.slideDown(300);
        });
        toggleButton.find("i").removeClass("fa-caret-down").addClass("fa-caret-up");
        toggleButton.attr("title", specialMovesText);
      }
      isCoreMovesVisible = !isCoreMovesVisible;
    });
    
    rollBar.append(coreMovesContainer, specialMovesContainer, rollIsDynamiteButton, toggleButton);
    html.prepend(rollBar);
  }  
  
  async cleanHUD(tagsData = null) {
    try {
      if (!this.actor) {
        console.warn("No actor set for MistHUD. Skipping actor updates.");
        return;
      }
  
      // Check if the panel is open before cleanup
      const slidingPanel = document.getElementById('mh-sliding-panel');
      const panelWasOpen = slidingPanel && slidingPanel.classList.contains('open');
  
      const tagsToUpdate = this.element.find(
        '.mh-power-tag.toBurn, .mh-weakness-tag.toBurn, .mh-story-tag.toBurn, .mh-loadout-tag.toBurn'
      );    
             
      for (const element of tagsToUpdate) {
        const $tag = $(element);
        const tagId = $tag.data('id');
      
        // Determine the correct actor for this tag.
        let tagActor = this.actor; // default to main actor
        if ($tag.hasClass('Crew')) {
          const crewId = $tag.data('actor-id');
          if (crewId) {
            const crewActor = game.actors.get(crewId);
            if (crewActor) {
              tagActor = crewActor;
            }
          }
        }
      
        // Now update the tag item from the correct actor.
        const tagItem = tagActor.items.get(tagId);
        if (tagItem) {
            await tagItem.update({
                "system.burned": true,
                "system.burn_state": 0
            });
        }
      
        // Update the DOM classes.
        $tag.removeClass('toBurn mh-crispy').addClass('burned');
        $tag.find('.mh-burn-toggle').removeClass('toBurn').addClass('burned');
      }
      
   
  
      // 2. Delete temporary statuses
      // (Assumes that temporary statuses have a property system.temporary == true)
      const statusesToDelete = this.element.find('.mh-status.selected[data-temporary="true"]');
      for (const element of statusesToDelete) {
        const $status = $(element);
        const statusId = $status.data('status-id');
        if (statusId) {
          await this.actor.deleteEmbeddedDocuments("Item", [statusId]);
        }
      }
  
     
      // 4. Delete temporary tags (if any exist) after the roll.
      const temporaryTags = this.actor.items.contents.filter(item =>
        item.type === 'tag' && item.system.temporary === true
      );
      for (const tag of temporaryTags) {
        await this.actor.deleteEmbeddedDocuments("Item", [tag.id]);
        
        // Also update the persisted selected-tags flag, if needed.
        let selectedTags = this.actor.getFlag('mist-hud', 'selected-tags') || [];
        selectedTags = selectedTags.filter(id => id !== tag.id);
        await this.actor.setFlag('mist-hud', 'selected-tags', selectedTags);
      }
  
      // 5. Preserve statuses selection from saved flags.
      // (Your statuses flag is maintained separately.)
      const savedStates = this.actor.getFlag('mist-hud', 'status-states') || {};
      this.element.find('.mh-status').each((index, element) => {
        const $el = $(element);
        const statusId = $el.data('status-id');
        if (statusId && savedStates[statusId]) {
          const state = savedStates[statusId].state;
          $el.removeClass('neutral positive negative selected').addClass(state);
          if (savedStates[statusId].selected) {
            $el.addClass('selected');
          }
        }
      });
  
      // 6. IMPORTANT: Do not clear the persistent tag selections.
      // If you want tag selections (for power, weakness, story, loadout tags) to persist between rolls,
      // do not clear the "selected-tags" flag.
      //
      // (If you DO want to clear them after a roll, you could do:
      await this.actor.unsetFlag('mist-hud', 'inverted-tags');
      await this.actor.unsetFlag('mist-hud', 'selected-tags');
      await this.actor.unsetFlag('mist-hud', 'selected-crew-tags');
      // But that would force the user to reselect their tags.)
  
      // 7. Reset modifier and update its display.
      this.modifier = 0;
      this.updateModifierDisplay();
  
      // 8. Finally, re-render the HUD so that the getData() method re-applies the correct data,
      // including restoring persistent tag selections.
      await this.render(true);
      
      // 9. Reapply the panel state if it was open.
      const slidingPanelAfter = document.getElementById('mh-sliding-panel');
      if (panelWasOpen && slidingPanelAfter) {
        slidingPanelAfter.classList.add('open');
      }
    } catch (error) {
      console.error("Error during HUD cleanup:", error);
    }
  }
}

// Function to attach click listeners to each scene tag for dynamic updates
function attachSceneTagListeners() {
  $('.scene-tag-window').on('click', '.tag-or-status .flex-row.tag', (event) => {
      event.stopPropagation();
      event.preventDefault();

      // Toggle the selection state based on positive/negative classes
      const tagElement = $(event.currentTarget).find('.flex-tag-name');
      if (tagElement.hasClass('positive-selected')) {
          tagElement.removeClass('positive-selected').addClass('negative-selected');
      } else if (tagElement.hasClass('negative-selected')) {
          tagElement.removeClass('negative-selected').addClass('positive-selected');
      } else {
          tagElement.addClass('positive-selected');
      }

      getScnTags();
  });
}

// Function to get scene status information and calculate its contribution to total power
function getSceneStatuses() {
  const selectedStatuses = [];

  // Select each status line in the scene tag window
  $('.scene-tag-window .tag-or-status-list .status-line.status').each((index, element) => {
    const statusElement = $(element);
    const statusName = statusElement.data('status-name');
    const statusTier = parseInt(statusElement.data('tier')) || 0;
    const isTemporary = !!statusElement.data('temporary'); // Get temporary status as a boolean
    const isPermanent = !!statusElement.data('permanent'); // Get permanent status as a boolean

    // Check if the status is selected as positive or negative and add to selectedStatuses
    if (statusElement.find('.status-name').hasClass('positive-selected')) {
      selectedStatuses.push({
        name: statusName,
        tier: statusTier,
        type: 'positive',
        isSelected: true,
        temporary: isTemporary,
        permanent: isPermanent
      });
    } else if (statusElement.find('.status-name').hasClass('negative-selected')) {
      selectedStatuses.push({
        name: statusName,
        tier: statusTier,
        type: 'negative',
        isSelected: true,
        temporary: isTemporary,
        permanent: isPermanent
      });
    }
  });

  return selectedStatuses; // Return selected scene statuses with temporary and permanent information
}
export { getSceneStatuses };

function getScnTags() {
  const tags = [];
  const tagElements = document.querySelectorAll('.scene-tag-window .tag-or-status .flex-row.tag');

  tagElements.forEach(tagEl => {
      const name = tagEl.querySelector('.flex-tag-name').textContent.trim();
      const isTemporary = !!tagEl.querySelector('.tag-symbols [title="Temporary"]');
      const isPermanent = !!tagEl.querySelector('.tag-symbols [title="Permanent"]');
      const isPositive = tagEl.querySelector('.flex-tag-name').classList.contains('positive-selected');
      const isNegative = tagEl.querySelector('.flex-tag-name').classList.contains('negative-selected');

      if (isPositive || isNegative) {
          tags.push({
              name,
              temporary: isTemporary,
              permanent: isPermanent,
              type: isPositive ? 'positive' : 'negative'
          });
      }
  });

  return tags;
}
export { getScnTags };


// Hook to attach listeners after the Foundry VTT application is ready
Hooks.on('ready', () => {
  attachSceneTagListeners();
});

Hooks.on('controlToken', (token, controlled) => {
  console.log("Token control changed:", token, controlled);
  
  // Only handle when a token is selected
  if (controlled && token.actor && token.actor.type === 'character') {
    // Check if the user has ownership of the token
    if (!token.isOwner) {
      console.log("User doesn't have ownership of the selected token");
      return; // Do nothing if the user doesn't own the token
    }
    
    // Get all currently selected tokens
    const selectedTokens = canvas.tokens.controlled;
    
    // If we have exactly one token selected, show its HUD
    if (selectedTokens.length === 1) {
      // Close any existing HUDs first
      for (const [actorId, hud] of playerHudRegistry.entries()) {
        if (actorId !== token.actor.id) {
          hud.close();
        }
      }
      
      // Create or get the HUD for this actor
      const hud = MistHUD.getOrCreateHudForActor(token.actor);
      
      // Make sure it's rendered
      if (hud && !hud.rendered) {
        hud.render(true);
      }
      
      console.log("HUD result:", hud);
    }
  } else if (!controlled) {
    // Only close if no tokens are selected
    if (canvas.tokens.controlled.length === 0) {
      const hud = playerHudRegistry.get(token.actor?.id);
      if (hud) hud.close();
    }
  }
});

Hooks.on('updateActor', (actor, data, options, userId) => {
  const hud = playerHudRegistry.get(actor.id);
  if (hud) {
    hud.render(true);
  }
});
// In your module or main script file, register these once during init or ready:
Hooks.on('createItem', (item, options, userId) => {
  // Only for items embedded in an Actor:
  if (!item.isEmbedded) return;
  const actor = item.parent;
  if (!actor) return;
  
  // Use the registry to find the HUD for this actor
  const hud = playerHudRegistry.get(actor.id);
  if (hud) {
    hud.render(true);
  }
});

Hooks.on('updateItem', (item, diff, options, userId) => {
  if (!item.isEmbedded) return;
  const actor = item.parent;
  if (!actor) return;
  
  // Use the registry to find the HUD for this actor
  const hud = playerHudRegistry.get(actor.id);
  if (hud) {
    hud.render(true);
  }
});

Hooks.on('deleteItem', (item, options, userId) => {
  if (!item.isEmbedded) return;
  const actor = item.parent;
  if (!actor) return;
  
  // Use the registry to find the HUD for this actor
  const hud = playerHudRegistry.get(actor.id);
  if (hud) {
    hud.render(true);
  }
});

Hooks.once("init", async function () {

  game.settings.register("mist-hud", "importedStatusCollection", {
      name: "Imported Statuses",
      hint: "Stores the imported status collections from JSON.",
      scope: "world",
      config: false,
      type: Object,
      default: []
  });

  game.mistHUD = game.mistHUD || {}; // Ensure the object exists

  Hooks.once("ready", () => {
      game.mistHUD.statusScreen = new statusScreenApp();
  });
});

Hooks.on("getSceneControlButtons", (controls) => {
  console.log("mist-hud: Adding control buttons");
  
  // Find the token control section
  const tokenControls = controls.find((c) => c.name === "token");
  if (!tokenControls) {
    console.log("mist-hud: No token controls found");
    return;
  }

  // Add the Status Screen button
  tokenControls.tools.push({
    name: "statusScreen",
    title: "Statuses MC Screen",
    icon: "fa-solid fa-list",
    button: true,
    visible: game.user.isGM || game.user.isPlayer,
    onClick: () => {
      if (!game.mistHUD?.statusScreen) {
        ui.notifications.warn("MistHUD: Status Screen not found!");
        return;
      }
      game.mistHUD.statusScreen.render(true);
    }
  });

  // Only add the NPC Influence Manager button for GMs
  if (game.user.isGM) {
    // Add the NPC Influence Viewer button with skull icon
    tokenControls.tools.push({
      name: "npcInfluenceManager",
      title: "NPC Influence Viewer",
      icon: "fas fa-skull", // Using skull icon as requested
      button: true,
      visible: true,
      onClick: () => {
        console.log("mist-hud: NPC Influence button clicked");
        // Try both global references
        if (typeof globalThis.openNPCInfluenceManager === 'function') {
          globalThis.openNPCInfluenceManager();
        } else if (game.mistHud && typeof game.mistHud.openNPCInfluenceManager === 'function') {
          game.mistHud.openNPCInfluenceManager();
        } else {
          ui.notifications.error("NPC Influence Viewer function not available");
        }
      }
    });
  }
});

Hooks.on("dropCanvasData", async (canvas, dropData) => {
  // Process statuses (existing code)
  if (dropData?.type === "status") {
    const { name = "Unnamed Status", tier = 1, temporary = false, permanent = false } = dropData;
    
    const { x, y } = dropData;
    const token = canvas.tokens.placeables.find(t => t.bounds?.contains(x, y));
    if (!token) {
      console.warn("No token found under drop location.");
      return;
    }

    const actor = token.actor;
    if (!actor) {
      console.warn("No actor found on target token.");
      return;
    }

    const itemData = {
      name,
      type: "status",
      system: {
        pips: 0,
        tier,
        description: "",
        locked: false,
        version: "1",
        free_content: false,
        hidden: false,
        temporary: temporary,
        permanent: permanent,
        sceneId: null,
        showcased: false,
        specialType: ""
      },
      img: "icons/svg/item-bag.svg"
    };

    try {
      const [newStatus] = await actor.createEmbeddedDocuments("Item", [itemData]);
      
      // Show the animated notification over the token
      TokenStatusNotification.show(token, newStatus.name, newStatus.system.tier);
      
    } catch (err) {
      console.error("Error creating status on actor:", err);
    }
  }
  // Process story tags (new code)
  else if (dropData?.type === "story-tag") {
    const { 
      name = "Unnamed Tag", 
      isInverted = false, 
      temporary = false, 
      permanent = false,
      cssClass = ''
    } = dropData;
    
    const { x, y } = dropData;
    const token = canvas.tokens.placeables.find(t => t.bounds?.contains(x, y));
    if (!token) {
      console.warn("No token found under drop location.");
      return;
    }

    const actor = token.actor;
    if (!actor) {
      console.warn("No actor found on target token.");
      return;
    }

    // Create the tag data structure
    const itemData = {
      name,
      type: "tag",
      system: {
        description: "",
        subtype: "story",
        isInverted: isInverted,
        inverted: isInverted,  // Include both for compatibility
        temporary: temporary,
        permanent: permanent,
        locked: false,
        version: "1",
        free_content: false,
        hidden: false,
        burn_state: 0,
        burned: false,
        specialType: ""
      },
      img: "icons/svg/item-bag.svg"
    };

    try {
      // Create the tag on the actor
      const [newTag] = await actor.createEmbeddedDocuments("Item", [itemData]);
      
      // Set additional flags if needed (like positive/negative state)
      if (cssClass && (cssClass === 'positive' || cssClass === 'negative')) {
        await newTag.setFlag('mist-hud', 'tagState', cssClass);
      }
      
      // Show visual notification using the same style as status notifications
      TokenTagNotification.show(token, name, isInverted, cssClass);
      
    } catch (err) {
      console.error("Error creating story tag on actor:", err);
    }
  }
});
