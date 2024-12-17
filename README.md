# Mist Engine HUD

**Mist Engine HUD:** is a simple always-open, never-in-the-way HUD for _City of Mist_ and _Otherscape_ game systems made [by Taragnor for Foundry](https://foundryvtt.com/packages/city-of-mist). It allows players to quickly select tags and statuses and do the Moves rolls, with no questions or menus to answer. Just select what you need and roll using the Moves in the hotbar. Fast and streamlined like any _action-packed game_ should be! ([this module completely replaces the CoM Character HUD](https://github.com/mordachai/com-hud)).

![image](https://github.com/user-attachments/assets/dd7544e7-1eca-43c5-85fb-0c4e6be58942)

## Features

- **Always-visible HUD**: Provides quick access to theme tags and statuses. You only have to select a PC token
- **Danger/Threats HUD**: Keep the enemies close and at hand (see image below)
![image](https://github.com/user-attachments/assets/24aca9a7-77a9-49a3-a587-d90963f45593)

- **Four Awesome Dice Sets**: the caracteristic modified D12 with faces from one to six. One set for _City of Mist_ and three others for _Otherscape_: Noise, Mythos, and Self
![image](https://github.com/user-attachments/assets/25d11478-1971-4e48-bec6-f4214f13f607)

- **Hotbar Integration**: Auto-loads macros for core moves and cinematic moves: core moves on page 1 and cinematic moves on page 2 of the Macro Hotbar
- **Quick Roll Support**: Allows rolling with selected tags and themes without navigating away from the HUD
- **Draggable**: Drag it around, see your game while playing it!
- **Dynamite Moves Control Panel**: an easy way for the MC to determine which move is Dynamite for a character (see image below)




## Installation

In Foundry VTT, go to the Add-on Modules tab and click Install Module. Then:

1. Search in the top bar for "mist hud" and click on the Install button of the module
2. Enable the module in your Game Settings under Manage Modules

OR

1. Paste the following manifest URL into the bottom Manifest URL field:

    https://github.com/mordachai/mist-hud/raw/main/module.json

2. Enable the module in your Game Settings under Manage Modules

## Usage


Once installed and activated, the HUD will automatically appear when a character token is selected **(right click for NPCs)**.

### Rolling a Move: Tags! Statuses! Roll!

![image](https://github.com/user-attachments/assets/7238d5a3-5cab-45ee-a5be-fddd352aa097)

1. Select your character token. MCs: Click on Dangers/Threats with the right button. NPCs HUD doesn't affect rolls (for now).
2. Choose TAGS (Power/Weakness) from the HUD. SCENE Tags and Statuses can be used, select them normally.
    - You can mark a tag to be burned on the next roll (+3). Burned tags cannot be selected, click on the fire icon again to "unburn" the tag.
    - Invert a weakness to be used as a _power tag_ by clicking on the double arrow icon
3. Choose STATUSES. Click on them to toggle if they are positive, negative, or neutral (CoM/Otherscape):
    - Yellow / Blue (+): will add to the roll result
    - Red / Orange  (-): will subtract from the roll result
    - No Color (0): will do nothing to the roll. If a status has no use in the next roll let it be like this

4. Click the corresponding move macro in the macro hotbar. There are moves for City of Mist and Otherscape available, depending on the selected system in the City of Mist game settings.

![image](https://github.com/user-attachments/assets/df4d8706-5794-45bd-ac39-d0c8a7258e47)

Roll results, outcomes, and move effects will be displayed on the chat. Clicking on the modifiers below the roll results shows the used tags and statuses.
Clicking on the Tracked Outcomes (Otherscape) displays suggested tags.

![image](https://github.com/user-attachments/assets/6d5bfdec-84f9-4320-b73c-6196ff38c30b)
 
### Dynamite Move Control Panel

To assign the _Dynamite!_ trait to any Core Move of City of Mist, run the **Dynamite Move Control Panel** macro from the **HUD Macros compendium**. 

When a roll of 12+ is made with a _Dynamite_ move, the roll effects will display the dynamite rules and a 🧨 symbol will appear on the roll card in the chat.

![image](https://github.com/user-attachments/assets/262546e9-5460-4ecc-af36-d1ed21f20362)


## Known Issues

- The inputs are not bidirectional. Use the normal character sheet to register anything, the only purpose of the HUD is to make rolls easier and quick. Be especially aware of your burned tags.
- NPCs (Dangers/Threats) don't affect rolls. Use the modifier at the HUD bottom to automatically affect players' rolls.

## Compatibility

This module is designed for Foundry VTT version 12.0 or higher and the City of Mist system.

## License

This project is licensed under the MIT License. Check the LICENSE file for more details.
