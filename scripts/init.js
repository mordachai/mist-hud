// init.js — Centralised hook registrations for mist-hud
//
// All Hooks.on / Hooks.once calls live here.
// Other files export classes/functions; this file wires them to Foundry events.

import { MODULE_ID, SETTINGS, SOCKET_NAME, getActiveSystem } from "./constants.js";
import { playerHudRegistry, openHud, toggleHud, sys, systemReady } from "./player-hud.js";
import { NpcHUD } from "./npc-hud.js";
import { hudKey } from "./hud-state.js";
import { BonusManager }              from "./bonus-manager.js";
import { StatusScreen }              from "./status-screen.js";
import { openNPCInfluenceManager }   from "./npc-influence.js";
import { TokenStatusNotification, TokenTagNotification } from "./notifications.js";
import { MistCardSheet, CARD_SHEET_TEMPLATES, refreshCardSheets, refreshCardSheetsOnDBLoad, refreshCardSheetsForOwner } from "./card-sheet/card-sheet.js";

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

  // Clear the load guard after a short delay, then show the player's own
  // character HUD (it follows the player; see "openOnSelect").
  setTimeout(() => {
    _gameJustLoaded = false;
    const own = game.user.character;
    if (!game.user.isGM && own?.type === "character" && own.isOwner && _openOnSelect()) openHud(own);
  }, 2000);

  // Drops relayed to the GM (see "Drag-and-drop" below)
  game.socket.on(SOCKET_NAME, data => {
    if (data?.type === "dropAction" && _dropHandlers[data.action]) {
      _dropHandlers[data.action](data);
    }
  });
});

// ── Opening the HUDs ──────────────────────────────────────────────────────────
// HUDs stay open until closed by hand (several at once, each where it was left).
// They open from: selecting a token (per-user setting), the token's right-click
// menu, the sheet header, or the keyboard shortcut.

/** "openOnSelect": auto = players yes, GM no. */
function _openOnSelect() {
  const mode = game.settings.get(MODULE_ID, SETTINGS.OPEN_ON_SELECT);
  if (mode === "always") return true;
  if (mode === "never")  return false;
  return !game.user.isGM;
}

/** Which HUD this user may open for an actor: "pc", "npc" or null. */
function _hudKind(actor) {
  if (actor?.type === "character" && actor.isOwner) return "pc";
  if (actor?.type === "threat" && game.user.isGM) return "npc";
  return null;
}

/** Open the HUD of a token, or of an actor that has no token on the scene. */
function _openHudFor(actor, token = null) {
  const kind = _hudKind(actor);
  if (kind === "pc")  return openHud(actor);
  if (kind === "npc") return NpcHUD.openForToken(token, actor);
  return null;
}

Hooks.on("controlToken", (token, controlled) => {
  if (_gameJustLoaded || !controlled) return;
  // Only when exactly one token is selected (not while box-selecting a group)
  if (canvas.tokens.controlled.length !== 1 || !_openOnSelect()) return;
  _openHudFor(token.actor, token);
});

// Token right-click menu: "Mist HUD" button
Hooks.on("renderTokenHUD", (app, html) => {
  const token = app.object;
  if (!_hudKind(token?.actor)) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const col  = root?.querySelector(".col.left");
  if (!col || col.querySelector(".mh-open-hud")) return;

  const label = game.i18n.localize("MistHUD.hud.openHud");
  const btn = document.createElement("button");
  btn.type      = "button";
  btn.className = "control-icon mh-open-hud";
  btn.dataset.tooltip = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = '<i class="fa-solid fa-square-user" inert></i>';
  btn.addEventListener("click", ev => {
    ev.preventDefault();
    ev.stopPropagation();
    _openHudFor(token.actor, token);
    app.close();
  });
  col.append(btn);
});

// Sheet header: "HUD" button, closes the sheet and shows the HUD (the HUD's
// header has the matching "open sheet" button). City of Mist sheets are AppV1.
Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
  const actor = app.actor;
  if (!_hudKind(actor)) return;
  buttons.unshift({
    label:   "MistHUD.hud.openHudShort",
    tooltip: game.i18n.localize("MistHUD.hud.openHud"),
    class:   "mh-open-hud",
    icon:    "fa-solid fa-square-user",
    onclick: async () => {
      const token = app.token?.object ?? actor.getActiveTokens()[0] ?? null;
      await app.close();
      _openHudFor(actor, token);
    },
  });
});

// Core adds "Sheet" / "Token" after the hook above runs, so the HUD button
// would sit right of them: move it to the left of "Sheet".
Hooks.on("renderActorSheet", (app) => {
  const header = app.element?.[0]?.querySelector(".window-header");
  const hud    = header?.querySelector(".header-button.mh-open-hud");
  const sheet  = header?.querySelector(".header-button.configure-sheet");
  if (hud && sheet && hud.nextElementSibling !== sheet) sheet.before(hud);
});

// Keyboard shortcut: the selected token's HUD, else the player's own character.
// Folds the HUD when it is already showing.
Hooks.once("init", () => {
  game.keybindings.register(MODULE_ID, "toggleHud", {
    name:     "MistHUD.keybindings.toggleHud.name",
    hint:     "MistHUD.keybindings.toggleHud.hint",
    editable: [{ key: "KeyH" }],
    onDown: () => {
      const token = canvas.tokens?.controlled?.[0];
      const actor = token?.actor ?? game.user.character;
      const kind  = _hudKind(actor);
      if (kind === "pc") toggleHud(actor);
      else if (kind === "npc") NpcHUD.toggleForToken(token ?? null, actor);
      else return false;
      return true;
    },
  });
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

// ── Card sheet (docs/card-sheet-plan.md) ─────────────────────────────────────
// An alternative character sheet, picked per actor in the Sheet selector; the
// system sheet stays the default.
Hooks.once("init", () => {
  foundry.documents.collections.Actors.registerSheet(MODULE_ID, MistCardSheet, {
    types:       ["character"],
    makeDefault: false,
    label:       "MistHUD.cardSheet.label",
  });
  foundry.applications.handlebars.loadTemplates(CARD_SHEET_TEMPLATES);
});
// It shows the system's selection, so it follows it.
Hooks.on("TagOrStatusSelected",     refreshCardSheets);
Hooks.on("TagOrStatusSelectChange", refreshCardSheets);
// The system loads its themebooks and moves after "ready"; a sheet open by
// then has neither yet.
Hooks.on("cityDBLoaded", refreshCardSheetsOnDBLoad);
// Layer 2 shows every crew and extra theme; the system only refreshes a
// character's sheet for the active ones.
Hooks.on("updateActor", actor => refreshCardSheetsForOwner(actor));
for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, item => refreshCardSheetsForOwner(item.parent));
}

// The system flips an already selected item (invert-click on a selected tag)
// without firing any hook. Announce it, so the NPC HUD, the influence viewer
// and the power preview follow every selection change.
Hooks.once("init", () => {
  const sts = globalThis.SelectedTagsAndStatus;
  if (!sts?.toggleSelectedItem || sts._mhToggleWrapped) return;
  const original = sts.toggleSelectedItem;
  sts.toggleSelectedItem = function (tagOrStatus, direction = 1) {
    const wasSelected = this.getActivatedDirection(tagOrStatus?.id, tagOrStatus?.parent?.tokenId ?? "") !== 0;
    const result = original.call(this, tagOrStatus, direction);
    if (wasSelected && result) Hooks.callAll("TagOrStatusSelectChange");
    return result;
  };
  sts._mhToggleWrapped = true;
});

// ── External Style: Scene Tags window fits its content ───────────────────────
// The system opens it at a fixed 400×500. Under our External Style it opens
// 300px wide and its height follows what it holds (V1 "auto" height refits on
// every re-render, up to the screen height; past that the list scrolls).
Hooks.on("renderStoryTagWindow", (app) => {
  if (app._mhFitted || !document.querySelector("link[data-mh-external]")) return;
  app._mhFitted = true;
  app.options.width  = 300;
  app.options.height = "auto";
  app.setPosition({ width: 300, height: "auto" });
});

// ── Roll cards: tag the message with its outcome ─────────────────────────────
// city-roll.hbs has no result class, so the card gets one here:
// mh-roll-failure | mh-roll-partial | mh-roll-success | mh-roll-dynamite
// (dynamite also gets mh-roll-success). The system's own getRollStatus decides,
// so caps, grit mode and auto fail/success match the move text. Re-runs when
// the message updates (edit roll, strike out a modifier).
const ROLL_OUTCOME_CLASSES = ["mh-roll-failure", "mh-roll-partial", "mh-roll-success", "mh-roll-dynamite"];

// Each modifier row gets its kind and sign, which the template doesn't
// print as classes, so the External Style CSS can colour it:
// mh-mod-tag | mh-mod-status | mh-mod-other, plus mh-mod-negative when it
// counts against the roll.
const MODIFIER_CLASS = /^mh-mod-/;

function markModifiers(roll, html) {
  const mods = roll.options?.modifiers ?? [];
  for (const li of html.querySelectorAll(".city-roll .roll-modifiers li[data-modifier-id]")) {
    const mod = mods.find(m => String(m.id) === li.dataset.modifierId);
    li.classList.remove(...[...li.classList].filter(c => MODIFIER_CLASS.test(c)));
    if (!mod) continue;
    const kind = ["tag", "status"].includes(mod.type) ? mod.type : "other";
    li.classList.add(`mh-mod-${kind}`);
    if (Number(mod.amount) < 0) li.classList.add("mh-mod-negative");
  }
}

Hooks.on("renderChatMessageHTML", async (message, html) => {
  const roll = message.rolls?.[0];
  if (!roll?.options?.moveId || roll.options.noRoll) return;
  if (!html.querySelector?.(".city-roll")) return;
  // Moves with no outcome text (Quick Outcome…) still render a blank
  // .move-text; CSS can't match whitespace-only, so mark it for hiding
  const moveText = html.querySelector(".city-roll .move-text");
  moveText?.classList.toggle("mh-empty", !moveText.textContent.trim() && !moveText.children.length);
  markModifiers(roll, html);
  await systemReady;
  const CityRoll = sys.CityRoll;
  if (!CityRoll) return;
  let status;
  try {
    const { total } = CityRoll.getTotal(roll);
    status = CityRoll.getRollStatus(roll, total, roll.options);
  } catch (e) {
    console.warn("Mist HUD | Could not read roll outcome:", e);
    return;
  }
  const outcome = String(status).toLowerCase();
  html.classList.remove(...ROLL_OUTCOME_CLASSES);
  if (outcome === "dynamite") html.classList.add("mh-roll-dynamite", "mh-roll-success");
  else if (ROLL_OUTCOME_CLASSES.includes(`mh-roll-${outcome}`)) html.classList.add(`mh-roll-${outcome}`);
});

// Threat sheets open at the system's fixed 1070px (clamped to the screen),
// even when the moves take half of it. On the first render, fit the window
// to its content instead (still clamped to the screen; later re-renders and
// the user's own resizing keep their size).
Hooks.on("renderCityThreatSheet", (app) => {
  if (app._mhFitted) return;
  app._mhFitted = true;
  requestAnimationFrame(() => {
    if (app.rendered && !app._minimized) app.setPosition({ height: "auto" });
  });
});

// City of Mist External Style: the PC sheet's Juice and Clues tabs draw each
// juice and clue as the core book's Tracking Card, turned landscape (Help /
// Hurt stay plain notes). The templates print the amount inside the name
// ("(2) name"), so mark the card with its kind and amount, take the "(N)" out
// of the name, add the card's band (its kind icon) and numbered strip, and run
// name, source and method together as one line: "Name // Source - Method".
// Only while our CoM External Style sheet is loaded.
const TRACK_KINDS = {
  clue:  ["fa-magnifying-glass", "CityOfMist.terms.clue"],
  juice: ["fa-bolt",             "CityOfMist.terms.juice"],
};
const TRACK_CELLS = 6;

function decorateTrackingCards(app, root) {
  if (getActiveSystem() !== "city-of-mist") return;
  if (!document.querySelector("link[data-mh-external]")) return;
  const actor = app.actor ?? app.document;
  const blocks = root.querySelectorAll(
    "#juice-section section.juice-data-block, .clues-section section:is(.clue-data-block, .cluejournal-data-block)"
  );
  for (const block of blocks) {
    if (block.classList.contains("mh-track-card")) continue;
    const journal = block.classList.contains("cluejournal-data-block");
    const item    = journal ? null : actor?.items?.get(block.dataset.juiceId ?? block.dataset.clueId);
    const kind    = block.classList.contains("juice-data-block") ? "juice" : "clue";
    const [icon, label] = TRACK_KINDS[kind];
    block.classList.add("mh-track-card", `mh-track-${kind}`);

    const band = document.createElement("header");
    band.className = "mh-track-band";
    const title = document.createElement("span");
    title.className = "mh-track-title";
    title.textContent = game.i18n.localize("MistHUD.sheet.trackingCard");
    const mark = document.createElement("i");
    mark.className = `mh-track-icon fa-solid ${icon}`;
    mark.title = game.i18n.localize(label);
    band.append(title, mark);
    block.prepend(band);

    // Kind word where the book's card prints "TAG"
    const stamp = document.createElement("span");
    stamp.className = "mh-track-stamp";
    stamp.textContent = game.i18n.localize(label);

    if (journal) {
      block.querySelector(".question")?.before(stamp);
      continue;
    }

    const amount = Math.max(0, Number(item?.system?.amount) || 0);
    block.dataset.mhAmount = amount;
    const strip = document.createElement("div");
    strip.className = "mh-track-strip";
    for (let n = 1; n <= Math.max(TRACK_CELLS, amount); n++) {
      const cell = document.createElement("span");
      cell.className = `mh-track-cell${n === amount ? " mh-marked" : ""}`;
      cell.textContent = n;
      strip.append(cell);
    }
    band.after(strip);

    const name = block.querySelector(".card-name");
    if (!name) continue;
    const first = [...name.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (first) first.textContent = first.textContent.replace(/^\s*\(\d+\)\s*/, "");
    name.before(stamp);

    // One line: Name // Source - Method (empty parts and their divider left out)
    const line = document.createElement("span");
    line.className = "mh-track-line";
    name.before(line);
    line.append(name);
    const parts = [...block.querySelectorAll(":scope > :is(.juice-source, .clue-source, .juice-method, .clue-method)")];
    let divider = "//";
    for (const part of parts) {
      const labelText = part.querySelector("b")?.textContent ?? "";
      if (!part.textContent.replace(labelText, "").trim()) {
        part.classList.add("mh-track-blank");
        continue;
      }
      const sep = document.createElement("span");
      sep.className = "mh-track-sep";
      sep.textContent = ` ${divider} `;
      line.append(sep, part);
      divider = "-";
    }
  }
}

Hooks.on("renderCityCharacterSheet", (app, html) => {
  decorateTrackingCards(app, html instanceof HTMLElement ? html : html[0]);
});

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
    icon:    "fa-solid fa-list",
    button:  true,
    visible: true,
    onChange: () => StatusScreen.open(),
  };

  if (game.user.isGM) {
    tokenControls.tools["npcInfluenceManager"] = {
      name:    "npcInfluenceManager",
      title:   "MistHUD.window.influenceViewer",
      icon:    "fa-solid fa-skull",
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
