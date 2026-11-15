# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mist Engine HUD** is a Foundry VTT v13 module (`id: mist-hud`) providing an always-open HUD for the City of Mist, Otherscape, and Legend RPG systems. Players use it to select tags and statuses for rolls without menus or popups.

## Build & Development

**No build step required.** This is a pure Foundry VTT module — JS and CSS are loaded directly by Foundry at runtime.

- CSS is auto-applied by Foundry via the `styles` array in `module.json`. No compilation needed; edits to `.css` files take effect on browser refresh.
- System-specific CSS (`mh-city-of-mist.css`, `mh-otherscape.css`, `mh-legends-in-the-mist.css`) is injected dynamically at runtime by `settings.js` (`applySystemCSS`) — these are NOT in `module.json`.
- Templates (`.hbs`) are loaded at runtime by Foundry. Use `foundry.applications.handlebars.loadTemplates()` (not the deprecated global `loadTemplates()`).
- To test: install/reload the module in Foundry VTT.

## Module Structure

```
scripts/         ES modules (15 files — see module.json esmodules)
styles/          CSS files (base + system-specific)
templates/       Handlebars .hbs templates
lang/            en.json, pt-br.json
data/            Status CSV data files
ui/              Button/icon images
```

## Architecture

### Scripts (module.json `esmodules`, in load order)
- `constants.js` — `MODULE_ID`, `FLAG_KEYS`
- `settings.js` — registers game settings, applies system CSS
- `move-layout.js` — move/slot configuration per system
- `hud-state.js` — per-HUD state (`HUDState`), `hudKey()`/`resolveActorByKey()`, HUD registry, `isTagBurned()`, builds the `CityRoll` selection
- `getters.js` — canonical source for extracting actor/item data (themes, tags, statuses, improvements)
- `notifications.js` — drop/status notifications
- `bonus-manager.js` — GM-mediated Help/Hurt bonuses
- `npc-helpers.js`, `npc-influence.js`, `npc-influence-manager.js` — NPC data, influence cache, GM influence viewer
- `status-screen.js` — status browser/importer
- `player-hud.js` — player HUD (`PlayerHUD`, ApplicationV2 + Handlebars mixin), `getOrCreateHud(actor)`
- `npc-hud.js` — NPC/threat HUD, `syncSceneInfluences()`
- `mh-dice.js` — Dice So Nice integration
- `init.js` — hooks, sockets, scene controls, canvas drops (loaded last)

### Key Patterns

**Actor Flag Persistence** — All player selections persist via actor flags (keys in `FLAG_KEYS`):
```javascript
actor.getFlag('mist-hud', 'selected-tags')
actor.getFlag('mist-hud', 'status-states')
actor.getFlag('mist-hud', 'inverted-tags')
actor.getFlag('mist-hud', 'received-bonuses')
```

**HUD Registry** — One HUD per `hudKey(actor)` (token id for unlinked tokens, actor id otherwise), kept in `playerHudRegistry` (`hud-state.js`). Use `getOrCreateHud(actor)` from `player-hud.js` — never instantiate directly. Help/Hurt bonuses stay on the world actor (`bonusActorFor`).

**Hook-Based Reactivity** — HUDs re-render on `controlToken`, `updateActor`, `createItem`, `updateItem`, `deleteItem` hooks (`init.js`).

**Socket Communication** — GM-mediated bonuses, NPC influences and drops from non-owners use `game.socket.on("module.mist-hud", ...)` so players can't spoof values.

**Multi-System Support** — Three systems (city-of-mist, otherscape, legend) share one codebase. System-specific behavior lives in `move-layout.js` (move config) and `settings.js` (CSS injection). Use `game.system.id` to branch when needed.

**Data Flow on Roll:**
```
User selects tags/statuses in HUD → stored in DOM + flags →
User clicks move → HUDState builds the selected list →
the system's CityRoll executes the roll →
post-roll cleanup resets leftover state → HUD re-renders from actor data
```

### Adding Scene Control Buttons

Scene control tool buttons are registered correctly — refer to existing working patterns in the codebase rather than guessing the API shape.

## Important Notes

- All windows (Player HUD, NPC HUD, Status Screen, Influence Viewer) are ApplicationV2 with HandlebarsApplicationMixin; jQuery is still used inside `_onRender` for listeners.
- The `getters.js` file is the canonical source for extracting actor/item data (themes, tags, statuses, improvements).
- Localization keys live in `lang/en.json`; always add new user-visible strings there.
