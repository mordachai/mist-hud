export const MODULE_ID = "mist-hud";  // Nome do módulo

// Registrar as configurações (settings) do módulo
export function registerSettings() {

    // Dropdown para selecionar o sistema
    game.settings.register(MODULE_ID, "selectedSystem", {
        name: "Select System",
        hint: "Select the rule system to configure the module.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "city-of-mist": "City of Mist",
            "otherscape": "Otherscape",
            "legend": "Legends in the Mist"
        },
        default: "city-of-mist",  // Valor padrão
        onChange: system => applySystemSettings(system)  // Aplica as configurações ao mudar o sistema
    });

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

// Função para aplicar as configurações baseadas no sistema selecionado
function applySystemSettings(system) {
    switch (system) {
        case "city-of-mist":
            console.log("Applying settings for City of Mist.");
            applyCityOfMistSettings();
            break;
        case "otherscape":
            console.log("Applying settings for Otherscape.");
            applyOtherscapeSettings();
            break;
        case "legend":
            console.log("Applying settings for Legends in the Mist.");
            applyLegendSettings();
            break;
        default:
            console.warn("Unrecognized system.");
    }
}

// Função para aplicar configurações específicas do sistema City of Mist
function applyCityOfMistSettings() {
    applyCSS("style-city-of-mist");
    // Carregar scripts e macros específicos para City of Mist
}

// Função para aplicar configurações específicas do sistema Otherscape
function applyOtherscapeSettings() {
    applyCSS("style-otherscape");
    // Carregar scripts e macros específicos para Otherscape
}

// Função para aplicar configurações específicas do sistema Legends in the Mist
function applyLegendSettings() {
    applyCSS("style-legend");
    // Carregar scripts e macros específicos para Legends in the Mist
}

// Função para aplicar o CSS baseado no sistema selecionado
function applyCSS(styleClass) {
    document.body.classList.remove("style-city-of-mist", "style-otherscape", "style-legend");
    document.body.classList.add(styleClass);
}

// Função de log para Debug
export function debugLog(message) {
    const debug = game.settings.get(MODULE_ID, "debugMode");
    if (debug) {
        console.log(`[DEBUG] ${message}`);
    }
}
