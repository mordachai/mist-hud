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
  console.log(`[DYNAMITE CHECK] Checking dynamite for move: "${moveKey}" (${moveAbbr}).`);

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
  console.log("[DYNAMITE CHECK] Activated tags:", activatedTags);

  // Helper: Check if any activated tag belongs to the given themeId.
  // This assumes each tag object includes a property "themeId".
  const hasActivatedThemeTag = (themeId) => {
    const result = activatedTags.some(tag => {
      if (!tag.themeId) {
        console.log(`[DYNAMITE CHECK] Tag with id ${tag.id} does not have a themeId.`);
        return false;
      }
      return tag.themeId === themeId;
    });
    if (result) {
      console.log(`[DYNAMITE CHECK] Found activated tag for theme ID: ${themeId}`);
    } else {
      console.log(`[DYNAMITE CHECK] No activated tag found for theme ID: ${themeId}`);
    }
    return result;
  };

  // Iterate over all improvements to see if any force Dynamite for this move.
  for (const improvement of allImprovements) {
    // Expect each improvement to include effect_class and theme_id from its system data.
    const effectClass = improvement.effect_class || (improvement.system && improvement.system.effect_class);
    const themeId = improvement.theme_id || (improvement.system && improvement.system.theme_id);
    if (!effectClass) continue;

    console.log(`[DYNAMITE CHECK] Evaluating improvement "${improvement.name}" with effect_class: "${effectClass}"`);

    // Case 1: Always Dynamite for this move (ignores tag selection).
    if (effectClass.startsWith("ALWAYS_DYN_") && effectClass.endsWith(moveAbbr)) {
      console.log(`[DYNAMITE CHECK] ALWAYS_DYN matched for move "${moveKey}".`);
      return true;
    }

    // For improvements tied to a specific theme, require that at least one tag from that theme is activated.
    if (themeId && !hasActivatedThemeTag(themeId)) {
      console.log(`[DYNAMITE CHECK] Improvement "${improvement.name}" requires an activated tag for theme ID: ${themeId} but none was found. Skipping.`);
      continue;
    }

    // Case 2: Specific theme improvement keyed by move abbreviation.
    if (effectClass === `THEME_DYN_${moveAbbr}`) {
      console.log(`[DYNAMITE CHECK] Improvement "${improvement.name}" forces dynamite on move "${moveKey}" via effect_class "${effectClass}".`);
      return true;
    }

    // Case 3: Generic selectable dynamite improvement.
    // Compare the literal move key with the improvement's choice_item.
    const choiceItem = (improvement.choiceItem || (improvement.system && improvement.system.choice_item)) || "";
    if (effectClass === "THEME_DYN_SELECT" && choiceItem === moveKey) {
      console.log(`[DYNAMITE CHECK] Improvement "${improvement.name}" with THEME_DYN_SELECT matched move "${moveKey}" (choice_item: "${choiceItem}").`);
      return true;
    }
  }

  console.log(`[DYNAMITE CHECK] No improvement triggered dynamite for move "${moveKey}".`);
  return false;
}




export function getReceivedBonuses(receiverActor) {
    if (!receiverActor) return [];
    const messages = [];
    console.log("Scanning for bonuses for actor id:", receiverActor.id);

    // O problema pode estar aqui:
    const activeBonuses = receiverActor.getFlag("mist-hud", "received-bonuses") || {}; // Alterado de active-bonuses para received-bonuses

    for (const provider of game.actors.contents) {
        if (provider.id === receiverActor.id) continue;
        console.log(`Checking provider ${provider.name} with id ${provider.id}:`, activeBonuses);
        
        if (activeBonuses[provider.id]?.type === "help") {
            messages.push({
                giverName: provider.name,
                type: "help",
                amount: activeBonuses[provider.id].amount
            });
        }
        if (activeBonuses[provider.id]?.type === "hurt") {
            messages.push({
                giverName: provider.name,
                type: "hurt",
                amount: activeBonuses[provider.id].amount
            });
        }
    }

    console.log("Found bonus messages:", messages);
    return messages;
}

