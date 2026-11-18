// card-sheet-context.js — render context of the card sheet, built from getters.js.
//
// Phase 0: a raw dump of what the cards will show (themes, crew, extras,
// statuses, story tags, juice, clues) plus the system's current selection,
// so the data paths and the roll selection can be checked before any card
// is drawn.

import { getActiveSystem } from "../constants.js";
import {
  getThemesAndTags, getCrewThemes, getExtraThemes, getActorStatuses, getJuiceAndClues,
} from "../getters.js";
import { getSystemSelection } from "./system-adapter.js";

const tagNames = tags => (tags ?? []).map(t => `${t.tagName}${t.burnState !== "unburned" ? ` [${t.burnState}]` : ""}`);

const theme = t => ({
  id: t.id,
  name: t.themeName ?? t.name,
  themebook: t.localizedThemebookName,
  category: t.category,
  owner: t.crewName,
  power: tagNames(t.powerTags),
  weakness: tagNames(t.weaknessTags),
  unspent_upgrades: t.unspent_upgrades,
});

/**
 * @param {Actor} actor
 * @returns {{activeSystem: string, locked: boolean, sections: object[]}}
 */
export function buildDumpContext(actor) {
  const { themes, storyTags } = getThemesAndTags(actor);
  const crew   = getCrewThemes(actor);
  const extras = getExtraThemes(actor);
  const { helpItems, hurtItems, clueItems, juiceItems } = getJuiceAndClues(actor);

  const section = (key, rows) => ({
    key,
    label: game.i18n.localize(`MistHUD.cardSheet.dump.${key}`),
    count: rows.length,
    json:  JSON.stringify(rows, null, 2),
  });

  return {
    activeSystem: getActiveSystem(),
    locked: !!actor.system.locked,
    sections: [
      section("themes", themes.map(theme)),
      section("crew", crew.map(theme)),
      section("extras", extras.map(theme)),
      section("statuses", getActorStatuses(actor).map(s => ({ id: s.id, name: s.name, tier: s.tier }))),
      section("storyTags", storyTags.map(t => ({ id: t.id, name: t.tagName, burnState: t.burnState }))),
      section("juice", juiceItems.map(j => ({ id: j.id, name: j.name, amount: j.amount }))),
      section("helpHurt", [
        ...helpItems.map(h => ({ type: "help", target: h.target.name, amount: h.amount })),
        ...hurtItems.map(h => ({ type: "hurt", target: h.target.name, amount: h.amount })),
      ]),
      section("clues", clueItems.map(c => ({ id: c.id, name: c.name, amount: c.amount, partial: c.partial }))),
      section("selection", getSystemSelection().map(r => ({
        name: r.name, type: r.type, amount: r.amount, owner: game.actors.get(r.ownerId)?.name ?? r.ownerId,
      }))),
    ],
  };
}
