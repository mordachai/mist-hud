//mh-data.js

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

export class MistHUDData {
    constructor(actor) {
        this.actor = actor;
    }

    // getThemesAndTags() {
    //     if (!this.actor) return {};
    
    //     const items = this.actor.items.contents;
    
    //     // Filter themes and tags
    //     const themeItems = items.filter(item => item.type === 'theme');
    //     const tagItems = items.filter(item => item.type === 'tag');
    
    //     // Organize subtags under their respective parent tags
    //     const subTagsByParent = tagItems.reduce((acc, tag) => {
    //         if (tag.system.parentId) {
    //             if (!acc[tag.system.parentId]) acc[tag.system.parentId] = [];
    //             acc[tag.system.parentId].push(tag); // Attach subtags to their parentId
    //         }
    //         return acc;
    //     }, {});
    
    //     // Process themes with mystery details
    //     const themes = themeItems.map(theme => {
    //         const themebookName = theme.system.themebook_name || theme.name;
    //         const themeId = theme._id;
    //         const category = getThemeCategory(themebookName.toLowerCase());
    //         const iconClass = category ? `mh-theme-icon ${category}` : 'mh-theme-icon';
    //         const mystery = theme.system.mystery || "No mystery defined.";
    
    //         // Get power and weakness tags for the theme
    //         const powerTags = this.getPowerTags(themeId, tagItems, subTagsByParent);
    //         const weaknessTags = this.getWeaknessTags(themeId, tagItems, subTagsByParent);
    
    //         return {
    //             themebookName,
    //             id: themeId,
    //             themeName: theme.name,
    //             localizedThemebookName: localizeTheme(themebookName),
    //             iconClass,
    //             category,
    //             mystery, // Include mystery in the theme data
    //             powerTags,
    //             weaknessTags,
    //         };
    //     });
    
    //     const storyTags = this.getStoryTags();
    
    //     return {
    //         themes,
    //         storyTags,
    //     };
    // }


    getThemes() {
        if (!this.actor) return [];
    
        const items = this.actor.items.contents;
        const themeItems = items.filter(item => item.type === 'theme');
    
        return themeItems.map(theme => {
            const themebookName = theme.system.themebook_name || "Unknown Themebook";
            const localizedThemebookName = localizeTheme(themebookName); // Use localizeTheme here
    
            return {
                themeName: theme.name,
                themeId: theme._id,
                mystery: theme.system.mystery || "No mystery defined.",
                localizedThemebookName
            };
        });
    }
    
     
    
    // getPowerTags(themeId, tagItems, subTagsByParent) {
    // // Filter power tags for the given theme
    // const powerTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === 'power');

    // return this.formatTagsHierarchy(powerTags, subTagsByParent).map(tag => {
    //     const tagged = this.applyBurnState(this.actor, tag.id);
    //     return tagged;
    // });
    // }

    // getWeaknessTags(themeId, tagItems, subTagsByParent) {
    // // Filter weakness tags for the given theme
    // const weaknessTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === 'weakness');

    // return this.formatTagsHierarchy(weaknessTags, subTagsByParent).map(tag => {
    //     const tagged = this.applyBurnState(this.actor, tag.id, 'weakness');
    //     return tagged;
    // });
    // }


    getPowerTags(themeId, tagItems, subTagsByParent) {
        const powerTags = tagItems.filter(tag => tag.system.theme_id === themeId && tag.system.subtype === 'power');
        return this.formatTagsHierarchy(powerTags, subTagsByParent).map(tag => {
            if (!tag.id) {
                console.warn("Invalid tag found:", tag);
                return null; // Skip invalid tags
            }
            return this.applyBurnState(this.actor, tag.id);
        }).filter(Boolean); // Remove null entries
    }
            
    getWeaknessTags(themeId, tagItems, subTagsByParent) {
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

    getLoadoutTags() {
        if (!this.actor) return [];
    
        const allTags = this.actor.items.contents.filter(item => item.type === "tag");
        const subTagsByParent = this.getSubtags(allTags);
    
        return allTags
            .filter(tag => tag.system.subtype === "loadout")
            .map(tag => ({
                id: tag._id,
                name: tag.name,
                burnState: tag.system.burned ? "Burned" : "Unburned",
                invertedState: tag.system.inverted ? "Inverted" : "Normal",
                activated: tag.system.activated_loadout ? "Activated" : "Inactive",
                subtags: subTagsByParent[tag._id] || [] // Retrieve subtags from the mapping
            }));
    }
    
    getSubtags(tags) {
        const subTagsByParent = tags.reduce((acc, tag) => {
            const parentId = tag.system?.parentId;
    
            if (parentId) {
                if (!acc[parentId]) acc[parentId] = [];
                acc[parentId].push({
                    ...tag,
                    classType: "subtag",
                });
            } else {
                acc[tag._id] = acc[tag._id] || [];
                acc[tag._id].push({
                    ...tag,
                    classType: "",
                });
            }
            return acc;
        }, {});
    
        console.log("SubTagsByParent:", subTagsByParent); // Debug log
        return tags.map(tag => {
            const tagData = { ...tag };
            tagData.subtags = subTagsByParent[tag._id] || [];
            return tagData;
        });
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
        return tags.map(tag => {
            const newTag = { ...tag }; // Clone the tag to avoid modifying immutable objects
    
            const subtags = subTagsByParent[tag._id] || [];
            newTag.subtags = subtags.map(subtag => ({
                id: subtag._id,
                tagName: subtag.name,
                classType: "subtag",
            }));
    
            console.log("Formatted Tag:", newTag); // Debug log
            return newTag;
        });
    }
                
    formatTagData(tag) {
          return {
              id: tag.id,
              tagName: tag.name,
              isSelected: false,
              burnState: tag.system.burn_state || 0,
              burnIcon: MistHUDData.getIcon(tag.system.burn_state || 0, 'burn'),
              isInverted: tag.system.isInverted || false,
              weaknessIcon: MistHUDData.getIcon(tag.system.isInverted, 'weakness'),
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
        console.warn(`Unknown type "${type}" for getIcon.`);
        return '';
    }
    
}
  
