// mh-roll.js

import { MistHUD } from './mist-hud.js';
import { moveConfig } from './mh-theme-config.js';
import { initializeAccordions } from './accordion-handler.js';
import { detectActiveSystem } from './mh-settings.js';
import { checkRolls } from "./bonus-utils.js";


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


let toBurnTags = $('.mh-power-tag.toBurn, .mh-power-tag.crew.toBurn').toArray().map(tag => $(tag).data('id'));

async function rollDice() {
  const roll = new Roll("2d6");
  await roll.evaluate();

  if (game.modules.get("dice-so-nice")?.active) {
    await game.dice3d.showForRoll(roll, game.user, true);
  }

  return roll.dice[0].results.map(die => die.result);
}



//Main Roll function
async function rollMove(moveName) {
  //const hud = MistHUD.getInstance();

  const activeToken = canvas.tokens.controlled[0];
  if (!activeToken || !activeToken.actor) {
    ui.notifications.warn("Please select a token first");
    return;
  }
  
  const hud = globalThis.playerHudRegistry.get(activeToken.actor.id);
  if (!hud) {
    ui.notifications.warn("No HUD found for this actor");
    return;
  }

  // Verify the HUD has the needed method
  if (typeof hud.getSelectedRollData !== 'function') {
    ui.notifications.error("Invalid HUD instance. Try selecting your token again.");
    return;
  }
  
  const activeSystem = game.settings.get("city-of-mist", "system");
  const tagsData = hud.getSelectedRollData();

  // **Check if a tag is being burned for a hit**
  const burningTags = tagsData.powerTags.filter(tag => tag.stateClass === "to-burn")
    .concat(tagsData.crewPowerTags.filter(tag => tag.stateClass === "to-burn"))
    .concat(tagsData.loadoutTags.filter(tag => tag.stateClass === "to-burn"));
  
  if (activeSystem === "city-of-mist" && burningTags.length > 0) {
    return await rollBurnForHitCityOfMist(moveName);
  }
  
  if (!hud || !hud.actor) {
    ui.notifications.warn("MistHUD is not ready. Please select an actor.");
    return;
  }

  const actor = hud.actor;
  const move = moveConfig[moveName]; 

  const powerTags = tagsData.powerTags || [];
  const crewPowerTags = tagsData.crewPowerTags || [];
  const loadoutTags = tagsData.loadoutTags || [];
  const weaknessTags = tagsData.weaknessTags || [];
  const crewWeaknessTags = tagsData.crewWeaknessTags || [];
  
  const totalWeakness = calculateWeaknessTags(hud);
    if (weaknessTags.length > 0) {
      await trackWeaknessAttention(actor, weaknessTags);
    }
    if (crewWeaknessTags.length > 0) {
      await trackWeaknessAttentionCrew(actor, crewWeaknessTags);
    }

  const calculatedPower = calculatePowerTags(hud);
  const totalStoryTags = calculateStoryTags(hud);
  const totalLoadoutTags = calculateLoadoutTags(hud);
  const totalCharStatuses = calculateCharacterStatuses(hud);
  const totalSceneStatuses = calculateSceneStatuses(hud);
  const totalScnTags = calculateScnTags(hud);
  const modifier = getRollModifier(hud) || 0;

  // Retrieve the bonuses from the actor flag immediately
  const receivedBonuses = actor.getFlag('mist-hud', 'received-bonuses') || {};

  // Build bonus messages for the chat roll
  const bonusMessages = [];
  for (const giverId in receivedBonuses) {
    const bonus = receivedBonuses[giverId];
    const giverActor = game.actors.get(giverId);
    bonusMessages.push({
      type: bonus.type,
      amount: bonus.amount,
      giverName: giverActor ? giverActor.name : "Unknown"
    });
  }

  // Notify each bonus giver that their bonus was used
  for (const giverId in receivedBonuses) {
    const bonusData = receivedBonuses[giverId];
    game.socket.emit('module.mist-hud', {
      type: 'notify-use',
      actorId: giverId,
      targetId: actor.id,
      bonusType: bonusData.type,
      amount: bonusData.amount
    });
  }
  // Calculate totalBonus as before
  const activeBonuses = Object.values(receivedBonuses);
  const helpBonuses = activeBonuses.filter(bonus => bonus.type === 'help')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const hurtBonuses = activeBonuses.filter(bonus => bonus.type === 'hurt')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const totalBonus = helpBonuses - hurtBonuses;

  const totalCrewPowerTags = calculateCrewPowerTags(hud);
  const totalCrewWeaknessTags = calculateCrewWeaknessTags(hud);

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

  if (hud._state === Application.RENDER_STATES.CLOSED) {
    console.warn("MistHUD is closed. Attempting to reopen.");
    await hud.render(true);
  }

  try {
    await hud.render(true);
    setTimeout(() => {
      if (hud._element) {
        hud.minimize().catch(err => console.error("Error minimizing HUD:", err));
      }
    }, 100);
  } catch (error) {
    console.error("Error minimizing HUD before roll:", error);
  }
  
  const rollResults = await rollDice();
  const rollTotal = rollResults.reduce((acc, value) => acc + value, 0) + totalPower + totalBonus;

  // Only check the "Roll is Dynamite!" toggle if the active system is City of Mist
  let rollIsDynamiteForced = false;
  if (activeSystem === "city-of-mist" && game.settings.settings.has("mist-hud.rollIsDynamite")) {
    rollIsDynamiteForced = game.settings.get("mist-hud", "rollIsDynamite");
    await game.settings.set("mist-hud", "rollIsDynamite", false);
  }

  // Retrieve stored dynamite move flag (for always-dynamite moves)
  const storedDynamiteMoves = (await actor.getFlag("mist-hud", "dynamiteMoves")) || [];
  const storedDynamiteEnabled = storedDynamiteMoves.includes(moveName);

  // Determine if the move should roll as Dynamite via improvements, tags, stored flag, or toggle.
  let dynamiteEnabled = rollIsDynamiteForced || storedDynamiteEnabled || checkRolls(actor, move, hud);

  let outcome;
  let moveEffects = [];
  let diceClass = "default-dice";
  let outcomeClass = "default-outcome";
  const isDoubleOnes = rollResults.every(r => r === 1);
  const isDoubleSixes = rollResults.every(r => r === 6);

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
    console.error(`Unknown system: ${activeSystem}`);
    return;
  }

  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, totalPower);
  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));
  const displayRollTotal = (dynamiteEnabled && rollTotal >= 12) ? `<span>${rollTotal}</span><span class="firecracker-emoji">🧨</span>` : rollTotal;

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
    totalBonus,
    modifier,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData,
    storyTags: tagsData.storyTags,
    statuses: tagsData.statuses,
    trackedEffects: move.trackedEffects || null,
    diceClass,
    outcomeClass,
    helpHurtMessages: bonusMessages
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
  await burnCrispyTags(powerTags);
  await burnCrispyTags(crewPowerTags);
  await burnCrispyTags(loadoutTags);
  hud.cleanHUD(chatData.tagsData);
}

async function rollBurnForHitCityOfMist(moveName, hud) {
   
  if (!hud || !hud.actor) {
    ui.notifications.warn("MistHUD is not ready. Please select an actor.");
    return;
  }
  const actor = hud.actor;
  const move = moveConfig[moveName];
  const activeSystem = game.settings.get("city-of-mist", "system");

  // Retrieve the bonuses from the actor flag immediately
  const receivedBonuses = actor.getFlag('mist-hud', 'received-bonuses') || {};

  // Build bonus messages for the chat roll
  const bonusMessages = [];
  for (const giverId in receivedBonuses) {
    const bonus = receivedBonuses[giverId];
    const giverActor = game.actors.get(giverId);
    bonusMessages.push({
      type: bonus.type,
      amount: bonus.amount,
      giverName: giverActor ? giverActor.name : "Unknown"
    });
  }

  // Notify each bonus giver that their bonus was used
  for (const giverId in receivedBonuses) {
    const bonusData = receivedBonuses[giverId];
    game.socket.emit('module.mist-hud', {
      type: 'notify-use',
      actorId: giverId,
      targetId: actor.id,
      bonusType: bonusData.type,
      amount: bonusData.amount
    });
  }
  // Calculate totalBonus as before
  const activeBonuses = Object.values(receivedBonuses);
  const helpBonuses = activeBonuses.filter(bonus => bonus.type === 'help')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const hurtBonuses = activeBonuses.filter(bonus => bonus.type === 'hurt')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const totalBonus = helpBonuses - hurtBonuses;



  // Instead of a fixed bonus of 3, we want to use +1 if a crew tag is marked to burn.
  // Look up in the HUD's DOM: if any crew power tag has the "toBurn" class, then use 1.
  const crewBurnTagExists = hud.element.find('.mh-power-tag.Crew.toBurn').length > 0;
  const burnBasePower = crewBurnTagExists ? 1 : 3;
  const fixedRoll = 7;

  // Get status adjustments.
  const totalCharStatuses = calculateCharacterStatuses(hud);
  const totalSceneStatuses = calculateSceneStatuses(hud);
  const totalScnTags = calculateScnTags(hud);
  const modifier = getRollModifier(hud) || 0;

  // Calculate final total.
  const finalTotal = burnBasePower + fixedRoll + totalCharStatuses + totalSceneStatuses + totalScnTags + totalBonus + modifier;

// Check if the "Roll is Dynamite!" toggle is ON
const rollIsDynamiteForced = game.settings.get("mist-hud", "rollIsDynamite");

// Retrieve stored dynamite move flag (for always-dynamite moves)
const storedDynamiteEnabled = (await actor.getFlag("mist-hud", "dynamiteMoves") || []).includes(moveName);

// Check for improvements/tags
const improvementDynamite = checkRolls(actor, move, hud);

// Combine all conditions
const dynamiteEnabled = rollIsDynamiteForced || storedDynamiteEnabled || improvementDynamite;


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
  
  // Prepare display total.
  const displayRollTotal = (dynamiteEnabled && finalTotal >= 12) ? `<span>${finalTotal}</span><span class="firecracker-emoji">🧨</span>`: finalTotal;

  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, burnBasePower);

  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));

  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    subtitle: move.subtitle || "",
    rollResults: [fixedRoll],
    outcomeMessage,
    calculatedPower: burnBasePower,
    totalCrewPowerTags: 0,
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
    totalBonus,
    helpHurtMessages: bonusMessages,
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
  const rollData = hud.getSelectedRollData();
  await burnCrispyTags(rollData.powerTags);
  await burnCrispyTags(rollData.crewPowerTags);
  await burnCrispyTags(rollData.loadoutTags);

  // Clean up the HUD.
  hud.cleanHUD(rollData);
}

async function burnCrispyTags(tagsArray) {
  //const hud = MistHUD.getInstance();
  if (!hud || !hud.actor) return;

  const mainActor = hud.actor;
  for (const tag of tagsArray) {
    if (tag.crispy) {
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

              return;
          }
      }
  }
}

async function trackWeaknessAttentionCrew(actor, weaknessTags) {
  // Get non-GM owners from the passed actor
  const nonGMOwners = game.users.filter(user =>
    !user.isGM && actor.testUserPermission(user, "OWNER")
  );
  
  // Filter crew actors that the actor has permission over
  const ownedCrews = game.actors.contents.filter(a =>
    a.type === "crew" &&
    nonGMOwners.some(user => a.testUserPermission(user, "OWNER"))
  );
  
  // Iterate over each crew actor
  for (const crewActor of ownedCrews) {
    // Get all theme items on this crew actor
    const themes = crewActor.items.filter(item => item.type === "theme");
    // Get all weakness tags from this crew actor (assuming they have the same structure)
    const allWeaknessTags = crewActor.items.filter(item => item.type === "tag" && item.system.subtype === "weakness");
    
    for (const theme of themes) {
      // Find weakness tags that belong to this theme (assuming the theme ID is stored in tag.system.theme_id)
      const themeWeaknessTags = allWeaknessTags.filter(tag => tag.system.theme_id === theme._id);
      
      // Iterate over the provided weaknessTags (from your roll, for example)
      for (const weaknessTag of weaknessTags) {
        // If a matching tag exists and the weakness isn't inverted
        if (themeWeaknessTags.some(tag => tag.name === weaknessTag.tagName) && weaknessTag.stateClass !== "inverted") {
          // Prepare a copy of the theme's attention array (or default to three slots)
          let attention = Array.isArray(theme.system.attention) ? [...theme.system.attention] : [0, 0, 0];
          let unspentUpgrades = theme.system.unspent_upgrades || 0;
          let updated = false;
          
          // Find the first empty slot (0) and mark it as filled (1)
          for (let i = 0; i < attention.length; i++) {
            if (attention[i] === 0) {
              attention[i] = 1;
              updated = true;
              break;
            }
          }
          
          // If all attention slots are already filled, reset and add one upgrade point
          if (attention.every(a => a === 1)) {
            attention = [0, 0, 0];
            unspentUpgrades += 1;
          }
          
          // Update the theme on the crew actor
          await theme.update({
            "system.attention": attention,
            "system.unspent_upgrades": unspentUpgrades
          });
          
          return;
        }
      }
    }
  }
}

function calculatePowerTags(hud) {
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

function calculateCrewPowerTags(hud) {
  const rollData = hud.getSelectedRollData();

  return rollData.crewPowerTags.reduce((total, tag) => {
      return total + 1; //Crew Power Tags always contribute +1, even if burned
  }, 0);
}

function calculateWeaknessTags(hud) {
  const rollData = hud.getSelectedRollData();

  const crewWeaknessIds = new Set((rollData.crewWeaknessTags || []).map(tag => tag.id)); // ✅ Ensure Crew Weakness Tags are always excluded

  return rollData.weaknessTags
      .filter(tag => !crewWeaknessIds.has(tag.id))  // ✅ Exclude Crew Weakness Tags Safely
      .reduce((total, tag) => {
          return total + (tag.stateClass === "normal" ? -1 : 0);
      }, 0);
}

function calculateCrewWeaknessTags(hud) {
  const rollData = hud.getSelectedRollData();

  return rollData.crewWeaknessTags.reduce((total, tag) => {
      return total + (tag.stateClass === "normal" ? -1 : 0); // ✅ Crew Weakness Tags subtract -1 if "normal"
  }, 0);
}

function calculateLoadoutTags(hud) {
  const loadoutTags = hud.getSelectedRollData().loadoutTags;

  return loadoutTags.reduce((total, tag) => {
    return total + (tag.stateClass === "to-burn" ? 3 : 1); // +3 if toBurn, +1 if selected
  }, 0);
}

function calculateStoryTags(hud) {
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

function calculateCharacterStatuses(hud) {
  const rollData = hud.getSelectedRollData();

  const characterStatusTotal = rollData.statuses.reduce((total, status) => {
        const contribution = status.typeClass === "positive" ? status.tier : -status.tier;
        return total + contribution;
  }, 0);

  return characterStatusTotal;
}

function calculateSceneStatuses(hud) {
  const rollData = hud.getSelectedRollData();

  // Use sceneStatuses to calculate scene status contributions
  const sceneStatusTotal = rollData.sceneStatuses.reduce((total, sceneStatus) => {
    return total + (sceneStatus.typeClass === "scene-positive" ? sceneStatus.tier : -sceneStatus.tier);
  }, 0);

  return sceneStatusTotal;
}

function calculateScnTags(hud) {
  const scnTags = hud.getSelectedRollData().scnTags;

  return scnTags.reduce((total, tag) => {
      return total + (tag.type === "positive" ? 1 : -1);  // +1 for positive, -1 for negative
  }, 0);
}

function getRollModifier(hud) {
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
    // Add LoadoutAmount to the object if you want to count it
    LoadoutAmount: 0
  };

  // Filter out the __LOADOUT__ theme before processing
  const themes = character.items.filter(item => 
    item.type === "theme" && item.name !== "__LOADOUT__"
  );

  themes.forEach(theme => {
    let realThemebook;
    const themebook = theme.themebook;

    if (themebook?.isThemeKit && themebook.isThemeKit()) {
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
        // Instead of warning, we can log at a lower level since we're filtering __LOADOUT__
        console.debug(`Category "${category}" not counted for themebook ID: ${realThemebook._id}`);
      }
    }
  });

  return counts;
}

export async function rollSpecialMoves(moveName, hud) {
  const move = moveConfig[moveName];
  if (!move) {
    console.error(`Move not found: ${moveName}`);
    return;
  }

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
  const totalWeakness = calculateWeaknessTags(hud);  
    if (weaknessTags.length > 0) {
        await trackWeaknessAttention(actor, weaknessTags);
    }
  const totalStoryTags = calculateStoryTags(hud);
  const totalLoadoutTags = calculateLoadoutTags(hud);
  const totalCharStatuses = calculateCharacterStatuses(hud);
  const totalSceneStatuses = calculateSceneStatuses(hud);
  const totalScnTags = calculateScnTags(hud);
  const modifier = getRollModifier(hud) || 0;

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
}

async function rollCinematicMove(moveName, hud) {
  const move = moveConfig[moveName];
  if (!move) {
    console.error(`Move not found: ${moveName}`);
    return;
  }

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

  const activeToken = canvas.tokens.controlled[0];
  if (!activeToken || !activeToken.actor) {
    ui.notifications.warn("Select a token to make this move");
    return;
  }
  
  console.log("Token for roll:", activeToken);
  console.log("Token actor:", activeToken.actor);
  
  const activeHud = globalThis.playerHudRegistry.get(activeToken.actor.id);
  console.log("HUD from registry:", activeHud);
  
  if (!activeHud) {
    // If we reach here, the HUD isn't being registered properly
    console.warn("No HUD found in registry for actor:", activeToken.actor.id);
    
    // Create a HUD on-demand if one doesn't exist
    const newHud = new MistHUD();
    newHud.setActor(activeToken.actor);
    console.log("Created new HUD:", newHud);
    
    // Try again with this new HUD
    const retryHud = globalThis.playerHudRegistry.get(activeToken.actor.id);
    if (retryHud) {
      // Now we have a HUD, so continue with it
      if (move.rollMythos || move.rollLogos || move.rollMythosOS || move.rollSelf || move.rollNoise) {
        rollSpecialMoves(moveName, retryHud);
      } else if (move.moveType === "cinematic") {
        rollCinematicMove(moveName, retryHud);
      } else {
        rollMove(moveName, retryHud);
      }
      return;
    }
    
    ui.notifications.warn("No HUD found for the selected character");
    return;
  }

  // Call roll functions
  if (move.rollMythos || move.rollLogos || move.rollMythosOS || move.rollSelf || move.rollNoise) {
    rollSpecialMoves(moveName, activeHud);
  } else if (move.moveType === "cinematic") {
    rollCinematicMove(moveName, activeHud);
  } else {
    rollMove(moveName, activeHud);
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

