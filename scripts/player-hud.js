// player-hud.js — Player HUD (ApplicationV2 rewrite of mist-hud.js)
//
// Responsibilities:
//   1. Display actor data (themes, tags, statuses, improvements)
//   2. Manage tag/status selection in-memory via HUDState
//   3. Trigger system API calls (CityRoll, actor mutations, dialogs)
//
// The system (CityRoll.execRoll) handles all rolling, power calc, post-roll.

import { MODULE_ID, SETTINGS } from "./constants.js";
import { getOrCreateState } from "./hud-state.js";
import { organizeMoves, getMoveAbbreviation, getMoveImageSrc } from "./move-layout.js";
import {
  getMysteryFromTheme, getCrewThemes, getThemesAndTags,
  getImprovements, getCrewImprovements, getActorStatuses,
  getJuiceAndClues, getEssence, getLoadoutTags,
} from "./getters.js";
import { BonusManager } from "./bonus-manager.js";

import { CityRoll }    from "/systems/city-of-mist/module/city-roll.js";
import { CityDB }      from "/systems/city-of-mist/module/city-db.js";
import { CityHelpers } from "/systems/city-of-mist/module/city-helpers.js";
import { CityDialogs } from "/systems/city-of-mist/module/city-dialogs.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ── Module-level registry (one PlayerHUD per actorId) ────────────────────────
/** @type {Map<string, PlayerHUD>} */
export const playerHudRegistry = new Map();

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

  /** @type {jQuery|null} */
  _currentTooltip = null;

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    playerHudRegistry.set(actor.id, this);
  }

  static DEFAULT_OPTIONS = {
    id:      "mist-hud",
    classes: ["player-hud", "mist-hud", "mh-hud"],
    window: {
      frame:       true,
      title:       "Player HUD",
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

    const activeSystem = game.settings.get("city-of-mist", "system");
    const isCityOfMist = activeSystem === "city-of-mist";
    const isOtherscape = activeSystem === "otherscape";
    const isLegend     = activeSystem === "legend";

    const state = getOrCreateState(this.actor.id);

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
          selected: state.selectedTags.has(tag.id),
          inverted: state.invertedTags.has(tag.id),
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
        essenceText  = new Handlebars.SafeString(essenceData.text || "");
      }
    }

    // ── Received bonuses ──────────────────────────────────────────────────────
    const receivedBonuses = this.actor.getFlag(MODULE_ID, "received-bonuses") || {};
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
    const allMoves = CityDB?.movesList ?? [];
    const { core, advanced, shb } = organizeMoves(allMoves);
    const useText    = game.settings.get(MODULE_ID, SETTINGS.USE_TEXT_BUTTONS);
    const isDynamite = game.settings.get(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE);
    const dynamiteImg = isDynamite
      ? "modules/mist-hud/ui/Dynamite-ON.webp"
      : "modules/mist-hud/ui/Dynamite-OFF.webp";

    const _fmt = m => ({
      id:      m.id,
      name:    m.name,
      abbr:    getMoveAbbreviation(m),
      imgSrc:  getMoveImageSrc(m),
      tooltip: m.name,
      useText,
    });

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

    const src      = this.actor?.token?.texture?.src ?? this.actor?.img ?? "";
    const tokenImg = $(`<div class="mh-token-image"><img src="${src}" alt="${this.actor?.name ?? ""}"></div>`);
    const charName = $(`<div class="mh-char-name">${this.actor?.name ?? ""}</div>`);
    const closeBtn = $(`<i class="mh-close-button fa-solid fa-xmark"></i>`);

    header.append(tokenImg, charName, closeBtn);
    header.addClass("mh-custom-header");
    closeBtn.on("click", () => this.close());
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
      const state = getOrCreateState(this.actor.id);
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
      const state = getOrCreateState(this.actor.id);
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
      const state = getOrCreateState(this.actor.id);
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
      const state = getOrCreateState(this.actor.id);
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
      const state    = getOrCreateState(this.actor.id);
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
      if (status) await CityDialogs.itemEditDialog(status);
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
      const state = getOrCreateState(this.actor.id);
      if (next === "toBurn") {
        tagEl.classList.add("selected");
        state.selectedTags.add(tagId);
      } else if (next === "burned") {
        tagEl.classList.remove("selected");
        state.selectedTags.delete(tagId);
      }

      // Persist burn state to actor DB
      const tagItem = tagActor.items.get(tagId);
      if (tagItem) {
        await tagItem.update({
          "system.burned":     next === "burned",
          "system.burn_state": next === "toBurn" ? 1 : 0,
        });
      }
      this._updatePowerDisplay(html);
    });
  }

  // ── Modifier listeners ────────────────────────────────────────────────────

  _bindModifierListeners(html) {
    const state = getOrCreateState(this.actor.id);
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

  async _executeMove(moveId) {
    if (!this.actor || !moveId) return;
    const state        = getOrCreateState(this.actor.id);
    const selectedList = state.toActivatedTagFormat(this.actor);
    const options      = {
      modifier:        state.modifier,
      dynamiteAllowed: game.settings.get(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE),
    };
    try {
      await new CityRoll(moveId, this.actor, selectedList, options).execRoll();
      await this._postRollCleanup();
    } catch (e) {
      console.error("Mist HUD | Error executing roll:", e);
    }
  }

  async _postRollCleanup() {
    const state = getOrCreateState(this.actor.id);

    // Burn tags that were marked "toBurn"
    for (const id of state.selectedTags) {
      const tag = this._findTag(id);
      if (tag?.system?.burn_state === 1) {
        await tag.update({ "system.burned": true, "system.burn_state": 0 });
      }
    }

    // Delete temporary statuses that were selected
    for (const [id, stateVal] of state.statusStates) {
      if (stateVal === "neutral") continue;
      const status = this.actor.items.get(id);
      if (status?.system?.temporary) await this.actor.deleteStatus?.(id);
    }

    // Delete temporary tags
    const tempTagIds = this.actor.items.contents
      .filter(i => i.type === "tag" && i.system?.temporary)
      .map(i => i.id);
    if (tempTagIds.length) {
      await this.actor.deleteEmbeddedDocuments("Item", tempTagIds);
    }

    state.clear();
    await game.settings.set(MODULE_ID, SETTINGS.ROLL_IS_DYNAMITE, false);
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
      if (tag) await CityDialogs.itemEditDialog(tag);
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
        ui.notifications.warn("Cannot determine bonus parties");
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
      const updated = await CityHelpers.itemDialog(tag);
      if (!updated) await this.actor.deleteTag(id);
    }
  }

  async _createStatus() {
    const result = await this.actor.createNewStatus?.("New Status");
    const id     = Array.isArray(result) ? result[0]?.id : result?.id;
    if (!id) return;
    const status = this.actor.items.get(id);
    if (!status) return;
    const updated = await CityHelpers.itemDialog(status);
    if (!updated) await this.actor.deleteStatus?.(id);
  }

  async _createClue() {
    const result = await this.actor.createNewClue?.({ name: "Unnamed Clue" });
    const id     = Array.isArray(result) ? result[0]?.id : result?.id;
    if (!id) return;
    const clue = this.actor.getClue?.(id);
    if (!clue) return;
    const updated = await CityHelpers.itemDialog(clue);
    if (updated) CityHelpers.modificationLog(this.actor, "Created", clue, `${clue.system.amount}`);
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
    if (clue) CityHelpers.modificationLog(owner, "Removed", clue);
  }

  async _editClue(ev) {
    ev.preventDefault(); ev.stopPropagation();
    const ownerId = ev.currentTarget.dataset.ownerId;
    const owner   = ownerId ? game.actors.get(ownerId) : this.actor;
    const clue    = owner?.getClue?.(ev.currentTarget.dataset.clueId);
    if (clue) await CityDialogs.itemEditDialog(clue);
  }

  async _createJuice() {
    const result = await this.actor.createNewJuice?.("Unnamed Juice");
    const id     = Array.isArray(result) ? result[0]?.id : result?.id;
    if (!id) return;
    const juice = this.actor.getJuice?.(id);
    if (!juice) return;
    const updated = await CityHelpers.itemDialog(juice);
    if (updated) CityHelpers.modificationLog(this.actor, "Created", juice, `${juice.system.amount}`);
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
    if (juice) CityHelpers.modificationLog(owner, "Removed", juice);
  }

  async _editJuice(ev) {
    ev.preventDefault(); ev.stopPropagation();
    const ownerId = ev.currentTarget.dataset.ownerId;
    const owner   = ownerId ? game.actors.get(ownerId) : this.actor;
    const juice   = owner?.getJuice?.(ev.currentTarget.dataset.juiceId);
    if (!juice) return;
    const old     = { name: juice.name, amount: juice.system.amount };
    const updated = await CityDialogs.itemEditDialog(juice);
    if (updated) CityHelpers.modificationLog(owner, "Edited", juice,
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
    const content = await renderTemplate("modules/mist-hud/templates/mh-tooltip-theme.hbs", data);
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
    const state = getOrCreateState(this.actor.id);
    const power = state.previewPower();
    const str   = power > 0 ? `+${power}` : `${power}`;
    html.find(".mh-power-indicator").text(str);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _findTag(id) {
    const own = this.actor.items.get(id);
    if (own) return own;
    for (const a of game.actors) {
      if (a.type === "crew") {
        const t = a.items.get(id);
        if (t) return t;
      }
    }
    return null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async close(options) {
    $(".mh-tooltip").remove();
    if (this.actor?.id) playerHudRegistry.delete(this.actor.id);
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
  const existing = playerHudRegistry.get(actor.id);
  if (existing) return existing;
  return new PlayerHUD(actor);
}
