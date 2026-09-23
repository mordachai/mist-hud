// getters.js — Actor data extraction for the player HUD template context
// Kept slim: uses system actor methods where possible.

// ── Tag burn state ────────────────────────────────────────────────────────────

export function applyBurnState(actor, tagId, tagType = "power") {
  const tag = actor?.items.get(tagId);
  if (!tag?.system) return _unknownTag(tagId, tagType);

  const burnState = tag.system.burned       ? "burned"
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

  const system   = game.settings.get("city-of-mist", "system");
  const category = realThemebook.system?.subtype || "unknown";
  const { prefix, attentionLabel, crackLabel } = _systemLabels(system, category);

  return {
    themeName:      theme.name,
    themebook_name: system === "city-of-mist" ? realThemebook.name : theme.name,
    category,
    prefix,
    mysteryText:    theme.system.mystery || "No mystery defined.",
    attention:      theme.system.attention ?? [],
    crack:          theme.system.crack ?? [],
    attentionLabel,
    crackLabel,
    themeInfo: {
      locale_name: realThemebook.system?.locale_name
        ? game.i18n.localize(realThemebook.system.locale_name.replace(/^#/, "")) : "",
    },
    activeSystem: system,
  };
}

function _noThemeData(themeName) {
  return { themeName, themebook_name: "Unknown", category: "unknown",
           prefix: "Theme", mysteryText: "No mystery defined.",
           attention: [], crack: [], attentionLabel: "Attention", crackLabel: "Crack" };
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
  if (!actor) return { themes: [], storyTags: [], crewThemes: [] };
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
    if (!tb) { console.warn(`Missing themebook for ${theme.name}`); return null; }

    return {
      id:                   theme.id,
      themeName:            theme.name,
      category:             tb.system?.subtype || "Default",
      iconClass:            `mh-theme-icon ${tb.system?.subtype || "Default"}`,
      powerTags:            getPowerTags(theme.id, tagItems, subTagsByParent, actor),
      weaknessTags:         getWeaknessTags(theme.id, tagItems, subTagsByParent, actor),
      localizedThemebookName: tb.name,
      unspent_upgrades:     theme.system.unspent_upgrades || 0,
    };
  }).filter(Boolean);

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

  return { themes, storyTags, crewThemes: getCrewThemes(actor) };
}

// ── Crew themes ───────────────────────────────────────────────────────────────

export function getCrewThemes(actor) {
  if (!actor) return [];
  const nonGMOwners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
  const crews = game.actors.filter(a =>
    a.type === "crew" && nonGMOwners.some(u => a.testUserPermission(u, "OWNER"))
  );
  const system = game.settings.get("city-of-mist", "system");

  return crews.flatMap(crew =>
    crew.items.filter(i => i.type === "theme").map(theme => {
      const tags          = crew.items.filter(i => i.type === "tag");
      const subByParent   = tags.reduce((a, t) => {
        if (t.system.parentId) (a[t.system.parentId] ??= []).push(t); return a;
      }, {});
      let tb = theme.themebook;
      if (tb?.isThemeKit?.()) tb = tb.themebook;

      const { attentionLabel, crackLabel, prefix } = _systemLabels(
        system, tb?.system?.subtype ?? ""
      );

      return {
        id:                   theme.id,
        name:                 theme.name,
        crewName:             crew.name,
        actorId:              crew.id,
        powerTags:            getPowerTags(theme.id, tags, subByParent, crew),
        weaknessTags:         getWeaknessTags(theme.id, tags, subByParent, crew),
        mystery:              theme.system.mystery || "",
        mysteryText:          theme.system.mystery || "No mystery defined.",
        attention:            theme.system.attention ?? [],
        crack:                theme.system.crack ?? [],
        category:             "Crew",
        unspent_upgrades:     theme.system.unspent_upgrades || 0,
        localizedThemebookName: tb?.name ?? theme.name,
        prefix, attentionLabel, crackLabel,
        activeSystem:         system,
      };
    })
  );
}

// ── Power / weakness tags ────────────────────────────────────────────────────

export function getPowerTags(themeId, tagItems, subTagsByParent, actor) {
  return tagItems
    .filter(t => t.system.theme_id === themeId && t.system.subtype === "power")
    .map(tag => {
      const d = applyBurnState(actor, tag.id);
      const subtags = (subTagsByParent[tag.id] ?? []).map(sub => applyBurnState(actor, sub.id));
      return { ...d, tagName: tag.name, crispy: !!tag.system.crispy, actorId: actor.id,
               themeId: tag.system.theme_id, subtags };
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
  return _groupImprovements(actor.items.contents, themeMap);
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
      themebookName: useActorNameForThemebook ? actor.name : tb.name,
      themeType:     tb.system.subtype || "Unknown",
    };
    return acc;
  }, {});
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
      name:        item.name,
      description: item.system.description || "",
      effect_class: item.system.effect_class || null,
      theme_id:    item.system.theme_id || null,
      choiceItem:  item.system.choice_item || null,
      uses:        item.system.uses || { max: 0, current: 0, expended: false },
    });
  }
  return grouped;
}

// ── Juice & Clues (City of Mist) ─────────────────────────────────────────────

export function getJuiceAndClues(actor) {
  if (!actor) return { helpItems: [], hurtItems: [], clueItems: [], juiceItems: [] };
  const items        = actor.items.contents;
  const activeBonuses = actor.getFlag("mist-hud", "active-bonuses") || {};

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
          active: activeBonuses.help?.[t.id] || false } : null; })
    .filter(Boolean);

  const hurtItems = items
    .filter(i => i.type === "juice" && i.system?.subtype === "hurt")
    .map(i => { const t = resolve(i.system.targetCharacterId); return t
      ? { id: i.id, actorId: actor.id, amount: i.system.amount, target: t,
          active: activeBonuses.hurt?.[t.id] || false } : null; })
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

export function getEssence(themes) {
  const counts = { Self: 0, Noise: 0, Mythos: 0, Logos: 0, Mist: 0 };
  for (const theme of themes.filter(t => t.name !== "__LOADOUT__")) {
    let tb = theme.themebook;
    if (tb?.isThemeKit?.()) tb = tb.themebook;
    const cat = tb?.system?.subtype;
    if (cat && cat in counts) counts[cat]++;
  }
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
