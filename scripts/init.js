// init.js — Centralised hook registrations for mist-hud
//
// All Hooks.on / Hooks.once calls live here.
// Other files export classes/functions; this file wires them to Foundry events.

import { MODULE_ID, SOCKET_NAME } from "./constants.js";
import { playerHudRegistry, getOrCreateHud } from "./player-hud.js";
import { hudKey } from "./hud-state.js";
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
    } else if (data?.type === "dropAction" && _dropHandlers[data.action]) {
      _dropHandlers[data.action](data);
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
      const key = hudKey(token.actor);
      // Close any HUDs that belong to a different actor / unlinked token. All HUDs
      // share the DOM id "mist-hud", so wait for them to be gone before opening
      // the new one (otherwise the old close can tear down the new window).
      const closing = [];
      for (const [k, other] of playerHudRegistry.entries()) {
        if (k !== key) closing.push(other.close());
      }
      Promise.all(closing).then(() => {
        if (!token.controlled || canvas.tokens.controlled.length !== 1) return;
        const hud = getOrCreateHud(token.actor);
        if (hud && !hud.rendered) hud.render(true);
      });
    }
  } else if (!controlled) {
    // Close the HUD only when no tokens remain selected
    if (canvas.tokens.controlled.length === 0) {
      const hud = playerHudRegistry.get(hudKey(token.actor));
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

// ── System selection (scene tags window, sheets) feeds the power preview ─────
function _refreshPowerPreviews() {
  for (const hud of playerHudRegistry.values()) {
    if (hud.rendered) hud._updatePowerDisplay();
  }
}
Hooks.on("TagOrStatusSelected",     _refreshPowerPreviews);
Hooks.on("TagOrStatusSelectChange", _refreshPowerPreviews);

// ── Actor / Item reactivity ───────────────────────────────────────────────────
function _rerenderForActor(actor) {
  if (!actor) return;
  const direct = playerHudRegistry.get(hudKey(actor));
  if (direct) direct.render({ force: true });
  // A world actor's data (received bonuses…) also feeds the HUDs of its unlinked tokens
  if (!actor.isToken) {
    for (const hud of playerHudRegistry.values()) {
      if (hud !== direct && hud.actor?.id === actor.id) hud.render({ force: true });
    }
  }
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
    title:   "MistHUD.window.statusScreen",
    icon:    "fas fa-list",
    button:  true,
    visible: true,
    onChange: () => StatusScreen.open(),
  };

  if (game.user.isGM) {
    tokenControls.tools["npcInfluenceManager"] = {
      name:    "npcInfluenceManager",
      title:   "MistHUD.window.influenceViewer",
      icon:    "fas fa-skull",
      button:  true,
      visible: true,
      onChange: () => openNPCInfluenceManager(),
    };
  }
});

// ── Drag-and-drop: status / story-tag onto tokens ─────────────────────────────
// Players may drop a status or story tag on a token they do not own. Creating
// the item needs permission on that actor, so those drops are relayed to a GM
// over the module socket (same idea as the help/hurt "bonusAction" handlers).

const _clampText = (v, fallback) => String(v ?? fallback).slice(0, 200) || fallback;

function _statusItemData(drop) {
  const tier = Math.min(Math.max(Math.trunc(Number(drop.tier)) || 1, 1), 10);
  return {
    name: _clampText(drop.name, "Unnamed Status"), type: "status",
    img: "icons/svg/item-bag.svg",
    system: {
      pips: 0, tier, description: "", locked: false,
      version: "1", free_content: false, hidden: false,
      temporary: !!drop.temporary, permanent: !!drop.permanent,
      sceneId: null, showcased: false, specialType: "",
    },
  };
}

function _storyTagItemData(drop) {
  const isInverted = !!drop.isInverted;
  return {
    name: _clampText(drop.name, "Unnamed Tag"), type: "tag",
    img: "icons/svg/item-bag.svg",
    system: {
      description: "", subtype: "story",
      isInverted, inverted: isInverted,
      temporary: !!drop.temporary, permanent: !!drop.permanent,
      locked: false, version: "1", free_content: false,
      hidden: false, burn_state: 0, burned: false, specialType: "",
    },
  };
}

/** Create the dropped item on `actor`. Runs on the dropper (owner) or on a GM (relay). */
async function _createDroppedItem(actor, kind, drop) {
  if (kind === "status") {
    const [item] = await actor.createEmbeddedDocuments("Item", [_statusItemData(drop)]);
    return item;
  }
  const [item] = await actor.createEmbeddedDocuments("Item", [_storyTagItemData(drop)]);
  if (drop.cssClass === "positive" || drop.cssClass === "negative") {
    await item.setFlag(MODULE_ID, "tagState", drop.cssClass);
  }
  return item;
}

const _dropHandlers = {
  createDroppedItem: async data => {
    // Only the active GM handles it, so exactly one client creates the item
    if (!game.user.isGM || game.user.id !== game.users.activeGM?.id) return;
    try {
      if (!["status", "story-tag"].includes(data.kind)) return;
      const tokenDoc = await fromUuid(String(data.tokenUuid));
      const actor = tokenDoc?.actor;
      if (!actor) return;
      await _createDroppedItem(actor, data.kind, data.drop ?? {});
    } catch (e) {
      console.error("Mist HUD | Error creating relayed drop:", e);
    }
  },
};

Hooks.on("dropCanvasData", async (_canvas, dropData) => {
  if (!["status", "story-tag"].includes(dropData.type)) return;
  const { x, y } = dropData;
  const token = canvas.tokens.placeables.find(t => t.bounds?.contains(x, y));
  if (!token?.actor) return;
  const actor = token.actor;
  const kind  = dropData.type;

  try {
    if (actor.isOwner) {
      await _createDroppedItem(actor, kind, dropData);
    } else if (game.users.activeGM) {
      game.socket.emit(SOCKET_NAME, {
        type: "dropAction", action: "createDroppedItem",
        kind, tokenUuid: token.document.uuid,
        drop: {
          name: dropData.name, tier: dropData.tier, isInverted: dropData.isInverted,
          temporary: dropData.temporary, permanent: dropData.permanent, cssClass: dropData.cssClass,
        },
      });
    } else {
      ui.notifications.warn(game.i18n.localize("MistHUD.notify.noGMForDrop"));
      return;
    }
  } catch (e) {
    console.error(`Mist HUD | Error creating dropped ${kind}:`, e);
    return;
  }

  // The scrolling notification is local to the dropper, so show it here in both cases
  if (kind === "status") {
    TokenStatusNotification.show(token, _clampText(dropData.name, "Unnamed Status"),
      Math.min(Math.max(Math.trunc(Number(dropData.tier)) || 1, 1), 10));
  } else {
    TokenTagNotification.show(token, _clampText(dropData.name, "Unnamed Tag"),
      !!dropData.isInverted, dropData.cssClass ?? "");
  }
});
