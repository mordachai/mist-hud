// mh-roll.js

import { moveConfig } from './mh-theme-config.js';
import { MistHUD } from './mist-hud.js';
import { getSceneStatuses } from './mist-hud.js';
import { getScnTags } from './mist-hud.js';
import { COM_mythosThemes, COM_logosThemes, COM_mistThemes, OS_selfThemes, OS_mythosThemes, OS_noiseThemes } from './mh-theme-config.js';

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
  await roll.evaluate();

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
    return total + (status.typeClass === "positive" ? status.tier : -status.tier);
  }, 0);

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
  const totalStoryTags = calculateStoryTags();
  const totalLoadoutTags = calculateLoadoutTags();
  const totalCharStatuses = calculateCharacterStatuses();
  const totalSceneStatuses = calculateSceneStatuses();
  const totalScnTags = calculateScnTags();
  const modifier = getRollModifier() || 0;

  // Aggregate total power for the roll calculation
  const totalPower = calculatedPower + totalWeakness + totalStoryTags + totalLoadoutTags + totalCharStatuses + totalSceneStatuses + totalScnTags + modifier;

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

  // Prepare tracked effects data if applicable
  let trackedEffects = null;
  if (Array.isArray(move.trackedEffects) && move.trackedEffects.length > 0) {
      trackedEffects = move.trackedEffects; // Only include if the move is a tracked outcome move
  }

  const chatData = {
    moveName: move.name,
    actorName: actor.name,
    subtitle: move.subtitle || "",
    rollResults,
    outcomeMessage,
    calculatedPower,
    totalLoadoutTags,
    totalWeakness,
    totalStoryTags,
    totalScnTags,
    totalCharStatuses,
    totalSceneStatuses,
    modifier,
    rollTotal: displayRollTotal,
    localizedMoveEffects,
    tagsData: hud.getSelectedRollData(),
    trackedEffects
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
  let mythosOSAmount = 0;
  let selfAmount = 0;
  let noiseAmount = 0;
  let logosAmount = 0;
  let mythosAmount = 0;
  let mistAmount = 0;

  const themes = character.items.filter(item => item.type === "theme");

  themes.forEach(theme => {
    const themeName = theme.system.themebook_name.toLowerCase().replace(/\s+/g, "").trim();

    if (OS_mythosThemes.includes(themeName)) {
      mythosOSAmount++;
    } else if (OS_selfThemes.includes(themeName)) {
      selfAmount++;
    } else if (OS_noiseThemes.includes(themeName)) {
      noiseAmount++;
    } else if (COM_logosThemes.includes(themeName)) {
      logosAmount++;
    } else if (COM_mythosThemes.includes(themeName)) {
      mythosAmount++;
    } else if (COM_mistThemes.includes(themeName)) {
      mistAmount++;
    }
  });

  return { selfAmount, noiseAmount, mythosOSAmount, logosAmount, mythosAmount, mistAmount };
}

// Adds Mythos or Logos count based on move flags.
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

  // Get theme counts for special move rolls
  const { selfAmount, noiseAmount, mythosOSAmount, logosAmount, mythosAmount, mistAmount } = countThemebookTypes(actor);

  // Mapping roll flags to theme counts and types
  const rollMappings = {
    rollLogos: { amount: logosAmount, type: "logos" },
    rollMythos: { amount: mythosAmount, type: "mythos" },
    rollSelf: { amount: selfAmount, type: "self" },
    rollNoise: { amount: noiseAmount, type: "noise" },
    rollMythosOS: { amount: mythosOSAmount, type: "mythosOS" }
  };

  // Determine active roll based on move configuration
  const activeRoll = Object.entries(rollMappings).find(([flag]) => move[flag]) || [];
  const { amount: themeCount = 0, type: themeType = null } = activeRoll[1] || {};

  // Calculate additional values
  const totalWeakness = calculateWeaknessTags();
  const totalStoryTags = calculateStoryTags();
  const totalLoadoutTags = calculateLoadoutTags();
  const totalCharStatuses = calculateCharacterStatuses();
  const totalSceneStatuses = calculateSceneStatuses();
  const totalScnTags = calculateScnTags();
  const modifier = getRollModifier() || 0;

  // Calculate roll results using theme count
  const totalPower = themeCount + totalWeakness + totalStoryTags + totalLoadoutTags + totalCharStatuses + totalSceneStatuses + totalScnTags + modifier;
  const rollResults = await rollDice();
  const rollTotal = rollResults.reduce((acc, value) => acc + value, 0) + totalPower;

  // Determine roll outcome
  let outcome;
  let moveEffects = [];
  if (rollTotal >= 12) {
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

  // Generate chat output
  let outcomeMessage = game.i18n.localize(move[outcome]);
  outcomeMessage = substituteText(outcomeMessage, totalPower);

  const localizedMoveEffects = moveEffects.map(effect => game.i18n.localize(effect));
  const displayRollTotal = rollTotal; // Optionally format for "dynamite" rolls

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
    tagsData: hud.getSelectedRollData()
  };

  // Render and send chat message
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

  // Check for special move roll triggers
  if (move.rollMythos || move.rollLogos || move.rollMythosOS || move.rollSelf || move.rollNoise) {
    rollSpecialMoves(moveName);
  } else if (move.moveType === "cinematic") {
    rollCinematicMove(moveName);
  } else {
    rollMove(moveName);
  }
}

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
