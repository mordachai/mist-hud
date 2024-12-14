export const DENOMINATION = "6";

export class D6toD12 extends foundry.dice.terms.Die {
  constructor(termData) {
    super({ ...termData, faces: 12 });
  }

  static DENOMINATION = "6";
}

// Register the custom die term with Foundry VTT
CONFIG.Dice.terms["6"] = D6toD12;

// Initialization after Dice So Nice is ready
Hooks.once('diceSoNiceReady', (dice3d) => {
  // Auxiliary function to create systems
  const createSystem = (id, name, group) => {
      dice3d.addSystem({ id, name, group });
  };

  // Auxiliary function to create dice presets
  const createDicePreset = (options, type = "d6") => {
      dice3d.addDicePreset(options, type);
  };

  // Auxiliary function to create colorsets
  const createColorset = (colorset) => {
      dice3d.addColorset(colorset);
  };

  // Define systems
  const systems = [
      { id: "city-of-mist", name: "City of Mist", group: "City of Mist" },
      { id: "otherscape-mythos", name: "Otherscape Mythos", group: "Otherscape" },
      { id: "otherscape-noise", name: "Otherscape Noise", group: "Otherscape" },
      { id: "otherscape-self", name: "Otherscape Self", group: "Otherscape" },
  ];

  systems.forEach(system => createSystem(system.id, system.name, system.group));

  // Define presets
  const presets = [
      {
          system: "city-of-mist",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_logos_color.png',
              '/modules/mist-hud/ui/dice/dice_mythos_color.png', '5', '4', '3', '2', '1'],
          bumpMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_logos_bump.png',
              '/modules/mist-hud/ui/dice/dice_mythos_bump.png', , , , , ],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_logos_emissive.png',
              '/modules/mist-hud/ui/dice/dice_mythos_emissive.png', , , , , ],
          emissive: 0xdc39ff,
          emissiveIntensity: 0.25,
          colorset: "city-of-mist",
      },
      {
          system: "otherscape-mythos",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-mythos_color.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-mythos_color.png', '5', '4', '3', '2', '1'],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-mythos_emissive.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-mythos_emissive.png', , , , , ],
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          colorset: "otherscape-mythos",
      },
      {
          system: "otherscape-noise",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-noise_color.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-noise_color.png', '5', '4', '3', '2', '1'],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-noise_emissive.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-noise_emissive.png', , , , , ],
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          colorset: "otherscape-noise",
      },
      {
          system: "otherscape-self",
          type: "d6",
          labels: ['1', '2', '3', '4', '5', '/modules/mist-hud/ui/dice/dice_otherscape-self_color.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-self_color.png', '5', '4', '3', '2', '1'],
          emissiveMaps: [, , , , , '/modules/mist-hud/ui/dice/dice_otherscape-self_emissive.png',
              '/modules/mist-hud/ui/dice/dice_otherscape-self_emissive.png', , , , , ],
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
          colorset: "otherscape-self",
      }
  ];

  presets.forEach(preset => createDicePreset(preset, "d12"));

  // Define colorsets
  const colorsets = [
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      }
  ];

  colorsets.forEach(colorset => createColorset(colorset));
});