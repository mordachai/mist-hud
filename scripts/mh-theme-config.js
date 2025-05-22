// mh-theme-config.js

export const moveConfig = {

    // City of Mist moves
    "Change the Game": {
        configKey: "Change the Game",
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
        hasDynamite: true,
        system: "city-of-mist",
        slot: 1,
        image:"Change the Game.webp",
        abbreviation: "CHANGE",
    },

    "Convince": {
        configKey: "Convince",
        name: "CityOfMist.moves.convince.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.convince.partial",
        success: "CityOfMist.moves.convince.success",
        dynamite: "CityOfMist.moves.convince.dynamite",
        hasDynamite: true,
        system: "city-of-mist",
        slot: 2,
        image: "Convince.webp",
        abbreviation: "Conv",
    },

    "Face Danger": {
        configKey: "Face Danger",
        name: "CityOfMist.moves.FD.name",
        fail: "CityOfMist.moves.FD.fail",
        partial: "CityOfMist.moves.FD.partial",
        success: "CityOfMist.moves.FD.success",
        dynamite: "CityOfMist.moves.FD.dynamite",
        dynamiteEffects: [
            "CityOfMist.moves.FD.0",
            "CityOfMist.moves.FD.1"
        ],
        hasDynamite: true,
        system: "city-of-mist",
        slot: 3,
        image: "Face Danger.webp",
        abbreviation: "FACE",
    },

    "Go Toe To Toe": {
        configKey: "Go Toe To Toe",
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
        hasDynamite: true,
        system: "city-of-mist",
        slot: 4,
        image: "Go Toe To Toe.webp",
        abbreviation: "GTtT",
    },

    "Hit With All You've Got": {
        configKey: "Hit With All You've Got",
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
            "CityOfMist.moves.HWAYG.0",
            "CityOfMist.moves.HWAYG.1",
            "CityOfMist.moves.HWAYG.2",
            "CityOfMist.moves.HWAYG.3",
            "CityOfMist.moves.HWAYG.4",
            "CityOfMist.moves.HWAYG.5",
            "CityOfMist.moves.HWAYG.6",
            "CityOfMist.moves.HWAYG.7",
            "CityOfMist.moves.HWAYG.8",
            "CityOfMist.moves.HWAYG.9"
        ],
        hasDynamite: true,
        system: "city-of-mist",
        slot: 5,
        image: "Hit with All You Got.webp",
        abbreviation: "HIT",
    },

    "Investigate": {
        configKey: "Investigate",
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
        hasDynamite: true,
        system: "city-of-mist",
        slot: 6,
        image: "Investigate.webp",
        abbreviation: "Inv",
    },

    "Look Beyond the Mist": {
        configKey: "Look Beyond the Mist",
        name: "CityOfMist.moves.lookBeyond.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.investigate.partial",
        success: "CityOfMist.moves.investigate.success",
        dynamite: "CityOfMist.moves.investigate.dynamite",
        themeCategory: "Mythos",
        partialEffects: [
            "CityOfMist.moves.investigate.0",
            "CityOfMist.moves.investigate.1",
            "CityOfMist.moves.investigate.2"
        ],
        hasDynamite: true,
        rollMythos: true,
        // rollMist: true,
        system: "city-of-mist",
        slot: 7,
        image: "Look Beyond the Mist.webp",
        abbreviation: "LBM",

    },

    "Sneak Around": {  
        configKey: "Sneak Around",
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
        hasDynamite: true,
        system: "city-of-mist",
        slot: 8,
        image: "Sneak Around.webp",
        abbreviation: "Snk",
    },

    "Take The Risk": {
        configKey: "Take The Risk",
        name: "CityOfMist.moves.TTR.name",
        fail: "CityOfMist.moves.genericFail",
        partial: "CityOfMist.moves.TTR.partial",
        success: "CityOfMist.moves.TTR.success",
        dynamite: "CityOfMist.moves.TTR.dynamite",
        hasDynamite: true,
        system: "city-of-mist",
        slot: 9,
        image: "Take the Risk.webp",
        abbreviation: "TTR",
    },

    "Stop. Holding. Back. (Significant)": {
        configKey: "Stop. Holding. Back. (Significant)",
        name: "CityOfMist.moves.SHB.significant.name",
        fail: "CityOfMist.moves.SHB.significant.fail",
        partial: "CityOfMist.moves.SHB.significant.partial",
        success: "CityOfMist.moves.SHB.significant.success",
        themeCategory: "Logos",
        rollLogos: true,
        system: "city-of-mist",
        slot: 11,
        image: "SHB-Significant.webp",
        abbreviation: "SHBS",
    },

    "Stop. Holding. Back. (No Return)": {
        configKey: "Stop. Holding. Back. (No Return)",
        name: "CityOfMist.moves.SHB.noReturn.name",
        fail: "CityOfMist.moves.SHB.noReturn.fail",
        partial: "CityOfMist.moves.SHB.noReturn.partial",
        success: "CityOfMist.moves.SHB.noReturn.success",
        themeCategory: "Logos",
        rollLogos: true,
        system: "city-of-mist",
        slot: 12,
        image: "SHB-NoReturn.webp",
        abbreviation: "SHBNR",
    },

    "Stop. Holding. Back. (Ultimate)": {
        configKey: "Stop. Holding. Back. (Ultimate)",
        name: "CityOfMist.moves.SHB.ultimate.name",
        fail: "CityOfMist.moves.SHB.ultimate.fail",
        partial: "CityOfMist.moves.SHB.ultimate.partial",
        success: "CityOfMist.moves.SHB.ultimate.success",
        themeCategory: "Logos",
        rollLogos: true,
        system: "city-of-mist",
        slot: 13,
        image: "SHB-Ultimate.webp",
        abbreviation: "SHBU",
    },

    "Monologue": {
        configKey: "Monologue",
        name: "CityOfMist.moves.monologue.name",
        fail: "CityOfMist.moves.monologue.always",
        partial: "CityOfMist.moves.monologue.always",
        success: "CityOfMist.moves.monologue.always",
        system: "city-of-mist",
        moveType: "cinematic",
        slot: 15,
        image: "Monologue.webp",
        abbreviation: "Mono",
    },

    "Flashback": {
        configKey: "Flashback",
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
        system: "city-of-mist",
        moveType: "cinematic",
        slot: 16,
        image: "Flashback.webp",
        abbreviation: "FB",
    },

    "Downtime": {
        configKey: "Downtime",
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
        system: "city-of-mist",
        moveType: "cinematic",
        slot: 17,
        image: "Downtime.webp",
        abbreviation: "DT",
    },

    "Session End": {
        configKey: "Session End",
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
        system: "city-of-mist",
        moveType: "cinematic",
        slot: 18,
        image: "Session End.webp",
        abbreviation: "SE",
    },

    // Otherscape moves

    "Mitigate Consequences": {
        configKey: "Mitigate Consequences",
        name: "Otherscape.moves.mitigate.name",
        fail: "Otherscape.moves.mitigate.fail",
        partial: "Otherscape.moves.mitigate.partial",
        success: "Otherscape.moves.mitigate.success",
        system: "otherscape",
        slot: 1,
        image: "Mitigate Consequences.webp",
        abbreviation: "MC",
    },

    "Quick Outcome": {
        configKey: "Quick Outcome",
        name: "Otherscape.moves.quickOutcome.name",
        fail: "Otherscape.moves.quickOutcome.fail",
        partial: "Otherscape.moves.quickOutcome.partial",
        success: "Otherscape.moves.quickOutcome.success",
        system: "otherscape",
        slot: 2,
        image: "Quick Outcome.webp",
        abbreviation: "QO",
    },

    "Tracked Outcome - Attack": {
        configKey: "Tracked Outcome - Attack",
        name: "Otherscape.moves.trackedOutcome.name",
        subtitle: "Attack",
        fail: "Otherscape.moves.generic.fail",
        partial: "Otherscape.moves.trackedOutcome.partial",
        success: "Otherscape.moves.trackedOutcome.success",
        system: "otherscape",
        slot: 3,
        image: "Tracked Outcome - Attack.webp",
        abbreviation: "TOA",
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
    configKey: "Tracked Outcome - Empower",
    name: "Otherscape.moves.trackedOutcome.name",
    subtitle: "Empower",
    fail: "Otherscape.moves.generic.fail",
    partial: "Otherscape.moves.trackedOutcome.partial",
    success: "Otherscape.moves.trackedOutcome.success",
    system: "otherscape",
    slot: 4,
    image: "Tracked Outcome - Empower.webp",
    abbreviation: "TOE",
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
    configKey: "Tracked Outcome - Extras",
    name: "Otherscape.moves.trackedOutcome.name",
    subtitle: "Extras",
    fail: "Otherscape.moves.generic.fail",
    partial: "Otherscape.moves.trackedOutcome.partial",
    success: "Otherscape.moves.trackedOutcome.success",
    system: "otherscape",
    slot: 5,
    image: "Tracked Outcome - Extras.webp",
    abbreviation: "TOEx",
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

    "OS: Roll with Noise": {
        configKey: "OS: Roll with Noise",
        name: "Otherscape.terms.noise",
        themeCategory: "Noise",
        subtitleImg: "modules/mist-hud/ui/icons/noise_os_icn.svg",   
        fail: "Something doesn't work as intended and there are adverse Consequences.",
        partial: "The action succeeds or benefits you, but there are still some Consequences",
        success: "Strong hit! The action succeeds as intended, or better. There are no Consequences. You may choose to take Consequences for an even greater degree of success",
        rollNoise: true,
        system: "otherscape",
        slot: 7,
        image: "Noise-Roll.webp",
        abbreviation: "RNoise",
    },

    "OS: Roll with Mythos": {
        configKey: "OS: Roll with Mythos",
        name: "CityOfMist.terms.mythos",
        themeCategory: "Mythos",
        subtitleImg: "modules/mist-hud/ui/icons/mythos_os_icn.svg",
        fail: "Something doesn't work as intended and there are adverse Consequences.",
        partial: "The action succeeds or benefits you, but there are still some Consequences",
        success: "Strong hit! The action succeeds as intended, or better. There are no Consequences. You may choose to take Consequences for an even greater degree of success.",
        rollMythos: true,
        system: "otherscape",
        slot: 8,
        image: "MythosOS-Roll.webp",
        abbreviation: "RMythos",
    },

    "OS: Roll with Self": {
        configKey: "OS: Roll with Self",
        name: "Otherscape.terms.self",
        themeCategory: "Self",
        subtitleImg: "modules/mist-hud/ui/icons/self_os_icn.svg",   
        fail: "Something doesn't work as intended and there are adverse Consequences.",
        partial: "The action succeeds or benefits you, but there are still some Consequences",
        success: "Strong hit! The action succeeds as intended, or better. There are no Consequences. You may choose to take Consequences for an even greater degree of success",
        rollSelf: true,
        system: "otherscape",
        slot: 9,
        image: "Self-Roll.webp",
        abbreviation: "RSelf",
    },

    "Blaze of Glory (Significant)": {
        configKey: "Blaze of Glory (Significant)",
        name: "Otherscape.moves.blazeOfGlory.significant.name",
        fail: "Otherscape.moves.blazeOfGlory.significant.fail",
        partial: "Otherscape.moves.blazeOfGlory.significant.partial",
        success: "Otherscape.moves.blazeOfGlory.significant.success",
        system: "otherscape",
        slot: 11,
        image: "GOIAB-Significant.webp",
        abbreviation: "BOGS",
    },

    "Blaze of Glory (No Return)": {
        configKey: "Blaze of Glory (No Return)",
        name: "Otherscape.moves.blazeOfGlory.noReturn.name",
        fail: "Otherscape.moves.blazeOfGlory.noReturn.fail",
        partial: "Otherscape.moves.blazeOfGlory.noReturn.partial",
        success: "Otherscape.moves.blazeOfGlory.noReturn.success",
        system: "otherscape",
        slot: 12,
        image: "GOIAB-NoReturn.webp",
        abbreviation: "BOGNR",
    },

    "Blaze of Glory (Ultimate)": {
        configKey: "Blaze of Glory (Ultimate)",
        name: "Otherscape.moves.blazeOfGlory.ultimate.name",
        fail: "Otherscape.moves.blazeOfGlory.ultimate.fail",
        partial: "Otherscape.moves.blazeOfGlory.ultimate.partial",
        success: "Otherscape.moves.blazeOfGlory.ultimate.success",
        system: "otherscape",
        slot: 13,
        image: "GOIAB-Ultimate.webp",
        abbreviation: "BOGU",
    },

    "OS: Downtime": {
        configKey: "OS: Downtime",
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
        system: "otherscape",
        moveType: "cinematic",
        slot: 14,
        image: "Downtime-OS.webp",
        abbreviation: "DTOS",
    },

    "OS: Session End": {
        configKey: "OS: Session End",
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
        system: "otherscape",
        moveType: "cinematic",
        slot: 15,
        image: "Session End-OS.webp",
        abbreviation: "SEOS",
    },

    // Legends in the Mist moves

    "Quick Outcome - LITM": {
        configKey: "Quick Outcome",
        name: "Legends.moves.quickOutcome.fail",
        partial: "Legends.moves.quickOutcome.partial",
        success: "Legends.moves.quickOutcome.success",
        system: "litm",
        slot: 1,
        image: "Quick Way.webp",
        abbreviation: "QK",
    },

    "Detailed Outcome - Attack - LITM": {
        configKey: "Detailed Outcome - Attack",
        name: "Legends.moves.trackedOutcome.name",
        subtitle: "Attack",
        fail: "Legends.moves.generic.fail",
        partial: "Legends.moves.trackedOutcome.partial",
        success: "Legends.moves.trackedOutcome.success",
        system: "litm",
        slot: 3,
        image: "Detailed Way - Attack.webp",
        abbreviation: "DtAtk",
        trackedEffects: [
        {
            key: "effect.attack",
            name: "Attack",
            tags: ["wounded", "offended", "cursed"],
            description: "Give your target a harmful status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.disrupt",
            name: "Disrupt",
            tags: ["weak spot", "blinded", "tangled"],
            description: "Give your target a hindering tag or status.",
            cost: "1 Power per Tier / 2 Power per Tag"
        },
        {
            key: "effect.influence",
            name: "Influence",
            tags: ["convinced", "beguiled", "threatened"],
            description: "Give your target a compelling status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.weaken",
            name: "Weaken",
            tags: ["shield", "confident", "enraged"],
            description: "Remove a target's useful tag or status.",
            cost: "1 Power per Tier / 2 Power per Tag"
        }]
    },

    "Detailed Outcome - Empower - LITM": {
    configKey: "Detailed Outcome - Empower",
    name: "Legends.moves.trackedOutcome.name",
    subtitle: "Empower",
    fail: "Legends.moves.generic.fail",
    partial: "Legends.moves.trackedOutcome.partial",
    success: "Legends.moves.trackedOutcome.success",
    system: "litm",
    slot: 4,
    image: "Detailed Way - Empower.webp",
    abbreviation: "DtEmp",
    trackedEffects: [
        {
            key: "effect.bestow",
            name: "Bestow",
            tags: ["sharp senses", "basic spear training", "spell of lightning bolt"],
            description: "Give yourself or an ally new abilities using tags.",
            cost: "2 Power per Tag"
        },
        {
            key: "effect.create",
            name: "Create",
            tags: ["broom", "find", "potion of valor", "fine cloak", "ethereal guardian"],
            description: "Create a new object or being using tags.",
            cost: "2 Power per Tag"
        },
        {
            key: "effect.enhance",
            name: "Enhance",
            tags: ["aiming", "hopeful", "warded"],
            description: "Give yourself or an ally a helpful status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.restore",
            name: "Restore",
            tags: ["wounded", "despaired", "coughing affliction", "recover scratched tag"],
            description: "Reduce a harmful status or recover a burnt power tag.",
            cost: "1 Power per Tier / 2 Power per Tag"
        }]
    },

    "Detailed Outcome - Extras - LITM": {
    configKey: "Detailed Outcome - Extras",
    name: "Legends.moves.trackedOutcome.name",
    subtitle: "Extras",
    fail: "Legends.moves.generic.fail",
    partial: "Legends.moves.trackedOutcome.partial",
    success: "Legends.moves.trackedOutcome.success",
    system: "litm",
    slot: 5,
    image: "Detailed Way - Extras.webp",
    abbreviation: "DtExt",
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
            tags: ["delay", "ruin", "sabotage", "reverse", "remove progress status"],
            description: "Decrease a progress status.",
            cost: "1 Power per Tier"
        },
        {
            key: "effect.discover",
            name: "Discover",
            tags: ["recall information", "research", "converse", "through a magic spell"],
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
};

export const essenceDescriptions = {
    Nexus: "<p class = 'mh-essence-text'>When you next replace a theme, if you’re still a Nexus after the transformation, it starts as a full theme, not a nascent one.</p>",
    Spiritualist: "<p class = 'mh-essence-text'>Once per session, you can tap this bond to add your Mythos to the Power of an action that is primarily powered by Self themes, or add your Self to an action that is primarily powered by Mythos themes, or, if you are already rolling with Mythos or with Self, roll with both (Power of 4).</p>",
    Cyborg: "<p class = 'mh-essence-text'>You can add your number of Self or Noise to the Power of any action to resist or shake off mythical forces that are not manifested as tangible or measurable effects, such as curses, hallucinations, or mental influences. You may do this once per session with your Self and once per session with your Noise, or you may use both in the same action.</p>",
    Transhuman: "<p class = 'mh-essence-text'>Once per scene, when you invoke both mythical and technological tags in the same action, no matter their source, you can trade a miss (6 or less) outcome with a mixed hit (7-9).</p>",
    Real: "<p class = 'mh-essence-text'>Whenever you take action to directly uphold or protect one of your Identities, you may roll with Self instead of counting positive tags.</p>",
    "Avatar/Conduit": `
    <p class='mh-essence-subheader'>AVATAR <span>(One Source)</span></p>
    <p class='mh-essence-text'>
       Suspend all your Rituals; instead, choose an Agenda, which, if ever ignored (defied even once), would instantly cause you to replace all of your themes (your new themes may not include Mythos themes of your lost Source). While you are an Avatar, you may instantly recover burned power tags.
    </p>
    <p class='mh-essence-subheader'>CONDUIT <span>(Multiple Sources)</span></p>
    <p class='mh-essence-text'>
       You may replace themes at will as long as you replace them with a Mythos theme. Any Source in your possession or even nearby can become your new Mythos theme and it begins as a full theme, not a nascent one.
    </p>`,
    Singularity: "<p class = 'mh-essence-text'>Psychological effects and intangible or unmeasurable mythical effects do not affect you. You can interface with ALL information, regardless of medium, and may roll with Noise to search it and, if it is recorded information, to manipulate it.</p>",
    "City of Mist Character": "<p class = 'mh-essence-text'>City of Mist characters do not use Essence rules. Are you in the right active system?</p>",
    Undefined: "<p class = 'mh-essence-text'>Essence is not defined for this character.</p>",
  };