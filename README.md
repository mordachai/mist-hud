# Mist Engine HUD

**Mist Engine HUD:** is a simple always-open, never-in-the-way HUD for _City of Mist_ and _Otherscape_ game systems made [by Taragnor for Foundry](https://foundryvtt.com/packages/city-of-mist). It allows players to quickly select tags and statuses and do the Moves rolls, no questions or menus menus to answer. Just select what you need and roll using the Moves in the hotbar. Fast and streamlined like any _action-packed game_ should be!

![image](https://github.com/user-attachments/assets/dd7544e7-1eca-43c5-85fb-0c4e6be58942)

## Features

- **Always-visible HUD**: Provides quick access to theme tags and statuses. You only have to select a PC token
- **Danger/Threats HUD**: Keep the enemies close and at hand (see image below)
- **Four Awesome Dice Sets**: the characteristic modified D12 with faces from one to six. One set for _City of Mist_ and three others for _Otherscape_: Noise, Mythos, and Self
- **Hotbar Integration**: Auto-loads macros for core moves and cinematic moves: core moves on page 1 and cinematic moves on page 2 of the Macro Hotbar
- **Quick Roll Support**: Allows rolling with selected tags and themes without navigating away from the HUD
- **Draggable**: Drag it around, see your game while playing it!
- **Dynamite Moves Control Panel**: an easy way for the MC to determine which move is Dynamite for a character (see image below)

![image](https://github.com/user-attachments/assets/24aca9a7-77a9-49a3-a587-d90963f45593)


## Installation

In Foundry VTT, go to the Add-on Modules tab and click Install Module. Then:

1. Search in the top bar for "mist hud" and click on the Install button of the module
2. Enable the module in your Game Settings under Manage Modules

OR

1. Paste the following manifest URL into the bottom Manifest URL field:

    https://github.com/mordachai/mist-hud/raw/main/module.json

2. Enable the module in your Game Settings under Manage Modules

## Usage

Once installed and activated, the HUD will automatically appear when a character token is selected.

### Rolling a Move: Tags and Statuses

![image](https://github.com/user-attachments/assets/b7a3140e-e2d7-4fc7-90be-367f229b9d52)

1. Select your character token.
2. Choose tags (Power/Weakness) from the HUD.
    - You can mark a tag to be burned on the next roll (+3). Burned tags cannot be selected, click on the fire icon again to "unburn" the tag.
3. Choose statuses. Click over them to toggle if they are positive, negative, or neutral:
    - Yellow / Blue (+): will add to the tags calculated in the roll
    - Orange /  (-): will subtract from the tags calculated in the roll
    - Grey (0): will do nothing to the roll. If a tag has no use in the next roll let it be like this
4. Click the corresponding move macro in the macro hotbar.

_**Note:** Check how on the roll card in the chat window the total modifier (⚡) displays the correct value with the status and tags summed up after the roll._

![image](https://github.com/user-attachments/assets/df4d8706-5794-45bd-ac39-d0c8a7258e47)

The results and move effects will be automatically displayed in the chat.

### Dynamite Move Control Panel

To assign the _Dynamite!_ trait to any Core Move, run the **Dynamite Move Control Panel** macro from the **HUD Macros compendium**. 

When a roll of 12+ is made with a _Dynamite_ move, the roll effects will display the dynamite rules and a 🧨 symbol will appear on the roll card in the chat.

![image](https://github.com/user-attachments/assets/26816df4-fd6f-45f6-bbb8-6dacc3d95368)


## Known Issues

- The inputs are not bidirectional. Use the normal character sheet to register anything, the only purpose of the HUD is to make rolls easier and fast. Be especially aware of your burned tags.

## Compatibility

This module is designed for Foundry VTT version 12.0 or higher and the City of Mist system.

## License

This project is licensed under the MIT License. See the file for more details.
