// init.js — Centralised hook registrations for mist-hud
//
// All Hooks.on / Hooks.once calls live here.
// Other files export classes/functions; this file wires them to Foundry events.

import { MODULE_ID, SOCKET_NAME } from "./constants.js";
import { playerHudRegistry, getOrCreateHud } from "./player-hud.js";
import { BonusManager }              from "./bonus-manager.js";
import { StatusScreen }              from "./status-screen.js";
import { openNPCInfluenceManager }   from "./npc-influence.js";
import { TokenStatusNotification, TokenTagNotification } from "./notifications.js";

// ── Initial load guard ────────────────────────────────────────────────────────
// Prevents HUDs from opening during the brief "game loading" window.
let _gameJustLoaded = true;

// ── ready ─────────────────────────────────────────────────────────────────────
Hooks.once("ready", () => {
  BonusManager.init();
  TokenStatusNotification.preloadFonts();

  // Expose global helpers for macros / scene-control buttons
  globalThis.openStatusScreen         = () => StatusScreen.open();
  globalThis.openNPCInfluenceManager  = openNPCInfluenceManager;

  // Clear the load guard after a short delay
  setTimeout(() => { _gameJustLoaded = false; }, 2000);

  // Register socket listener for NPC influence data
  game.socket.on(SOCKET_NAME, data => {
    if (data?.type === "npcInfluence") {
      globalThis.activeNpcInfluences ??= {};
      globalThis.activeNpcInfluences[data.data.npcId] = data.data;
    }
  });

  // Pre-initialise NPC influence cache
  globalThis.activeNpcInfluences ??= {};
});

// ── Token control ─────────────────────────────────────────────────────────────
Hooks.on("controlToken", (token, controlled) => {
  if (_gameJustLoaded) return;

  if (controlled && token.actor?.type === "character" && token.isOwner) {
    // Only open a HUD when exactly one character token is selected
    if (canvas.tokens.controlled.length === 1) {
      // Close any HUDs that belong to a different actor
      for (const [actorId, hud] of playerHudRegistry.entries()) {
        if (actorId !== token.actor.id) hud.close();
      }
      const hud = getOrCreateHud(token.actor);
      if (hud && !hud.rendered) hud.render(true);
    }
  } else if (!controlled) {
    // Close the HUD only when no tokens remain selected
    if (canvas.tokens.controlled.length === 0) {
      const hud = playerHudRegistry.get(token.actor?.id);
      if (hud) hud.close();
    }
  }
});

// ── CityDB readiness — re-render HUDs once moves are loaded ──────────────────
// CityDB.movesList may not be populated when the HUD first renders.
// These hooks fire after the system finishes loading its compendium packs.
function _rerenderAllHUDs() {
  for (const hud of playerHudRegistry.values()) {
    if (hud.rendered) hud.render({ force: true });
  }
}
Hooks.once("cityDBLoaded", _rerenderAllHUDs);
Hooks.once("movesLoaded",  _rerenderAllHUDs);

// ── Actor / Item reactivity ───────────────────────────────────────────────────
function _rerenderForActor(actor) {
  const hud = playerHudRegistry.get(actor?.id);
  if (hud) hud.render({ force: true });
}

Hooks.on("updateActor", (actor) => _rerenderForActor(actor));

Hooks.on("createItem", (item) => {
  if (item.isEmbedded) _rerenderForActor(item.parent);
});

Hooks.on("updateItem", (item) => {
  if (item.isEmbedded) _rerenderForActor(item.parent);
});

Hooks.on("deleteItem", (item) => {
  if (item.isEmbedded) _rerenderForActor(item.parent);
});

// ── Scene control buttons ─────────────────────────────────────────────────────
Hooks.on("getSceneControlButtons", controls => {
  const tokenControls = controls["tokens"];
  if (!tokenControls) return;

  tokenControls.tools["statusScreen"] = {
    name:    "statusScreen",
    title:   "Statuses MC Screen",
    icon:    "fas fa-list",
    button:  true,
    visible: true,
    onClick: () => StatusScreen.open(),
  };

  if (game.user.isGM) {
    tokenControls.tools["npcInfluenceManager"] = {
      name:    "npcInfluenceManager",
      title:   "NPC Influence Viewer",
      icon:    "fas fa-skull",
      button:  true,
      visible: true,
      onClick: () => openNPCInfluenceManager(),
    };
  }
});

// ── Drag-and-drop: status / story-tag onto tokens ─────────────────────────────
Hooks.on("dropCanvasData", async (_canvas, dropData) => {
  const { x, y } = dropData;
  const token = canvas.tokens.placeables.find(t => t.bounds?.contains(x, y));
  if (!token?.actor) return;
  const actor = token.actor;

  if (dropData.type === "status") {
    const { name = "Unnamed Status", tier = 1, temporary = false, permanent = false } = dropData;
    try {
      const [newStatus] = await actor.createEmbeddedDocuments("Item", [{
        name, type: "status",
        img: "icons/svg/item-bag.svg",
        system: {
          pips: 0, tier, description: "", locked: false,
          version: "1", free_content: false, hidden: false,
          temporary, permanent, sceneId: null, showcased: false, specialType: "",
        },
      }]);
      TokenStatusNotification.show(token, newStatus.name, newStatus.system.tier);
    } catch (e) {
      console.error("Mist HUD | Error creating dropped status:", e);
    }

  } else if (dropData.type === "story-tag") {
    const { name = "Unnamed Tag", isInverted = false, temporary = false, permanent = false, cssClass = "" } = dropData;
    try {
      const [newTag] = await actor.createEmbeddedDocuments("Item", [{
        name, type: "tag",
        img: "icons/svg/item-bag.svg",
        system: {
          description: "", subtype: "story",
          isInverted, inverted: isInverted,
          temporary, permanent,
          locked: false, version: "1", free_content: false,
          hidden: false, burn_state: 0, burned: false, specialType: "",
        },
      }]);
      if (cssClass === "positive" || cssClass === "negative") {
        await newTag.setFlag(MODULE_ID, "tagState", cssClass);
      }
      TokenTagNotification.show(token, name, isInverted, cssClass);
    } catch (e) {
      console.error("Mist HUD | Error creating dropped story tag:", e);
    }
  }
});
