// move-bar.js — the card sheet's row of move buttons.
//
// Look and grouping come from the HUD (organizeMoves, the HUD's move button
// art, getMoveAbbreviation for moves without art); the click is the system
// sheet's roll path (plan § 6.1), through system-adapter.js.
// PlayerHUD._executeMove is not used.

import { getActiveSystem } from "../constants.js";
import { organizeMoves, getMoveAbbreviation, getMoveImageSrc } from "../move-layout.js";
import { getMoves, rollMove } from "./system-adapter.js";

/**
 * The card sheet has three move groups: Core, Special, SHB. Special joins
 * the HUD's "session" page (Monologue, Flashback, Downtime, Session End) and
 * its "special" page, in that order.
 */
const GROUPS = [
  { key: "core",    from: ["core"],             label: "CityOfMist.terms.coreMoves" },
  { key: "special", from: ["session", "special"], label: "MistHUD.hud.specialMoves" },
  { key: "shb",     from: ["shb"],              label: "CityOfMist.terms.shb" },
];

function _button(move) {
  const abbr = getMoveAbbreviation(move);
  // Text buttons are round: long abbreviations (MONOLOGUE) get smaller text.
  const size = abbr.length > 7 ? "xs" : abbr.length > 4 ? "s" : "";
  return { id: move.id, name: move.name, abbr, size, imgSrc: getMoveImageSrc(move) };
}

/**
 * Template context for move-bar.hbs.
 * @param {Actor}  actor
 * @param {number} groupIndex  which group is showing (wraps around)
 */
export async function prepareMoveBar(actor, groupIndex = 0) {
  const pages = organizeMoves(await getMoves(), m => actor.canUseMove?.(m) ?? true);
  const groups = GROUPS
    .map(g => ({ ...g, moves: g.from.flatMap(k => pages.find(p => p.key === k)?.moves ?? []) }))
    .filter(g => g.moves.length);
  const n = groups.length;
  const current = n ? ((groupIndex % n) + n) % n : 0;
  const label = g => game.i18n.localize(g.label);
  return {
    groups: groups.map((g, i) => ({
      key:   g.key,
      label: label(g),
      shown: i === current,
      moves: g.moves.map(_button),
    })),
    current,
    multipleGroups: n > 1,
    nextLabel: n > 1 ? label(groups[(current + 1) % n]) : "",
  };
}

/** Roll one move for this actor, the system sheet's way. */
export async function executeMove(actor, moveId) {
  return rollMove(actor, moveId, getActiveSystem());
}
