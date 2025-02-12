// mh-roll.js

import { MistHUD } from './mist-hud.js';
import { moveConfig } from './mh-theme-config.js';
import { initializeAccordions } from './accordion-handler.js';
import { detectActiveSystem } from './mh-settings.js';


// Debug mode setting
let debug = false;

Hooks.once("init", () => {
  game.settings.register("mist-hud", "debugMode", {
    name: "Enable Debug Mode",
    hint: "Toggle debug logging for Mist HUD rolls.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => debug = value
  });
  debug = game.settings.get("mist-hud", "debugMode");
});

// Utility function to log messages if debug is enabled
// function debugLog(...args) {
//   if (debug) console.log("MistHUD |", ...args);
// }

let toBurnTags = $('.mh-power-tag.toBurn, .mh-power-tag.crew.toBurn').toArray().map(tag => $(tag).data('id'));

async function rollDice() {
  const roll = new Roll("2d6");
  await roll.evaluate({async: true});

  // Check if Dice So Nice is active
  if (game.modules.get("dice-so-nice")?.active) {
    // Show the 3D dice animation for all players
    await game.dice3d.showForRoll(roll, game.user, true);
  }

  // Return the individual dice results
  return roll.dice[0].results.map(die => die.result);
}

// async function rollDice() {
//   console.warn("rollDice is overridden for testing: always returns [1, 1]");
  
//   // Simulate a dice roll result of [1, 1]
//   return [6, 6];
// }

//Main Roll function
async function rollMove(moveName, hasDynamite) {
  const hud = MistHUD.getInstance();
  const tagsData = hud.getSelectedRollData();

  if (!hud || !hud.actor) {
      ui.notifications.warn("MistHUD is not ready. Please select an actor.");
      return;
  }

  const actor = hud.actor;
  const move = moveConfig[moveName]; 

  const activeSystem = game.settings.get("city-of-mist", "system");

  // Get selected tags
  const powerTags = hud.getSelectedRollData().powerTags || [];
  console.log("Power Tags:", powerTags);
  const crewPowerTags = hud.getSelectedRollData().crewPowerTags || [];
  console.log("Crew Power Tags:", crewPowerTags);
  const loadoutTags = hud.getSelectedRollData().loadoutTags || [];
  
  // Initialize individual values
  const calculatedPower = calculatePowerTags();
  const weaknessTags = hud.getSelectedRollData().weaknessTags || [];
  const totalWeakness = calculateWeaknessTags();  
    if (weaknessTags.length > 0) {
        await trackWeaknessAttention(actor, weaknessTags);
    }
  const totalStoryTags = calculateStoryTags();
  
  const totalLoadoutTags = calculateLoadoutTags();
  const totalCharStatuses = calculateCharacterStatuses();
  const totalSceneStatuses = calculateSceneStatuses();
  const totalScnTags = calculateScnTags();
  const modifier = getRollModifier() || 0;

  const activeBonuses = actor.getFlag('mist-hud', 'received-bonuses') || [];
  //console.log(`[Help/Hurt Debug] Active Bonuses for Roll:`, activeBonuses);
  
  const helpBonuses = activeBonuses
      .filter(bonus => bonus.type === 'help')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  
  const hurtBonuses = activeBonuses
      .filter(bonus => bonus.type === 'hurt')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  
  const totalBonus = helpBonuses - hurtBonuses;
  //console.log(`[Roll Debug] Calculated Bonuses:`, { helpBonuses, hurtBonuses, totalBonus });
  
  const totalCrewPowerTags = calculateCrewPowerTags();
  const totalCrewWeaknessTags = calculateCrewWeaknessTags();

  const totalPower = 
    calculatedPower +
    totalCrewPowerTags +
    totalCrewWeaknessTags +
    totalWeakness +
    totalStoryTags +
    totalLoadoutTags +
    totalCharStatuses +
    totalSceneStatuses +
    totalScnTags +
    modifier;

  // Aggregate total power for the roll calculation
  //const totalPower = calculatedPower + totalWeakness + totalStoryTags + totalLoadoutTags + totalCharStatuses + totalSceneStatuses + totalScnTags + modifier;

// Ensure HUD is rendered
if (hud._state === Application.RENDER_STATES.CLOSED) {
  console.warn("MistHUD is closed. Attempting to reopen.");
  await hud.render(true);
}

try {
  await hud.render(true); // Render with updated state
  // Minimize the HUD after ensuring it's rendered
  setTimeout(() => {
      if (hud._element) {
          hud.minimize().catch(err => console.error("Error minimizing HUD:", err));
      }
  }, 100); // Wait for the DOM to fully render
} catch (error) {
  console.error("Error minimizing HUD before roll:", error);
}

  
  const rollResults = await rollDice();
  const rollTotal = rollResults.reduce((acc, value) => acc + value, 0) + totalPower + totalBonus;

  // **Check if a tag is being burned for a hit**
  const burningTags = tagsData.powerTags.filter(tag => tag.stateClass === "to-burn")
                      .concat(tagsData.crewPowerTags.filter(tag => tag.stateClass === "to-burn"))
                      .concat(tagsData.loadoutTags.filter(tag => tag.stateClass === "to-burn"));

    if (activeSystem === "city-of-mist" && burningTags.length > 0) {
    return await rollBurnForHitCityOfMist(moveName);
  }

  // Declare `dynamiteEnabled` variable
  let dynamiteEnabled = false; // Default to false for systems without dynamite moves

  // Apply special rules for Otherscape and LitM
  let outcome;
  let moveEffects = [];
  let diceClass = "default-dice";
  let outcomeClass = "default-outcome";
  const isDoubleOnes = rollResults.every(r => r === 1);
  const isDoubleSixes = rollResults.every(r => r === 6);

  // Outcome determination logic
  if (activeSystem === "otherscape" || activeSystem === "legend") {
    if (isDoubleOnes) {
      outcome = "fail";
      moveEffects = move.failEffects || [];
      diceClass = "double-ones";
      outcomeClass = "outcome-fail-double-ones";
    } else if (isDoubleSixes) {
      outcome = "success";
      moveEffects = move.successEffects || [];
      diceClass = "double-sixes";
      outcomeClass = "outcome-success-double-sixes";
    } else if (rollTotal >= 10) {
      outcome = "success";
      moveEffects = move.successEffects || [];
      outcomeClass = "outcome-success";
    } else if (rollTotal >= 7) {
      outcome = "partial";
      moveEffects = move.partialEffects || [];
      outcomeClass = "outcome-partial";
    } else {
      outcome = "fail";
      moveEffects = move.failEffects || [];
      outcomeClass = "outcome-fail";
    }
  } else if (activeSystem === "city-of-mist") {
      // Include dynamite logic for City of Mist
      dynamiteEnabled = (await actor.getFlag("mist-hud", "dynamiteMoves") || []).includes(moveName);

      if (dynamiteEnabled && rollTotal >= 12) {
          outcome = "dynamite";
          moveEffects = move.dynamiteEffects || [];
      } else if (rollTotal >= 10) {
          outcome = "success";
          moveEffects = move.successEffects || [];
      } else if (rollTotal >= 7) {
          outcome = "partial";
          moveEffects = move.partialEffects || [];
      } else {
          outcome = "fail";
          moveEffects = move.failEffects || [];
      }
  } else {
      // Default behavior for unknown systems
      console.error(`Unknown system: ${activeSystem}`);
      return;
  }

  // Generate and localize chat output
  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, totalPower);

  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));

  // Add firecracker emoji if the move is dynamite and the rollTotal is 12 or more
  const displayRollTotal = (dynamiteEnabled && rollTotal >= 12) ? `${rollTotal} 🧨` : rollTotal;

  // Prepare tracked effects data if applicable
  let trackedEffects = null;
  if (outcome !== "fail" && Array.isArray(move.trackedEffects) && move.trackedEffects.length > 0) {
      trackedEffects = move.trackedEffects; // Only include tracked effects for non-fail outcomes
  }

  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    subtitle: move.subtitle || "",
    rollResults,
    outcomeMessage,
    calculatedPower,
    totalCrewPowerTags,
    totalCrewWeaknessTags,
    totalLoadoutTags,
    totalWeakness,
    totalStoryTags,
    totalScnTags,
    totalCharStatuses,
    totalSceneStatuses,
    modifier,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData,
    statuses: tagsData.statuses, // Include statuses
    trackedEffects,
    diceClass,
    outcomeClass
};

  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);

  ChatMessage.create({
      content: chatContent,
      speaker: { alias: actor.name },
      flags: {
        "mist-hud": { isCustomRoll: true } // Add this flag
      }
  });

  // Clean up received-bonuses after roll
  await actor.unsetFlag('mist-hud', 'received-bonuses');
  //console.log(`[Help/Hurt Debug] Cleared bonuses after roll for actor:`, actor.name);

  hud.render(true); // Re-render HUD to reflect cleared bonuses

  // ✅ Burn crispy tags AFTER the roll is completed
  await burnCrispyTags(powerTags);
  await burnCrispyTags(crewPowerTags);
  await burnCrispyTags(loadoutTags);

  hud.cleanHUD(chatData.tagsData);

}

async function rollBurnForHitCityOfMist(moveName) {
  const hud = MistHUD.getInstance();
  if (!hud || !hud.actor) {
      ui.notifications.warn("MistHUD is not ready. Please select an actor.");
      return;
  }
  const actor = hud.actor;
  const move = moveConfig[moveName];
  const activeSystem = game.settings.get("city-of-mist", "system");

  // Burn-for-a-hit rules for City of Mist:
  // - Burning a tag gives a fixed Power of 3.
  // - Instead of rolling dice, treat the move as if you rolled a 7.
  // Thus, the unmodified total is 3 + 7 = 10.
  const burnBasePower = 3;
  const fixedRoll = 7;

  // Get status adjustments (statuses, scene statuses, scene tags)
  const totalCharStatuses = calculateCharacterStatuses();
  const totalSceneStatuses = calculateSceneStatuses();
  const totalScnTags = calculateScnTags();
  const modifier = getRollModifier() || 0;

  // Final total is fixed + statuses/modifiers.
  const finalTotal = burnBasePower + fixedRoll + totalCharStatuses + totalSceneStatuses + totalScnTags + modifier;

  // Dynamite (firecracker) logic.
  // (Assumes that the actor flag "dynamiteMoves" is an array of move names that allow dynamite.)
  const dynamiteEnabled = (await actor.getFlag("mist-hud", "dynamiteMoves") || []).includes(moveName);

  let outcome, moveEffects, outcomeClass;
  if (dynamiteEnabled && finalTotal >= 12) {
    outcome = "dynamite";
    moveEffects = move.dynamiteEffects || [];
    outcomeClass = "outcome-success-double-sixes";
  } else if (finalTotal >= 10) {
    outcome = "success";
    moveEffects = move.successEffects || [];
    outcomeClass = "outcome-success";
  } else if (finalTotal >= 7) {
    outcome = "partial";
    moveEffects = move.partialEffects || [];
    outcomeClass = "outcome-partial";
  } else {
    outcome = "fail";
    moveEffects = move.failEffects || [];
    outcomeClass = "outcome-fail";
  }

  // Prepare display total (append firecracker emoji if dynamite applies).
  const displayRollTotal = (dynamiteEnabled && finalTotal >= 12)
                             ? `${finalTotal} 🧨`
                             : finalTotal;

  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, burnBasePower);

  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));

  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    subtitle: move.subtitle || "",
    rollResults: [fixedRoll], // Only the fixed roll value is shown.
    outcomeMessage,
    calculatedPower: burnBasePower,
    totalCrewPowerTags: 0,  // Other tags do not contribute.
    totalCrewWeaknessTags: 0,
    totalLoadoutTags: 0,
    totalWeakness: 0,
    totalStoryTags: 0,
    totalScnTags: totalScnTags,
    totalCharStatuses: totalCharStatuses,
    totalSceneStatuses: totalSceneStatuses,
    modifier: modifier,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData: hud.getSelectedRollData(),
    statuses: hud.getSelectedRollData().statuses,
    trackedEffects: (outcome !== "fail" && Array.isArray(move.trackedEffects) && move.trackedEffects.length > 0)
                    ? move.trackedEffects
                    : null,
    diceClass: "default-dice",
    outcomeClass: outcomeClass
  };

  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);
  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name },
    flags: {
      "mist-hud": { isCustomRoll: true }
    }
  });

  await actor.unsetFlag('mist-hud', 'received-bonuses');
  hud.render(true);

  // Burn the used tags.
  const tagsData = hud.getSelectedRollData();
  await burnCrispyTags(tagsData.powerTags);
  await burnCrispyTags(tagsData.crewPowerTags);
  await burnCrispyTags(tagsData.loadoutTags);

  // Clean up the HUD (which clears selections, etc.).
  hud.cleanHUD(tagsData);
}

async function burnCrispyTags(tagsArray) {
  const hud = MistHUD.getInstance();
  if (!hud || !hud.actor) return;

  const mainActor = hud.actor;
  for (const tag of tagsArray) {
    if (tag.crispy) {
      console.log("Processing tag:", tag);
      // Update the UI elements...
      // Determine the correct actor using tag.actorId
      let tagActor = mainActor;
      if (tag.actorId && tag.actorId !== mainActor.id) {
        tagActor = game.actors.get(tag.actorId);
        if (!tagActor) {
          console.warn(`Crew actor not found for actorId: ${tag.actorId}`);
          continue;
        }
      }
      const tagItem = tagActor.items.get(tag.id);
      if (tagItem) {
        console.log(`[Burn Debug] Marking crispy tag '${tagItem.name}' as burned on actor '${tagActor.name}'.`);
        await tagItem.update({
          "system.burned": true,
          "system.burn_state": 0
        });
      } else {
        console.warn(`[Burn Debug] Tag item not found on actor '${tagActor.name}' for tag ID: ${tag.id}`);
      }
    }
  }
}

async function trackWeaknessAttention(actor, weaknessTags) {
  // Get all themes and weakness tags from the actor
  const themes = actor.items.filter(item => item.type === "theme");
  const allWeaknessTags = actor.items.filter(item => item.type === "tag" && item.system.subtype === "weakness");

  for (const theme of themes) {

      // Find weakness tags that belong to this theme
      const themeWeaknessTags = allWeaknessTags.filter(tag => tag.system.theme_id === theme._id);

      for (const weaknessTag of weaknessTags) {

          if (themeWeaknessTags.some(tag => tag.name === weaknessTag.tagName) && weaknessTag.stateClass !== "inverted") {
              let attention = Array.isArray(theme.system.attention) ? [...theme.system.attention] : [0, 0, 0];
              let unspentUpgrades = theme.system.unspent_upgrades || 0;

              let updated = false;

              // ✅ Find the first empty attention slot (0) and set it to 1
              for (let i = 0; i < attention.length; i++) {
                  if (attention[i] === 0) {
                      attention[i] = 1;
                      updated = true;
                      break;
                  }
              }

              // ✅ If all slots are filled, reset attention and increase `unspent_upgrades`
              if (attention.every(a => a === 1)) {
                  attention = [0, 0, 0]; // Reset attention
                  unspentUpgrades += 1;
              }

              // ✅ Force Foundry to recognize the update
              await theme.update({
                  [`system.attention`]: attention,
                  [`system.unspent_upgrades`]: unspentUpgrades
              });

              const updatedTheme = theme.toObject();
              console.log(`Updated theme ${theme.name}:`, updatedTheme.system);

              return; // Stop after updating the first valid theme
          }
      }
  }
}

function calculatePowerTags() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  // Exclude Crew Power Tags from Regular Power Tag Calculation
  const powerTagsTotal = rollData.powerTags
      .filter(tag => !rollData.crewPowerTags.some(crewTag => crewTag.id === tag.id)) // ✅ Ensure Crew Tags are separate
      .reduce((total, tag) => {
          return total + (tag.stateClass === "to-burn" ? 3 : 1); // ✅ Regular Power Tags burn for +3
      }, 0);

  const invertedWeaknessTotal = rollData.weaknessTags
      .filter(tag => !rollData.crewWeaknessTags.some(crewTag => crewTag.id === tag.id)) // ✅ Ensure Crew Weakness Tags are separate
      .reduce((total, tag) => {
          return total + (tag.stateClass === "inverted" ? 1 : 0); // ✅ Inverted Weakness Tags add +1
      }, 0);

  return powerTagsTotal + invertedWeaknessTotal;
}

function calculateCrewPowerTags() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  return rollData.crewPowerTags.reduce((total, tag) => {
      return total + 1; //Crew Power Tags always contribute +1, even if burned
  }, 0);
}

function calculateWeaknessTags() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  const crewWeaknessIds = new Set((rollData.crewWeaknessTags || []).map(tag => tag.id)); // ✅ Ensure Crew Weakness Tags are always excluded

  return rollData.weaknessTags
      .filter(tag => !crewWeaknessIds.has(tag.id))  // ✅ Exclude Crew Weakness Tags Safely
      .reduce((total, tag) => {
          return total + (tag.stateClass === "normal" ? -1 : 0);
      }, 0);
}

function calculateCrewWeaknessTags() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  return rollData.crewWeaknessTags.reduce((total, tag) => {
      return total + (tag.stateClass === "normal" ? -1 : 0); // ✅ Crew Weakness Tags subtract -1 if "normal"
  }, 0);
}

function calculateLoadoutTags() {
  const hud = MistHUD.getInstance();
  const loadoutTags = hud.getSelectedRollData().loadoutTags;

  return loadoutTags.reduce((total, tag) => {
    return total + (tag.stateClass === "to-burn" ? 3 : 1); // +3 if toBurn, +1 if selected
  }, 0);
}

function calculateStoryTags() {
  const hud = MistHUD.getInstance();
  const storyTags = hud.getSelectedRollData().storyTags;

  return storyTags.reduce((total, tag) => {
    if (tag.stateClass === "to-burn") {
      return total + 3; // +3 if toBurn is active and not inverted
    } else if (tag.stateClass === "inverted") {
      return total - 1; // -1 if inverted
    } else {
      return total + 1; // +1 if simply selected
    }
  }, 0);
}

function calculateCharacterStatuses() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  const characterStatusTotal = rollData.statuses.reduce((total, status) => {
      //console.log(`Calculating Status Contribution: Name: ${status.name}, Tier: ${status.tier}, Type: ${status.typeClass}`);
      const contribution = status.typeClass === "positive" ? status.tier : -status.tier;
      //console.log(`Contribution for ${status.name}: ${contribution}`);
      return total + contribution;
  }, 0);

  //console.log("Total Character Status Contribution to Roll:", characterStatusTotal);
  return characterStatusTotal;
}

function calculateSceneStatuses() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  // Use sceneStatuses to calculate scene status contributions
  const sceneStatusTotal = rollData.sceneStatuses.reduce((total, sceneStatus) => {
    return total + (sceneStatus.typeClass === "scene-positive" ? sceneStatus.tier : -sceneStatus.tier);
  }, 0);

  return sceneStatusTotal;
}

function calculateScnTags() {
  const hud = MistHUD.getInstance();
  const scnTags = hud.getSelectedRollData().scnTags;

  return scnTags.reduce((total, tag) => {
      return total + (tag.type === "positive" ? 1 : -1);  // +1 for positive, -1 for negative
  }, 0);
}

function getRollModifier() {
  const hud = MistHUD.getInstance();
  return hud.modifier !== 0 ? hud.modifier : null;
}

function substituteText(text, totalPower) {
  // Replacements with adjustments based on conditions
  text = text.replace("PWR+3", String(Math.max(1, totalPower + 3)));
  text = text.replace("PWR+2", String(Math.max(1, totalPower + 2)));
  text = text.replace("PWR+1", String(Math.max(1, totalPower + 1)));
  text = text.replace("PWRM4", String(Math.max(4, totalPower)));
  text = text.replace("PWRM3", String(Math.max(3, totalPower)));
  text = text.replace("PWRM2", String(Math.max(2, totalPower)));
  text = text.replace("PWR/2", String(Math.max(1, Math.floor(totalPower / 2))));
  text = text.replace("PWR", String(Math.max(1, totalPower)));
  
  return text;
}

// Function to count themebook types
function countThemebookTypes(character) {
  const counts = {
    LogosAmount: 0,
    MythosAmount: 0,
    MistAmount: 0,
    SelfAmount: 0,
    NoiseAmount: 0,
  };

  const themes = character.items.filter(item => item.type === "theme");

  themes.forEach(theme => {
    let realThemebook;
    const themebook = theme.themebook;

    if (themebook?.isThemeKit()) {
      realThemebook = themebook.themebook;
    } else {
      realThemebook = themebook;
    }

    if (!realThemebook) {
      console.warn(`Themebook is null for theme: ${theme.name}`);
      return;
    }

    const category = realThemebook.system.subtype;

    if (category) {
      const key = `${category}Amount`;
      if (counts[key] !== undefined) {
        counts[key]++;
      } else {
        console.warn(`Unknown category "${category}" for themebook ID: ${realThemebook._id}`);
      }
    }
  });

  return counts;
}

export async function rollSpecialMoves(moveName) {
  const move = moveConfig[moveName];
  if (!move) {
    console.error(`Move not found: ${moveName}`);
    return;
  }

  const hud = MistHUD.getInstance();
  const actor = hud.actor;
  if (!actor) {
    ui.notifications.warn("Please select an actor before attempting this special move.");
    return;
  }

  // Detect the active system
  const activeSystem = await detectActiveSystem();

  // Get theme counts for special move rolls
  const { SelfAmount, NoiseAmount, LogosAmount, MythosAmount, MistAmount } = countThemebookTypes(actor);

  // Mapping roll flags to theme counts and types
  const rollMappings = {
    rollLogos: { amount: LogosAmount, type: "Logos" },
    rollMythos: { amount: MythosAmount, type: "Mythos" },
    rollMist: { amount: MistAmount, type: "Mist" },
    rollSelf: { amount: SelfAmount, type: "Self" },
    rollNoise: { amount: NoiseAmount, type: "Noise" }
  };

  // Determine active roll based on move configuration
  const activeRoll = Object.entries(rollMappings).find(([flag]) => move[flag]) || [];
  const { amount: themeCount = 0, type: themeType = null } = activeRoll[1] || {};

  // Calculate additional values
  // const totalWeakness = calculateWeaknessTags();
  const weaknessTags = hud.getSelectedRollData().weaknessTags || [];
  const totalWeakness = calculateWeaknessTags();  
    if (weaknessTags.length > 0) {
        await trackWeaknessAttention(actor, weaknessTags);
    }
  const totalStoryTags = calculateStoryTags();
  const totalLoadoutTags = calculateLoadoutTags();
  const totalCharStatuses = calculateCharacterStatuses();
  const totalSceneStatuses = calculateSceneStatuses();
  const totalScnTags = calculateScnTags();
  const modifier = getRollModifier() || 0;

  // Aggregate total power for the roll calculation
  const totalPower = themeCount + totalWeakness + totalStoryTags + totalLoadoutTags +
    totalCharStatuses + totalSceneStatuses + totalScnTags + modifier;

  // Roll dice
  const rollResults = await rollDice();
  const rollTotal = rollResults.reduce((acc, value) => acc + value, 0) + totalPower;

  // Special outcome flags
  const isDoubleOnes = rollResults.every(r => r === 1);
  const isDoubleSixes = rollResults.every(r => r === 6);

  let outcome;
  let moveEffects = [];
  let diceClass = "default-dice";
  let outcomeClass = "default-outcome";


// Determine outcome
if (isDoubleOnes) {
  outcome = "snakeEyes";
  moveEffects = move.snakeEyesEffects || [];
  diceClass = "double-ones";
  outcomeClass = "outcome-snake-eyes";
} else if (isDoubleSixes) {
  outcome = "boxcars";
  moveEffects = move.boxcarsEffects || [];
  diceClass = "double-sixes";
  outcomeClass = "outcome-boxcars";
} else if (activeSystem === "city-of-mist" && rollTotal >= 12) {
  // Dynamite is optional
  if (move.dynamite) {
      outcome = "dynamite";
      moveEffects = move.dynamiteEffects || [];
      outcomeClass = "outcome-dynamite";
  } else {
      outcome = "success"; // Fallback to success if dynamite isn't defined
      moveEffects = move.successEffects || [];
      outcomeClass = "outcome-success";
  }
} else if (rollTotal >= 10) {
  outcome = "success";
  moveEffects = move.successEffects || [];
  outcomeClass = "outcome-success";
} else if (rollTotal >= 7) {
  outcome = "partial";
  moveEffects = move.partialEffects || [];
  outcomeClass = "outcome-partial";
} else {
  outcome = "fail";
  moveEffects = move.failEffects || [];
  outcomeClass = "outcome-fail";
}


  // Generate chat output
  let outcomeMessage = move[outcome] ? game.i18n.localize(move[outcome]) : "";
  outcomeMessage = substituteText(outcomeMessage, totalPower);

  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));
  const displayRollTotal = rollTotal;

  // Prepare chat data for rendering
  const chatData = {
    moveName: move.name,
    themeCategory: move.themeCategory,
    subtitle: move.subtitle || "",
    subtitleImg: move.subtitleImg || "",
    actorName: actor.name,
    rollResults,
    outcomeMessage,
    themeCount,
    themeType,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData: hud.getSelectedRollData(),
    totalWeakness,
    totalStoryTags,
    totalLoadoutTags,
    totalCharStatuses,
    totalSceneStatuses,
    totalScnTags,
    modifier,
    diceClass,
    outcomeClass
  };

  // Render and send chat message
  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);
  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name },
    flags: {
      "mist-hud": { isCustomRoll: true } // Add this flag
    }
  });

  hud.cleanHUD();
  console.log("[Burn Debug] HUD cleaned after roll.");
}

async function rollCinematicMove(moveName) {
  const move = moveConfig[moveName];
  if (!move) {
    console.error(`Move not found: ${moveName}`);
    return;
  }

  const hud = MistHUD.getInstance();
  const actor = hud.actor;
  if (!actor) {
    ui.notifications.warn("Please select an actor before attempting this cinematic move.");
    return;
  }
  
  // Gather effects if they exist for cinematic moves
  const moveEffects = move.successEffects || move.partialEffects || move.failEffects || [];
  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));

  // Prepare chat data
  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    outcomeMessage: game.i18n.localize(move.success), // Text for the cinematic move
    localizedMoveEffects,  // Include localized effects in the chat message
    tagsData: hud.getSelectedRollData()
    
  };

  // Render the chat template with effects included
  
  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);

  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name },
    flags: {
      "mist-hud": { isCustomRoll: true } // Add this flag
    }
  });

  hud.cleanHUD();
}

// Wrapper function to determine which roll function to use
function executeMove(moveName) {
  const move = moveConfig[moveName];
  if (!move) {
    console.error(`Move "${moveName}" not found in moveConfig.`);
    return;
  }

  // Check for special move roll triggers
  if (move.rollMythos || move.rollLogos || move.rollMythosOS || move.rollSelf || move.rollNoise) {
    rollSpecialMoves(moveName);
  } else if (move.moveType === "cinematic") {
    rollCinematicMove(moveName);
  } else {
    rollMove(moveName);
  }
}

export { executeMove };

// Initialize CityOfMistRolls object
const CityOfMistRolls = {
  rollMove,
  rollSpecialMoves,
  rollCinematicMove,
  executeMove,
  substituteText,
  countThemebookTypes,
  calculatePowerTags,
  calculateWeaknessTags,
  calculateCrewPowerTags,
  calculateCrewWeaknessTags,
  calculateStoryTags,
  calculateLoadoutTags,
  calculateCharacterStatuses,
  calculateScnTags,
  calculateSceneStatuses,
  getRollModifier
};

// Export CityOfMistRolls for potential external usage
export default CityOfMistRolls;

Hooks.once('ready', () => {
  globalThis.CityOfMistRolls = globalThis.CityOfMistRolls || {};
  globalThis.CityOfMistRolls = CityOfMistRolls;
});

Hooks.on('renderChatMessage', (message, html, data) => {
  const isCustomRoll = message.flags["mist-hud"]?.isCustomRoll;

  if (isCustomRoll) {
      // Add a custom class to the chat message
      html.addClass("mist-hud-roll");
  }  

  //Optional: Initialize accordions after the DOM is fully rendered
  setTimeout(() => {
      initializeAccordions();
  }, 300);
});

Hooks.once("ready", () => {
  globalThis.CityOfMistRolls = {
    rollMove,
    rollSpecialMoves,
    rollCinematicMove,
    executeMove,
    substituteText,
    countThemebookTypes,
    calculatePowerTags,
    calculateWeaknessTags,
    calculateCrewPowerTags,
    calculateCrewWeaknessTags,
    calculateStoryTags,
    calculateLoadoutTags,
    calculateCharacterStatuses,
    calculateScnTags,
    calculateSceneStatuses,
    getRollModifier,
  };
});

