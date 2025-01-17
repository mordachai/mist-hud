// mist-hud.js

import { essenceDescriptions } from './mh-theme-config.js';
import { StoryTagDisplayContainer } from "/systems/city-of-mist/module/story-tag-window.js";
import { CityHelpers } from "/systems/city-of-mist/module/city-helpers.js";
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";

// Register Handlebars helper for localizeTheme
Handlebars.registerHelper('localizeTheme', function(themebookName) {
  return localizeTheme(themebookName);
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

  async render(force = false, options = {}) {
    // console.log(`[Help/Hurt Debug] Rendering HUD for actor:`, this.actor?.name);
    try {
      await super.render(true);
    } catch (error) {
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
    
    // Power tag selection
    html.find('.mh-power-tag').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const tagElement = $(event.currentTarget);
  
      // Prevent selection if burned
      if (tagElement.hasClass('burned')) return;
  
      // Toggle selection state
      tagElement.toggleClass('selected');
      this.calculateTotalPower();
    });

    // Loadout tag selection
    html.find('.mh-loadout-tag').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const tagElement = $(event.currentTarget);

      // Prevent selection if burned
      if (tagElement.hasClass('burned')) return;

      // Toggle selection state
      tagElement.toggleClass('selected');
      this.calculateTotalPower();
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
      
      // Recalculate the power after selection state changes
      this.calculateTotalPower();
    });

    // Story tag inversion toggle (clicking only the inversion icon)
    html.find('.mh-story-toggle').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const invertElement = $(event.currentTarget);
      const tagElement = invertElement.closest('.mh-story-tag');

      // Prevent inversion if burned
      if (tagElement.hasClass('burned')) return;

      // Toggle inverted state
      const isCurrentlyInverted = tagElement.hasClass('inverted');
      tagElement.toggleClass('inverted');

      // Update the inversion icon based on the new inverted state
      const inversionIcon = isCurrentlyInverted
        ? '<i class="fa-light fa-angles-up"></i>'  // Default icon when positive
        : '<i class="fa-light fa-angles-down"></i>'; // Icon when inverted (negative)

      // Update the HTML content of the inversion icon
      invertElement.html(inversionIcon);

      // Recalculate the power after inversion state changes
      this.calculateTotalPower();
    });
  
    // Weakness tag selection toggle
    html.find('.mh-weakness-tag').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const tagElement = $(event.currentTarget);

      // Toggle the selected state
      tagElement.toggleClass('selected');
      
      // Recalculate the power after selection state changes
      this.calculateTotalPower();
    });

    // Weakness tag inversion toggle
    html.find('.mh-weakness-toggle').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const invertElement = $(event.currentTarget);
      const tagElement = invertElement.closest('.mh-weakness-tag');
      
      // Toggle inverted state
      tagElement.toggleClass('inverted');  // Ensure 'inverted' class is added when toggled

      // Update inversion icon based on inverted state
      const isCurrentlyInverted = tagElement.hasClass('inverted');
      const inversionIcon = isCurrentlyInverted
        ? '<i class="fa-regular fa-angles-up"></i>'  // Icon when inverted (positive state)
        : '<i class="fa-light fa-angles-down"></i>'; // Default icon (negative state)

      // Update the HTML content of the inversion icon
      invertElement.html(inversionIcon);

      this.calculateTotalPower();
    });
  
    // Burn icon toggle for both power and story tags
    // html.find('.mh-burn-toggle').on('click', async (event) => {
    //   event.stopPropagation();
    //   event.preventDefault();
      
    //   const burnElement = $(event.currentTarget);
    //   const tagElement = burnElement.closest('.mh-power-tag, .mh-story-tag, .mh-loadout-tag');
    //   const tagId = tagElement.data('id');
  
    //   const currentState = burnElement.hasClass('burned') ? "burned" :
    //                        burnElement.hasClass('toBurn') ? "toBurn" : "unburned";
  
    //   // Determine new state
    //   const newState = currentState === "unburned" ? "toBurn" :
    //                    currentState === "toBurn" ? "burned" : "unburned";
  
    //   // Update the DOM classes for the icon and text
    //   burnElement.removeClass('unburned toBurn burned').addClass(newState);
    //   tagElement.removeClass('unburned toBurn burned').addClass(newState); // Also remove 'selected'
  
    //   // Update text state if necessary
    //   const newIcon = MistHUD.getIcon(newState, 'burn');
    //   burnElement.html(newIcon);
  
    //   if (newState === "burned") {
    //       // Deselect the tag visually
    //       tagElement.removeClass('selected');
    //       tagElement.find('.tag-text').addClass('burned-text'); // Add burned text class
    //   } else {
    //       tagElement.find('.tag-text').removeClass('burned-text'); // Remove burned text class if not burned
    //   }
  
    //   // Update the tag's state in the actor's data
    //   const tagItem = this.actor.items.get(tagId);
    //   if (tagItem) {
    //       const updatedState = newState === "burned";
    //       const burnState = newState === "toBurn" ? 1 : 0;
    //       await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
    //   }
  
    //   // Recalculate total power to reflect deselection
    //   this.calculateTotalPower();
    // });

    // html.find('.mh-burn-toggle').on('click', async (event) => {
    //   event.stopPropagation();
    //   event.preventDefault();
    
    //   const burnElement = $(event.currentTarget);
    //   const tagElement = burnElement.closest('.mh-power-tag, .mh-story-tag, .mh-loadout-tag');
    //   const tagId = tagElement.data('id');
    
    //   const currentState = burnElement.hasClass('burned') ? "burned" :
    //                        burnElement.hasClass('toBurn') ? "toBurn" : "unburned";
    
    //   // Determine new state
    //   const newState = currentState === "unburned" ? "toBurn" :
    //                    currentState === "toBurn" ? "burned" : "unburned";
    
    //   // Update the DOM classes for the icon and tag
    //   burnElement.removeClass('unburned toBurn burned').addClass(newState);
    //   tagElement.removeClass('unburned toBurn burned').addClass(newState); // Also remove 'selected'
    
    //   // Update the tag's state in the actor's data
    //   const tagItem = this.actor.items.get(tagId);
    //   if (tagItem) {
    //     const updatedState = newState === "burned";
    //     const burnState = newState === "toBurn" ? 1 : 0;
    //     await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
    //   }
    
    //   // Recalculate total power
    //   this.calculateTotalPower();
    // });

    html.find('.mh-burn-toggle').on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
    
      const burnElement = $(event.currentTarget);
      const tagElement = burnElement.closest('.mh-power-tag, .mh-story-tag, .mh-loadout-tag');
      const tagId = tagElement.data('id');
    
      // Determine the current state
      const currentState = burnElement.hasClass('burned') ? "burned" :
                           burnElement.hasClass('toBurn') ? "toBurn" : "unburned";
    
      // Cycle to the new state
      const newState = currentState === "unburned" ? "toBurn" :
                       currentState === "toBurn" ? "burned" : "unburned";
    
      // Update the classes for the burn state
      burnElement.removeClass('unburned toBurn burned').addClass(newState);
      tagElement.removeClass('unburned toBurn burned').addClass(newState);
    
      // Automatically deselect the tag if the new state is "burned"
      if (newState === "burned") {
        tagElement.removeClass('selected'); // Deselect the tag
      }
    
      // Update the tag's state in the actor's data
      const tagItem = this.actor.items.get(tagId);
      if (tagItem) {
        const updatedState = newState === "burned"; // Boolean for burned state
        const burnState = newState === "toBurn" ? 1 : 0; // Numeric for burn state
        await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
      }
    
      // Recalculate total power to reflect any changes
      this.calculateTotalPower();
    });
    
    // html.find('.mh-status').on('click', async (event) => {
    //   event.stopPropagation();
    //   event.preventDefault();
  
    //   const statusElement = $(event.currentTarget);
    //   const statusId = statusElement.data('status-id');
  
    //   if (!statusId) {
    //       console.error("Missing status ID for state update.");
    //       return;
    //   }
  
    //   // Cycle through states: neutral -> negative -> positive -> neutral
    //   let newState = 'neutral';
    //   if (statusElement.hasClass('neutral')) {
    //       newState = 'negative';
    //       statusElement.removeClass('neutral').addClass('negative selected');
    //   } else if (statusElement.hasClass('negative')) {
    //       newState = 'positive';
    //       statusElement.removeClass('negative').addClass('positive selected');
    //   } else if (statusElement.hasClass('positive')) {
    //       newState = 'neutral';
    //       statusElement.removeClass('positive selected').addClass('neutral');
    //   }
  
    //   // Add or remove the `selected` class based on state
    //   if (newState === 'neutral') {
    //       statusElement.removeClass('selected'); // Neutral status is not selected
    //   } else {
    //       statusElement.addClass('selected'); // Non-neutral statuses are selected
    //   }
  
    //   // Persist state to actor flags
    //   const savedStates = this.actor.getFlag('mist-hud', 'status-states') || {};
    //   savedStates[statusId] = {
    //       state: newState,
    //       selected: newState !== 'neutral' // Selected if not neutral
    //   };
    //   await this.actor.setFlag('mist-hud', 'status-states', savedStates);
  
    //   console.log(`Status ${statusId} updated to ${newState}`);
  
    //   // Recalculate total power after updating the status
    //   this.calculateTotalPower();
    // });
     

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

    // Tooltip for theme type
    html.find(".theme-type").hover(
        (event) => {
            const themeName = $(event.currentTarget).data("themeName");
            if (!themeName) return;

            // Create and display tooltip
            const tooltip = $(`<div class="mh-tooltip">${themeName}</div>`);
            $("body").append(tooltip);

            tooltip.css({
                top: event.pageY + 10,
                left: event.pageX + 10
            });

            $(event.currentTarget).data("tooltipElement", tooltip);
        },
        (event) => {
            // Remove tooltip on hover out
            const tooltip = $(event.currentTarget).data("tooltipElement");
            if (tooltip) {
                tooltip.remove();
                $(event.currentTarget).removeData("tooltipElement");
            }
        }
    );

    html.find(".theme-type").mousemove((event) => {
        const tooltip = $(event.currentTarget).data("tooltipElement");
        if (tooltip) {
            tooltip.css({
                top: event.pageY + 10,
                left: event.pageX + 10
            });
        }
    });

    html.find('.create-story-tag').on("click", this._createStoryTagFromHUD.bind(this));

    html.find('.create-status').on("click", this._createStatusFromHUD.bind(this));

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

    // Get the active system setting
    const activeSystem = game.settings.get("city-of-mist", "system");
    data.activeSystem = activeSystem;

    // Define flags for supported systems
    data.isCityOfMist = activeSystem === "city-of-mist";
    data.isOtherscape = activeSystem === "otherscape";

    const themesAndTags = this.getThemesAndTags();
    data.themes = themesAndTags.themes;
    data.storyTags = themesAndTags.storyTags;
    data.hasStoryTags = !!(themesAndTags.storyTags && themesAndTags.storyTags.length > 0);
    data.loadoutTags = this.getLoadoutTags();
    data.crewThemes = themesAndTags.crewThemes;

    // Ensure crew themes are flagged
    data.hasCrewThemes = data.crewThemes && data.crewThemes.length > 0;
    console.log("Crew Themes:", data.crewThemes);

    // 1) Basic raw statuses
    const rawStatuses = this.getActorStatuses();

    // 2) The savedStates from flags
    const savedStates = this.actor.getFlag('mist-hud', 'status-states') || {};

    data.statuses = rawStatuses.map(st => {
      // If no savedState for this ID, default to neutral
      const {state="neutral", selected=false} = savedStates[st.id] || {};
      
      // Merge them into a single object for the template
      return {
        ...st,
        statusType: state,   // e.g., "neutral", "positive", or "negative"
        selected
      };
    });

       // Process Juice and Clues for City of Mist
    if (data.isCityOfMist) {
        const { helpItems, hurtItems, clueItems, juiceItems } = this.getJuiceAndClues();
        data.helpItems = helpItems || [];
        data.hurtItems = hurtItems || [];
        data.clueItems = clueItems || [];
        data.juiceItems = juiceItems || [];
    } else if (data.isOtherscape) {
        // Process essence for Otherscape
        const themes = this.actor.items.filter(item => item.type === "theme");
        const essenceData = this.getEssence(themes);

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

    // Add Help and Hurt messages for the receiving player
    const receivedBonuses = this.actor.getFlag('mist-hud', 'received-bonuses') || [];

    data.helpHurtMessages = receivedBonuses.length > 0 ? receivedBonuses : null;

    // Add improvements
    const improvements = this.getImprovements();
    data.improvements = improvements;
    data.hasImprovements = improvements.length > 0;

    return data;
  }


  getCrewThemes() {
    if (!this.actor) return [];

    const nonGMOwners = game.users.filter(user => 
        !user.isGM && this.actor.testUserPermission(user, "OWNER")
    );

    const ownedCrews = game.actors.contents.filter(actor => 
        actor.type === "crew" &&
        nonGMOwners.some(user => actor.testUserPermission(user, "OWNER"))
    );

    // console.log("Owned Crews:", ownedCrews);

    return ownedCrews.flatMap(crew =>
        crew.items.filter(item => item.type === "theme").map(theme => ({
            id: theme.id,
            name: theme.name,
            crewName: crew.name,
            actorId: crew.id, // Include the actor ID for easier lookup
        }))
    );
  }
  
  getThemesAndTags() {
    if (!this.actor) return {};

    const items = this.actor.items.contents;

    // Filter out standard themes and tags
    const themeItems = items.filter(item => item.type === "theme" && item.name !== "__LOADOUT__");
    const tagItems = items.filter(item => item.type === "tag");

    // Group subtags by their parent
    const subTagsByParent = tagItems.reduce((acc, tag) => {
        if (tag.system.parentId) {
            if (!acc[tag.system.parentId]) acc[tag.system.parentId] = [];
            acc[tag.system.parentId].push(tag);
        }
        return acc;
    }, {});

    // Process actor themes
    const themes = themeItems.map(theme => {
        const themeId = theme.id;
        let realThemebook = theme.themebook;

        // Resolve the correct themebook for Otherscape
        if (realThemebook?.isThemeKit && realThemebook.isThemeKit()) {
            realThemebook = realThemebook.themebook;
        }

        if (!realThemebook) {
            console.warn(`Themebook is missing or null for theme: ${theme.name}`);
            return null;
        }

        const themeType = realThemebook.system?.subtype || "default-icon";

        const powerTags = this.getPowerTags(themeId, tagItems, subTagsByParent, this.actor);
        const weaknessTags = this.getWeaknessTags(themeId, tagItems, subTagsByParent, this.actor);

        return {
            id: themeId,
            themeName: theme.name,
            category: themeType, // Assign Mythos, Logos, Noise, etc.
            iconClass: `mh-theme-icon ${themeType}`,
            powerTags,
            weaknessTags,
            localizedThemebookName: realThemebook.name, // Ensure localized name
        };
    }).filter(Boolean);

    // Process crew themes
    const crewThemes = this.getCrewThemes().map(crewTheme => {
        const crewActor = game.actors.get(crewTheme.actorId); // Fetch the crew actor
        const crewTags = crewActor?.items?.filter(item => item.type === "tag") || [];
        const crewSubTagsByParent = crewTags.reduce((acc, tag) => {
            if (tag.system.parentId) {
                if (!acc[tag.system.parentId]) acc[tag.system.parentId] = [];
                acc[tag.system.parentId].push(tag);
            }
            return acc;
        }, {});

        return {
            id: crewTheme.id,
            themeName: crewTheme.name,
            crewName: crewTheme.crewName,
            category: "crew", // Differentiate crew themes
            iconClass: "mh-theme-icon crew",
            powerTags: this.getPowerTags(crewTheme.id, crewTags, crewSubTagsByParent, crewActor),
            weaknessTags: this.getWeaknessTags(crewTheme.id, crewTags, crewSubTagsByParent, crewActor),
        };
    });

    // Retrieve story tags
    const storyTags = this.getStoryTags();

    return {
        themes,       // Actor themes
        crewThemes,   // Crew themes
        storyTags,    // Story tags
    };
  }
 
  getThemebooks() {
    if (!this.actor || !this.actor.items) {
        console.error("Invalid actor provided.");
        return [];
    }

    const items = this.actor.items.contents;

    // Passo 1: Extrair temas e tags
    const themes = items.filter(item => item.type === "theme" && item.name !== "__LOADOUT__");
    const tagItems = items.filter(item => item.type === "tag");

    return themes.map(theme => {
        let realThemebook;
        const themebook = theme.themebook;

        if (themebook?.isThemeKit()) {
            realThemebook = themebook.themebook;
        } else {
            realThemebook = themebook;
        }

        // Garantir que o realThemebook não é nulo
        if (!realThemebook) {
            console.warn(`Themebook is null for theme: ${theme.name}`);
            return null;
        }

        const themeType = realThemebook.system?.subtype || "default-icon";
        const themeIcon = `mh-theme-icon ${themeType}`;

        return {
            id: theme._id,
            themeName: theme.name,
            themebook_id: realThemebook._id,
            themebook_name: realThemebook.name,
            themeIcon,
            themeType,
            burnState: theme.system?.burned ? 'burned' : '',
            mystery: theme.system?.mystery || "",
            themeInfo: {
                motivation: realThemebook.system?.motivation || "",
                locale_name: realThemebook.system?.locale_name?.replace(/^#/, "") || "" // Remover #
            }
        };

    }).filter(Boolean); // Remover entradas nulas de temas inválidos
  }

  getImprovements() {
    if (!this.actor) return [];
  
    const items = this.actor.items.contents;
  
    // Filter for themes and build a map of theme information
    const themes = items
      .filter(item => item.type === "theme")
      .reduce((acc, theme) => {
        let realThemebook;
        const themebook = theme.themebook;
  
        if (themebook?.isThemeKit()) {
          realThemebook = themebook.themebook;
        } else {
          realThemebook = themebook;
        }
  
        if (!realThemebook) {
          console.warn(`No themebook found for theme: ${theme.name}`);
          return acc;
        }
  
        acc[theme._id] = {
          id: theme._id,
          name: theme.name || "Unnamed Theme",
          themebookName: realThemebook.name || "Unnamed Themebook",
          themeType: realThemebook.system.subtype || "Unknown Type",
        };
        return acc;
      }, {});
  
    // Group improvements under their associated themebooks
    const improvementsGroupedByThemebook = items
      .filter(item => item.type === "improvement" && themes[item.system.theme_id]) // Only improvements with valid themes
      .reduce((acc, item) => {
        const theme = themes[item.system.theme_id];
        const themebookName = theme.themebookName;
  
        if (!acc[themebookName]) {
          acc[themebookName] = {
            themebookName,
            themeType: theme.themeType,
            improvements: [],
          };
        }
  
        acc[themebookName].improvements.push({
          id: item.id,
          name: item.name,
          description: item.system.description || "No description provided.",
          choiceItem: item.system.choice_item || null,
          uses: item.system.uses || { max: 0, current: 0, expended: false },
        });
  
        return acc;
      }, {});
  
    return Object.values(improvementsGroupedByThemebook);
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

  getMysteryFromTheme(themeId) {
    if (!this.actor) {
        console.warn("No actor set in MistHUD.");
        return null;
    }

    const theme = this.actor.items.find(item => item.type === 'theme' && item.id === themeId);

    if (!theme) {
        console.warn(`No theme found with ID: ${themeId}`);
        return "No mystery defined.";
    }

    let realThemebook;
    const themebook = theme.themebook;

    if (themebook?.isThemeKit()) {
        realThemebook = themebook.themebook;
    } else {
        realThemebook = themebook;
    }

    if (!realThemebook) {
        console.warn(`No themebook found for theme: ${theme.name}`);
        return "No mystery defined.";
    }

    const category = realThemebook.system.subtype || "unknown";
    const system = game.settings.get("city-of-mist", "system");

    let prefixKey;

    switch (category) {
        case "Mythos":
            prefixKey = (system === "city-of-mist") ? "CityOfMist.terms.mystery" :
                        (system === "otherscape") ? "Otherscape.terms.ritual" :
                        null; // Important: handle unknown systems
            break;
        case "Logos":
        case "Self":
            prefixKey = "CityOfMist.terms.identity";
            break;
        case "Noise":
            prefixKey = "Otherscape.terms.itch";
            break;
        case "Mist":
            prefixKey = "CityOfMist.terms.directive";
            break;
        case "Extras":
            prefixKey = "CityOfMist.terms.extra";
            break;
        case "Crew":
            prefixKey = "CityOfMist.terms.crewTheme";
            break;
        case "Loadout":
            prefixKey = "Otherscape.terms.loadout";
            break;
        default:
          console.warn(`Unknown category: ${category}`);
          prefixKey = null; // Important: handle unknown categories
    }

    const prefix = prefixKey ? game.i18n.localize(prefixKey) : "Theme";
    const mysteryText = theme.system.mystery || "No mystery defined.";

    return `<span class="mystery-type ${category}">${prefix}:</span><span class="mystery-text">${mysteryText}</span>`;
  }  
  
  addTooltipListeners(html) {
    html.find('.mh-theme-icon').each((index, element) => {
        const themeId = $(element).data('theme-id');

        $(element).hover(
            (event) => {
                const mystery = this.getMysteryFromTheme(themeId);
                this.showTooltip(event, mystery);
            },
            () => this.hideTooltip()
        );
    });
  }

  showTooltip(event, mystery) {
    if (!mystery) {
        console.warn("No mystery found for tooltip.");
        return;
    }

    const tooltip = $(`<div class="mh-tooltip"></div>`);
    tooltip.html(mystery); // Ensure this renders HTML content
    $('body').append(tooltip); // Append tooltip to the body for higher z-index context

    tooltip.css({
        top: event.pageY + 10, // Position near the mouse cursor
        left: event.pageX + 10
    });

    this.currentTooltip = tooltip; // Store reference to remove later
  }

  hideTooltip() {
    if (this.currentTooltip) {
        this.currentTooltip.remove();
        this.currentTooltip = null;
    }
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

  getJuiceAndClues() {
    const items = this.actor?.items || [];
    const characters = game.actors; // Access all actors in the world.

    // Fetch character details based on ID
    const resolveCharacter = (charId) => {
        const char = characters.get(charId);
        if (!char) return null;
        return {
            name: char.name,
            tokenImage:
                char.token?.texture.src ||
                char.prototypeToken?.texture.src ||
                char.img,
            id: char.id
        };
    };

    // Fetch active bonuses from actor flags
    const activeBonuses = this.actor.getFlag('mist-hud', 'active-bonuses') || {};

    // Help items with resolved character info and active status
    const helpItems = items
        .filter(item => item.type === "juice" && item.system.subtype === "help")
        .map(item => {
            const target = resolveCharacter(item.system.targetCharacterId);
            if (!target) return null;

            const active = activeBonuses.help?.[target.id] || false;

            return {
                amount: item.system.amount,
                target,
                active,
            };
        })
        .filter(item => item !== null); // Filter out invalid targets

    // Hurt items with resolved character info and active status
    const hurtItems = items
        .filter(item => item.type === "juice" && item.system.subtype === "hurt")
        .map(item => {
            const target = resolveCharacter(item.system.targetCharacterId);
            if (!target) return null;

            const active = activeBonuses.hurt?.[target.id] || false;

            return {
                amount: item.system.amount,
                target,
                active,
            };
        })
        .filter(item => item !== null); // Filter out invalid targets

    // Clue items
    const clueItems = items
    .filter(item => item.type === "clue" && item.system)
    .map(item => ({
        id: item.id, // Include the clue's unique ID
        actorId: this.actor.id, // Include the actor's ID for context
        name: item.name || "Unnamed Clue",
        amount: item.system.amount || 0,
        partial: item.system.partial || false,
        source: item.system.source || "Unknown",
        method: item.system.method || "Unknown",
    }));

    // Juice items
    const juiceItems = items
    .filter(item =>
        item.type === "juice" &&
        item.system &&
        (!item.system.subtype || !["help", "hurt"].includes(item.system.subtype)) // Exclude help and hurt subtypes
    )
    .map(item => ({
        id: item.id,
        actorId: this.actor.id,
        name: item.name || "Unnamed Juice",
        amount: item.system.amount || 0,
        source: item.system.source || "Unknown",
        method: item.system.method || "Unknown",
    }));


    return {
        helpItems,
        hurtItems,
        clueItems,
        juiceItems,
    };
  }
  
  getPowerTags(themeId, tagItems, subTagsByParent, actor) {
    const powerTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === "power");

    return this.formatTagsHierarchy(powerTags, subTagsByParent).map(tag => {
        const tagData = this.applyBurnState(actor, tag.id); // Pass the correct actor
        return {
            ...tagData,
            tagName: tag.name || tagData.tagName || `Unnamed Power Tag`,
        };
    });
  }

  getWeaknessTags(themeId, tagItems, subTagsByParent, actor) {
      const weaknessTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === "weakness");

      return this.formatTagsHierarchy(weaknessTags, subTagsByParent).map(tag => {
          const tagData = this.applyBurnState(actor, tag.id, "weakness"); // Pass the correct actor
          return {
              ...tagData,
              tagName: tag.name || tagData.tagName || `Unnamed Weakness Tag`,
          };
      });
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
            processedTag.isInverted = tag.system.inverted || false;
            processedTag.inversionIcon = processedTag.isInverted 
                ? '<i class="fa-light fa-angles-up"></i>' 
                : '<i class="fa-light fa-angles-down"></i>';

            // Check if the tag is temporary and add the temporary property
            // processedTag.temporary = tag.system.temporary || false;

            return processedTag;
        }).filter(Boolean); // Remove any null or invalid entries

    return storyTags;
  }
 
  getLoadoutTags() {
    if (!this.actor) return [];

    return this.actor.items.filter(item =>
        item.type === 'tag' &&
        item.system.subtype === 'loadout' &&
        item.system.activated_loadout === true
    ).map(tag => {
        const burnData = this.applyBurnState(this.actor, tag.id);

        return {
            id: tag.id,
            tagName: tag.name,
            burnState: burnData.burnState,
            cssClass: burnData.cssClass,
            burnIcon: burnData.burnIcon,
            permanent: burnData.permanent,
            temporary: burnData.temporary,
            isInverted: burnData.isInverted, // For consistency, though likely not used for loadout tags
            activatedLoadout: tag.system.activated_loadout,
        };
    });
  }

  getEssence(themes) {
    // Initialize counters for each category
    const categoryCounts = {
      Self: 0,
      Noise: 0,
      Logos: 0,
      Mythos: 0,
      Mist: 0,
    };
  
    for (const theme of themes) {
      // Retrieve the themebook associated with the theme
      let realThemebook;
      const themebook = theme.themebook;
  
      if (themebook?.isThemeKit()) {
        realThemebook = themebook.themebook;
      } else {
        realThemebook = themebook;
      }
  
      if (!realThemebook) {
        console.warn(`No themebook found for theme: ${theme.name}`);
        continue;
      }
  
      // Determine the category of the themebook
      const category = realThemebook.system.subtype;
  
      if (category && categoryCounts.hasOwnProperty(category)) {
        categoryCounts[category]++;
      } else {
        console.warn(`Unknown or missing category for theme: ${theme.name}`);
      }
    }
  
    const { Self, Noise, Mythos } = categoryCounts;
  
    // Generate the image file name
    const totalCount = Self + Noise + Mythos;
    let imageName = "blank.svg"; // Default image for undefined
  
    if (totalCount === 4) {
      const segments = [];
      if (Self > 0) segments.push(`${Self}S`);
      if (Mythos > 0) segments.push(`${Mythos}M`);
      if (Noise > 0) segments.push(`${Noise}N`);
      imageName = segments.join("") + ".svg";
    } else if (categoryCounts.Logos > 0 || categoryCounts.Mist > 0 || categoryCounts.Mythos > 0) {
      imageName = "com.webp"; // City of Mist characters
    }
  
    // Determine the essence and its class
    let essenceData = { essence: "Undefined", className: "undefined", imageName };
  
    if (Self > 0 && Noise > 0 && Mythos > 0) {
      essenceData = { essence: "Nexus", className: "nexus", imageName };
    } else if (Self > 0 && Mythos > 0 && Noise === 0) {
      essenceData = { essence: "Spiritualist", className: "spiritualist", imageName };
    } else if (Self > 0 && Noise > 0 && Mythos === 0) {
      essenceData = { essence: "Cyborg", className: "cyborg", imageName };
    } else if (Mythos > 0 && Noise > 0 && Self === 0) {
      essenceData = { essence: "Transhuman", className: "transhuman", imageName };
    } else if (Self > 0 && Noise === 0 && Mythos === 0) {
      essenceData = { essence: "Real", className: "real", imageName };
    } else if (Mythos > 0 && Self === 0 && Noise === 0) {
      essenceData = { essence: "Avatar/Conduit", className: "avatar-conduit", imageName };
    } else if (Noise > 0 && Self === 0 && Mythos === 0) {
      essenceData = { essence: "Singularity", className: "singularity", imageName };
    }
  
    return essenceData;
  }

  static getIcon(state, type) {
    if (type === 'burn') {
        // Return an empty span with a dynamic class for styling
        // return `<span class="mh-burn-toggle burn-icon ${state}"></span>`;
        return state; // Only return the state string for dynamic class usage      
    } else if (type === 'weakness') {
        // Weakness icons remain as FontAwesome
        return state
            ? '<i class="fa-regular fa-angles-up"></i>'
            : '<i class="fa-light fa-angles-down"></i>';
    }
  }

  applyBurnState(actor, tagId, tagType = "power") {
    const tagItem = actor?.items?.get(tagId);

    if (!tagItem || !tagItem.system) {
        console.warn(`Invalid or missing tag item for ID: ${tagId}`);
        return {
            id: tagId,
            tagName: `Unknown ${tagType} Tag`,
            burnState: "unburned",
            cssClass: "unburned",
            burnIcon: this.constructor.getIcon("unburned", "burn"),
            permanent: false,
            temporary: false,
            crispy: false,
            isInverted: false,
            inversionIcon: this.constructor.getIcon(false, "weakness"),
        };
    }

    const burnState = tagItem.system.burned
        ? "burned"
        : tagItem.system.burn_state === 1
        ? "toBurn"
        : "unburned";

    return {
        id: tagId,
        tagName: tagItem.name || `Unnamed ${tagType} Tag`, // Ensure tag name is passed
        burnState,
        cssClass: burnState,
        burnIcon: this.constructor.getIcon(burnState, "burn"),
        permanent: tagItem.system.permanent || false,
        temporary: tagItem.system.temporary || false,
        crispy: tagItem.system.crispy || false,
        isInverted: tagItem.system.isInverted || false,
        inversionIcon: this.constructor.getIcon(tagItem.system.isInverted, "weakness"),
    };
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

  getActorStatuses() {
    if (!this.actor) return [];

    const actorId = this.actor.id;
  
    return this.actor.items
      .filter(item => item.type === 'status')
      .map(status => ({
        actorId,
        id: status.id,
        name: status.name,
        tier: status.system.tier,
        temporary: !!status.system.temporary,
        permanent: !!status.system.permanent
      }));
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
    html.find('.mh-collapse-button').click(() => {
      this.isCollapsed = !this.isCollapsed;

    // Save the collapsed state in actor flags
    if (this.actor) {
      this.actor.setFlag('mist-hud', 'isCollapsed', this.isCollapsed);
    }

      this.render(true);
    });

    html.find('.mh-close-button').click(() => {
      this.close();
    });
  }
  
  getSelectedRollData() {
    console.log("getSelectedRollData called."); // Debug log

    // Fetch selected power tags
    const powerTags = this.element.find('.mh-power-tag.selected').map((i, el) => ({
        tagName: $(el).text().trim(),
        id: $(el).data('id'),
        stateClass: $(el).find('.mh-burn-toggle').hasClass('toBurn') ? "to-burn" :
                    $(el).find('.mh-burn-toggle').hasClass('burned') ? "burned" : "selected"
    })).get();

    // Fetch selected weakness tags
    const weaknessTags = this.element.find('.mh-weakness-tag.selected').map((i, el) => ({
        tagName: $(el).text().trim(),
        id: $(el).data('id'),
        stateClass: $(el).hasClass('inverted') ? "inverted" : "normal"
    })).get();

    // Fetch selected story tags
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


    // Fetch selected loadout tags
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

    // Fetch selected character statuses
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
  
  
    // Modifier value
    const modifier = this.modifier || 0;

    // Retrieve scene tags
    const scnTags = getScnTags();

    // Fetch scene statuses
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

        // Update `.toBurn` tags to `.burned`
        const tagsToUpdate = this.element.find('.mh-power-tag.toBurn, .mh-weakness-tag.toBurn, .mh-story-tag.toBurn, .mh-loadout-tag.toBurn');
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

            $tag.removeClass('toBurn').addClass('burned');
            $tag.find('.mh-burn-toggle').removeClass('toBurn').addClass('burned');
        }

        // Delete temporary statuses
        const statusesToDelete = this.element.find('.mh-status.selected[data-temporary="true"]');
        for (const element of statusesToDelete) {
            const $status = $(element);
            const statusId = $status.data('status-id');
            if (statusId) {
                console.log(`Deleting temporary status: ${$status.data('status-name')}`);
                await this.actor.deleteEmbeddedDocuments("Item", [statusId]);
            }
        }

        // Delete temporary tags used in the roll
        // DOESN'T WORK DONT KNOW WHY NEITHER DOES THE MACHINE
        // const tagsToDelete = this.element.find('.mh-story-tag.selected[data-temporary="true"]');
        // for (const element of tagsToDelete) {
        //     const $tag = $(element);
        //     const tagId = $tag.data('id');
        //     const tagName = $tag.data('tag-name') || "Unnamed Tag";

        //     if (tagId) {
        //         console.log(`Deleting temporary tag used in roll: ${tagName} (ID: ${tagId})`);
        //         await this.actor.deleteEmbeddedDocuments("Item", [tagId]);
        //     } else {
        //         console.error(`Failed to delete tag: Missing tag ID for ${tagName}`);
        //     }
        // }



        // Preserve `selected` and `statusType` for statuses
        const savedStates = this.actor.getFlag('mist-hud', 'status-states') || {};
        this.element.find('.mh-status').each((index, element) => {
            const statusElement = $(element);
            const statusId = statusElement.data('status-id');

            if (statusId && savedStates[statusId]) {
                const state = savedStates[statusId].state;
                statusElement
                    .removeClass('neutral positive negative selected')
                    .addClass(state);

                if (savedStates[statusId].selected) {
                    statusElement.addClass('selected');
                }
            }
        });

        this.modifier = 0;
        this.updateModifierDisplay();
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

// Ensure exports and references use the new name
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
