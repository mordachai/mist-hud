// mist-hud.js

import { themesConfig } from './mh-theme-config.js';

// Helper function to localize themebook CORRECTING TYPO ON THEME NAMES KEYS

export function localizeTheme(themeId) {
  const theme = themesConfig[themeId];
  if (!theme) {
    console.warn(`Localization key not found for theme ID: ${themeId}`);
    return "Unknown Theme";
  }
  return game.i18n.localize(theme.localizationKey) || "Unknown Theme";
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
    this.isMinimized = true;
    this.modifier = 0;
  }

  async minimize() {
    console.log("Before calling super.minimize()"); // Debug
    const result = await super.minimize();
    console.log("After calling super.minimize(), HUD state:", this._state); // Debug
    console.log("HUD minimized class present?", this.element.hasClass("minimized")); // Debug
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
      width: 310,
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
   
  // Debug: Log the entire HUD HTML
  
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
  
  getMysteryFromTheme(themeId) {
    if (!this.actor) {
      console.warn("No actor set in MistHUD.");
      return null;
    }
  
    // Retrieve the theme item from the actor by ID
    const theme = this.actor.items.find(item => item.type === 'theme' && item.id === themeId);
  
    if (!theme) {
      console.warn(`No theme found with ID: ${themeId}`);
      return "No mystery defined.";
    }
  
    // Retrieve theme configuration from themesConfig using themebook ID
    const themeConfig = themesConfig[theme.system.themebook_id];
    if (!themeConfig) {
      console.warn(`Theme configuration not found for themebook ID: ${theme.system.themebook_id}`);
      return "No mystery defined.";
    }
  
    // Map of category to translation keys
    const translationKeys = {
      mythos: "CityOfMist.terms.mystery",
      logos: "CityOfMist.terms.identity",
      self: "CityOfMist.terms.identity",
      mythosOS: "Otherscape.terms.ritual",
      noise: "Otherscape.terms.itch",
      mist: "CityOfMist.terms.directive",
      extras: "CityOfMist.terms.extra",
      crew: "CityOfMist.terms.crewTheme",
      loadout: "Otherscape.terms.loadout"
    };
  
    // Get the localized prefix
    const prefixKey = translationKeys[themeConfig.category];
    const prefix = prefixKey ? game.i18n.localize(prefixKey) : "Theme";
  
    // Retrieve the mystery text from the theme
    const mysteryText = theme.system.mystery || "No mystery defined.";
  
    // Return the formatted HTML
    return `<span class="mystery-type ${themeConfig.category}">${prefix}:</span>
            <span class="mystery-text">${mysteryText}</span>`;
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
  
    // Process themes and their tags
    const themes = themeItems.map(theme => {
      const themeId = theme._id;
      const themeConfig = themesConfig[theme.system.themebook_id];
  
      // Skip if themeConfig is missing for this theme ID
      if (!themeConfig) {
        console.warn(`Theme configuration not found for theme ID: ${theme.system.themebook_id}`);
        return null;
      }
  
      const category = themeConfig.category;
      const localizedThemebookName = game.i18n.localize(themeConfig.localizationKey);
      const iconClass = `mh-theme-icon ${category}`;
  
      // Get power and weakness tags
      const powerTags = this.getPowerTags(themeId, tagItems, subTagsByParent);
      const weaknessTags = this.getWeaknessTags(themeId, tagItems, subTagsByParent);
  
      return {
        id: themeId,
        themeName: theme.name,
        localizedThemebookName,
        iconClass,
        category,
        powerTags,
        weaknessTags,
      };
    }).filter(Boolean); // Remove null entries from invalid themes
  
    // Process story tags
    const storyTags = this.getStoryTags();
  
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

  }

  // getSelectedRollData() {
  //   // Power Tags: name, toBurn (true/false), inverted (true/false)
  //   const powerTags = this.element.find('.mh-power-tag.selected').map((i, el) => ({
  //       name: $(el).text().trim(),
  //       toBurn: $(el).find('.mh-burn-toggle').hasClass('toBurn'),
  //       inverted: $(el).hasClass('inverted'),
  //   })).get();

  //   // Weakness Tags: name, inverted (true/false)
  //   const weaknessTags = this.element.find('.mh-weakness-tag.selected').map((i, el) => ({
  //       name: $(el).text().trim(),
  //       inverted: $(el).hasClass('inverted'),
  //   })).get();

  //   // Story Tags: name, toBurn (true/false), inverted (true/false)
  //   const storyTags = this.element.find('.mh-story-tag.selected').map((i, el) => ({
  //       name: $(el).text().trim(),
  //       toBurn: $(el).find('.mh-burn-toggle').hasClass('toBurn'),
  //       inverted: $(el).hasClass('inverted'),
  //   })).get();

  //   // Loadout Tags: name, toBurn (true/false), inverted (true/false)
  //   const loadoutTags = this.element.find('.mh-loadout-tag.selected').map((i, el) => ({
  //       name: $(el).text().trim(),
  //       toBurn: $(el).find('.mh-burn-toggle').hasClass('toBurn'),
  //       inverted: $(el).hasClass('inverted'),
  //   })).get();

  //   // Statuses: name, tier, positive/negative
  //   const statuses = this.element.find('.mh-status.selected').map((i, el) => ({
  //       name: $(el).attr('data-status-name') || $(el).data('statusName'),
  //       tier: parseInt($(el).data('tier')) || 0,
  //       type: $(el).hasClass('positive') ? 'positive' : 'negative',
  //   })).get();

  //   // Scene Tags: from `getScnTags`
  //   const scnTags = getScnTags();

  //   // Scene Statuses: from `getSceneStatuses`
  //   const sceneStatuses = getSceneStatuses().filter(status => status.isSelected).map(status => ({
  //       name: status.name,
  //       tier: status.tier,
  //       type: status.type === 'positive' ? 'scene-positive' : 'scene-negative',
  //       temporary: status.temporary,
  //       permanent: status.permanent,
  //   }));

  //   // Current modifier
  //   const modifier = this.modifier || 0;

  //   // Return all collected data
  //   return {
  //       powerTags,
  //       weaknessTags,
  //       storyTags,
  //       loadoutTags,
  //       statuses,
  //       scnTags,
  //       sceneStatuses,
  //       modifier: modifier ? modifier : null, // Null if no modifier
  //   };
  // }  

  async cleanHUD() {
    try {
      // Check if actor exists
      if (!this.actor) {
        console.warn("No actor set for MistHUD. Skipping actor updates.");
        return;
      }
  
      // Update `.toBurn` tags to `.burned` in the actor's data and DOM
      const tagsToUpdate = this.element.find('.mh-power-tag.toBurn, .mh-weakness-tag.toBurn, .mh-story-tag.toBurn, .mh-loadout-tag.toBurn');
      for (const element of tagsToUpdate) {
        const $tag = $(element);
        const tagId = $tag.data('id');
        const tagItem = this.actor.items.get(tagId);
  
        // Update actor's data for burned state
        if (tagItem) {
          await tagItem.update({
            "system.burned": true,
            "system.burn_state": 0 // Ensure the burn state is set to burned
          });
        }
  
        // Update the HUD element
        $tag.removeClass('toBurn').addClass('burned');
        $tag.find('.mh-burn-toggle').removeClass('toBurn').addClass('burned');
      }
  
      // Remove `.selected` from all elements
      //this.element.find('.selected').removeClass('selected');
  
      // Change `.mh-status.positive` and `.mh-status.negative` to `.mh-status.neutral`
      this.element.find('.mh-status.positive, .mh-status.negative').each((index, element) => {
        const $status = $(element);
        $status.removeClass('positive negative').addClass('neutral');
      });
  
      // Reset the modifier to 0 and update the display
      this.modifier = 0;
      this.updateModifierDisplay();
  
      // Delete any elements with the `.temporary` class
      this.element.find('.temporary').remove();
  
      await this.render(true); // Ensure HUD is re-rendered to reflect changes
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