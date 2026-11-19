// character-actions.js — the character card's Help and Hurt (fixes
// 2026-11-19, phase 1).
//
// Help and Hurt are the system's juice items (subtype "help" / "hurt",
// system.targetCharacterId); they left the tags-deck and live on the
// character card, one line per crewmate they point at:
//   - "+" next to the Crew title: pick Help or Hurt and the crewmate; an
//     existing Help (Hurt) for that crewmate gains one point, else a new one
//     is made (actor.createNewJuice, as CityActorSheet._createHelp);
//   - each number is a field: the crewmate's Help (Hurt) is set to it (one
//     item; extra items for the same crewmate are merged into it);
//   - edit mode: a trash at the end of the line deletes that crewmate's
//     Help and Hurt (actor.deleteJuice), after the system's confirmation.
// Logged as the system sheet does ("Created", "Edited", "Removed").
//
// Story tags are created on the character card with the deck's own action
// (createDeckItem, data-origin="character"), and deleted with the theme
// cards' deleteTag: the same items as the deck's story tags.

import { once } from "./edit-actions.js";
import { confirmBox, logModification } from "./system-adapter.js";

const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

const KINDS = ["help", "hurt"];

/** The system's base names for a new Help / Hurt (CityActorSheet._createHelp / _createHurt). */
const BASE_NAME = { help: "Help", hurt: "hurt" };

/** This actor's Help (Hurt) items pointing at `targetId` ("" = no target yet). */
export function helpHurtItems(actor, kind, targetId) {
  return actor.items.filter(i => i.type === "juice" && i.system?.subtype === kind
    && (i.system.targetCharacterId ?? "") === (targetId ?? ""));
}

/** The actor, if this user may change it; warns otherwise. */
function ownedActor(sheet) {
  if (!sheet.actor?.isOwner) {
    ui.notifications.warn(L("MistHUD.cardSheet.notOwner"));
    return null;
  }
  return sheet.actor;
}

/**
 * The characters a Help / Hurt may point at: the other player characters,
 * plus anyone this character already has a Help or Hurt for.
 */
function helpTargets(actor) {
  const current = new Set(actor.items
    .filter(i => i.type === "juice" && KINDS.includes(i.system?.subtype))
    .map(i => i.system.targetCharacterId)
    .filter(Boolean));
  return game.actors
    .filter(a => a.type === "character" && a.id !== actor.id && (a.hasPlayerOwner || current.has(a.id)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => ({ id: a.id, name: a.name }));
}

/**
 * Pick Help or Hurt, then the crewmate.
 * @returns {Promise<{kind: "help"|"hurt", targetId: string}|null>}
 */
async function chooseHelpHurt(actor) {
  const targets = helpTargets(actor);
  if (!targets.length) {
    ui.notifications.warn(L("MistHUD.cardSheet.helpHurt.noCrewmates"));
    return null;
  }
  const esc = s => foundry.utils.escapeHTML?.(s) ?? Handlebars.escapeExpression(s);
  const kinds = KINDS.map((k, i) => `<label class="mh-cs-choice"><input type="radio" name="kind" value="${k}"${i === 0 ? " checked" : ""}> ${esc(L(`CityOfMist.terms.${k}`))}</label>`).join("");
  const options = targets.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const content = `
    <fieldset class="mh-cs-choices"><legend>${esc(L("MistHUD.cardSheet.helpHurt.which"))}</legend>${kinds}</fieldset>
    <label class="mh-cs-choice-select">${esc(L("MistHUD.cardSheet.helpHurt.crewmate"))}
      <select name="target">${options}</select>
    </label>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window:  { title: L("MistHUD.cardSheet.helpHurt.addTitle") },
    classes: ["mh-cs-dialog"],
    content,
    buttons: [
      {
        action: "ok", label: L("MistHUD.cardSheet.helpHurt.add"), icon: "fa-solid fa-plus", default: true,
        callback: (_event, button) => ({
          kind:     button.form.elements.kind.value,
          targetId: button.form.elements.target.value,
        }),
      },
      { action: "cancel", label: L("Cancel"), icon: "fa-solid fa-xmark" },
    ],
    rejectClose: false,
  });
  if (!result || typeof result !== "object") return null;
  if (!KINDS.includes(result.kind) || !result.targetId) return null;
  return result;
}

/**
 * Set this actor's Help (Hurt) for a crewmate: one item holds the amount,
 * extra items for the same crewmate are merged into it (deleted).
 */
async function setHelpHurt(actor, kind, targetId, amount) {
  const items = helpHurtItems(actor, kind, targetId);
  const n = Math.max(0, Math.trunc(Number(amount) || 0));
  if (!items.length) {
    if (!n) return;
    const created = await actor.createNewJuice(BASE_NAME[kind], kind);
    const juice = actor.items.get(created?.id);
    if (!juice) return;
    await juice.update({ "system.amount": n, "system.targetCharacterId": targetId });
    await logModification(actor, "Created", juice, `${n}`);
    return;
  }
  const [first, ...rest] = items;
  const before = items.reduce((sum, i) => sum + (Number(i.system.amount) || 0), 0);
  if (n === before && !rest.length) return;
  if ((Number(first.system.amount) || 0) !== n) await first.update({ "system.amount": n });
  for (const extra of rest) await actor.deleteJuice(extra.id);
  await logModification(actor, "Edited", first, `${first.name} (${before}) edited --> ${first.name} (${n})`);
}

/** The Crew title's "+": pick Help or Hurt and the crewmate, then one point more. */
async function addHelpHurt() {
  const actor = ownedActor(this);
  if (!actor) return;
  await once(this, async () => {
    const choice = await chooseHelpHurt(actor);
    if (!choice) return;
    const current = helpHurtItems(actor, choice.kind, choice.targetId)
      .reduce((sum, i) => sum + (Number(i.system.amount) || 0), 0);
    await setHelpHurt(actor, choice.kind, choice.targetId, current + 1);
  });
}

/** Edit mode: the line's trash deletes that crewmate's Help and Hurt (right click: no question). */
async function deleteHelpHurt(event, target) {
  const actor = ownedActor(this);
  if (!actor) return;
  const line = target.closest("[data-actor-id]");
  const targetId = line?.dataset.actorId ?? "";
  const items = KINDS.flatMap(kind => helpHurtItems(actor, kind, targetId));
  if (!items.length) return;
  const name = game.actors.get(targetId)?.name ?? "?";
  await once(this, async () => {
    if (event.button !== 2 && !await confirmBox(L("MistHUD.cardSheet.helpHurt.deleteTitle"),
      L("MistHUD.cardSheet.helpHurt.confirmDelete", { name }))) return;
    for (const juice of items) {
      await actor.deleteJuice(juice.id);
      await logModification(actor, "Removed", juice);
    }
  });
}

/**
 * A Help / Hurt number changed (Enter or leaving the field): that
 * crewmate's Help (Hurt) is set to it.
 * @param {MistCardSheet} sheet
 * @param {HTMLInputElement} input  data-edit="helpHurt", data-kind
 */
export async function changeHelpHurt(sheet, input) {
  const actor = sheet.actor;
  const kind = input.dataset.kind;
  const targetId = input.closest("[data-actor-id]")?.dataset.actorId ?? "";
  if (!actor?.isOwner || !KINDS.includes(kind)) return;
  const raw = String(input.value ?? "").trim();
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n) || n < 0) {
    input.value = input.defaultValue;
    return;
  }
  await once(sheet, () => setHelpHurt(actor, kind, targetId, n));
}

/** For MistCardSheet.DEFAULT_OPTIONS.actions. */
export const CHARACTER_ACTIONS = {
  addHelpHurt,
  // Right-click deletes without the question, like the other deletes.
  deleteHelpHurt: { handler: deleteHelpHurt, buttons: [0, 2] },
};
