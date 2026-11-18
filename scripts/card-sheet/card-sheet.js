// card-sheet.js — MistCardSheet, the alternative character sheet (docs/card-sheet-plan.md).
//
// ApplicationV2 actor sheet registered next to the system's sheet (init.js),
// picked per actor in the Sheet selector. The system stays the source of
// truth: reads go through getters.js, writes through document methods, and
// anything else through system-adapter.js.
//
// Phase 0: move bar + raw data dump + "Open system sheet" header button.

import { buildDumpContext } from "./card-sheet-context.js";
import { prepareMoveBar, executeMove } from "./move-bar.js";
import { openSystemSheet, systemSheetFlips } from "./system-adapter.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export const CARD_SHEET_TEMPLATES = [
  "modules/mist-hud/templates/card-sheet/move-bar.hbs",
  "modules/mist-hud/templates/card-sheet/card-sheet.hbs",
];

export class MistCardSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mh-card-sheet"],
    position: { width: 900, height: 760 },
    window: { resizable: true },
    actions: {
      rollMove:        MistCardSheet.#onRollMove,
      nextMoveGroup:   MistCardSheet.#onNextMoveGroup,
      openSystemSheet: MistCardSheet.#onOpenSystemSheet,
    },
  };

  static PARTS = {
    moves: { template: CARD_SHEET_TEMPLATES[0] },
    body:  { template: CARD_SHEET_TEMPLATES[1], scrollable: [".mh-cs-dump"] },
  };

  // ── What the system expects of `actor.sheet` ────────────────────────────────
  // The system treats `actor.sheet` as its own V1 sheet in two places:
  //  - CityDB / CityHelpers refresh a character's sheet when its crew or
  //    extra changes, only if `actor.sheet._state > 0` (V1 render state);
  //  - the setFlipped template helper reads `actor.sheet.flipped[n]`.

  get _state() {
    return this.state;
  }

  get flipped() {
    return systemSheetFlips(this.actor);
  }

  /** Which move group the chevron is showing (client UI state, kept across renders). */
  #moveGroup = 0;
  #rolling = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.moveBar = await prepareMoveBar(this.actor, this.#moveGroup);
    this.#moveGroup = context.moveBar.current;
    Object.assign(context, buildDumpContext(this.actor));
    return context;
  }

  /** Header button: "Open system sheet", for actions the card sheet does not have yet. */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    if (this.document.isOwner || game.user.isGM) {
      const label = game.i18n.localize("MistHUD.cardSheet.openSystemSheet");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "header-control icon fa-solid fa-book-open mh-cs-open-system";
      button.dataset.action = "openSystemSheet";
      button.dataset.tooltip = label;
      button.setAttribute("aria-label", label);
      const close = frame.querySelector('.window-header [data-action="close"]');
      if (close) close.before(button);
      else frame.querySelector(".window-header")?.append(button);
    }
    return frame;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  static async #onRollMove(event, target) {
    const moveId = target.dataset.moveId;
    if (!moveId || this.#rolling) return;
    this.#rolling = true;
    try {
      await executeMove(this.actor, moveId);
    } finally {
      this.#rolling = false;
      // The system clears its selection without a hook; show the empty selection.
      if (this.rendered) this.render({ parts: ["body"] });
    }
  }

  static #onNextMoveGroup() {
    this.#moveGroup += 1;
    this.render({ parts: ["moves"] });
  }

  static #onOpenSystemSheet() {
    openSystemSheet(this.actor);
  }
}

/** Re-render open card sheets when the system's tag/status selection changes. */
export function refreshCardSheets() {
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof MistCardSheet && app.rendered) app.render({ parts: ["body"] });
  }
}
