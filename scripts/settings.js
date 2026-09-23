// settings.js — Module settings registration and system CSS injection
// (accordion logic is now inlined where needed; useHotbarForRolls removed)

import { MODULE_ID, SETTINGS } from "./constants.js";

export { MODULE_ID };

// ── System CSS injection ──────────────────────────────────────────────────────

const SYSTEM_CSS_MAP = {
  "city-of-mist": "/modules/mist-hud/styles/mh-city-of-mist.css",
  "otherscape":   "/modules/mist-hud/styles/mh-otherscape.css",
  "legend":       "/modules/mist-hud/styles/mh-legends-in-the-mist.css",
};

function applySystemCSS(system) {
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
  const system = game.settings.get("city-of-mist", "system");
  applySystemCSS(system ?? null);
  return system ?? null;
}

// ── Settings registration ─────────────────────────────────────────────────────

Hooks.once("init", () => {

  game.settings.register(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE, {
    name: "Roll Is Dynamite",
    hint: "Toggles whether the next roll is guaranteed to be Dynamite.",
    scope: "client", config: false, type: Boolean, default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.NPC_ACCORDION_STATE, {
    name: "NPC Accordions Initial State",
    hint: "Set the initial state for NPC accordions.",
    scope: "world", config: true, type: String,
    choices: { allExpanded: "All expanded", allClosed: "All closed" },
    default: "allClosed",
    onChange: () => {
      ui.notifications.info("Changing accordion state requires a page refresh.");
      new Dialog({
        title: "Refresh Required",
        content: "<p>Refresh now to apply changes?</p>",
        buttons: {
          yes: { icon: '<i class="fas fa-check"></i>', label: "Yes",
                 callback: () => foundry.utils.debounce(() => window.location.reload(), 100)() },
          no:  { icon: '<i class="fas fa-times"></i>', label: "No" },
        },
        default: "no",
      }).render(true);
    },
  });

  game.settings.register(MODULE_ID, SETTINGS.LAST_SELECTED_TAB, {
    name: "Last Selected Tab",
    scope: "client", config: false, type: String, default: "",
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_STATUS_NOTIFICATIONS, {
    name: "Status Drop Notifications",
    hint: "Animated notification above tokens when statuses are dropped on them.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_TAG_NOTIFICATIONS, {
    name: "Tags Drop Notifications",
    hint: "Visual notifications when story tags are assigned to tokens via drag-and-drop.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.USE_TEXT_BUTTONS, {
    name: "Use Text for Roll Buttons",
    hint: "If enabled, roll buttons use text abbreviations instead of images.",
    scope: "client", config: true, type: Boolean, default: false,
    onChange: () => ui.notifications.info("Button display changed. Refresh to apply."),
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_STATUS_TABS, {
    name: "Tabs for Status List",
    hint: "Organize statuses into tabs by category.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => ui.notifications.info("Status screen tabs changed. Reopen the screen to apply."),
  });

  game.settings.register(MODULE_ID, SETTINGS.DEBUG_MODE, {
    name: "Debug Mode",
    hint: "Enable or disable debug logging.",
    scope: "world", config: true, type: Boolean, default: false,
  });

  // Layout settings (client-side, no config UI — set programmatically)
  game.settings.register(MODULE_ID, SETTINGS.LAYOUT_MODE, {
    name: "HUD Layout Mode",
    scope: "client", config: false, type: String,
    choices: { floating: "Floating", docked: "Docked" },
    default: "floating",
  });

  game.settings.register(MODULE_ID, SETTINGS.DOCK_SIDE, {
    name: "Dock Side",
    scope: "client", config: false, type: String,
    choices: { left: "Left", right: "Right" },
    default: "left",
  });

  // Status collection storage
  game.settings.register(MODULE_ID, SETTINGS.IMPORTED_STATUS_COLLECTION, {
    name: "Imported Status Collection",
    scope: "world", config: false, type: Array, default: [],
  });
});

Hooks.once("ready", async () => {
  await detectActiveSystem();
});
