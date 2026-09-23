# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build System

```bash
npm run build
```

This runs TypeScript compilation (`tsc`) and copies all static assets (CSS, JSON, templates, images, fonts, audio) to `dist/`. The output entry point is `dist/city-of-mist/module/city.js`.

CSS files are copied as-is — no preprocessing needed. Do not attempt to compile CSS manually.

Linting:
```bash
npx eslint src/
```

## Architecture Overview

This is a **Foundry VTT system** for the City of Mist RPG (and related Mist Engine games). Source lives in `src/city-of-mist/`.

### Multi-System Plugin Architecture

The system supports three game rulesets via a plugin pattern:
- **CoMSystem** (`com-system.ts`) — City of Mist rules
- **OtherscapeSystem** (`otherscape.ts`) — Otherscape
- **LitMSystem** (`litm-system.ts`) — Legend in the Mist

All extend `BaseSystemModule` (`systemModule/baseSystemModule.ts`), which defines the interface for system-specific rules, theme types, and localization. The active system module is initialized at `Hooks.once("init")` in `city.ts`.

### Core Data Layer

- **`city-actor.ts`** — Extends Foundry's `Actor`; manages PCs, Dangers, Crew, and Extras. Themes, tags, statuses, and improvements are items embedded on actors.
- **`city-item.ts`** — Extends Foundry's `Item`; handles all item types: Theme, Tag, Move, Status, Improvement, Clue, Juice, etc.
- **`datamodel/`** — Foundry v12+ `DataModel` definitions for each actor/item type (type-safe schema definitions separate from the class logic).

### Sheets and UI

- `city-character-sheet.ts`, `city-threat-sheet.ts`, `city-crew-sheet.ts` — Actor sheets
- `city-item-sheet.ts` — Item sheet
- `templates/` — 100+ Handlebars `.hbs` templates; `templates/parts/` contains reusable partials
- Template preloading is done in `city-templates.ts`

### Rolling System

`city-roll.ts` implements the dice system. Rolls are modified by selected tags (yellow = bonus, red = penalty, right-click toggles) and statuses.

### Settings and Config

- `settings.ts` — Registers Foundry game settings
- `config/system-module.ts` — System-agnostic rule configuration
- `config/tag-categories.ts`, `config/status-categories.ts` — Category definitions

### Key Utilities

- `city-db.ts` — Wrapper for accessing compendium/world themes and moves
- `tools/handlebars-helpers.js` — Custom Handlebars helpers registered at init

## Foundry API Notes

- Use `foundry.applications.handlebars.loadTemplates()` — **not** the deprecated global `loadTemplates()`.
- The system targets Foundry v13 (minimum 13, verified 13.351).
- Socket support is enabled in `system.json` for multi-client communication.

## Initialization Flow

1. `Hooks.once("init")` in `city.ts` → registers DataModels, initializes the SystemModule, loads settings, preloads Handlebars templates, registers scene tools
2. `Hooks.once("ready")` → initializes sockets and runtime systems

## Localization

Seven languages supported under `lang/`: `en`, `de`, `pl`, `pt-br`, `fr`, `it`, `es`. Add new strings to all relevant files when adding user-facing text.

## Compendium Packs

Under `packs/`: `themebooks` (items), `sampledangers` (actors), `macro`, `documentation`. These are Foundry LevelDB packs included in the build output.
