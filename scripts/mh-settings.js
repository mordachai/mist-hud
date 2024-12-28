import { initializeAccordions } from "./accordion-handler.js";

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
    // game.settings.register(MODULE_ID, "preferredDice", {
    //     name: "Preferred Dice",
    //     hint: "Select your preferred dice set for rolls.",
    //     scope: "world",
    //     config: true,
    //     type: String,
    //     choices: getDiceChoices(activeSystem),
    //     default: getDefaultDice(activeSystem),
    //     onChange: value => {
    //         console.log(`Preferred dice set changed to: ${value}`);
    //         applyPreferredDice(value); // Apply the selected dice
    //     },
    // });  
    
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
        default: 'allClosed',
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

/**
 * Run initializeAccordions whenever the game initializes.
 */
Hooks.once("ready", () => {
    console.log("Initializing accordions on game start...");
    initializeAccordions();
});

/**
 * Hook into chat messages to initialize accordions in chat rolls.
 */
Hooks.on("renderChatMessage", (message, html) => {
    console.log("Chat message rendered. Checking for accordions...");
    if (html.find(".accordion-container").length > 0) {
        console.log("Accordion container found in chat message. Initializing accordions...");
        initializeAccordions();
    }
});

