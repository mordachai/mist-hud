# Mist HUD — Issue Analysis and Solution Plan

_Date: 2026-11-14. Analysed against the working tree on `main` (refactor commit `91f76d6` plus uncommitted edits), Foundry 14.369, city-of-mist system 4.5.3._

**How this was checked.** Everything below comes from reading the module, the installed system and the Foundry v14 source. Nothing was run in Foundry: the local server asks for the administrator password, which I cannot enter. Issue screenshots were not viewed. Items marked _(verify in Foundry)_ are the ones where static reading is not conclusive.

## 1. The main finding

The published release (2.50.2) is still the **pre-refactor** code. Four of the nine open issues (#36, #38, #40, #41) are that old code failing against current Foundry and system versions. The refactored tree on `main` removes those causes, but it has never been released, and it has its own roll bugs that must be fixed first (section 3).

So the fix for most user pain is: finish the refactor's roll path, then ship a release.

## 2. Open GitHub issues

| # | Issue | Cause | Status in current tree | What it needs |
|---|---|---|---|---|
| 41 | Update to Foundry v14 | Released code is v13-era | Mostly ready, 3 blockers | Fix B1, B2, B3 below; set `compatibility` to min 13 / verified 14; release |
| 40 | HUD broken, not showing | Old `mist-hud.js` imports a system file that no longer exists, so the whole module fails to load | Cause removed | Release. Add the import guard (C4) so a future system change cannot blank the HUD again |
| 38 | `story-tag-window.js` missing | Same import as #40 | No such import remains in `scripts/` | Release; close |
| 36 | Rolls throw "Maximum call stack" | Old `mh-roll.js` re-rendered the HUD inside the roll | Old roll engine is gone; rolls now go through the system's `CityRoll` | Fix the new roll path (A1–A7), then release |
| 30 | Inverting a tag resets when another tag is selected | Old code kept inversion in the DOM | Fixed: inversion lives in `HUDState` and survives re-render | Small leftover: crew weakness tags never get an updated arrow icon ([player-hud.js:131](scripts/player-hud.js:131)). _(verify in Foundry)_ |
| 34 | Challenge templates missing from NPC HUD | HUD reads `actor.items` only; template moves and limits are not embedded items | **Still broken** | Use `actor.getGMMoves()` and `actor.getSpectrums()` in [npc-hud.js:210](scripts/npc-hud.js:210) and [npc-hud.js:249](scripts/npc-hud.js:249) |
| 32 | Open more than one challenge | Every NPC HUD window uses the fixed id `npc-hud` | **Still broken** | Unique id per token, reuse the existing window for a token, cascade positions (D1) |
| 33 | Otherscape scene-tags window: overlapping text | Module CSS overrides the system's window: `margin:-2px` + border + padding on every tag ([mist-hud.css:740](styles/mist-hud.css:740)) | **Still broken** | Remove or tightly scope the overrides (E1) |
| 35 | LitM scene-tags window: weird texture | `.scene-tag-window` is on both the window frame and its inner div, so the paper texture is painted twice with `cover` ([mh-legends-in-the-mist.css:1336](styles/mh-legends-in-the-mist.css:1336)) | **Still broken** | Same as #33 (E1). The `getComputedStyle` console error in that report is in the system's own `story-tag-application.js`, not this module |

## 3. Problems nobody has reported yet

### A. Rolls (player HUD) — highest priority

All in [player-hud.js:478-523](scripts/player-hud.js:478) and [hud-state.js](scripts/hud-state.js).

- **A1. Burning a tag gives no bonus.** `burnTag` is never passed to `CityRoll`, so a to-burn tag counts as +1 instead of +3. `HUDState.getBurnTagId()` exists but is never called.
- **A2. Special moves roll wrong.** The HUD calls `execRoll()` directly, skipping the system's handling of move subtypes. Mythos/Noise/Self rolls, Stop Holding Back and Go Out in a Blaze lose their theme-count bonus; Flashback, Downtime and Session End roll dice when they should not.
- **A3. Data loss after every roll.** `_postRollCleanup` deletes _every_ temporary tag on the actor, selected or not, and ignores the system's "burn temporary tags" setting. It also repeats burn and status cleanup the system already did.
- **A4. Help & Hurt is never added to the roll.** The bonus is shown in the footer but not sent to `CityRoll`, and never cleared afterwards.
- **A5. NPC influence is never added to the roll.** The cache `globalThis.activeNpcInfluences` is maintained but nothing reads it at roll time. The whole Influence Viewer currently has no effect on rolls.
- **A6. Scene tags and statuses are ignored.** The README promises they can be selected for rolls; the system's `SelectedTagsAndStatus` selection is not merged in.
- **A7. Improvement-based Dynamite is ignored.** _(`BonusManager.checkRolls` removed in phase 3.)_ `move.isAutoDynamite()` is not checked; `BonusManager.checkRolls` is dead code calling a method that no longer exists.
- **A8. Power preview is wrong.** `previewPower()` counts weakness tags as +1, subtracts 2 for any inverted tag even if unselected, and counts statuses as ±1 instead of their tier.
- **A9. Roll errors are silent.** Failures only go to the console; the player sees nothing and the selection is left as it was.

### B. Foundry v14 blockers

- **B1. Both toolbar buttons do nothing.** [init.js:106](scripts/init.js:106) and [init.js:116](scripts/init.js:116) use `onClick`; v13/v14 scene tools only call `onChange`.
- **B2. NPC Influence Viewer crashes on open.** [npc-influence-manager.js:230](scripts/npc-influence-manager.js:230) calls the global `mergeObject`, which does not exist in v14.
- **B3. Manifest.** `compatibility` says verified 13; the pack is declared for `city-of-mist` only; the `license` URL has a typo (`raw.githubusercontent.mist`).
- **B4. Deprecated but still working (until v15/v16):** global `renderTemplate` and `FilePicker`, V1 `Dialog`, and the two V1 `Application` windows (NPC HUD, Influence Viewer). Cheap to fix the first three now; port the V1 windows later.

### C. Robustness

- **C1. Help/Hurt checkboxes lose their state on re-render.** They read an `active-bonuses` flag that nothing writes ([getters.js:318](scripts/getters.js:318)).
- **C2. Bonus refresh is a no-op.** `globalThis.playerHudRegistry` is read in `bonus-manager.js` but never assigned.
- **C3. Dropping a status or tag on a token you do not own fails** with a permission error; it needs a GM socket relay ([init.js:123](scripts/init.js:123)).
- **C4. Hard imports of system internals** (`/systems/city-of-mist/module/...`) are what caused #38/#40. They also break under a route prefix. Load them with a guarded dynamic import and show a clear notification on failure.
- **C5. Unlinked tokens share one HUD and one selection state**, because both are keyed by `actor.id`.
- **C6. Actor name is inserted into the header as raw HTML** ([player-hud.js:253](scripts/player-hud.js:253)).

### D. NPC HUD

- **D1. Window management.** A new `NpcHUD` is created on every right-click without closing the previous one for that token; all share one DOM id; the scene-change cleanup tests `id.startsWith('Token.')`, which is never true.
- **D2. Scene load may open a HUD for every threat token** for the GM: `canvasReady` calls `setActor()`, which ends in `render(true)` ([npc-hud.js:1332](scripts/npc-hud.js:1332)). Influence should be computed without opening windows. _(verify in Foundry)_
- **D3. Otherscape/LitM soft moves are built by spreading a Document** (`{ ...move, consequences: [] }`), which can drop `name` and other getters. _(verify in Foundry)_

### E. Styling against the README screenshots

- **E1. Scene-tags window overrides** (see #33/#35). System 4.5.3 already themes this window per game; the module should stop restyling it.
- **E2. ApplicationV2 frame is unstyled in places.** No CSS hides the frame's own header buttons and icon, so the HUD probably shows two close buttons, plus default V2 padding and background that the README look does not have. _(verify in Foundry against `external_files/CoMScreen.png`, `OSScreen.png`, `LitMScreen.png`)_

### F. Housekeeping

- **F1. Dead code.** _(Fixed in phase 3: file, placeholder block and `DYNAMITE_MOVES` removed.)_ `npc-influence-functions.js` is not in `module.json`; it is only pulled in by a dynamic import, which then registers hooks late using the old controls API. Also the `_npc_hud_helpers_legacy_placeholder` block and `FLAG_KEYS.DYNAMITE_MOVES`.
- **F2. Removed features still shipped or documented.** The compendium still holds the Dynamite Moves Panel macro, whose function was removed. The README still describes hotbar macros, the Dynamite panel, "Foundry VTT version 12" and "Legends in the Mist is not supported".
- **F3. Compendium churn.** `packs/mist-hud-macros` has uncommitted LevelDB changes and a `lost/` folder from a repair. Decide what the pack should contain, rebuild it from Foundry, and ignore `lost/`.
- **F4. Localisation.** Setting names, window titles and tooltips are hard-coded English; `lang/*.json` only has system-term keys.

## 4. Solution, in order

### Phase 1 — make the refactor releasable (closes #36, #38, #40, #41)

1. **Rewrite `_executeMove`**:
   - Build the list from `HUDState`, then append the system's scene selection (A6), help/hurt entries and NPC influence entries as `type: "modifier"` rows (A4, A5).
   - Pass `burnTag` from `getBurnTagId()`. For Otherscape/LitM multi-burn, set `amount: 3` on the extra to-burn tags (A1).
   - Branch on `move.system.subtype`: `standard` uses `execRoll()`; anything else uses `CityRoll.execMove()`, which sets the right options and opens no dialog for those subtypes (A2).
   - Set `dynamiteAllowed` from the toggle or `move.isAutoDynamite()` (A7).
   - Notify the user on failure (A9).
2. **Shrink `_postRollCleanup`** to: mark the extra multi-burn tags burned, clear `HUDState`, clear the system selection, ask the GM to clear received bonuses, reset the Dynamite toggle. Remove the temporary-tag and status deletion (A3).
3. **Fix `previewPower()`** to use the same list as the roll (A8).
4. **B1, B2, B3**: `onChange`, `foundry.utils.mergeObject`, manifest.
5. **C1, C2**: write the `active-bonuses` flag where the bonus is applied; import the registry instead of reading a global.
6. **C4**: guarded system imports.
7. **E2**: style the V2 frame, compare with the three README screenshots.
8. Bump to 3.0.0, update README (F2), publish a release.

### Phase 2 — remaining reported issues (#32, #33, #34, #35, #30 leftover)

9. **#34**: `getGMMoves()` / `getSpectrums()`; mark template-owned entries read-only in the HUD.
10. **#32 + D1 + D2**: one HUD per token, id `npc-hud-<tokenId>`, reuse on right-click, cascading position, compute influence without rendering. Update `#npc-hud` CSS selectors to the `.npc-hud` class.
11. **#33 + #35**: delete the `.scene-tag-window` and `.item-selection-context` rules from the four stylesheets; keep only what the README look needs, scoped to `.story-tag-window > .window-content`.
12. **#30 leftover**: set `inversionIcon` for crew weakness tags.

### Phase 3 — hardening

13. C3 (GM relay for drops), C5 (key by token for unlinked actors), C6 (escape name).
14. B4: namespaced `renderTemplate` / `FilePicker`, `DialogV2`; port NPC HUD and Influence Viewer to ApplicationV2 before v16.
15. F1, F3, F4: remove dead code, rebuild the pack, localise UI strings.

## 5. Test checklist for the release

Run once per game (City of Mist, Otherscape, Legend) on Foundry v14, and once on v13:

- HUD opens on token select, closes on deselect, matches the README screenshot.
- Plain roll with power tag, weakness, inverted weakness, story tag, positive and negative status.
- Burn roll gives +3 and leaves the tag burned; unselected temporary tags survive.
- One theme-type roll and one no-roll move.
- Help/Hurt from a second player changes the total and clears after the roll.
- NPC tag set to negative changes the player's total.
- Scene tag selected in the scene window changes the total.
- Both toolbar buttons open their windows.
- Two challenge HUDs open side by side; a challenge with a template shows the template's limits and moves.
- Scene-tags window is readable in all three games.

## 6. Suggested replies on GitHub

- **#36, #38, #40, #41**: "Fixed in 3.0.0" once Phase 1 ships; close.
- **#30**: ask the reporter to confirm on 3.0.0; close.
- **#32, #33, #34, #35**: label as confirmed; close with the Phase 2 release.
