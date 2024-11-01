// mist-hud.js

import { getThemeCategory } from './mh-theme-config.js';

// Import the draggable and position functions from mh-drag-pos.js
import { makeDraggable, getHUDPosition, setHUDPosition } from './mh-drag-pos.js';

// Helper function to localize themebook names using the system translation file
// function localizeTheme(themebookName) {
//   // Normalize themebook name: lowercase, trim, and replace special characters (including spaces) with underscores
//   const normalizedThemebookName = themebookName.toLowerCase().trim().replace(/\s+/g, "").replace(/[^\w]/g, "");

//   // Construct the correct localization key
//   const key = `CityOfMist.themebook.${normalizedThemebookName}.name`;

//   // Fetch the localized string based on the active language
//   const localizedString = game.i18n.localize(key);

//   // If the localization fails, return a fallback value (the original themebook name)
//   if (localizedString === key) {
//     console.warn(`Localization key not found: ${key}`);
//     return themebookName;  // Fallback to the original themebook name
//   }

//   return localizedString;
// }


// Helper function to localize themebook CORRECTING TYPO ON THEME NAMES KEYS
function localizeTheme(themebookName) {
  // Normalize the themebook name to form the primary key
  const normalizedThemebookName = themebookName.toLowerCase().trim().replace(/\s+/g, "").replace(/[^\w]/g, "");

  // Construct the primary localization key
  const primaryKey = `CityOfMist.themebook.${normalizedThemebookName}.name`;

  // Alternative key if the system uses different spellings (e.g., "adaptation" vs. "adaption")
  const alternateKey = normalizedThemebookName === "adaptation" ? "CityOfMist.themebook.adaption.name" : null;

  // Attempt localization with the primary key
  let localizedString = game.i18n.localize(primaryKey);

  // If localization fails, use the alternative key or fallback to the original name
  if (localizedString === primaryKey && alternateKey) {
    localizedString = game.i18n.localize(alternateKey);
  }
  
  // If both keys fail, return the original themebook name as a fallback
  return localizedString === primaryKey || localizedString === alternateKey ? themebookName : localizedString;
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
      MistHUD.instance = new MistHUD();
    }
    return MistHUD.instance;
  }
  
  setActor(actor) {
    this.actor = actor;

    // Retrieve the collapsed state from actor flags
    this.isCollapsed = actor.getFlag('mist-hud', 'isCollapsed') || false;
    
    this.render(true);
  }

  addTooltipListeners(html) {
    // Attach hover listeners to each theme icon with a unique theme name
    html.find('.mh-theme-icon').each((index, element) => {
      const themebookName = $(element).data('themebook-name'); // Ensure this attribute is set
  
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
  
    const tooltip = $(`<div class="mh-tooltip" style="position: absolute;">${localizedThemeName}</div>`);
    this.element.append(tooltip);
  
    // Position tooltip near the icon
    tooltip.css({
      top: event.pageY - this.element.offset().top + 10,
      left: event.pageX - this.element.offset().left + 10,
    });
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
    html.find('.mh-burn-toggle').on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
      const burnElement = $(event.currentTarget);
      const tagElement = burnElement.closest('.mh-power-tag, .mh-story-tag');
      const tagId = tagElement.data('id');
  
      // Get the specific tag item from the actor
      const tagItem = this.actor.items.get(tagId);
      if (!tagItem) {
        console.error(`Could not find tag item with id ${tagId}`);
        return;
      }
  
      // Toggle burn state
      let updatedState;
      if (burnElement.hasClass('unburned')) {
        updatedState = { burned: false, burn_state: 1 }; // Switch to `toBurn`
        burnElement.removeClass('unburned').addClass('toBurn');
      } else if (burnElement.hasClass('toBurn')) {
        updatedState = { burned: true, burn_state: 0 }; // Switch to `burned`
        burnElement.removeClass('toBurn').addClass('burned');
        tagElement.addClass('burned');
      } else {
        updatedState = { burned: false, burn_state: 0 }; // Reset to `unburned`
        burnElement.removeClass('burned').addClass('unburned');
        tagElement.removeClass('burned');
      }
  
      // Update the tag's burned state in the actor's data
      await tagItem.update({ "system.burned": updatedState.burned, "system.burn_state": updatedState.burn_state });
  
      // Reapply the selection state if previously selected
      if (tagElement.hasClass('selected')) {
        tagElement.addClass('selected');
      }
      this.calculateTotalPower();
    });
  
    // Status selection cycle with .selected toggle
    html.find('.mh-status').on('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      const statusElement = $(event.currentTarget);
  
    // Cycle through status states: neutral -> negative -> positive -> neutral
    if (statusElement.hasClass('neutral')) {
      statusElement.removeClass('neutral').addClass('negative selected');
    } else if (statusElement.hasClass('negative')) {
      statusElement.removeClass('negative').addClass('positive selected');
    } else if (statusElement.hasClass('positive')) {
      statusElement.removeClass('positive').addClass('neutral').removeClass('selected');
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
    this.isCollapsed = false;
    MistHUD.instance = null;
    await super.close(options);
  }

  getThemesAndTags() {
    if (!this.actor) return {};
  
    const items = this.actor.items.contents;
    const themeItems = items.filter(item => item.type === 'theme' && item.name !== "__LOADOUT__");
    const tagItems = items.filter(item => item.type === 'tag');
  
    const subTagsByParent = tagItems.reduce((acc, tag) => {
      if (tag.system.parentId) {
        if (!acc[tag.system.parentId]) acc[tag.system.parentId] = [];
        acc[tag.system.parentId].push(tag);
      }
      return acc;
    }, {});
  
    const storyTags = this.formatTagsHierarchy(tagItems.filter(tag => tag.system.subtype === 'story'), subTagsByParent)
    .map(tag => {
      const tagData = this.applyBurnState(this.actor, tag.id, 'story');
      tagData.isInverted = tagData.isInverted !== undefined ? tagData.isInverted : false;
      tagData.temporary = tagData.temporary !== undefined ? tagData.temporary : false;  // Ensure temporary is defined
      tagData.permanent = tagData.permanent !== undefined ? tagData.permanent : false;  // Ensure permanent is defined
      return tagData;
    });  
  
    const themes = themeItems.map(theme => {
      const themebookName = theme.system.themebook_name || theme.name;
      const themeId = theme.id;
      const category = getThemeCategory(themebookName.toLowerCase());
  
      const tagsForTheme = tagItems.filter(tag => tag.system.theme_id === themeId && !tag.system.parentId);
  
      const powerTags = this.formatTagsHierarchy(tagsForTheme.filter(tag => tag.system.subtype === 'power'), subTagsByParent)
        .map(tag => this.applyBurnState(this.actor, tag.id));
  
      const weaknessTags = this.formatTagsHierarchy(tagsForTheme.filter(tag => tag.system.subtype === 'weakness'), subTagsByParent)
      .map(tag => {
        const tagData = this.applyBurnState(this.actor, tag.id, 'weakness'); // Pass 'weakness' as tagType
        tagData.isInverted = false;
        return tagData;
      });
  
      const loadoutTags = this.formatTagsHierarchy(tagsForTheme.filter(tag => tag.system.subtype === 'loadout'), subTagsByParent)
        .map(tag => this.applyBurnState(this.actor, tag.id));
  
      return {
        themebookName,
        localizedThemebookName: localizeTheme(themebookName),
        themeName: theme.name,
        iconClass: category ? `mh-theme-icon ${category}` : 'mh-theme-icon',
        category,
        powerTags,
        weaknessTags,
        loadoutTags,
      };
    });
  
    return {
      themes,
      storyTags,  // Ensure all properties are set before returning
    };
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
    
    // Retrieve themes and story tags separately
    const themesAndTags = this.getThemesAndTags();
    data.themes = themesAndTags.themes;
    data.storyTags = themesAndTags.storyTags;
    data.hasStoryTags = themesAndTags.storyTags && themesAndTags.storyTags.length > 0; // Check for story tags
    data.statuses = this.getActorStatuses();
    data.modifier = this.modifier;
  
    return data;
  }
  
    
  applyBurnState(actor, tagId, tagType) {
    const tagItem = actor.items.get(tagId);
    if (!tagItem || !tagItem.system) {
      console.error("Invalid tag item or missing system data in applyBurnState:", tagId);
      return {
        id: tagId,
        burnState: "unburned",
        cssClass: "unburned",
        burnIcon: '<i class="fa-light fa-fire"></i>',
        permanent: false,  // Default to false if undefined
        temporary: false,  // Default to false if undefined
        isInverted: false,
        inversionIcon: tagType === 'story'
          ? '<i class="fa-regular fa-angles-up"></i>'  // Default for story tags
          : '<i class="fa-light fa-angles-down"></i>', // Default for weakness tags
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
  
    const permanent = tagItem.system.permanent !== undefined ? tagItem.system.permanent : false;
    const temporary = tagItem.system.temporary !== undefined ? tagItem.system.temporary : false;
    const isInverted = tagItem.system.isInverted !== undefined ? tagItem.system.isInverted : false;
  
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

  getSelectedRollData() {
    const powerTags = this.element.find('.mh-power-tag.selected').map((i, el) => ({
      tagName: $(el).text().trim(),
      id: $(el).data('id'),
      stateClass: $(el).find('.mh-burn-toggle').hasClass('toBurn') ? "to-burn" :
                  $(el).find('.mh-burn-toggle').hasClass('burned') ? "burned" : ""
    })).get();
  
    const weaknessTags = this.element.find('.mh-weakness-tag.selected').map((i, el) => ({
      tagName: $(el).text().trim(),
      id: $(el).data('id'),
      stateClass: $(el).hasClass('inverted') ? "inverted" : "normal"
    })).get();
  
    const storyTags = this.element.find('.mh-story-tag.selected').map((i, el) => {
      const tagElement = $(el);
      const isInverted = tagElement.hasClass('inverted');
      const burnElement = tagElement.find('.mh-burn-toggle');
  
      // Determine the state class based on conditions
      let stateClass;
      if (burnElement.hasClass('burned')) {
        stateClass = "burned";  // Story tag already burned
      } else if (burnElement.hasClass('toBurn')) {
        stateClass = "to-burn";  // Story tag marked for burning
      } else {
        stateClass = isInverted ? "inverted" : "selected";  // Either inverted or simply selected
      }
  
      return {
        tagName: tagElement.text().trim(),
        id: tagElement.data('id'),
        stateClass
      };
    }).get();
  
    // Collect only selected statuses
    const selectedStatuses = [];
    this.element.find('.mh-status.selected').each((i, el) => {
      selectedStatuses.push({
        name: $(el).attr('data-status-name') || $(el).data('statusName'),
        tier: parseInt($(el).data('tier')),
        typeClass: $(el).hasClass('positive') ? "positive" : "negative",
        temporary: $(el).data('temporary') || false,
        permanent: $(el).data('permanent') || false
      });
    });
  
    // Include modifier only if non-zero
    const modifier = this.modifier || 0;
  
    const sceneTags = getSceneStatus().filter(sceneTag => sceneTag.isSelected).map(sceneTag => ({
      name: sceneTag.name,
      tier: sceneTag.tier,
      typeClass: sceneTag.type === "positive" ? "scene-positive" : "scene-negative"
    }));
  
    return {
      powerTags,
      weaknessTags,
      storyTags,
      statuses: selectedStatuses,  // Only selected statuses
      sceneTags,
      modifier: modifier ? modifier : null  // Include modifier if not zero
    };
  }
    
  // async postRollCleanup(tagsData) {
  //   const actor = this.actor;
  //   if (!actor) return;

  //   // Update "toBurn" tags to "burned" on the actor's data
  //   for (const tag of [...tagsData.powerTags, ...tagsData.storyTags]) {
  //       if (tag.stateClass === "to-burn") {
  //           const tagItem = actor.items.get(tag.id);
  //           if (tagItem) {
  //               await tagItem.update({
  //                   "system.burned": true,
  //                   "system.burn_state": 0  // Set burn state to burned
  //               });
  //               console.log(`Updated tag "${tagItem.name}" to burned state.`);
  //           }
  //       }
  //   }

  //   // Reset UI elements
  //   this.resetHUD();
  // }

  async postRollCleanup(tagsData) {
    const actor = this.actor;
    if (!actor) return;
  
    // Log tagsData to verify structure and temporary flags
    console.log("tagsData:", tagsData);
  
    // 1. Update "toBurn" power tags and story tags to "burned" on the actor's data
    for (const tag of [...tagsData.powerTags, ...tagsData.storyTags]) {
      if (tag.stateClass === "to-burn") {
        const tagItem = actor.items.get(tag.id);
        if (tagItem) {
          await tagItem.update({
            "system.burned": true,
            "system.burn_state": 0  // Set burn state to burned
          });
        }
      }
    }
  
    // 2. Remove temporary statuses used in the roll
    for (const status of tagsData.statuses) {
      if (status.temporary) {
        const statusItem = actor.items.find(i => i.name === status.name && i.type === 'status');
        if (statusItem) {
          await statusItem.delete();
        }
      }
    }
  
    // 3. Directly filter and delete temporary story tags and power tags from actor's items
    const temporaryTags = actor.items.filter(item => 
      item.type === 'tag' && item.system.temporary && 
      (item.system.subtype === 'story' || item.system.subtype === 'power')
    );
  
    for (const tag of temporaryTags) {
      console.log(`Deleting temporary tag: ${tag.name}`);
      await tag.delete();
    }
  
    // 4. Reset HUD to clear selections, reset modifier, and refresh display
    this.resetHUD();
  }
     
  resetHUD() {
    // Deselect all selected tags: power, story, and weakness tags
    this.element.find('.mh-power-tag.selected, .mh-story-tag.selected, .mh-weakness-tag.selected').removeClass('selected');
  
    // Reset status classes (positive and negative) for all statuses back to neutral
    this.element.find('.mh-status.positive, .mh-status.negative').removeClass('positive negative').addClass('neutral');
  
    // Reset any burned or temporary states for story tags, if necessary
    this.element.find('.mh-story-tag').each((index, element) => {
      const $tag = $(element);
      $tag.removeClass('burned toBurn');  // Remove any burn state classes
      $tag.attr('data-temporary', false);  // Reset temporary attribute to false if used in HUD
    });
  
    // Reset modifier to 0 and update display
    this.modifier = 0;
    this.updateModifierDisplay();
  
    // Force HUD re-render to apply all changes immediately
    this.render(true);
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
    } else if (statusNameElement.hasClass('negative-selected')) {
      statusNameElement.removeClass('negative-selected');
    } else {
      statusNameElement.addClass('positive-selected');
    }

    // Recalculate the total power after scene status changes
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

// Hook to control the HUD based on token selection
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
