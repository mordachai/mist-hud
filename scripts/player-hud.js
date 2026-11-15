// player-hud.js — Player HUD (ApplicationV2 rewrite of mist-hud.js)
//
// Responsibilities:
//   1. Display actor data (themes, tags, statuses, improvements)
//   2. Manage tag/status selection in-memory via HUDState
//   3. Trigger system API calls (CityRoll, actor mutations, dialogs)
//
// The system (CityRoll.execRoll) handles all rolling, power calc, post-roll.

import { MODULE_ID, SETTINGS, getActiveSystem } from "./constants.js";
import {
  getOrCreateState, playerHudRegistry, isOtherscapeBurn, clearSystemSelection,
  hudKey, isTagBurned, bonusActorFor,
} from "./hud-state.js";
import { organizeMoves, getMoveAbbreviation, getMoveImageSrc } from "./move-layout.js";
import {
  getMysteryFromTheme, getCrewThemes, getThemesAndTags,
  getImprovements, getCrewImprovements, getActorStatuses,
  getJuiceAndClues, getEssence, getLoadoutTags,
} from "./getters.js";
import { BonusManager } from "./bonus-manager.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ── System internals (guarded) ───────────────────────────────────────────────
// These classes are not a public API: the system has renamed/removed such files
// before, and a static import of a missing file stops this whole module from
// loading. They are loaded dynamically instead (same URL the system itself is
// served from, so we get the system's own class instances) and a failure is
// reported to the user. Nothing here is awaited at load time; `sys` is filled
// long before the first HUD renders.
const SYSTEM_FILES = {
  CityRoll:    "city-roll.js",
  CityDB:      "city-db.js",
  CityHelpers: "city-helpers.js",
  CityDialogs: "city-dialogs.js",
};

/** @type {{CityRoll?: any, CityDB?: any, CityHelpers?: any, CityDialogs?: any}} */
const sys = {};
const _systemFailures = [];

function _reportSystemFailures() {
  if (!_systemFailures.length) return;
  ui.notifications.error(
    game.i18n.format("MistHUD.notify.systemLoadFailed", { files: _systemFailures.join(", ") }),
    { permanent: true }
  );
}

const systemReady = Promise.all(Object.entries(SYSTEM_FILES).map(async ([name, file]) => {
  try {
    const mod = await import(foundry.utils.getRoute(`systems/city-of-mist/module/${file}`));
    if (!mod[name]) throw new Error(`${file} has no export named ${name}`);
    sys[name] = mod[name];
  } catch (e) {
    console.error(`Mist HUD | Failed to load system file ${file}:`, e);
    _systemFailures.push(file);
  }
})).then(() => {
  if (!_systemFailures.length) return;
  if (globalThis.game?.ready) _reportSystemFailures();
  else Hooks.once("ready", _reportSystemFailures);
});

// ── Module-level registry (one PlayerHUD per hudKey) ─────────────────────────
// Defined in hud-state.js; re-exported for init.js and other importers.
export { playerHudRegistry };

// ── Handlebars helpers (registered once at module level) ─────────────────────
Handlebars.registerHelper("times", function (n, block) {
  let out = "";
  for (let i = 0; i < n; i++) out += block.fn(i);
  return out;
});

// ── PlayerHUD ─────────────────────────────────────────────────────────────────
export class PlayerHUD extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @type {CityActor} */
  actor = null;

  /** Registry key: token id for an unlinked token's actor, else the actor id. */
  key = null;

  /** @type {jQuery|null} */
  _currentTooltip = null;

  /** True while a roll is in flight (ignores double clicks on move buttons). */
  _rolling = false;

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.key   = hudKey(actor);
    playerHudRegistry.set(this.key, this);
  }

  static DEFAULT_OPTIONS = {
    id:      "mist-hud",
    classes: ["player-hud", "mist-hud", "mh-hud"],
    window: {
      frame:       true,
      title:       "MistHUD.window.playerHud",
      positioned:  true,
      resizable:   false,
      minimizable: true,
    },
    position: { width: "auto", height: "auto", left: 200, top: 120 },
  };

  static PARTS = {
    app: { template: "modules/mist-hud/templates/player-hud.hbs" },
  };

  // ── Context preparation ───────────────────────────────────────────────────

  async _prepareContext(_options) {
    if (!this.actor) return {};

    const activeSystem = getActiveSystem();
    const isCityOfMist = activeSystem === "city-of-mist";
    const isOtherscape = activeSystem === "otherscape";
    const isLegend     = activeSystem === "legend";

    const state = getOrCreateState(this.key);

    // ── Themes + Tags ─────────────────────────────────────────────────────────
    const themesAndTags = getThemesAndTags(this.actor);

    const themes = (themesAndTags.themes ?? []).map(theme => {
      const themeItem = this.actor.items.get(theme.id);
      return {
        ...theme,
        nascent:          themeItem?.system?.nascent === true,
        unspent_upgrades: themeItem?.system?.unspent_upgrades || 0,
        powerTags: (theme.powerTags ?? []).map(tag => ({
          ...tag,
          selected: state.selectedTags.has(tag.id),
        })),
        weaknessTags: (theme.weaknessTags ?? []).map(tag => ({
          ...tag,
          selected:      state.selectedTags.has(tag.id),
          inverted:      state.invertedTags.has(tag.id),
          inversionIcon: state.invertedTags.has(tag.id)
            ? '<i class="fa-light fa-angles-up"></i>'
            : '<i class="fa-light fa-angles-down"></i>',
        })),
      };
    });

    const storyTags = (themesAndTags.storyTags ?? []).map(tag => ({
      ...tag,
      selected:      state.selectedTags.has(tag.id),
      inverted:      state.invertedTags.has(tag.id),
      inversionIcon: state.invertedTags.has(tag.id)
        ? '<i class="fa-light fa-angles-down"></i>'
        : '<i class="fa-light fa-angles-up"></i>',
    }));

    const loadoutTags = getLoadoutTags(this.actor).map(tag => ({
      ...tag,
      selected: state.selectedTags.has(tag.id),
    }));

    const crewThemes = (themesAndTags.crewThemes ?? []).map(ct => {
      const crewActor     = game.actors.get(ct.actorId);
      const crewThemeItem = crewActor?.items.get(ct.id);
      return {
        ...ct,
        nascent:          crewThemeItem?.system?.nascent === true,
        unspent_upgrades: crewThemeItem?.system?.unspent_upgrades || 0,
        powerTags: (ct.powerTags ?? []).map(tag => ({
          ...tag,
          selected: state.selectedTags.has(tag.id),
        })),
        weaknessTags: (ct.weaknessTags ?? []).map(tag => ({
          ...tag,
          selected:      state.selectedTags.has(tag.id),
          inverted:      state.invertedTags.has(tag.id),
          inversionIcon: state.invertedTags.has(tag.id)
            ? '<i class="fa-light fa-angles-up"></i>'
            : '<i class="fa-light fa-angles-down"></i>',
        })),
      };
    });

    // ── Statuses ──────────────────────────────────────────────────────────────
    const statuses = getActorStatuses(this.actor).map(st => {
      const stateVal = state.statusStates.get(st.id) ?? "neutral";
      return { ...st, statusType: stateVal, selected: stateVal !== "neutral" };
    });

    // ── System-specific data ──────────────────────────────────────────────────
    let helpItems = [], hurtItems = [], clueItems = [], juiceItems = [];
    let essence, essenceClass, essenceImage, essenceText;

    if (isCityOfMist) {
      ({ helpItems, hurtItems, clueItems, juiceItems } = getJuiceAndClues(this.actor));
    } else if (isOtherscape) {
      const themeItems  = this.actor.items.contents.filter(i => i.type === "theme");
      const essenceData = getEssence(themeItems);
      if (essenceData?.essence) {
        essence      = essenceData.essence;
        essenceClass = essenceData.className;
        essenceImage = essenceData.imageName;
        // Static, module-owned HTML from the lang files (safe to render unescaped).
        essenceText  = new Handlebars.SafeString(
          game.i18n.localize(`MistHUD.essence.${essenceData.className}`));
      }
    }

    // ── Received bonuses ──────────────────────────────────────────────────────
    const receivedBonuses = bonusActorFor(this.actor)?.getFlag(MODULE_ID, "received-bonuses") || {};
    const helpHurtMessages = Object.entries(receivedBonuses).flatMap(([giverId, bonus]) => {
      const giverActor = game.actors.get(giverId);
      if (!giverActor) return [];
      return [{
        type:       bonus.type,
        amount:     bonus.amount,
        giverName:  giverActor.name,
        giverToken: giverActor.token?.texture?.src
                    ?? giverActor.prototypeToken?.texture?.src
                    ?? giverActor.img,
      }];
    });

    // ── Improvements ──────────────────────────────────────────────────────────
    const improvements = getImprovements(this.actor);

    // ── Move buttons ──────────────────────────────────────────────────────────
    const allMoves = sys.CityDB?.movesList ?? [];
    const { core, advanced, shb } = organizeMoves(allMoves);
    const useText    = game.settings.get(MODULE_ID, SETTINGS.USE_TEXT_BUTTONS);
    const isDynamite = game.settings.get(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE);
    const dynamiteImg = isDynamite
      ? "modules/mist-hud/ui/Dynamite-ON.webp"
      : "modules/mist-hud/ui/Dynamite-OFF.webp";

    const _fmt = m => {
      const imgSrc = getMoveImageSrc(m);
      return {
        id:      m.id,
        name:    m.name,
        abbr:    getMoveAbbreviation(m),
        imgSrc,
        tooltip: m.name,
        useText: useText || !imgSrc,
      };
    };

    return {
      actor:           this.actor,
      actorId:         this.actor.id,
      activeSystem, isCityOfMist, isOtherscape, isLegend,
      themes, storyTags, loadoutTags, crewThemes,
      hasCrewThemes:   crewThemes.length > 0,
      statuses,
      helpItems, hurtItems, clueItems, juiceItems,
      helpHurtMessages: helpHurtMessages.length ? helpHurtMessages : null,
      essence, essenceClass, essenceImage, essenceText,
      improvements,
      hasImprovements: improvements.length > 0,
      modifier:        state.modifier,
      isDynamite, dynamiteImg,
      coreMoves:       core.map(_fmt),
      advancedMoves:   [...advanced, ...shb].map(_fmt),
      useText,
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);

    this._injectCustomHeader(html);
    this._bindTagListeners(html);
    this._bindStatusListeners(html);
    this._bindBurnListeners(html);
    this._bindModifierListeners(html);
    this._bindSlidingPanelListeners(html);
    this._bindRollBarListeners(html);
    this._bindCreateDeleteListeners(html);
    this._bindTooltipListeners(html);
    this._bindDragListeners(html);
    this._updatePowerDisplay(html);

    // Prevent browser context menu on the entire HUD
    this.element.addEventListener("contextmenu", ev => ev.preventDefault(), false);
  }

  // ── Custom Header ─────────────────────────────────────────────────────────

  _injectCustomHeader(html) {
    const header = html.find(".window-header");
    if (!header.length) return;

    header.find(".window-title").hide();
    header.find(".mh-token-image, .mh-char-name, .mh-close-button").remove();

    // Built with DOM APIs (.attr/.text), never by string-concatenating HTML: the
    // actor name and image path are user-editable.
    const src      = this.actor?.token?.texture?.src ?? this.actor?.img ?? "";
    const name     = this.actor?.name ?? "";
    const tokenImg = $('<div class="mh-token-image"></div>')
      .append($("<img>").attr({ src, alt: name }));
    const charName = $('<div class="mh-char-name"></div>').text(name);

    // ApplicationV2 already provides the controls (⋮ menu, minimize, close).
    header.append(tokenImg, charName);
    header.addClass("mh-custom-header");
  }

  // ── Tag listeners ─────────────────────────────────────────────────────────

  _bindTagListeners(html) {
    // Power / story / loadout tags: click to toggle selection
    html.find(".mh-power-tag, .mh-story-tag, .mh-loadout-tag").on("click", ev => {
      ev.stopPropagation(); ev.preventDefault();
      const el = ev.currentTarget;
      if (el.classList.contains("burned")) return;
      const id = el.dataset.id;
      if (!id) return;
      const state = getOrCreateState(this.key);
      state.toggleTag(id);
      el.classList.toggle("selected", state.selectedTags.has(id));
      this._updatePowerDisplay(html);
    });

    // Weakness tag body: select/deselect (but not on the inversion toggle)
    html.find(".mh-weakness-tag").on("click", ev => {
      if ($(ev.target).closest(".mh-weakness-toggle").length) return;
      ev.stopPropagation(); ev.preventDefault();
      const el = ev.currentTarget;
      if (el.classList.contains("burned")) return;
      const id = el.dataset.id;
      if (!id) return;
      const state = getOrCreateState(this.key);
      state.toggleTag(id);
      el.classList.toggle("selected", state.selectedTags.has(id));
      this._updatePowerDisplay(html);
    });

    // Weakness inversion toggle (the arrows)
    html.find(".mh-weakness-toggle").on("click", ev => {
      ev.stopPropagation(); ev.preventDefault();
      const id    = ev.currentTarget.dataset.id;
      if (!id) return;
      const tagEl = ev.currentTarget.closest(".mh-weakness-tag");
      if (tagEl?.classList.contains("burned")) return;
      const state = getOrCreateState(this.key);
      state.toggleInverted(id);
      const inv = state.invertedTags.has(id);
      tagEl?.classList.toggle("inverted", inv);
      $(ev.currentTarget).html(inv
        ? '<i class="fa-light fa-angles-up"></i>'
        : '<i class="fa-light fa-angles-down"></i>'
      );
      this._updatePowerDisplay(html);
    });

    // Story tag inversion toggle
    html.find(".mh-story-toggle").on("click", ev => {
      ev.stopPropagation(); ev.preventDefault();
      const id    = ev.currentTarget.dataset.id;
      if (!id) return;
      const tagEl = ev.currentTarget.closest(".mh-story-tag");
      if (tagEl?.classList.contains("burned")) return;
      const state = getOrCreateState(this.key);
      state.toggleInverted(id);
      const inv = state.invertedTags.has(id);
      tagEl?.classList.toggle("inverted", inv);
      $(ev.currentTarget).html(inv
        ? '<i class="fa-light fa-angles-down"></i>'
        : '<i class="fa-light fa-angles-up"></i>'
      );
      this._updatePowerDisplay(html);
    });
  }

  // ── Status listeners ──────────────────────────────────────────────────────

  _bindStatusListeners(html) {
    html.find(".mh-status").on("click", ev => {
      ev.stopPropagation(); ev.preventDefault();
      const el = ev.currentTarget;
      const id = el.dataset.statusId;
      if (!id) return;
      const state    = getOrCreateState(this.key);
      const newState = state.cycleStatus(id);
      el.classList.remove("neutral", "negative", "positive", "selected");
      el.classList.add(newState);
      if (newState !== "neutral") el.classList.add("selected");
      this._updatePowerDisplay(html);
    });

    html.find(".mh-status").on("contextmenu", async ev => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.statusId;
      if (id) await this.actor.deleteStatus(id);
    });

    html.find(".mh-status").on("dblclick", async ev => {
      ev.preventDefault();
      const id     = ev.currentTarget.dataset.statusId;
      const status = id ? this.actor.getStatus?.(id) : null;
      if (status) await sys.CityDialogs.itemEditDialog(status);
    });
  }

  // ── Burn toggle listeners ─────────────────────────────────────────────────

  _bindBurnListeners(html) {
    html.find(".mh-burn-toggle").on("click", async ev => {
      ev.stopPropagation(); ev.preventDefault();

      const burnEl = ev.currentTarget;
      const tagEl  = burnEl.closest(".mh-power-tag, .mh-story-tag, .mh-loadout-tag");
      if (!tagEl) return;
      const tagId = tagEl.dataset.id;
      if (!tagId) return;

      // Crew vs main actor
      let tagActor = this.actor;
      if (tagEl.classList.contains("Crew")) {
        const crewId = tagEl.dataset.actorId;
        if (crewId) tagActor = game.actors.get(crewId) ?? this.actor;
      }

      const current = burnEl.classList.contains("burned") ? "burned"
                    : burnEl.classList.contains("toBurn")  ? "toBurn"
                    : "unburned";
      const next = current === "unburned" ? "toBurn"
                 : current === "toBurn"   ? "burned"
                 : "unburned";

      burnEl.classList.remove("unburned", "toBurn", "burned");
      burnEl.classList.add(next);
      tagEl.classList.remove("unburned", "toBurn", "burned");
      tagEl.classList.add(next);

      // Auto-select on toBurn, deselect on burned
      const state = getOrCreateState(this.key);
      if (next === "toBurn") {
        tagEl.classList.add("selected");
        state.selectedTags.add(tagId);
      } else if (next === "burned") {
        tagEl.classList.remove("selected");
        state.selectedTags.delete(tagId);
      }

      // Persist burn state to actor DB. "Burned" must satisfy the system's
      // CityItem.isBurned() (burned && burn_state != 0); "toBurn" is the HUD's
      // marker (burned false, burn_state 1) that the roll turns into a real burn.
      const tagItem = tagActor.items.get(tagId);
      if (tagItem) {
        await tagItem.update({
          "system.burned":     next === "burned",
          "system.burn_state": next === "unburned" ? 0 : 1,
        });
      }
      this._updatePowerDisplay(html);
    });
  }

  // ── Modifier listeners ────────────────────────────────────────────────────

  _bindModifierListeners(html) {
    const state = getOrCreateState(this.key);
    const input = html.find("#mh-mod-value");
    input.val(state.modifier);

    html.find("#mh-mod-decrease").on("click", () => {
      state.modifier--;
      input.val(state.modifier);
      this._updatePowerDisplay(html);
    });

    html.find("#mh-mod-increase").on("click", () => {
      state.modifier++;
      input.val(state.modifier);
      this._updatePowerDisplay(html);
    });

    input.on("change", ev => {
      state.modifier = parseInt(ev.currentTarget.value) || 0;
      this._updatePowerDisplay(html);
    });
  }

  // ── Sliding panel ─────────────────────────────────────────────────────────

  _bindSlidingPanelListeners(html) {
    const panel = html.find(".mh-sliding-panel")[0];
    const ear   = html.find(".mh-panel-ear")[0];
    if (ear && panel) ear.addEventListener("click", () => panel.classList.toggle("open"));
  }

  // ── Roll bar ──────────────────────────────────────────────────────────────

  _bindRollBarListeners(html) {
    html.find(".mh-roll-button[data-move-id]").on("click", async ev => {
      const moveId = ev.currentTarget.dataset.moveId;
      await this._executeMove(moveId);
    });

    // Toggle core ↔ advanced moves
    html.find(".mh-roll-toggle").on("click", ev => {
      const core = html.find(".core-moves");
      const adv  = html.find(".special-moves");
      const btn  = $(ev.currentTarget).find("i");
      if (core.is(":visible")) {
        core.slideUp(250, () => adv.slideDown(250));
        btn.removeClass("fa-caret-up").addClass("fa-caret-down");
      } else {
        adv.slideUp(250, () => core.slideDown(250));
        btn.removeClass("fa-caret-down").addClass("fa-caret-up");
      }
    });

    // Dynamite toggle
    html.find(".mh-dynamite-toggle").on("click", async () => {
      const current = game.settings.get(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE);
      await game.settings.set(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE, !current);
      html.find(".mh-dynamite-toggle img").attr("src",
        !current ? "modules/mist-hud/ui/Dynamite-ON.webp"
                 : "modules/mist-hud/ui/Dynamite-OFF.webp"
      );
    });
  }

  /**
   * Roll a move through the system's CityRoll, without the system's roll dialog.
   *
   *  - "standard" moves: `new CityRoll(...).execRoll()` with the HUD selection,
   *    the system's scene selection, help/hurt and NPC influence.
   *  - other subtypes (themeclassroll, SHB, noroll): `CityRoll.execMove()`, which
   *    sets the theme-count / no-roll options itself. It only opens the system
   *    roll dialog when the move allows statuses (ALLOW_STATUS); those moves are
   *    prepared here with CityRoll's own public methods instead, so the HUD
   *    selection is what gets rolled.
   */
  async _executeMove(moveId) {
    if (!this.actor || !moveId || this._rolling) return;

    await systemReady;
    const { CityRoll, CityHelpers, CityDialogs } = sys;
    if (!CityRoll || !CityHelpers) {
      ui.notifications.error(game.i18n.localize("MistHUD.notify.rollApiUnavailable"));
      return;
    }

    this._rolling = true;
    try {
      const move = CityHelpers.getMoves().find(m => m.id === moveId);
      if (!move) throw new Error(`Move ${moveId} not found`);

      const state    = getOrCreateState(this.key);
      const subtype  = move.system.subtype;
      const standard = subtype === "standard";

      // Help/hurt and NPC influence only apply to standard (tag-based) rolls.
      const { list, burnIds, extraBurn, usedBonuses } =
        state.buildRollList(this.actor, { modifiers: standard });

      const options = {
        modifier:        state.modifier,
        // 0 = roll the dice. The system's roll dialog always sets it, and its chat
        // template only prints the dice when setRoll === 0 (blank box otherwise).
        setRoll:         0,
        dynamiteAllowed: game.settings.get(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE) || move.isAutoDynamite(),
      };

      let result;
      if (standard) {
        if (burnIds.length) {
          options.burnTag = burnIds[0];
          // Classic burn is "burn for a hit": the system's roll dialog fixes the
          // dice at 7 for it (roll-dialog.js updateModifierPopup).
          if (!isOtherscapeBurn()) options.setRoll = 7;
        }
        result = await new CityRoll(moveId, this.actor, list, options).execRoll();
      } else {
        if (subtype === "SHB") {
          // Same prompts as the system sheet: which theme type / which theme.
          if (!CityDialogs) throw new Error("System dialogs are not available");
          if (game.settings.get("city-of-mist", "baseSystem") === "city-of-mist") {
            const type = await CityDialogs.SHBDialog(this.actor);
            if (!type) return;
            options.newtype = type;
          } else {
            const theme = await CityDialogs.BlazeDialog(this.actor);
            if (!theme) return;
            options.newtype      = theme.getThemeType();
            options.BlazeThemeId = theme.id;
          }
        }

        const known = ["SHB", "themeclassroll", "noroll"].includes(subtype);
        if (known && move.hasEffectClass("ALLOW_STATUS")) {
          const roll = new CityRoll(moveId, this.actor, list, options);
          if (subtype === "noroll") roll.noRoll();
          else roll.themeClassRoll(options.newtype ?? move.system.theme_class);
          options.noStatus = false;
          result = await roll.execRoll();
        } else {
          result = await CityRoll.execMove(moveId, this.actor, list, options);
        }
      }
      if (!result) return; // cancelled

      await this._postRollCleanup({
        list,
        burnIds,
        extraBurn:    standard ? extraBurn : [],
        clearBonuses: standard && usedBonuses,
      });
    } catch (e) {
      console.error("Mist HUD | Error executing roll:", e);
      ui.notifications.error(game.i18n.format("MistHUD.notify.rollFailed", { error: e?.message ?? e }));
    } finally {
      this._rolling = false;
    }
  }

  /**
   * After a roll. The system has already burned the `burnTag`, burned/deleted
   * temporary tags and statuses per its own settings, and granted attention
   * for weaknesses; none of that is repeated here.
   *
   * @param {object}   [opts]
   * @param {object[]} [opts.list]         The list that was rolled
   * @param {string[]} [opts.burnIds]      Every tag that was marked "to burn" for this roll
   * @param {string[]} [opts.extraBurn]    Tag ids burned beyond CityRoll's single burnTag
   * @param {boolean}  [opts.clearBonuses] Help/hurt was used and must be cleared
   */
  async _postRollCleanup({ list = [], burnIds = [], extraBurn = [], clearBonuses = false } = {}) {
    for (const tagId of extraBurn) {
      const row = list.find(x => x.tagId === tagId);
      if (!row) continue;
      try {
        await sys.CityHelpers.getOwner(row.ownerId, row.tokenId)?.burnTag(tagId);
      } catch (e) {
        console.warn(`Mist HUD | Could not burn tag ${row.name}:`, e);
      }
    }

    // Tags still in the "to burn" state were not burned by this roll (classic
    // burn rules burn only one tag per roll; a non-standard move burns none).
    // Put them back to unburned so they do not stay half-marked.
    const state = getOrCreateState(this.key);
    for (const tagId of burnIds) {
      try {
        const tag = state._resolveTag(tagId, this.actor);
        if (tag && !isTagBurned(tag) && tag.system.burn_state === 1) {
          await tag.update({ "system.burn_state": 0, "system.burned": false });
        }
      } catch (e) {
        console.warn(`Mist HUD | Could not reset burn state of tag ${tagId}:`, e);
      }
    }

    state.clear();
    clearSystemSelection();
    if (clearBonuses) BonusManager.clearBonuses(this.actor.id);

    if (game.settings.get(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE)) {
      await game.settings.set(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE, false);
    }
    this.render({ force: true });
  }

  // ── Create / Delete ───────────────────────────────────────────────────────

  _bindCreateDeleteListeners(html) {
    html.find(".mh-create-story-tag").on("click",  ev => { ev.stopPropagation(); this._createStoryTag(); });
    html.find(".mh-create-status").on("click",     ev => { ev.stopPropagation(); this._createStatus(); });

    html.find(".mh-story-tag").on("contextmenu",   async ev => {
      ev.preventDefault();
      const id = ev.currentTarget.dataset.id;
      if (id) await this.actor.deleteTag(id);
    });
    html.find(".mh-story-tag").on("dblclick",       async ev => {
      ev.preventDefault();
      const tag = this.actor.getTag?.(ev.currentTarget.dataset.id);
      if (tag) await sys.CityDialogs.itemEditDialog(tag);
    });

    // Clues
    html.find(".create-clue").on("click",            ev => { ev.stopPropagation(); this._createClue(); });
    html.find(".clue-delete").on("click",            ev => this._deleteClue(ev));
    html.find(".clue-container").on("dblclick",      ev => this._editClue(ev));

    // Juice
    html.find(".create-juice").on("click",           ev => { ev.stopPropagation(); this._createJuice(); });
    html.find(".juice-delete").on("click",           ev => this._deleteJuice(ev));
    html.find(".juice-container").on("dblclick",     ev => this._editJuice(ev));

    // Help / Hurt checkboxes
    html.find(".help-toggle, .hurt-toggle").on("change", ev => {
      const t = ev.currentTarget;
      if (!t.dataset.actorId || !t.dataset.targetId) {
        ui.notifications.warn(game.i18n.localize("MistHUD.notify.bonusPartiesUnknown"));
        t.checked = !t.checked;
        return;
      }
      BonusManager.applyBonus(
        t.dataset.actorId, t.dataset.targetId,
        t.classList.contains("help-toggle") ? "help" : "hurt",
        Number(t.dataset.amount), t.checked
      );
    });
  }

  async _createStoryTag() {
    const result = await this.actor.createStoryTag?.("New Tag");
    const id     = Array.isArray(result) ? result[0]?.id : result?.id;
    if (!id) return;
    const tag = this.actor.items.get(id);
    if (tag) {
      const updated = await sys.CityHelpers.itemDialog(tag);
      if (!updated) await this.actor.deleteTag(id);
    }
  }

  async _createStatus() {
    const result = await this.actor.createNewStatus?.("New Status");
    const id     = Array.isArray(result) ? result[0]?.id : result?.id;
    if (!id) return;
    const status = this.actor.items.get(id);
    if (!status) return;
    const updated = await sys.CityHelpers.itemDialog(status);
    if (!updated) await this.actor.deleteStatus?.(id);
  }

  async _createClue() {
    const result = await this.actor.createNewClue?.({ name: "Unnamed Clue" });
    const id     = Array.isArray(result) ? result[0]?.id : result?.id;
    if (!id) return;
    const clue = this.actor.getClue?.(id);
    if (!clue) return;
    const updated = await sys.CityHelpers.itemDialog(clue);
    if (updated) sys.CityHelpers.modificationLog(this.actor, "Created", clue, `${clue.system.amount}`);
    else await this.actor.deleteClue?.(id);
  }

  async _deleteClue(ev) {
    ev.stopPropagation();
    const clueId  = ev.currentTarget.closest("[data-clue-id]")?.dataset.clueId;
    const ownerId = ev.currentTarget.closest("[data-owner-id]")?.dataset.ownerId;
    const owner   = ownerId ? game.actors.get(ownerId) : this.actor;
    if (!clueId || !owner) return;
    const clue = owner.getClue?.(clueId);
    await owner.deleteClue?.(clueId);
    if (clue) sys.CityHelpers.modificationLog(owner, "Removed", clue);
  }

  async _editClue(ev) {
    ev.preventDefault(); ev.stopPropagation();
    const ownerId = ev.currentTarget.dataset.ownerId;
    const owner   = ownerId ? game.actors.get(ownerId) : this.actor;
    const clue    = owner?.getClue?.(ev.currentTarget.dataset.clueId);
    if (clue) await sys.CityDialogs.itemEditDialog(clue);
  }

  async _createJuice() {
    const result = await this.actor.createNewJuice?.("Unnamed Juice");
    const id     = Array.isArray(result) ? result[0]?.id : result?.id;
    if (!id) return;
    const juice = this.actor.getJuice?.(id);
    if (!juice) return;
    const updated = await sys.CityHelpers.itemDialog(juice);
    if (updated) sys.CityHelpers.modificationLog(this.actor, "Created", juice, `${juice.system.amount}`);
    else await this.actor.deleteJuice?.(id);
  }

  async _deleteJuice(ev) {
    ev.stopPropagation();
    const juiceId = ev.currentTarget.closest("[data-juice-id]")?.dataset.juiceId;
    const ownerId = ev.currentTarget.closest("[data-owner-id]")?.dataset.ownerId;
    const owner   = ownerId ? game.actors.get(ownerId) : this.actor;
    if (!juiceId || !owner) return;
    const juice = owner.getJuice?.(juiceId);
    await owner.deleteJuice?.(juiceId);
    if (juice) sys.CityHelpers.modificationLog(owner, "Removed", juice);
  }

  async _editJuice(ev) {
    ev.preventDefault(); ev.stopPropagation();
    const ownerId = ev.currentTarget.dataset.ownerId;
    const owner   = ownerId ? game.actors.get(ownerId) : this.actor;
    const juice   = owner?.getJuice?.(ev.currentTarget.dataset.juiceId);
    if (!juice) return;
    const old     = { name: juice.name, amount: juice.system.amount };
    const updated = await sys.CityDialogs.itemEditDialog(juice);
    if (updated) sys.CityHelpers.modificationLog(owner, "Edited", juice,
      `${old.name} (${old.amount}) → ${updated.name} (${updated.system?.amount})`);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  _bindTooltipListeners(html) {
    html.find(".mh-theme-icon").each((_, el) => {
      const themeId   = el.dataset.themeId;
      const themeType = el.dataset.themeType;
      $(el).off("mouseenter mouseleave").on({
        mouseenter: async ev => {
          if (this._currentTooltip) { this._currentTooltip.remove(); this._currentTooltip = null; }
          try {
            const data = themeType === "crew"
              ? (getCrewThemes(this.actor).find(t => t.id === themeId) ?? { mysteryText: "" })
              : getMysteryFromTheme(this.actor, themeId);
            this._currentTooltip = await this._showTooltip(ev, data);
          } catch { /* ignore */ }
        },
        mouseleave: () => {
          if (this._currentTooltip) { this._currentTooltip.remove(); this._currentTooltip = null; }
        },
      });
    });
  }

  async _showTooltip(event, data) {
    $(".mh-tooltip").remove();
    const content = await foundry.applications.handlebars.renderTemplate("modules/mist-hud/templates/mh-tooltip-theme.hbs", data);
    const tooltip = $(`<div class="mh-tooltip">${content}</div>`);
    $("body").append(tooltip);
    const ww = $(window).width(), wh = $(window).height();
    const tw = tooltip.outerWidth(), th = tooltip.outerHeight();
    let top  = event.pageY + 16, left = event.pageX + 10;
    if (left + tw > ww) left = ww - tw - 10;
    if (top  + th > wh) top  = wh - th - 10;
    tooltip.css({ top, left, position: "fixed" });
    return tooltip;
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  _bindDragListeners(html) {
    html.find(".mh-status").each((_, el) => {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", ev => {
        ev.dataTransfer.setData("text/plain", JSON.stringify({
          type: "status", name: el.dataset.statusName,
          tier: parseInt(el.dataset.tier) || 1,
          actorId: el.dataset.ownerId || this.actor?.id,
        }));
      });
    });

    html.find(".mh-story-tag").each((_, el) => {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", ev => {
        const $el = $(el);
        ev.dataTransfer.setData("text/plain", JSON.stringify({
          type: "story-tag", name: $el.text().trim(),
          isInverted: $el.hasClass("inverted"),
          actorId:    $el.data("actor-id") || this.actor?.id,
          temporary:  $el.data("temporary") || false,
          permanent:  $el.data("permanent") || false,
        }));
      });
    });
  }

  // ── Power display ─────────────────────────────────────────────────────────

  _updatePowerDisplay(html) {
    if (!html) html = $(this.element);
    const state = getOrCreateState(this.key);
    const power = state.previewPower(this.actor);
    const str   = power > 0 ? `+${power}` : `${power}`;
    html.find(".mh-power-indicator").text(str);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async close(options) {
    $(".mh-tooltip").remove();
    // Only remove our own entry (a newer HUD may already own the key)
    if (this.key && playerHudRegistry.get(this.key) === this) playerHudRegistry.delete(this.key);
    return super.close(options);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Get existing HUD or create a new one for an actor.
 * @param {CityActor} actor
 * @returns {PlayerHUD|null}
 */
export function getOrCreateHud(actor) {
  if (!actor || actor.type !== "character") return null;
  const existing = playerHudRegistry.get(hudKey(actor));
  if (existing) return existing;
  return new PlayerHUD(actor);
}
