// getters.js — Actor data extraction for the player HUD template context
import { getActiveSystem, MODULE_ID, FLAG_KEYS } from "./constants.js";
import { isTagBurned } from "./hud-state.js";
// Kept slim: uses system actor methods where possible.

// ── Tag burn state ────────────────────────────────────────────────────────────

export function applyBurnState(actor, tagId, tagType = "power") {
  const tag = actor?.items.get(tagId);
  if (!tag?.system) return _unknownTag(tagId, tagType);

  // Three HUD states, using the system's own definition of "burned"
  // (burned && burn_state != 0, see CityItem.isBurned):
  //   burned   → burned:true,  burn_state != 0
  //   toBurn   → burned:false, burn_state 1   (HUD marker: burn on next roll)
  //   unburned → burned:false, burn_state 0
  const burnState = isTagBurned(tag)           ? "burned"
                  : tag.system.burn_state === 1 ? "toBurn"
                  : "unburned";

  return {
    id:            tagId,
    tagName:       tag.name || `Unnamed ${tagType} Tag`,
    burnState,
    cssClass:      burnState,
    permanent:     tag.system.permanent  || false,
    temporary:     tag.system.temporary  || false,
    crispy:        tag.system.crispy     || false,
    isInverted:    tag.system.isInverted || false,
    inversionIcon: tag.system.isInverted
      ? '<i class="fa-regular fa-angles-up"></i>'
      : '<i class="fa-light fa-angles-down"></i>',
  };
}

function _unknownTag(id, type) {
  return {
    id, tagName: `Unknown ${type} Tag`, burnState: "unburned", cssClass: "unburned",
    permanent: false, temporary: false, crispy: false, isInverted: false,
    inversionIcon: '<i class="fa-light fa-angles-down"></i>',
  };
}

// ── Theme tooltip data ────────────────────────────────────────────────────────

export function getMysteryFromTheme(actor, themeId) {
  if (!actor) return _noThemeData("No actor");
  const theme = actor.items.contents.find(i => i.type === "theme" && i.id === themeId);
  if (!theme) return _noThemeData("Unknown Theme");

  let realThemebook = theme.themebook;
  if (realThemebook?.isThemeKit?.()) realThemebook = realThemebook.themebook;
  if (!realThemebook) return _noThemeData(theme.name);

  const system   = getActiveSystem();
  const category = realThemebook.system?.subtype || "unknown";
  const { prefix, attentionLabel, crackLabel } = _systemLabels(system, category);

  return {
    themeName:      theme.name,
    themebook_name: system === "city-of-mist" ? realThemebook.name : theme.name,
    category,
    prefix,
    mysteryText:    theme.system.mystery || _noMotivationText(prefix),
    attention:      theme.system.attention ?? [],
    crack:          theme.system.crack ?? [],
    attentionLabel,
    crackLabel,
    ..._trackExtras(theme),
    themeInfo: {
      locale_name: realThemebook.system?.locale_name
        ? game.i18n.localize(realThemebook.system.locale_name.replace(/^#/, "")) : "",
    },
    activeSystem: system,
  };
}

/** Ids + optional third track (Legend milestone) so the tooltip can edit the tracks. */
function _trackExtras(theme) {
  let milestoneLabel = "";
  try { milestoneLabel = theme.getThemePropertyTerm?.("milestone") ?? ""; } catch { /* none */ }
  return {
    themeId:        theme.id,
    ownerId:        theme.parent?.id,
    milestone:      theme.system.milestone ?? [],
    milestoneLabel,
    useMilestone:   milestoneLabel.length > 0,
    unspent:        theme.system.unspent_upgrades || 0,
    canReset:       (theme.system.unspent_upgrades || 0) > 0
                    && (theme.system.crack ?? []).some(Boolean),
  };
}

function _noThemeData(themeName) {
  return { themeName, themebook_name: "Unknown", category: "unknown",
           prefix: "Theme", mysteryText: _noMotivationText(),
           attention: [], crack: [], attentionLabel: "Attention", crackLabel: "Crack" };
}

/** Empty-state text for a theme's motivation, named by the system's own term
 *  (Mystery / Identity / Ritual / Itch / Quest...). */
function _noMotivationText(term) {
  if (!term || term === "Theme") return game.i18n.localize("MistHUD.tooltip.noMotivation");
  return game.i18n.format("MistHUD.tooltip.noMotivationTerm", { term: term.toLocaleLowerCase() });
}

function _systemLabels(system, category) {
  const loc = key => game.i18n.localize(key);
  const labelMap = {
    "city-of-mist": {
      Mythos: loc("CityOfMist.terms.mystery"), Logos: loc("CityOfMist.terms.identity"),
      Mist: loc("CityOfMist.terms.directive"), Extra: loc("CityOfMist.terms.extra"),
      Crew: loc("CityOfMist.terms.crewTheme"),
      attentionKey: "CityOfMist.terms.attention",
      crackKey: (category === "Mythos") ? "CityOfMist.terms.fade" : "CityOfMist.terms.crack",
    },
    "otherscape": {
      Mythos: loc("Otherscape.terms.ritual"), Self: loc("CityOfMist.terms.identity"),
      Noise: loc("Otherscape.terms.itch"), Loadout: loc("Otherscape.terms.loadout"),
      attentionKey: "Otherscape.terms.upgrade", crackKey: "Otherscape.terms.decay",
    },
    "legend": {
      default: loc("Legend.terms.quest"),
      attentionKey: "Legend.terms.improve", crackKey: "Legend.terms.abandon",
    },
  };
  const map = labelMap[system] ?? {};
  const prefix = map[category] ?? map.default ?? "Theme";
  return {
    prefix,
    attentionLabel: map.attentionKey ? loc(map.attentionKey) : "Attention",
    crackLabel:     map.crackKey     ? loc(map.crackKey)     : "Crack",
  };
}

// ── Themes + tags ────────────────────────────────────────────────────────────

export function getThemesAndTags(actor) {
  if (!actor) return { themes: [], storyTags: [], crewThemes: [], extraThemes: [] };
  const items     = actor.items.contents;
  const themeItems = items.filter(i => i.type === "theme" && i.name !== "__LOADOUT__");
  const tagItems   = items.filter(i => i.type === "tag");

  const subTagsByParent = tagItems.reduce((acc, t) => {
    if (t.system.parentId) {
      (acc[t.system.parentId] ??= []).push(t);
    }
    return acc;
  }, {});

  const themes = themeItems.map(theme => {
    let tb = theme.themebook;
    if (tb?.isThemeKit?.()) tb = tb.themebook;
    // Themebook can be missing (e.g. Legend themes); fall back to theme's own data so tags still show.
    if (!tb) console.warn(`Missing themebook for ${theme.name}, using theme data`);
    const category = tb?.system?.subtype || theme.system.subtype || "Default";

    return {
      id:                   theme.id,
      themeName:            theme.name,
      category,
      iconClass:            `mh-theme-icon ${category}`,
      powerTags:            getPowerTags(theme.id, tagItems, subTagsByParent, actor),
      weaknessTags:         getWeaknessTags(theme.id, tagItems, subTagsByParent, actor),
      localizedThemebookName: tb?.name || theme.system.themebook_name || theme.name,
      // One label: the system's themebook name already equals its locale_name,
      // so printing both doubled the title (COMPANIONCOMPANION).
      themebookLabel: (tb?.system?.locale_name
          ? game.i18n.localize(tb.system.locale_name.replace(/^#/, "")) : "")
        || tb?.name || theme.system.themebook_name || theme.name,
      themeInfo: {
        locale_name: tb?.system?.locale_name
          ? game.i18n.localize(tb.system.locale_name.replace(/^#/, "")) : "",
      },
      unspent_upgrades:     theme.system.unspent_upgrades || 0,
    };
  });

  const storyTags = tagItems
    .filter(t => t.system.subtype === "story")
    .map(tag => {
      if (!tag?.id) return null;
      const d = applyBurnState(actor, tag.id, "story");
      d.actorId     = actor.id;
      d.themeId     = tag.system.theme_id;
      d.temporary   = !!tag.system.temporary;
      d.permanent   = !!tag.system.permanent;
      d.isInverted  = tag.system.inverted || false;
      d.inversionIcon = d.isInverted
        ? '<i class="fa-light fa-angles-up"></i>'
        : '<i class="fa-light fa-angles-down"></i>';
      return d;
    }).filter(Boolean);

  return { themes, storyTags, crewThemes: getCrewThemes(actor), extraThemes: getExtraThemes(actor) };
}

// ── Crew themes ───────────────────────────────────────────────────────────────

export function getCrewThemes(actor) {
  if (!actor) return [];
  const nonGMOwners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
  const crews = game.actors.filter(a =>
    a.type === "crew" && nonGMOwners.some(u => a.testUserPermission(u, "OWNER"))
  );
  return crews.flatMap(crew =>
    crew.items.filter(i => i.type === "theme").map(theme => _linkedThemeData(theme, crew, "Crew"))
  );
}

/** The character's active extra theme (a danger's theme lent to the PC; the
 *  system's `activeExtra`), as a one-item list, or empty. Its tags live on
 *  the danger, like crew tags live on the crew. */
export function getExtraThemes(actor) {
  const theme = actor?.activeExtra;
  if (!theme?.parent) return [];
  return [_linkedThemeData(theme, theme.parent, "Extra")];
}

/** HUD data for a theme that belongs to another actor (crew or extra). */
function _linkedThemeData(theme, owner, category) {
  const system = getActiveSystem();
  const tags        = owner.items.filter(i => i.type === "tag");
  const subByParent = tags.reduce((a, t) => {
    if (t.system.parentId) (a[t.system.parentId] ??= []).push(t); return a;
  }, {});
  let tb = theme.themebook;
  if (tb?.isThemeKit?.()) tb = tb.themebook;

  const { attentionLabel, crackLabel, prefix } = _systemLabels(
    system, tb?.system?.subtype ?? ""
  );

  // Otherscape extras show their own theme's icon (Mythos / Self / Noise; the
  // HUD CSS draws a plain circle for any other); elsewhere the Extra icon.
  const themeCategory = tb?.system?.subtype || theme.system.subtype || "";
  const iconClass = (category === "Extra" && system === "otherscape")
    ? `mh-theme-icon Extra ${themeCategory}`.trim()
    : `mh-theme-icon ${category}`;

  return {
    id:                   theme.id,
    name:                 theme.name,
    iconClass,
    crewName:             owner.name,
    actorId:              owner.id,
    themeType:            category.toLowerCase(),
    powerTags:            getPowerTags(theme.id, tags, subByParent, owner),
    weaknessTags:         getWeaknessTags(theme.id, tags, subByParent, owner),
    mystery:              theme.system.mystery || "",
    mysteryText:          theme.system.mystery || _noMotivationText(prefix),
    attention:            theme.system.attention ?? [],
    crack:                theme.system.crack ?? [],
    category,
    unspent_upgrades:     theme.system.unspent_upgrades || 0,
    localizedThemebookName: tb?.name ?? theme.name,
    prefix, attentionLabel, crackLabel,
    ..._trackExtras(theme),
    activeSystem:         system,
  };
}

// ── Power / weakness tags ────────────────────────────────────────────────────

export function getPowerTags(themeId, tagItems, subTagsByParent, actor) {
  let tags = tagItems.filter(t => t.system.theme_id === themeId && t.system.subtype === "power");

  // Otherscape / Legend: the theme's first power tag (question "A") is its
  // title tag. Use the system's own ordering so the HUD matches the sheet.
  const usesTitleTag = ["otherscape", "legend"].includes(getActiveSystem());
  let titleId = null;
  if (usesTitleTag) {
    const theme = actor.items.get(themeId);
    try {
      const ordered = theme?.powerTags;
      if (Array.isArray(ordered) && ordered.length) {
        const rank = new Map(ordered.map((t, i) => [t.id, i]));
        tags = [...tags].sort((a, b) => (rank.get(a.id) ?? 1e6) - (rank.get(b.id) ?? 1e6));
      }
      titleId = theme?.headerTag?.[0]?.id ?? tags[0]?.id ?? null;
    } catch { titleId = tags[0]?.id ?? null; }
  }

  // Subtags are power tags of the same theme with a parentId: list each one
  // right under its parent, indented by depth, as the sheet does (and only
  // once: they used to be printed again inside the parent's row).
  const ids = new Set(tags.map(t => t.id));
  const childrenOf = new Map();
  for (const t of tags) {
    const parent = ids.has(t.system.parentId) ? t.system.parentId : null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(t);
  }
  const ordered = [];
  const seen = new Set();
  const visit = (parent, depth) => {
    for (const t of childrenOf.get(parent) ?? []) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      ordered.push({ tag: t, depth });
      visit(t.id, depth + 1);
    }
  };
  visit(null, 0);
  // Anything left (a parent cycle) still shows, at the top level
  for (const t of tags) if (!seen.has(t.id)) ordered.push({ tag: t, depth: 0 });

  return ordered.map(({ tag, depth }) => {
    const d = applyBurnState(actor, tag.id);
    return { ...d, tagName: tag.name, crispy: !!tag.system.crispy, actorId: actor.id,
             themeId: tag.system.theme_id, depth, isTitle: tag.id === titleId };
  });
}

export function getWeaknessTags(themeId, tagItems, subTagsByParent, actor) {
  return tagItems
    .filter(t => t.system.theme_id === themeId && t.system.subtype === "weakness")
    .map(tag => {
      const d = applyBurnState(actor, tag.id, "weakness");
      return { ...d, tagName: tag.name, actorId: actor.id, themeId: tag.system.theme_id };
    });
}

// ── Loadout tags ─────────────────────────────────────────────────────────────

export function getLoadoutTags(actor) {
  if (!actor) return [];
  return actor.items.contents
    .filter(i => i.type === "tag" && i.system.subtype === "loadout" && i.system.activated_loadout)
    .map(tag => {
      const d = applyBurnState(actor, tag.id);
      return { ...d, id: tag.id, tagName: tag.name, actorId: actor.id, themeId: tag.system.theme_id };
    });
}

/**
 * Weakness tags of the loadout theme (Otherscape / Legend: at most one per
 * loadout tag, linked by system.parentId). Includes `parentId` so the HUD can
 * nest each one under its loadout tag.
 */
export function getLoadoutWeaknessTags(actor) {
  if (!actor) return [];
  const loadoutIds = new Set(actor.items.contents
    .filter(i => i.type === "theme" && i.name === "__LOADOUT__")
    .map(i => i.id));
  if (!loadoutIds.size) return [];
  const tagItems = actor.items.contents
    .filter(i => i.type === "tag" && loadoutIds.has(i.system.theme_id))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return [...loadoutIds].flatMap(id => getWeaknessTags(id, tagItems, null, actor))
    .map(w => ({ ...w, parentId: actor.items.get(w.id)?.system.parentId || null }));
}

/**
 * Every loadout tag (active or not), for the loadout activation popup. Same
 * shape as getLoadoutTags (burn state included) plus `active`.
 */
export function getAllLoadoutTags(actor) {
  if (!actor) return [];
  return actor.items.contents
    .filter(i => i.type === "tag" && i.system.subtype === "loadout")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map(tag => ({
      ...applyBurnState(actor, tag.id),
      id: tag.id, tagName: tag.name, active: !!tag.system.activated_loadout,
    }));
}

// ── Relationship tags (Otherscape crew relationships / Legend fellowship) ────
// The system's relationship tag (subtype "relationship") has a name only. Who
// the relationship is with is kept in a module flag on the tag item.

function _portraitOf(actor) {
  return actor.prototypeToken?.texture?.src ?? actor.img ?? "";
}

/**
 * @returns {{tags: object[], openSlots: {id: string, name: string, img: string}[]}}
 *   tags: the actor's relationship tags; openSlots: the other player characters
 *   this actor has no relationship tag with yet.
 */
export function getRelationshipTags(actor) {
  if (!actor) return { tags: [], openSlots: [] };

  const tags = actor.items.contents
    .filter(i => i.type === "tag" && i.system.subtype === "relationship")
    .map(tag => {
      const target = game.actors.get(tag.getFlag(MODULE_ID, FLAG_KEYS.RELATIONSHIP_TARGET));
      return {
        ...applyBurnState(actor, tag.id, "relationship"),
        actorId:    actor.id,
        targetId:   target?.id ?? null,
        targetName: target?.name ?? "",
      };
    });

  const taken = new Set(tags.map(t => t.targetId).filter(Boolean));
  const openSlots = game.actors
    .filter(a => a.type === "character" && a.hasPlayerOwner && a.id !== actor.id && !taken.has(a.id))
    .map(a => ({ id: a.id, name: a.name, img: _portraitOf(a) }));

  return { tags, openSlots };
}

// ── Statuses ──────────────────────────────────────────────────────────────────

export function getActorStatuses(actor) {
  if (!actor) return [];
  return actor.items.contents
    .filter(i => i.type === "status")
    .map(s => ({
      actorId:   actor.id,
      id:        s.id,
      name:      s.name,
      tier:      s.system.tier,
      temporary: !!s.system.temporary,
      permanent: !!s.system.permanent,
    }));
}

// ── Improvements ─────────────────────────────────────────────────────────────

export function getImprovements(actor) {
  if (!actor) return [];
  const themeMap = _buildThemeMap(actor.items.contents, actor);
  return Object.values(_groupImprovements(actor.items.contents, themeMap));
}

export function getCrewImprovements(actor) {
  if (!actor) return [];
  const nonGMOwners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
  const crews = game.actors.filter(a =>
    a.type === "crew" && nonGMOwners.some(u => a.testUserPermission(u, "OWNER"))
  );
  const grouped = {};
  for (const crew of crews) {
    const themeMap = _buildThemeMap(crew.items.contents, crew, true);
    _groupImprovements(crew.items.contents, themeMap, grouped);
  }
  return Object.values(grouped);
}

function _buildThemeMap(items, actor, useActorNameForThemebook = false) {
  return items.filter(i => i.type === "theme").reduce((acc, theme) => {
    let tb = theme.themebook;
    if (tb?.isThemeKit?.()) tb = tb.themebook;
    if (!tb) return acc;
    acc[theme.id] = {
      id: theme.id,
      themebookName: useActorNameForThemebook ? actor.name : _loc(tb.name),
      themeType:     tb.system.subtype || "Unknown",
    };
    return acc;
  }, {});
}

/** Compendium text is stored as "#Some.lang.key"; localize those, leave plain text alone. */
function _loc(text) {
  if (typeof text !== "string" || !text.startsWith("#")) return text;
  const key = text.slice(1);
  return game.i18n.has(key) ? game.i18n.localize(key) : text;
}

function _groupImprovements(items, themeMap, grouped = {}) {
  for (const item of items.filter(i => i.type === "improvement" && themeMap[i.system.theme_id])) {
    const theme = themeMap[item.system.theme_id];
    const key   = theme.themebookName;
    if (!grouped[key]) {
      grouped[key] = { themebookName: key, themeType: theme.themeType, improvements: [] };
    }
    grouped[key].improvements.push({
      id:          item.id,
      name:        _loc(item.name),
      description: _loc(item.system.description) || "",
      effect_class: item.system.effect_class || null,
      theme_id:    item.system.theme_id || null,
      choiceItem:  _loc(item.system.choice_item) || null,
      uses:        item.system.uses || { max: 0, current: 0, expended: false },
    });
  }
  return grouped;
}

// ── Juice & Clues (City of Mist) ─────────────────────────────────────────────

export function getJuiceAndClues(actor) {
  if (!actor) return { helpItems: [], hurtItems: [], clueItems: [], juiceItems: [] };
  const items        = actor.items.contents;
  // A help/hurt checkbox is "on" when the target currently holds a bonus from
  // this actor. The target's GM-written `received-bonuses` flag is the single
  // source of truth, so the state survives re-renders and clears with the roll.
  const givenTo = (targetId, type) =>
    game.actors.get(targetId)?.getFlag("mist-hud", "received-bonuses")?.[actor.id]?.type === type;

  const resolve = (id) => {
    const a = game.actors.get(id);
    return a ? { name: a.name, id: a.id,
                 tokenImage: a.token?.texture.src ?? a.prototypeToken?.texture.src ?? a.img }
             : null;
  };

  const helpItems = items
    .filter(i => i.type === "juice" && i.system?.subtype === "help")
    .map(i => { const t = resolve(i.system.targetCharacterId); return t
      ? { id: i.id, actorId: actor.id, amount: i.system.amount, target: t,
          active: givenTo(t.id, "help") } : null; })
    .filter(Boolean);

  const hurtItems = items
    .filter(i => i.type === "juice" && i.system?.subtype === "hurt")
    .map(i => { const t = resolve(i.system.targetCharacterId); return t
      ? { id: i.id, actorId: actor.id, amount: i.system.amount, target: t,
          active: givenTo(t.id, "hurt") } : null; })
    .filter(Boolean);

  const clueItems = items
    .filter(i => i.type === "clue")
    .map(i => ({ id: i.id, actorId: actor.id, name: i.name,
                 amount: i.system.amount || 0, partial: !!i.system.partial,
                 source: i.system.source || "", method: i.system.method || "" }));

  const juiceItems = items
    .filter(i => i.type === "juice" && !["help","hurt"].includes(i.system?.subtype))
    .map(i => ({ id: i.id, actorId: actor.id, name: i.name,
                 amount: i.system.amount || 0, source: i.system.source || "",
                 method: i.system.method || "" }));

  return { helpItems, hurtItems, clueItems, juiceItems };
}

// ── Essence (Otherscape) ──────────────────────────────────────────────────────

/** Counts themes per themebook category (Self/Noise/Mythos/Logos/Mist). */
export function getThemeTypeCounts(themes) {
  const counts = { Self: 0, Noise: 0, Mythos: 0, Logos: 0, Mist: 0 };
  for (const theme of themes.filter(t => t.name !== "__LOADOUT__")) {
    let tb = theme.themebook;
    if (tb?.isThemeKit?.()) tb = tb.themebook;
    const cat = tb?.system?.subtype;
    if (cat && cat in counts) counts[cat]++;
  }
  return counts;
}

export function getEssence(themes) {
  const counts = getThemeTypeCounts(themes);
  const { Self, Noise, Mythos } = counts;
  const total = Self + Noise + Mythos;

  let imageName = "blank.svg";
  if (total === 4) {
    const s = [];
    if (Self > 0)   s.push(`${Self}S`);
    if (Mythos > 0) s.push(`${Mythos}M`);
    if (Noise > 0)  s.push(`${Noise}N`);
    imageName = s.join("") + ".svg";
  } else if (counts.Logos > 0 || counts.Mist > 0 || Mythos > 0) {
    imageName = "com.webp";
  }

  if (Self > 0 && Noise > 0 && Mythos > 0) return { essence: "Nexus",           className: "nexus",           imageName };
  if (Self > 0 && Mythos > 0)               return { essence: "Spiritualist",    className: "spiritualist",    imageName };
  if (Self > 0 && Noise > 0)                return { essence: "Cyborg",          className: "cyborg",          imageName };
  if (Mythos > 0 && Noise > 0)              return { essence: "Transhuman",      className: "transhuman",      imageName };
  if (Self > 0)                             return { essence: "Real",            className: "real",            imageName };
  if (Mythos > 0)                           return { essence: "Avatar/Conduit",  className: "avatar-conduit",  imageName };
  if (Noise > 0)                            return { essence: "Singularity",     className: "singularity",     imageName };
  return { essence: "Undefined", className: "undefined", imageName };
}
