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

    // Get the category using getThemeCategory
    const category = getThemeCategory(theme.system.themebook_name.toLowerCase());

    // Determine the prefix based on the category
    let prefix = '';
    switch (category) {
        case 'mythos':
          prefix = '<span class="mystery-type mythos">Mystery:</span>';
            break;
        case 'logos':
          prefix = '<span class="mystery-type logos">Identity:</span>';
            break;
        case 'self':
            prefix = '<span class="mystery-type self">Identity:</span>';
            break;
        case 'mythosOS':
            prefix = '<span class="mystery-type mythosOS">Ritual:</span>';
            break;
        case 'noise':
            prefix = '<span class="mystery-type noise">Itch:</span>';
            break;
        default:
            console.warn(`Unknown theme category for theme: ${theme.system.themebook_name}`);
    }

    const mysteryText = theme.system.mystery || "No mystery defined.";
    return `${prefix} <span class="mystery-text">${mysteryText}</span>`;
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

    const tooltip = $(`<div class="mh-tooltip" style="position: absolute;"></div>`);
    tooltip.html(mystery); // Ensure this renders HTML content
    this.element.append(tooltip);

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
    html.find('.mh-burn-toggle').on('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
      
      const burnElement = $(event.currentTarget);
      const tagElement = burnElement.closest('.mh-power-tag, .mh-story-tag, .mh-loadout-tag');
      const tagId = tagElement.data('id');
  
      const currentState = burnElement.hasClass('burned') ? "burned" :
                           burnElement.hasClass('toBurn') ? "toBurn" : "unburned";
  
      // Determine new state
      const newState = currentState === "unburned" ? "toBurn" :
                       currentState === "toBurn" ? "burned" : "unburned";
  
      // Update the DOM classes for the icon and text
      burnElement.removeClass('unburned toBurn burned').addClass(newState);
      tagElement.removeClass('unburned toBurn burned').addClass(newState); // Also remove 'selected'
  
      // Update text state if necessary
      const newIcon = MistHUD.getIcon(newState, 'burn');
      burnElement.html(newIcon);
  
      if (newState === "burned") {
          // Deselect the tag visually
          tagElement.removeClass('selected');
          tagElement.find('.tag-text').addClass('burned-text'); // Add burned text class
      } else {
          tagElement.find('.tag-text').removeClass('burned-text'); // Remove burned text class if not burned
      }
  
      // Update the tag's state in the actor's data
      const tagItem = this.actor.items.get(tagId);
      if (tagItem) {
          const updatedState = newState === "burned";
          const burnState = newState === "toBurn" ? 1 : 0;
          await tagItem.update({ "system.burned": updatedState, "system.burn_state": burnState });
      }
  
      // Recalculate total power to reflect deselection
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

    this.element.on('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
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
    const sceneStatuses = getSceneStatuses();
    const scenePower = sceneStatuses.reduce((acc, status) => acc + (status.type === 'positive' ? status.tier : -status.tier), 0);
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

  getPowerTags(themeId, tagItems, subTagsByParent) {
    // Filter power tags for the given theme
    const powerTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === 'power');

    return this.formatTagsHierarchy(powerTags, subTagsByParent).map(tag => {
        const tagged = this.applyBurnState(this.actor, tag.id);
        return tagged;
    });
  }

  getWeaknessTags(themeId, tagItems, subTagsByParent) {
    // Filter weakness tags for the given theme
    const weaknessTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === 'weakness');

    return this.formatTagsHierarchy(weaknessTags, subTagsByParent).map(tag => {
        const tagged = this.applyBurnState(this.actor, tag.id, 'weakness');
        return tagged;
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
            return processedTag;
        }).filter(Boolean); // Remove any null or invalid entries

    return storyTags;
  }

  getThemesAndTags() {
    if (!this.actor) return {};

    const items = this.actor.items.contents;

    // Filter out __LOADOUT__ and properly categorize themes
    const themeItems = items.filter(item => item.type === 'theme' && item.name !== "__LOADOUT__");
    const tagItems = items.filter(item => item.type === 'tag');

    // Organize subtags under their respective parent tags
    const subTagsByParent = tagItems.reduce((acc, tag) => {
        if (tag.system.parentId) {
            if (!acc[tag.system.parentId]) acc[tag.system.parentId] = [];
            acc[tag.system.parentId].push(tag);
        }
        return acc;
    }, {});

    // Use the getStoryTags function to fetch and process story tags
    const storyTags = this.getStoryTags();

    // Process themes and their tags
    const themes = themeItems.map(theme => {
        const themebookName = theme.system.themebook_name || theme.name;
        const themeId = theme._id;
        const category = getThemeCategory(themebookName.toLowerCase());
        const iconClass = category ? `mh-theme-icon ${category}` : 'mh-theme-icon';


        // Use the getPowerTags and getWeaknessTags functions
        const powerTags = this.getPowerTags(themeId, tagItems, subTagsByParent);
        const weaknessTags = this.getWeaknessTags(themeId, tagItems, subTagsByParent);

        return {
            themebookName,
            id: themeId,
            localizedThemebookName: localizeTheme(themebookName),
            themeName: theme.name,
            iconClass,
            category,
            powerTags,
            weaknessTags,
        };
    });


    return {
        themes,
        storyTags,
    };
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

  getData(options) {
    const data = super.getData(options);
    if (!this.actor) return data;

    // Fetch the active system setting
    const activeSystem = game.settings.get("city-of-mist", "system");
  
    // Set actor-related data
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
    data.loadoutTags = this.getLoadoutTags();

    // Add the active system to the data context
    data.activeSystem = activeSystem;
    
    return data;
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
    const isInverted = tagItem.system.isInverted || false;

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

    const selectedStatuses = this.element.find('.mh-status.selected').map((i, el) => ({
        name: $(el).attr('data-status-name') || $(el).data('statusName'),
        tier: parseInt($(el).data('tier')),
        typeClass: $(el).hasClass('positive') ? "positive" : "negative",
        temporary: $(el).data('temporary') || false,
        permanent: $(el).data('permanent') || false
    })).get();

    const modifier = this.modifier || 0;

    // Retrieve scene tags from getScnTags
    const scnTags = getScnTags();

    const sceneStatuses = getSceneStatuses().filter(sceneStatus => sceneStatus.isSelected).map(sceneStatus => ({
      name: sceneStatus.name,
      tier: sceneStatus.tier,
      typeClass: sceneStatus.type === "positive" ? "scene-positive" : "scene-negative",
      temporary: sceneStatus.temporary,
      permanent: sceneStatus.permanent
    }));

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

    // return rollData;
  }
   
  async postRollCleanup(tagsData) {
    const actor = this.actor;
    if (!actor) return;
 
  
    // 1. Update "toBurn" power tags and story tags to "burned" on the actor's data
    for (const tag of [...tagsData.powerTags, ...tagsData.storyTags, ...tagsData.loadoutTags]) {
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

export const DENOMINATION = "6";

export class D6toD12 extends foundry.dice.terms.Die {
  constructor(termData) {
    super({ ...termData, faces: 12 });
  }

  static DENOMINATION = "6";
}

// Register the custom die term with Foundry VTT
CONFIG.Dice.terms["6"] = D6toD12;

// Initialization after Dice So Nice is ready
Hooks.once('diceSoNiceReady', (dice3d) => {
  // Auxiliary function to create systems
  const createSystem = (id, name, group) => {
      dice3d.addSystem({ id, name, group });
  };

  // Auxiliary function to create dice presets
  const createDicePreset = (options, type = "d6") => {
      dice3d.addDicePreset(options, type);
  };

  // Auxiliary function to create colorsets
  const createColorset = (colorset) => {
      dice3d.addColorset(colorset);
  };

  // Define systems
  const systems = [
      { id: "city-of-mist", name: "City of Mist", group: "City of Mist" },
      { id: "otherscape-mythos", name: "Otherscape Mythos", group: "Otherscape" },
      { id: "otherscape-noise", name: "Otherscape Noise", group: "Otherscape" },
      { id: "otherscape-self", name: "Otherscape Self", group: "Otherscape" },
  ];

  systems.forEach(system => createSystem(system.id, system.name, system.group));

  // Define presets
  const presets = [
      {
          system: "city-of-mist",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_logos_color.png',
              '/modules/mist-hud/ui/dice/dice_mythos_color.png', '5', '4', '3', '2', '1'],
          bumpMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_logos_bump.png',
              '/modules/mist-hud/ui/dice/dice_mythos_bump.png', , , , , ],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_logos_emissive.png',
              '/modules/mist-hud/ui/dice/dice_mythos_emissive.png', , , , , ],
          emissive: 0xdc39ff,
          emissiveIntensity: 0.25,
          colorset: "city-of-mist",
      },
      {
          system: "otherscape-mythos",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-mythos_color.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-mythos_color.png', '5', '4', '3', '2', '1'],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-mythos_emissive.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-mythos_emissive.png', , , , , ],
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          colorset: "otherscape-mythos",
      },
      {
          system: "otherscape-noise",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-noise_color.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-noise_color.png', '5', '4', '3', '2', '1'],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-noise_emissive.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-noise_emissive.png', , , , , ],
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          colorset: "otherscape-noise",
      },
      {
          system: "otherscape-self",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-self_color.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-self_color.png', '5', '4', '3', '2', '1'],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-self_emissive.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-self_emissive.png', , , , , ],
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          colorset: "otherscape-self",
      }
  ];

  presets.forEach(preset => createDicePreset(preset, "d12"));

  // Define colorsets
  const colorsets = [
      {
          name: "city-of-mist",
          description: "City of Mist Default",
          category: "City of Mist",
          foreground: ["#e6e6e6", "#e6e6e6"],
          background: ["#705e9e", "#8b4939"],
          outline: ["#433a28", "#433a28"],
          texture: "stone",
          material: "plastic",
          font: "Modesto Condensed",
          visibility: "visible",
      },
      {
          name: "otherscape-mythos",
          description: "Otherscape Mythos",
          category: "Otherscape",
          foreground: ["#e6e6e6"],
          background: ["#873fff"],
          outline: ["#7538ff"],
          texture: "fire",
          material: "metal",
          font: "Bruno Ace",
          visibility: "visible",
      },
      {
          name: "otherscape-noise",
          description: "Otherscape Noise",
          category: "Otherscape",
          foreground: ["#e6e6e6"],
          background: ["#195fed"],
          outline: ["#04c5f5"],
          texture: "fire",
          material: "metal",
          font: "Bruno Ace",
          visibility: "visible",
      },
      {
          name: "otherscape-self",
          description: "Otherscape Self",
          category: "Otherscape",
          foreground: ["#e6e6e6"],
          background: ["#e01054"],
          outline: ["#e0c2d8"],
          texture: "fire",
          material: "metal",
          font: "Bruno Ace",
          visibility: "visible",
      }
  ];

  colorsets.forEach(colorset => createColorset(colorset));
});
