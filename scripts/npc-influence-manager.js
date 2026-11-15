// npc-influence-manager.js — GM window listing the influence of every threat
// in the current scene (ApplicationV2).

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_SOCKET = "module.mist-hud";
const FLAG_SCOPE    = "mist-hud";

export class NPCInfluenceManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static WINDOW_ID = "npc-influence-manager";

  static DEFAULT_OPTIONS = {
    id:      "npc-influence-manager",
    classes: ["mist-hud", "npc-influence-manager"],
    window:  { title: "MistHUD.window.influenceViewer", resizable: true, minimizable: true },
    position: { width: 450, height: "auto" },
    actions: {
      syncAll:    NPCInfluenceManager._onSyncAll,
      refresh:    NPCInfluenceManager._onRefresh,
      focusToken: NPCInfluenceManager._onFocusToken,
      tab:        NPCInfluenceManager._onTab,
    },
  };

  static PARTS = {
    app: { template: "modules/mist-hud/templates/npc-influence-manager.hbs" },
  };

  /** Currently shown tab ("active" | "all"); survives re-renders. */
  #tab = "active";

  // ── Live refresh (hooks/socket are registered once, never removed) ─────────

  static _handlersInitialized = false;
  static _refreshTimer = null;

  /** The open window, if any. */
  static get instance() {
    return foundry.applications.instances.get(NPCInfluenceManager.WINDOW_ID) ?? null;
  }

  /** Re-render the open window shortly (debounced). */
  static refreshSoon(delay = 50) {
    clearTimeout(NPCInfluenceManager._refreshTimer);
    NPCInfluenceManager._refreshTimer = setTimeout(() => {
      const app = NPCInfluenceManager.instance;
      if (app?.rendered) app.render();
    }, delay);
  }

  static _setupStaticHandlers() {
    if (NPCInfluenceManager._handlersInitialized) return;
    NPCInfluenceManager._handlersInitialized = true;

    const isThreatItem = item => item?.parent?.type === "threat" && ["tag", "status"].includes(item.type);
    const refresh = () => NPCInfluenceManager.refreshSoon();

    Hooks.on("updateNpcInfluence", refresh);

    Hooks.on("updateItem", (item, changes) => {
      if (!isThreatItem(item)) return;
      const flags = changes.flags?.[FLAG_SCOPE];
      const sys   = changes.system;
      if (flags?.tagState || flags?.statusType
          || sys?.burn_state !== undefined || sys?.burned !== undefined
          || sys?.tier !== undefined) refresh();
    });
    Hooks.on("createItem", item => { if (isThreatItem(item)) refresh(); });
    Hooks.on("deleteItem", item => { if (isThreatItem(item)) refresh(); });

    Hooks.on("updateActor", (actor, changes) => {
      if (actor?.type !== "threat" || !changes.system) return;
      if (changes.system.collectiveSize !== undefined || changes.system.scale !== undefined) refresh();
    });

    game.socket?.on(MODULE_SOCKET, message => {
      if (["npcInfluence", "refreshNpcInfluences", "updateCollectiveSize"].includes(message?.type)) {
        NPCInfluenceManager.refreshSoon(100);
      }
    });
  }

  constructor(options = {}) {
    super(options);
    NPCInfluenceManager._setupStaticHandlers();
  }

  // ── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const base = {
      totalInfluence: 0,
      currentSceneName: canvas?.scene?.name || game.i18n.localize("MistHUD.npcHud.noActiveScene"),
      sceneNpcs: [],
      activeSceneNpcs: [],
      hasSceneNpcs: false,
      hasActiveSceneNpcs: false,
      isGM: game.user?.isGM ?? false,
      tabActive: this.#tab === "active",
      tabAll:    this.#tab === "all",
    };
    if (!canvas?.tokens?.placeables) return base;

    const tokens = canvas.tokens.placeables.filter(t => t?.actor?.type === "threat");

    let total = 0;
    const npcs = [];
    const seenLinked = new Set();

    for (const token of tokens) {
      const actor = token.actor;
      const infl  = this._calculateTokenInfluence(token);
      total += Number(infl.totalInfluence) || 0;

      // A linked actor can have several tokens; list it once.
      const linked = token.document?.actorLink || false;
      if (linked) {
        if (seenLinked.has(actor.id)) continue;
        seenLinked.add(actor.id);
      }

      const collectiveSize = Number(actor.system?.collectiveSize || actor.system?.scale || 0);

      const tags = actor.items.filter(i => i.type === "tag").map(tag => ({
        id: tag.id,
        name: tag.name,
        state: tag.getFlag(FLAG_SCOPE, "tagState") || "neutral",
        isBurned: tag.system?.burn_state === 1 || !!tag.system?.burned,
      }));
      const statuses = actor.items.filter(i => i.type === "status").map(status => ({
        id: status.id,
        name: status.name,
        state: status.getFlag(FLAG_SCOPE, "statusType") || status.system?.specialType || "neutral",
        tier: Number(status.system?.tier) || 1,
      }));

      npcs.push({
        id: actor.id,
        tokenId: token.id,
        name: token.name || actor.name,
        img: token.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg",
        hasInfluence: infl.totalInfluence !== 0,
        isLinked: linked,
        influence: infl.totalInfluence,
        tagInfluence: infl.tagInfluence,
        statusInfluence: infl.statusInfluence,
        collectiveSize,
        hasCollectiveSize: collectiveSize > 0,
        isInCurrentScene: true,
        tags,
        statuses,
        hasTags: tags.length > 0,
        hasStatuses: statuses.length > 0,
      });
    }

    npcs.sort((a, b) => a.name.localeCompare(b.name));
    const active = npcs.filter(n => n.influence !== 0);

    return {
      ...base,
      totalInfluence: total,
      sceneNpcs: npcs,
      activeSceneNpcs: active,
      hasSceneNpcs: npcs.length > 0,
      hasActiveSceneNpcs: active.length > 0,
    };
  }

  /**
   * Influence of one token, computed from its current items. Also refreshes
   * globalThis.activeNpcInfluences (read by the player HUD at roll time).
   */
  _calculateTokenInfluence(token) {
    const actor = token?.actor;
    if (!actor) return { tagInfluence: 0, statusInfluence: 0, totalInfluence: 0 };

    let tagInfluence = 0;
    for (const tag of actor.items.filter(i => i.type === "tag")) {
      const state = tag.getFlag(FLAG_SCOPE, "tagState") || "neutral";
      if (state === "positive") tagInfluence += 1;
      else if (state === "negative") tagInfluence -= 1;
    }

    const collectiveSize = Number(actor.system?.collectiveSize || actor.system?.scale || 0);
    let statusInfluence = 0;
    for (const status of actor.items.filter(i => i.type === "status")) {
      const type = status.getFlag(FLAG_SCOPE, "statusType") || status.system?.specialType || "neutral";
      if (type === "neutral") continue;
      const tier = (Number(status.system?.tier) || 1) + collectiveSize;
      if (type === "positive") statusInfluence += tier;
      else if (type === "negative") statusInfluence -= tier;
    }

    const totalInfluence = tagInfluence + statusInfluence;

    if (globalThis.activeNpcInfluences) {
      const linked = token.document?.actorLink ?? false;
      globalThis.activeNpcInfluences[linked ? actor.id : token.id] = {
        npcId: actor.id,
        npcName: linked ? actor.name : (token.name || actor.name),
        tokenId: token.id,
        tokenName: token.name,
        actorLink: linked,
        tagInfluence,
        statusInfluence,
        totalInfluence,
      };
    }

    return { tagInfluence, statusInfluence, totalInfluence };
  }

  // ── Actions (`this` is the app instance) ───────────────────────────────────

  static _onTab(_event, target) {
    const tab = target.dataset.tab;
    if (!tab) return;
    this.#tab = tab;
    for (const el of this.element.querySelectorAll("[data-tab]")) {
      el.classList.toggle("active", el.dataset.tab === tab);
    }
  }

  static _onRefresh() {
    this.render();
  }

  static async _onSyncAll() {
    if (!game.user?.isGM) {
      ui.notifications.warn(game.i18n.localize("MistHUD.notify.gmOnlySync"));
      return;
    }
    try {
      const { syncSceneInfluences } = await import("./npc-hud.js");
      await syncSceneInfluences();
    } catch (error) {
      console.error("NPC Influence Manager | Failed to sync influences:", error);
      ui.notifications.error(game.i18n.localize("MistHUD.notify.syncError"));
    }
    if (this.rendered) this.render();
  }

  /** Select a token and pan to it. */
  static _onFocusToken(event, target) {
    event.preventDefault();
    const item = target.closest(".npc-item");
    if (!item || !canvas?.ready) return;

    const token = canvas.tokens.get(item.dataset.tokenId)
      ?? canvas.tokens.placeables.find(t => t.actor?.id === item.dataset.npcId);
    if (!token) return;

    token.control({ releaseOthers: true });
    canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
  }
}
