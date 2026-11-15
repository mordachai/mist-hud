import { MODULE_ID, SETTINGS, getActiveSystem } from "./constants.js";

export const DENOMINATION = "6";

// ── Automatic dice set per active system ─────────────────────────────────────
// Dice So Nice lets a roll override the viewer's chosen dice set per die via
// `term.options.appearance.system`. We set it on every d6 term right before DSN
// animates, so nobody has to pick the set by hand in the DSN config.

const OTHERSCAPE_SETS = ["otherscape-mythos", "otherscape-noise", "otherscape-self"];

const SYSTEM_DICE_SET = {
  "city-of-mist": "city-of-mist",
  "legend":       "legend",
};

let dsnSystemsReady = false;

/** Small deterministic hash so every client picks the same random Otherscape set. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One random Otherscape set (Mythos / Noise / Self) for the whole roll. Seeded
 * from the message and the dice results so every client shows the same set.
 */
function pickOtherscapeSet(messageId, roll) {
  if (!messageId) return OTHERSCAPE_SETS[Math.floor(Math.random() * OTHERSCAPE_SETS.length)];
  const results = roll.dice.flatMap(d => d.results.map(r => r.result)).join(",");
  return OTHERSCAPE_SETS[hashString(`${messageId}:${roll.formula}:${results}`) % OTHERSCAPE_SETS.length];
}

Hooks.on("diceSoNiceRollStart", (messageId, context) => {
  if (!dsnSystemsReady) return;
  if (!game.settings.get(MODULE_ID, SETTINGS.AUTO_DICE_SET)) return;

  const roll = context?.dsnRoll ?? context?.roll;
  if (!roll?.dice?.length) return;

  const system = getActiveSystem();
  const diceSet = SYSTEM_DICE_SET[system]
    ?? (system === "otherscape" ? pickOtherscapeSet(messageId, roll) : null);
  if (!diceSet) return;

  for (const term of roll.dice) {
    if (term.faces !== 6) continue;
    term.options ??= {};
    const appearance = (term.options.appearance ??= {});
    // Respect an explicit override from another module or the roller.
    appearance.system ??= diceSet;
  }
});

export class D6toD12 extends foundry.dice.terms.Die {
  constructor(termData) {
    super({ ...termData, faces: 12 });
  }

  static DENOMINATION = "6";
}

// Register the custom die term with Foundry VTT
CONFIG.Dice.terms["6"] = D6toD12;


Hooks.once('diceSoNiceReady', (dice3d) => {
    // Register all dice systems
    dice3d.addSystem({ id: "city-of-mist", name: "City of Mist", group: "City of Mist" });
    dice3d.addSystem({ id: "otherscape-mythos", name: "Otherscape: Mythos", group: "Otherscape" });
    dice3d.addSystem({ id: "otherscape-noise", name: "Otherscape: Noise", group: "Otherscape" });
    dice3d.addSystem({ id: "otherscape-self", name: "Otherscape: Self", group: "Otherscape" });
    dice3d.addSystem({ id: "legend", name: "Legend in the Mist", group: "Legend in the Mist" });

    // Add all dice presets
    dice3d.addDicePreset({
        system: "city-of-mist",
        type: "d6",
        labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_logos_color.png',
            '/modules/mist-hud/ui/dice/dice_mythos_color.png', '5', '4', '3', '2', '1'],
        emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_logos_emissive.png',
            '/modules/mist-hud/ui/dice/dice_mythos_emissive.png', , , , , ],
        emissive: 0xdc39ff,
        emissiveIntensity: 0.25,
        colorset: "city-of-mist",
    },"d12");

    dice3d.addDicePreset({
        system: "otherscape-mythos",
        type: "d6",
        labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-mythos_color.png',
            '/modules/mist-hud/ui/dice/dice_otherscape-mythos_color.png', '5', '4', '3', '2', '1'],
        emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-mythos_emissive.png',
            '/modules/mist-hud/ui/dice/dice_otherscape-mythos_emissive.png', , , , , ],
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
        colorset: "otherscape-mythos",
    },"d12");

    dice3d.addDicePreset({
        system: "otherscape-noise",
        type: "d6",
        labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-noise_color.png',
            '/modules/mist-hud/ui/dice/dice_otherscape-noise_color.png', '5', '4', '3', '2', '1'],
        emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-noise_emissive.png',
            '/modules/mist-hud/ui/dice/dice_otherscape-noise_emissive.png', , , , , ],
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
        colorset: "otherscape-noise",
    },"d12");

    dice3d.addDicePreset({
        system: "otherscape-self",
        type: "d6",
        labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-self_color.png',
            '/modules/mist-hud/ui/dice/dice_otherscape-self_color.png', '5', '4', '3', '2', '1'],
        emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-self_emissive.png',
            '/modules/mist-hud/ui/dice/dice_otherscape-self_emissive.png', , , , , ],
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
        colorset: "otherscape-self",
    },"d12");

        dice3d.addDicePreset({
        system: "legend",
        type: "d6",
        labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_greatness_color.png',
            '/modules/mist-hud/ui/dice/dice_raven_color.png', '5', '4', '3', '2', '1'],
        bumpMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_greatness_bump.png',
            '/modules/mist-hud/ui/dice/dice_raven_bump.png', , , , , ],
        colorset: "legend",
    },"d12");

    dsnSystemsReady = true;

    // Add all colorsets
    dice3d.addColorset({
        name: "city-of-mist",
        description: "City of Mist Default",
        category: "City of Mist",
        foreground: ["#e6e6e6", "#e6e6e6"],
        background: ["#705e9e", "#8b4939"],
        outline: ["#433a28", "#433a28"],
        texture: "stone",
        material: "plastic",
        font: "Modesto Condensed",
        visibility: "visible",
    });

    dice3d.addColorset({
        name: "otherscape-mythos",
        description: "Otherscape Mythos",
        category: "Otherscape",
        foreground: ["#e6e6e6"],
        background: ["#873fff"],
        outline: ["#7538ff"],
        texture: "fire",
        material: "metal",
        font: "Bruno Ace",
        visibility: "visible",
    });

    dice3d.addColorset({
        name: "otherscape-noise",
        description: "Otherscape Noise",
        category: "Otherscape",
        foreground: ["#e6e6e6"],
        background: ["#195fed"],
        outline: ["#04c5f5"],
        texture: "fire",
        material: "metal",
        font: "Bruno Ace",
        visibility: "visible",
    });

    dice3d.addColorset({
        name: "otherscape-self",
        description: "Otherscape Self",
        category: "Otherscape",
        foreground: ["#e6e6e6"],
        background: ["#e01054"],
        outline: ["#e0c2d8"],
        texture: "fire",
        material: "metal",
        font: "Bruno Ace",
        visibility: "visible",
    });

        dice3d.addColorset({
        name: "legend",
        description: "Legend in the Mist Default",
        category: "Legend in the Mist",
        foreground: ["#000000", "#000000", "#000000", "#000000"],
        background: ["#e9e1d6", "#828559", "#658686", "#c9ac89"],
        outline: ["#000000", "#000000", "#000000", "#000000"],
        edge: ["#f8f3eb", "#b6b694", "#719481", "#e9dcbc"],
        texture: "wood",
        material: "stone",
        font: "Times",
        visibility: "visible",
    });
});
