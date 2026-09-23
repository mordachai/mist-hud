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
    if (!description) return new Handlebars.SafeString("");

    const collectiveSize = Number(options.data.root.collectiveSize || 0);
    const characterName  = options.data.root.name || "Character";

    let out = description.replace(/\$name/g, characterName);

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

    return new Handlebars.SafeString(out);
  });
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
