// settings.js — Module settings registration and system CSS injection
// (accordion logic is now inlined where needed; useHotbarForRolls removed)

import { MODULE_ID, SETTINGS, getActiveSystem } from "./constants.js";

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
  return system ?? null;
}

// ── Settings registration ─────────────────────────────────────────────────────

Hooks.once("init", () => {
  const K = key => `MistHUD.settings.${key}`;

  game.settings.register(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE, {
    name: K("rollIsDynamite.name"),
    hint: K("rollIsDynamite.hint"),
    scope: "client", config: false, type: Boolean, default: false,
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

  game.settings.register(MODULE_ID, SETTINGS.LAST_SELECTED_TAB, {
    name: K("lastSelectedTab.name"),
    scope: "client", config: false, type: String, default: "",
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

  game.settings.register(MODULE_ID, SETTINGS.USE_TEXT_BUTTONS, {
    name: K("useTextButtons.name"),
    hint: K("useTextButtons.hint"),
    scope: "client", config: true, type: Boolean, default: false,
    onChange: () => ui.notifications.info(game.i18n.localize("MistHUD.notify.buttonsChanged")),
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_STATUS_TABS, {
    name: K("statusTabs.name"),
    hint: K("statusTabs.hint"),
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => ui.notifications.info(game.i18n.localize("MistHUD.notify.statusTabsChanged")),
  });

  game.settings.register(MODULE_ID, SETTINGS.DEBUG_MODE, {
    name: K("debugMode.name"),
    hint: K("debugMode.hint"),
    scope: "world", config: true, type: Boolean, default: false,
  });

  // Dice So Nice: pick the dice set for the active system automatically
  game.settings.register(MODULE_ID, SETTINGS.AUTO_DICE_SET, {
    name: K("autoDiceSet.name"),
    hint: K("autoDiceSet.hint"),
    scope: "client", config: true, type: Boolean, default: true,
  });

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

  // Layout settings (client-side, no config UI — set programmatically)
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

  // Player HUD two-column ("wide") layout, toggled from the HUD header
  game.settings.register(MODULE_ID, SETTINGS.WIDE_LAYOUT, {
    name: K("wideLayout.name"),
    scope: "client", config: false, type: Boolean, default: false,
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
