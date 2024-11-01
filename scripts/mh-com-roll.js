// mh-com-roll.js

import { moveConfig } from './mh-theme-config.js';
import { MistHUD } from './mist-hud.js';
import { getSceneStatus } from './mist-hud.js';
import { COM_mythosThemes, COM_logosThemes, COM_mistThemes } from './mh-theme-config.js';

// Ensure global object initialization
globalThis.CityOfMistRolls = globalThis.CityOfMistRolls || {};

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
function debugLog(...args) {
  if (debug) console.log("MistHUD |", ...args);
}

// Roll dice with Dice So Nice support
async function rollDice() {
  const roll = new Roll("2d6");
  await roll.evaluate({ async: true });

  // Show Dice So Nice animation if available
  if (game.modules.get("dice-so-nice")?.active) {
    await game.dice3d.showForRoll(roll);
  }

  // Return the individual dice results
  return roll.dice[0].results.map(die => die.result);
}

function calculatePowerTags() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  const powerTagsTotal = rollData.powerTags.reduce((total, tag) => {
    return total + (tag.stateClass === "to-burn" ? 3 : 1);
  }, 0);

  const invertedWeaknessTotal = rollData.weaknessTags.reduce((total, tag) => {
    return total + (tag.stateClass === "inverted" ? 1 : 0);
  }, 0);

  return powerTagsTotal + invertedWeaknessTotal;
}

function calculateWeaknessTags() {
  const hud = MistHUD.getInstance();
  const weaknessTags = hud.getSelectedRollData().weaknessTags;

  // Sum only non-inverted weakness tags
  return weaknessTags.reduce((total, tag) => {
    return total + (tag.stateClass === "normal" ? -1 : 0);
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

function calculateStatuses() {
  const hud = MistHUD.getInstance();
  const rollData = hud.getSelectedRollData();

  // Sum tiers for character statuses (positive adds, negative subtracts)
  const characterStatusTotal = rollData.statuses.reduce((total, status) => {
    return total + (status.typeClass === "positive" ? status.tier : -status.tier);
  }, 0);

  // Sum tiers for scene statuses (positive adds, negative subtracts)
  const sceneStatusTotal = rollData.sceneTags.reduce((total, sceneStatus) => {
    return total + (sceneStatus.typeClass === "scene-positive" ? sceneStatus.tier : -sceneStatus.tier);
  }, 0);

  // Return the combined total of character and scene statuses
  return characterStatusTotal + sceneStatusTotal;
}

function getRollModifier() {
  const hud = MistHUD.getInstance();
  return hud.modifier !== 0 ? hud.modifier : null;
}

// Main roll function
async function rollMove(moveName, hasDynamite) {
  const move = moveConfig[moveName];
  if (!move) {
    console.error(`Move not found: ${moveName}`);
    return;
  }

  const hud = MistHUD.getInstance();
  const actor = hud.actor;
  if (!actor) {
    ui.notifications.warn("Please select an actor before attempting this roll.");
    return;
  }

  // Calculate individual values
  const calculatedPower = calculatePowerTags();
  const totalWeakness = calculateWeaknessTags();
  const totalStoryTags = calculateStoryTags(); // Include story tags in the roll
  const totalStatuses = calculateStatuses();
  const modifier = getRollModifier() || 0;

  // Aggregate total power for the roll calculation
  const totalPower = calculatedPower + totalWeakness + + totalStoryTags + totalStatuses + modifier;
  const rollResults = await rollDice();
  const rollTotal = rollResults.reduce((acc, value) => acc + value, 0) + totalPower;

  // Determine outcome based on roll total and dynamite setting
  const dynamiteEnabled = (await actor.getFlag("mist-hud", "dynamiteMoves") || []).includes(moveName);
  let outcome;
  let moveEffects = [];

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

  // Generate and localize chat output
  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, totalPower);

  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));

  // Add firecracker emoji if the move is dynamite and the rollTotal is 12 or more
  const displayRollTotal = dynamiteEnabled && rollTotal >= 12 ? `${rollTotal} 🧨` : rollTotal;

  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    rollResults,
    outcomeMessage,
    calculatedPower,
    totalWeakness,
    totalStoryTags, 
    totalStatuses,
    modifier,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData: hud.getSelectedRollData()
  };

  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);

  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name }
  });

  hud.postRollCleanup(chatData.tagsData);
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
  let logosAmount = 0;
  let mythosAmount = 0;
  let mistAmount = 0;

  const themes = character.items.filter(item => item.type === "theme");

  themes.forEach(theme => {
    const themeName = theme.system.themebook_name.toLowerCase().replace(/\s+/g, "").trim();

    if (COM_mythosThemes.includes(themeName)) {
      mythosAmount++;
    } else if (COM_logosThemes.includes(themeName)) {
      logosAmount++;
    } else if (COM_mistThemes.includes(themeName)) {
      mistAmount++;
    }
  });

  return { logosAmount, mythosAmount, mistAmount };
}

// Adds Mythos or Logos count based on move flags.
async function rollSpecialMoves(moveName) {
  console.log("⚙️ Calling rollSpecialMoves");  // Log function call
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

  // Get theme counts and determine which count is relevant
  const { logosAmount, mythosAmount } = countThemebookTypes(actor);
  const themeCount = move.rollMythos ? mythosAmount : move.rollLogos ? logosAmount : 0;
  const themeType = move.rollMythos ? "mythos" : move.rollLogos ? "logos" : null;

  // Calculate statuses and modifier
  const totalStatuses = calculateStatuses();
  const modifier = getRollModifier() || 0;

  // Total roll calculation using theme count, statuses, and modifier
  const totalPower = themeCount + totalStatuses + modifier;
  const rollResults = await rollDice();
  const rollTotal = rollResults.reduce((acc, value) => acc + value, 0) + totalPower;

  // Determine the outcome of the roll
  const dynamiteEnabled = (await actor.getFlag("mist-hud", "dynamiteMoves") || []).includes(moveName);
  let outcome;
  let moveEffects = [];

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

  // Localize and send the message to chat
  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, totalPower);

  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));

  // Add firecracker emoji if the move is dynamite and the rollTotal is 12 or more
  const displayRollTotal = dynamiteEnabled && rollTotal >= 12 ? `${rollTotal} 🧨` : rollTotal;

  // Update chatData to include themeCount and themeType
  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    rollResults,
    outcomeMessage,
    themeCount,
    themeType,
    totalStatuses,
    modifier,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData: hud.getSelectedRollData()
  };

  const chatContent = await renderTemplate("modules/mist-hud/templates/mh-chat-roll.hbs", chatData);

  ChatMessage.create({
    content: chatContent,
    speaker: { alias: actor.name }
  });

  hud.postRollCleanup(chatData.tagsData);
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
    speaker: { alias: actor.name }
  });

  hud.postRollCleanup(chatData.tagsData);
}

// Wrapper function to determine which roll function to use
function executeMove(moveName) {
  const move = moveConfig[moveName];
  if (!move) {
    console.error(`Move "${moveName}" not found in moveConfig.`);
    return;
  }

  if (move.moveType === "cinematic") {
    console.log(`🎬 Executing cinematic move for "${moveName}"`);
    rollCinematicMove(moveName);
  } else if (move.rollMythos || move.rollLogos) {
    rollSpecialMoves(moveName);
  } else {
    rollMove(moveName);
  }
}

// Export function for potential external usage
export { rollMove};
export { countThemebookTypes };
export { rollSpecialMoves };
export default CityOfMistRolls;
export { calculatePowerTags, calculateWeaknessTags, calculateStatuses, getRollModifier };

// Assign rollMove and substituteText to the global object
globalThis.CityOfMistRolls.rollMove = rollMove;
globalThis.CityOfMistRolls.substituteText = substituteText;
globalThis.CityOfMistRolls.executeMove = executeMove;
