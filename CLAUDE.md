# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mist Engine HUD** is a Foundry VTT v13 module (`id: mist-hud`) providing an always-open HUD for the City of Mist, Otherscape, and Legend RPG systems. Players use it to select tags and statuses for rolls without menus or popups.

## Build & Development

**No build step required.** This is a pure Foundry VTT module — JS and CSS are loaded directly by Foundry at runtime.

- CSS is auto-applied by Foundry via the `styles` array in `module.json`. No compilation needed; edits to `.css` files take effect on browser refresh.
- System-specific CSS (`mh-city-of-mist.css`, `mh-otherscape.css`, `mh-legends-in-the-mist.css`) is injected dynamically at runtime by `mh-settings.js::applySystemCSS()` — these are NOT in `module.json`.
- Templates (`.hbs`) are loaded at runtime by Foundry. Use `foundry.applications.handlebars.loadTemplates()` (not the deprecated global `loadTemplates()`).
- To test: install/reload the module in Foundry VTT.

## Module Structure

```
scripts/         ES modules (12 files, load order matters — see module.json esmodules)
styles/          CSS files (base + system-specific)
templates/       Handlebars .hbs templates
lang/            en.json, pt-br.json
packs/           Foundry compendium (LevelDB) for bundled macros
data/            Status CSV data files
ui/              Button/icon images
```

## Architecture

### Script Load Order (module.json `esmodules`)
Order is critical — settings must initialize before other scripts depend on them:
1. `mh-settings.js` — registers all game settings, applies system CSS
2. `mh-theme-config.js` — move/slot configuration per system
3. `mh-dice.js` — Dice So Nice integration
4. `mist-hud.js` — main player HUD (`Application` subclass), global Handlebars helpers
5. `statusScreenApp.js` — status browser/importer
6. `mh-roll.js` — roll execution and burn-for-hit logic
7. `dynamite-panel.js` — dynamite mode toggle panel
8. `npc-hud.js` — NPC/threat HUD
9. `mh-load-moves.js` — hotbar macro loader
10. `npc-influence-manager.js` — GM NPC influence viewer
11. `npc-influence-functions.js` — NPC influence helpers
12. `token-status-notification.js` — visual drop notifications

### Key Patterns

**Actor Flag Persistence** — All player selections persist via actor flags:
```javascript
actor.getFlag('mist-hud', 'selected-tags')
actor.getFlag('mist-hud', 'status-states')
actor.getFlag('mist-hud', 'inverted-tags')
actor.getFlag('mist-hud', 'received-bonuses')
```

**HUD Registry** — Singleton per actor, stored in `globalThis.playerHudRegistry` (Map). Use `MistHUD.getOrCreateHudForActor(actor)` — never instantiate directly.

**Hook-Based Reactivity** — HUD re-renders on `controlToken`, `updateActor`, `createItem`, `updateItem`, `deleteItem` hooks.

**Socket Communication** — GM-mediated bonuses and NPC influences use `game.socket.on("module.mist-hud", ...)` so players can't spoof values.

**Multi-System Support** — Three systems (city-of-mist, otherscape, legend) share one codebase. System-specific behavior lives in `mh-theme-config.js` (move config) and `mh-settings.js` (CSS injection). Use `game.system.id` to branch when needed.

**Data Flow on Roll:**
```
User selects tags/statuses in HUD → stored in DOM + flags →
User clicks move → getSelectedRollData() collects state →
mh-roll.js executes roll → cleanHUD() burns/deletes temp items →
HUD re-renders from actor data
```

### Adding Scene Control Buttons

Scene control tool buttons are registered correctly — refer to existing working patterns in the codebase rather than guessing the API shape.

## Important Notes

- The `packs/mist-hud-macros/` directory is a LevelDB database — do not manually edit its files.
- jQuery is used extensively for DOM event handling in `activateListeners`.
- The `mh-getters.js` file is the canonical source for extracting actor/item data (themes, tags, statuses, improvements).
- Localization keys live in `lang/en.json`; always add new user-visible strings there.
