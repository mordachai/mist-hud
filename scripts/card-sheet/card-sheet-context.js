// card-sheet-context.js — render context of the card sheet, built from getters.js.
//
// Phase 1: layer 1, the character's four main themes as two-sided cards
// (read-only). Shared by every game; what differs per game (art, fonts,
// labels) comes from the system's own terms and the per-system CSS.

import { getActiveSystem } from "../constants.js";
import { getThemesAndTags, getMysteryFromTheme, getThemeImprovements } from "../getters.js";

/** Layer 1 always shows four slots, like the system sheet (mainFourThemes). */
const MAIN_SLOTS = 4;

const pips = track => (track ?? []).map(v => ({ filled: !!v }));

const tagView = t => ({
  id:        t.id,
  name:      t.tagName,
  burnState: t.burnState,
  burned:    t.burnState === "burned",
  depth:     t.depth ?? 0,
  isTitle:   !!t.isTitle,
  crispy:    !!t.crispy,
});

function improvementView(imp) {
  const uses = imp.uses ?? {};
  return {
    id:          imp.id,
    name:        imp.name,
    choice:      imp.choiceItem,
    description: imp.description,
    uses:        uses.max > 0 ? `${uses.current ?? 0}/${uses.max}` : "",
    expended:    !!uses.expended,
  };
}

/**
 * One theme card (front and back faces).
 * @param {Actor}  actor
 * @param {object} t      one entry of getThemesAndTags().themes
 * @param {object} flips  { [cardId]: true } for the cards showing their back
 */
function themeCard(actor, t, flips) {
  const info = getMysteryFromTheme(actor, t.id);
  const theme = actor.items.get(t.id);
  const motivation = theme?.system?.mystery ?? "";
  const unspent = t.unspent_upgrades || 0;
  return {
    id:              t.id,
    empty:           false,
    flipped:         !!flips[t.id],
    // Picks the background art in the per-system CSS (mythos, logos, mist…)
    type:            String(t.category ?? "default").toLowerCase(),
    category:        t.category,
    themebook:       t.themebookLabel,
    title:           t.themeName,
    motivationLabel: info.prefix,
    motivation:      motivation || info.mysteryText,
    motivationEmpty: !motivation,
    attentionLabel:  info.attentionLabel,
    crackLabel:      info.crackLabel,
    attention:       pips(info.attention),
    crack:           pips(info.crack),
    powerTags:       (t.powerTags ?? []).map(tagView),
    weaknessTags:    (t.weaknessTags ?? []).map(tagView),
    improvements:    getThemeImprovements(actor, t.id).map(improvementView),
    unspent,
    unspentLabel:    unspent > 0 ? game.i18n.format("MistHUD.cardSheet.unspentUpgrades", { count: unspent }) : "",
  };
}

/**
 * Layer 1: the four main themes in the system's order (actor.mainThemes:
 * sorted by theme type, without extras or the loadout), padded with empty
 * slots.
 * @param {Actor}  actor
 * @param {object} flips  { [cardId]: true }
 */
export function buildLayer1Context(actor, flips = {}) {
  const { themes } = getThemesAndTags(actor);
  const byId = new Map(themes.map(t => [t.id, t]));
  const order = actor.mainThemes?.map(th => th.id) ?? themes.map(t => t.id);
  const cards = order
    .filter(id => byId.has(id))
    .slice(0, MAIN_SLOTS)
    .map(id => themeCard(actor, byId.get(id), flips));
  while (cards.length < MAIN_SLOTS) cards.push({ id: `empty-${cards.length}`, empty: true });
  return { activeSystem: getActiveSystem(), cards };
}
