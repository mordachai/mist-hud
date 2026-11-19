// settings.js — Module settings registration and system CSS injection
// (accordion logic is now inlined where needed; useHotbarForRolls removed)

import { MODULE_ID, SETTINGS, getActiveSystem } from "./constants.js";
import { rescheduleAllFolds } from "./hud-fold.js";
import { HudSettingsForm, SheetSettingsForm } from "./settings-forms.js";

export { MODULE_ID };

// ── System CSS injection ──────────────────────────────────────────────────────

const SYSTEM_CSS_MAP = {
  "city-of-mist": "/modules/mist-hud/styles/mh-city-of-mist.css",
  "otherscape":   "/modules/mist-hud/styles/mh-otherscape.css",
  "legend":       "/modules/mist-hud/styles/mh-legends-in-the-mist.css",
};

export function applySystemCSS(system) {
  const cssPath = SYSTEM_CSS_MAP[system];
  const existing = document.querySelector("link[data-system-theme]");
  if (existing && existing.href.includes(cssPath)) return;
  document.querySelectorAll("link[data-system-theme]").forEach(l => l.remove());
  if (!cssPath) { console.warn(`No CSS defined for system "${system}".`); return; }
  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = cssPath;
  link.type = "text/css";
  link.dataset.systemTheme = "true";
  document.head.appendChild(link);
}

// ── Card sheet art (MistCardSheet) ────────────────────────────────────────────
// Per-system card backgrounds and fonts, injected like the system CSS. A
// system without an entry gets the shared card-sheet.css only.

const CARD_SHEET_CSS_MAP = {
  "city-of-mist": "/modules/mist-hud/styles/card-sheet/card-sheet-com.css",
};

export function applyCardSheetCSS(system) {
  const cssPath = CARD_SHEET_CSS_MAP[system];
  const existing = document.querySelector("link[data-mh-card-sheet]");
  if (existing && cssPath && existing.href.includes(cssPath)) return;
  existing?.remove();
  if (!cssPath) return;
  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = cssPath;
  link.type = "text/css";
  link.dataset.mhCardSheet = "true";
  document.head.appendChild(link);
}

// ── External Style (system Visual Style "custom") ─────────────────────────────
// Sheet/chat/sidebar restyle for the system's "External Style (requires Module)"
// visual style. Each file is rooted under body.style-custom, and only systems
// listed here can use it (others keep the system's own style).

const EXTERNAL_CSS_MAP = {
  "city-of-mist": "/modules/mist-hud/styles/external/mh-ext-city-of-mist.css",
  "otherscape":"/modules/mist-hud/styles/external/mh-ext-otherscape.css",
  "legend":     "/modules/mist-hud/styles/external/mh-ext-legend.css",
};

export function hasExternalStyle(system) {
  return Object.hasOwn(EXTERNAL_CSS_MAP, system);
}

function externalStyleEnabled() {
  try { return game.settings.get(MODULE_ID, SETTINGS.EXTERNAL_SHEET_STYLE); }
  catch { return false; }
}

export function applyExternalCSS(system) {
  const cssPath = externalStyleEnabled() ? EXTERNAL_CSS_MAP[system] : undefined;
  // Titles the system's templates don't print (the threat sheet's Statuses
  // card, the CoM theme card's Power Tags / Weakness Tags labels): handed to
  // the CSS as localized strings for `content:`.
  const labels = {
    "--mhx-label-statuses":      "CityOfMist.terms.statuses",
    "--mhx-label-power-tags":    "CityOfMist.terms.powerTags",
    "--mhx-label-weakness-tags": "CityOfMist.terms.weaknessTags",
  };
  for (const [prop, key] of Object.entries(labels)) {
    document.documentElement.style.setProperty(prop, JSON.stringify(game.i18n.localize(key)));
  }
  const existing = document.querySelector("link[data-mh-external]");
  if (existing && cssPath && existing.href.includes(cssPath)) return;
  existing?.remove();
  if (!cssPath) return;
  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = cssPath;
  link.type = "text/css";
  link.dataset.mhExternal = "true";
  // Stand in for the system's per-system CSS: load before module stylesheets
  // (including our HUD CSS) so the HUD still wins same-specificity ties.
  const firstModuleSheet = document.head.querySelector('link[rel="stylesheet"][href*="modules/"]');
  document.head.insertBefore(link, firstModuleSheet);
}

const VISUAL_STYLE_KEY = "city-of-mist.visualStyle";
const isActiveGM = () => game.user === game.users.activeGM;
const getVisualStyle = () => game.settings.get("city-of-mist", "visualStyle");
const setVisualStyle = style => game.settings.set("city-of-mist", "visualStyle", style);

// The system's onChangeTo() re-runs itself (setting `system` fires its onChange
// again), so one Game System change resets visualStyle several times. Show
// each notice once per burst.
const NOTICE_WINDOW_MS = 5000;
const lastNotice = new Map();
function noticeOnce(level, key) {
  const now = Date.now();
  if (now - (lastNotice.get(key) ?? 0) < NOTICE_WINDOW_MS) return;
  lastNotice.set(key, now);
  ui.notifications[level](game.i18n.localize(key));
}

/** Put the system on External Style if our setting wants it. Active GM only. */
async function enforceExternalStyle() {
  if (!isActiveGM() || !externalStyleEnabled()) return;
  const system = getActiveSystem();
  if (!hasExternalStyle(system)) {
    noticeOnce("warn", "MistHUD.notify.externalStyleUnavailable");
    return;
  }
  if (getVisualStyle() === "custom") return;
  await setVisualStyle("custom");
  noticeOnce("info", "MistHUD.notify.externalStyleRestored");
}

export async function detectActiveSystem() {
  const system = getActiveSystem();
  applySystemCSS(system ?? null);
  applyExternalCSS(system ?? null);
  applyCardSheetCSS(system ?? null);
  return system ?? null;
}

// ── Settings registration ─────────────────────────────────────────────────────
// Grouped (fixes phase 5):
//  - HUD Settings (client): a form of its own (settings-forms.js), opened from
//    the core list and the HUDs' ⋮ menu. The two "show the HUD" toggles are
//    also in the core list.
//  - Sheet Settings (client): a form of its own, opened from the core list and
//    the card sheet's header.
//  - World (GM): in the core list.
//  - Dice (client): in the core list.
// Settings with no UI (state kept for the user) come last.

Hooks.once("init", () => {
  const K = key => `MistHUD.settings.${key}`;

  // ── Menus ───────────────────────────────────────────────────────────────────

  game.settings.registerMenu(MODULE_ID, "hudSettings", {
    name:  "MistHUD.settingsForm.hud.title",
    label: "MistHUD.settingsForm.hud.button",
    hint:  "MistHUD.settingsForm.hud.hint",
    icon:  "fa-solid fa-square-user",
    type:  HudSettingsForm,
    restricted: false,
  });

  game.settings.registerMenu(MODULE_ID, "sheetSettings", {
    name:  "MistHUD.settingsForm.sheet.title",
    label: "MistHUD.settingsForm.sheet.button",
    hint:  "MistHUD.settingsForm.sheet.hint",
    icon:  "fa-solid fa-id-card",
    type:  SheetSettingsForm,
    restricted: false,
  });

  // ── HUD Settings (client) ───────────────────────────────────────────────────

  // Show the HUD for player characters / for NPCs and dangers, per user. Off:
  // selecting a token of that kind no longer opens its HUD, and the open ones
  // close; on again, the selected token's HUD opens. Also in the core list.
  game.settings.register(MODULE_ID, SETTINGS.HUD_FOR_PCS, {
    name: K("hudForPCs.name"),
    hint: K("hudForPCs.hint"),
    scope: "client", config: true, type: Boolean, default: true,
    onChange: enabled => Hooks.callAll("mistHudVisibility", "pc", enabled),
  });

  game.settings.register(MODULE_ID, SETTINGS.HUD_FOR_NPCS, {
    name: K("hudForNPCs.name"),
    hint: K("hudForNPCs.hint"),
    scope: "client", config: true, type: Boolean, default: true,
    onChange: enabled => Hooks.callAll("mistHudVisibility", "npc", enabled),
  });

  // When selecting a token opens its HUD. Per user; "auto" = players yes, GM no.
  game.settings.register(MODULE_ID, SETTINGS.OPEN_ON_SELECT, {
    name: K("openOnSelect.name"),
    hint: K("openOnSelect.hint"),
    scope: "client", config: false, type: String,
    choices: {
      auto:   K("openOnSelect.auto"),
      always: K("openOnSelect.always"),
      never:  K("openOnSelect.never"),
    },
    default: "auto",
  });

  // Fold (minimize) a HUD after this many seconds without interaction; 0 = never
  game.settings.register(MODULE_ID, SETTINGS.AUTO_FOLD_DELAY, {
    name: K("autoFoldDelay.name"),
    hint: K("autoFoldDelay.hint"),
    scope: "client", config: false, type: Number,
    range: { min: 0, max: 60, step: 5 },
    default: 15,
    onChange: () => rescheduleAllFolds(),
  });

  // Player HUD two-column ("wide") layout; also toggled from the HUD header
  game.settings.register(MODULE_ID, SETTINGS.WIDE_LAYOUT, {
    name: K("wideLayout.name"),
    hint: K("wideLayout.hint"),
    scope: "client", config: false, type: Boolean, default: false,
    onChange: () => Hooks.callAll("mistHudWideLayout"),
  });

  // The HUD's move buttons: text abbreviations instead of the move art
  game.settings.register(MODULE_ID, SETTINGS.USE_TEXT_BUTTONS, {
    name: K("useTextButtons.name"),
    hint: K("useTextButtons.hint"),
    scope: "client", config: false, type: Boolean, default: false,
    onChange: () => Hooks.callAll("mistHudTextButtons"),
  });

  // ── Sheet Settings (client) ─────────────────────────────────────────────────
  // Their onChange fires hooks that init.js handles (no circular import of the sheet).

  // Card sheet: each sheet card tilted a little (−2°…+2°, the same angle
  // every time), for a tabletop feel (fixes phase 4).
  game.settings.register(MODULE_ID, SETTINGS.CARD_SHEET_TILT, {
    name: K("cardSheetTilt.name"),
    hint: K("cardSheetTilt.hint"),
    scope: "client", config: false, type: Boolean, default: true,
    onChange: () => Hooks.callAll("mistHudCardSheetLook"),
  });

  // Card sheet: the mask on the Hero Shot portrait. The files are
  // ui/card-sheet/portrait-masks/<name>.webp (white = shown, black = hidden).
  game.settings.register(MODULE_ID, SETTINGS.CARD_SHEET_PORTRAIT_MASK, {
    name: K("cardSheetPortraitMask.name"),
    hint: K("cardSheetPortraitMask.hint"),
    scope: "client", config: false, type: String,
    choices: {
      none:       K("cardSheetPortraitMask.none"),
      misty:      K("cardSheetPortraitMask.misty"),
      dissolving: K("cardSheetPortraitMask.dissolving"),
      jagged:     K("cardSheetPortraitMask.jagged"),
    },
    default: "misty",
    onChange: () => Hooks.callAll("mistHudCardSheetLook"),
  });

  // Card sheet: the move bar shows the moves' names (two rows) instead of
  // their art. The sheet's own setting: the HUD keeps useTextButtons.
  game.settings.register(MODULE_ID, SETTINGS.CARD_SHEET_TEXT_BUTTONS, {
    name: K("cardSheetTextButtons.name"),
    hint: K("cardSheetTextButtons.hint"),
    scope: "client", config: false, type: Boolean, default: false,
    onChange: () => Hooks.callAll("mistHudCardSheetMoves"),
  });

  // Card sheet experiments (user, 2026-11-19): a dotted leader from each
  // tag's name to its flame, and a tint of its own on each tag line.
  game.settings.register(MODULE_ID, SETTINGS.CARD_SHEET_TAG_LEADERS, {
    name: K("cardSheetTagLeaders.name"),
    hint: K("cardSheetTagLeaders.hint"),
    scope: "client", config: false, type: Boolean, default: true,
    onChange: () => Hooks.callAll("mistHudCardSheetLook"),
  });

  game.settings.register(MODULE_ID, SETTINGS.CARD_SHEET_TAG_TINTS, {
    name: K("cardSheetTagTints.name"),
    hint: K("cardSheetTagTints.hint"),
    scope: "client", config: false, type: Boolean, default: true,
    onChange: () => Hooks.callAll("mistHudCardSheetLook"),
  });

  // Card sheet: the roll modifier total shown by the move buttons (tags-deck)
  game.settings.register(MODULE_ID, SETTINGS.CARD_SHEET_MOD_TOTAL, {
    name: K("cardSheetModifierTotal.name"),
    hint: K("cardSheetModifierTotal.hint"),
    scope: "client", config: false, type: String,
    choices: {
      cards: K("cardSheetModifierTotal.cards"),
      split: K("cardSheetModifierTotal.split"),
      all:   K("cardSheetModifierTotal.all"),
    },
    default: "cards",
    onChange: () => Hooks.callAll("mistHudCardSheetTotals"),
  });

  // ── World (GM, core list) ───────────────────────────────────────────────────

  // Restyle system sheets/chat through the system's "External Style" visual style
  game.settings.register(MODULE_ID, SETTINGS.EXTERNAL_SHEET_STYLE, {
    name: K("externalSheetStyle.name"),
    hint: K("externalSheetStyle.hint"),
    scope: "world", config: true, type: Boolean, default: false,
    onChange: async enabled => {
      applyExternalCSS(getActiveSystem());
      if (!isActiveGM()) return;
      if (enabled) await enforceExternalStyle();
      // Turned off: drop back to the system's own style, unless the GM already
      // picked another style by hand.
      else if (getVisualStyle() === "custom") await setVisualStyle("base");
    },
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_STATUS_NOTIFICATIONS, {
    name: K("statusNotifications.name"),
    hint: K("statusNotifications.hint"),
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_TAG_NOTIFICATIONS, {
    name: K("tagNotifications.name"),
    hint: K("tagNotifications.hint"),
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_STATUS_TABS, {
    name: K("statusTabs.name"),
    hint: K("statusTabs.hint"),
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => ui.notifications.info(game.i18n.localize("MistHUD.notify.statusTabsChanged")),
  });

  game.settings.register(MODULE_ID, SETTINGS.NPC_ACCORDION_STATE, {
    name: K("npcAccordionState.name"),
    hint: K("npcAccordionState.hint"),
    scope: "world", config: true, type: String,
    choices: {
      allExpanded: K("npcAccordionState.allExpanded"),
      allClosed:   K("npcAccordionState.allClosed"),
    },
    default: "allClosed",
    onChange: async () => {
      ui.notifications.info(game.i18n.localize("MistHUD.notify.accordionRefresh"));
      const refresh = await foundry.applications.api.DialogV2.confirm({
        window:  { title: game.i18n.localize("MistHUD.dialog.refreshTitle") },
        content: `<p>${game.i18n.localize("MistHUD.dialog.refreshContent")}</p>`,
        rejectClose: false,
      });
      if (refresh) window.location.reload();
    },
  });

  game.settings.register(MODULE_ID, SETTINGS.DEBUG_MODE, {
    name: K("debugMode.name"),
    hint: K("debugMode.hint"),
    scope: "world", config: true, type: Boolean, default: false,
  });

  // ── Dice (client, core list) ────────────────────────────────────────────────

  // Dice So Nice: pick the dice set for the active system automatically
  game.settings.register(MODULE_ID, SETTINGS.AUTO_DICE_SET, {
    name: K("autoDiceSet.name"),
    hint: K("autoDiceSet.hint"),
    scope: "client", config: true, type: Boolean, default: true,
  });

  // ── No UI (state) ───────────────────────────────────────────────────────────

  game.settings.register(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE, {
    name: K("rollIsDynamite.name"),
    hint: K("rollIsDynamite.hint"),
    scope: "client", config: false, type: Boolean, default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.LAST_SELECTED_TAB, {
    name: K("lastSelectedTab.name"),
    scope: "client", config: false, type: String, default: "",
  });

  // Not read anywhere (the HUD only floats); kept so stored values stay valid.
  game.settings.register(MODULE_ID, SETTINGS.LAYOUT_MODE, {
    name: K("layoutMode.name"),
    scope: "client", config: false, type: String,
    choices: { floating: K("layoutMode.floating"), docked: K("layoutMode.docked") },
    default: "floating",
  });

  game.settings.register(MODULE_ID, SETTINGS.DOCK_SIDE, {
    name: K("dockSide.name"),
    scope: "client", config: false, type: String,
    choices: { left: K("dockSide.left"), right: K("dockSide.right") },
    default: "left",
  });

  // Where each character's HUD was left ({ [hudKey]: { left, top } })
  game.settings.register(MODULE_ID, SETTINGS.HUD_POSITIONS, {
    name: K("hudPositions.name"),
    scope: "client", config: false, type: Object, default: {},
  });

  // Card sheet UI state per actor ({ [actorUuid]: { flipped: { [cardId]: true } } })
  game.settings.register(MODULE_ID, SETTINGS.CARD_SHEET_STATE, {
    name: K("cardSheetState.name"),
    scope: "client", config: false, type: Object, default: {},
  });

  // Status collection storage
  game.settings.register(MODULE_ID, SETTINGS.IMPORTED_STATUS_COLLECTION, {
    name: K("importedStatusCollection.name"),
    scope: "world", config: false, type: Array, default: [],
  });
});

Hooks.once("ready", async () => {
  await detectActiveSystem();
  // Fallback: a Game System change reloads the world and may have left the
  // system on its own visual style.
  await enforceExternalStyle();
});

// Changing Game System runs the system's onChangeTo(), which writes
// baseSystem/system and then sets visualStyle to that system's own style.
// A visualStyle change right after a system change is that reset (undo it).
// Otherwise our setting follows the GM's own Visual Style choice both ways:
// External Style turns it on (supported systems only), any other style off.
let lastSystemChange = 0;
const SYSTEM_CHANGE_WINDOW_MS = 5000;

Hooks.on("updateSetting", async setting => {
  if (setting.key !== VISUAL_STYLE_KEY || !isActiveGM()) return;
  const isCustom = getVisualStyle() === "custom";
  const enabled  = externalStyleEnabled();

  if (isCustom) {
    if (!enabled && hasExternalStyle(getActiveSystem())) {
      await game.settings.set(MODULE_ID, SETTINGS.EXTERNAL_SHEET_STYLE, true);
    }
    return;
  }
  if (!enabled) return;
  if (Date.now() - lastSystemChange < SYSTEM_CHANGE_WINDOW_MS) {
    await enforceExternalStyle();
  } else {
    await game.settings.set(MODULE_ID, SETTINGS.EXTERNAL_SHEET_STYLE, false);
  }
});

// Re-apply CSS and re-render HUDs when the system setting changes at runtime.
Hooks.on("updateSetting", async setting => {
  if (!["city-of-mist.system", "city-of-mist.baseSystem"].includes(setting.key)) return;
  lastSystemChange = Date.now();
  await detectActiveSystem();
  for (const app of foundry.applications.instances.values()) {
    if (app.constructor?.name === "PlayerHUD" && app.rendered) app.render({ force: true });
  }
});
