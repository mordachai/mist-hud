// mh-theme-config.js

export const COM_mythosThemes = ["adaptation", "adaption", "bastion", "conjuration", "divination", "enclave", "esoterica", "expression", "familiar", "mobility", "relic"];
export const COM_logosThemes = ["definingevent", "definingrelationship", "destiny", "mission", "personality", "possessions", "routine", "struggle", "subversion", "training", "tradition", "turf"];
export const COM_mistThemes = ["shrouding", "advancedart", "unit"];

// Function to get theme category by name
export function getThemeCategory(themeName) {
    // Normalize theme name by removing spaces and converting to lowercase
    const normalizedThemeName = themeName.toLowerCase().trim().replace(/\s+/g, "");
  
    if (COM_mythosThemes.includes(normalizedThemeName)) return "mythos";
    if (COM_logosThemes.includes(normalizedThemeName)) return "logos";
    if (COM_mistThemes.includes(normalizedThemeName)) return "mist";
    return null;  // Return null if theme is not recognized
}

export const moveConfig = {
    "Change the Game": {
        name: "CityOfMist.moves.CTG.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.CTG.partial",
        success: "CityOfMist.moves.CTG.success",
        dynamite: "CityOfMist.moves.CTG.dynamite",
        partialEffects: [
            "CityOfMist.moves.CTG.0",
            "CityOfMist.moves.CTG.1",
            "CityOfMist.moves.CTG.2"
        ],
        successEffects: [
            "CityOfMist.moves.CTG.0",
            "CityOfMist.moves.CTG.1",
            "CityOfMist.moves.CTG.2",
            "CityOfMist.moves.CTG.3",
            "CityOfMist.moves.CTG.4",
            "CityOfMist.moves.CTG.5",
            "CityOfMist.moves.CTG.6"
            ],
        dynamiteEffects: [
            "CityOfMist.moves.CTG.0",
            "CityOfMist.moves.CTG.1",
            "CityOfMist.moves.CTG.2",
            "CityOfMist.moves.CTG.3",
            "CityOfMist.moves.CTG.4",
            "CityOfMist.moves.CTG.5",
            "CityOfMist.moves.CTG.6",
            "CityOfMist.moves.CTG.7",
            "CityOfMist.moves.CTG.8",
            "CityOfMist.moves.CTG.9"
        ],
            hasDynamite: true
    },

    "Convince": {
        name: "CityOfMist.moves.convince.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.convince.partial",
        success: "CityOfMist.moves.convince.success",
        dynamite: "CityOfMist.moves.convince.dynamite",
        hasDynamite: true
    },

    "Face Danger": {
        name: "CityOfMist.moves.FD.name",
        fail: "CityOfMist.moves.FD.fail",
        partial: "CityOfMist.moves.FD.partial",
        success: "CityOfMist.moves.FD.success",
        dynamite: "CityOfMist.moves.FD.dynamite",
        dynamiteEffects: [
            "CityOfMist.moves.FD.0",
            "CityOfMist.moves.FD.1"
        ],
        hasDynamite: true
    },

    "Go Toe To Toe": {
        name: "CityOfMist.moves.GTTT.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.GTTT.partial",
        success: "CityOfMist.moves.GTTT.success",
        dynamite: "CityOfMist.moves.GTTT.dynamite",
        partialEffects: [
            "CityOfMist.moves.GTTT.0",
            "CityOfMist.moves.GTTT.1",
            "CityOfMist.moves.GTTT.2"
        ],
        successEffects: [
            "CityOfMist.moves.GTTT.0",
            "CityOfMist.moves.GTTT.1",
            "CityOfMist.moves.GTTT.2"
        ],
        dynamiteEffects: [
            "CityOfMist.moves.GTTT.0",
            "CityOfMist.moves.GTTT.1",
            "CityOfMist.moves.GTTT.2"
        ],
        hasDynamite: true
    },

    "Hit with All You Got": {
        name: "CityOfMist.moves.HWAYG.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.HWAYG.partial",
        success: "CityOfMist.moves.HWAYG.success",
        dynamite: "CityOfMist.moves.HWAYG.dynamite",
        partialEffects: [
            "CityOfMist.moves.HWAYG.0",
            "CityOfMist.moves.HWAYG.1",
            "CityOfMist.moves.HWAYG.2",
            "CityOfMist.moves.HWAYG.3",
            "CityOfMist.moves.HWAYG.4"
        ],
        successEffects: [
            "CityOfMist.moves.HWAYG.0",
            "CityOfMist.moves.HWAYG.1",
            "CityOfMist.moves.HWAYG.2",
            "CityOfMist.moves.HWAYG.3",
            "CityOfMist.moves.HWAYG.4"
        ],
        dynamiteEffects: [
            "CityOfMist.moves.HWAYG.5",
            "CityOfMist.moves.HWAYG.6",
            "CityOfMist.moves.HWAYG.7",
            "CityOfMist.moves.HWAYG.8",
            "CityOfMist.moves.HWAYG.9"
        ],
        hasDynamite: true
    },

    "Investigate": {
        name: "CityOfMist.moves.investigate.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.investigate.partial",
        success: "CityOfMist.moves.investigate.success",
        dynamite: "CityOfMist.moves.investigate.dynamite",
        partialEffects: [
            "CityOfMist.moves.investigate.0",
            "CityOfMist.moves.investigate.1",
            "CityOfMist.moves.investigate.2"
        ],
        successEffects: [
            "CityOfMist.moves.investigate.0",
            "CityOfMist.moves.investigate.1",
            "CityOfMist.moves.investigate.2"
        ],
        dynamiteEffects: [
            "CityOfMist.moves.investigate.0",
            "CityOfMist.moves.investigate.1",
            "CityOfMist.moves.investigate.2"
        ],
        hasDynamite: true
    },

    "Look Beyond the Mist": {
        name: "CityOfMist.moves.lookBeyond.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.investigate.partial",
        success: "CityOfMist.moves.investigate.success",
        dynamite: "CityOfMist.moves.investigate.dynamite",
        partialEffects: [
            "CityOfMist.moves.investigate.0",
            "CityOfMist.moves.investigate.1",
            "CityOfMist.moves.investigate.2"
        ],
        successEffects: [
            "CityOfMist.moves.investigate.0",
            "CityOfMist.moves.investigate.1",
            "CityOfMist.moves.investigate.2"
        ],
        dynamiteEffects: [
            "CityOfMist.moves.investigate.0",
            "CityOfMist.moves.investigate.1",
            "CityOfMist.moves.investigate.2"
        ],
        hasDynamite: true,
        rollMythos: true

    },

    "Sneak Around": {
        name: "CityOfMist.moves.sneak.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.sneak.partial",
        success: "CityOfMist.moves.sneak.success",
        dynamite: "CityOfMist.moves.sneak.dynamite",
        partialEffects: [
            "CityOfMist.moves.sneak.0",
            "CityOfMist.moves.sneak.1",
            "CityOfMist.moves.sneak.2"
        ],
        successEffects: [
            "CityOfMist.moves.sneak.0",
            "CityOfMist.moves.sneak.1",
            "CityOfMist.moves.sneak.2"
        ],
        dynamiteEffects: [
            "CityOfMist.moves.sneak.0",
            "CityOfMist.moves.sneak.1",
            "CityOfMist.moves.sneak.2"
        ],
        hasDynamite: true
    },

    "Take the Risk": {
        name: "CityOfMist.moves.TTR.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.TTR.partial",
        success: "CityOfMist.moves.TTR.success",
        dynamite: "CityOfMist.moves.TTR.dynamite",
        hasDynamite: true
    },

    "Stop. Holding. Back. (Significant)": {
        name: "CityOfMist.moves.SHB.significant.name",
        fail: "CityOfMist.moves.SHB.significant.fail",
        partial: "CityOfMist.moves.SHB.significant.partial",
        success: "CityOfMist.moves.SHB.significant.success",
        rollLogos: true
    },

    "Stop. Holding. Back. (No Return)": {
        name: "CityOfMist.moves.SHB.noReturn.name",
        fail: "CityOfMist.moves.SHB.noReturn.fail",
        partial: "CityOfMist.moves.SHB.noReturn.partial",
        success: "CityOfMist.moves.SHB.noReturn.success",
        rollLogos: true
    },

    "Stop. Holding. Back. (Ultimate)": {
        name: "CityOfMist.moves.SHB.ultimate.name",
        fail: "CityOfMist.moves.SHB.ultimate.fail",
        partial: "CityOfMist.moves.SHB.ultimate.partial",
        success: "CityOfMist.moves.SHB.ultimate.success",
        rollLogos: true
    },

    "Monologue": {
        name: "CityOfMist.moves.monologue.name",
        fail: "CityOfMist.moves.monologue.always",
        partial: "CityOfMist.moves.monologue.always",
        success: "CityOfMist.moves.monologue.always",
        moveType: "cinematic",
    },

    "Flashback": {
        name: "CityOfMist.moves.flashback.name",
        fail: "CityOfMist.moves.flashback.always",
        partial: "CityOfMist.moves.flashback.always",
        success: "CityOfMist.moves.flashback.always",
        failEffects: [
            "CityOfMist.moves.flashback.0",
            "CityOfMist.moves.flashback.1"
        ],
        partialEffects: [
            "CityOfMist.moves.flashback.0",
            "CityOfMist.moves.flashback.1"
        ],
        successEffects: [
            "CityOfMist.moves.flashback.0",
            "CityOfMist.moves.flashback.1"
        ],
        moveType: "cinematic",
    },

    "Downtime": {
        name: "CityOfMist.moves.downtime.name",
        fail: "CityOfMist.moves.downtime.always",
        partial: "CityOfMist.moves.downtime.always",
        success: "CityOfMist.moves.downtime.always",
        failEffects: [
            "CityOfMist.moves.downtime.0",
            "CityOfMist.moves.downtime.1",
            "CityOfMist.moves.downtime.2",
            "CityOfMist.moves.downtime.3",
            "CityOfMist.moves.downtime.4"
        ],
        partialEffects: [
            "CityOfMist.moves.downtime.0",
            "CityOfMist.moves.downtime.1",
            "CityOfMist.moves.downtime.2",
            "CityOfMist.moves.downtime.3",
            "CityOfMist.moves.downtime.4"
        ],
        successEffects: [
            "CityOfMist.moves.downtime.0",
            "CityOfMist.moves.downtime.1",
            "CityOfMist.moves.downtime.2",
            "CityOfMist.moves.downtime.3",
            "CityOfMist.moves.downtime.4"
        ],
        moveType: "cinematic",
    },

    "Session End": {
        name: "CityOfMist.moves.sessionEnd.name",
        fail: "CityOfMist.moves.sessionEnd.always",
        partial: "CityOfMist.moves.sessionEnd.always",
        success: "CityOfMist.moves.sessionEnd.always",
        failEffects: [
            "CityOfMist.moves.sessionEnd.0",
            "CityOfMist.moves.sessionEnd.1",
            "CityOfMist.moves.sessionEnd.2"
        ],
        partialEffects: [
            "CityOfMist.moves.sessionEnd.0",
            "CityOfMist.moves.sessionEnd.1",
            "CityOfMist.moves.sessionEnd.2"
        ],
        successEffects: [
            "CityOfMist.moves.sessionEnd.0",
            "CityOfMist.moves.sessionEnd.1",
            "CityOfMist.moves.sessionEnd.2"
        ],
        moveType: "cinematic",
    },
    
};