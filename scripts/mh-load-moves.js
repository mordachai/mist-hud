import { moveConfig } from "./mh-theme-config.js";
import { detectActiveSystem } from "./mh-settings.js";

/**
 * Clears macros from specific hotbar slots for all players.
 */
async function clearPlayerHotbars() {
    console.log("Clearing player hotbars (slots 1–9, 11–19)...");
    for (const user of game.users.contents) {
        console.log(`Clearing hotbar for user: ${user.name}`);
        for (let i = 1; i <= 9; i++) await user.assignHotbarMacro(null, i);
        for (let i = 11; i <= 19; i++) await user.assignHotbarMacro(null, i);
    }
    console.log("Hotbars cleared.");
}

/**
 * Creates and assigns macros dynamically for the active system.
 * Ensures macros are visible to players.
 */
async function createAndAssignMacros() {
    console.log("Creating and assigning macros...");
    const activeSystem = await detectActiveSystem();
    console.log(`Active system detected: ${activeSystem}`);
    if (!activeSystem) {
        console.error("No active system detected. Aborting macro creation.");
        return;
    }

    const relevantMoves = Object.entries(moveConfig).filter(([_, move]) => move.system === activeSystem);
    console.log(`Found ${relevantMoves.length} relevant moves for system "${activeSystem}".`);

    // Delete all existing macros matching relevant moves
    const existingMacros = game.macros.filter(
        (m) => relevantMoves.some(([name]) => m.name === name && m.author.id === game.user.id)
    );
    console.log(`Deleting ${existingMacros.length} existing macros for system "${activeSystem}".`);
    for (const macro of existingMacros) {
        console.log(`Deleting macro: ${macro.name}`);
        await macro.delete();
    }

    // Generate new macros and assign them
    const createdMacros = {};
    for (const [name, move] of relevantMoves) {
        const macroName = name;
        const macroImage = `/modules/mist-hud/ui/${move.image || `${name}.webp`}`;
        console.log(`Creating macro: ${macroName}, image: ${macroImage}`);

        const macroData = {
            name: macroName,
            type: "script",
            img: macroImage,
            command: `CityOfMistRolls.executeMove("${name}");`,
            folder: null,
        };

        // Create the macro only if it doesn't already exist
        let macro = game.macros.find((m) => m.name === macroName && m.author.id === game.user.id);
        if (!macro) {
            console.log(`Macro "${macroName}" does not exist. Creating new macro.`);
            macro = await Macro.create(macroData);
        } else {
            console.log(`Macro "${macroName}" already exists.`);
        }

        // Set ownership: Players have observer-level access
        console.log(`Setting ownership for macro: ${macroName}`);
        const ownership = {};
        for (const player of game.users.filter((u) => u.role !== CONST.USER_ROLES.GAMEMASTER)) {
            ownership[player.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
        }
        await macro.update({ ownership });

        // Save the macro reference for assignment
        createdMacros[macroName] = macro;
    }

    // Assign macros to hotbars for each player
    for (const user of game.users.contents) {
        console.log(`Assigning macros to user: ${user.name}`);
        for (const [name, move] of relevantMoves) {
            const macro = createdMacros[name];
            if (macro) {
                console.log(`Assigning macro "${macro.name}" to slot ${move.slot} for user ${user.name}.`);
                await user.assignHotbarMacro(macro, move.slot);
            }
        }
    }

    console.log("Macro creation and assignment complete.");
}

/**
 * Main function to load moves.
 * Clears hotbars and assigns macros for all users.
 */
async function loadMoves() {
    console.log("Starting loadMoves...");
    if (!game.user.isGM) {
        console.error("Only the GM can run this script.");
        return;
    }
    await clearPlayerHotbars();
    await createAndAssignMacros();
    ui.notifications.info("Moves have been loaded and assigned to player hotbars.");
    console.log("loadMoves complete.");
}

/**
 * Initialize macros when the game finishes loading for a user.
 */
async function initializeForPlayer() {
    console.log("Initializing macros for player...");
    const activeSystem = await detectActiveSystem();
    console.log(`Active system detected: ${activeSystem}`);
    if (!activeSystem) return;

    const relevantMoves = Object.entries(moveConfig).filter(([_, move]) => move.system === activeSystem);
    console.log(`Found ${relevantMoves.length} relevant moves for player.`);

    for (const [name, move] of relevantMoves) {
        const macroName = name;
        const macro = game.macros.find(m => m.name === macroName);
        if (macro) {
            console.log(`Assigning macro "${macroName}" to current user in slot ${move.slot}.`);
            await game.user.assignHotbarMacro(macro, move.slot);
        } else {
            console.log(`Macro "${macroName}" not found.`);
        }
    }
    console.log("Player macro initialization complete.");
}

// Export loadMoves for manual execution
export { loadMoves };

// Hook to register game settings during initialization
Hooks.once("init", () => {
    console.log("Registering 'mist-hud.movesLoaded' setting...");
    game.settings.register("mist-hud", "movesLoaded", {
        name: "Moves Loaded",
        hint: "Tracks whether the moves have been initialized for this session.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
    });
    console.log("'mist-hud.movesLoaded' setting registered.");
});

// Hook to handle system changes and reload macros
Hooks.on("updateSetting", async (setting) => {
    if (setting.key === "city-of-mist.system" && game.user.isGM) {
        console.log("System changed. Clearing old macros and reloading moves...");
        
        // Clear all macros created by the GM
        const allMacros = game.macros.filter((m) => m.author.id === game.user.id);
        console.log(`Deleting ${allMacros.length} existing macros.`);
        for (const macro of allMacros) {
            console.log(`Deleting macro: ${macro.name}`);
            await macro.delete();
        }

        // Reload moves for the new system
        await loadMoves();
    }
});


// Hook to initialize macros for individual players after they log in
Hooks.on("ready", async () => {
    console.log("Ready hook triggered...");
    if (game.user.isGM) {
        console.log("GM detected. Checking if moves are already loaded...");
        const alreadyLoaded = game.settings.get("mist-hud", "movesLoaded");
        if (!alreadyLoaded) {
            console.log("Moves not loaded. Running loadMoves...");
            await loadMoves();
            await game.settings.set("mist-hud", "movesLoaded", true);
            console.log("Moves loaded and setting updated.");
        } else {
            console.log("Moves already loaded. Skipping initialization.");
        }
    } else {
        console.log("Non-GM player detected. Initializing for player...");
        await initializeForPlayer();
    }
});
