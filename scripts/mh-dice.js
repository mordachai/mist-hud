export const DENOMINATION = "6";

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
    });

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
    });

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
    });

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
    });

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
});
