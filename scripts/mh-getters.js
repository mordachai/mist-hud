// mh-getters.js

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

export function getCrewThemes(actor) {
  if (!actor) return [];
  
  // Filter crew actors based on non-GM owners on the passed actor.
  const nonGMOwners = game.users.filter(user =>
    !user.isGM && actor.testUserPermission(user, "OWNER")
  );
  
  const ownedCrews = game.actors.contents.filter(a =>
    a.type === "crew" &&
    nonGMOwners.some(user => a.testUserPermission(user, "OWNER"))
  );
  
  // Determine system settings and set keys for labels.
  const system = game.settings.get("city-of-mist", "system");
  let attentionKey, crackKey, prefix;
  if (system === "city-of-mist") {
    attentionKey = "CityOfMist.terms.attention";
    crackKey = "CityOfMist.terms.crack";
    // Combine two localized strings for the prefix
    prefix = `${game.i18n.localize("CityOfMist.terms.mystery")}/${game.i18n.localize("CityOfMist.terms.identity")}`;
  } else if (system === "otherscape") {
    attentionKey = "Otherscape.terms.upgrade";
    crackKey = "Otherscape.terms.decay";
    prefix = `${game.i18n.localize("Otherscape.terms.ritual")}/${game.i18n.localize("CityOfMist.terms.identity")}/${game.i18n.localize("Otherscape.terms.itch")}`;
  } else if (system === "legend") {
    attentionKey = "Legend.terms.improve";
    crackKey = "Legend.terms.abandon";
    prefix = `${game.i18n.localize("Legend.terms.quest")}`;
  }
  
  const attentionLabel = attentionKey ? game.i18n.localize(attentionKey) : "Attention";
  const crackLabel = crackKey ? game.i18n.localize(crackKey) : "Crack";
  
  return ownedCrews.flatMap(crew =>
    crew.items.filter(item => item.type === 'theme').map(theme => {
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
        weaknessTags: getWeaknessTags(themeId, tagItems, subTagsByParent, crew),
        mystery: theme.system.mystery || "No mystery defined.",
        // Provide mysteryText for tooltip consistency.
        mysteryText: theme.system.mystery || "No mystery defined.",
        attention: theme.system.attention ?? [],
        crack: theme.system.crack ?? [],
        // For styling and labeling in the tooltip.
        category: "Crew",
        prefix: prefix,
        attentionLabel: attentionLabel,
        crackLabel: crackLabel,
        activeSystem: game.settings.get("city-of-mist", "system")
      };
    })
  );
}

export function getMysteryFromTheme(actor, themeId) {
  if (!actor) {
    console.warn("No actor provided in getMysteryFromTheme.");
    return {
      themeName: "Unknown Theme",
      themebook_name: "Unknown Themebook",
      category: "unknown",
      prefix: "Theme",
      mysteryText: "No mystery defined.",
      attention: [],
      crack: [],
      attentionLabel: "Attention",
      crackLabel: "Crack"
    };
  }

  const theme = actor.items.contents.find(item => item.type === 'theme' && item.id === themeId);
  if (!theme) {
    console.warn(`No theme found with ID: ${themeId}`);
    return {
      themeName: "Unknown Theme",
      themebook_name: "Unknown Themebook",
      category: "unknown",
      prefix: "Theme",
      mysteryText: "No mystery defined.",
      attention: [],
      crack: [],
      attentionLabel: "Attention",
      crackLabel: "Crack"
    };
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
    return {
      themeName: theme.name,
      themebook_name: "Unknown Themebook",
      category: "unknown",
      prefix: "Theme",
      mysteryText: "No mystery defined.",
      attention: [],
      crack: [],
      attentionLabel: "Attention",
      crackLabel: "Crack"
    };
  }

  // const category = realThemebook.system.subtype || "unknown";
  const system = game.settings.get("city-of-mist", "system");
  
  // Check if this is a Legend theme by looking at the motivation field
  const isLegendTheme = realThemebook.system.motivation === "motivation";

  const category = realThemebook.system.subtype || 
                  ((system === "legend" || isLegendTheme) ? "Variable" : "unknown");
  

  // System-specific name display:
  // City of Mist: show themebook names (e.g., "Divination", "Encantment")
  // Otherscape: show theme names (e.g., "Mythos", "Self", "Noise") 
  // Legend: show theme names (e.g., "Origin", "Greatness", "Adventure")
  const displayName = system === "city-of-mist" ? realThemebook.name 
                    : system === "otherscape" ? theme.name
                    : system === "legend" ? theme.name
                    : realThemebook.name; // fallback to themebook name

  let prefixKey;
  
  // Handle Legend themes first using motivation field
  if (system === "legend" && isLegendTheme) {
    prefixKey = "Legend.terms.quest";
  } else {
    // Handle other systems and categories normally
    switch (category) {
      case "Mythos":
        prefixKey = (system === "city-of-mist") ? "CityOfMist.terms.mystery"
                  : (system === "otherscape")   ? "Otherscape.terms.ritual"
                  : null;
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
      // Add specific Legend categories as backup
      case "Adventure":
      case "Origin":
      case "Greatness":
      case "":   
        prefixKey = "Legend.terms.quest";
        break;
      default:
        console.warn(`Unknown category: "${category}" for system: "${system}"`);
        // Default for Legend system
        if (system === "legend") {
          prefixKey = "Legend.terms.quest";
        } else {
          prefixKey = null;
        }
    }
  }
  
  const prefix = prefixKey ? game.i18n.localize(prefixKey) : "Theme";

  let attentionKey, crackKey;
  if (system === "city-of-mist") {
    attentionKey = "CityOfMist.terms.attention";
    if (category === "Logos" || category === "Self") {
      crackKey = "CityOfMist.terms.crack";
    } else if (category === "Mythos") {
      crackKey = "CityOfMist.terms.fade";
    } else {
      crackKey = "CityOfMist.terms.crack";
    }
  } else if (system === "otherscape") {
    attentionKey = "Otherscape.terms.upgrade";
    crackKey     = "Otherscape.terms.decay";
  } else if (system === "legend") {
    attentionKey = "Legend.terms.improve";
    crackKey = "Legend.terms.abandon";
  }
  
  const attentionLabel = attentionKey ? game.i18n.localize(attentionKey) : "Attention";
  const crackLabel = crackKey ? game.i18n.localize(crackKey) : "Crack";

  const mysteryText = theme.system.mystery || "No mystery defined.";
  const attention = theme.system.attention ?? [];
  const crack = theme.system.crack ?? [];

  const localeKey = realThemebook.system?.locale_name || "";
  const localizedLocaleName = localeKey ? game.i18n.localize(localeKey.replace(/^#/, "")) : "";

  return {
    themeName: theme.name,
    themebook_name: displayName,  // Now uses system-specific logic
    category,
    prefix,
    mysteryText,
    attention,
    crack,
    attentionLabel,
    crackLabel,
    themeInfo: {
      locale_name: localizedLocaleName
    },
    activeSystem: game.settings.get("city-of-mist", "system")
  };
}

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
    const themeType = realThemebook.system?.subtype || "Default";
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

export function getThemebooks(actor) {
  if (!actor || !actor.items) {
    console.error("Invalid actor provided to getThemebooks.");
    return [];
  }
  const items = actor.items.contents;
  const themes = items.filter(item => item.type === "theme" && item.name !== "__LOADOUT__");

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
    const themeType = realThemebook.system?.subtype || "Default";
    const themeIcon = `mh-theme-icon ${themeType}`;
    return {
      id: theme._id,
      themeName: themes.name,
      themebook_id: realThemebook._id,
      themebook_name: realThemebook.name,
      themeIcon,
      themeType,
      burnState: theme.system?.burned ? 'burned' : '',
      mystery: theme.system?.mystery || "",
      themeInfo: {
        locale_name: realThemebook.system?.locale_name?.replace(/^#/, "") || ""
      }
    };
  }).filter(Boolean);
}  

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
    // Localize the theme and themebook names
    const localizedThemeName = game.i18n.localize(theme.name);
    const localizedThemebookName = game.i18n.localize(realThemebook.name);
    acc[theme._id] = {
      id: theme._id,
      name: localizedThemeName || "Unnamed Theme",
      themebookName: localizedThemebookName || "Unnamed Themebook",
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
    // Also localize the improvement name and description if needed
    const localizedItemName = game.i18n.localize(item.name);
    const localizedDescription = game.i18n.localize(item.system.description || "No description provided.");
    acc[themebookName].improvements.push({
      id: item.id,
      name: localizedItemName,
      description: localizedDescription,
      effect_class: item.system.effect_class || null,
      theme_id: item.system.theme_id || null,
      choiceItem: item.system.choice_item || null,
      uses: item.system.uses || { max: 0, current: 0, expended: false },
    });
    return acc;
    
  }, {});
  return Object.values(improvementsGrouped);
  
}

export function getCrewImprovements(actor) {
  if (!actor) return [];
  
  const nonGMOwners = game.users.filter(user =>
    !user.isGM && actor.testUserPermission(user, "OWNER")
  );
  
  const ownedCrews = game.actors.contents.filter(a =>
    a.type === "crew" &&
    nonGMOwners.some(user => a.testUserPermission(user, "OWNER"))
  );
  
  const improvementsGrouped = {};
  
  for (const crew of ownedCrews) {
    const items = crew.items.contents;
    
    const themes = items.filter(item => item.type === "theme").reduce((acc, theme) => {
      let realThemebook = theme.themebook;
      if (realThemebook?.isThemeKit && realThemebook.isThemeKit()) {
        realThemebook = realThemebook.themebook;
      }
      if (!realThemebook) {
        console.warn(`No themebook found for crew theme: ${theme.name}`);
        return acc;
      }
      const localizedThemeName = theme.name && theme.name.startsWith("#")
        ? game.i18n.localize(theme.name)
        : theme.name;
      // For crew themes, you might want to use the crew's name as the localized themebook name:
      const localizedThemebookName = crew.name; 
      acc[theme._id] = {
        id: theme._id,
        themeName: localizedThemeName || "Unnamed Theme",
        themebookName: localizedThemebookName || "Unnamed Themebook",
        themeType: realThemebook.system.subtype || "Unknown Type",
        unspent_upgrades: theme.system.unspent_upgrades || 0
      };
      return acc;
    }, {});
    
    const improvements = items.filter(item =>
      item.type === "improvement" && themes[item.system.theme_id]
    );
    
    for (const item of improvements) {
      const theme = themes[item.system.theme_id];
      const themebookName = theme.themebookName;
      if (!improvementsGrouped[themebookName]) {
        improvementsGrouped[themebookName] = {
          themebookName: themebookName,
          themeType: theme.themeType,
          improvements: []
        };
      }
      const localizedItemName = item.name && item.name.startsWith("#")
        ? game.i18n.localize(item.name)
        : item.name;
      const localizedDescription = item.system.description && item.system.description.startsWith("#")
        ? game.i18n.localize(item.system.description)
        : item.system.description || "No description provided.";
      improvementsGrouped[themebookName].improvements.push({
        id: item.id,
        name: localizedItemName,
        description: localizedDescription,
        effect_class: item.system.effect_class || null,
        theme_id: item.system.theme_id || null,
        choiceItem: item.system.choice_item || null,
        uses: item.system.uses || { max: 0, current: 0, expended: false }
      });
    }
  }
  
  return Object.values(improvementsGrouped);
}

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

export function getJuiceAndClues(actor) {
  if (!actor) {
    return { helpItems: [], hurtItems: [], clueItems: [], juiceItems: [] };
  }

  // Get items from the actor's items collection.
  const items = actor.items.contents;
  // Access all actors in the game.
  const characters = game.actors;

  // Helper function to resolve a character's details by ID.
  const resolveCharacter = (charId) => {
    const char = characters.get(charId);
    if (!char) return null;
    return {
      name: char.name,
      tokenImage:
        char.token?.texture.src ||
        char.prototypeToken?.texture.src ||
        char.img,
      id: char.id,
    };
  };

  // Get active bonuses from actor flags.
  const activeBonuses = actor.getFlag('mist-hud', 'active-bonuses') || {};

  // Process help items (juice items with subtype "help").
  const helpItems = items
    .filter(
      (item) =>
        item.type === "juice" && item.system?.subtype === "help"
    )
    .map((item) => {
      const target = resolveCharacter(item.system.targetCharacterId);
      if (!target) return null;
      const active = activeBonuses.help?.[target.id] || false;
      return {
        id: item.id,
        actorId: actor.id,
        amount: item.system.amount,
        target,
        active,
      };
    })
    .filter((item) => item !== null);
    //console.log("helpItems", helpItems);

  // Process hurt items (juice items with subtype "hurt").
  const hurtItems = items
    .filter(
      (item) =>
        item.type === "juice" && item.system?.subtype === "hurt"
    )
    .map((item) => {
      const target = resolveCharacter(item.system.targetCharacterId);
      if (!target) return null;
      const active = activeBonuses.hurt?.[target.id] || false;
      return {
        id: item.id,
        actorId: actor.id,
        amount: item.system.amount,
        target,
        active,
      };
    })
    .filter((item) => item !== null);

  // Process clue items.
  const clueItems = items
    .filter((item) => item.type === "clue" && item.system)
    .map((item) => ({
      id: item.id,
      actorId: actor.id,
      name: item.name || "Unnamed Clue",
      amount: item.system.amount || 0,
      partial: item.system.partial || false,
      source: item.system.source || "Unknown",
      method: item.system.method || "Unknown",
    }));

  // Process juice items (exclude those with subtype "help" or "hurt").
  const juiceItems = items
    .filter(
      (item) =>
        item.type === "juice" &&
        item.system &&
        (!item.system.subtype ||
          !["help", "hurt"].includes(item.system.subtype))
    )
    .map((item) => ({
      id: item.id,
      actorId: actor.id,
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

export function getEssence(themes) {
  // Initialize counters for each category
  const categoryCounts = {
      Self: 0,
      Noise: 0,
      Logos: 0,
      Mythos: 0,
      Mist: 0,
  };

  // Filter out the __LOADOUT__ theme before processing
  const filteredThemes = themes.filter(theme => theme.name !== "__LOADOUT__");

  // Loop through each theme and try to get the themebook's category
  for (const theme of filteredThemes) {
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

export function getPowerTags(themeId, tagItems, subTagsByParent, actor) {
  const powerTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === "power");
  return powerTags.map(tag => {
    const tagData = applyBurnState(actor, tag.id);
    return {
      ...tagData,
      tagName: tag.name || tagData.tagName || `Unnamed Power Tag`,
      crispy: tag.system.crispy || false,
      actorId: actor.id,
      themeId: tag.system.theme_id
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
      actorId: actor.id,
      themeId: tag.system.theme_id
    };
  });
} 

export function getStoryTags(actor) {
  if (!actor) return [];
  const items = actor.items.contents;
  const tagItems = items.filter(item => item.type === 'tag');
  const storyTags = tagItems
    .filter(tag => tag.system.subtype === 'story')
    .map(tag => {
      if (!tag || !tag._id || !tag.system) {
        console.error("Invalid tag item in getStoryTags:", tag);
        return null;
      }
      // Process the tag using your existing logic.
      const processedTag = applyBurnState(actor, tag._id, 'story');
      // Ensure the tag has the following extra properties:
      processedTag.actorId = actor.id;
      processedTag.themeId = tag.system.theme_id;
      processedTag.temporary = !!tag.system.temporary;
      processedTag.permanent = !!tag.system.permanent;
      
      // Define a cssClass (or stateClass) based on the burn state.
      // You might already have these computed in processedTag (e.g. via applyBurnState)
      // For example, if applyBurnState sets:
      //    processedTag.burned as true/false and processedTag.burn_state as numeric,
      // then you can assign:
      if (processedTag.burned) {
        processedTag.cssClass = "burned";
      } else if (processedTag.burn_state === 1) {
        processedTag.cssClass = "to-burn";
      } else {
        processedTag.cssClass = "selected";
      }

      // Also include the inversion icon and inverted flag as you already do:
      processedTag.isInverted = tag.system.inverted || false;
      processedTag.inversionIcon = processedTag.isInverted 
        ? '<i class="fa-light fa-angles-up"></i>' 
        : '<i class="fa-light fa-angles-down"></i>';
      
      return processedTag;
    })
    .filter(Boolean);
  return storyTags;
}  

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
      actorId: actor.id,
      themeId: tag.system.theme_id,
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
  
  