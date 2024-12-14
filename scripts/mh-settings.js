export const MODULE_ID = "mist-hud";

const SYSTEM_CSS_MAP = {
    "city-of-mist": "/modules/mist-hud/styles/mh-city-of-mist.css",
    "otherscape": "/modules/mist-hud/styles/mh-otherscape.css",
    "legend": "/modules/mist-hud/styles/mh-legends-in-the-mist.css",
    "custom": null // Optional: No stylesheet if custom system
};

function applySystemCSS(system) {
    const cssPath = SYSTEM_CSS_MAP[system];
    // Remove existing theme stylesheets
    document.querySelectorAll('link[data-system-theme]').forEach(link => link.remove());

    if (cssPath) {
        // Create a new link element for the stylesheet
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssPath;
        link.type = 'text/css';
        link.dataset.systemTheme = 'true'; // Custom attribute to track this stylesheet
        document.head.appendChild(link);
    }
}

export async function detectActiveSystem() {
    const systemSetting = game.settings.get("city-of-mist", "system");

    switch (systemSetting) {
        case "city-of-mist":
            console.log("Active System: City of Mist");
            applySystemCSS("city-of-mist");
            return "city-of-mist";
        case "otherscape":
            console.log("Active System: Otherscape");
            applySystemCSS("otherscape");
            return "otherscape";
        case "legend":
            console.log("Active System: Legends in the Mist");
            applySystemCSS("legend");
            return "legend";
        case "custom":
            console.log("Active System: Custom");
            applySystemCSS("custom");
            return "custom";
        default:
            console.error(`Unknown System: ${systemSetting}`);
            applySystemCSS(null);
            return null;
    }
}


// Hook to run when the game is ready
Hooks.once("ready", async () => {
    await detectActiveSystem();
});


Hooks.once('init', () => {

    // Detect the active system
    const activeSystem = game.settings.get("city-of-mist", "system");

      // Register the game setting
    game.settings.register(MODULE_ID, "preferredDice", {
        name: "Preferred Dice",
        hint: "Select your preferred dice set for rolls.",
        scope: "world",
        config: true,
        type: String,
        choices: getDiceChoices(activeSystem),
        default: getDefaultDice(activeSystem),
        onChange: value => {
            console.log(`Preferred dice set changed to: ${value}`);
            applyPreferredDice(value); // Apply the selected dice
        },
    });  
    
    game.settings.register(MODULE_ID, 'npcAccordionState', {
        name: 'NPC Accordions Initial State',
        hint: 'Set the initial state for NPC accordions: all expanded, only a specific one expanded, or all closed.',
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'allExpanded': 'All expanded',
            'onlyMovesExpanded': 'Only Moves expanded',
            'allClosed': 'All closed'
        },
        default: 'allExpanded',
        onChange: value => {
            // Notify the user that a refresh is required for changes to take effect
            ui.notifications.info("Changing the accordion state requires a refresh to take effect.");
            new Dialog({
                title: 'Refresh Required',
                content: '<p>Would you like to refresh the page now to apply the changes?</p>',
                buttons: {
                    yes: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Yes',
                        callback: () => foundry.utils.debounce(() => window.location.reload(), 100)()
                    },
                    no: {
                        icon: '<i class="fas fa-times"></i>',
                        label: 'No'
                    }
                },
                default: 'no'
            }).render(true);
        }
    });
    
    game.settings.register(MODULE_ID, 'onlyOneOpen', {
        name: 'Keep only one tab open',
        hint: 'When enabled, only one accordion will remain open at a time. Disable to allow multiple open accordions.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        onChange: value => {
            // Notify the user that a refresh is required
            ui.notifications.info("The setting change requires a refresh to take effect.");

            // Provide a dialog prompt to refresh the page
            new Dialog({
                title: 'Refresh Required',
                content: '<p>Would you like to refresh the page now to apply the changes?</p>',
                buttons: {
                    yes: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Yes',
                        callback: () => {
                            // Using Foundry's built-in API for reloading
                            foundry.utils.debounce(() => window.location.reload(), 100)();
                        }
                    },
                    no: {
                        icon: '<i class="fas fa-times"></i>',
                        label: 'No'
                    }
                },
                default: 'no'
            }).render(true);
        }
    });
});

// Function to get dice choices based on the active system
function getDiceChoices(system) {
    if (system === "city-of-mist") {
        return {
            "city-of-mist": "City of Mist Dice",
        };
    } else if (system === "otherscape") {
        return {
            "otherscape-noise": "Noise Dice",
            "otherscape-mythos": "MythosOS Dice",
            "otherscape-self": "Self Dice",
        };
    } else {
        return {}; // No choices for unsupported systems
    }
}

// Function to get the default dice based on the active system
function getDefaultDice(system) {
    if (system === "city-of-mist") {
        return "city-of-mist"; // Default dice for City of Mist
    } else if (system === "otherscape") {
        return "otherscape-noise"; // Default dice for Otherscape
    }
    return null;
}

// Function to apply the selected dice to Dice So Nice
function applyPreferredDice(diceSet) {
    const dice3d = game.dice3d;
    if (!dice3d) {
        console.error("Dice So Nice is not available.");
        return;
    }

    // Set the preferred dice system
    dice3d.setSystem(diceSet);

    console.log(`Applied preferred dice set: ${diceSet}`);
}

// Registrar as configurações (settings) do módulo
export function registerSettings() {

    // Modo de Debug - deve ser registrado por último
    game.settings.register(MODULE_ID, "debugMode", {
        name: "Debug Mode",
        hint: "Enable or disable debug mode to show information in the console.",
        scope: "client",  // Configuração de cliente, individual para cada usuário
        config: true,
        type: Boolean,
        default: false,  // Desativado por padrão
        onChange: value => {
            if (value) {
                console.log("Debug Mode enabled.");
            } else {
                console.log("Debug Mode disabled.");
            }
        }
    });
}

async function loadMoves() {
    const compendiumName = "mist-hud.mist-hud-macros"; // Nome interno correto do compêndio

    // UUIDs das pastas para importação
    const foldersToImport = {
        "COM Core Moves": "Folder.fGGvwScEsE5w67gZ",
        "COM Special Moves": "Folder.N8FvP2QD8oeByl7F",
        "OS Core Moves": "Folder.MNTHYLyBz99gC6G4",
        "OS Special Moves": "Folder.KEp5B9BW9tBGTw24"
    };

    // Detectar o sistema ativo
    const activeSystem = game.settings.get("city-of-mist", "system");
    if (!["city-of-mist", "otherscape"].includes(activeSystem)) {
        ui.notifications.error(`Sistema desconhecido: ${activeSystem}`);
        return;
    }

    const systemMapping = {
        "city-of-mist": {
            core: "COM Core Moves",
            special: "COM Special Moves"
        },
        "otherscape": {
            core: "OS Core Moves",
            special: "OS Special Moves"
        }
    };

    const systemFolders = systemMapping[activeSystem];

    // Tentar encontrar o compêndio
    const pack = game.packs.get(compendiumName);

    if (!pack) {
        ui.notifications.error(`Compêndio "${compendiumName}" não encontrado.`);
        console.error(`Pacotes disponíveis: `, [...game.packs.keys()]);
        return;
    }

    const macros = await pack.getDocuments();

    // Processar "Core Moves"
    const coreFolderName = systemFolders.core;
    const coreFolderUUID = foldersToImport[coreFolderName];
    const coreFolder = await getOrCreateFolder(coreFolderName, "Macro");
    const coreMacros = macros
        .filter(macro => macro.folder?.id === coreFolderUUID.split(".").pop())
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const macro of coreMacros) {
        const existingMacro = game.macros.find(m => m.name === macro.name);
        if (!existingMacro) {
            await Macro.create({
                ...macro.toObject(),
                folder: coreFolder.id
            });
        }
    }

    // Processar "Special Moves"
    const specialFolderName = systemFolders.special;
    const specialFolderUUID = foldersToImport[specialFolderName];
    const specialFolder = await getOrCreateFolder(specialFolderName, "Macro");
    const specialMacros = macros
        .filter(macro => macro.folder?.id === specialFolderUUID.split(".").pop())
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const macro of specialMacros) {
        const existingMacro = game.macros.find(m => m.name === macro.name);
        if (!existingMacro) {
            await Macro.create({
                ...macro.toObject(),
                folder: specialFolder.id
            });
        }
    }

    // Limpar e atribuir macros para todos os jogadores
    // for (const user of game.users) {
    //     if (!user.isGM && user.role >= CONST.USER_ROLES.PLAYER) {
    //         console.log(`Limpando e atribuindo macros para o usuário: ${user.name}`);
    //         await clearUserHotbar(user);
    //         await assignToUserHotbar(user, coreMacros, 1); // Assign core moves to slots 1–10
    //         await assignToUserHotbar(user, specialMacros, 11); // Assign special moves to slots 11–20
    //     }
    // }

    await clearUserHotbar(game.user);
    await assignToUserHotbar(game.user, coreMacros, 1); // Assign core moves to slots 1–10
    await assignToUserHotbar(game.user, specialMacros, 11); // Assign special moves to slots 11–20

    ui.notifications.info("Macros importadas, organizadas e atribuídas para os hotbars dos jogadores!");
}

// Helper para encontrar ou criar uma pasta pelo nome
async function getOrCreateFolder(name, type) {
    let folder = game.folders.contents.find(f => f.name === name && f.type === type);
    if (!folder) {
        folder = await Folder.create({ name, type });
    }
    return folder;
}

// Helper to assign macros to a user's hotbar
async function assignToUserHotbar(user, macros, startSlot) {
    macros.sort((a, b) => a.name.localeCompare(b.name)); // Sort macros alphabetically
    for (let i = 0; i < macros.length; i++) {
        const macro = macros[i];
        const slot = startSlot + i;
        if (slot > 50) break; // Hotbar limit
        const existingMacro = game.macros.find(m => m.name === macro.name);
        if (existingMacro) {
            await user.assignHotbarMacro(existingMacro, slot);
        } else {
            const importedMacro = await Macro.create(macro.toObject());
            await user.assignHotbarMacro(importedMacro, slot);
        }
    }
}

// Helper para limpar a barra de atalhos de um usuário
async function clearUserHotbar(user) {
    for (let i = 1; i <= 50; i++) {
        await user.assignHotbarMacro(null, i);
    }
}

Hooks.once('ready', () => {
    game.socket.on('module.mist-hud', (data) => {
        loadMoves();
    });
});