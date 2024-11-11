// mh-theme-config.js

export const COM_mythosThemes = ["adaptation", "adaption", "bastion", "conjuration", "divination", "enclave", "esoterica", "expression", "familiar", "mobility", "relic"];
export const COM_logosThemes = ["definingevent", "definingrelationship", "destiny", "mission", "personality", "possessions", "routine", "struggle", "subversion", "training", "tradition", "turf"];
export const COM_mistThemes = ["shrouding", "advancedart", "unit"];
export const OS_selfThemes = ["affiliation", "assets", "expertise", "horizon", "personality", "troubledPast"];
export const OS_mythosThemes = ["artifact", "companion", "esoterica", "exposure"];
export const OS_noiseThemes = ["augmentation", "cuttingEdge", "cyberspace", "drones"];


// Function to get theme category by name
export function getThemeCategory(themeName) {
    // Normalize theme name by removing spaces and converting to lowercase
    const normalizedThemeName = themeName.toLowerCase().trim().replace(/\s+/g, "");
  
    if (COM_mythosThemes.includes(normalizedThemeName)) return "mythos";
    if (COM_logosThemes.includes(normalizedThemeName)) return "logos";
    if (COM_mistThemes.includes(normalizedThemeName)) return "mist";
    if (OS_selfThemes.includes(normalizedThemeName)) return "self";
    if (OS_mythosThemes.includes(normalizedThemeName)) return "mythosOS";
    if (OS_noiseThemes.includes(normalizedThemeName)) return "noise";
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
        themeCategory: "mythos",
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
        themeCategory: "logos",
        rollLogos: true
    },

    "Stop. Holding. Back. (No Return)": {
        name: "CityOfMist.moves.SHB.noReturn.name",
        fail: "CityOfMist.moves.SHB.noReturn.fail",
        partial: "CityOfMist.moves.SHB.noReturn.partial",
        success: "CityOfMist.moves.SHB.noReturn.success",
        themeCategory: "logos",
        rollLogos: true
    },

    "Stop. Holding. Back. (Ultimate)": {
        name: "CityOfMist.moves.SHB.ultimate.name",
        fail: "CityOfMist.moves.SHB.ultimate.fail",
        partial: "CityOfMist.moves.SHB.ultimate.partial",
        success: "CityOfMist.moves.SHB.ultimate.success",
        themeCategory: "logos",
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

    "Quick Outcome": {
        name: "Otherscape.moves.quickOutcome.name",
        fail: "Otherscape.moves.quickOutcome.fail",
        partial: "Otherscape.moves.quickOutcome.partial",
        success: "Otherscape.moves.quickOutcome.success",
    },

    "Tracked Outcome": {
        name: "Otherscape.moves.trackedOutcome.name",
        fail: "Otherscape.moves.generic.fail",
        partial: "Otherscape.moves.trackedOutcome.partial",
        success: "Otherscape.moves.trackedOutcome.success",
    },

    "Mitigate Consequences": {
        name: "Otherscape.moves.mitigate.name",
        fail: "Otherscape.moves.mitigate.fail",
        partial: "Otherscape.moves.mitigate.partial",
        success: "Otherscape.moves.mitigate.success",
    },

    "Blaze of Glory (Significant)": {
        name: "Otherscape.moves.blazeOfGlory.significant.name",
        fail: "Otherscape.moves.blazeOfGlory.significant.fail",
        partial: "Otherscape.moves.blazeOfGlory.significant.partial",
        success: "Otherscape.moves.blazeOfGlory.significant.success",
        moveType: "cinematic",
    },

    "Blaze of Glory (No Return)": {
        name: "Otherscape.moves.blazeOfGlory.noReturn.name",
        fail: "Otherscape.moves.blazeOfGlory.noReturn.fail",
        partial: "Otherscape.moves.blazeOfGlory.noReturn.partial",
        success: "Otherscape.moves.blazeOfGlory.noReturn.success",
        moveType: "cinematic",
    },

    "Blaze of Glory (Ultimate)": {
        name: "Otherscape.moves.blazeOfGlory.ultimate.name",
        fail: "Otherscape.moves.blazeOfGlory.ultimate.fail",
        partial: "Otherscape.moves.blazeOfGlory.ultimate.partial",
        success: "Otherscape.moves.blazeOfGlory.ultimate.success",
        moveType: "cinematic",
    },

    "OS: Downtime": {
        name: "Otherscape.moves.downtime.name",
        fail: "Otherscape.moves.downtime.always",
        partial: "Otherscape.moves.downtime.always",
        success: "Otherscape.moves.downtime.always",
        failEffects: [
            "Otherscape.moves.downtime.0",
            "Otherscape.moves.downtime.1",
            "Otherscape.moves.downtime.2",
            "Otherscape.moves.downtime.3",
            "Otherscape.moves.downtime.4"
        ],
        partialEffects: [
            "Otherscape.moves.downtime.0",
            "Otherscape.moves.downtime.1",
            "Otherscape.moves.downtime.2",
            "Otherscape.moves.downtime.3",
            "Otherscape.moves.downtime.4"
        ],
        successEffects: [
            "Otherscape.moves.downtime.0",
            "Otherscape.moves.downtime.1",
            "Otherscape.moves.downtime.2",
            "Otherscape.moves.downtime.3",
            "Otherscape.moves.downtime.4"
        ],
        moveType: "cinematic",
    },

    "OS: Session End": {
        name: "Otherscape.moves.creditRoll.name",
        fail: "Otherscape.moves.creditRoll.always",
        partial: "Otherscape.moves.creditRoll.always",
        success: "Otherscape.moves.creditRoll.always",
        failEffects: [
            "Otherscape.moves.creditRoll.0",
            "Otherscape.moves.creditRoll.1",
            "Otherscape.moves.creditRoll.2",
            "Otherscape.moves.creditRoll.3",
            "Otherscape.moves.creditRoll.4",
            "Otherscape.moves.creditRoll.5",
            "Otherscape.moves.creditRoll.6",
            "Otherscape.moves.creditRoll.7"
        ],
        partialEffects: [
            "Otherscape.moves.creditRoll.0",
            "Otherscape.moves.creditRoll.1",
            "Otherscape.moves.creditRoll.2",
            "Otherscape.moves.creditRoll.3",
            "Otherscape.moves.creditRoll.4",
            "Otherscape.moves.creditRoll.5",
            "Otherscape.moves.creditRoll.6",
            "Otherscape.moves.creditRoll.7"
        ],
        successEffects: [
            "Otherscape.moves.creditRoll.0",
            "Otherscape.moves.creditRoll.1",
            "Otherscape.moves.creditRoll.2",
            "Otherscape.moves.creditRoll.3",
            "Otherscape.moves.creditRoll.4",
            "Otherscape.moves.creditRoll.5",
            "Otherscape.moves.creditRoll.6",
            "Otherscape.moves.creditRoll.7"
        ],
        moveType: "cinematic",
    },

    "Tracked Outcome - Attack": {
        name: "Otherscape.moves.trackedOutcome.name",
        subtitle: "Attack",
        fail: "Otherscape.moves.generic.fail",
        partial: "Otherscape.moves.trackedOutcome.partial",
        success: "Otherscape.moves.trackedOutcome.success",
        trackedEffects: [
        {
            key: "effect.attack",
            name: "Attack",
            tags: ["slash", "punch", "shoot", "zap"],
            description: "Give your target a harmful status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.disrupt",
            name: "Disrupt",
            tags: ["blind", "confuse", "shock", "trip", "jam", "interrupt"],
            description: "Give your target a hindering tag or status.",
            cost: "1 Power per Tier / 2 Power per Tag"
        },
        {
            key: "effect.influence",
            name: "Influence",
            tags: ["convince", "threaten", "provoke", "hack", "mind-control"],
            description: "Give your target a compelling status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.weaken",
            name: "Weaken",
            tags: ["break", "sunder", "defuse", "neutralize", "nullify", "silence"],
            description: "Remove a target's useful tag or status.",
            cost: "1 Power per Tier / 2 Power per Tag"
        }]
    },

    "Tracked Outcome - Empower": {
    name: "Otherscape.moves.trackedOutcome.name",
    subtitle: "Empower",
    fail: "Otherscape.moves.generic.fail",
    partial: "Otherscape.moves.trackedOutcome.partial",
    success: "Otherscape.moves.trackedOutcome.success",
    trackedEffects: [
        {
            key: "effect.bestow",
            name: "Bestow",
            tags: ["teach", "learn", "impart", "empower", "enchant", "equip"],
            description: "Give yourself or an ally new abilities using tags.",
            cost: "2 Power per Tag"
        },
        {
            key: "effect.create",
            name: "Create",
            tags: ["craft", "find", "purchase", "loot", "summon", "build", "rally"],
            description: "Create a new object or being using tags.",
            cost: "2 Power per Tag"
        },
        {
            key: "effect.enhance",
            name: "Enhance",
            tags: ["assist", "aim", "boost", "energize", "take cover", "gain advantage"],
            description: "Give yourself or an ally a helpful status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.restore",
            name: "Restore",
            tags: ["heal", "repair", "rejuvenate", "regain", "alleviate", "undo"],
            description: "Reduce a harmful status or recover a burnt power tag.",
            cost: "1 Power per Tier / 2 Power per Tag"
        }]
    },

    "Tracked Outcome - Extras": {
    name: "Otherscape.moves.trackedOutcome.name",
    subtitle: "Extras",
    fail: "Otherscape.moves.generic.fail",
    partial: "Otherscape.moves.trackedOutcome.partial",
    success: "Otherscape.moves.trackedOutcome.success",
    trackedEffects: [
        {
            key: "effect.advance",
            name: "Advance",
            tags: ["make progress", "get closer", "push forward"],
            description: "Increase a progress status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.setBack",
            name: "Set Back",
            tags: ["delay", "ruin", "sabotage", "reverse"],
            description: "Decrease a progress status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.discover",
            name: "Discover",
            tags: ["sense", "recall information", "research", "converse", "reveal"],
            description: "Discover a valuable detail.",
            cost: "1 Power per Detail"
        },
        {
            key: "effect.extraFeat",
            name: "Extra Feat",
            tags: ["additional feature", "minor achievement"],
            description: "1 Power per additional feature or minor achievement included in the action.",
            cost: ""
        }]
    },

    "OS: Roll with Mythos": {
        name: "CityOfMist.terms.mythos",
        themeCategory: "mythosOS",
        subtitleImg: "modules/mist-hud/ui/icons/mythos_os_icn.svg",
        fail: "Something doesn't work as intended and there are adverse Consequences.",
        partial: "The action succeeds or benefits you, but there are still some Consequences",
        success: "Strong hit! The action succeeds as intended, or better. There are no Consequences. You may choose to take Consequences for an even greater degree of success.",
        rollMythosOS: true,
    },

    "OS: Roll with Self": {
        name: "Otherscape.terms.self",
        themeCategory: "self",
        subtitleImg: "modules/mist-hud/ui/icons/self_os_icn.svg",   
        fail: "Something doesn't work as intended and there are adverse Consequences.",
        partial: "The action succeeds or benefits you, but there are still some Consequences",
        success: "Strong hit! The action succeeds as intended, or better. There are no Consequences. You may choose to take Consequences for an even greater degree of success",
        rollSelf: true,
    },

    "OS: Roll with Noise": {
        name: "Otherscape.terms.noise",
        themeCategory: "noise",
        subtitleImg: "modules/mist-hud/ui/icons/noise_os_icn.svg",   
        fail: "Something doesn't work as intended and there are adverse Consequences.",
        partial: "The action succeeds or benefits you, but there are still some Consequences",
        success: "Strong hit! The action succeeds as intended, or better. There are no Consequences. You may choose to take Consequences for an even greater degree of success",
        rollNoise: true,
    }    

};