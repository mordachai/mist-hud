// move-bar.js — the card sheet's row of move buttons.
//
// Look and grouping are the HUD's (organizeMoves, getMoveAbbreviation, the
// group chevron); the click is the system sheet's roll path (plan § 6.1),
// through system-adapter.js. PlayerHUD._executeMove is not used.

import { getActiveSystem } from "../constants.js";
import { organizeMoves, getMoveAbbreviation } from "../move-layout.js";
import { getMoves, rollMove } from "./system-adapter.js";

const GROUP_LABELS = {
  core:    "CityOfMist.terms.coreMoves",
  session: "MistHUD.hud.moveGroup.session",
  special: "MistHUD.hud.specialMoves",
  shb:     "CityOfMist.terms.shb",
};

/**
 * Template context for move-bar.hbs.
 * @param {Actor}  actor
 * @param {number} groupIndex  which group is showing (wraps around)
 */
export async function prepareMoveBar(actor, groupIndex = 0) {
  const groups = organizeMoves(await getMoves(), m => actor.canUseMove?.(m) ?? true);
  const current = groups.length ? ((groupIndex % groups.length) + groups.length) % groups.length : 0;
  const label = g => game.i18n.localize(GROUP_LABELS[g.key] ?? g.key);
  return {
    groups: groups.map((g, i) => ({
      key:   g.key,
      label: label(g),
      shown: i === current,
      moves: g.moves.map(m => {
        const abbr = getMoveAbbreviation(m);
        // Round buttons: long abbreviations (MONOLOGUE, SESSIONEND) get smaller text.
        const size = abbr.length > 7 ? "xs" : abbr.length > 4 ? "s" : "";
        return { id: m.id, name: m.name, abbr, size };
      }),
    })),
    current,
    multipleGroups: groups.length > 1,
    nextLabel: groups.length > 1 ? label(groups[(current + 1) % groups.length]) : "",
  };
}

/** Roll one move for this actor, the system sheet's way. */
export async function executeMove(actor, moveId) {
  return rollMove(actor, moveId, getActiveSystem());
}
