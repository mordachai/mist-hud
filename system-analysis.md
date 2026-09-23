# City of Mist – System Deep Analysis

Reference document for module development against the City of Mist Foundry VTT system (v4.2.x).

> **Multi-system coverage:** City of Mist, Otherscape, Legend in the Mist, Mist Engine base.

---

## Table of Contents
1. [APIs – Key Classes and Methods](#1-apis)
2. [Rolls – Initiating and Processing](#2-rolls)
3. [Dialogs](#3-dialogs)
4. [Config and Settings](#4-config-and-settings)
5. [prepareData / getData / Template Context](#5-preparedata--getdata--template-context)
6. [Sheet Modification](#6-sheet-modification)
7. [Scene Tags](#7-scene-tags)
8. [Hooks](#8-hooks)
9. [Socket System](#9-socket-system)
10. [Multi-System Architecture](#10-multi-system-architecture)
11. [Data Models – Full Field Reference](#11-data-models--full-field-reference)
12. [CSS – Per-System Classes and Variables](#12-css--per-system-classes-and-variables)
13. [System-Specific Items](#13-system-specific-items)
14. [isSystemCompatible](#14-issystemcompatible)
15. [effect_class Reference](#15-effect_class-reference)
16. [Theme Subtypes Per System](#16-theme-subtypes-per-system)
17. [Move Categories and Types](#17-move-categories-and-types)
7. [Scene Tags](#7-scene-tags)
8. [Hooks](#8-hooks)
9. [Socket System](#9-socket-system)

---

## 1. APIs

### CityActor

```typescript
// Theme Management
actor.getTheme(id: string): Theme | undefined
actor.getThemes(): Theme[]
actor.getNumberOfThemes(target_type: ThemeType): number
actor.createNewTheme(name, themebook, isExtra?): Promise<Theme>
actor.deleteTheme(themeId, awardBU?): Promise<void>

// Tag Management
actor.getTag(id): Tag | undefined
actor.getTags(themeId?, subtype?): Tag[]
actor.getStoryTags(): Tag[]
actor.burnTag(id, state?): Promise<void>
actor.createStoryTag(name?, preventDuplicates?, options?): Promise<Tag | null>
actor.deleteTag(tagId, options?): Promise<void>

// Status Management
actor.getStatus(id): Status | undefined
actor.getStatuses(): Status[]
actor.hasStatus(name): Status | undefined
actor.createNewStatus(name, tier?, pips?, options?): Promise<Status>
actor.addOrCreateStatus(name, options): Promise<Status>
actor.deleteStatus(id): Promise<void>
actor.deleteStatusByName(name): Promise<void>

// Clues & Juice
actor.clues: Clue[]
actor.juice: Juice[]
actor.helpPoints: Juice[]
actor.hurtPoints: Juice[]
actor.createClue(metaSource?, clueData?): Promise<boolean>
actor.createNewJuice(name, subtype?): Promise<CityItem>
actor.spendJuice(id, amount?): Promise<void>

// Improvements
actor.getImprovements(themeId?): Improvement[]
actor.getAllImprovements(): Improvement[]
actor.addImprovement(theme_id, number): Promise<CityItem>
actor.deleteImprovement(impId): Promise<void>

// Attention / Fade / Milestone (Theme-level on actor)
actor.addAttention(themeId, amount?): Promise<number>
actor.removeAttention(themeId, amount?): Promise<number>
actor.addFade(themeId, amount?): Promise<boolean>
actor.removeFade(themeId, amount?): Promise<boolean>
actor.addMilestone(themeId, amount?): Promise<boolean>
actor.removeMilestone(themeId, amount?): Promise<number>

// Build-Up (PC only)
actor.incBuildUp(amount?): Promise<number>
actor.decBuildUp(amount?): Promise<number>
actor.getBuildUp(): number
actor.getBuildUpImprovements(): Improvement[]

// GM Moves (Danger/Threat only)
actor.getGMMoves(depth?): GMMove[]
actor.getGMMove(id): GMMove | undefined
actor.executeGMMove(move, actor?): Promise<void>
actor.createNewGMMove(name, systemData?): Promise<GMMove>

// Utility
actor.getDisplayedName(): string
actor.displayedName: string
actor.toggleLockState(): Promise<void>
actor.isDanger(): boolean
actor.isPC(): boolean
actor.isCrew(): boolean
```

### CityItem

```typescript
// Type guards
item.isTag(): this is Tag
item.isTheme(): this is Theme
item.isStatus(): this is Status
item.isImprovement(): this is Improvement
item.isMove(): this is Move
item.isThemeBook(): this is Themebook
item.isThemeKit(): this is ThemeKit
item.isGMMove(): this is GMMove
item.isClue(): this is Clue
item.isJuice(): this is Juice

// Tags
tag.burnTag(state?): Promise<void>
tag.isBurned(): boolean
tag.isBurnable: boolean
tag.isPowerTag(): boolean
tag.isWeaknessTag(): boolean
tag.isBonusTag(): boolean
tag.isStoryTag(): boolean
tag.isTemporary(): boolean
tag.toggleLoadoutActivation(): Promise<boolean>

// Themes
theme.tags(): Tag[]
theme.improvements(): Improvement[]
theme.getCrack(): number
theme.getAttention(): number
theme.getBuildUpValue(): number
theme.getThemebook(): Themebook | ThemeKit | null
theme.getThemebookOrTK(): Themebook | ThemeKit | null
theme.getThemeType(): ThemeType
theme.addFade(amount?): Promise<boolean>
theme.addAttention(amount?): Promise<number>
theme.resetFade(): Promise<void>
theme.toggleThemeType(): Promise<void>

// Statuses
status.tier: number
status.pips: number
status.tierString: string
status.pipString: string
status.addStatus(tier, options): Promise<Status>
status.subtractStatus(tier, replacename?): Promise<void>
status.setBoxesChecked(boxes): Promise<void>

// Themebooks
themebook.themebook_getTagQuestions(type?): QuestionData[]
themebook.themebook_getImprovements(): ImprovementData[]

// Static – move text generation
CityItem.generateMoveText(movedata, result, power?): string
CityItem.generateMoveList(movedata, result, power?): MoveListItem[]
CityItem.getMaxChoices(movedata, result, power?): number
```

### CityDB

```typescript
// Themebooks
CityDB.themebooks: Themebook[]             // active/compatible only
CityDB.getThemebook(name, id?): Themebook  // throws if not found
CityDB.getLoadoutThemebook(): Themebook | undefined

// Moves
CityDB.movesList: Move[]
CityDB.getMoveById(id): Move | undefined

// Danger Templates
CityDB.dangerTemplates: Danger[]
CityDB.getDangerTemplate(id): Danger | undefined

// Build-Up Improvements
CityDB.getBuildUpImprovements(): Improvement[]

// Essences (Otherscape)
CityDB.essences(): Essence[]
CityDB.getEssence(id): Essence | undefined
CityDB.getEssenceBySystemName(name): Essence | undefined

// Utilities
CityDB.getTagOwnerById(id): CityActor | Scene
CityDB.waitUntilLoaded(): Promise<void>
CityDB.isLoaded(): boolean
```

---

## 2. Rolls

### Initiating a Roll

```typescript
import { CityRoll } from "./city-roll.js";

// Option A – static shortcut (fires the full dialog + roll)
await CityRoll.execMove(moveId, actor, selectedList?, options?);

// Option B – instance (more control)
const roll = new CityRoll(moveId, actor, selectedList?, options?);
await roll.execMove();   // shows pre-roll dialog then rolls
// or
await roll.execRoll();   // skips dialog, rolls immediately
```

`moveId` is the Foundry item ID of a Move item. Retrieve with:
```typescript
CityDB.getMoveById(id)               // from DB
game.items.find(i => i.name == "...")  // from world items
```

### ActivatedTagFormat (selectedList entries)

```typescript
type ActivatedTagFormat = {
  id: string;          // Tag or Status item id
  type: "tag" | "status";
  amount: number;      // +1 power tag / -1 weakness / tier for status
  ownerId: string;     // Actor id that owns this tag
  subtype?: string;    // "power" | "weakness" | "bonus" | "help" | "hurt"
  strikeout?: boolean;
}
```

### Roll Options (MistRoll["options"])

```typescript
{
  noRoll?: boolean           // Skip dice, use power only
  noTags?: boolean
  noStatus?: boolean
  noPositiveTags?: boolean
  noHelpHurt?: boolean
  burnTag?: string           // ID of tag to burn on this roll
  setRoll?: number           // Force dice result
  dynamiteAllowed?: boolean
  modifier?: number          // Flat bonus/penalty
  powerModifier?: number     // Alt-power adjustment
  themeTypes?: ThemeType[]   // Restrict to theme class
  BlazeThemeId?: string      // Active extra/loadout theme id
}
```

### Roll Result Types

```
"Dynamite"  – total >= 12 (if dynamiteAllowed)
"Success"   – total >= 10
"Partial"   – total >= 7
"Failure"   – total < 7
```

Auto-fail on 2 / auto-success on 12 can be enabled via the `autoFail_autoSuccess` setting.

### Power Calculation

Standard (City of Mist):
```
power = sum(tag amounts) + sum(status amounts)
      → capped by weakness cap if a weakness tag is active
      → grit penalty applied if gritMode is on
```

Alt-power (Otherscape / altPower setting):
```
power = 2  (or 3 if a tag is burned)
      + powerModifier
```

### Post-Roll Side Effects
- Temporary tags/statuses burned/deleted (`handleTempItems` setting)
- Weakness tags auto-award attention (`autoWeakness` setting)
- Juice/help-hurt spent via socket session
- Clue boxes created if `clueBoxes` setting is active

---

## 3. Dialogs

### CityDialogs (static helpers)

```typescript
// Pick a themebook for a new theme
await CityDialogs.themeBookSelector(actor): Promise<Themebook | ThemeKit | null>

// Pick tag or improvement from a theme
await CityDialogs.improvementOrTagChoiceList(actor, theme, itemtype, subtype?): Promise<string | null>

// Create or edit a status
await CityDialogs.getStatusData(initialData?): Promise<CreatedStatusData>

// Create a tag with options
await CityDialogs.getTagCreationData(initialData?): Promise<CreatedTagData>

// Juice selection panel
await CityDialogs.getHelpHurt(): Promise<JuiceSelectionResult>

// Show a GM move text box
await CityDialogs.GMMoveTextBox(title, html, options?): Promise<boolean>
```

### Custom Dialog Pattern

```typescript
const html = await foundry.applications.handlebars.renderTemplate(
  "systems/city-of-mist/templates/dialogs/my-dialog.hbs",
  { data }
);

return new Promise((resolve) => {
  new Dialog({
    title: "My Dialog",
    content: html,
    buttons: {
      ok: {
        label: "OK",
        callback: (html) => resolve($(html).find("[name=value]").val())
      },
      cancel: { label: "Cancel", callback: () => resolve(null) }
    },
    default: "cancel"
  }).render(true);
});
```

---

## 4. Config and Settings

### Reading Settings

```typescript
import { CitySettings } from "./settings.js";

CitySettings.get("baseSystem")          // "city-of-mist" | "otherscape" | "legend" | "custom"
CitySettings.get("movesInclude")        // which moves are loaded
CitySettings.get("gritMode")            // boolean
CitySettings.get("autoFail_autoSuccess")// boolean
CitySettings.get("altPower")            // boolean
CitySettings.get("autoWeakness")        // boolean
CitySettings.get("weaknessCap")         // number
CitySettings.get("tagBurn")             // "classic" | "mist-engine"
CitySettings.get("statusAdditionSystem")// "classic" | "classic-commutative" | "mist-engine"
CitySettings.get("statusDisplay")       // "tier-only" | "tier+pips" | "tier+circles"
CitySettings.get("handleTempItems")     // "none" | "burn" | "all"
CitySettings.get("tagCreationCost")     // number (power spent to create a tag)
CitySettings.get("statusCreationCost")  // number
CitySettings.get("themeStyle")          // "city-of-mist" | "mist-engine"
CitySettings.get("loadoutTheme")        // boolean
CitySettings.get("clueBoxes")           // "none" | "whisper" | "public"
CitySettings.get("collectiveMechanics") // "city-of-mist" | "mist-engine"
CitySettings.get("gmmoveheaders")       // "text" | "symbols" | "none"
CitySettings.get("devMode")             // boolean
```

### Convenience Methods

```typescript
CitySettings.getBaseSystem(): BaseSystem
CitySettings.isGritMode(): boolean
CitySettings.isAutoWeakness(): boolean
CitySettings.getWeaknessCap(): number
CitySettings.getStatusAdditionSystem()
CitySettings.useClueBoxes(): boolean
CitySettings.whisperClues(): boolean
CitySettings.isOtherscapeStatuses(): boolean
CitySettings.isOtherscapeBurn(): boolean
await CitySettings.refreshSystem(system?)  // reload after change
```

### Writing a Setting

```typescript
await CitySettings.set("devMode", true);
```

### SystemModule

```typescript
import { SystemModule } from "./config/system-module.js";

SystemModule.active          // currently active SystemModuleI
SystemModule.themeTypes()    // { Mythos: "Mythos", Logos: "Logos", ... }
SystemModule.allThemeTypes() // all possible theme types
SystemModule.themeIncreaseName(theme)  // "Attention" | "Blaze" | ...
SystemModule.themeDecreaseName(theme)  // "Fade" | "Crack" | ...
SystemModule.isLoadoutThemeType(themeType): boolean
SystemModule.setActive(systemName): Promise<boolean>

// Register a custom rules system from a module
Hooks.once("registerRulesSystemPhase", (SystemModule) => {
  SystemModule.registerRulesSystem(new MySystem());
});
```

---

## 5. prepareData / getData / Template Context

### getData() chain

All sheets ultimately call `super.getData()` (Foundry's ActorSheet), then add:

```typescript
// CityActorSheet.getData() adds:
data.storyTags        // actor.getStoryTags()
data.gmnotes          // enriched HTML
data.description      // enriched HTML
data.biography        // enriched HTML

// System data comes from:
data.actor            // the CityActor instance
data.actor.system     // typed system data (see datamodel/)
data.items            // embedded items
```

### Character Sheet Context (CityCharacterSheet)
Additional context for PC sheets (read `city-character-sheet.ts` for full list):
- `themes` – active themes
- `extras` – extra themes (loadout, crew)
- `improvements` – build-up improvements
- `buildUp` – current build-up value
- `movesList` – CityDB.movesList (for roll buttons)

### Threat Sheet Context (CityThreatSheet)
- `moves` – actor.getGMMoves()
- `statuses` – actor.getStatuses()
- `tags` – actor.getTags()

### Enriching HTML in getData()

```typescript
const textOptions = { secrets: this.actor.isOwner, async: true, relativeTo: this.actor };
data.myField = await TextEditor.enrichHTML(this.actor.system.myField, textOptions);
```

---

## 6. Sheet Modification

### Sheet Class Hierarchy

```
ActorSheet (Foundry)
  └── CitySheet           (city-sheet.ts)
        ├── CityActorSheet       (city-actor-sheet.ts)
        │     ├── CityCharacterSheet  (city-character-sheet.ts)
        │     ├── CityThreatSheet     (city-threat-sheet.ts)
        │     └── CityCrewSheet       (city-crew-sheet.ts)
        └── CityItemSheet        (city-item-sheet.ts)
```

### Adding Listeners from a Module

Hook into `renderCityCharacterSheet` (or `renderCityThreatSheet`, etc.):

```typescript
Hooks.on("renderCityCharacterSheet", (app, html, data) => {
  html.find(".my-selector").on("click", async (ev) => {
    const actorId = app.actor.id;
    // ... handle event
  });
});
```

### Adding HTML to Sheets

```typescript
Hooks.on("renderCityCharacterSheet", async (app, html, data) => {
  const extra = await foundry.applications.handlebars.renderTemplate(
    "modules/my-module/templates/extra-section.hbs",
    { actor: app.actor }
  );
  html.find(".sheet-body").append(extra);
});
```

### defaultOptions Pattern

```typescript
static override get defaultOptions() {
  return foundry.utils.mergeObject(super.defaultOptions, {
    classes: ["city", "sheet", "actor"],
    template: "systems/city-of-mist/templates/...",
    width: 990,
    height: 1070,
    tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "themes" }]
  });
}
```

### Universal HTML Handlers

`universal-html-handlers.ts` exposes `HTMLHandlers.applyBasicHandlers(html)` which wires up standard CoM interactions. Call `super.activateListeners(html)` to ensure this runs.

---

## 7. Scene Tags

### Storage

Scene tags/statuses are stored on a hidden **Scene Container actor** named `"__SCENE_CONTAINER__"` of type `"threat"`, one per scene. The actor's items are the scene's tags and statuses.

### SceneTags API

```typescript
import { SceneTags } from "./scene-tags.js";

// Get the container actor for the current (or any) scene
const container = await SceneTags.getSceneContainer(scene?);
const container = SceneTags.getSceneContainerSync(scene?);  // sync version

// Retrieve scene items
const items    = await SceneTags.getSceneTagsAndStatuses(scene?): Promise<(Tag | Status)[]>
const tags     = await SceneTags.getSceneStoryTags(scene?):       Promise<Tag[]>
const statuses = await SceneTags.getSceneStatuses(scene?):        Promise<Status[]>

// Create scene items
await SceneTags.createSceneTag(name?, preventDuplicates?, options?): Promise<Tag | null>
await SceneTags.createSceneStatus(name?, options?): Promise<Status>
await SceneTags.statusDrop(name, options): Promise<void>
```

### Scene Tag Hooks

```typescript
// Fired when a scene tag/status is created
Hooks.on("createSceneItem", (tag: Tag | Status, scene: Scene) => { ... });

// Fired when the scene tag display should refresh
Hooks.on("updateSceneTags", (items: CityItem[]) => { ... });
```

### Accessing Scene Tags from Any Actor

Any actor can call `actor.getStoryTags()` — for the scene container this returns the scene's story tags. The `getStoryTags()` method on `CityActorSheet.getData()` pulls from the scene container automatically when populating the sheet.

---

## 8. Hooks

### System-Defined Hooks

| Hook | Signature | When |
|------|-----------|------|
| `cityDBLoaded` | `() => void` | CityDB finishes loading all packs |
| `themebooksLoaded` | `() => void` | Themebooks list is ready |
| `movesLoaded` | `() => void` | Move list is ready |
| `themeCreated` | `(actor, theme) => void` | A new theme is added to an actor |
| `createSceneItem` | `(item, scene) => void` | Tag/status added to scene container |
| `updateSceneTags` | `(items) => void` | Scene tag display needs refresh |
| `registerRulesSystemPhase` | `(SystemModule) => void` | System init, register custom game systems |

### Foundry Hooks the System Listens To

```typescript
Hooks.once("init", ...)         // Register data models, settings, sheets
Hooks.once("ready", ...)        // Init sockets, CityDB, SceneTags, etc.
Hooks.on("updateActor", ...)    // CityDB cache refresh
Hooks.on("updateItem", ...)     // CityDB cache refresh
Hooks.on("createItem", ...)     // CityDB cache refresh
Hooks.on("deleteItem", ...)     // CityDB cache refresh
Hooks.on("createScene", ...)    // Create scene container
Hooks.on("deleteScene", ...)    // Delete scene container
Hooks.on("canvasReady", ...)    // Refresh scene tag display
Hooks.on("renderChatMessageHTML", ...)  // Wire up roll message buttons
```

### Waiting for the DB

Always wait for the DB before accessing themebooks/moves in module init:

```typescript
Hooks.on("cityDBLoaded", () => {
  const books = CityDB.themebooks;
  // safe to use
});
// or
await CityDB.waitUntilLoaded();
```

---

## 9. Socket System

### Overview

The system uses a wrapper around Foundry's `game.socket` called `SocketInterface` (from `tools/`). Communication is session-based: a **Master** session runs on the GM client and coordinates **Slave** sessions on player clients.

### Init

```typescript
// Already done in city.ts on "ready". For reference:
CitySockets.init();
// Registers: JuiceMasterSession, TagReviewMasterSession,
//            TagAndStatusCleanupSessionM, DowntimeSessionM, etc.
```

### Executing a Session

```typescript
import { CitySockets } from "./city-sockets.js";

await CitySockets.execSession(new SomeMasterSession(...args));
```

### Built-in Sessions (city-sessions.ts)

| Session Pair | Purpose |
|---|---|
| `JuiceMasterSession / JuiceSlaveSession` | Allocate juice/help-hurt points |
| `JuiceSpendingSessionM / JuiceSpendingSessionS` | Spend juice from actor |
| `TagReviewMasterSession / TagReviewSlaveSession` | Player tag confirmation panel |
| `TagAndStatusCleanupSessionM / S` | Delete temporary tags/statuses |
| `DowntimeSessionM / DowntimeSessionS` | Session-end downtime handling |

### Adding a Module Session

```typescript
// In your module's init
Hooks.once("ready", () => {
  CitySockets.sockets.addSlaveSessionConstructor(MyMasterSession, MySlaveSession);
});
```

---

## Key Import Paths (compiled JS, from a module)

```javascript
// Globals available on window after system init:
game.city           // system namespace object
CityActor           // registered globally
CityItem            // registered globally

// If importing via esmodules (advanced):
// Note: system internals are not exported as a public API –
// prefer using Hooks and the game.city namespace.
```

---

## Notes for Module Development

- **Always** use `foundry.applications.handlebars.loadTemplates()` — never the deprecated global.
- **Wait** for `cityDBLoaded` before accessing `CityDB.themebooks` or `CityDB.movesList`.
- Scene tag containers are regular actors — filter them out with `actor.name !== "__SCENE_CONTAINER__"` if iterating all actors.
- The `SystemModule.active` gives you the current rule system so you can branch behavior by game (CoM vs Otherscape vs LitM).
- Roll results post to chat as `MistChatMessage` (extends Foundry's ChatMessage) — hook `renderChatMessageHTML` to add UI to roll results.
- Socket sessions require a GM to be online as the master; design module features accordingly.

---

## 10. Multi-System Architecture

### SystemModuleI Interface

Every game system implements this interface (defined in `baseSystemModule.ts`):

```typescript
interface SystemModuleI {
  name: keyof SYSTEM_NAMES          // "city-of-mist" | "otherscape" | "legend"
  localizationString: string         // Display name
  localizationStarterName: string    // Prefix for i18n keys

  // Template rendering
  sheetHeader(actor: CityActor): Promise<string>
  themeCardTemplateLocation(theme: Theme): string
  downtimeTemplate(actor: CityActor): Promise<string>

  // Lifecycle
  onChangeTo(): Promise<void>        // Apply system-specific settings
  activate(): Promise<void>          // Load templates, register sheets, set hooks

  // Localization
  localizedName(doc: CityActor | CityItem): string
  localizedDescription(doc: CityActor | CityItem): string
  localizedThemeBookData(tb: Themebook, field, numOrLetter): string

  // Game terminology
  gameTerms(): Record<keyof GameTerms, localizationString>
  collectiveTermName(): string
  loadoutThemeName(): string

  // Theme system
  themeTypes(): Partial<Record<keyof ThemeTypes, ThemeTypeInfo>>
  directoryName(actor: CityActor): string

  // Move system
  canCreateTags(move: Move): boolean
}
```

### Static SystemModule API

```typescript
import { SystemModule } from "./config/system-module.js";

SystemModule.active                          // active SystemModuleI
SystemModule.systems                         // Map of all registered systems
SystemModule.themeTypes()                    // active system's theme types
SystemModule.allThemeTypes()                 // merged from all systems (for cross-system display)
SystemModule.themeIncreaseName(theme)        // "Attention" | "Upgrade" | "Improve"
SystemModule.themeDecreaseName(theme)        // "Fade" | "Decay" | "Abandon"
SystemModule.themeThirdTrackName(theme)      // "Milestone" (LitM only, else "")
SystemModule.themeIdentityName(theme)        // "Mystery" | "Itch" | "Quest" etc.
SystemModule.isLoadoutThemeType(themeType)   // boolean
SystemModule.setActive(systemName)           // switch active system
SystemModule.setActiveStyle(system)          // applies body CSS class

// Register a custom game system from a module
Hooks.once("registerRulesSystemPhase", (SystemModule) => {
  SystemModule.registerRulesSystem(new MyCustomSystem());
});
```

### Per-System Settings Applied on Activation

| Setting | City of Mist | Otherscape | Legend in Mist |
|---|---|---|---|
| `tagBurn` | `"classic"` | `"mist-engine"` | `"mist-engine"` |
| `statusAdditionSystem` | `"classic"` | `"mist-engine"` | `"mist-engine"` |
| `themeStyle` | `"city-of-mist"` | `"mist-engine"` | `"mist-engine"` |
| `altPower` | `false` | `false` | `false` |
| `loadoutTheme` | `false` | `true` | `true` |
| `autoFail_autoSuccess` | `false` | `true` | `true` |
| `collectiveMechanics` | `"city-of-mist"` | `"mist-engine"` | `"mist-engine"` |
| `statusDisplay` | `"tier-only"` | `"tier+circles"` | `"tier+circles"` |
| `tagCreationCost` | default | `2` | `2` |
| `statusCreationCost` | default | `1` | `1` |
| Body CSS class | `style-city-of-mist` | `style-otherscape` | `style-legend` |

### Inheritance Hierarchy

```
BaseSystemModule
  ├── CoMTypeSystem          (classic burn, CoM base)
  │     └── CoMSystem        → "city-of-mist"
  └── MistEngineSystem       (mist-engine burn, modern base)
        ├── OtherscapeSystem → "otherscape"
        └── LitMSystem       → "legend"
```

### System Comparison Table

| Feature | City of Mist | Otherscape | Legend in Mist |
|---|---|---|---|
| Theme types | Logos, Mythos, Mist, Crew, Loadout-CoM, Extra | Noise, Self, Mythos-OS, Crew-OS, Loadout | Origin, Adventure, Greatness, Fellowship, Backpack |
| Decrease track | Crack / Fade / Strike | Decay | Abandon |
| Increase track | Attention | Upgrade | Improve |
| Third track | — | — | **Milestone** |
| Identity term | Identity / Mystery / Directive | Identity / Itch / Ritual | Quest |
| Loadout theme | Loadout-CoM | Loadout | Backpack |
| Essence system | No | **Yes (8 types)** | No |
| Burn system | Classic (2-state) | Mist Engine (3-state) | Mist Engine (3-state) |
| Theme card template | `parts/theme-display.html` | `otherscape/theme-card.hbs` | `otherscape/theme-card.hbs` |
| Sheet header | CoM (mythos/logos fields) | Essence block | Simplified |
| Downtime template | `pc-downtime-chooser-com.hbs` | `pc-downtime-chooser-otherscape.hbs` | `pc-downtime-chooser-otherscape.hbs` |
| Aesthetic / font | Noir / PT Serif | Cyberpunk / Orbitron | Fantasy / default |

### Branching by Active System in a Module

```typescript
const system = CitySettings.getBaseSystem(); // "city-of-mist" | "otherscape" | "legend" | "custom"

switch (system) {
  case "city-of-mist":
    // Logos/Mythos/Mist themes, classic burn
    break;
  case "otherscape":
    // Noise/Self/Mythos themes, essence system
    break;
  case "legend":
    // Origin/Adventure/Greatness themes, milestone track
    break;
}

// Or via SystemModule:
const active = SystemModule.active;
const termForIncrease = SystemModule.themeIncreaseName(theme); // "Attention" / "Upgrade" / "Improve"
```

---

## 11. Data Models – Full Field Reference

> **Note:** The field `system_compatiblity` (one 'i') is a typo in the codebase — use it as-is.

### Actor: PC (Character)

```typescript
actor.system = {
  locked: boolean,
  biography: string,          // HTML
  description: string,        // HTML
  short_description: string,
  gmnotes: string,            // HTML
  crewThemes: string[],       // DocumentIds of crew themes
  version: string,
  finalized: boolean,
  mythos: string,             // CoM only – mythos name
  logos: string,              // CoM only – logos name
  selectedTags: string[],
  selectedMove: string,
  selectedMoveGroup: string,
  alias: string,
  useAlias: boolean,
  age: number,
  residence: string,
  pronouns: string,
  essence: {                  // Otherscape only
    systemName: keyof EssenceNames,  // "Singularity"|"Real"|"Spiritualist"|"Cyborg"|"Transhuman"|"Avatar"|"Conduit"|"Nexus"
    isBurned: boolean
  },
  activeExtraId: string,
  activeCrewId: string,
  buildup: number[],          // 5 slots, 0 or 1 each
  unspentBU: number,
  flashback_used: boolean
}
```

### Actor: Danger / Threat

```typescript
actor.system = {
  locked: boolean,
  biography: string,
  description: string,
  gmnotes: string,
  is_template: boolean,       // true = danger template, not a real threat
  type: "threat",
  subtype: string,
  collective_size: number,    // for collective threats
  specialType: string,        // "" | "scene-container" etc.
  version: string
}
```

### Item: Theme

```typescript
theme.system = {
  description: string,
  attention: number[],        // [0,0,0] – 3 circles
  crack: number[],            // [0,0,0] – CoM only (Logos/Mist)
  milestone: number[],        // [0,0,0] – LitM only
  mystery: string,            // Identity/Mystery/Quest text
  subtype: ThemeType,         // Logos|Mythos|Mist|Noise|Self|Origin|Adventure|Greatness|Crew*|Loadout*
  themebook_id: string,
  themebook_name: string,
  unspent_upgrades: number,
  img: string,
  nascent: boolean,           // Otherscape: new theme not yet locked
  isExtra: boolean
}
```

### Item: Themebook

```typescript
themebook.system = {
  description: string,
  locked: boolean,
  version: string,
  free_content: boolean,      // true = overrideable by non-free content with same name
  locale_name: string,
  systemName: string,
  subtype: ThemeType,
  power_questions: Record<string, { question: string, examples: string, optional: boolean }>,
  weakness_questions: Record<string, { question: string, examples: string, optional: boolean }>,
  improvements: Record<string, { name: string, description: string, effect_class: string }>,
  motivation: "identity"|"mystery"|"directive"|"ritual"|"itch"|"motivation",
  fade_type: "fade"|"crack"|"strike"|"decay"|"default",
  system_compatiblity: string   // "any" | "city-of-mist" | "otherscape" | "legend" | comma-separated
}
```

### Item: Tag

```typescript
tag.system = {
  description: string,
  question: string,
  question_letter: string,
  subtype: "power"|"story"|"weakness"|"loadout"|"relationship",
  category: "none"|"hindering"|"weakening"|"ability"|"empower"|"object"|"being",
  burn_state: number,         // 0=unburned, 1=burned, 2=crispy
  burned: boolean,
  crispy: boolean,
  is_bonus: boolean,
  theme_id: string,
  custom_tag: boolean,
  broad: boolean,
  temporary: boolean,
  permanent: boolean,
  parentId: string,
  subtagRequired: boolean,
  showcased: boolean,
  activated_loadout: boolean,
  example0: string, example1: string, example2: string,
  counterexample0: string, counterexample1: string, counterexample2: string,
  restriction0: string, restriction1: string, restriction2: string,
  sceneId: string,            // set on scene tags
  createdBy: UniversalItemAccessor[]
}
```

### Item: Status

```typescript
status.system = {
  description: string,
  tier: number,
  pips: number,
  category: "none"|"advance"|"harm"|"hindering"|"compelling"|"advantage"|"shield"|"weakening"|"restore"|"set-back"|"progress"|"polar",
  hidden: boolean,
  spectrum_status: string,    // linked spectrum name
  temporary: boolean,
  permanent: boolean,
  sceneId: string,
  showcased: boolean,
  specialType: "collective"|"",
  createdBy: UniversalItemAccessor[]
}
```

### Item: Move

```typescript
move.system = {
  description: string,
  systemName: string,
  free_content: boolean,
  onSuccess: string,
  onDynamite: string,
  onMiss: string,
  onPartial: string,
  always: string,
  listConditionals: Array<{ condition: string, text: string }>,
  subtype: "standard"|"noroll"|"themeclassroll"|"SHB",
  theme_class: ThemeType,     // for themeclassroll moves
  effect_class: string,       // see §15
  abbreviation: string,       // e.g. "FD" for Face Danger
  category: "Core"|"Advanced"|"SHB",
  system_compatiblity: string
}
```

### Item: Improvement

```typescript
improvement.system = {
  description: string,
  systemName: string,
  free_content: boolean,
  uses: { current: number, max: number, expended: boolean },
  theme_id: string,
  choice_item: string,        // selected move/tag name when THEME_DYN_SELECT
  chosen: boolean,
  choice_type: string,
  effect_class: string,       // see §15
  system_compatiblity: string
}
```

### Item: Essence (Otherscape only)

```typescript
essence.system = {
  description: string,
  systemName: "Singularity"|"Real"|"Spiritualist"|"Cyborg"|"Transhuman"|"Avatar"|"Conduit"|"Nexus",
  free_content: boolean,
  effect_class: string,
  system_compatiblity: string,
  expended: boolean           // essence burned state
}
```

**The 8 Essence types and their theme combinations:**
| Essence | Theme Combination |
|---|---|
| Singularity | All Noise |
| Real | All Self |
| Spiritualist | Self + Mythos |
| Cyborg | Noise + Self |
| Transhuman | Mythos + Noise |
| Avatar | All Mythos (same type) |
| Conduit | All Mythos (different types) |
| Nexus | All three types (Noise + Self + Mythos) |

### Item: Spectrum

```typescript
spectrum.system = {
  maxTier: number   // 1–998 = cap, 999 = invulnerable
}
```

### Item: Clue

```typescript
clue.system = {
  amount: number,
  source: string,
  method: string,
  partial: boolean,
  metaSource: string,
  tagsUsed: string[]
}
```

### Item: Juice (Help/Hurt)

```typescript
juice.system = {
  amount: number,
  source: string,
  method: string,
  tagsUsed: string[],
  subtype: "help"|"hurt"|"",
  targetCharacterId: string
}
```

### Item: GM Move

```typescript
gmmove.system = {
  description: string,        // HTML, parsed for [[tag]] / {{status}} / ((improvement)) syntax
  subtype: "soft"|"hard"|"custom"|"intrusion"|"entrance"|"downtime",
  taglist: string[],
  statuslist: string[],
  hideName: boolean,
  header: "default"|"none"|"symbols"|"text",
  superMoveId: string
}
```

---

## 12. CSS – Per-System Classes and Variables

### How the System Applies Styles

```typescript
// SystemModule.setActiveStyle(system) adds a class to document.body:
document.body.classList.add(`style-${system.name}`);
// e.g. "style-city-of-mist", "style-otherscape", "style-legend"
```

All system-specific CSS is scoped to these body classes. You can use the same pattern in a module.

### Shared Variables (city.css)

```css
:root {
  --tag-yellow: #fff2ab;
  --status-green: #e2e9b4;
  --spectrum-red: #f4ab96;
  --neon-pink: #f82973;
  --theme-card-size: 500px;
}
/* Fonts: PT Serif, Roboto */
```

### City of Mist (com.css)

```css
/* Theme type colors */
--mythos-pink:   #502c5d;
--mythos-bright: #ae4ace;
--logos-orange:  #a85d4b;
--mist-blue:     #28475b;

/* Theme card scoping */
.style-city-of-mist div.Mythos-theme { ... }
.style-city-of-mist div.Logos-theme  { ... }
.style-city-of-mist div.Mist-theme   { ... }

/* Sheet elements */
.style-city-of-mist .theme-name         { ... }
.style-city-of-mist input.character-name{ ... }
.style-city-of-mist .select-move-group  { ... }
```

### Otherscape (otherscape.css)

```css
/* Cyberpunk palette */
--green-OS-text:       rgb(65, 183, 161);
--green-OS-textShadow: 0 0 2px #51eeff, 0 0 4px #007bbf;
--self-border:         #8B3A3A;
--mythos-border:       #4B2A5A;
--noise-border:        #A3DAF7;

/* Font: Orbitron (loaded via @font-face) */

/* Theme card scoping */
.style-otherscape div.Noise-theme  { border-color: var(--noise-border); ... }
.style-otherscape div.Self-theme   { border-color: var(--self-border);  ... }
.style-otherscape div.Mythos-theme { border-color: var(--mythos-border);... }

/* Key classes */
.style-otherscape .mist-engine-theme-block { ... }
.style-otherscape .yellow-highlight        { ... }  /* tag selection highlight */
.holo-glass { backdrop-filter: blur(...); }         /* glassmorphism panels */
```

### Legend in the Mist (legend.css)

```css
/* Theme cards use background images */
.style-legend div.Origin-theme    { border: 2em solid var(--mist-blue);   background: url(mistcardbg.webp); }
.style-legend div.Adventure-theme { border: 2em solid var(--logos-orange); background: url(themecardbg.webp); }
.style-legend div.Greatness-theme { border: 2em solid var(--mythos-pink);  background: url(mythoscardbg.webp); }
.style-legend div.Fellowship-theme{ border: 2em solid #686358;             background: url(extracardbg.webp); }
/* Rounded corners, large borders */
```

### Scoping Your Module CSS

```css
/* Use the body class to scope per system */
.style-city-of-mist .my-module-element { color: var(--mythos-pink); }
.style-otherscape   .my-module-element { color: var(--green-OS-text); }
.style-legend       .my-module-element { color: var(--logos-orange); }
```

---

## 13. System-Specific Items

### Essence (Otherscape)

- Item type: `"essence"`
- One per character, stored as embedded item
- Auto-determined from theme combination if `autoEssence` setting is on
- Affects rolls: **Real essence disables positive tags** in the roll dialog
- `essence.system.expended` = burned state (can be burned once per session)

```typescript
// Check current essence
const essenceItem = actor.items.find(i => i.type === "essence") as Essence | undefined;
const essenceName = actor.system.essence?.systemName;
const isBurned    = actor.system.essence?.isBurned;

// Get from DB
const essenceDef = CityDB.getEssenceBySystemName("Nexus");

// Essence types
type EssenceNames = {
  Singularity, Real, Spiritualist, Cyborg, Transhuman, Avatar, Conduit, Nexus
}
```

### Spectrum

- Item type: `"spectrum"`
- Attached to statuses via `status.system.spectrum_status` (the spectrum name)
- `maxTier: 999` = invulnerable
- Acts as a cap on how high the linked status can go

### ThemeKit (character-specific themebook)

- Item type: `"themekit"`
- A custom "mini-themebook" specific to one character
- Can reference a real themebook (`themebook_id`) for improvement inheritance
- Fields: `power_tagstk[]`, `weakness_tagstk[]`, `improvements[]`

### GMMove special syntax (in description field)

GM move descriptions support auto-creation syntax:
```
[[tag name]]         → creates a story tag when move fires
{{status-name:tier}} → creates a status when move fires
((improvement name)) → grants an improvement when move fires
```

---

## 14. isSystemCompatible

```typescript
// On Themebook, Move, Improvement:
item.isSystemCompatible(system?: System): boolean

// Implementation:
if (item.system.system_compatiblity === "any") return true;
return item.system.system_compatiblity.includes(system);
```

**`system_compatiblity` values** (note: single 'i' typo in codebase):
```
"any"                          – works in all systems
"city-of-mist"                 – CoM only
"otherscape"                   – Otherscape only
"legend"                       – LitM only
"city-of-mist,otherscape"      – CoM + Otherscape
"city-of-mist,otherscape,legend" – all three
```

**Where filtering happens:**
| Context | Setting used |
|---|---|
| Themebook loading | `baseSystem` |
| Move loading | `movesInclude` (separate from baseSystem – allows cross-system moves) |
| Improvement loading | `baseSystem` |
| Loadout themebook selection | `baseSystem` AND must be loadout type |

---

## 15. effect_class Reference

The `effect_class` field on `Move` and `Improvement` is a comma-separated string of capability tokens.

```typescript
// Check for an effect class:
item.hasEffectClass("CREATE_TAGS")   // boolean
item.system.effect_class             // raw string, e.g. "THEME_DYN_SELECT,CREATE_TAGS"
```

| effect_class token | On | Meaning |
|---|---|---|
| `CREATE_TAGS` | Move | This move can create new story tags; deducts `tagCreationCost` power |
| `THEME_DYN_SELECT` | Improvement | Player selects a core move; that move becomes dynamite when using tags from this theme |
| `THEME_DYN_FACE` | Improvement | Face Danger is dynamite when using tags from this theme |
| `THEME_DYN_{ABBR}` | Improvement | Specific move (by abbreviation) is dynamite with this theme's tags |
| `ALWAYS_DYN_{ABBR}` | Improvement | Specific move is always dynamite regardless of tags |
| `THEME_TAG_SELECT` | Improvement | Player selects a specific tag from the theme; `getChoiceType()` = `"theme_tag"` |

`getChoiceType()` on an Improvement returns:
- `"core_move"` if it has `THEME_DYN_SELECT`
- `"theme_tag"` if it has `THEME_TAG_SELECT`
- `""` otherwise

---

## 16. Theme Subtypes Per System

### City of Mist

| Subtype | Identity Term | Increase | Decrease | Special |
|---|---|---|---|---|
| `Mythos` | Mystery | Attention | Fade | — |
| `Logos` | Identity | Attention | Crack | — |
| `Mist` | Directive | Attention | Strike | — |
| `Crew` | Identity | Attention | Crew Fade | crew |
| `Loadout-CoM` | — | — | — | loadout |
| `Extra` | Identity | Attention | Crew Fade | extra |

### Otherscape

| Subtype | Identity Term | Increase | Decrease | Special |
|---|---|---|---|---|
| `Mythos-OS` | Ritual | Upgrade | Decay | — |
| `Noise` | Itch | Upgrade | Decay | — |
| `Self` | Identity | Upgrade | Decay | — |
| `Crew-OS` | Crew Identity | Upgrade | Decay | crew |
| `Loadout` | — | — | — | loadout |

### Legend in the Mist

| Subtype | Identity Term | Increase | Decrease | Third Track | Special |
|---|---|---|---|---|---|
| `Origin` | Quest | Improve | Abandon | Milestone | — |
| `Adventure` | Quest | Improve | Abandon | Milestone | — |
| `Greatness` | Quest | Improve | Abandon | Milestone | — |
| `Fellowship` | Quest | Improve | Abandon | Milestone | crew |
| `Backpack` | — | — | — | — | loadout |

**LitM is the only system with a third track (`milestone`).**

---

## 17. Move Categories and Types

### `move.system.category`

| Value | Description | Loaded by |
|---|---|---|
| `"Core"` | Basic moves available to all | `loadMovesOfType("Core")` |
| `"Advanced"` | Specialized/powerful moves | `loadMovesOfType("Advanced")` |
| `"SHB"` | Soft Hold / special (Otherscape) | `loadMovesOfType("SHB")` |

Move loading uses the `movesInclude` setting (not `baseSystem`) — you can mix moves from different systems in one campaign.

### `move.system.subtype`

| Value | Behavior |
|---|---|
| `"standard"` | Normal roll move |
| `"noroll"` | Executes without rolling dice |
| `"themeclassroll"` | Rolls restricted to a specific theme type (uses `theme_class` field) |
| `"SHB"` | Soft Hold / special — skipped for Otherscape essence effects |

### Move Abbreviations (used in effect_class)

Common abbreviations (from `move.system.abbreviation`):
- `FD` – Face Danger
- `HO` – Hit the Books / Help Out
- `CC` – Change the Game
- `TG` – Take the Risk / Go Aggro (varies by system)

Retrieve all moves: `CityDB.movesList` (available after `movesLoaded` hook).
