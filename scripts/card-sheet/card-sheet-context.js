// card-sheet-context.js — render context of the card sheet, built from getters.js.
//
// Layer 1: the character's four main themes as two-sided cards.
// Layer 2: the character card, the crew theme(s) and every extra theme.
// Edit mode (phase 3) is the system's unlocked state (`actor.system.locked`
// false). Every card says what this user may do on it: `edit` = the edit
// controls, `own` = the play controls the system sheet also shows when
// locked. Shared by every game; what differs per game (art, fonts, labels,
// character card fields) comes from the system's own terms, CHARACTER_CARD
// below and the per-system CSS.

import { getActiveSystem } from "../constants.js";
import {
  getThemesAndTags, getMysteryFromTheme, getThemeImprovements,
  getCrewThemes, getAllExtraThemes, getBuildUpImprovements,
  getRelationshipTags, applyBurnState,
} from "../getters.js";
import { gameTerms, isTagSelectable } from "./system-adapter.js";
import { getSelectionDirection } from "../hud-state.js";

/** Layer 1 always shows four slots, like the system sheet (mainFourThemes). */
const MAIN_SLOTS = 4;

const pips = track => (track ?? []).map(v => ({ filled: !!v }));

/**
 * A theme's third track (Legend: Milestone), when the game has one: its
 * pips and its name, or null.
 */
function milestoneTrack(theme) {
  let label = "";
  try { label = theme?.getThemePropertyTerm?.("milestone") ?? ""; } catch { label = ""; }
  if (!label) return null;
  return { label, pips: pips(theme.system?.milestone) };
}

/**
 * Legend and Otherscape (the Mist Engine games): the theme's first power tag
 * is its title tag (getters.js isTitle), shown in place of the title, and the
 * card is laid out as on the printed theme cards: title tag, tags and
 * weakness on the paper; tracks, quest and the theme's notes on the colour.
 */
const MIST_ENGINE = new Set(["legend", "otherscape"]);

/**
 * The tags of a theme card: the title tag (Mist Engine games) apart from the
 * other power tags, the theme's notes (system.description, an HTML field)
 * as plain text for the textarea under the quest.
 */
function mistEngineView(theme, powerTags) {
  if (!MIST_ENGINE.has(getActiveSystem())) return { mistEngine: false, powerTags };
  const titleTag = powerTags.find(t => t.isTitle) ?? null;
  return {
    mistEngine:  true,
    titleTag,
    powerTags:   titleTag ? powerTags.filter(t => t !== titleTag) : powerTags,
    hasDescription: !!theme && "description" in (theme.system ?? {}),
    description: htmlToText(theme?.system?.description ?? ""),
  };
}

/** An HTML field as plain text (paragraphs and line breaks as new lines). */
export function htmlToText(html) {
  const value = String(html ?? "");
  if (!/[<&]/.test(value)) return value;
  // DOMParser: an inert document (no image loads, no handlers run).
  const doc = new DOMParser().parseFromString(
    value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*/gi, "\n"), "text/html");
  return (doc.body?.textContent ?? "").replace(/\n+$/, "");
}

/** Plain text (a textarea) back to an HTML field: one paragraph per line. */
export function textToHtml(text) {
  const value = String(text ?? "").replace(/\s+$/, "");
  if (!value) return "";
  return value.split("\n").map(line => `<p>${foundry.utils.escapeHTML(line)}</p>`).join("");
}

/**
 * The card type (the type class that picks the art in the per-system CSS) of
 * a crew theme, per game: the Legend crew theme is the Fellowship.
 */
const CREW_TYPE = { legend: "fellowship" };

/** Edit mode: the system's unlocked state. */
export const isEditMode = actor => !actor?.system?.locked;

/**
 * What this user may do on a card whose data belongs to `owner` (the
 * character, a crew, a danger): `own` = the play controls (attention +,
 * burn, send an improvement to chat…), `edit` = the edit controls too.
 */
function permissions(actor, owner) {
  const own = !!owner?.isOwner;
  return { own, edit: own && isEditMode(actor) };
}

/**
 * One tag. `burnAction`: "burn" (an unburned power tag), "unburn" (a burned
 * one), or null (weakness tags, or no ownership). The system sheet shows
 * burning in play mode only; the card sheet shows it in both.
 */
function tagView(t, owner, perms) {
  const doc = owner?.items.get(t.id);
  let burnAction = null;
  if (perms.own && doc) {
    if (t.burnState !== "unburned") burnAction = "unburn";
    else if (doc.isBurnable) burnAction = "burn";
  }
  const burnLabel = burnAction === "burn"
    ? game.i18n.format("MistHUD.cardSheet.burnTitle", { name: t.tagName })
    : burnAction === "unburn" ? game.i18n.localize("MistHUD.cardSheet.unburnTitle") : "";
  return {
    id:        t.id,
    name:      t.tagName,
    burnState: t.burnState,
    burned:    t.burnState === "burned",
    depth:     t.depth ?? 0,
    isTitle:   !!t.isTitle,
    crispy:    !!t.crispy,
    burnAction,
    burnLabel,
    edit:      perms.edit,
    ...selectionView(doc, perms.edit),
  };
}

/**
 * How a tag is selected for the next roll (play mode, plan § 6.1): the
 * system's selection, in this client. Anyone who sees the card may select
 * (as on the system sheet: a crew theme's tags belong to the crew actor).
 * Burned tags (any burn_state) can't be selected, as on the system sheet.
 * Also used for the deck's statuses and story tags (tags-deck.js).
 */
export function selectionView(doc, edit) {
  const selectable = !edit && isTagSelectable(doc);
  const direction = doc ? getSelectionDirection(doc) : 0;
  return {
    selectable,
    noSelect:  !edit && !!doc && !selectable,
    selection: direction > 0 ? "positive" : direction < 0 ? "negative" : "",
    selectionLabel: direction > 0 ? game.i18n.localize("MistHUD.cardSheet.selectedPositive")
      : direction < 0 ? game.i18n.localize("MistHUD.cardSheet.selectedNegative") : "",
  };
}

/**
 * One improvement. In edit mode its name opens the edit dialog and it can be
 * deleted; in play mode (owner) its name posts it to chat, as on the system
 * sheet.
 */
function improvementView(imp, perms) {
  const uses = imp.uses ?? {};
  return {
    id:          imp.id,
    name:        imp.name,
    choice:      imp.choiceItem,
    description: imp.description,
    uses:        uses.max > 0 ? `${uses.current ?? 0}/${uses.max}` : "",
    expended:    !!uses.expended,
    edit:        perms.edit,
    send:        perms.own && !perms.edit,
  };
}

/**
 * Theme-level controls (main and linked themes): the theme type toggle, the
 * themebook / theme kit edit buttons, fade reset, adding tags and
 * improvements. Like the system sheet, new power tags and improvements are
 * offered whenever there are unspent upgrades, locked or not; weakness and
 * bonus tags only in edit mode.
 */
function themeControls(actor, theme, perms, unspent, crack) {
  const tbOrKit = theme?.getThemebookOrTK?.() ?? null;
  const isKit = !!tbOrKit?.isThemeKit?.();
  let customThemebook = false;
  try { customThemebook = !!theme?.hasCustomThemebook?.(); } catch { customThemebook = false; }
  let typeToggle = false;
  try { typeToggle = !!tbOrKit?.canHaveVariableThemeType?.(); } catch { typeToggle = false; }
  return {
    ...perms,
    typeToggle:        perms.edit && typeToggle,
    // A player character's theme kit: the MC only (CitySheet._editThemeKit).
    editKit:           perms.edit && isKit && (game.user.isGM || !actor.isPC?.()),
    editThemebook:     perms.edit && customThemebook,
    canResetFade:      perms.edit && unspent > 0 && (crack ?? []).some(Boolean),
    canAddPower:       perms.own && unspent > 0,
    canAddImprovement: perms.own && unspent > 0,
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
  const perms = permissions(actor, actor);
  // A themebook without a type (custom ones): the type the system gives the
  // theme (CityItem.getThemeType), as its own sheet does.
  let category = t.category;
  if (!category || /^(default|unknown)$/i.test(category)) {
    try { category = theme?.getThemeType?.() || category; } catch { /* keep it */ }
  }
  return {
    id:              t.id,
    empty:           false,
    ownerId:         actor.id,
    ...themeControls(actor, theme, perms, unspent, info.crack),
    topRow:          perms.edit,
    flipped:         !!flips[t.id],
    // Picks the background art in the per-system CSS (mythos, logos, mist…)
    type:            String(category ?? "default").toLowerCase(),
    category,
    themebook:       t.themebookLabel,
    title:           t.themeName,
    motivationLabel: info.prefix,
    motivation:      motivation || info.mysteryText,
    motivationRaw:   motivation,
    motivationEmpty: !motivation,
    attentionLabel:  info.attentionLabel,
    crackLabel:      info.crackLabel,
    attention:       pips(info.attention),
    crack:           pips(info.crack),
    milestone:       milestoneTrack(theme),
    ...mistEngineView(theme, (t.powerTags ?? []).map(tag => tagView(tag, actor, perms))),
    weaknessTags:    (t.weaknessTags ?? []).map(tag => tagView(tag, actor, perms)),
    improvements:    getThemeImprovements(actor, t.id).map(imp => improvementView(imp, perms)),
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
  const perms = permissions(actor, owner);
  const theme = owner?.items.get(t.id);
  const canOpenOwner = !!owner && owner.id !== actor.id && owner.testUserPermission(game.user, "OBSERVER");
  return {
    id:              t.id,
    empty:           false,
    ...themeControls(actor, theme, perms, unspent, t.crack),
    flipped:         !!flips[t.id],
    // Crew and extra themes use the extras art, whatever their themebook type.
    type:            isExtra ? "extra" : CREW_TYPE[getActiveSystem()] ?? "crew",
    category:        t.category,
    themebook:       t.themebookLabel,
    title:           t.name,
    ownerId:         t.actorId,
    ownerName:       owner && owner.id !== actor.id ? owner.name : "",
    // The Legend Fellowship (its actor is named like the theme), or a crew
    // named like its theme: the name once, as the title; the open-sheet
    // button keeps only its icon (the name in its tooltip).
    ownerSame:       !!owner && ((!isExtra && getActiveSystem() === "legend")
      || owner.name.trim().toLowerCase() === String(t.name ?? "").trim().toLowerCase()),
    // The crew's / danger's own sheet (CityCharacterSheet.openOwnerSheet).
    canOpenOwner,
    // The row under the band: the extra's state, the owner's sheet, the edit controls.
    topRow:          isExtra || canOpenOwner || perms.edit,
    motivationLabel: t.prefix,
    motivation:      t.mysteryText,
    motivationRaw:   t.mystery ?? "",
    motivationEmpty: !t.mystery,
    attentionLabel:  t.attentionLabel,
    crackLabel:      t.crackLabel,
    attention:       pips(t.attention),
    crack:           pips(t.crack),
    milestone:       milestoneTrack(theme),
    ...mistEngineView(theme, (t.powerTags ?? []).map(tag => tagView(tag, owner, perms))),
    weaknessTags:    (t.weaknessTags ?? []).map(tag => tagView(tag, owner, perms)),
    improvements:    owner ? getThemeImprovements(owner, t.id).map(imp => improvementView(imp, perms)) : [],
    unspent,
    unspentLabel:    unspent > 0 ? game.i18n.format("MistHUD.cardSheet.unspentUpgrades", { count: unspent }) : "",
    extra:           isExtra ? { active: !!t.active, canActivate: !t.active && actor.isOwner } : null,
  };
}

// ── Character card ───────────────────────────────────────────────────────────

/**
 * What the character card shows, per game. City of Mist: Mythos and Logos,
 * Help/Hurt per crewmate, story tags; the build-up track on the back.
 * Legend (phase 6): the Hero card of docs/character_card-hero_card.png:
 * name, player, the Fellowship relationships (companion | relationship
 * tag), Promise (the system's build-up track) and the Quintessences (the
 * improvements bought with it), all on the front; story tags only in the
 * deck. Otherscape gets its own in phase 7 (until then: name, player and
 * story tags).
 */
const CHARACTER_CARD = {
  "city-of-mist": {
    fields: [
      { key: "mythos", label: "CityOfMist.terms.mythos" },
      { key: "logos",  label: "CityOfMist.terms.logos" },
    ],
    helpHurt: true,
    // The build-up track and the improvements bought with it (system.buildup, unspentBU).
    buildUp: true,
  },
  legend: {
    label: "MistHUD.cardSheet.heroCard",
    fields: [],
    storyTags: false,
    relationships: true,
    // The build-up track on the front, as Promise and Quintessences.
    promise: true,
  },
};

/** The players who own this character (non-GM owners). */
const playerNames = actor => game.users
  .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
  .map(u => u.name)
  .join(", ");

/**
 * Help and Hurt this character holds, one line per crewmate a Help or Hurt
 * of theirs points at (the "+" next to the Crew title adds one; fixes
 * 2026-11-19). A Help / Hurt with no target yet gets a "?" line.
 */
function crewmates(actor) {
  const juice = actor.items.filter(i => i.type === "juice"
    && (i.system?.subtype === "help" || i.system?.subtype === "hurt"));
  const amount = (kind, id) => juice
    .filter(i => i.system.subtype === kind && (i.system.targetCharacterId ?? "") === id)
    .reduce((sum, i) => sum + (Number(i.system.amount) || 0), 0);
  const ids = [...new Set(juice.map(i => i.system.targetCharacterId ?? ""))];
  return ids
    .map(id => ({
      id,
      name: game.actors.get(id)?.name ?? "?",
      help: amount("help", id),
      hurt: amount("hurt", id),
    }))
    .sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || a.name.localeCompare(b.name));
}

/** The build-up track, its unspent improvements and the improvements bought with it. */
function buildUpView(actor, perms) {
  const sys = actor.system ?? {};
  const terms = gameTerms();
  const unspent = Number(sys.unspentBU) || 0;
  return {
    label:             terms.buildUpPoints,
    improvementsLabel: terms.evolution,
    pips:              pips(sys.buildup),
    unspent,
    unspentLabel:      unspent > 0 ? game.i18n.format("MistHUD.cardSheet.unspentBuildUp", { count: unspent }) : "",
    canAdd:            perms.own && unspent > 0,
    improvements:      getBuildUpImprovements(actor).map(imp => improvementView(imp, perms)),
  };
}

/**
 * The Fellowship relationships (Legend), one row per companion: the
 * relationship tags (subtype "relationship"; the companion is the module
 * flag RELATIONSHIP_TARGET, as in the HUD), then the other player
 * characters with no tag yet (an empty row; "+" makes their tag).
 */
function relationshipsView(actor, perms, newTag) {
  const { tags, openSlots } = getRelationshipTags(actor);
  const rows = tags.map(t => ({
    id:         t.id,
    name:       t.tagName,
    burnState:  t.burnState,
    targetId:   t.targetId ?? "",
    targetName: t.targetName || "?",
    isNew:      !!newTag && t.id === newTag,
    edit:       perms.edit,
    ...selectionView(actor.items.get(t.id), perms.edit),
  }));
  const open = openSlots.map(a => ({ targetId: a.id, targetName: a.name }));
  // The companions a row may name (edit mode): the other player characters,
  // plus anyone a tag already names.
  const companions = game.actors
    .filter(a => a.type === "character" && a.id !== actor.id
      && (a.hasPlayerOwner || rows.some(r => r.targetId === a.id)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => ({ id: a.id, name: a.name }));
  for (const row of rows) {
    row.companions = companions.map(c => ({ ...c, selected: c.id === row.targetId }));
  }
  return { rows, open };
}

async function characterCard(actor, flips, storyTags, newStoryTag) {
  const config = CHARACTER_CARD[getActiveSystem()] ?? {};
  const sys = actor.system ?? {};
  const perms = permissions(actor, actor);
  const TextEditor = foundry.applications.ux.TextEditor.implementation;
  const biography = sys.biography
    ? await TextEditor.enrichHTML(sys.biography, { secrets: actor.isOwner, relativeTo: actor })
    : "";
  return {
    id:          "character",
    character:   true,
    ownerId:     actor.id,
    ...perms,
    type:        "character",
    flipped:     !!flips.character,
    category:    "Character",
    themebook:   game.i18n.localize(config.label ?? "MistHUD.cardSheet.characterCard"),
    title:       actor.name,
    player:      playerNames(actor),
    fields:      (config.fields ?? []).map(f => ({
      key:   f.key,
      label: game.i18n.localize(f.label),
      value: sys[f.key] ?? "",
    })),
    helpHurt:    !!config.helpHurt,
    crewmates:   config.helpHurt ? crewmates(actor) : [],
    showStoryTags: config.storyTags !== false,
    relationships: config.relationships ? relationshipsView(actor, perms, newStoryTag) : null,
    // Story tags: "+" for the owner (both modes; the new tag's name is a
    // field here), edit and delete in edit mode, as on the theme cards.
    storyTags:   storyTags.map(t => ({
      id:        t.id,
      name:      t.tagName,
      burnState: t.burnState,
      temporary: !!t.temporary,
      permanent: !!t.permanent,
      isNew:     !!newStoryTag && t.id === newStoryTag,
      edit:      perms.edit,
      ...selectionView(actor.items.get(t.id), perms.edit),
    })),
    shortDescription: sys.short_description ?? "",
    biography,
    biographyText: htmlToText(sys.biography ?? ""),
    buildUp:     config.buildUp ? buildUpView(actor, perms) : null,
    promise:     config.promise ? {
      ...buildUpView(actor, perms),
      // The Hero card names them Quintessences (the system: Moments of Fulfillment).
      improvementsLabel: game.i18n.localize("MistHUD.cardSheet.quintessences"),
    } : null,
  };
}

// ── Backpack (Legend) ────────────────────────────────────────────────────────

/** The games with a backpack card: the system's loadout theme (actor.loadout). */
const BACKPACK = { legend: { label: "Legend.terms.loadoutTheme.name" } };

/**
 * The backpack card (Legend, phase 6): the loadout theme's tags, each with
 * its weakness tags under it. A loadout tag is carried (activated) or left
 * at home. Null in games without one.
 * @param {Actor} actor
 */
export function buildBackpackContext(actor) {
  const config = BACKPACK[getActiveSystem()];
  if (!config || !actor) return null;
  const theme = actor.loadout ?? null;
  const perms = permissions(actor, actor);
  const view = (tag, depth) => {
    const base = applyBurnState(actor, tag.id, tag.system?.subtype ?? "loadout");
    return {
      ...tagView({ ...base, depth }, actor, perms),
      weakness: tag.system?.subtype === "weakness",
      carried:  !!tag.system?.activated_loadout,
    };
  };
  const all = theme?.tags?.() ?? [];
  const sorted = list => [...list].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  // The carried tags first (user, 2026-11-20): the first rows peek out
  // above the cards while the backpack is tucked away.
  const tags = sorted(all.filter(t => !t.system?.parentId)).map(tag => ({
    ...view(tag, 0),
    weaknesses: sorted(all.filter(t => t.system?.parentId === tag.id)).map(w => view(w, 1)),
  })).sort((a, b) => Number(b.carried) - Number(a.carried));
  let label = game.i18n.localize(config.label);
  if (label === config.label) label = game.i18n.localize("MistHUD.cardSheet.backpack");
  return {
    id:       "backpack",
    themeId:  theme?.id ?? "",
    ownerId:  actor.id,
    ...perms,
    exists:   !!theme,
    type:     "backpack",
    label,
    tags,
  };
}

/**
 * Layer 2: the character card, then the crew theme(s), then every extra
 * theme (the active one marked).
 * @param {Actor}  actor
 * @param {object} flips  { [cardId]: true }
 * @param {object} [options]
 * @param {string} [options.newStoryTag]  a story tag just made from the character card (its name is a field)
 * @returns {Promise<{activeSystem: string, cards: object[], owners: string[]}>}
 *   owners: ids of the other actors whose themes are shown (crew, dangers),
 *   so the sheet can re-render when they change.
 */
export async function buildLayer2Context(actor, flips = {}, { newStoryTag = null } = {}) {
  // newStoryTag: a story tag, or (Legend) a relationship tag, just made on
  // the character card (its name is a field).
  const { storyTags } = getThemesAndTags(actor);
  const linked = [...getCrewThemes(actor), ...getAllExtraThemes(actor)];
  const cards = [
    await characterCard(actor, flips, storyTags, newStoryTag),
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
  // An empty slot adds a theme (the system sheet offers it locked or not).
  const canAdd = !!actor.isOwner;
  while (cards.length < MAIN_SLOTS) cards.push({ id: `empty-${cards.length}`, empty: true, canAdd });
  return { activeSystem: getActiveSystem(), cards };
}
