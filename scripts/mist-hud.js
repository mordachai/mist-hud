// mist-hud.js

import { essenceDescriptions } from './mh-theme-config.js';
import { StoryTagDisplayContainer } from "/systems/city-of-mist/module/story-tag-window.js";
import { CityHelpers } from "/systems/city-of-mist/module/city-helpers.js";
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";
import { moveConfig } from "/modules/mist-hud/scripts/mh-theme-config.js";
import statusScreenApp from "./statusScreenApp.js";
import { showTooltip, hideTooltip } from '/modules/mist-hud/scripts/tooltip.js';
import { 
  getMysteryFromTheme, 
  getThemesAndTags, 
  getThemebooks, 
  getImprovements, 
  getActorStatuses, 
  getJuiceAndClues, 
  getEssence, 
  getLoadoutTags,
  applyBurnState
} from './mh-getters.js';


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

async function handleTagClick(event, tagType) {
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
  const actor = MistHUD.getInstance().actor;
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
  MistHUD.getInstance().calculateTotalPower();
}

function toggleInversion(tagElement, inversionIconConfig) {
  tagElement.toggleClass('inverted');
  const isInverted = tagElement.hasClass('inverted');
  const inversionIcon = isInverted ? inversionIconConfig.active : inversionIconConfig.default;
  tagElement.find(inversionIconConfig.selector).html(inversionIcon);
  MistHUD.getInstance().calculateTotalPower();
}

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

  static getInstance() {
    if (!MistHUD.instance) {
      MistHUD.instance = new MistHUD();
    }
    return MistHUD.instance;
  }

  setActor(actor) {
    if (!actor || actor.type !== 'character') { // Adjust 'character' to your actual actor type
      console.warn("Attempted to set an invalid actor.");
      return;
    }
    this.actor = actor;
    this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') || false;
    this.render(true);
  }

  // async render(force = false, options = {}) {
  //   // console.log(`[Help/Hurt Debug] Rendering HUD for actor:`, this.actor?.name);
  //   try {
  //     await super.render(true);
  //   } catch (error) {
  //   }
  // }

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

    

  const slidingPanel = document.getElementById('mh-sliding-panel');
  const panelEar = document.getElementById('mh-panel-ear');

  panelEar.addEventListener('click', () => {
    slidingPanel.classList.toggle('open');
  });


  // Find the window header within the entire element
  const header = this.element.find('.window-header');
  
  if (header.length === 0) {
    return;
  }
  
  // Inject the custom header without passing any parameters
  this.injectCustomHeader();
    
  html.find('.mh-power-tag').on('click', (event) => handleTagClick(event, 'power'));
  html.find('.mh-weakness-tag').on('click', (event) => handleTagClick(event, 'weakness'));
  html.find('.mh-story-tag').on('click', (event) => handleTagClick(event, 'story'));
  html.find('.mh-loadout-tag').on('click', (event) => handleTagClick(event, 'loadout'));

  html.find('.mh-pwrcrew-tag').on('click', (event) => { handleTagClick(event, 'power'); });
  html.find('.mh-wkcrew-tag').on('click', (event) => { handleTagClick(event, 'weakness'); });
  

    html.find('.mh-story-toggle').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const invertElement = $(event.currentTarget);
      const tagElement = invertElement.closest('.mh-story-tag');
      if (tagElement.hasClass('burned')) return;
      toggleInversion(tagElement, {
        active: '<i class="fa-light fa-angles-up"></i>',
        default: '<i class="fa-light fa-angles-down"></i>',
        selector: '.mh-story-toggle'
      });
    });  

    html.find('.mh-weakness-toggle').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const invertElement = $(event.currentTarget);
      const tagElement = invertElement.closest('.mh-weakness-tag');
      toggleInversion(tagElement, {
        active: '<i class="fa-regular fa-angles-up"></i>',
        default: '<i class="fa-light fa-angles-down"></i>',
        selector: '.mh-weakness-toggle'
      });
    });

    html.find('.mh-burn-toggle').on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
    
      const burnElement = $(event.currentTarget);
      const tagElement = burnElement.closest('.mh-power-tag, .mh-story-tag, .mh-loadout-tag');
      const tagId = tagElement.data('id');
      if (!tagId) return;
    
      // Determine which actor owns this tag.
      // Default to the main actor from MistHUD.
      let tagActor = MistHUD.getInstance().actor;
    
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
    
      // Now update the tag’s embedded document on the correct actor.
      const tagItem = tagActor.items.get(tagId);
      if (tagItem) {
        const updatedState = newState === "burned"; // true if burned, false otherwise.
        const burnState = newState === "toBurn" ? 1 : 0; // numeric burn state.
        await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
      } else {
        console.warn(`[Burn Debug] Tag item not found on actor '${tagActor.name}' for tag ID: ${tagId}`);
      }
    
      // Recalculate total power.
      MistHUD.getInstance().calculateTotalPower();
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
  
      console.log(`Status ${statusId} updated to ${newState}`);
  
      // Recalculate total power after updating the status
      this.calculateTotalPower();
    });      

    html.find('.help-toggle, .hurt-toggle').on('change', async (event) => {
      const toggle = event.currentTarget;
      const isChecked = toggle.checked;
      const targetActorId = toggle.dataset.targetId; // ID of the receiving player
      const bonusType = toggle.classList.contains('help-toggle') ? 'help' : 'hurt'; // Type of bonus
      const amount = Number(toggle.dataset.amount); // Bonus value
      const actorId = game.user.character?.id; // ID of the giving player
  
      // console.log(`[Help/Hurt Debug] Checkbox State:`, {
      //     isChecked,
      //     bonusType,
      //     amount,
      //     givingPlayer: actorId,
      //     receivingPlayer: targetActorId,
      // });
  
      if (!actorId) {
          console.warn(`[Help/Hurt Debug] No actor linked to the giving player.`);
          return;
      }
  
      // Emit socket event to update all clients
      game.socket.emit('system.mist-hud', {
          type: 'update-bonus',
          actorId, // Giving player
          targetId: targetActorId, // Receiving player
          bonusType,
          active: isChecked,
          amount,
      });
  
      // Emit socket event to notify the receiving player
      game.socket.emit('system.mist-hud', {
        type: 'notify-bonus',
        targetId: targetActorId,
        giverId: actorId,
        bonusType,
        amount,
        active: isChecked,
      });
    });

    // Add listener for clue creation and deletion deletion
    html.find('.clue-delete').on("click", this._deleteClueFromHUD.bind(this));
    html.find('.create-clue').on("click", this._createClueFromHUD.bind(this));

    // Add listeners for juice creation and deletion
    html.find('.juice-delete').on("click", this._deleteJuiceFromHUD.bind(this));
    html.find('.create-juice').on("click", this._createJuiceFromHUD.bind(this));

    // Reset button functionality
    html.on("click", ".toggle-expended", async (event) => {
        event.preventDefault();
        const button = $(event.currentTarget);
        const itemId = button.data("itemId");
        const actorId = button.data("actorId");
        const actor = game.actors.get(actorId);

        if (actor) {
            const item = actor.items.get(itemId);
            if (item) {
                const max = item.system.uses?.max || 0;
                if (max > 0) {
                    await item.update({ "system.uses.current": max });
                    ui.notifications.info(`Reset uses of "${item.name}" to ${max}.`);
                    this.render(); // Re-render the HUD to reflect changes
                }
            }
        }
    });
    
    html.find('.create-story-tag').on("click", this._createStoryTagFromHUD.bind(this));

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
        // console.log(`Story tag ${tagId} deleted.`);
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
      // console.log(`Story tag ${tagId} edited.`);
      this.render(false); // Refresh the HUD
    });

    html.find('.create-status').on("click", this._createStatusFromHUD.bind(this));

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
      // console.log(`Status ${statusId} deleted.`);
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
        // console.log(`Status ${statusId} edited.`);
        this.render(false); // Refresh the HUD
    });

    // Make each .mh-status element draggable
    html.find('.mh-status').each((i, el) => {
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
  }
  
  getData(options) {
    const data = super.getData(options);
    if (!this.actor) return data;
  
    data.actor = this.actor;
    data.token = canvas.tokens.controlled[0] || null;
    data.scene = game.scenes.current || null;

    // this.isCollapsed = this.actor.getFlag('mist-hud', 'isCollapsed') || false;
    // data.isCollapsed = this.isCollapsed;
  
    const activeSystem = game.settings.get("city-of-mist", "system");
    data.activeSystem = activeSystem;
    data.isCityOfMist = activeSystem === "city-of-mist";
    data.isOtherscape = activeSystem === "otherscape";
  
    // Get the persisted selected tag IDs (assumed to be stored as an array)
    const selectedTags = this.actor.getFlag('mist-hud', 'selected-tags') || [];
    const selectedCrewTags = this.actor.getFlag('mist-hud', 'selected-crew-tags') || [];
  
    // Use the imported getters:
    const themesAndTags = getThemesAndTags(this.actor);
  
    // Update themes' power and weakness tags to include the selected property:
    themesAndTags.themes = themesAndTags.themes.map(theme => {
      if (theme.powerTags && Array.isArray(theme.powerTags)) {
        theme.powerTags = theme.powerTags.map(tag => ({
          ...tag,
          selected: selectedTags.includes(tag.id)
        }));
      }
      if (theme.weaknessTags && Array.isArray(theme.weaknessTags)) {
        theme.weaknessTags = theme.weaknessTags.map(tag => ({
          ...tag,
          selected: selectedTags.includes(tag.id)
        }));
      }
      return theme;
    });

    // Apply the selected state to the crew themes separately
    data.crewThemes = themesAndTags.crewThemes.map(crewTheme => {
      if (crewTheme.powerTags) {
          crewTheme.powerTags = crewTheme.powerTags.map(tag => ({
              ...tag,
              selected: selectedCrewTags.some(ct => ct.id === tag.id),
              crispy: tag.crispy
          }));
      }
      if (crewTheme.weaknessTags) {
          crewTheme.weaknessTags = crewTheme.weaknessTags.map(tag => ({
              ...tag,
              selected: selectedCrewTags.some(ct => ct.id === tag.id)
          }));
      }
      return crewTheme;
    });
    
  
    // Update story tags to include the selected property:
    themesAndTags.storyTags = themesAndTags.storyTags.map(tag => ({
      ...tag,
      selected: selectedTags.includes(tag.id)
    }));
  
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
  
    const receivedBonuses = this.actor.getFlag('mist-hud', 'received-bonuses') || [];
    data.helpHurtMessages = receivedBonuses.length > 0 ? receivedBonuses : null;
  
    const improvements = getImprovements(this.actor);
    data.improvements = improvements;
    data.hasImprovements = improvements.length > 0;
  
    return data;
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

    // Refresh the HUD to display the new clue
    this.render(false);
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

    // Optionally, re-render the HUD if necessary
    this.render(false);
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

    // Refresh the HUD to display the new juice
    this.render(false);
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

    // Refresh the HUD to display updated juice
    this.render(false);
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

        // Check if tag creation was successful (assume creation succeeded if no error is thrown)
        // if (createdTag === undefined) {
        //     console.log("Story tag created successfully, but no return value provided by createStoryTag.");
        // } else {
        //     console.log("Story tag created successfully:", createdTag);
        // }

        this.render(false); // Refresh the HUD
    } catch (err) {
        console.error("Error creating a story tag:", err);
    }
  }

  addTooltipListeners(html) {
    html.find('.mh-theme-icon').each((index, element) => {
      const themeId = $(element).data('theme-id');
      $(element).hover(
        (event) => {
          // Call the imported function with the actor and themeId
          const mystery = getMysteryFromTheme(this.actor, themeId);
          // Save the tooltip reference on the element or the instance
          this.currentTooltip = showTooltip(event, mystery);
        },
        () => {
          if (this.currentTooltip) {
            hideTooltip(this.currentTooltip);
            this.currentTooltip = null;
          }
        }
      );
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
      stateClass: $(el).find('.mh-burn-toggle').hasClass('toBurn') ? "to-burn" :
                  $(el).find('.mh-burn-toggle').hasClass('burned') ? "burned" : "selected",
      crispy: $(el).hasClass('mh-crispy')
    })).get();

    const weaknessTags = this.element.find('.mh-weakness-tag.selected').map((i, el) => ({
        tagName: $(el).text().trim(),
        id: $(el).data('id'),
        actorId: $(el).data('actor-id'),
        stateClass: $(el).hasClass('inverted') ? "inverted" : "normal"
    })).get();

    const crewPowerTags = this.element.find('.mh-power-tag.Crew.selected').map((i, el) => ({
      tagName: $(el).text().trim(),
      id: $(el).data('id'),
      actorId: $(el).data('actor-id'),
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
          stateClass
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
            stateClass
        };
    }).get();

    const selectedStatuses = this.element.find('.mh-status.selected').map((i, el) => {
      const name = $(el).attr('data-status-name') || $(el).data('statusName');
      const tier = parseInt($(el).data('tier')) || 0;
      const typeClass = $(el).hasClass('positive') ? "positive" :
                        $(el).hasClass('negative') ? "negative" : "neutral";
  
      // console.log(`Status Selected for Roll: ID: ${$(el).data('status-id')}, Name: ${name}, Tier: ${tier}, Type: ${typeClass}`);
  
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
  
  async cleanHUD() {
    try {
      if (!this.actor) {
        console.warn("No actor set for MistHUD. Skipping actor updates.");
        return;
      }
  
      console.log("[Burn Debug] Cleaning HUD and applying burn state updates...");
  
      const tagsToUpdate = this.element.find(
        '.mh-power-tag.toBurn, .mh-weakness-tag.toBurn, .mh-story-tag.toBurn, .mh-loadout-tag.toBurn, .mh-power-tag.Crew.toBurn, .mh-power-tag[data-crispy="true"], .mh-power-tag.Crew[data-crispy="true"]'
      );      
             
      for (const element of tagsToUpdate) {
        const $tag = $(element);
        const tagId = $tag.data('id');
        const tagItem = this.actor.items.get(tagId);
    
        if (tagItem) {
            console.log(`[Burn Debug] Marking tag '${tagItem.name}' as burned.`);
            await tagItem.update({
                "system.burned": true,
                "system.burn_state": 0
            });
        }
    
        // Update the DOM classes
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
          console.log(`Deleting temporary status: ${$status.data('status-name')}`);
          await this.actor.deleteEmbeddedDocuments("Item", [statusId]);
        }
      }
  
      // 3. Optionally, delete temporary tags used in the roll.
      // If you have temporary tags (e.g. with system.temporary == true) that should be removed,
      // you can uncomment and adjust the code below.
      /*
      const temporaryTags = this.actor.items.contents.filter(item =>
        item.type === 'tag' && item.system.temporary === true
      );
      for (const tag of temporaryTags) {
        console.log(`Deleting temporary tag: ${tag.name}`);
        await this.actor.deleteEmbeddedDocuments("Item", [tag.id]);
        // Also update the persisted selected-tags flag, if needed.
        let selectedTags = this.actor.getFlag('mist-hud', 'selected-tags') || [];
        selectedTags = selectedTags.filter(id => id !== tag.id);
        await this.actor.setFlag('mist-hud', 'selected-tags', selectedTags);
      }
      */
  
      // 4. Preserve statuses selection from saved flags.
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
  
      // 5. IMPORTANT: Do not clear the persistent tag selections.
      // If you want tag selections (for power, weakness, story, loadout tags) to persist between rolls,
      // do not clear the "selected-tags" flag.
      //
      // (If you DO want to clear them after a roll, you could do:
      await this.actor.unsetFlag('mist-hud', 'selected-tags');
      await this.actor.unsetFlag('mist-hud', 'selected-crew-tags');
      // But that would force the user to reselect their tags.)
  
      // 6. Reset modifier and update its display.
      this.modifier = 0;
      this.updateModifierDisplay();
  
      // 7. Finally, re-render the HUD so that the getData() method re-applies the correct data,
      // including restoring persistent tag selections.
      await this.render(true);
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

//Hook to control the HUD based on token selection
Hooks.on('controlToken', (token, controlled) => {
  if (controlled && token.actor && token.actor.type === 'character') {
    MistHUD.getInstance().setActor(token.actor);
  } else if (!controlled && MistHUD.instance) {
    MistHUD.getInstance().close();
  }
});

// Hook to update HUD when actor data changes
Hooks.on('updateActor', (actor, data, options, userId) => {
  if (MistHUD.instance && MistHUD.instance.actor?.id === actor.id) {
    MistHUD.getInstance().render(true);
  }
});

Hooks.once('ready', () => {
  game.socket.on('system.mist-hud', async (data) => {

      if (data.type === 'notify-bonus' && game.user.character?.id === data.targetId) {
          const targetActor = game.actors?.get(data.targetId);
          const giverActor = game.actors?.get(data.giverId);

          if (!targetActor || !giverActor) {
              console.warn(`[Help/Hurt Debug] Invalid target or giver actor.`, { targetActor, giverActor });
              return;
          }

          // console.log(`[Help/Hurt Debug] Notification received:`, {
          //     targetActor: targetActor.name,
          //     giverActor: giverActor.name,
          //     bonusType: data.bonusType,
          //     amount: data.amount,
          //     active: data.active,
          // });

          const message = {
              giverName: giverActor.name,
              type: data.bonusType,
              amount: data.amount,
          };

          const currentBonuses = targetActor.getFlag('mist-hud', 'received-bonuses') || [];
          // console.log(`[Help/Hurt Debug] Current bonuses before update for target "${targetActor.name}":`, currentBonuses);

          if (data.active) {
              currentBonuses.push(message);
          } else {
              const index = currentBonuses.findIndex(
                  (bonus) => bonus.giverName === message.giverName && bonus.type === message.type
              );
              if (index !== -1) {
                  currentBonuses.splice(index, 1);
              }
          }

          // Update the flag and verify the change
          await targetActor.setFlag('mist-hud', 'received-bonuses', currentBonuses);
          // const updatedBonuses = targetActor.getFlag('mist-hud', 'received-bonuses');
          // console.log(`[Help/Hurt Debug] Updated bonuses confirmed for target "${targetActor.name}":`, updatedBonuses);

          MistHUD.getInstance().render(true);
      }
  });
});

// In your module or main script file, register these once during init or ready:
Hooks.on('createItem', (item, options, userId) => {
  // Only for items embedded in an Actor:
  if (!item.isEmbedded) return;
  const actor = item.parent;
  // Make sure the MistHUD is open for this actor:
  if (!actor || !MistHUD.instance || actor.id !== MistHUD.instance.actor?.id) return;

  // Re-render the HUD if the Actor that owns the item is the same as the HUD’s actor
  MistHUD.instance.render(true);
});

Hooks.on('updateItem', (item, diff, options, userId) => {
  if (!item.isEmbedded) return;
  const actor = item.parent;
  if (!actor || !MistHUD.instance || actor.id !== MistHUD.instance.actor?.id) return;

  MistHUD.instance.render(true);
});

Hooks.on('deleteItem', (item, options, userId) => {
  if (!item.isEmbedded) return;
  const actor = item.parent;
  if (!actor || !MistHUD.instance || actor.id !== MistHUD.instance.actor?.id) return;

  MistHUD.instance.render(true);
});

Hooks.on("dropCanvasData", async (canvas, dropData) => {
  if (dropData?.type !== "status") return;


  const { name = "Unnamed Status", tier = 1 } = dropData;
  console.log("[dropCanvasData] Received status drop:", dropData);
  
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
      temporary: false,
      permanent: false,
      sceneId: null,
      showcased: false,
      specialType: ""
    },

    img: "icons/svg/item-bag.svg"
  };


  try {
    const [newStatus] = await actor.createEmbeddedDocuments("Item", [itemData]);
    console.log(
      `Created new status [${newStatus.name}] tier ${newStatus.system.tier} on ${actor.name}`
    );
    ui.notifications.info(`Gave ${actor.name} status: ${newStatus.name}-${newStatus.system.tier}`);
  } catch (err) {
    console.error("Error creating status on actor:", err);
  }
});

Hooks.on("renderMistHUD", (app, html, data) => {
  // Remove existing roll bars to prevent duplication
  html.find(".mh-roll-bar").remove();

  // Check if roll buttons should be in the hotbar instead of the HUD
  const useHotbar = game.settings.get("mist-hud", "useHotbarForRolls");
  if (useHotbar) return; // Skip rendering roll buttons in the HUD

  // Get user setting for text or image display
  const useText = game.settings.get("mist-hud", "useTextButtons");

  // Detect the active system (from Foundry settings)
  const activeSystem = game.settings.get("city-of-mist", "system");

  // Create roll bar and move containers
  const rollBar = $(`<div class="mh-roll-bar"></div>`);
  const coreMovesContainer = $(`<div class="mh-roll-container core-moves"></div>`);
  const specialMovesContainer = $(`<div class="mh-roll-container special-moves"></div>`);

  Object.keys(moveConfig).forEach(moveName => {
    const moveData = moveConfig[moveName];
    if (!moveData || !moveData.name || moveData.system !== activeSystem) return;

    const translatedName = game.i18n.localize(moveData.name);
    let tooltipText = translatedName;

    let buttonContent;
    let buttonClass = "mh-roll-button"; // Default button class

    if (moveData.subtitle) {
      const translatedSubtitle = game.i18n.localize(moveData.subtitle);
      tooltipText += ` - ${translatedSubtitle}`;
    }

    if (!useText && moveData.image) { // Use images if text mode is NOT enabled
      buttonContent = `<img src="modules/mist-hud/ui/${moveData.image}" alt="${translatedName}" class="mh-roll-img">`;
      buttonClass += " mh-roll-button-img"; // Apply special styling for images
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
      console.log(`Executing move: ${tooltipText}`);
      CityOfMistRolls.executeMove(moveName);
    });

    // Assign moves to the correct page based on slot
    if (moveData.slot >= 1 && moveData.slot <= 10) {
      coreMovesContainer.append(button);
    } else if (moveData.slot >= 11 && moveData.slot <= 20) {
      specialMovesContainer.append(button);
    }
  });

  // Initially, hide the special moves container
  specialMovesContainer.hide();

  // Get localized tooltips
  const coreMovesText = game.i18n.localize("CityOfMist.terms.coreMoves");
  const specialMovesText = game.i18n.localize("CityOfMist.terms.specialMoves");

  // Create the page toggle button with initial tooltip
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

  // Append containers and toggle button
  rollBar.append(coreMovesContainer, specialMovesContainer, toggleButton);
  html.find(".mh-content").prepend(rollBar);
});

Hooks.once("init", async function () {
  console.log("MistHUD | Initializing");

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
      console.log("MistHUD | statusScreenApp Initialized");
  });
});

Hooks.once("ready", () => {
  console.log("MistHUD | Ready");
});

Hooks.on("getSceneControlButtons", (controls) => {
  // Find the token control section
  const tokenControls = controls.find((c) => c.name === "token");
  if (!tokenControls) return;

  // Add the new button
  tokenControls.tools.push({
      name: "statusScreen",
      title: "Statuses MC Screen",
      icon: "fa-solid fa-list", // You can replace this with a custom icon
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

  console.log("MistHUD | Status Screen button added to Token Controls.");
});

