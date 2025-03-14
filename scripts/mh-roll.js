// mh-roll.js

import { MistHUD } from './mist-hud.js';
import { moveConfig } from './mh-theme-config.js';
import { initializeAccordions } from './accordion-handler.js';
import { detectActiveSystem } from './mh-settings.js';
import { checkRolls } from "./bonus-utils.js";

// Debug mode setting
//let debug = false;

// Hooks.once("init", () => {
//   game.settings.register("mist-hud", "debugMode", {
//     name: "Enable Debug Mode",
//     hint: "Toggle debug logging for Mist HUD rolls.",
//     scope: "client",
//     config: true,
//     type: Boolean,
//     default: false,
//     onChange: value => debug = value
//   });
//   debug = game.settings.get("mist-hud", "debugMode");
// });

//let toBurnTags = $('.mh-power-tag.toBurn, .mh-power-tag.crew.toBurn').toArray().map(tag => $(tag).data('id'));


// ====================
// ROLL FUNCTIONS
// ====================

async function rollDice() {
  const roll = new Roll("2d6");
  await roll.evaluate();

  if (game.modules.get("dice-so-nice")?.active) {
    await game.dice3d.showForRoll(roll, game.user, true);
  }

  return roll.dice[0].results.map(die => die.result);
}

async function rollMove(moveName) {
  // Validate token selection and get HUD
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

  // Get actor, move, and system info
  const actor = hud.actor;
  const move = moveConfig[moveName];
  const activeSystem = game.settings.get("city-of-mist", "system");
  
  // IMPORTANT: Get all the roll data ONCE at the beginning and store it
  const tagsData = hud.getSelectedRollData();
  
  // Check if we should use burn-for-hit logic (City of Mist specific)
  const burningTags = tagsData.powerTags.filter(tag => tag.stateClass === "to-burn")
    .concat(tagsData.crewPowerTags.filter(tag => tag.stateClass === "to-burn"))
    .concat(tagsData.loadoutTags.filter(tag => tag.stateClass === "to-burn"));
  
  if (activeSystem === "city-of-mist" && burningTags.length > 0) {
    return await rollBurnForHitCityOfMist(moveName);
  }

  // Calculate power components using helper functions
  const normalPowerTags = calculatePowerTags(hud);
  const invertedWeaknessTags = calculateInvertedWeaknessTags(hud);
  
  // Combine them for calculatedPower
  const calculatedPower = normalPowerTags + invertedWeaknessTags;
  
  // Calculate other components
  const totalCrewPowerTags = calculateCrewPowerTags(hud);
  const totalWeakness = calculateWeaknessTags(hud);
  const totalCrewWeaknessTags = calculateCrewWeaknessTags(hud);
  const totalStoryTags = calculateStoryTags(tagsData);
  const totalLoadoutTags = calculateLoadoutTags(tagsData);
  const totalCharStatuses = calculateCharacterStatuses(tagsData);
  const totalSceneStatuses = calculateSceneStatuses(tagsData);
  const totalScnTags = calculateScnTags(tagsData);
  const modifier = getRollModifier(hud) || 0;
  
  // Process weakness attention tracking
  if (tagsData.weaknessTags.some(tag => tag.stateClass === "normal")) {
    await trackWeaknessAttention(actor, tagsData.weaknessTags.filter(tag => tag.stateClass === "normal"));
  }
  if (tagsData.crewWeaknessTags.some(tag => tag.stateClass === "normal")) {
    await trackWeaknessAttentionCrew(actor, tagsData.crewWeaknessTags.filter(tag => tag.stateClass === "normal"));
  }

  // Calculate bonuses
  const receivedBonuses = actor.getFlag('mist-hud', 'received-bonuses') || {};
  const bonusMessages = [];
  
  for (const giverId in receivedBonuses) {
    const bonus = receivedBonuses[giverId];
    const giverActor = game.actors.get(giverId);
    if (giverActor) {
      bonusMessages.push({
        type: bonus.type,
        amount: bonus.amount,
        giverName: giverActor.name
      });
    }
  }
  
  const activeBonuses = Object.values(receivedBonuses);
  const helpBonuses = activeBonuses.filter(bonus => bonus.type === 'help')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const hurtBonuses = activeBonuses.filter(bonus => bonus.type === 'hurt')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const totalBonus = helpBonuses - hurtBonuses;
  
  // Calculate NPC influences
  const npcInfluences = getNpcInfluences();
  const totalNpcInfluence = calculateNpcInfluenceTotal(npcInfluences);
  
  const influenceMessages = npcInfluences.map(infl => ({
    npcName: infl.tokenName || infl.npcName || "Unknown NPC",
    totalInfluence: Number(infl.totalInfluence) || 0,
    tagInfluence: Number(infl.tagInfluence) || 0,
    statusInfluence: Number(infl.statusInfluence) || 0
  }));
  
  // Calculate total power BEFORE rendering the HUD
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
  
  // Now it's safe to render/minimize the HUD
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
  
  // Roll the dice
  const rollResults = await rollDice();
  const diceTotal = rollResults.reduce((acc, value) => acc + value, 0);
  const rollTotal = diceTotal + totalPower + totalBonus + totalNpcInfluence;
  
  // Detailed logging
  console.log("Roll components:");
  console.log(`- Dice total: ${diceTotal}`);
  console.log(`- Total power: ${totalPower}`);
  console.log(`- Regular power tags: ${normalPowerTags}`);
  console.log(`- Inverted weakness tags: ${invertedWeaknessTags}`);  
  console.log(`- Combined power (tags+inverted): ${calculatedPower}`);
  console.log(`- Total weakness: ${totalWeakness}`);
  console.log(`- Total bonus: ${totalBonus}`);
  console.log(`- Total story tags: ${totalStoryTags}`);
  console.log(`- Total NPC influence: ${totalNpcInfluence}`);
  console.log(`Final roll total: ${rollTotal}`);
  
  // Check for dynamite conditions
  let rollIsDynamiteForced = false;
  if (activeSystem === "city-of-mist" && game.settings.settings.has("mist-hud.rollIsDynamite")) {
    rollIsDynamiteForced = game.settings.get("mist-hud", "rollIsDynamite");
    await game.settings.set("mist-hud", "rollIsDynamite", false);
  }

  // Retrieve stored dynamite move flag
  const storedDynamiteMoves = (await actor.getFlag("mist-hud", "dynamiteMoves")) || [];
  const storedDynamiteEnabled = storedDynamiteMoves.includes(moveName);

  // Determine if the move should roll as Dynamite
  const dynamiteEnabled = rollIsDynamiteForced || storedDynamiteEnabled || checkRolls(actor, move, hud);

  // Determine roll outcome
  let outcome;
  let moveEffects = [];
  let diceClass = "default-dice";
  let mainDiceClass = "default-d6";
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
      diceClass = "double-sixes"; // For dynamite rolls
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
  } else {
    console.error(`Unknown system: ${activeSystem}`);
    return;
  }

  // Format output strings
  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, totalPower);
  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));
  const displayRollTotal = (dynamiteEnabled && rollTotal >= 12) ? 
    `<span>${rollTotal}</span><span class="firecracker-emoji">🧨</span>` : rollTotal;

  // Format roll results
  const formattedRollResults = rollResults.map(value => ({
    value: value,
    mainDiceClass: mainDiceClass
  }));

  // Prepare the chat data
  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    subtitle: move.subtitle || "",
    rollResults: formattedRollResults,
    outcomeMessage,
    calculatedPower,
    normalPowerTags,
    invertedWeaknessTags,
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
    helpHurtMessages: bonusMessages,
    totalNpcInfluence,
    npcInfluences: influenceMessages,
    hasNpcInfluence: influenceMessages.length > 0,
  };

  // Send the chat message
  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);
  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name },
    flags: {
      "mist-hud": { isCustomRoll: true }
    }
  });

  // Clean up
  await actor.unsetFlag('mist-hud', 'received-bonuses');
  hud.render(true);
  
  // Use tagsData for burning crispy tags
  await burnCrispyTags(tagsData.powerTags);
  await burnCrispyTags(tagsData.crewPowerTags);
  await burnCrispyTags(tagsData.loadoutTags);
  
  // Clean up the HUD
  hud.cleanHUD(chatData.tagsData);
}

async function rollBurnForHitCityOfMist(moveName) {
  // Note: This function uses a fixed roll of 7 instead of rolling dice
  
  // Validate token selection and get HUD
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

  // Get actor, move, and system info
  const actor = hud.actor;
  const move = moveConfig[moveName];
  const activeSystem = game.settings.get("city-of-mist", "system");
  
  // IMPORTANT: Get all the roll data ONCE at the beginning
  const tagsData = hud.getSelectedRollData();

  // Calculate bonuses
  const receivedBonuses = actor.getFlag('mist-hud', 'received-bonuses') || {};
  const bonusMessages = [];
  
  for (const giverId in receivedBonuses) {
    const bonus = receivedBonuses[giverId];
    const giverActor = game.actors.get(giverId);
    if (giverActor) {
      bonusMessages.push({
        type: bonus.type,
        amount: bonus.amount,
        giverName: giverActor.name
      });
    }
  }
  
  const activeBonuses = Object.values(receivedBonuses);
  const helpBonuses = activeBonuses.filter(bonus => bonus.type === 'help')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const hurtBonuses = activeBonuses.filter(bonus => bonus.type === 'hurt')
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  const totalBonus = helpBonuses - hurtBonuses;

  // Calculate NPC influences
  const npcInfluences = getNpcInfluences();
  const totalNpcInfluence = calculateNpcInfluenceTotal(npcInfluences);
  
  const influenceMessages = npcInfluences.map(infl => ({
    npcName: infl.tokenName || infl.npcName || "Unknown NPC",
    totalInfluence: Number(infl.totalInfluence) || 0,
    tagInfluence: Number(infl.tagInfluence) || 0,
    statusInfluence: Number(infl.statusInfluence) || 0
  }));

  // Instead of a fixed bonus of 3, use +1 if a crew tag is marked to burn
  // Look up in the tagsData directly (not the DOM)
  const hasBurnCrewTag = tagsData.crewPowerTags.some(tag => tag.stateClass === "to-burn");
  const burnBasePower = hasBurnCrewTag ? 1 : 3;
  const fixedRoll = 7;

  // Get status adjustments
  const totalCharStatuses = calculateCharacterStatuses(hud);
  const totalSceneStatuses = calculateSceneStatuses(hud);
  const totalScnTags = calculateScnTags(hud);
  const modifier = getRollModifier(hud) || 0;

  // Calculate final total with NPC influence included
  const finalTotal = burnBasePower + fixedRoll + totalCharStatuses + totalSceneStatuses + 
                     totalScnTags + totalBonus + modifier + totalNpcInfluence;
  
  // Now it's safe to render/minimize the HUD
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
  
  // Detailed logging
  console.log("Burn-for-hit roll components:");
  console.log(`- Fixed roll: ${fixedRoll}`);
  console.log(`- Burn base power: ${burnBasePower}`);
  console.log(`- Character statuses: ${totalCharStatuses}`);
  console.log(`- Scene statuses: ${totalSceneStatuses}`);
  console.log(`- Scene tags: ${totalScnTags}`);
  console.log(`- Bonus: ${totalBonus}`);
  console.log(`- Modifier: ${modifier}`);
  console.log(`- Total NPC influence: ${totalNpcInfluence}`);
  console.log(`Final roll total: ${finalTotal}`);

  // Check for dynamite conditions
  let rollIsDynamiteForced = false;
  if (activeSystem === "city-of-mist" && game.settings.settings.has("mist-hud.rollIsDynamite")) {
    rollIsDynamiteForced = game.settings.get("mist-hud", "rollIsDynamite");
    await game.settings.set("mist-hud", "rollIsDynamite", false);
  }

  // Retrieve stored dynamite move flag
  const storedDynamiteMoves = (await actor.getFlag("mist-hud", "dynamiteMoves")) || [];
  const storedDynamiteEnabled = storedDynamiteMoves.includes(moveName);

  // Determine if the move should roll as Dynamite
  const dynamiteEnabled = rollIsDynamiteForced || storedDynamiteEnabled || checkRolls(actor, move, hud);

  // Determine outcome
  let outcome;
  let moveEffects;
  let mainDiceClass = "burn-d6";
  let diceClass = "default-dice";
  let outcomeClass;

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
  
  // Format output strings
  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, burnBasePower);
  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));
  const displayRollTotal = (dynamiteEnabled && finalTotal >= 12) ? 
    `<span>${finalTotal}</span><span class="firecracker-emoji">🧨</span>` : finalTotal;

  // Create a fixed roll result for display
  const formattedRollResults = [{
    value: fixedRoll,
    mainDiceClass: mainDiceClass
  }];

  // Prepare the chat data
  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    subtitle: move.subtitle || "",
    rollResults: formattedRollResults,
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
    tagsData,
    statuses: tagsData.statuses,
    trackedEffects: (outcome !== "fail" && Array.isArray(move.trackedEffects) && move.trackedEffects.length > 0)
                    ? move.trackedEffects
                    : null,
    diceClass,
    outcomeClass,
    totalNpcInfluence,
    npcInfluences: influenceMessages,
    hasNpcInfluence: influenceMessages.length > 0
  };

  // Send the chat message
  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);
  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name },
    flags: {
      "mist-hud": { isCustomRoll: true }
    }
  });

  // Clean up
  await actor.unsetFlag('mist-hud', 'received-bonuses');
  hud.render(true);
  
  // Use tagsData for burning crispy tags
  await burnCrispyTags(tagsData.powerTags);
  await burnCrispyTags(tagsData.crewPowerTags);
  await burnCrispyTags(tagsData.loadoutTags);
  
  // Clean up the HUD
  hud.cleanHUD(tagsData);
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

  // IMPORTANT: Get all the roll data ONCE at the beginning
  const tagsData = hud.getSelectedRollData();

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

  const totalWeakness = calculateWeaknessTags(hud);
  
  const invertedWeaknessTags = calculateInvertedWeaknessTags(hud);
  
  // Process weakness attention if needed
  if (tagsData.weaknessTags.some(tag => tag.stateClass === "normal")) {
    await trackWeaknessAttention(actor, tagsData.weaknessTags.filter(tag => tag.stateClass === "normal"));
  }

  // Calculate other components
  const totalStoryTags = calculateStoryTags(hud);
  const totalLoadoutTags = calculateLoadoutTags(hud);
  const totalCharStatuses = calculateCharacterStatuses(hud);
  const totalSceneStatuses = calculateSceneStatuses(hud);
  const totalScnTags = calculateScnTags(hud);
  const modifier = getRollModifier(hud) || 0;

  // Get NPC influence data
  console.log("Retrieving NPC influences for special move roll...");
  const npcInfluences = getNpcInfluences();
  const totalNpcInfluence = calculateNpcInfluenceTotal(npcInfluences);
  
  const influenceMessages = npcInfluences.map(infl => ({
    npcName: infl.tokenName || infl.npcName || "Unknown NPC",
    totalInfluence: Number(infl.totalInfluence) || 0,
    tagInfluence: Number(infl.tagInfluence) || 0,
    statusInfluence: Number(infl.statusInfluence) || 0
  }));

  // Aggregate total power for the roll calculation (including NPC influence)
  const totalPower = themeCount + invertedWeaknessTags + totalWeakness + totalStoryTags + 
                     totalLoadoutTags + totalCharStatuses + totalSceneStatuses + 
                     totalScnTags + modifier + totalNpcInfluence;
  
  // Render/minimize the HUD
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

  // Roll dice
  const rollResults = await rollDice();
  const diceTotal = rollResults.reduce((acc, value) => acc + value, 0);
  const rollTotal = diceTotal + totalPower;
  
  // Log components
  console.log("Special move roll components:");
  console.log(`- Dice total: ${diceTotal}`);
  console.log(`- Theme count (${themeType}): ${themeCount}`);
  console.log(`- Inverted weakness: ${invertedWeaknessTags}`);
  console.log(`- Normal weakness: ${totalWeakness}`);
  console.log(`- Story tags: ${totalStoryTags}`);
  console.log(`- Loadout tags: ${totalLoadoutTags}`);
  console.log(`- Character statuses: ${totalCharStatuses}`);
  console.log(`- Scene statuses: ${totalSceneStatuses}`);
  console.log(`- Scene tags: ${totalScnTags}`);
  console.log(`- Modifier: ${modifier}`);
  console.log(`- NPC influence: ${totalNpcInfluence}`);
  console.log(`Final roll total: ${rollTotal}`);

  // Special outcome flags
  const isDoubleOnes = rollResults.every(r => r === 1);
  const isDoubleSixes = rollResults.every(r => r === 6);

  let outcome;
  let moveEffects = [];
  let diceClass = "default-dice";
  let mainDiceClass = "default-d6";
  let outcomeClass = "default-outcome";

  // Check for dynamite conditions
  let dynamiteEnabled = false;
  if (activeSystem === "city-of-mist") {
    // Check if the "Roll is Dynamite!" toggle is ON
    let rollIsDynamiteForced = false;
    if (game.settings.settings.has("mist-hud.rollIsDynamite")) {
      rollIsDynamiteForced = game.settings.get("mist-hud", "rollIsDynamite");
      await game.settings.set("mist-hud", "rollIsDynamite", false);
    }

    // Retrieve stored dynamite move flag
    const storedDynamiteMoves = (await actor.getFlag("mist-hud", "dynamiteMoves")) || [];
    const storedDynamiteEnabled = storedDynamiteMoves.includes(moveName);

    // Use checkRolls to detect specific tag/move combinations
    dynamiteEnabled = rollIsDynamiteForced || storedDynamiteEnabled || checkRolls(actor, move, hud);
  }

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
  } else if (activeSystem === "city-of-mist" && rollTotal >= 12 && dynamiteEnabled) {
    // Dynamite with proper conditions
    outcome = "dynamite";
    moveEffects = move.dynamiteEffects || [];
    diceClass = "double-sixes"; // For dynamite, use double-sixes class
    outcomeClass = "outcome-dynamite";
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
  
  // Add dynamite emoji to display if appropriate
  const displayRollTotal = (dynamiteEnabled && rollTotal >= 12) ? 
    `<span>${rollTotal}</span><span class="firecracker-emoji">🧨</span>` : rollTotal;

  // Format roll results with the appropriate dice class
  const formattedRollResults = rollResults.map(value => ({
    value: value,
    mainDiceClass: mainDiceClass
  }));
  
  // Prepare chat data for rendering
  const chatData = {
    moveName: move.name,
    themeCategory: move.themeCategory,
    subtitle: move.subtitle || "",
    subtitleImg: move.subtitleImg || "",
    actorName: actor.name,
    rollResults: formattedRollResults,
    diceClass, // Keep for backward compatibility
    outcomeMessage,
    themeCount,
    themeType,
    calculatedPower: 0, // For display consistency
    invertedWeaknessTags,
    totalWeakness,
    totalStoryTags,
    totalLoadoutTags,
    totalCharStatuses,
    totalSceneStatuses,
    totalScnTags,
    modifier,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData,
    outcomeClass,
    totalNpcInfluence,
    npcInfluences: influenceMessages,
    hasNpcInfluence: influenceMessages.length > 0
  };

  // Render and send chat message
  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);
  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name },
    flags: {
      "mist-hud": { isCustomRoll: true }
    }
  });

  // Clean up
  await burnCrispyTags(tagsData.powerTags);
  await burnCrispyTags(tagsData.crewPowerTags);
  await burnCrispyTags(tagsData.loadoutTags);
  hud.cleanHUD(tagsData);
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
  
  // Get ONCE all the data we need at the beginning
  const tagsData = hud.getSelectedRollData();
  
  // Get NPC influence data for display consistency
  console.log("Retrieving NPC influences for cinematic move...");
  const npcInfluences = getNpcInfluences();
  const totalNpcInfluence = calculateNpcInfluenceTotal(npcInfluences);
  
  const influenceMessages = npcInfluences.map(infl => ({
    npcName: infl.tokenName || infl.npcName || "Unknown NPC",
    totalInfluence: Number(infl.totalInfluence) || 0,
    tagInfluence: Number(infl.tagInfluence) || 0,
    statusInfluence: Number(infl.statusInfluence) || 0
  }));
  
  // Render/minimize the HUD for consistency with other roll types
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
  
  // Gather effects if they exist for cinematic moves
  const moveEffects = move.successEffects || move.partialEffects || move.failEffects || [];
  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));

  // Prepare chat data - although cinematic moves don't need calculations, include all fields for template compatibility
  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    subtitle: move.subtitle || "",
    outcomeMessage: game.i18n.localize(move.success), // Text for the cinematic move
    rollResults: [], // No dice results for cinematic moves
    calculatedPower: 0,
    totalCrewPowerTags: 0,
    totalCrewWeaknessTags: 0,
    totalLoadoutTags: 0,
    totalWeakness: 0,
    invertedWeaknessTags: 0,
    totalStoryTags: 0,
    totalScnTags: 0,
    totalCharStatuses: 0,
    totalSceneStatuses: 0,
    modifier: 0,
    localizedMoveEffects,
    tagsData,
    totalNpcInfluence,
    npcInfluences: influenceMessages,
    hasNpcInfluence: influenceMessages.length > 0,
    isCinematic: true // Special flag to help the template handle cinematic moves differently
  };

  // Render the chat template with effects included
  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);

  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name },
    flags: {
      "mist-hud": { isCustomRoll: true }
    }
  });

  hud.cleanHUD(tagsData);
}

// ====================
// CALCULATE FUNCTIONS
// ====================

function getNpcInfluences() {
  // Access the global cache
  const influences = globalThis.activeNpcInfluences || {};
  
  // Debug log the full influence cache
  console.log("Full influence cache:", influences);
  
  // Get all tokens in the current scene
  const currentSceneTokens = canvas.tokens.placeables
    .filter(t => t.actor && t.actor.type === 'threat');
  
  // Create a collection of valid influences
  const validInfluences = [];
  
  // Use a Set to track processed tokens specifically
  const processedTokenIds = new Set();
  
  // Process each token in the scene INDIVIDUALLY
  for (const token of currentSceneTokens) {
    // Skip if we've already processed this specific token
    if (processedTokenIds.has(token.id)) {
      continue;
    }
    
    let influence = null;
    
    // For unlinked tokens, look for influence by token ID first
    if (!token.document.actorLink && influences[token.id]) {
      influence = influences[token.id];
      processedTokenIds.add(token.id);
    } 
    // For linked tokens, handle differently to avoid skipping tokens with same actor
    else if (token.document.actorLink && influences[token.actor.id]) {
      influence = influences[token.actor.id];
      
      // For linked actors, we only process each individual token once
      // but we don't mark all tokens of this actor as processed
      processedTokenIds.add(token.id);
    }
    
    if (influence) {
      // Make a deep copy of the influence to prevent reference issues
      const influenceCopy = JSON.parse(JSON.stringify(influence));
      
      // Add extra identification for debugging
      influenceCopy._tokenId = token.id;
      influenceCopy._tokenName = token.name;
      
      validInfluences.push(influenceCopy);
    }
  }
  
  // Debug logs
  console.log(`Found ${validInfluences.length} active NPC influences in current scene`);
  console.log(`Scene NPC influences for calculation:`, validInfluences);
  
  return validInfluences;
}

// Debug function should also be scene-aware
function debugNpcInfluences() {
  const influences = globalThis.activeNpcInfluences || {};
  
  // Get all token IDs from the current scene
  const currentSceneTokens = canvas.tokens.placeables
    .filter(t => t.actor && t.actor.type === 'threat')
    .map(t => t.actor.id);
  
  // Filter to scene-specific NPCs
  const sceneInfluences = Object.values(influences).filter(infl => 
    infl && currentSceneTokens.includes(infl.npcId)
  );
  
  // Get all influences for comparison
  const allInfluences = Object.values(influences);
  
  console.log("===== ACTIVE NPC INFLUENCES =====");
  console.log(`Current Scene: ${canvas.scene.name}`);
  console.log(`Found ${sceneInfluences.length} influences in current scene (${allInfluences.length} total in cache)`);
  
  console.log("--- CURRENT SCENE INFLUENCES ---");
  sceneInfluences.forEach(infl => {
    console.log(`${infl.npcName}: ${infl.totalInfluence} (Tags: ${infl.tagInfluence}, Statuses: ${infl.statusInfluence})`);
  });
  
  if (allInfluences.length > sceneInfluences.length) {
    console.log("--- OTHER SCENES INFLUENCES (NOT APPLIED) ---");
    const otherSceneInfluences = allInfluences.filter(infl => !currentSceneTokens.includes(infl.npcId));
    otherSceneInfluences.forEach(infl => {
      console.log(`${infl.npcName}: ${infl.totalInfluence} (not in current scene)`);
    });
  }
  
  const total = calculateNpcInfluenceTotal(sceneInfluences);
  console.log(`Total influence applied to rolls in current scene: ${total}`);
  console.log("===== END DEBUG =====");
  
  return { 
    sceneInfluences, 
    allInfluences,
    total,
    sceneName: canvas.scene.name
  };
}
// Expose the debug function globally
globalThis.debugNpcInfluences = debugNpcInfluences;

// Calculate total from all influences
function calculateNpcInfluenceTotal(influences) {
  if (!influences || influences.length === 0) {
    console.log("No NPC influences found, returning 0");
    return 0;
  }
  
  // Create a Map to track token-specific influences
  const tokenInfluences = new Map();
  
  // Process each influence by token
  influences.forEach(infl => {
    const key = infl._tokenId || infl.tokenId || infl.npcId;
    const name = infl._tokenName || infl.tokenName || infl.npcName || "Unknown";
    const value = Number(infl.totalInfluence) || 0;
    
    tokenInfluences.set(key, { name, value });
  });
  
  // Calculate total from all token influences
  let total = 0;
  console.log("DETAILED INFLUENCE BREAKDOWN:");
  
  tokenInfluences.forEach((data, key) => {
    console.log(`${data.name} (${key}): ${data.value}`);
    total += data.value;
  });
  
  console.log(`TOTAL NPC INFLUENCE: ${total}`);
  return total;
}

function calculatePowerTags(hud) {
  const rollData = hud.getSelectedRollData();

  // Exclude Crew Power Tags from Regular Power Tag Calculation
  const powerTagsTotal = rollData.powerTags
      .filter(tag => !rollData.crewPowerTags.some(crewTag => crewTag.id === tag.id))
      .reduce((total, tag) => {
          return total + (tag.stateClass === "to-burn" ? 3 : 1);
      }, 0);

  return powerTagsTotal;
}

function calculateCrewPowerTags(hud) {
  const rollData = hud.getSelectedRollData();

  return rollData.crewPowerTags.reduce((total, tag) => {
      return total + 1; //Crew Power Tags always contribute +1, even if burned
  }, 0);
}

function calculateWeaknessTags(hud) {
  const rollData = hud.getSelectedRollData();

  const crewWeaknessIds = new Set((rollData.crewWeaknessTags || []).map(tag => tag.id)); 

  // Make sure rollData.weaknessTags exists before filtering
  if (!rollData.weaknessTags) {
    console.warn("weaknessTags is undefined in calculateWeaknessTags");
    return 0;
  }

  // Only count normal weakness tags here
  return rollData.weaknessTags
      .filter(tag => !crewWeaknessIds.has(tag.id))  
      .filter(tag => tag.stateClass === "normal")
      .reduce((total, tag) => total - 1, 0);
}

function calculateInvertedWeaknessTags(hud) {
  const rollData = hud.getSelectedRollData();

  const crewWeaknessIds = new Set((rollData.crewWeaknessTags || []).map(tag => tag.id)); 

  // Make sure rollData.weaknessTags exists before filtering
  if (!rollData.weaknessTags) {
    console.warn("weaknessTags is undefined in calculateInvertedWeaknessTags");
    return 0;
  }

  // Only count inverted weakness tags here
  return rollData.weaknessTags
      .filter(tag => !crewWeaknessIds.has(tag.id))  
      .filter(tag => tag.stateClass === "inverted")
      .reduce((total, tag) => total + 1, 0);
}

function calculateCrewWeaknessTags(hud) {
  const rollData = hud.getSelectedRollData();

  return rollData.crewWeaknessTags.reduce((total, tag) => {
      return total + (tag.stateClass === "normal" ? -1 : 0); // ✅ Crew Weakness Tags subtract -1 if "normal"
  }, 0);
}

function calculateLoadoutTags(data) {
  const tagsData = data.getSelectedRollData ? data.getSelectedRollData() : data;
  
  // Add safety check
  if (!tagsData || !tagsData.loadoutTags) {
    console.warn("loadoutTags is undefined in calculateLoadoutTags");
    return 0;
  }
  
  const loadoutTags = tagsData.loadoutTags;

  return loadoutTags.reduce((total, tag) => {
    return total + (tag.stateClass === "to-burn" ? 3 : 1); 
  }, 0);
}

function calculateStoryTags(data) {
  // Check if this is a HUD object or tagsData directly
  const tagsData = data.getSelectedRollData ? data.getSelectedRollData() : data;
  
  // Safety check
  if (!tagsData || !tagsData.storyTags) {
    console.warn("storyTags is undefined in calculateStoryTags");
    return 0;
  }
  
  const storyTags = tagsData.storyTags;

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

function calculateCharacterStatuses(data) {
  const tagsData = data.getSelectedRollData ? data.getSelectedRollData() : data;
  
  // Add safety check
  if (!tagsData || !tagsData.statuses) {
    console.warn("statuses is undefined in calculateCharacterStatuses");
    return 0;
  }
  
  const characterStatusTotal = tagsData.statuses.reduce((total, status) => {
    const contribution = status.typeClass === "positive" ? status.tier : -status.tier;
    return total + contribution;
  }, 0);

  return characterStatusTotal;
}

function calculateSceneStatuses(data) {
  const tagsData = data.getSelectedRollData ? data.getSelectedRollData() : data;
  
  // Add safety check
  if (!tagsData || !tagsData.sceneStatuses) {
    console.warn("sceneStatuses is undefined in calculateSceneStatuses");
    return 0;
  }
  
  const sceneStatusTotal = tagsData.sceneStatuses.reduce((total, sceneStatus) => {
    return total + (sceneStatus.typeClass === "scene-positive" ? sceneStatus.tier : -sceneStatus.tier);
  }, 0);

  return sceneStatusTotal;
}

function calculateScnTags(data) {
  const tagsData = data.getSelectedRollData ? data.getSelectedRollData() : data;
  
  // Add safety check
  if (!tagsData || !tagsData.scnTags) {
    console.warn("scnTags is undefined in calculateScnTags");
    return 0;
  }
  
  const scnTags = tagsData.scnTags;

  return scnTags.reduce((total, tag) => {
    return total + (tag.type === "positive" ? 1 : -1);  // +1 for positive, -1 for negative
  }, 0);
}

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

// ====================
// HELPER FUNCTIONS
// ====================

async function burnCrispyTags(tagsArray) {
  const activeToken = canvas.tokens.controlled[0];
  if (!activeToken || !activeToken.actor) return;
  
  const hud = globalThis.playerHudRegistry.get(activeToken.actor.id);
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

// Export CityOfMistRolls for potential external usage
export default CityOfMistRolls;
