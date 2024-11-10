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
    // Retrieve the active system setting
    const systemSetting = game.settings.get("city-of-mist", "system");

    switch (systemSetting) {
        case "city-of-mist":
            console.log("Active System: City of Mist");
            applySystemCSS("city-of-mist");
            break;
        case "otherscape":
            console.log("Active System: Otherscape");
            applySystemCSS("otherscape");
            break;
        case "legend":
            console.log("Active System: Legends in the Mist");
            applySystemCSS("legend");
            break;
        case "custom":
            console.log("Active System: Custom");
            applySystemCSS("custom");
            break;
        default:
            console.error(`Unknown System: ${systemSetting}`);
            applySystemCSS(null); // Optionally remove any custom styles
    }
}

// Hook to run when the game is ready
Hooks.once("ready", async () => {
    await detectActiveSystem();
});


Hooks.once('init', () => {
    // alert("oi")
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