# Card Sheet — design plan

Drafted 2026-11-18, revised the same day with the user's answers. Status: **phase 0 done** (2026-11-18): skeleton sheet, move bar on the system roll path, action map (§ 6.2). **Phase 1 done** (2026-11-18): City of Mist layer 1, the four main themes as read-only flip cards with the user's art and title fitting. **Phase 2 done** (2026-11-18): 244 × 620 cards, flip by the header band, condensed sans theme titles with glow; layer 2 (character card, crew themes, every extra), the active-extra switch and the layer swap. **Phase 3 done** (2026-11-18, b46a524): edit mode (the system's lock), every theme / character card edit through the action map, cards resized to 204 × 520 with the tag text kept at its size. **Phase 4 done** (2026-11-18, 780e1fe, e1b0e03): play mode, tags selected for rolls through the system's selection with the City of Mist marker bars; bigger small fonts. **Phase 5 done** (2026-11-18): the tags-deck (City of Mist), every card edited on the card itself, the detachable deck window, the roll modifier total by the move bar.

An alternative character sheet for the city-of-mist system (City of Mist, Otherscape, Legend in the Mist).
It has two layers of flip cards, a **tags-deck** behind them, and a bar of move buttons.

---

## 1. Decision: build it in mist-hud as an alternative sheet

- mist-hud registers its own sheet for the `character` actor type with
  `foundry.documents.collections.Actors.registerSheet("mist-hud", MistCardSheet, { types: ["character"], makeDefault: false, label: … })`.
  Players pick it in the actor's **Sheet** selector, and the system sheet stays available.
- The module ships its own templates. A system PR is **not** needed to get new `.hbs` files.
- The new sheet is an **ApplicationV2** sheet (`HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)`), like every other mist-hud window.
  The system sheets (`CitySheet → CityActorSheet → CityCharacterSheet`) are ApplicationV1. We do not subclass them.
- **The system stays the source of truth** for actor and item data. All writes go through the documents and the system's helpers (see § 6).
- **A later system PR stays possible.** Everything lives in its own folders (`card-sheet/`), and every call into system internals goes through one adapter file.

## 2. Structure: two card layers, the tags-deck and the move bar

From front to back:

```
 ┌──────────────── move bar: [CG][CO][FD][GT][HG][IN][LB][SA][TR] ⌄ ────────────────┐
 │                                                                                  │
 │  Layer 1 (front)    the 4 main themes                                            │
 │  Layer 2            character card · crew theme(s) · every extra theme           │
 │  tags-deck (back)   ticket cards that peek out to the right of the layers       │
 └──────────────────────────────────────────────────────────────────────────────────┘
```

**Layer 1: the main themes.** The 4 main themes (`mainFourThemes`).

**Layer 2: the character's other cards.**
- **Character card:** name, player, Mythos, Logos (or the matching fields in Otherscape and Legend), the Crew block with Help/Hurt for each crewmate, and story tags.
- **Crew theme card(s).**
- **Every extra theme**, not only the active one (for example "Base of Operations" and "Ride"). The active extra, the one the system rolls with (`activeExtraId`), is clearly marked, and clicking another extra makes it active.

**tags-deck.** Small ticket cards sitting behind both layers and peeking out at the right (the arrows in mockup 5). It holds what the character picks up during the adventure:
- **City of Mist:** statuses, story tags, juice, clues.
- **Legend and Otherscape:** the same idea (statuses and story tags), but **no clues and no juice**. What else goes in their deck is listed in phases 6 and 7.

The deck is part of the sheet but can be **detached** into its own floating window, and attached again.

**The deck's views (user, 2026-11-18, phase 5).**
- **At rest (stack):** every card cascaded behind the layers at their right, grouped by type (statuses, story tags, juice, clues). Each covered card shows its red band with **its name written over the printed title**; the last card shows whole. A toolbar under it: the count per type, spread, detach.
- **Brought forward:** clicking a card brings it forward, big, in front of the layers, to work on; "Back to the deck", Esc or a click beside it sends it back.
- **Spread** (the plan's fan-out): a button lays every card out in front of the sheet, one column per type, with the create buttons in the column headers.
- **Everything is done on the card itself, no system dialogs** (user):
  - the name on the TAG line is a field;
  - a new card starts blank with its name focused (empty or Esc deletes it);
  - clicking a box sets the status (or the amount); − / + change one tier (one point);
  - the other fields are small fields under the name: clue source and method on one row, partial, temporary / permanent, the Help/Hurt target picker;
  - delete, use a clue and burn ask "Sure?" on the button itself (right-click deletes at once).
- **Selected cards** are lifted (in the stack) and tinted, green + / red −, with the ±value on the band.

**Roll modifier total (user, phase 5).** Next to the move buttons: what the selection adds to the next roll, counted as the system's roll counts it (tags add up; only the highest positive and the lowest negative status count). A client setting picks what it adds up:
- **Just the cards** (default): the deck's selected statuses and story tags;
- **Tags + cards**: two values;
- **All together**.

**Swapping layers.** The layer behind sits higher and shows only its header bands. Clicking a band brings that layer to the front.

**Move bar** (mockup 6). A row of move buttons using **the HUD's move button art** (`getMoveImageSrc`; a round text button with the abbreviation only for a move without art). A chevron at the end cycles through **three groups: Core, Special, SHB**. Special merges the HUD's session page (Monologue, Flashback, Downtime, Session End) and its special page, in that order. Done in phase 0. Clicking a button works **like the system sheet, not like the HUD**: it opens the system's roll dialog with the selected tags and statuses, and the player confirms there (see § 6.1).

## 3. Card faces: the front and back of the SAME card

Every theme card (layer 1, crew and extras) is one card with two faces. **Clicking the header band flips it**, like the system sheet (no flip button; the band is `role="button"`, focusable, Enter/Space). Nothing else in the band takes the click.

**Front (mockup 3, with the trackers moved here as on the original sheet):**
- header band: themebook name, type icon at the right (Mythos ⚡, Logos 🎭, Crew, …)
- theme title: the name the player gave the theme, in a **big condensed sans-serif font, capitals, with the mockup's glow** (`text-transform: uppercase`, the data stays as typed), **at most 3 lines**; it starts large and shrinks until it fits (§ 7)
- **attention** and **crack/fade** trackers with + buttons, under the title as on the original sheet
- Identity / Mystery line
- POWER TAGS (heavy condensed heading), each tag with a burn toggle
- WEAKNESS TAGS at the bottom of the card (no anchor icon: the heading says it)
- footer band with the game's logo

**Back (mockup 4, without the trackers):**
- the same header band
- **improvements only**

**Adding tags.** In edit mode, a + next to POWER TAGS / WEAKNESS TAGS opens the themebook's unused tag questions (`themebook_getTagQuestions`). Answering one spends `unspent_upgrades`. When there are unspent upgrades, the back shows how many.

**Tracks** (user, 2026-11-18): attention and crack/fade side by side, each drawn with the City of Mist sheet's point shapes (`ui/icons/track-com-{empty,full}.svg`, as in the External Style), with the track's name **under** the pips. The identity/mystery line is Rock Salt at 4.8cqw.

**Edit and play controls (phase 3).** Like the system sheet, some controls are there in both modes for the owner of the theme's actor: + on a track (play mode: the pips themselves are the button), a new power tag or improvement while upgrades are unspent, burn / unburn (the system shows it only locked), posting an improvement to chat (play mode: its name), the crew / danger sheet link, adding a theme on an empty slot. Edit mode adds: inline name and mystery, − on tracks, fade reset, weakness and bonus tags, tag edit (name) and delete (trash, right-click without confirmation), improvement edit and delete, the type toggle (on the motivation label), themebook / theme kit edit and delete theme (row under the band).

**Character card.**
- **Front** (mockup 5): name, player, Mythos, Logos, Crew Help/Hurt, story tags. Help and Hurt are two columns named once in the Crew heading, with plain numbers per crewmate: no colours, no repeated words (user, 2026-11-18, 0623c9e).
- **Back:** the **short description** first (`system.short_description`), then the **biography** (`system.biography`, an HTML field shown with the enriched editor).

**Styles.** Use the card images you have as backgrounds (one per theme type and per game), plus the HUD's per-system colour tokens. **City of Mist (user, 2026-11-18): the character card, the crew themes and every extra use the extras card art** (`extras_theme_bg.webp`).

## 4. Fonts and art

- **Theme titles (City of Mist): Rift Bold** (condensed sans, shipped by the system: `/systems/city-of-mist/fonts/Rift-Bold-webfont.woff2`), in capitals, with a glow: Mythos titles white with a violet glow, the others a soft light halo (user, 2026-11-18: sans serif, not serif). Section headings (POWER TAGS, WEAKNESS TAGS): Fira Sans Extra Condensed 900, also from the system.
- **Rock Salt** for the handwritten look: the identity/mystery line and the character card's handwritten fields (Mythos, Logos, short description). It is already loaded from `/systems/city-of-mist/fonts/RockSalt.ttf` in `styles/external/mh-ext-city-of-mist.css`, so reuse that `@font-face`.
- **Tags keep the fonts we already use** in the HUD and External Style (Fira italic for power and weakness tags, and so on). They can change later.
- **Card backgrounds:** the images you supply. They go in `ui/card-sheet/<system>/` as `.webp`.
  - **City of Mist** (`ui/card-sheet/com/`): `mythos_theme_bg`, `logos_theme_bg` and `mist_theme_bg` for the main themes; **`extras_theme_bg` for the extras, the crew theme(s) and the character card** (user, 2026-11-18). Each card keeps its own type class (`mh-cs-type-extra`, `-crew`, `-character`), mapped one line each in `card-sheet-com.css`, so a later image per type is a one-line change.
- The art in the mockups is reference only. Do not ship official art we have no rights to.

## 5. File layout

```
scripts/card-sheet/
  card-sheet.js          MistCardSheet (ActorSheetV2 + HandlebarsApplicationMixin), PARTS, actions
  card-sheet-context.js  builds the render context, using getters.js
  system-adapter.js      the ONLY file that calls system internals (CityDialogs, CityHelpers, …)
  card-fit.js            fits titles and tag lists to a fixed card size
  tags-deck.js           the deck part (context, actions, modifier totals), plus the detached TagsDeck window (ApplicationV2)
  ui-state.js            the sheet's client UI state (flips, front layer, deck detached / position)
  move-bar.js            move buttons + Core/Cinematic switch (HUD look, system sheet roll path)
templates/card-sheet/
  layer1.hbs             PART "layer1": the four main theme cards (one template per PART; no root template)
  layer2.hbs             PART "layer2": character card, crew themes, every extra
  theme-card.hbs         one card: front and back faces; shared by every game, art and band positions come from the per-system CSS
  character-card.hbs     the character card (front and back)
  card-band.hbs          a card's header band (flips the card)
  peek-tab.hbs           the back layer's clickable header band
  tags-deck.hbs          PART "deck": the stack, its toolbar, the forward card and the spread view
  deck-columns.hbs       the spread columns (also the TagsDeck window's part)
  deck-card.hbs          one tracking card (stack / spread / worked on)
  move-bar.hbs
styles/card-sheet/
  card-sheet.css         layout, layers, flip, deck, move bar (in module.json "styles")
  card-sheet-{com,os,litm}.css   art, fonts and colours per system (injected like applySystemCSS)
ui/card-sheet/{com,os,litm}/     card background images
```

- Register the sheet in `init.js` on the `init` hook.
- Load the templates with `foundry.applications.handlebars.loadTemplates()`.
- Root every CSS rule under `.mh-card-sheet`, so the sheet looks the same whatever **Visual Style** is chosen.
- Per-system overrides go in the per-system files.
- Pick the active system with `getActiveSystem()`, never `game.system.id`.

## 6. Data and actions

### 6.1 Selections and rolls: the system sheet's path

The sheet selects and rolls exactly as the system sheet does (`CityCharacterSheet._executeMove`, system 4.5.3):

1. Clicking a tag or status on a card or in the deck selects it in the system's **`SelectedTagsAndStatus`**, through `setSelectionDirection(item, ±1 | 0)` from `hud-state.js`.
2. Clicking a move button:
   - for a **Stop Holding Back** move, first asks `CityDialogs.SHBDialog(actor)` (City of Mist) or `CityDialogs.BlazeDialog(actor)` (Otherscape and Legend);
   - then calls `CityRoll.execMove(moveId, actor, SelectedTagsAndStatus.getPlayerActivatedTagsAndStatus(), options)`, which opens the **system roll dialog**.
3. After a roll, `SelectedTagsAndStatus.clearAllActivatedItems()` runs, then the move's `effect_classes` are handled (DOWNTIME, MONOLOGUE, SESSION_END…). Those are methods on the system sheet (`monologue`, `sessionEnd`, `flashback`, `downtime`). **Phase 0 result:** they only use `this.actor` and each other (no private fields, no rendered sheet), so `system-adapter.js` runs them on `Object.create(CityCharacterSheet.prototype, { actor })`: the system's own code, nothing rendered or registered. Verified with Opening Monologue. (`CityRoll` itself only handles `CLUES` after the roll, so nothing runs twice.)
4. The sheet re-renders on the system hooks `TagOrStatusSelectChange` / `TagOrStatusSelected`.

Consequences:
- The sheet's selection is the system's, so the token tooltip, the influence viewer and the system's own roll dialog show it too.
- **The player HUD keeps its own selection (`HUDState`)**, as it does today next to the system sheet. A tag selected on the card sheet does not light up in the HUD, and the reverse is also true. This is accepted for now. Syncing the two would be a separate task.
- The move bar reuses only the HUD's **look and grouping** (`organizeMoves`, `getMoveAbbreviation`, the Core/Cinematic toggle). Its click handler is the sheet's own. `PlayerHUD._executeMove` is not touched.

### 6.2 Writes: system APIs to use

Every write calls a documented method on the document (or a plain `item.update` of the item's own field when the system has no method, such as a clue's source). The sheet's own UI state (which layer is in front, which cards are flipped, whether the deck is detached and where) goes in a **client setting** keyed by actor uuid, like `hudPositions`.

| Action | API (verified in system 4.5.3) |
|---|---|
| Attention + / − | `actor.addAttention(themeId)` / `actor.removeAttention(themeId)` |
| Crack/fade + / −, reset | `actor.addFade` / `actor.removeFade` / `actor.resetFade(themeId)` |
| Burn / unburn a tag | `actor.burnTag(id, state)` / `actor.unburnTag(id)` (or `tag.burnTag()`) |
| Theme name, mystery | `theme.update({ name })`, `theme.update({ "system.mystery": … })` |
| Unused tag questions | `themebook.themebook_getTagQuestions("power" \| "weakness")` |
| New theme | `actor.createNewTheme(name, themebook, isExtra)`; the themebook picker goes through the adapter |
| Delete theme | `actor.deleteTheme(themeId, awardBU)` after a confirmation dialog |
| Statuses | `actor.createNewStatus(name, tier, pips)`, `actor.addOrCreateStatus(…)` |
| Story tags | `actor.createStoryTag(name)` |
| Active extra | `actor.setExtraThemeId(id)` (what the system sheet calls; it does more than set `system.activeExtraId`) |
| Reads | `getters.js`: `getThemesAndTags`, `getCrewThemes`, `getExtraThemes`, `getAllLoadoutTags`, `getQuintessences`, `getEssence`, `getJuiceAndClues`, `getActorStatuses`, `getImprovements` |

#### Action map (phase 0, system 4.5.3)

This covers every handler the system character sheet binds:
- `CitySheet.activateListeners` (`city-sheet.js`) and its `_onDropItem`;
- `CityActorSheet.activateListeners` (`city-actor-sheet.js`), which only calls `HTMLHandlers.applyBasicHandlers` (`universal-html-handlers.js`);
- the handlers in the `_`-methods of `CityActorSheet` that the system templates bind through `data-` classes;
- `CityCharacterSheet.activateListeners` (`city-character-sheet.js`).

Routes:
- **Doc**: a method on the actor or item document. The card sheet calls it directly.
- **Adapter**: an exported system class (`CityDialogs`, `CityHelpers`, `HTMLTools`, `DragAndDrop`, `SelectedTagsAndStatus`, `CityDB`), called through a wrapper in `system-adapter.js`. Add the wrapper in the phase that needs it.
- **Sheet**: the "Open system sheet" header button (built in phase 0) until that phase.

Many system handlers end with `CityHelpers.modificationLog(actor, …)` (the GM's change log). The card sheet calls it through the adapter after the same writes, so the log stays complete.

**Phase 3 (done, b46a524).** Every row marked 3 below, plus `_buildUpIncrement`/`_addBUImprovement`, is built in `scripts/card-sheet/edit-actions.js` (one exported action per system handler, same checks, same logs) with the wrappers in `system-adapter.js`. Two system quirks are mirrored as they are: the new-character theme delete logs twice, and "Build Up Point Removed (Current N" has no closing parenthesis. `_onDropItem` for tags and statuses (phase 5 rows) is built too, so a drop never makes a raw item copy.

**Theme cards (phases 1–3)**

| System handler (selector) | What it does | Route | Card sheet call | Phase |
|---|---|---|---|---|
| `_addThemeBook` (`.item-create-theme`, `.add-theme`) | pick a themebook, create a theme | Adapter + Doc | `CityDialogs.themeBookSelector(actor)` → `actor.createNewTheme("Unnamed X Theme", tb)` | 3 |
| `_editThemeKit` (`.edit-themekit`) | edit the theme kit (GM only on PCs) | Adapter | `CityDialogs.itemEditDialog(tk)`, same GM check | 3 |
| `_editThemeBook` (`.edit-themebook`) | edit the themebook (or the kit's themebook) | Adapter | `CityDialogs.itemEditDialog(tb)` | 3 |
| `_toggleLockState` (`.lock-button`, `.sheet-lock-button`) | lock / unlock | Doc | `actor.toggleLockState()` | 3 |
| `#flipCard` (`.flip-button`) | flip a card (sheet UI state) | — | own client state (`flipped` per card, client setting) | 1 |
| `_themebookNameInput` (`.theme-name-input` change/focusout) | rename theme | Doc | `theme.update({ name })` | 3 |
| `_themeChangeInput` (`.motivation-input`) | identity / mystery / other theme field | Doc | `theme.setField(field, value)` | 3 |
| `_toggleThemeType` (`.unlocked .themebook-motivation-label`) | switch the theme's type | Doc | `theme.toggleThemeType()` | 3 |
| `_createTagOrImprovement` (`.theme-create-power-tag`, `.theme-create-weakness-tag`, `.theme-create-improvement`) | answer a tag question / pick an improvement | Adapter + Doc | `CityDialogs.improvementOrTagChoiceList(owner, theme, type, subtype)`; weakness #2+ asks `HTMLTools.confirmBox` unless `CitySettings.autoAwardImpForWeakness()`; then `owner.addTag(themeId, subtype, choice, { awardImprovement })` or `owner.addImprovement(themeId, n)` + `CityHelpers.itemDialog(imp)` | 3 |
| `_createBonusTag` (`.theme-create-bonus-tag`) | add a bonus tag | Doc | `owner.addTag(themeId, "bonus", null, {})` | 3 |
| `_deleteImprovement` (`.imp-delete`) | delete improvement after confirm | Adapter + Doc | `HTMLTools.confirmBox` → `actor.deleteImprovement(impId)` | 3 |
| `_improvementEdit` (`.improvement-edit`) | edit improvement, reload from compendium if not chosen | Doc + Adapter | `imp.reloadImprovementFromCompendium()` if `!imp.system.chosen`, then `CityHelpers.itemDialog(imp)` | 3 |
| `_sendImprovementToChat` (`.improvement-name`) | post improvement to chat, spend a use | Adapter + Doc | `CityHelpers.sendToChatBox(title, html, options)` with `improvement-chat-description.html`, then `imp.decrementImprovementUses()` | 3 |
| `_deleteTheme` (`.theme-delete`) | delete or replace (award build-up) | Doc | new character: `confirmBox` → `actor.deleteTheme(id, false)`; else delete/replace/cancel prompt (V1 `Dialog` in `CitySheet.themeDeleteChoicePrompt`; rebuild as a `DialogV2`) → `actor.deleteTheme(id, replace)` | 3 |
| `_addAttentionOrFade` / `_removeAttentionOrFade` (`.theme-add/remove-attention`, `-fade`, `-progress-point`) | attention, crack/fade, milestone (Legend) | Doc | `actor.addAttention/removeAttention`, `addFade/removeFade`, `addMilestone/removeMilestone(themeId)` | 3 |
| `_resetFade` (`.theme-reset-fade`) | spend an upgrade to reset fade | Adapter + Doc | `HTMLTools.confirmBox` → `actor.resetFade(themeId)` | 3 |
| `HTMLHandlers.burnTag` / `unburnTag` (`.tag-burn`, `.tag-unburn`) | burn / unburn after confirm | Adapter + Doc | `HTMLTools.confirmBox` → `actor.burnTag(id)` / `actor.burnTag(id, 0)` | 3 |
| `HTMLHandlers.deleteTag` (`.tag-delete`, right-click = no confirm) | delete tag (not with subtags; weakness may remove an improvement) | Adapter + Doc | same checks, `confirmBox`, then `actor.deleteTag(id, { removeImprovement })` | 3 |
| `HTMLHandlers.tagEdit` (`.item-edit-context .tag .name`, middle-click) | edit tag (not on theme-kit tags) | Adapter | `CityDialogs.itemEditDialog(tag)` | 3 |
| `SelectedTagsAndStatus.selectTagHandler` (`.item-selection-context .tag .name`) | select a tag ± | Adapter | `toggleTagSelection(tag, owner, invert)` in the adapter (default direction via `getDefaultTagDirection`, `checkValidityForSelect`, then `setSelectionDirection`), action `selectTag` in `play-actions.js`; **built in phase 4** | 4 |
| `themePrevious` / `themeNext` (`.theme-prev`, `.theme-next`) | cycle crew / extra | Doc | `actor.moveCrewSelector(±1)`, `actor.moveExtraSelector(±1)`; the card sheet shows them all, so only the active-extra pick is needed | 2 |
| `_activeExtraChange` (`.active-extra-drop-down`) | set the active extra | Doc | `actor.setExtraThemeId(id)` (not a raw `update`) | 2 |
| `openOwnerSheet` (`.non-char-theme-name`), `openThemeName` (right-click `.themebook-name`) | open the crew / danger sheet | Doc | `owner.sheet.render(true)` | 2 |

**Phase 5 (done).** The tags-deck rows below are built in `scripts/card-sheet/tags-deck.js`, **with no system dialog** (user, 2026-11-18). The card's own fields, boxes and "Sure?" buttons replace `CityDialogs.itemEditDialog`, `CityHelpers.itemDialog`, `_statusAddSubDialog` and `HTMLTools.confirmBox`. What is kept from the system: its creation methods, `addStatus` / `subtractStatus`, `setBoxesChecked`, `spendClue`, `deleteTag`, and the change-log entries (`logModification`, with the system's own texts). A new card is logged "Created" when it is named, and deleted when left without a name (the system's cancel). Drops of system draggables keep the system's status-drop dialog (merge / create).

**Character card, tags-deck and loadout (phases 2, 5–7)**

| System handler (selector) | What it does | Route | Card sheet call | Phase |
|---|---|---|---|---|
| `_createStatus` (middle-click `.status-text-list-header`), `HTMLHandlers.createStatus` (`.create-status`) | new status + edit dialog, deleted if cancelled | Doc + Adapter | `actor.createNewStatus("Unnamed Status")` → `CityDialogs.itemEditDialog(status)` → `deleteStatus` on cancel | 5 |
| `HTMLHandlers.statusEdit` (`.item-edit-context .status .name`) | edit status | Adapter | `CityDialogs.itemEditDialog(status)` | 5 |
| `HTMLHandlers.statusAdd` / `statusSubtract` (`.status-add`, `.status-subtract`) | add / subtract tiers | Adapter + Doc | `CityHelpers._statusAddSubDialog(status, title, "addition" / "subtraction")` → `status.addStatus(amt, { newName, tier })` / `status.subtractStatus(amt, newName)` | 5 |
| `HTMLHandlers.deleteStatus` (`.status-delete`, right-click = no confirm) | delete status | Adapter + Doc | `HTMLTools.confirmBox` → `actor.deleteStatus(id)` | 5 |
| `SelectedTagsAndStatus.selectStatusHandler` (`.item-selection-context .status .name`) | select a status ± | Adapter | `toggleStatusSelection(status, invert)` in the adapter (default −1, right click +1, the same click clears; `checkValidityForSelect`, `setSelectionDirection`), action `selectDeckCard`; **built in phase 5** | 5 |
| `_createStoryTag` (middle-click `.story-tags-header`), `HTMLHandlers.createStoryTag` (`.create-story-tag`) | new story tag + edit dialog | Doc + Adapter | `actor.createStoryTag()` → `CityDialogs.itemEditDialog(tag)` → `deleteTag` on cancel | 5 |
| `_createClue` (`.create-clue`) | new clue + dialog, deleted if cancelled | Doc + Adapter | `actor.createNewClue({ name })` → `CityHelpers.itemDialog(clue)` → `deleteClue` on cancel | 5 |
| `_clueEdit` (`.clue-name`, middle-click; `.clue-list-section .clue-name`) | edit clue | Adapter | `CityHelpers.itemDialog(clue)` | 5 |
| `_deleteClue` / `_deleteJournalClue` (`.clue-delete`, `.clue-journal-delete`) | delete clue (no confirm) | Doc | `actor.deleteClue(id)` | 5 |
| `_useClue` (`.clue-use-button`) | spend a clue (players only) | Adapter + Doc | `HTMLTools.confirmBox` → `clue.spendClue()` | 5 |
| `_createJuice` / `_createHelp` / `_createHurt` (`.create-juice`, `.create-help`, `.create-hurt`) | new juice / help / hurt + dialog | Doc + Adapter | `actor.createNewJuice(name, subtype)` → `CityHelpers.itemDialog(juice)` → `deleteJuice` on cancel | 5 |
| `_juiceEdit` (`.juice-name`, middle-click) | edit juice | Adapter | `CityHelpers.itemDialog(juice)` | 5 |
| `_deleteJuice` (`.juice-delete`) | delete juice (no confirm) | Doc | `actor.deleteJuice(id)` | 5 |
| `_buildUpIncrement` / `_buildUpDecrement` (`.increment-buildup`, `.decrement-buildup`) | build-up points, then pick BU improvements | Adapter + Doc | `confirmBox` → `actor.incBuildUp()` / `decBuildUp()`; then while `system.unspentBU > 0`: `HTMLTools.singleChoiceBox` over `CityHelpers.getBuildUpImprovements()` → `actor.addBuildUpImprovement(id)` | 2 |
| `_addBUImprovement` (`.add-buildup-improvement`) | pick a BU improvement | Adapter + Doc | `HTMLTools.singleChoiceBox(CityHelpers.getBuildUpImprovements())` → `actor.addBuildUpImprovement(id)` | 2 |
| `_essenceBurn` / `_essenceUnburn` (`.essence-burn`, `.essence-unburn`) | Otherscape essence | Doc | `actor.setEssenceBurn(true / false)` | 6 |
| `#createLoadoutTag` (`.loadout-create-power-tag`) | new loadout tag + dialog | Doc + Adapter | `actor.createLoadoutTag()` → `CityDialogs.itemEditDialog(tag)` → `deleteTag` on cancel | 6/7 |
| `#createLoadoutWeakness` (`.loadout-create-weakness-tag`) | weakness under a loadout tag | Doc + Adapter | `actor.createLoadoutWeakness(tagId)` → `itemEditDialog` → `deleteTag` on cancel | 6/7 |
| `#toggleLoadoutTag` (`.toggle-activation-loadout-tag`) | load / unload a loadout tag | Doc | `actor.toggleLoadoutTagActivation(tagId)` | 6/7 |
| `createRelationshipTag` (`.create-relationship-tag`) | new relationship tag + dialog | Doc + Adapter | `actor.createRelationshipTag()` → `CityHelpers.itemDialog(tag)` | 6/7 |

**Moves, drops and the rest**

| System handler (selector) | What it does | Route | Card sheet call | Phase |
|---|---|---|---|---|
| `_executeMove` (`.execute-move-button`) | SHB/Blaze → roll dialog → clear selection → move effects | Adapter | `rollMove(actor, moveId, getActiveSystem())` in `system-adapter.js`, **built and verified in phase 0** | 0 |
| `monologue` / `sessionEnd` / `flashback` / `downtime` (move effects) | attention for the monologue, refresh abilities, spend flashback; downtime is empty in 4.5.3 | Adapter | run on `Object.create(CityCharacterSheet.prototype, { actor })`, **phase 0** | 0 |
| `_onDropItem`: themebook / themekit | create a theme, main or extra | Adapter + Doc | `HTMLTools.singleChoiceBox` (main / extra, PCs only) → `actor.createNewTheme(name, tb, isExtra)` / `actor.addThemeKit(tk, isExtra)` | 3 |
| `_onDropItem`: tag / status / essence | story tag / status merge / Otherscape essence | Doc + Adapter | `actor.createStoryTag(name, true)`; `DragAndDrop.statusDrop(actor, name, { tier })`; `actor.setEssence(item)` | 5/6 |
| `DragAndDrop.addDragFunctionality` + `_dragDropEvent` (`drop` on the sheet) | system draggable tags/statuses (from chat, scene tags) dropped on the sheet | Adapter | `addDragFunctionality(element)` and `dropDraggableOnActor(dragging, actor)` in the adapter. The drop is caught in the capture phase, before the sheet's DragDrop (the system patches `DragDrop._handleDrop` to drop on the canvas token under the pointer); **built in phase 5** | 5 |
| `_openTutorial` (`.open-tutorial`) | open the system tutorial | Adapter | `CityDB.openTutorial()` | 8 (or drop it) |
| `contextMenu.attachToContainer` | right-click menu container | — | no options are ever set on character sheets (only `city-threat-sheet.js` calls `show`): nothing to map | — |
| `_scrollSheet` | keep the scroll position | — | AppV2 `scrollable` in PARTS | 0 |
| everything not yet built | | Sheet | header button "Open system sheet" (`openSystemSheet` in the adapter, one `CityCharacterSheet` instance per actor) | until its phase |

No handler is left out: anything the card sheet does not have yet is reached through the "Open system sheet" button, so nothing silently does nothing.

**Phase 4 (done, 780e1fe).** `selectTag` (`play-actions.js`, left and right click) on every unburned tag name of a locked sheet: power and weakness tags of main, crew and extra themes, and the character's story tags. Like the system: left = the tag's default direction (power and the character's story tags +1, weakness −1), right = reversed, the same click again clears it, the other one switches it; burned tags (any `burn_state` > 0) are plain text. Anyone who sees the card may select (a crew theme's tags belong to the crew actor). An open roll or review dialog takes a clicked tag, as on the system sheet.

**Lock state.** Keep the system's `actor.system.locked`:
- **locked** = play mode: clicking a tag selects it;
- **unlocked** = edit mode: inline inputs, plus and minus buttons, delete.

## 7. Visual and technical notes

- **Frameless, floating sheet (user rule, top priority).** The sheet must look like cards floating over the canvas, with no Application frame:
  - no window background, border, shadow, backdrop blur or title text; only the cards, the top band and (later) the deck show;
  - the **top band** is the window header: one row holding the move bar and the small header controls (⋮ menu, copy UUID, "Open system sheet", ×) at the right, on a dark translucent background (`rgba(0,0,0,0.45)`, rounded) so the user sees where to grab it. It is the **drag handle**: the move bar row is laid over the header and lets pointer events through except on its buttons, so pressing an empty part of the band drags the sheet and the buttons still click;
  - empty parts of the window are **click-through** (`pointer-events: none` on the window, content and containers; `auto` on cards, buttons, controls, header and the faint resize handle);
  - the rules use `.application.mh-card-sheet.mh-card-sheet` to beat the core, system and External Style window themes. Checked with and without External Style.
- **Card size.** Reference size (user, 2026-11-18, revised twice the same day): a theme card is **520 px tall × ~204 px wide** at the sheet's default window size (880 × 637: four cards, 12 px gaps, the 56 px band, the back layer's 41 px peek, room for shadows). **Since phase 5 it is 1062 × 637:** the deck takes 0.96 card widths at the right (`--mh-cs-deck-k`), and the layers and the deck are one group centred in the window content (`--mh-cs-stage-left`, `--mh-cs-row-w`). The tag text kept its size from the earlier 620 px card (~14 px): `--mh-cs-tag-size: 6.92cqw`. A smaller window scales the cards down. The cards keep the ratio of the card art, not the mockups: the City of Mist theme art is **473 × 1203** (`--mh-cs-aspect: 473 / 1203`). Each per-system CSS file sets the ratio and where the art's bands sit, as CSS variables in card widths (`cqw`); the shared defaults are under `:where(.mh-card-sheet)` so the per-system file always wins.
  - City of Mist art: header band y 25–90, body y ~95–1105, footer band (logo) y 1112–1180, ~22 px frame. Background by themebook subtype (`mythos`, `logos`, `mist`; `extras_theme_bg.webp` for any other type).
  - The window is resizable. The window content is a size container; the card width is the largest that fits four across, and one card plus the peek (`--mh-cs-peek`, 0.2 card widths) in the height. Each card is an inline-size container and everything inside is in `cqw`.
- **Text fitting.** `card-fit.js` shrinks any `[data-fit]` element (the title) through a `--mh-fit` factor until it fits; `data-fit-lines="3"` also caps the line count (the theme title; 2 for the character's name). The base size is large, so a short title fills the space and a long one gets smaller; words never break, so a long word shrinks the text too. A title still too long at the smallest size is clamped to 3 lines with an ellipsis and a tooltip. It refits when a web font finishes loading and when a layer changes size. Long tag or improvement lists, and a long identity/mystery, scroll inside the face, so the card never grows.
- **Flip.** `.mh-cs-card-inner { transform-style: preserve-3d }` with `rotateY(180deg)`, and `backface-visibility: hidden` on both faces. Clicking the header band (or Enter/Space on it) toggles the card in place (no re-render); the face turned away is `inert`. The state is the client setting `cardSheetState` (`{ [actorUuid]: { flipped: { [cardId]: true }, front: 1 | 2 } }`), read through `MistCardSheet.cardFlips` and `frontLayer`; the `flipped` getter stays the system sheet's (§ 9).
- **Layers** (built in phase 2).
  - Both layers are absolutely positioned in the window content. The front layer is moved down by the peek; the back layer stays at the top, darker, **whole, sent behind** (not collapsed or clipped, user): its header bands show above the front layer.
  - Over each back card sits a **peek tab** (`data-action="showLayer"`, covering the card): clicking what shows of it (or Enter/Space) brings that layer to the front. The back layer's cards are `inert`.
  - Swapping layers animates `transform`, `filter` and `z-index`, with no re-render; `data-front` on the window says which layer is in front.
  - Layer 2 can hold more cards than layer 1 (character + crew + every extra). It **fans out**: the cards overlap just enough to fit the width, and a hovered or focused card comes on top.
- **tags-deck.**
  - A stack of ticket cards peeking out at the right, with a small count per type.
  - **Built in phase 5**, with the measurements below. The part's root is `display: contents`. The deck sits behind the layers (z-index 0); the forward card and the spread view sit in an overlay above them (z-index 10).
  - **Every deck card is the City of Mist tracking card** (`ui/card-sheet/com/trackingCard.webp`, 490 × 320). Two things go on top of the art, at fixed positions:
    - **The 16 pips.** The white strip (about x 30–462, y 85–170 in image pixels) has 16 slanted cells. The tier numbers sit in cells 1, 2, 4, 7, 11 and 16 (tier 5 = OUT, tier 6 = MC); the cells between them are blank. A pip is drawn in each filled cell. For a status: tier *t* fills cells 1 to C(t) (C = 1, 2, 4, 7, 11, 16), plus its `pips` towards the next tier. For a clue or juice: `amount` cells. **Checked in phase 5:**
      - this is exactly the system's `status.boxesChecked` (classic model), and `setBoxesChecked` is its inverse;
      - in the mist-engine model (`statusAdditionSystem`), one box per tier (`StatusMath.statusBoxesME`) is shown in the box of that tier's number;
      - measured on the 490 × 320 art: the strip is y 84–171, with 16 slanted cells (the lines lean ~5.7°, `skewX(-5.7deg)`). The separators are at x 31, 77.5, 117, 136.5, 174, 191.5, 211, 247.5, 267, 285.5, 305, 341.5, 361.5, 378, 395.5, 414 and 461; cells 5, 8 and 12 are the shaded narrow ones. The positions are in `card-sheet-com.css`.
    - **The type marker, top right.** Four round icons in the red band (centres x 332 / 368.5 / 405 / 441, y 37.5, 32 px), left to right: **clue** (magnifier), **juice** (jar), **tag** (tag), **status** (first-aid case). The card's type is ringed on its icon; the other three are dimmed.
  - The name goes on the TAG line (field x 128–462, y 192–252), at the tag text size. It is also written on the red band over the printed title (x 18–312, y 15–63), so the cascade shows it. The footer band (y 268–302) holds the controls strip. Legend and Otherscape get their own deck card art in phases 6 and 7.
  - Click to fan it out, grouped as statuses / story tags / juice / clues.
  - Selected cards are lifted and tinted: green for positive, red for negative.
  - A detach button opens the **TagsDeck** window:
    - frameless like the sheet, with a small dark band that holds attach and ×;
    - it shows the spread columns, and every card is worked on in place;
    - its position is kept per actor.
  - While the window is open, the sheet shows a dashed placeholder where the deck was. Clicking it, the window's attach control or its × attaches the deck again.
  - A deck left detached reopens with its sheet; closing the sheet closes the window.
- **Rendering.**
  - Use ApplicationV2 PARTS (`moves`, `layer1`, `layer2`, `deck`). A selection change re-renders only what changed.
  - Keep `will-change` on a card only while it flips.
- **Selected tags (phase 4).** The tag name is a button (`tag-name.hbs`) whose text sits in `.mh-cs-tag-text`; the row gets `mh-cs-selected mh-cs-selected-positive|negative` and a +1 / −1 mark (`::after`). Shared CSS: a tinted highlight. **City of Mist (user, 2026-11-18): the marker bars the HUD and the External Style use** (`ui/select-bar-com-{Mythos,Logos,Mist,Crew}.webp` by card type; `select-bar-com-weakness.webp` for −1) behind the whole row, white name, the mark in the card's ink; hovering shows the default direction's bar faintly. **Tag lists never scroll sideways** (`overflow-x: hidden`, user).
- **Font sizes (user, 2026-11-18, e1b0e03).** At the 204 px card: track labels, identity/mystery label and the row under the band ~11 px; character card labels and fields, crewmates, Help/Hurt ~10–12 px; improvements ~12.6 px; icon buttons 13 px in 16 px boxes. Tag text stays ~14 px.
- **Limited view.** Without ownership, show the front faces only, with no controls.
- **Drops.** Dropping a themebook, themekit or essence onto the sheet calls the same actor methods as the system's `_onDropItem`.

## 8. Phases

Each phase ends with a commit and a check in Foundry (localhost:30014, user `claude-gm`).

**Order (user decision, 2026-11-18): City of Mist first, then Legend in the Mist, then Otherscape.**
- Phases 1–5 build and finish the sheet for **City of Mist only**, until it works well.
- Legend and Otherscape differ from City of Mist. They need their own card art. They have a **backpack / loadout card**, which City of Mist does not have. Their deck has no clues and no juice.
- Do not build or test Legend/Otherscape branches in phases 1–5. Just keep the code ready for them: per-system CSS and partials, and no City of Mist assumptions in shared code.

0. **Spike.**
   - Register an empty `MistCardSheet` and switch a test PC to it and back.
   - Build the move bar: the HUD's grouping and look, with the system sheet's roll path from § 6.1, including SHB/Blaze and the move effects.
   - Fill in the action map in § 6.2.
   - *Done when:* the sheet opens with a raw data dump, and a move button opens the system roll dialog with the system's selection.
1. **City of Mist layer 1.**
   - The 4 theme cards with front and back faces, and the flip.
   - The background images and Rock Salt titles.
   - Title fitting.
   - Read-only.
   - Then, from the user: the frameless floating sheet with the band as drag handle, and the 740 × 291 card size (§ 7). The sheet re-renders on the system's `cityDBLoaded`: opened right after the world loads, it rendered before the themebooks and moves were in (no move bar, grey cards).
   - *Done 2026-11-18.* Files: `layer1.hbs`, `theme-card.hbs`, `card-fit.js`, `card-sheet-com.css` (injected by `applyCardSheetCSS` in `settings.js`), `getThemeImprovements` in `getters.js`. Checked in Foundry on Agent Ramirez (Logos ×3, Mist) and Lily Chow (Logos ×2, Mythos ×2): art per type, fitted titles, flip, flip state across a re-render and a reload, move bar opens the roll dialog. Not checked: a PC with fewer than four themes (empty slots), a really long improvement list, the burned state on real data (only checked by adding the classes in the page).
2. **City of Mist layer 2.**
   - Character card, crew theme(s) and every extra. `getExtraThemes()` only returns the **active** extra today, so phase 2 needs a getter for all of them.
   - Marking and switching the active extra.
   - Swapping the two layers.
   - First, from the user: cards 620 × 244, flip by clicking the header band, theme titles in big condensed sans capitals with glow (at most 3 lines, variable size), type icon at the right of the band, POWER/WEAKNESS headings as in the mockup, weakness tags at the bottom without the anchor icon.
   - *Done 2026-11-18* (commits d010859, aa6a3e5, 6b6345a). `getAllExtraThemes()` in `getters.js` (the system's `allLinkedExtraThemes`); `layer2.hbs`, `character-card.hbs`, `card-band.hbs`, `peek-tab.hbs`; `logModification` in the adapter. The active extra glows and is labelled; "Use this extra" calls `actor.setExtraThemeId`. Layer 2 re-renders when any crew or danger it shows changes (the system only refreshes for the active crew and extra). Checked on Gerrin (2 crews, 1 extra, a second extra for the test). Not checked: a real biography and real Help/Hurt amounts (none in the test world), a player client, Lily Chow's crew and extras (not in this world).
3. **Edit mode.**
   - The lock toggle and inline edits.
   - Attention and crack trackers.
   - Add, delete and burn tags; answer tag questions.
   - Improvements; add and delete a theme.
   - *Done 2026-11-18* (b46a524). Lock control in the header band (`toggleLock` → `actor.toggleLockState()`), `data-mode="play" | "edit"` on the window; cards carry `own` / `edit` (§ 3). Inline inputs save on change (Enter saves, Escape reverts); `_configureRenderOptions` narrows a document re-render to the layer that shows the change, and `_preSyncPartState` keeps focus, unsaved typing, the caret and every list's scroll. Character card: name, Mythos, Logos, short description inputs; biography in the core `<prose-mirror toggled>` (toolbar wraps); build-up track, +/−, BU improvements. User changes during the phase: 520 px cards with the tag text kept, CoM point-shaped tracks with the name under them, bigger mystery text. Fixed on the way: flip state (v14 `mergeObject` stores a `ForcedDeletion` object for `-=id`, which read as flipped), the empty burn flame was invisible on the light cards. Checked in Foundry as claude-gm on Gerrin (main, crew and extra themes), Lily Chow and a temporary PC; change-log entries checked; test changes undone. Not checked: theme kits (none in the world), status drops, a player client, improvements with limited uses.
4. **Play mode.**
   - Clicking tags on the cards selects them through `SelectedTagsAndStatus` (± with left and right click, like the system sheet).
   - Burned states.
   - Rolling from the move bar through the system roll dialog.
   - Check that the token tooltip and the roll dialog show the sheet's selection.
   - *Done 2026-11-18* (780e1fe selection, e1b0e03 fonts). `play-actions.js`, `tag-name.hbs`, `toggleTagSelection` / `isTagSelectable` in the adapter, selection fields on every tag context; `refreshCardSheets` is debounced (switching a direction fires two hooks). Checked in Foundry as claude-gm (Gerrin, Lily Chow, Agent Ramirez) and as Player2 on Lily: select / reverse / clear / switch; crew and extra tags land on their owners; burned tags refused; the roll dialog shows the selection, takes a tag clicked while open, the selection clears after a confirmed roll and stays after a cancel; the token tooltip shows it; scroll and focus kept; edit mode unchanged. Found: crew and extra tags marked crispy in this world burn on use after a roll (system behaviour; restored). Not checked: subtags, theme kits, loadout tags, keyboard-only selection of the negative direction (right-click only, like the system).
5. **tags-deck.**
   - Statuses, story tags, juice and clues; create them and change tiers.
   - Select ±.
   - Fan-out.
   - Detach and attach the deck window.
   - *Done 2026-11-18.*
     - **Files:** `tags-deck.js`, `ui-state.js`, `tags-deck.hbs`, `deck-columns.hbs`, `deck-card.hbs`; `getDeckItems` in `getters.js`; adapter `toggleStatusSelection`, `statusBoxes`, `setStatusBoxes`, `addDragFunctionality`, `dropDraggableOnActor`; the client setting `cardSheetModifierTotal`.
     - **User decisions this phase:** every card cascaded with its name on the band; bring forward / send back; the spread button; everything on the card (no system dialogs); small fields under the name; "Sure?" on the button; the modifier total as a setting (default: the cards).
     - **Checked in Foundry** as Player2 on Lily Chow:
       - the stack, the forward card, the spread view;
       - create: blank name, typed + Enter; an empty name or Esc deletes the card;
       - boxes and − / + against the system's classic status math;
       - selecting a status (− / +) and a story tag, with the totals in the three modes;
       - temporary, partial, source, rename, the Help target picker;
       - using a clue (the system's clue card in chat);
       - "Sure?" delete and right-click delete;
       - edit mode (the lock);
       - detach, attach, ×, and reopening with the sheet;
       - a system draggable status dropped on the deck;
       - phases 1–4 still working.
     - **Not checked:**
       - a GM client (clue use is refused for the GM, as in the system);
       - the mist-engine status model;
       - change-log entries (`loggedActions` is off in this world);
       - keyboard-only use of the negative direction.
6. **Legend in the Mist** (after City of Mist works well; needs the Legend card art).
   - Origin/Adventure/Greatness.
   - Quintessences.
   - Fellowship (layer 2).
   - **Backpack card** (layer 2), a card City of Mist does not have.
   - The deck: statuses and story tags, no clues or juice.
   - Test the Sacrifice moves (`BlazeDialog`), not tested in phase 0.
7. **Otherscape** (needs the Otherscape card art).
   - Theme types (Mythos/Self/Noise), essence on the character card.
   - **Loadout card** (layer 2).
   - The deck: statuses and story tags, no clues or juice.
   - Test Go Out in a Blaze (`BlazeDialog`), not tested in phase 0.
8. **Polish.**
   - Animations and keyboard access.
   - en and pt-br strings.
   - Limited view.
   - Remove the "Open system sheet" fallbacks that are no longer needed.

## 9. Risks

- **Changes to system internals.** Anything outside the document API can break when the system updates. It all lives in `system-adapter.js`, so a break is fixed in one place.
- **Two selections.** The sheet uses the system's `SelectedTagsAndStatus` and the HUD uses `HUDState`, so a player using both at once sees two separate selections (as today with the system sheet).
- **Move effects** (downtime, monologue, session end) live on the system sheet class. Solved in phase 0: the adapter runs them on a bare object built on `CityCharacterSheet.prototype` (§ 6.1). If the system ever gives them private fields or rendered-sheet state, that breaks, in the adapter only.
- **The system treats `actor.sheet` as its V1 sheet.** `CityDB`/`CityHelpers` refresh a PC's sheet when its crew or extra changes only if `actor.sheet._state > 0`, and the `setFlipped` helper reads `actor.sheet.flipped[n]`. `MistCardSheet` exposes `_state` (= AppV2 `state`) and `flipped` (= the flip state of the system sheet opened from the fallback button). Without them the fallback sheet failed to render.
- **New `styles` in `module.json` need a world restart.** Foundry caches the manifest; the new scripts load (imported from `init.js`) but `styles/card-sheet/card-sheet.css` only appears after the world is relaunched.
- **The lock toggle waits on a sound.** `actor.toggleLockState()` awaits `CityHelpers.playLockOpen()`, which hangs until the browser's audio is unlocked by a real user gesture: a scripted click (or a call from the console) after a page load never finishes. A real click works.
- **Text overflow** on fixed-size cards. Handled by fitting text and scrolling inside the face.
- **A wide layer 2** when a PC has many extras.
- **Crew theme ownership.** The crew theme belongs to the crew actor. Editing it needs ownership of the crew.
- **Performance** with 10+ cards using 3D and large backgrounds. Use `webp`, PARTS re-rendering, and no transforms while idle.

## 10. Still open

1. **Card background images:** City of Mist done: mythos, logos and mist backgrounds; `extras_theme_bg` for extras, crew and the character card (no separate crew or character art). Otherwise, `litm/` and `os/` come with phases 6 and 7, with names by theme type (`mythos`, `logos`, `mist`, `crew`, `extra`, `character`, `deck-ticket`, …).
2. ~~Back of the character card~~: decided — short description first, then biography.
