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
