// mh-getters.js

/**
 * Returns an icon HTML string for a given state and type.
 * Adjust the logic as needed.
 * @param {string|boolean} state - The state (for "burn", a string; for "weakness", a boolean)
 * @param {string} type - Either "burn" or "weakness"
 * @returns {string}
 */
export function getIcon(state, type) {
    if (type === 'burn') {
      // For example, if you want to simply return the state, or map it to a class, do so here.
      // This is a placeholder implementation:
      return `<span class="mh-burn-icon ${state}">${state}</span>`;
    } else if (type === 'weakness') {
      // Return a FontAwesome icon based on a boolean state
      return state
        ? '<i class="fa-regular fa-angles-up"></i>'
        : '<i class="fa-light fa-angles-down"></i>';
    }
    return "";
  }
  
  /**
   * Applies burn state logic to a given tag.
   * @param {Actor} actor - The actor containing the tag.
   * @param {string} tagId - The ID of the tag.
   * @param {string} [tagType="power"] - The type of the tag (e.g. "power" or "weakness").
   * @returns {Object} An object containing burn state information.
   */
  export function applyBurnState(actor, tagId, tagType = "power") {
    const tagItem = actor?.items.get(tagId);
    if (!tagItem || !tagItem.system) {
      console.warn(`Invalid or missing tag item for ID: ${tagId}`);
      return {
        id: tagId,
        tagName: `Unknown ${tagType} Tag`,
        burnState: "unburned",
        cssClass: "unburned",
        burnIcon: getIcon("unburned", "burn"),
        permanent: false,
        temporary: false,
        crispy: false,
        isInverted: false,
        inversionIcon: getIcon(false, "weakness"),
      };
    }
  
    const burnState = tagItem.system.burned
      ? "burned"
      : tagItem.system.burn_state === 1
        ? "toBurn"
        : "unburned";
  
    return {
      id: tagId,
      tagName: tagItem.name || `Unnamed ${tagType} Tag`,
      burnState,
      cssClass: burnState,
      burnIcon: getIcon(burnState, "burn"),
      permanent: tagItem.system.permanent || false,
      temporary: tagItem.system.temporary || false,
      crispy: tagItem.system.crispy || false,
      isInverted: tagItem.system.isInverted || false,
      inversionIcon: getIcon(tagItem.system.isInverted, "weakness"),
    };
  }  

/**
 * Get crew themes for a given actor.
 * @param {Actor} actor 
 * @returns {Array}
 */
export function getCrewThemes(actor) {
  if (!actor) return [];
  const nonGMOwners = game.users.filter(user =>
      !user.isGM && actor.testUserPermission(user, "OWNER")
  );
  const ownedCrews = game.actors.contents.filter(a =>
      a.type === "crew" &&
      nonGMOwners.some(user => a.testUserPermission(user, "OWNER"))
  );
  return ownedCrews.flatMap(crew => 
      crew.items.filter(item => item.type === "theme").map(theme => {
          const themeId = theme.id;
          const tagItems = crew.items.filter(item => item.type === "tag");
          const subTagsByParent = tagItems.reduce((acc, tag) => {
              if (tag.system.parentId) {
                  if (!acc[tag.system.parentId]) acc[tag.system.parentId] = [];
                  acc[tag.system.parentId].push(tag);
              }
              return acc;
          }, {});

          return {
              id: themeId,
              name: theme.name,
              crewName: crew.name,
              actorId: crew.id,
              powerTags: getPowerTags(themeId, tagItems, subTagsByParent, crew),
              weaknessTags: getWeaknessTags(themeId, tagItems, subTagsByParent, crew)
          };
      })
  );
}

  
  /**
   * Get the mystery string from a given theme.
   * @param {Actor} actor 
   * @param {string} themeId 
   * @returns {string}
   */
  export function getMysteryFromTheme(actor, themeId) {
    if (!actor) {
      console.warn("No actor provided in getMysteryFromTheme.");
      return "No mystery defined.";
    }
    const theme = actor.items.contents.find(item => item.type === 'theme' && item.id === themeId);
    if (!theme) {
      console.warn(`No theme found with ID: ${themeId}`);
      return "No mystery defined.";
    }
    let realThemebook;
    const themebook = theme.themebook;
    if (themebook?.isThemeKit && themebook.isThemeKit()) {
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
                    null;
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
      case "Extra":
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
        prefixKey = null;
    }
    const prefix = prefixKey ? game.i18n.localize(prefixKey) : "Theme";
    const mysteryText = theme.system.mystery || "No mystery defined.";
    return `<span class="mystery-type ${category}">${prefix}:</span><span class="mystery-text">${mysteryText}</span>`;
  }
  
  /**
   * Get themes and tags from an actor.
   * @param {Actor} actor 
   * @returns {Object}
   */
  export function getThemesAndTags(actor) {
    if (!actor) return {};
    const items = actor.items.contents;
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
      if (realThemebook?.isThemeKit && realThemebook.isThemeKit()) {
        realThemebook = realThemebook.themebook;
      }
      if (!realThemebook) {
        console.warn(`Themebook is missing for theme: ${theme.name}`);
        return null;
      }
      const themeType = realThemebook.system?.subtype || "default-icon";
      const powerTags = getPowerTags(themeId, tagItems, subTagsByParent, actor);
      const weaknessTags = getWeaknessTags(themeId, tagItems, subTagsByParent, actor);
      return {
        id: themeId,
        themeName: theme.name,
        category: themeType,
        iconClass: `mh-theme-icon ${themeType}`,
        powerTags,
        weaknessTags,
        localizedThemebookName: realThemebook.name,
        unspent_upgrades: theme.system.unspent_upgrades || 0,
      };
    }).filter(Boolean);
  
    // Process story tags
    const storyTags = tagItems.filter(tag => tag.system.subtype === 'story')
      .map(tag => {
        if (!tag || !tag._id || !tag.system) {
          console.error("Invalid tag item in getThemesAndTags:", tag);
          return null;
        }
        const processedTag = applyBurnState(actor, tag._id, 'story');
        processedTag.isInverted = tag.system.inverted || false;
        processedTag.inversionIcon = processedTag.isInverted 
          ? '<i class="fa-light fa-angles-up"></i>' 
          : '<i class="fa-light fa-angles-down"></i>';
        return processedTag;
      }).filter(Boolean);
  
    return {
      themes,
      storyTags,
      crewThemes: getCrewThemes(actor)
    };
  }
  
  /**
   * Get themebooks for an actor.
   * @param {Actor} actor 
   * @returns {Array}
   */
  export function getThemebooks(actor) {
    if (!actor || !actor.items) {
      console.error("Invalid actor provided to getThemebooks.");
      return [];
    }
    const items = actor.items.contents;
    const themes = items.filter(item => item.type === "theme" && item.name !== "__LOADOUT__");
    const tagItems = items.filter(item => item.type === "tag");
  
    return themes.map(theme => {
      let realThemebook;
      const themebook = theme.themebook;
      if (themebook?.isThemeKit && themebook.isThemeKit()) {
        realThemebook = themebook.themebook;
      } else {
        realThemebook = themebook;
      }
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
          locale_name: realThemebook.system?.locale_name?.replace(/^#/, "") || ""
        }
      };
    }).filter(Boolean);
  }
  
  /**
   * Get improvements grouped by theme.
   * @param {Actor} actor 
   * @returns {Array}
   */
  export function getImprovements(actor) {
    if (!actor) return [];
    const items = actor.items.contents;
    const themes = items.filter(item => item.type === "theme").reduce((acc, theme) => {
      let realThemebook = theme.themebook;
      if (realThemebook?.isThemeKit && realThemebook.isThemeKit()) {
        realThemebook = realThemebook.themebook;
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
    const improvementsGrouped = items.filter(item =>
      item.type === "improvement" && themes[item.system.theme_id]
    ).reduce((acc, item) => {
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
    return Object.values(improvementsGrouped);
  }
  
  /**
   * Get actor statuses.
   * @param {Actor} actor 
   * @returns {Array}
   */
  export function getActorStatuses(actor) {
    if (!actor) return [];
    const actorId = actor.id;
    return actor.items.contents
      .filter(item => item.type === 'status')
      .map(status => ({
        actorId,
        id: status.id,
        name: status.name,
        tier: status.system.tier,
        temporary: !!status.system.temporary,
        permanent: !!status.system.permanent,
      }));
  }
  
  /**
   * Get juice and clues.
   * @param {Actor} actor 
   * @returns {Object}
   */
  export function getJuiceAndClues(actor) {
    if (!actor) return { helpItems: [], hurtItems: [], clueItems: [], juiceItems: [] };
    const items = actor.items.contents;
    // Implement your logic for helpItems, hurtItems, clueItems, and juiceItems.
    return {
      helpItems: [],
      hurtItems: [],
      clueItems: [],
      juiceItems: [],
    };
  }
  

/**
 * Calculate the essence based on the given array of theme items.
 * @param {Array} themes - Array of theme items (e.g., actor.items.contents filtered by type "theme")
 * @returns {Object} An object with keys: essence, className, imageName.
 */
    export function getEssence(themes) {
    // Initialize counters for each category
    const categoryCounts = {
        Self: 0,
        Noise: 0,
        Logos: 0,
        Mythos: 0,
        Mist: 0,
    };

    // Loop through each theme and try to get the themebook's category
    for (const theme of themes) {
        let realThemebook;
        const themebook = theme.themebook;
        if (themebook?.isThemeKit && themebook.isThemeKit()) {
        realThemebook = themebook.themebook;
        } else {
        realThemebook = themebook;
        }
        if (!realThemebook) {
        console.warn(`No themebook found for theme: ${theme.name}`);
        continue;
        }
        const category = realThemebook.system.subtype;
        if (category && categoryCounts.hasOwnProperty(category)) {
        categoryCounts[category]++;
        } else {
        console.warn(`Unknown or missing category for theme: ${theme.name}`);
        }
    }

    // Destructure some of the counts for easier access
    const { Self, Noise, Mythos, Logos, Mist } = categoryCounts;
    const totalCount = Self + Noise + Mythos;

    // Determine an imageName based on counts (you can change this logic as needed)
    let imageName = "blank.svg"; // default image
    if (totalCount === 4) {
        const segments = [];
        if (Self > 0) segments.push(`${Self}S`);
        if (Mythos > 0) segments.push(`${Mythos}M`);
        if (Noise > 0) segments.push(`${Noise}N`);
        imageName = segments.join("") + ".svg";
    } else if (Logos > 0 || Mist > 0 || Mythos > 0) {
        imageName = "com.webp";
    }

    // Determine essence using your system's rules.
    // (These rules are just an example; adjust them to match your system.)
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
  
  
  /**
   * Get power tags for a given theme.
   * @param {string} themeId 
   * @param {Array} tagItems 
   * @param {Object} subTagsByParent 
   * @param {Actor} actor 
   * @returns {Array}
   */

  export function getPowerTags(themeId, tagItems, subTagsByParent, actor) {
    const powerTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === "power");
    return powerTags.map(tag => {
      const tagData = applyBurnState(actor, tag.id);
      return {
        ...tagData,
        tagName: tag.name || tagData.tagName || `Unnamed Power Tag`,
        crispy: tag.system.crispy || false,
        actorId: actor.id
      };
    });
  }
    
  export function getWeaknessTags(themeId, tagItems, subTagsByParent, actor) {
    const weaknessTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === "weakness");
    return weaknessTags.map(tag => {
      const tagData = applyBurnState(actor, tag.id, "weakness");
      return {
        ...tagData,
        tagName: tag.name || tagData.tagName || `Unnamed Weakness Tag`,
        actorId: actor.id // <-- Add the actorId here as well
      };
    });
  }
  
  
  /**
   * Get story tags for a given actor.
   * @param {Actor} actor 
   * @returns {Array}
   */
  export function getStoryTags(actor) {
    if (!actor) return [];
    const items = actor.items.contents;
    const tagItems = items.filter(item => item.type === 'tag');
    const storyTags = tagItems.filter(tag => tag.system.subtype === 'story')
      .map(tag => {
        if (!tag || !tag._id || !tag.system) {
          console.error("Invalid tag item in getStoryTags:", tag);
          return null;
        }
        const processedTag = applyBurnState(actor, tag._id, 'story');
        processedTag.isInverted = tag.system.inverted || false;
        processedTag.inversionIcon = processedTag.isInverted 
          ? '<i class="fa-light fa-angles-up"></i>' 
          : '<i class="fa-light fa-angles-down"></i>';
        return processedTag;
      }).filter(Boolean);
    return storyTags;
  }
  
  /**
   * Get loadout tags for a given actor.
   * @param {Actor} actor 
   * @returns {Array}
   */
  export function getLoadoutTags(actor) {
    if (!actor) return [];
    return actor.items.contents.filter(item =>
      item.type === 'tag' &&
      item.system.subtype === 'loadout' &&
      item.system.activated_loadout === true
    ).map(tag => {
      const burnData = applyBurnState(actor, tag.id);
      return {
        id: tag.id,
        tagName: tag.name,
        burnState: burnData.burnState,
        cssClass: burnData.cssClass,
        burnIcon: burnData.burnIcon,
        permanent: burnData.permanent,
        temporary: burnData.temporary,
        isInverted: burnData.isInverted,
        activatedLoadout: tag.system.activated_loadout,
      };
    });
  }
  
  