# Context & Architecture
I need to implement a comprehensive set of UI/UX updates, bug fixes, and rule alignments across four areas: Tracking Cards, Sheet Cards, the Overall Sheet Layout, and Module Settings/Dialogs. (Application V2)

---

## 1. Tracking Cards
* **Bottom Status Icons:** Move the `Partial`, `Temporary`, `Permanent`, and `Crispy` indicators to the bottom area of the card (the background image has been cleared there). Render them as icons with hover tooltips rather than text. Make them toggable, following the dialog and vice-versa:
  * Partial: Puzzle piece icon
  * Temporary: Hourglass icon
  * Permanent: Diamond icon
  * Crispy: Leaf or potato chip icon
* **Tag Activation Controls:** Replace the current tag activation buttons with two icons stacked vertically in the top-right corner: a `square-plus` icon on top and a `square-minus` icon directly below it.
* **Card Back:** No need of back face/flip functionality from Tracking Cards.
* **Deprecate Hurt & Help Cards:** Remove Hurt and Help as standalone tracking cards (this deviated from the core system). These will now be handled directly on the Character Card of the sheet.
* **Header Typography & Type Marker:** 
  * Make the top title font smaller and more compact so longer titles fit without truncation.
  * Change numerical font for something with serif for better readability.
  * Remove the background styling behind the title; render it as plain text.
  * Use the newly added `marker-x.svg` to indicate the selected card type without covering or obscuring the other type options.
* **Value Adjustment Controls:** Make the `-` and `+` buttons at the bottom smaller and move them to the end of the progress bars, aligned inline directly below the `6` box.
* **Clue Action Button:** On Clue cards, update the action button to display a magnifying glass icon followed by the text `"USE"`.
* **City of Mist Tier Calculation Audit (Statuses, Juice, Clues, Tags):**
  * Investigate and verify how numeric values map to tiers. Per City of Mist rules, statuses should display their **Tier** (the big milestone numbers: `4 pips = Tier 3`, `7 = Tier 4`, `11 = Tier 5`, `16 = Tier 6`), e.g., displaying `WOUNDED-4` instead of `WOUNDED-7`.
  * Ensure the underlying math and display labels are consistent across **Statuses**, **Juice**, and **Clues** (while keeping standard **Tags** as single-value entities).
* **Drag-and-Drop / Card Transfer:** Dropping or receiving a Status/Tag card onto a Character Sheet, Token, or HUD must automatically create the corresponding status or tag on that actor (or populate the appropriate field if dropped on an NPC sheet).
* **Quick Delete:** Add a trash can icon to **all** cards so they can be deleted directly without entering sheet edit mode. Clicking it must trigger the `"Sure?"` confirmation.

---

## 2. Sheet Cards
* **Publisher Assets & Theme Styling:**
  * Update styles to accommodate the new official publisher background images, directions below.
  * Set all **Mist theme-related fonts** to white.
  * Add a strong white text glow to the large **Theme Name** header of the Mist theme. White color font.
  * Shift the Theme Name slightly upward (all but Logos for now) to fit the narrower top border on the new cards art.
  * Set the **Motivation** font to be darker and bolder for readability and at least 2px larger.
* **Right-Side Tracking Card Deck:** Position the stacked Tracking Cards in a dedicated column on the right side of the sheet (already there), and its controls/footer moved to the top bar of that card stack (removing the redundant bottom footer bar).
* **Burn Icons:**
  * Align all burn icons to the **right side** of the tag row instead of the left.
  * Update the icon assets to use the files located in `\ui\card-sheet\com`.
  * Add a `1px` black drop-shadow to the **unburned/empty** icon, and a `2px` glow to the **burned** icon.
  * Increase the burn icon size slightly and anchor its vertical alignment to the **first line of text** so it stays aligned when a tag wraps onto multiple lines.
* **Tag Selection Styling:** Remove the red outline on selected tags, and remove the redundant `+1` value badge next to them.
* **Attention Pips:** Rotate the Attention pip icons **180 degrees** so the pointed end faces upward.
* **Card Back (Improvements):** When an Improvement is added to the back of a Theme Sheet, render its descriptive text directly below the improvement title.
* **Character Card — Story Tags:** Allow creating and deleting Story Tags directly in the Story Tags section of the Character Card. Creating a Story Tag here must automatically generate a corresponding Tracking Card in the deck and vice-versa.
* **Character Card — Hurt & Help:** 
  * Add a `+` button next to the **Crew** title on the Character Card to add Hurt/Help entries (calling the appropriate selection menu if needed).
  * Allow manual input/editing of the numeric modifier.
  * In **Edit Mode**, display a trash can icon at the end of each Hurt/Help line to allow deletion.

---

## 3. Overall Sheet & Overlay Layout
* **Shortened Top Header Bar:** The top header bar should not span 100% of the window width—constrain its width so it sits centered/aligned over the main Theme Cards area, leaving the left side open for the Hero Shot/Portrait and the right side open for the Tracking Card stack.
* **Organic Card Rotation:** Apply a subtle, randomized rotation (`-2deg` to `+2deg`) to card sheets for an organic tabletop feel. Add a module setting to disable this rotation for users who prefer straight alignment.
* **Front/Back Stack Offset:** Offset the X-axis alignment between the front row of cards and the back row of cards (matching the initial mockup). If there are 4 cards in front and 4 in back, they should not completely obscure one another.
* **Overlay Opacity:** Reduce the transparency (increase background opacity) of the card overlay background for better contrast. Reduce size and fit to embrace only the sheet chards (signaled in mockup).
* **Card Footer / Report:** move to the top part of the cards stack (signaled in mockup).


## 4. Character Portrait & Hero Shot Toggle
* **Header Toggle Button:** Add a `"Portrait"` button to the **left side of the top header bar** that cycles through 3 display states (persisted per actor or client flag):
  1. `"Hide Portrait"` (Portrait container hidden)
  2. `"Portrait"` (Standard `256px × 256px` square portrait)
  3. `"Hero Shot"` (Large `340px` wide × `500px` tall masked showcase on the left side of the sheet, as shown in the mockup)
* **Image Framing & Aspect Ratio (Both Modes):**
  * Use the same actor portrait image source for both `"Portrait"` and `"Hero Shot"` modes.
  * Scale the image proportionally to **fill 100% of the container height** (`object-fit: cover`), anchored to **top-center** (`object-position: top center`) so character heads are never cropped off.
* **Luminance Masks (Hero Shot Mode):**
  * Apply a CSS luminance mask (`mask-mode: luminance` / `-webkit-mask-image`) to the `340px` wide × `500px` tall Hero Shot container using PNG/SVG mask textures located in `ui/portrait-masks/`.
  * Add a **Module Setting** (dropdown) allowing the user to select between 3 mask styles:
    1. **Misty** (smooth, feathered border fade)
    2. **Dissolving** (chaotic, evaporating edge chunks)
    3. **Jagged** (sharp, angular line cutouts)
* **Character Nameplate Overlay:**
  * Along the bottom portion of the portrait/hero shot area, render the **Character Name** in large, uppercase display typography matching the **Mythos Theme Name** style (white fill with a strong outer glow/drop-shadow for legibility over artwork).

---

## 5. Module Menus, Settings & Dialogs
* **Improvement Description Dialogs:** Update the popup dialogs that appear when clicking an Improvement name on a sheet so they match the new module UI theme instead of the legacy styling.
* **Text-Based Move Roll Buttons:** Add/fix the setting to use **text labels** instead of icons for roll buttons on sheet cards (replacing image buttons with Move names). When enabled, arrange the buttons into **two rows** so the text fits cleanly without overflowing.
* **Decouple Sheet Settings from HUD Settings:** Separate the configuration menus so they don't share a single cluttered settings panel:
  * Place a dedicated **Sheet Settings** button in the Character Sheet header.
  * Place a dedicated **HUD Settings** button inside the HUD's three-dots (`⋮`) menu.
  * Place a button on the sheet to bring fort the HUD, closing the sheet.
* **Settings re-organization:** propose a better arrangement of the settings, grouping by type.
* **Per-Client HUD Visibility Toggles (PCs vs. NPCs):**
  * Register two independent **client-scoped** (`scope: "client"`) boolean module settings so each player/GM can configure their own HUD visibility without affecting others:
    1. **Enable HUD for Player Characters (PCs):** Toggles whether the HUD renders when selecting/controlling a Character actor.
    2. **Enable HUD for NPCs / Dangers:** Toggles whether the HUD renders when selecting/targeting an NPC/Danger actor (allowing a GM or player to disable the PC HUD while keeping the NPC HUD active, or vice versa).
  * Place these toggles inside the **HUD Settings** menu (accessible via the HUD's `⋮` menu, as well as the standard Foundry Module Settings list) and re-evaluate HUD rendering immediately on `onChange`.

---

## Execution Instructions
Before writing code, please:
1. Ask me for the **Top Bar mockup image** and clarify the incomplete note regarding **"The report at the bottom of cards."**
2. Confirm how you plan to handle the **City of Mist Tier-to-Pip math** (`4->3`, `7->4`, `11->5`, `16->6`) across existing actor data models so we don't break existing characters.
3. Break the implementation down into logical phases (e.g., Data/Math & Drag-and-Drop -> Tracking Cards -> Sheet Cards -> Layout & Settings) so we can review and test step-by-step.
---

# Plan (drafted 2026-11-19; the user's answers are at the end)

What the code does today, checked before planning:
- **Status tiers are already stored as tiers.** The system (4.5.3) keeps each status as `system.tier` + `system.pips`, and the tracking card fills `status.boxesChecked` boxes (tier 3 = 4 boxes, 4 = 7, 5 = 11, 6 = 16). Clicking box 7 calls `setBoxesChecked(7)`, which stores **tier 4, 0 pips**. The deck badge, the band name and the HUD (`{{name}}-{{tier}}`) all show `system.tier`. So no data migration is needed, and existing characters are safe. A `WOUNDED-7` can only come from a status whose stored tier really is 7 (typed in a dialog, an import, or a status-screen CSV), or from reading the box number instead of the tier. Phase 1 fixes the labels only: no stored value changes.
- **Juice and clues are counts, not tiers** (City of Mist rules: you spend them one at a time), but today they fill **one box per point**, so a clue of 4 fills up to the box printed "3" and clicking the box printed "4" (box 7) sets the amount to 7. The user confirmed the wrong number shows **only on clues** (statuses are right). Fix (phase 1): clues and juice use the same box ↔ number mapping as a status without pips: amount *n* fills boxes 1 to C(*n*) (C = 1, 2, 4, 7, 11, 16), and clicking a box sets the amount to the highest printed number at or before it (box 7 → 4). The badge and labels show the amount. Stored amounts do not change.
- **Help and Hurt** are the system's juice items (`subtype` `help` / `hurt`, `targetCharacterId`). Moving them from the deck to the character card changes where they show, not their data.
- **Story tags** on the character card and in the deck are the same items, so "create on one, it shows on the other" works as soon as both can create and delete.
- **Tracking cards have no back face** today; nothing to remove there.
- **The masks are in `ui/card-sheet/portrait-masks/`** (the user made the folder; `.webp` files).

## Phases (one session each, as for the card sheet plan)

**Phase 1: Data, math and drag-and-drop** (behaviour only, no restyle)
- Tier audit: clues and juice get the status box mapping (above); check every label (deck badge, band, HUD, tooltips, chat) shows the tier for statuses and the amount for clues and juice.
- Deck cards become draggable. Dropping one on a character sheet (system or card sheet), a token or a HUD creates the status or story tag on that actor (system `DragAndDrop.statusDrop` for statuses, `createStoryTag` for tags); on an NPC/danger sheet it fills the matching field. Non-owners go through the existing socket.
- Trash icon on every tracking card in both modes, with the on-card "Sure?".
- Help and Hurt leave the deck. Character card: `+` next to the Crew title (picks Help or Hurt, then the crewmate), each number editable, trash at the end of each line in edit mode.
- Story tags: create and delete on the character card.

> **Phase 1 status: done (2026-11-19), checked in Foundry as claude-gm and Player2 (Lily Chow).**
> - Clue / juice boxes: amount *n* fills boxes 1–C(*n*); box 7 → 4, box 5 → 3, box 16 → 6; clicking the last filled tier box lowers by one. Deck badge, HUD (`wounded-3`, `Test Clue (4)`), tooltips and the clue chat card agree.
> - Status and story tag cards are system draggables (the same data as the system's chat statuses and tags). Checked: a token (system status dialog), another card sheet, a danger's system sheet (tag and status), the player HUD and the NPC HUD (unlinked token actor). A card dropped on its own actor does nothing. Non-owners: `scripts/drop-relay.js` sends it to the GM over the existing `createDroppedItem` socket (checked on a token and on a HUD); the GM side no longer makes a second story tag of the same name, as `createStoryTag(name, true)`.
> - Trash on every card in both modes, with "Sure?" (not on a collective status, which the system keeps in step with the collective size).
> - Help / Hurt: gone from the deck (no cards, no create buttons). Character card: one line per crewmate a Help / Hurt points at; `+` opens a small dialog (Help or Hurt, then the crewmate) and adds one point; the numbers are fields for the owner in both modes (several items for one crewmate are merged into one); the trash (edit mode) deletes the line after the system's confirmation. New code in `scripts/card-sheet/character-actions.js`.
> - Story tags on the character card: `+` in both modes (the new tag's name is typed in place, the deck's own create action), edit / delete in edit mode (the theme cards' actions).
> - Not checked: a real mouse drag (the drags were dispatched as browser drag events); Firefox; a drop on the system sheet of an actor the user does not own (the system drops nothing there and no relay was added). The CSS for the new controls is minimal: their look belongs to phases 2–3.

**Phase 2: Tracking cards (look)**
- Partial / Temporary / Permanent / Crispy as toggle icons in the bottom area (puzzle piece, hourglass, gem, leaf), with tooltips, synced with the fields. Each icon only where the system has the field (user: "follow the system"): crispy on story tags only (`system.crispy`), partial on clues, temporary / permanent on statuses and story tags.
- `square-plus` over `square-minus` in the top-right corner, replacing the select buttons.
- Smaller, compact title with no background; serif numerals; `marker-x.svg` on the card's type icon (the other icons stay visible).
- Smaller `−` / `+` at the end of the boxes, under the tier-6 box.
- Clue button: magnifier + "USE".
- The deck's toolbar (counts per type, spread, detach) moves to a top bar over the stack; the bottom bar goes (user: "the report" = this toolbar).

> **Phase 2 status: done (2026-11-19), checked in Foundry as claude-gm and Player2 (Lily Chow), play and edit mode, stack / focus / spread and the detached window.**
> - The new `trackingCard.webp` is **321 × 208** (was 490 × 320), same layout, footer band blank. Re-measured (in `card-sheet-com.css`): band y 8–40, type icons centred x 218.5 / 242.5 / 267.5 / 292, y 23.5; box strip y 55–110 (the 16 cells moved < 1 px, kept); TAG field x 77–302, y 126–166; footer band x 18–309, y 178–198.
> - Name on the band as plain text (Rift, smaller, fitted by `card-fit.js` to two lines at most); the printed "TRACKING CARD" is hidden by a patch of the band's own colour (#93523b) that fades out at its edges, so no box shows. Tier / amount in PT Serif Bold (system font).
> - `marker-x.svg` crosses the card's own type icon; the other three are no longer dimmed.
> - `square-plus` / `square-minus` at the band's right end, play mode, statuses and story tags (+tier / −tier, +1 / −1); live in the stack too. They replace the name buttons (the name is plain text; the right-click selection on the name is gone). New adapter `setRollDirection`.
> - Footer band: toggle icons at the left (puzzle = partial on clues; hourglass / gem = temporary / permanent on statuses and story tags; leaf = crispy on story tags only, `getDeckItems` now reads `crispy`), always shown, dimmed when off, buttons for the owner (tooltip says on / off), the "on" ones only in the stack and for non-owners. Tools at the right on hover (always on a card brought forward): burn, clue "🔍 USE", trash, "Sure?".
> - Small round − / + under the box printed 6 (hover; always on a card brought forward).
> - Deck toolbar on top of the stack; no bottom bar.
> - Not done here: the phase-1 character card controls (Crew +, Help / Hurt fields, story tag +) keep their minimal look for phase 3. Not checked: Firefox; a real mouse hover (the hover-only tools were checked by forcing them visible).
>
> **Phase 2 follow-up (user, 2026-11-19): done, checked in Foundry as claude-gm (Lily Chow).**
> - A selected status that changes tier now updates the totals by the move bar (and the roll): the system keeps the amount from when it was selected, so the adapter's `syncSelectedStatusTier` sets its entry to ±(new tier) on `updateItem` and fires `TagOrStatusSelectChange`.
> - The number follows the name on the band: `NAME-3` (status), `NAME (2)` (clue; juice too). The separate badge is gone.
> - Toolbar `+`: a menu (clue, juice, tag, status) opens a blank card forward (a draft, not an item yet). Its type can be changed by clicking the type marker's icons; Enter or "Create" makes the item with the system's creation methods and brings it forward; Esc / "Back to the deck" drops it. The column `+` buttons in the spread and the detached window stay.
> - A card brought forward: darker backdrop (0.92 + blur); its + / − squares float outside the card, at its right (filled green / red when on).
> - The detached window has the same dark backdrop.
> - Selected cards: outline only (green / red ring), no colour overlay.
> - The card last brought forward stays at the front of the stack (`deck.top` in the client UI state).
> - Toolbar eye: hide / unhide. Hidden, the deck slides 0.8 card widths behind the layers; only the unhide button and a strip of the cards show (`deck.hidden`).
>
> **Second follow-up (user, 2026-11-19): done, not tested here (the user tests).**
> - The detach button is off the deck toolbar; `detachDeck`, the deck window and the "detached here" placeholder stay in code (maybe for the HUD later).
> - A blank card is made as soon as its name is left with something typed (blur, Enter, Esc, the close / back buttons, a click beside it); a click on a type marker first changes the type and keeps the name. Left empty, it is still dropped.
> - Hide / unhide is a chevron: left hides, right unhides.
> - The full view has a round × close button in its top-right corner, as the spread deck.

**Phase 3: Sheet cards (look)**
- The new card art: Mist fonts white, theme name white with a strong glow, shifted up on Mythos and Mist (not Logos yet); Motivation darker, bolder, +2 px.
- Burn icons at the right of the tag row, the new `com_burn_empty.svg` / `com_burned_<type>.svg`, 1 px black shadow when empty, 2 px glow when burned, a bit bigger, aligned with the first line of text.
- Selected tags: no red outline, no `+1` badge (the marker bar stays).
- Attention pips turned 180°.
- Improvements on the card back: description under the title.
- Improvement dialogs in the new module look.

> **Phase 3 status: done (2026-11-19). A quick look in Foundry as claude-gm (Lily Chow); the user tests the rest.**
> - The new art (Mythos, Mist, extras) is **227 × 579** (Logos is still the old 473 × 1203). Its top band is narrower: y 10–32 = 4.4–14.1 cqw. On every card but Logos the band label sits in it and the body starts 4.4 cqw higher (`--mh-cs-body-top` 17.6 cqw), so the theme name moves up. Extras and crew cards move up too: they use the new extras art ("all but Logos").
> - Mist: the art is dark, so every font is white (ink, band, rules, motivation, track labels, pips unfiltered, dark edit fields). The theme name is white with a strong white glow.
> - Motivation: Rock Salt 5.8 cqw (was 4.8, about +2 px), black, drawn bolder with a thin stroke of its own ink (the font has one weight). The label is bold, 6.4 cqw and fully opaque. Line height stays 1.55: below that, Rock Salt overflows by 1 px and a scrollbar shows.
> - Burn flames: at the right end of the row (after the trash in edit mode), 5.4 × 7.4 cqw (was 5 × 5), centred on the first line of the name (the row aligns to the top). Empty: `com_burn_empty.svg` with `drop-shadow(0 0 1px #000)`. Burned: `com_burned_<mythos|logos|mist|extras>.svg` with a 2 px glow in the card's colour (white on Mist). To burn: the same at 0.7 opacity. Extras, crew and the character card's story tags use the extras flame.
> - Selected tags: the `+1` / `−1` badge is gone (the bar's colour says the direction). The red outline was core's `button:focus` (1 px, warm): the name keeps the focus across the re-render. It is removed for mouse focus; the keyboard ring stays.
> - Attention pips turned 180° (crack and build-up are unchanged).
> - Card back: the improvement's description is shown under its name, in small italics (`improvement.hbs` takes `desc=true` from the theme card). The character card's build-up list keeps it as a tooltip, for lack of room.
> - Improvement dialog: new `improvementDialog` in the adapter, used by add and edit. It is a DialogV2 (`templates/card-sheet/improvement-dialog.hbs`) with what the system sheet shows for a chosen improvement: the description, the choice (the system's core move list for `THEME_DYN_SELECT`, otherwise free text) and the uses. Save writes `system.choice_item`. A custom (not chosen) improvement still opens the system's full sheet. Look (`.mh-cs-dialog`, in `card-sheet-com.css`): a dark glass window, the title in Rift caps with a white glow, a paper panel with the cards' headings and dashed fields, and dark Rift keys. It beats the External Style's book page. The phase-1 dialogs (Help / Hurt, theme delete) take the same look.
> - Not checked: a real Mist theme (Lily has none: checked by swapping the card's class in the page), a real burned or to-burn tag (classes swapped the same way), the add-improvement flow end to end, a core-move choice, Firefox. Not changed: the themebook's improvement choice list (the system's `singleChoiceBox`) keeps the system / External Style look.

**Phase 4: Layout, portrait and hero shot** (needs the mockup and the masks)
- Shorter header bar over the theme cards only.
- Random −2°…+2° rotation per card (stable per card, not per render), with a client setting to turn it off.
- Back row offset on the X axis from the front row.
- Overlay darker and fitted to the sheet cards only.
- "Portrait" button at the left of the header bar: Hide / Portrait 256 × 256 / Hero Shot **340 px wide × 500 px tall** (portrait orientation; user, 2026-11-19; per actor, client UI state), `object-fit: cover` + `object-position: top center`, the character name below in the Mythos title style.
- Masks: a client setting **None / Misty / Dissolving / Jagged** (user added "None"). The user supplies the files and will swap them while testing, so the code must take whatever is in the folder: fixed names in the folder the user made, `ui/card-sheet/portrait-masks/`: `misty.webp`, `dissolving.webp`, `jagged.webp` (as of 2026-11-19; a `jagged.png` is there too) (white = shown, black = hidden, `mask-mode: luminance`), stretched to the 340 × 500 Hero Shot box (`mask-size: 100% 100%`); the user's mask images are 340 × 500 px, no other processing. A missing file must not hide the portrait: check the image loads, fall back to no mask.

> **Phase 4 status: done (2026-11-19). A quick look in Foundry as claude-gm (Lily Chow); the user tests the rest.**
> - Header bar: only over the theme cards (both layers' width). The window is now a size container, so the bar is placed with the same stage geometry as the layers (`--mh-cs-cw` / `-ch` = the window less its padding). The move bar sits on it, as before. The header controls stay at the bar's right end. The left is open for the portrait, the right for the deck and its own toolbar.
> - Tilt: each sheet card (both layers) is turned −2°…+2°. The angle is a hash of the card's id (`portrait.js`, `cardTilt`), so it is the same on every render and every reload, with no stored state. Client setting **Card Sheet: Tilted Cards** (on by default). It applies at once.
> - Back row: offset 0.1 card width to the left of the front row (`--mh-cs-back-shift`), as in the first mockup. Its side edges show, not only its header bands. The stage has room for it, plus 8 px at each side for the tilt. The default window is now 1098 × 637 (was 1062), so the cards keep their 204 px.
> - Overlay (spread deck, card brought forward): covers only the sheet cards (both layers, the back row's offset included). It is darker: 0.9 (was 0.72), and 0.95 + blur for a card brought forward (was 0.92). The stack and its toolbar stay outside it. The card brought forward is 0.58 of the row's width (was 48 % of the window).
> - Portrait: a white square button at the left of the header bar cycles **Hide → Portrait → Hero Shot**. The choice is per actor, in the client UI state (`cardSheetState[uuid].portrait`, default hidden). New part `portrait` (`templates/card-sheet/portrait.hbs`). The column is 256 × 256 or 340 × 500 at the reference card (204 px), and it scales with the cards when the window does. The image is `actor.img`, with `object-fit: cover` and `object-position: top center`. The column starts at the top of the window, behind the layers, and is click-through. The window grows or shrinks at its left by the column's width, so the cards stay where they are; it opens at the right width (1366 / 1450) for an actor whose portrait is shown.
> - The name: under the image, in Rift Bold caps, with the Mythos title's white and violet glow plus a dark shadow (the glow is in em). It is fitted to two lines by `card-fit.js`. On the Hero Shot it rises over the image's bottom, as in the mockup. It re-renders on a name or image change.
> - Mask: client setting **Card Sheet: Hero Shot Mask** with None / Misty (default) / Dissolving / Jagged. It uses `ui/card-sheet/portrait-masks/<name>.webp`, fixed names, with `mask-mode: luminance` and `mask-size: 100% 100%`, on the Hero Shot only. The image is loaded first, and the mask is set only once it loads. A missing file shows the portrait unmasked. Checked by pointing the setting at a file that does not exist. A change of the setting applies at once and checks the files again (so swapped files are picked up; a page reload also does it).
> - Checked: the bar and the move bar have the same position and width; the Hero Shot is 340 × 500 with Misty and with Jagged; the Portrait is 256 × 256; the cards stay in place through Hide → Portrait → Hero → Hide (window 1098 / 1366 / 1450); reopening keeps the mode; the spread view and a card brought forward inside the fitted overlay; the tilt setting on and off.
> - Not checked: a real mouse drag of the window by the shorter bar (the bar is still the core header, so dragging should work as before); a window much smaller or larger than the default; Dissolving; a player client; Firefox; the detached deck window (its rules are left out of the bar changes). The Portrait button's tooltip reads "Portrait: Portrait. Click: Hero Shot" in the middle state.
>
> **Phase 4 follow-up (user, 2026-11-19): done, not tested here (the user tests).**
> - The Portrait button is a miniature of the actor's portrait (cover, top centre) in a white frame. It is square for Portrait, tall for Hero Shot (30 × 44), and grey, faded and dashed while the portrait is hidden. It follows a change of the actor's image.
> - The mask selector also goes in the Sheet Settings that phase 5 builds.

**Phase 5: Settings and dialogs**
- Text move buttons on the card sheet (two rows) through the existing `useTextButtons` setting, or a sheet-only one.
- A "Sheet Settings" button in the sheet header and a "HUD Settings" entry in the HUD's ⋮ menu (two `registerMenu` forms); a sheet button that opens the HUD and closes the sheet.
- Two client settings: show the HUD for PCs, show it for NPCs/dangers, applied at once on change.
- Settings regrouped (proposal):
  - **HUD Settings** (client): layout mode, dock side, wide layout, open on select, auto-fold delay, text move buttons, HUD for PCs, HUD for NPCs.
  - **Sheet Settings** (client): card rotation, text move buttons on the sheet, modifier total, hero shot mask.
  - **World** (GM, in the core list): visual style (External Style), status and tag notifications, status tabs, NPC accordion, debug mode.
  - **Dice** (client): automatic dice set.

## Answers (user, 2026-11-19)
1. **Mockup:** `docs/mockup-3.png`. What it shows:
   - the Hero Shot at the far left, masked, with **LILY CHOW** in big white Mythos-style capitals near the bottom and a small "⚡ MYTHOS-2"-like line under it;
   - the top bar only over the theme cards (x ≈ 280–1120 of 1364), black, with a white square at its left (the Portrait button), then the cards count and the move buttons, the header controls at its right;
   - the bar's extension over the deck is crossed out, and so is the deck's bottom toolbar: the deck's own toolbar (counts, spread, detach) sits on top of the stack;
   - a red line through the "UNNAMED JUICE" band with an arrow down past the last card: read as "the stack hangs down from its top toolbar" (to confirm in phase 2 if unclear);
   - the character card (layer 2) peeks above the middle of the front row.
2. "The report at the bottom of cards" = **the deck's toolbar**.
3. The wrong number is **only on clues** (statuses checked and right). See the clue / juice fix above.
4. The user **supplies the masks** and wants to swap the files freely; add a **"None"** option (see phase 4).
5. Crispy: **follow the system** (story tags only).
