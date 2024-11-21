(async () => {
    const activeSystem = game.settings.get("city-of-mist", "system");
    const compendiumKey = "mist-hud.mist-hud-macros";
    const compendium = game.packs.get(compendiumKey);

    if (!compendium) {
        ui.notifications.error(Compendium "${compendiumKey}" not found.);
        console.error(Compendium "${compendiumKey}" not found.);
        return;
    }

    console.log("Active System:", activeSystem);

    // Define folder name mappings
    const folderMappings = {
        "city-of-mist": {
            coreMoves: "Core Moves",
            specialMoves: "Special Moves",
        },
        otherscape: {
            coreMoves: "Core Moves",
            specialMoves: "Special Moves",
        },
    };

    const folders = folderMappings[activeSystem];
    if (!folders) {
        ui.notifications.error(No folder mappings defined for system "${activeSystem}".);
        console.error(No folder mappings defined for system "${activeSystem}".);
        return;
    }

    console.log("Folder Mappings:", folders);

    // Predefined mapping of macro names to systems and categories
    const macroSystemMapping = {
        "city-of-mist": {
            coreMoves: [
                "Change the Game", "Convince", "Face Danger", "Go Toe To Toe",
                "Hit with all You've Got", "Investigate", "Look Beyond the Mist",
                "Sneak Around", "Take the Risk"
            ],
            specialMoves: [
                "Stop. Holding. Back. (Significant)", "Stop. Holding. Back. (No-Return)",
                "Stop. Holding. Back. (Ultimate)", "Opening Monologue", "Flashback",
                "Downtime", "Session End"
            ]
        },
        otherscape: {
            coreMoves: [
                "Quick Outcome", "Mitigate Consequences", "Tracked Outcome - Attack", "Tracked Outcome - Empower",
                "Tracked Outcome - Extras", "Roll with Mythos", "Roll with Noise", "Roll with Self"
            ],
            specialMoves: [
                "Downtime (Otherscape)", "Session End (Otherscape)", "Blaze of Glory (No Return)",
                "Blaze of Glory (Significant)", "Blaze of Glory (Ultimate)"
            ]
        }
    };

    // Remove all macros currently in the world directory
    console.log("Deleting existing world macros...");
    const allMacros = game.macros.contents;
    for (const macro of allMacros) {
        await macro.delete();
        console.log(Deleted macro: ${macro.name});
    }

    // Load all macros from the compendium
    const macros = await compendium.getDocuments();
    if (!macros || macros.length === 0) {
        ui.notifications.error(No macros found in compendium "${compendiumKey}".);
        return;
    }

    // Log macros for debugging
    macros.forEach(macro => {
        console.log(Macro: ${macro.name}, Folder: ${macro.folder?.name || "No Folder"});
    });

    // Filter macros by folder name and system
    const coreMoves = macros
        .filter(macro => macro.folder?.name === folders.coreMoves)
        .filter(macro => macroSystemMapping[activeSystem].coreMoves.includes(macro.name))
        .sort((a, b) => a.name.localeCompare(b.name)); // Alphabetical order
    const specialMoves = macros
        .filter(macro => macro.folder?.name === folders.specialMoves)
        .filter(macro => macroSystemMapping[activeSystem].specialMoves.includes(macro.name))
        .sort((a, b) => a.name.localeCompare(b.name)); // Alphabetical order

    console.log("Filtered Core Moves:", coreMoves.map(m => m.name));
    console.log("Filtered Special Moves:", specialMoves.map(m => m.name));

    // Import macros into the world directory
    const importedCoreMoves = [];
    const importedSpecialMoves = [];

    for (const macro of coreMoves) {
        const importedMacro = await Macro.create(macro.toObject());
        importedCoreMoves.push(importedMacro);
        console.log(Imported core move: ${macro.name});
    }

    for (const macro of specialMoves) {
        const importedMacro = await Macro.create(macro.toObject());
        importedSpecialMoves.push(importedMacro);
        console.log(Imported special move: ${macro.name});
    }

    // Assign observer permission to all users for the imported macros
    const assignPermissions = async (macros) => {
        for (const macro of macros) {
            let permissions = {};
            game.users.forEach(user => {
                permissions[user.id] = foundry.CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER;
            });
            await macro.update({ permission: permissions });
            console.log(`Set observer permissions for macro: ${macro.name}`);
        }
    };

    await assignPermissions(importedCoreMoves);
    await assignPermissions(importedSpecialMoves);


    ui.notifications.info(Hotbars updated for system "${activeSystem}".);
})();