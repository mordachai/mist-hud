// card-sheet-context.js — render context of the card sheet, built from getters.js.
//
// Layer 1: the character's four main themes as two-sided cards.
// Layer 2: the character card, the crew theme(s) and every extra theme.
// Read-only (edit mode is phase 3). Shared by every game; what differs per
// game (art, fonts, labels, character card fields) comes from the system's
// own terms, CHARACTER_CARD below and the per-system CSS.

import { getActiveSystem } from "../constants.js";
import {
  getThemesAndTags, getMysteryFromTheme, getThemeImprovements,
  getCrewThemes, getAllExtraThemes,
} from "../getters.js";

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
 * A crew or extra theme card: the theme lives on another actor (the crew, a
 * danger, or the character itself for its own extras).
 * @param {object} t      one entry of getCrewThemes() / getAllExtraThemes()
 * @param {object} flips  { [cardId]: true }
 * @param {Actor}  actor  the sheet's character (for the active-extra switch)
 */
function linkedThemeCard(t, flips, actor) {
  const owner = game.actors.get(t.actorId);
  const isExtra = t.category === "Extra";
  const unspent = t.unspent_upgrades || 0;
  return {
    id:              t.id,
    empty:           false,
    flipped:         !!flips[t.id],
    // Crew and extra themes use the extras art, whatever their themebook type.
    type:            isExtra ? "extra" : "crew",
    category:        t.category,
    themebook:       t.themebookLabel,
    title:           t.name,
    ownerId:         t.actorId,
    ownerName:       owner && owner.id !== actor.id ? owner.name : "",
    motivationLabel: t.prefix,
    motivation:      t.mysteryText,
    motivationEmpty: !t.mystery,
    attentionLabel:  t.attentionLabel,
    crackLabel:      t.crackLabel,
    attention:       pips(t.attention),
    crack:           pips(t.crack),
    powerTags:       (t.powerTags ?? []).map(tagView),
    weaknessTags:    (t.weaknessTags ?? []).map(tagView),
    improvements:    owner ? getThemeImprovements(owner, t.id).map(improvementView) : [],
    unspent,
    unspentLabel:    unspent > 0 ? game.i18n.format("MistHUD.cardSheet.unspentUpgrades", { count: unspent }) : "",
    extra:           isExtra ? { active: !!t.active, canActivate: !t.active && actor.isOwner } : null,
  };
}

// ── Character card ───────────────────────────────────────────────────────────

/**
 * What the character card shows, per game. City of Mist: Mythos and Logos,
 * and Help/Hurt per crewmate. Legend and Otherscape get theirs in phases 6–7
 * (the card then shows the name, player and story tags only).
 */
const CHARACTER_CARD = {
  "city-of-mist": {
    fields: [
      { key: "mythos", label: "CityOfMist.terms.mythos" },
      { key: "logos",  label: "CityOfMist.terms.logos" },
    ],
    helpHurt: true,
  },
};

/** The players who own this character (non-GM owners). */
const playerNames = actor => game.users
  .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
  .map(u => u.name)
  .join(", ");

/**
 * Help and Hurt this character holds for each crewmate: the other player
 * characters, plus anyone a Help/Hurt of theirs points at.
 */
function crewmates(actor) {
  const amount = (kind, id) => {
    try { return actor.getHelpHurtFor(kind, id) ?? 0; } catch { return 0; }
  };
  const targets = new Set(actor.items
    .filter(i => i.isJuice?.() && (i.isHelp?.() || i.isHurt?.()))
    .map(i => i.system.targetCharacterId)
    .filter(Boolean));
  return game.actors
    .filter(a => a.type === "character" && a.id !== actor.id && (a.hasPlayerOwner || targets.has(a.id)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => ({
      id:   a.id,
      name: a.name,
      help: amount("help", a.id),
      hurt: amount("hurt", a.id),
    }));
}

async function characterCard(actor, flips, storyTags) {
  const config = CHARACTER_CARD[getActiveSystem()] ?? {};
  const sys = actor.system ?? {};
  const TextEditor = foundry.applications.ux.TextEditor.implementation;
  const biography = sys.biography
    ? await TextEditor.enrichHTML(sys.biography, { secrets: actor.isOwner, relativeTo: actor })
    : "";
  return {
    id:          "character",
    character:   true,
    type:        "character",
    flipped:     !!flips.character,
    category:    "Character",
    themebook:   game.i18n.localize("MistHUD.cardSheet.characterCard"),
    title:       actor.name,
    player:      playerNames(actor),
    fields:      (config.fields ?? []).map(f => ({
      key:   f.key,
      label: game.i18n.localize(f.label),
      value: sys[f.key] ?? "",
    })),
    helpHurt:    !!config.helpHurt,
    crewmates:   config.helpHurt ? crewmates(actor) : [],
    storyTags:   storyTags.map(t => ({
      id:        t.id,
      name:      t.tagName,
      burnState: t.burnState,
      temporary: !!t.temporary,
      permanent: !!t.permanent,
    })),
    shortDescription: sys.short_description ?? "",
    biography,
  };
}

/**
 * Layer 2: the character card, then the crew theme(s), then every extra
 * theme (the active one marked).
 * @param {Actor}  actor
 * @param {object} flips  { [cardId]: true }
 * @returns {Promise<{activeSystem: string, cards: object[], owners: string[]}>}
 *   owners: ids of the other actors whose themes are shown (crew, dangers),
 *   so the sheet can re-render when they change.
 */
export async function buildLayer2Context(actor, flips = {}) {
  const { storyTags } = getThemesAndTags(actor);
  const linked = [...getCrewThemes(actor), ...getAllExtraThemes(actor)];
  const cards = [
    await characterCard(actor, flips, storyTags),
    ...linked.map(t => linkedThemeCard(t, flips, actor)),
  ];
  const owners = [...new Set(linked.map(t => t.actorId).filter(id => id && id !== actor.id))];
  return { activeSystem: getActiveSystem(), cards, owners };
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
