// npc-helpers.js — Handlebars helpers and utility functions for the NPC HUD.
// These helpers are registered during the Foundry init hook.

let _registered = false;

/**
 * Register all NPC HUD Handlebars helpers.
 * Safe to call multiple times; only registers once.
 */
export function registerNpcHelpers() {
  if (_registered) return;
  _registered = true;

  Handlebars.registerHelper("ifEquals", function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  Handlebars.registerHelper("parseMaxTier", function (maxTier) {
    return maxTier === 999 ? "-" : maxTier;
  });

  // Converts status descriptions with embedded status/tag patterns into
  // clickable HTML spans that can be dragged onto tokens.
  Handlebars.registerHelper("parseStatus", function (description, options) {
    const root = options.data.root;
    return new Handlebars.SafeString(parseMoveText(description, {
      collectiveSize: root.collectiveSize,
      name:           root.name,
      pronouns:       root.pronouns,
      move:           options.hash?.move,
      marked:         !!options.hash?.marked,
    }));
  });
}

/**
 * Convert the move-text notation ([tag], [status-2], |status-2|, {GM only},
 * $name, ...) into HUD HTML. Shared by the parseStatus helper and the
 * Legend Might lines.
 *
 * @param {string} description
 * @param {object} [ctx]
 * @param {number}   [ctx.collectiveSize]  added to bracket status tiers
 * @param {string}   [ctx.name]            replaces $name
 * @param {string[]} [ctx.pronouns]        replace $pr0..$pr2
 * @param {object}   [ctx.move]            GM move, to prefix its header
 * @param {boolean}  [ctx.marked]          the template already draws a marker
 * @returns {string} HTML
 */
export function parseMoveText(description, ctx = {}) {
    if (!description) return "";

    const collectiveSize = Number(ctx.collectiveSize || 0);
    const characterName  = ctx.name || "Character";
    const pronouns       = ctx.pronouns || [];

    // Header prefix chosen by the system ("symbols" / "text" / "none"), added
    // before substitution so the "$name" in the text headers is resolved too.
    const header = moveHeaderPrefix(ctx.move, { skipSymbol: !!ctx.marked });

    let out = (header + description)
      .replace(/\$name/g, characterName)
      .replace(/\$pr([0-2])\b/gi, (match, i) => pronouns[Number(i)] ?? "");

    // Builds a draggable status span from "name-N", "name N" or "name-X".
    // Returns null when the text is not a status.
    const statusSpan = (text, { addCollective = false, sceneTag = false, temporary = false, permanent = false, autoApply = false } = {}) => {
      const m = text.trim().match(/^(\p{L}[\p{L}\d\s'-]*?)[-\s](\d+|X)$/u);
      if (!m) return null;
      const name = m[1].trim().replace(/\s+/g, "-");
      const tier = m[2] === "X" ? "X" : parseInt(m[2], 10) + (addCollective ? collectiveSize : 0);
      const id   = foundry.utils.randomID();
      const cls  = `npc-status-moves${sceneTag ? " scene-tag" : ""}${autoApply ? " auto-status" : ""}`;
      return `<span class="${cls}" data-status-name="${name}" data-tier="${tier}" data-status-id="${id}" data-temporary="${temporary}" data-permanent="${permanent}" data-scene-tag="${sceneTag}" data-auto-apply="${autoApply}">${name}-${tier}</span>`;
    };

    // Pattern: "text (gain StatusName-N)"
    out = out.replace(/([^(]+)\(gain ([^)]+)\)/g, (match, before, statusText) => {
      const action   = before.trim();
      if (statusText.includes('class="npc-status-moves"')) return match;
      const m = statusText.trim().match(/^([A-zÀ-ú-\s]+)-(\d+)$/);
      if (!m) return match;
      const name      = m[1].trim();
      const finalTier = parseInt(m[2], 10) + collectiveSize;
      const id        = foundry.utils.randomID();
      return `${action} (gain <span class="npc-status-moves" data-status-name="${name}" data-tier="${finalTier}" data-status-id="${id}" data-temporary="false" data-permanent="false" data-scene-tag="false">${name}-${finalTier}</span>)`;
    });

    // Pattern: "text (data-status-... attributes)"
    out = out.replace(/([^(]+)\(([^)]*data-status-[^)]+)\)/g, (match, before, inside) => {
      if (inside.includes('class="npc-status-moves"')) return match; // built by the pattern above
      const action    = before.trim();
      const name      = (inside.match(/data-status-name="([^"]+)"/i) || [])[1];
      if (!name) return match;
      const tier      = parseInt((inside.match(/data-tier="([^"]+)"/i)      || [])[1] || "1");
      const id        = (inside.match(/data-status-id="([^"]+)"/i)          || [])[1] || foundry.utils.randomID();
      const temporary = (inside.match(/data-temporary="([^"]+)"/i)          || [])[1] === "true";
      const permanent = (inside.match(/data-permanent="([^"]+)"/i)          || [])[1] === "true";
      const sceneTag  = (inside.match(/data-scene-tag="([^"]+)"/i)          || [])[1] === "true";
      const finalTier = tier + (sceneTag ? 0 : collectiveSize);
      return `${action} (<span class="npc-status-moves" data-status-name="${name}" data-tier="${finalTier}" data-status-id="${id}" data-temporary="${temporary}" data-permanent="${permanent}" data-scene-tag="${sceneTag}">${name}-${finalTier}</span>)`;
    });

    // Bracket syntax: [tag], [status-2], [limit:3], with optional modifier
    // prefix (i = ignore collective size, s = scene tag, t = temporary,
    // p = permanent), e.g. [t:burning-2] or [s,p:on fire].
    out = out.replace(/\[([^\]]+)\]/g, (match, content) => {
      let body = content.trim();
      let ignoreCollective = false, sceneTag = false, temporary = false, permanent = false, autoApply = false;

      const mod = body.match(/^([a-z](?:\s*,\s*[a-z])*)\s*:/i);
      if (mod) {
        const flags = mod[1].toLowerCase().split(",").map(f => f.trim());
        // Only treat the prefix as modifiers when every letter is a known one,
        // so a single-letter limit name such as [x:3] is left alone.
        if (flags.every(f => "istpa".includes(f))) {
          ignoreCollective = flags.includes("i");
          sceneTag         = flags.includes("s");
          temporary        = flags.includes("t");
          permanent        = flags.includes("p");
          autoApply        = flags.includes("a");
          body = body.substring(mod[0].length).trim();
        }
      }

      // 1. Contains ":" → limit
      if (body.includes(":")) {
        return `<span class="npc-limit-moves">${body.replace(/:\s*/g, ": ")}</span>`;
      }

      // 2. Ends in "-N", " N" or "-X" → status
      const status = statusSpan(body, { addCollective: !ignoreCollective, sceneTag, temporary, permanent, autoApply });
      if (status) return status;

      // 3. Anything else → story tag
      return `<span class="npc-story-tag-moves${sceneTag ? " scene-tag" : ""}" data-temporary="${temporary}" data-permanent="${permanent}" data-scene-tag="${sceneTag}">${body}</span>`;
    });

    // System pipe syntax: ||status-2|| (auto-apply) and |status-2|.
    // Runs on text nodes only, so attributes of the spans built above are safe.
    out = out.replace(/(<[^>]*>)|\|\|([^|<>]+)\|\||\|([^|<>]+)\|/g, (match, tag, auto, plain) => {
      if (tag) return tag;
      return statusSpan(auto ?? plain, { autoApply: auto !== undefined }) ?? match;
    });

    // GM-only text inside {curly braces}
    out = out.replace(/\{([^}]+)\}/g, (match, content) =>
      game.user.isGM ? `<span class="gm-only-text">${content}</span>` : "");

    out = out.replace(/\n/g, "<br>");

    return out;
}

// Header symbols per move subtype. Soft/hard use the book's › and » markers.
const HEADER_SYMBOLS = {
  soft:      { label: "CityOfMist.terms.softMove",      html: "›", marker: true },
  hard:      { label: "CityOfMist.terms.hardMove",      html: "»", marker: true },
  intrusion: { label: "CityOfMist.terms.intrusion",     html: '<i class="fa-solid fa-circle-exclamation"></i>' },
  custom:    { label: "CityOfMist.terms.customMove",    html: '<i class="fa-solid fa-circle-dot"></i>' },
  downtime:  { label: "CityOfMist.terms.downtimeMoves", html: '<i class="fa-solid fa-bed"></i>' },
  entrance:  { label: "CityOfMist.terms.enterScene",    html: '<i class="fa-solid fa-door-open"></i>' },
};

/**
 * The header mode of a GM move: its own `system.header` when set to
 * "text" / "symbols" / "none", otherwise the system's world setting.
 */
export function moveHeaderMode(move) {
  const own = move?.system?.header;
  if (own === "text" || own === "symbols" || own === "none") return own;
  try {
    return game.settings.get(game.system.id, "gmmoveheaders") || "none";
  } catch {
    return "none";
  }
}

/**
 * Prefix to put in front of a GM move's description, mirroring the system's
 * CityItem#applyHeader. Returns "" when no header applies.
 *
 * @param {object} move
 * @param {object} [opts]
 * @param {boolean} [opts.skipSymbol]  the template already draws a marker for this move
 */
export function moveHeaderPrefix(move, { skipSymbol = false } = {}) {
  if (!move) return "";
  const subtype = move.system?.subtype;
  const mode = moveHeaderMode(move);

  if (mode === "symbols") {
    const symbol = HEADER_SYMBOLS[subtype];
    if (!symbol || skipSymbol) return "";
    const title = foundry.utils.escapeHTML(game.i18n.localize(symbol.label));
    return `<span class="npc-move-header${symbol.marker ? " npc-tc-marker" : ""}" title="${title}">${symbol.html}</span> `;
  }

  if (mode === "text" && subtype !== "custom") {
    const key = `CityOfMist.settings.gmmoveheaders.${subtype}`;
    return game.i18n.has(key) ? `${game.i18n.localize(key)} ` : "";
  }

  return "";
}

/**
 * Inline accordion initialisation (replaces accordion-handler.js).
 * Call this after rendering NPC HUD HTML.
 *
 * @param {HTMLElement} root  The rendered HUD element
 */
export function initializeAccordions(root) {
  const state = game.settings.get("mist-hud", "npcAccordionState");
  root.querySelectorAll(".accordion-container").forEach(container => {
    container.querySelectorAll(".accordion-header").forEach(header => {
      const content = header.nextElementSibling;
      if (state === "allExpanded") {
        header.classList.add("active");
        content?.classList.add("active");
      } else {
        header.classList.remove("active");
        content?.classList.remove("active");
      }
      header.addEventListener("click", () => {
        header.classList.toggle("active");
        content?.classList.toggle("active");
        header.querySelector(".fa-chevron-left")?.classList.toggle("rotated");
      });
    });
  });
}
