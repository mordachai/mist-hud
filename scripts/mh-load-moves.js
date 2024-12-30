//mh-load-moves.js
import { moveConfig } from "./mh-theme-config.js";
import { detectActiveSystem } from "./mh-settings.js";
/**
 * Clears macros from specific hotbar slots for all players.
 */
async function clearPlayerHotbars() {
    for (const user of game.users.contents) {
        console.debug(`Clearing hotbar for user: ${user.name}`);
        for (let i = 1; i <= 9; i++) {
            await user.assignHotbarMacro(null, i);
        }
        for (let i = 11; i <= 19; i++) {
            await user.assignHotbarMacro(null, i);
        }
    }
}

/**
 * Creates and assigns macros dynamically for the active system.
 * Ensures macros are visible to players.
 */
async function createAndAssignMacros() {
    const activeSystem = await detectActiveSystem();
    if (!activeSystem) {
        console.error("No active system detected. Aborting macro creation.");
        return;
    }

    const relevantMoves = Object.entries(moveConfig).filter(([_, move]) => move.system === activeSystem);

    // Delete all existing macros matching relevant moves (created by current user/GM)
    const existingMacros = game.macros.filter((m) =>
        relevantMoves.some(([name]) => m.name === name && m.author?.id === game.user.id)
    );
    for (const macro of existingMacros) {
        await macro.delete();
    }

    // Generate new macros and assign them
    const createdMacros = {};
    for (const [name, move] of relevantMoves) {
        const macroName = name;
        const macroImage = `modules/mist-hud/ui/${move.image || `${name}.webp`}`;

        const macroData = {
            name: macroName,
            type: "script",
            img: macroImage,
            command: `CityOfMistRolls.executeMove("${name}");`,
            folder: null
        };

        // Create the macro only if it doesn't already exist
        let macro = game.macros.find((m) => m.name === macroName && m.author?.id === game.user.id);
        if (!macro) {
            macro = await Macro.create(macroData);
        }

        // Update ownership to make the macro visible to all users as "Observer"
        const ownership = duplicate(macro.ownership || {});
        game.users.contents.forEach(user => {
            ownership[user.id] = user.isGM ? 3 : 2; // 3 for OWNER (GM), 2 for OBSERVER (Players)
        });

        try {
            await macro.update({ ownership });
        } catch (err) {
            console.error(`Failed to set ownership for macro ${macro.name}:`, err);
        }

        // Save the macro reference for assignment
        createdMacros[macroName] = macro;
    }

    // Assign macros to hotbars for each player
    for (const user of game.users.contents) {
        for (const [name, move] of relevantMoves) {
            const macro = createdMacros[name];
            if (macro) {
                await user.assignHotbarMacro(macro, move.slot);
            }
        }
    }
}

/**
 * Main function to load moves.
 * Clears hotbars and assigns macros for all users.
 */
async function loadMoves() {
    if (!game.user.isGM) {
        console.error("Only the GM can run this script.");
        return;
    }
    await clearPlayerHotbars();
    await createAndAssignMacros();
    ui.notifications.info("Moves have been loaded and assigned to player hotbars.");
}
/**
 * Initialize macros when the game finishes loading for a user.
 */
async function initializeForPlayer() {
    const activeSystem = await detectActiveSystem();
    if (!activeSystem) return;
    const relevantMoves = Object.entries(moveConfig).filter(([_, move]) => move.system === activeSystem);
    for (const [name, move] of relevantMoves) {
        const macroName = name;
        const macro = game.macros.find((m) => m.name === macroName);
        if (macro) {
            await game.user.assignHotbarMacro(macro, move.slot);
        }
    }
}
// Export loadMoves for manual execution
export { loadMoves };
// Hook to register game settings during initialization
Hooks.once("init", () => {
    game.settings.register("mist-hud", "movesLoaded", {
        name: "Moves Loaded",
        hint: "Tracks whether the moves have been initialized for this session.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });
});
// Hook to handle system changes and reload macros
Hooks.on("updateSetting", async (setting) => {
    if (setting.key === "city-of-mist.system" && game.user.isGM) {
        // Clear all macros created by the GM
        const allMacros = game.macros.filter((m) => m.author?.id === game.user.id);
        for (const macro of allMacros) {
            await macro.delete();
        }
        // Reload moves for the new system
        await loadMoves();
    }
});
// Hook to initialize macros for individual players after they log in
Hooks.on("ready", async () => {
    if (game.user.isGM) {
        const alreadyLoaded = game.settings.get("mist-hud", "movesLoaded");
        if (!alreadyLoaded) {
            await loadMoves();
            await game.settings.set("mist-hud", "movesLoaded", true);
        } else {
            console.log("Moves already loaded. Skipping initialization.");
        }
    } else {
        await initializeForPlayer();
    }
});
