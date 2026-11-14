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

export async function detectActiveSystem() {
  const system = getActiveSystem();
  applySystemCSS(system ?? null);
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

  // Status collection storage
  game.settings.register(MODULE_ID, SETTINGS.IMPORTED_STATUS_COLLECTION, {
    name: K("importedStatusCollection.name"),
    scope: "world", config: false, type: Array, default: [],
  });
});

Hooks.once("ready", async () => {
  await detectActiveSystem();
});

// Re-apply CSS and re-render HUDs when the system setting changes at runtime.
Hooks.on("updateSetting", async setting => {
  if (!["city-of-mist.system", "city-of-mist.baseSystem"].includes(setting.key)) return;
  await detectActiveSystem();
  for (const app of foundry.applications.instances.values()) {
    if (app.constructor?.name === "PlayerHUD" && app.rendered) app.render({ force: true });
  }
});
