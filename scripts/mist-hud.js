// mist-hud.js

import { getThemeCategory } from './mh-theme-config.js';

// Import the draggable and position functions from mh-drag-pos.js
import { makeDraggable, getHUDPosition, setHUDPosition } from './mh-drag-pos.js';

// Helper function to localize themebook names using the system translation file
function localizeTheme(themebookName) {
  // Normalize themebook name: lowercase, trim, and replace special characters (including spaces) with underscores
  const normalizedThemebookName = themebookName.toLowerCase().trim().replace(/\s+/g, "").replace(/[^\w]/g, "");

  // Construct the correct localization key
  const key = `CityOfMist.themebook.${normalizedThemebookName}.name`;

  // Fetch the localized string based on the active language
  const localizedString = game.i18n.localize(key);

  // If the localization fails, return a fallback value (the original themebook name)
  if (localizedString === key) {
    console.warn(`Localization key not found: ${key}`);
    return themebookName;  // Fallback to the original themebook name
  }

  return localizedString;
}

// Register Handlebars helper for localizeTheme
Handlebars.registerHelper('localizeTheme', function(themebookName) {
  return localizeTheme(themebookName);
});


export class MistHUD extends Application {
  static instance = null;

  constructor(options = {}) {
    super(options);
    this.actor = null;
    this.isCollapsed = false;
    this.modifier = 0;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'mist-hud',
      template: 'modules/mist-hud/templates/mh-hud.hbs',
      classes: ['mh-hud'],
      resizable: false,
      popOut: false, // Keep popOut false to embed in main document
      minimizable: false,
      width: 310,
      height: 'auto',
    });
  }

  static getInstance() {
    if (!MistHUD.instance) {
      console.warn('Creating new MistHUD instance');
      MistHUD.instance = new MistHUD();
    } else {
      console.warn('Using existing MistHUD instance');
    }
    return MistHUD.instance;
  }
  
  setActor(actor) {
    this.actor = actor;

    // Retrieve the collapsed state from actor flags
    this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') || false;
    
    this.render(true);
  }

  getData(options) {
    const data = super.getData(options);
    if (!this.actor) return data;

    data.charName = this.actor.name;
    data.tokenImage =
      this.actor.token?.texture.src ||
      this.actor.prototypeToken.texture.src ||
      this.actor.img;
    data.isCollapsed = this.isCollapsed;
    data.themes = this.getThemesAndTags();
    data.statuses = this.getActorStatuses();
    data.modifier = this.modifier;
    return data;
  }

  addTooltipListeners(html) {
    // Attach hover listeners to each theme icon with a unique theme name
    html.find('.mh-theme-icon').each((index, element) => {
      const themebookName = $(element).data('themebook-name'); // Ensure this attribute is set
      console.log(`Themebook name for icon ${index}:`, themebookName); // Debug log
  
      $(element).hover(
        (event) => this.showTooltip(event, themebookName),
        () => this.hideTooltip()
      );
    });
  }
  
  showTooltip(event, themebookName) {
    if (!themebookName) {
      console.warn("No themebook name found for tooltip.");
      return;
    }
  
    const localizedThemeName = localizeTheme(themebookName) || "Unknown Theme";
    console.log(`Showing tooltip with text: ${localizedThemeName}`); // Debug log
  
    const tooltip = $(`<div class="mh-tooltip" style="position: absolute;">${localizedThemeName}</div>`);
    this.element.append(tooltip);
  
    // Position tooltip near the icon
    tooltip.css({
      top: event.pageY - this.element.offset().top + 10,
      left: event.pageX - this.element.offset().left + 10,
    });
    console.log("Tooltip position set."); // Debug log
  }
  
  hideTooltip() {
    this.element.find('.mh-tooltip').remove();
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    this.addHUDListeners(html);
    this.addModifierListeners(html);
    this.addTooltipListeners(html);

    const hudElement = html[0];
    const dragHandles = [
        hudElement.querySelector('.mh-hud-header'),
        hudElement.querySelector('.mh-token-image'),
    ];

    dragHandles.forEach((dragHandle) => {
        if (dragHandle) {
            makeDraggable(hudElement, dragHandle, this.actor?.id);
        }
    });

    // Power tag selection
    html.find('.mh-power-tag').on('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        const tagElement = $(event.currentTarget);

        // Prevent selection if burned
        if (tagElement.hasClass('burned')) {
            console.log('Cannot select a burned power tag.');
            return;
        }

        // Toggle selection state
        tagElement.toggleClass('selected');
        console.log(`Power Tag ${tagElement.data('id')} ${tagElement.hasClass('selected') ? 'selected' : 'deselected'}`);
        this.calculateTotalPower();
    });

    // Burn icon toggle with `unburned -> toBurn -> burned -> unburned` cycle
    html.find('.mh-burn-toggle').on('click', async (event) => {
        event.stopPropagation();
        event.preventDefault();
        const burnElement = $(event.currentTarget);
        const tagElement = burnElement.closest('.mh-power-tag');  // Get the tag element
        const tagId = tagElement.data('id');

        const tagItem = this.actor.items.get(tagId);
        if (!tagItem) {
            console.error(`Could not find tag item with id ${tagId}`);
            return;
        }

        // Remember the current selection state of the tag
        const isSelected = tagElement.hasClass('selected');

        // Toggle burn state through the sequence
        let updatedState;
        if (burnElement.hasClass('unburned')) {
            updatedState = { burned: false, burn_state: 1 };  // Switch to `toBurn`
            burnElement.removeClass('unburned').addClass('toBurn');
        } else if (burnElement.hasClass('toBurn')) {
            updatedState = { burned: true, burn_state: 0 };   // Switch to `burned`
            burnElement.removeClass('toBurn').addClass('burned');
            tagElement.addClass('burned');  // Visually mark the tag as burned
        } else {
            updatedState = { burned: false, burn_state: 0 };  // Reset to `unburned`
            burnElement.removeClass('burned').addClass('unburned');
            tagElement.removeClass('burned');  // Remove burned state from the tag
        }

        // Update the tag state in the actor data
        await tagItem.update({ "system.burned": updatedState.burned, "system.burn_state": updatedState.burn_state });
        console.log(`Updated burn state for ${tagItem.name}:`, updatedState);

        // Reapply the previous selection state without re-rendering
        if (isSelected) {
            tagElement.addClass('selected');
        }

        // Manually recalculate total power and update any necessary UI elements
        this.calculateTotalPower();
    });

    // Weakness tag selection
    html.find('.mh-weakness-tag').on('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        const tagElement = $(event.currentTarget);
        tagElement.toggleClass('selected');
        console.log(`Weakness Tag ${tagElement.data('id')} ${tagElement.hasClass('selected') ? 'selected' : 'deselected'}`);
        this.calculateTotalPower();
    });

    // Weakness tag inversion toggle
    html.find('.mh-weakness-toggle').on('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        const weaknessElement = $(event.currentTarget);
        const tagElement = weaknessElement.closest('.mh-weakness-tag');

        // Toggle inverted state
        weaknessElement.toggleClass('inverted').toggleClass('default');
        tagElement.toggleClass('inverted');
        console.log(`Weakness Tag ${tagElement.data('id')} inverted: ${tagElement.hasClass('inverted')}`);
        this.calculateTotalPower();
    });

    // Status selection cycle with .selected toggle
    html.find('.mh-status').on('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        const statusElement = $(event.currentTarget);

        // Cycle through status states: neutral -> negative -> positive -> neutral
        if (statusElement.hasClass('neutral')) {
            console.log('Changing status from neutral to negative');
            statusElement.removeClass('neutral').addClass('negative selected'); // Add .selected
        } else if (statusElement.hasClass('negative')) {
            console.log('Changing status from negative to positive');
            statusElement.removeClass('negative').addClass('positive'); // Retain .selected
        } else if (statusElement.hasClass('positive')) {
            console.log('Changing status from positive to neutral');
            statusElement.removeClass('positive selected').addClass('neutral'); // Remove .selected
        }

        this.calculateTotalPower();
    });
  }

  calculateTotalPower() {
    let totalPower = 0;

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

    // Calculate weakness tags
    $('.mh-weakness-tag.selected').each((index, element) => {
      const tagElement = $(element);
      if (tagElement.hasClass('inverted')) {
        totalPower += 1;  // Inverted weakness tag adds +1
      } else {
        totalPower -= 1;  // Normal weakness tag adds -1
      }
    });

    // Calculate status values from the character
    $('.mh-status.positive').each((index, element) => {
      const statusElement = $(element);
      const tier = parseInt(statusElement.data('tier')) || 0;
      totalPower += tier;  // Positive status adds its tier value
    });

    $('.mh-status.negative').each((index, element) => {
      const statusElement = $(element);
      const tier = parseInt(statusElement.data('tier')) || 0;
      totalPower -= tier;  // Negative status subtracts its tier value
    });

    // Add modifier to total power
    totalPower += this.modifier || 0;  // Modifier can be positive or negative

    // Correctly process scene statuses
    const sceneTags = getSceneStatus();
    const scenePower = sceneTags.reduce((acc, tag) => acc + (tag.type === 'positive' ? tag.tier : -tag.tier), 0);
    totalPower += scenePower;

    // Log the total power value
    console.log(`Total Power (including scene status): ${totalPower}`);

    return totalPower;
  }
  
  async _render(force = false, options = {}) {
    if (!this.actor) return;

    await super._render(force, options);

    const position = await getHUDPosition(this.actor.id);
    this.setPosition({
      left: parseInt(position.left) || 100,
      top: parseInt(position.top) || 100,
    });
  }

  async close(options = {}) {
    console.log('Closing MistHUD');
    this.isCollapsed = false;
    MistHUD.instance = null;
    await super.close(options);
  }

  getThemesAndTags() {
    if (!this.actor) return [];
  
    const items = this.actor.items.contents;
  
    // Filter out the "__LOADOUT__" theme
    const themeItems = items.filter((item) => item.type === 'theme' && item.name !== "__LOADOUT__");
    const tagItems = items.filter((item) => item.type === 'tag');
    const statusItems = items.filter((item) => item.type === 'status');
  
    // Separate parent tags and subtags based on parentId
    const subTagsByParent = tagItems.reduce((acc, tag) => {
      if (tag.system.parentId) {
        if (!acc[tag.system.parentId]) acc[tag.system.parentId] = [];
        acc[tag.system.parentId].push(tag);
      }
      return acc;
    }, {});
  
    return themeItems.map((theme) => {
      const themebookName = theme.system.themebook_name || theme.name;
      const localizedThemebookName = localizeTheme(themebookName);  // Localized version
  
      const themeId = theme.id;
      const category = getThemeCategory(themebookName.toLowerCase());
  
      // Get tags for this theme
      const tagsForTheme = tagItems.filter((tag) => tag.system.theme_id === themeId && !tag.system.parentId);
  
      const powerTags = this.formatTagsHierarchy(
        tagsForTheme.filter((tag) => tag.system.subtype === 'power'),
        subTagsByParent
      ).map((tag) => this.applyBurnState(this.actor, tag.id));  // Apply burn state using actor data
  
      const weaknessTags = this.formatTagsHierarchy(
        tagsForTheme.filter((tag) => tag.system.subtype === 'weakness'),
        subTagsByParent
      );
  
      const loadoutTags = this.formatTagsHierarchy(
        tagsForTheme.filter((tag) => tag.system.subtype === 'loadout'),
        subTagsByParent
      ).map((tag) => this.applyBurnState(this.actor, tag.id));
  
      const statusTags = statusItems.map((status) => ({
        id: status.id,
        name: status.name,
        statusType: status.system.specialType || 'neutral',
      }));
  
      return {
        themebookName,                // Original themebook name
        localizedThemebookName,       // Localized themebook name
        themeName: theme.name,        // Original theme name
        iconClass: category ? `mh-theme-icon ${category}` : 'mh-theme-icon',
        category,
        powerTags,
        weaknessTags,
        loadoutTags,
        statusTags,
      };
    });
  }
  
  applyBurnState(actor, tagId) {
    const tagItem = actor.items.get(tagId);
    if (!tagItem || !tagItem.system) {
        console.error("Invalid tag item or missing system data in applyBurnState:", tagId);
        return { id: tagId, burnState: "unburned", cssClass: "unburned", burnIcon: MistHUD.getIcon("unburned", 'burn') };
    }

    // Determine burn state based on `burned` and `burn_state`
    let burnState;
    if (tagItem.system.burned) {
        burnState = "burned";
    } else if (tagItem.system.burn_state === 1) {
        burnState = "toBurn";
    } else {
        burnState = "unburned";
    }

    // Assign CSS class based on burn state
    const cssClass = burnState;

    // console.log(`Tag: ${tagItem.name}, Raw Burned State: ${tagItem.system.burned}, Burn State: ${tagItem.system.burn_state}, Interpreted State: ${burnState}`);

    return {
        id: tagId,
        tagName: tagItem.name,
        burnState,
        cssClass,
        burnIcon: MistHUD.getIcon(burnState, 'burn')
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
              subtagData.isSubtag = true;  // Mark it as a subtag
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
  
  static getIcon(state, type) {
    if (type === 'burn') {
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
    } else if (type === 'weakness') {
        return state
            ? '<i class="fa-regular fa-angles-up"></i>'
            : '<i class="fa-light fa-angles-down"></i>';
    }
  }

  getActorStatuses() {
    if (!this.actor) return [];
  
    const statusMap = new Map();
  
    this.actor.items
      .filter((item) => item.type === 'status')
      .forEach((status) => {
        const key = `${status.name}-${status.system.tier}`; // Unique key by name and tier
  
        // Log the key and status being processed
        console.log(`Processing status: ${status.name}, Tier: ${status.system.tier}, Key: ${key}`);
  
        // Add status to map only if unique by name and tier
        if (!statusMap.has(key)) {
          statusMap.set(key, {
            statusName: status.name,
            statusTier: status.system.tier,
            statusType: status.system.specialType || 'neutral',
            temporary: !!status.system.temporary,  // Force boolean value
            permanent: !!status.system.permanent   // Force boolean value
          });
        } else {
          console.warn(`Duplicate status detected for key: ${key}`);
        }
      });
  
    const statuses = Array.from(statusMap.values());
    console.log("Unique Character Statuses from getActorStatuses:", statuses);
    return statuses;
  }
  
  updateModifierDisplay() {
    const modValueEl = this.element.find('#mh-mod-value');
    if (modValueEl.length) {
      modValueEl.val(this.modifier);
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

  exportRollData(totalPower) {
    // Define behavior to export data, perhaps to the UI or console
    console.log(`Exporting roll data with Total Power: ${totalPower}`);
  }

  getSelectedRollData() {
    // Collect selected power tags
    const powerTags = this.element.find('.mh-power-tag.selected').map((i, el) => ({
      tagName: $(el).text().trim(),
      id: $(el).data('id'),
      stateClass: $(el).find('.mh-burn-toggle').hasClass('toBurn')
                 ? "to-burn" 
                 : $(el).find('.mh-burn-toggle').hasClass('burned') ? "burned" : ""
    })).get();
    console.log("Selected Power Tags:", powerTags);
  
    // Collect selected weakness tags
    const weaknessTags = this.element.find('.mh-weakness-tag.selected').map((i, el) => ({
      tagName: $(el).text().trim(),
      id: $(el).data('id'),
      stateClass: $(el).hasClass('inverted') ? "inverted" : "normal"
    })).get();
    console.log("Selected Weakness Tags:", weaknessTags);
  
    // Collect only unique character statuses by name and tier
    const statusMap = new Map();
    this.element.find('.mh-status.selected').each((i, el) => {
      const name = $(el).attr('data-status-name') || $(el).data('statusName');
      const tier = parseInt($(el).data('tier'));
      const key = `${name}-${tier}`;  // Unique key for each status by name and tier
  
      // Log each status as it’s processed
      console.log(`Processing Status: ${name}, Tier: ${tier}, Key: ${key}`);
      
      if (!statusMap.has(key)) {
        statusMap.set(key, {
          name,
          tier,
          typeClass: $(el).hasClass('positive') ? "positive" : "negative",
          temporary: $(el).data('temporary') || false,
          permanent: $(el).data('permanent') || false
        });
      } else {
        console.warn(`Duplicate status detected for key: ${key}`);
      }
    });
    const statuses = Array.from(statusMap.values());
    console.log("Unique Character Statuses:", statuses);
  
    // Collect only selected scene tags
    const sceneTags = getSceneStatus().filter(sceneTag => sceneTag.isSelected).map(sceneTag => ({
      name: sceneTag.name,
      tier: sceneTag.tier,
      typeClass: sceneTag.type === "positive" ? "scene-positive" : "scene-negative"
    }));
    console.log("Selected Scene Tags:", sceneTags);
  
    // Final log before returning data
    console.log("Final Selected Roll Data:", {
      powerTags,
      weaknessTags,
      statuses,   // Only unique character statuses
      sceneTags   // Only scene tags
    });
  
    return {
      powerTags,
      weaknessTags,
      statuses,    // Only unique character statuses
      sceneTags,   // Only selected scene tags
      modifier: this.modifier
    };
  }
  
  async postRollCleanup(tagsData) {
    const actor = this.actor;
    if (!actor) return;

    // 1. Update "toBurn" tags to "burned" on the actor's data
    for (const tag of tagsData.powerTags) {
        if (tag.stateClass === "to-burn") {
            const tagItem = actor.items.get(tag.id);
            if (tagItem) {
                await tagItem.update({
                    "system.burned": true,
                    "system.burn_state": 0  // Set burn state to burned
                });
                console.log(`Updated tag "${tagItem.name}" to burned state.`);
            }
        }
    }

    // 2. Remove temporary statuses used in the roll
    for (const status of tagsData.statuses) {
        if (status.temporary) {
            const statusItem = actor.items.find(i => i.name === status.name && i.type === 'status');
            if (statusItem) {
                await statusItem.delete();
                console.log(`Removed temporary status "${status.name}" after roll.`);
            }
        }
    }

    // 3. Deselect all selected tags and statuses (excluding scene statuses)
    this.element.find('.mh-power-tag.selected').removeClass('selected');
    this.element.find('.mh-weakness-tag.selected').removeClass('selected');
    this.element.find('.mh-status.positive, .mh-status.negative').removeClass('positive negative').addClass('neutral');

    // 4. Reset modifier to 0 and update display
    this.modifier = 0;
    this.updateModifierDisplay();

    // Force HUD re-render to reflect changes
    await this.render(true);

    console.log("Temporary statuses removed, tags deselected, statuses reset, and modifier set to 0.");
  }

}

// Function to attach listeners for scene tags globally
function attachSceneTagListeners() {
  // Add listeners for scene status toggle inside .scene-tag-window
  $('.scene-tag-window').on('click', '.status-name', (event) => {
    event.stopPropagation();
    event.preventDefault();
    const statusNameElement = $(event.currentTarget);

    // Alert for testing purposes to verify click event is triggered
    alert('Status clicked: ' + statusNameElement.text().trim());

    // Toggle between positive-selected, negative-selected, and none
    if (statusNameElement.hasClass('positive-selected')) {
      statusNameElement.removeClass('positive-selected').addClass('negative-selected');
      console.log('Changing scene status from positive to negative');
    } else if (statusNameElement.hasClass('negative-selected')) {
      statusNameElement.removeClass('negative-selected');
      console.log('Changing scene status to neutral');
    } else {
      statusNameElement.addClass('positive-selected');
      console.log('Changing scene status to positive');
    }

    // Recalculate the total power after scene status changes
    console.log('Recalculating total power after scene tag change');
    calculateTotalPower();
  });
}

// Function to get scene status information and calculate its contribution to total power
function getSceneStatus() {
  const selectedStatuses = [];

  // Assuming each scene status has the classes `.status-line.status`
  $('.scene-tag-window .tag-or-status-list .status-line.status').each((index, element) => {
    const statusElement = $(element);
    const statusName = statusElement.data('status-name');
    const statusTier = parseInt(statusElement.data('tier')) || 0;

    // Check if the element has a positive or negative selection class
    if (statusElement.find('.status-name').hasClass('positive-selected')) {
      selectedStatuses.push({ name: statusName, tier: statusTier, type: 'positive', isSelected: true });
    } else if (statusElement.find('.status-name').hasClass('negative-selected')) {
      selectedStatuses.push({ name: statusName, tier: statusTier, type: 'negative', isSelected: true });
    }
  });

  return selectedStatuses; // Return only selected scene statuses
}

export { getSceneStatus };

// Hook to attach listeners after the Foundry VTT application is ready
Hooks.on('ready', () => {
  attachSceneTagListeners();
});

// Hooks and other code
Hooks.on('controlToken', (token, controlled) => {
  console.log(`controlToken hook fired. Controlled: ${controlled}`);
  if (controlled && token.actor && token.actor.type === 'character') {
    MistHUD.getInstance().setActor(token.actor);
  } else if (!controlled && MistHUD.instance) {
    MistHUD.getInstance().close();
  }
});


Hooks.on('updateActor', (actor, data, options, userId) => {
  if (MistHUD.instance && MistHUD.instance.actor?.id === actor.id) {
    MistHUD.getInstance().render(true);
  }
});
