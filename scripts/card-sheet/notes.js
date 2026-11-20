// notes.js — the card sheet's notes window (user, 2026-11-19).
//
// The character's Description (system.description), clue journal (the used
// clues' questions and answers, from the system sheet's Clues tab) and, for
// the GM, the MC Notes (system.gmnotes): what the system sheet has and the
// cards have no room for (the biography is on the character card's back).
// Opened from the notes button at the right of the move bar. Each field is
// the core ProseMirror editor (toggled, as on the character card); saving
// it writes the actor. One window per actor; it follows changes made
// elsewhere (init.js, refreshCharacterNotes) unless an editor is open.

import { getActiveSystem } from "../constants.js";
import { clueJournal, isClueJournalEntry, deleteClueJournalEntry, confirmBox } from "./system-adapter.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = "modules/mist-hud/templates/card-sheet/notes.hbs";

/** The fields this window shows. */
const NOTE_FIELDS = ["system.description", "system.gmnotes"];

const windowId = actor => `mh-cs-notes-${actor.uuid.replaceAll(".", "-")}`;

export class CharacterNotes extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {Actor} actor */
  constructor(actor, options = {}) {
    super({ ...options, id: windowId(actor) });
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["mh-cs-dialog", "mh-cs-notes"],
    window: { icon: "fa-solid fa-notebook", resizable: true },
    position: { width: 520, height: 640 },
    actions: {
      deleteJournal: CharacterNotes.#onDeleteJournal,
    },
  };

  /** Delete a clue journal entry, after the system's yes / no box. */
  static async #onDeleteJournal(event, target) {
    const id = target.closest("[data-journal-id]")?.dataset.journalId;
    if (!id || !this.actor.isOwner) return;
    const ok = await confirmBox(
      game.i18n.localize("MistHUD.cardSheet.notes.deleteJournal"),
      game.i18n.localize("MistHUD.cardSheet.notes.deleteJournalBody"));
    if (ok) await deleteClueJournalEntry(this.actor, id);
  }

  static PARTS = {
    body: { template: TEMPLATE, scrollable: [".mh-cs-notes-body"] },
  };

  /** Open this actor's notes, or bring them forward. */
  static open(actor) {
    const open = foundry.applications.instances.get(windowId(actor));
    if (open?.rendered) {
      if (open.minimized) open.maximize();
      open.bringToFront();
      return open;
    }
    const app = new CharacterNotes(actor);
    app.render({ force: true });
    return app;
  }

  get title() {
    return game.i18n.format("MistHUD.cardSheet.notes.title", { name: this.actor.name });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const section = async (field, label) => {
      const raw = foundry.utils.getProperty(actor, field) ?? "";
      return {
        field,
        label: game.i18n.localize(label),
        raw,
        html: await TextEditor.enrichHTML(raw, { secrets: actor.isOwner, relativeTo: actor }),
        editable: actor.isOwner,
      };
    };
    context.description = await section("system.description", "CityOfMist.terms.description");
    // No clues in Legend and Otherscape: no clue journal (plan § 11.4).
    context.journal = getActiveSystem() !== "city-of-mist" ? null : {
      label:   game.i18n.localize("MistHUD.cardSheet.notes.clueJournal"),
      entries: clueJournal(actor),
      own:     actor.isOwner,
    };
    // MC Notes: the GM only, as on the system sheet.
    context.mcNotes = game.user.isGM ? await section("system.gmnotes", "CityOfMist.terms.mc_notes") : null;
    return context;
  }

  /** An editor saved: write its field to the actor. */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("change", event => {
      const editor = event.target.closest?.("prose-mirror[data-field]");
      if (!editor || !this.actor.isOwner) return;
      void this.actor.update({ [editor.dataset.field]: editor.value });
    });
  }

  /** Whether one of the editors is open (a re-render would drop what is typed). */
  get editing() {
    return !!this.element?.querySelector("prose-mirror[open], prose-mirror.active");
  }
}

/**
 * A clue journal entry was made, changed or deleted (a clue used, the system
 * sheet): its actor's open notes window follows.
 * @param {Item} item
 */
export function refreshNotesForItem(item) {
  if (!isClueJournalEntry(item) || !item.parent) return;
  const app = foundry.applications.instances.get(windowId(item.parent));
  if (!app?.rendered || app.editing) return;
  app.render();
}

/**
 * An actor changed: its open notes window shows the new text (not while an
 * editor of it is open).
 * @param {Actor}  actor
 * @param {object} change
 */
export function refreshCharacterNotes(actor, change) {
  if (!actor?.uuid) return;
  // The window's title has the actor's name.
  const relevant = "name" in (change ?? {}) || NOTE_FIELDS.some(f => foundry.utils.hasProperty(change ?? {}, f));
  if (!relevant) return;
  const app = foundry.applications.instances.get(windowId(actor));
  if (!app?.rendered || app.editing) return;
  app.render();
}
