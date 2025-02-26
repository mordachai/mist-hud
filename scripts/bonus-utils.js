import { getImprovements } from "./mh-getters.js";
import { getCrewImprovements } from "./mh-getters.js";
import { MistHUD } from "./mist-hud.js";

/**
 * Checks if the move roll should be treated as Dynamite.
 * The dynamite roll is only triggered if:
 *  - The move matches an improvement (by abbreviation or selectable move name)
 *  - AND an activated tag from the corresponding theme is selected.
 *
 * @param {Actor} actor - The actor rolling the move.
 * @param {Object} move - The move config object (from moveConfig) being rolled.
 * @returns {boolean} - Returns true if dynamite should be enabled.
 */
export function checkRolls(actor, move) {
  if (!actor || !move) return false;

  const moveAbbr = move.abbreviation;
  // Use the literal move name if provided; otherwise, fall back to move.name
  const moveKey = move.configKey || move.name;

  // Get improvements from actor and crew
  const improvementGroups = getImprovements(actor);
  const crewImprovementGroups = getCrewImprovements(actor);
  const actorImprovements = improvementGroups.reduce((arr, group) => arr.concat(group.improvements), []);
  const crewImprovements = crewImprovementGroups.reduce((arr, group) => arr.concat(group.improvements), []);
  const allImprovements = [...actorImprovements, ...crewImprovements];

  // Retrieve selected roll data from the MistHUD
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  // Combine power, crew power, and loadout tags
  const activatedTags = [
    ...(rollData.powerTags || []),
    ...(rollData.crewPowerTags || []),
    ...(rollData.loadoutTags || [])
  ];

  // Helper: Check if any activated tag belongs to the given themeId.
  // This assumes each tag object includes a property "themeId".
  const hasActivatedThemeTag = (themeId) => {
    const result = activatedTags.some(tag => {
      if (!tag.themeId) {
        return false;
      }
      return tag.themeId === themeId;
    });
    return result;
  };

  // Iterate over all improvements to see if any force Dynamite for this move.
  for (const improvement of allImprovements) {
    // Expect each improvement to include effect_class and theme_id from its system data.
    const effectClass = improvement.effect_class || (improvement.system && improvement.system.effect_class);
    const themeId = improvement.theme_id || (improvement.system && improvement.system.theme_id);
    if (!effectClass) continue;


    // Case 1: Always Dynamite for this move (ignores tag selection).
    if (effectClass.startsWith("ALWAYS_DYN_") && effectClass.endsWith(moveAbbr)) {
      return true;
    }

    // For improvements tied to a specific theme, require that at least one tag from that theme is activated.
    if (themeId && !hasActivatedThemeTag(themeId)) {
      continue;
    }

    // Case 2: Specific theme improvement keyed by move abbreviation.
    if (effectClass === `THEME_DYN_${moveAbbr}`) {
      return true;
    }

    // Case 3: Generic selectable dynamite improvement.
    // Compare the literal move key with the improvement's choice_item.
    const choiceItem = (improvement.choiceItem || (improvement.system && improvement.system.choice_item)) || "";
    if (effectClass === "THEME_DYN_SELECT" && choiceItem === moveKey) {
      return true;
    }
  }

  return false;
}

export function getReceivedBonuses(receiverActor) {
  if (!receiverActor) return [];
  const messages = [];
  //console.log("Scanning for bonuses for actor id:", receiverActor.id);

  // Retrieve the active bonuses stored as an object keyed by provider IDs
  const activeBonuses = receiverActor.getFlag("mist-hud", "received-bonuses") || {}; 

  // Iterate through all actors to see if they have provided a bonus to the receiver
  for (const provider of game.actors.contents) {
    // Skip if the provider is the receiver
    if (provider.id === receiverActor.id) continue;
    //console.log(`Checking provider ${provider.name} with id ${provider.id}:`, activeBonuses);

    // If the provider gave a help bonus, add a message
    if (activeBonuses[provider.id]?.type === "help") {
      messages.push({
        giverName: provider.name,
        type: "help",
        amount: activeBonuses[provider.id].amount
      });
    }
    // If the provider gave a hurt bonus, add a message
    if (activeBonuses[provider.id]?.type === "hurt") {
      messages.push({
        giverName: provider.name,
        type: "hurt",
        amount: activeBonuses[provider.id].amount
      });
    }
  }

  //console.log("Found bonus messages:", messages);
  return messages;
}


