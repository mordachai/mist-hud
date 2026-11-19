// portrait.js — the card sheet's portrait at its left, and the sheet cards'
// tilt (docs/fixes-and-improvements.md, phase 4).
//
// Portrait: the header bar's Portrait button cycles Hide / Portrait (256 ×
// 256) / Hero Shot (340 wide × 500 tall), per actor in the client UI state
// (ui-state.js). The sizes are those of the reference card (204 px wide):
// the portrait scales with the cards when the window does. The Hero Shot can
// be masked (client setting): a luminance mask image from
// ui/card-sheet/portrait-masks/, used only once it is known to load (a
// missing mask image would hide the whole portrait).
//
// Tilt: every sheet card gets an angle in −2°…+2° from its id, so it keeps
// the same angle across renders and reloads (client setting to turn it off).

import { MODULE_ID, SETTINGS } from "../constants.js";
import { PORTRAIT_MODES, portraitMode } from "./ui-state.js";

/** The reference card's width (px), at which the portrait has its nominal size. */
export const REF_CARD_W = 204;

/**
 * Each mode's column at the left of the layers: its width in card widths and
 * the gap to the layers (px). Mirrors --mh-cs-portrait-k / -gap in card-sheet.css.
 */
export const PORTRAIT_COLUMN = {
  hide:     { k: 0,                gap: 0 },
  portrait: { k: 256 / REF_CARD_W, gap: 12 },
  hero:     { k: 340 / REF_CARD_W, gap: 12 },
};

const LABELS = { hide: "portraitHide", portrait: "portraitPortrait", hero: "portraitHero" };

const MASK_DIR = "modules/mist-hud/ui/card-sheet/portrait-masks";

/** The next mode the Portrait button goes to. */
export function nextPortraitMode(mode) {
  return PORTRAIT_MODES[(PORTRAIT_MODES.indexOf(mode) + 1) % PORTRAIT_MODES.length];
}

/**
 * What the Portrait button and the portrait part show for this actor.
 * @param {Actor}   actor
 * @param {boolean} [pick]  edit mode: the button picks the portrait image instead of cycling
 */
export function portraitContext(actor, pick = false) {
  const mode = portraitMode(actor);
  const label = m => game.i18n.localize(`MistHUD.cardSheet.${LABELS[m]}`);
  return {
    mode,
    pick,
    shown:   mode !== "hide",
    img:     actor.img,
    name:    actor.name,
    tooltip: pick
      ? game.i18n.localize("MistHUD.cardSheet.portraitPick")
      : game.i18n.format("MistHUD.cardSheet.portraitButton", { mode: label(mode), next: label(nextPortraitMode(mode)) }),
  };
}

// ── Hero Shot mask ───────────────────────────────────────────────────────────

/** url → Promise<boolean>: whether the mask image loads (checked once per url). */
const maskChecks = new Map();

function maskLoads(url) {
  if (!maskChecks.has(url)) {
    maskChecks.set(url, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
      img.onerror = () => resolve(false);
      img.src = url;
    }));
  }
  return maskChecks.get(url);
}

/** Forget which masks load (the setting changed: the user may have swapped the files). */
export function clearMaskChecks() {
  maskChecks.clear();
}

function maskSetting() {
  try { return game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_PORTRAIT_MASK) ?? "none"; }
  catch { return "none"; }
}

/**
 * Mask the Hero Shot's frame with the chosen mask image, once it is known to
 * load; otherwise (no mask, a missing or broken file, another mode) the
 * portrait shows unmasked.
 * @param {HTMLElement} root  the sheet's element
 */
export async function applyPortraitMask(root) {
  const frame = root?.querySelector(".mh-cs-portrait-frame");
  if (!frame) return;
  frame.classList.remove("mh-cs-masked");
  frame.style.removeProperty("mask-image");
  const mask = maskSetting();
  if (!frame.closest(".mh-cs-portrait-hero") || !mask || mask === "none") return;
  const url = `${MASK_DIR}/${mask}.webp`;
  if (!(await maskLoads(url)) || !frame.isConnected) return;
  frame.style.maskImage = `url("${url}")`;
  frame.classList.add("mh-cs-masked");
}

// ── Card tilt ───────────────────────────────────────────────────────────────

/** Whether the sheet cards are tilted (client setting). */
export function tiltOn() {
  try { return game.settings.get(MODULE_ID, SETTINGS.CARD_SHEET_TILT) !== false; }
  catch { return true; }
}

/** A Sheet Settings switch that defaults to on. */
function lookOn(key) {
  try { return game.settings.get(MODULE_ID, key) !== false; }
  catch { return true; }
}

/**
 * The sheet's look switches as data attributes on the window (the CSS keys
 * on them): the tilt, and the tag line tints experiment (2026-11-19): a band
 * of the card's theme colour behind each tag line, in alternating shades.
 * @param {HTMLElement} el  the sheet's window (or its frame, before the first paint)
 */
export function applyLookFlags(el) {
  if (!el) return;
  el.dataset.tilt    = tiltOn() ? "on" : "off";
  el.dataset.tints   = lookOn(SETTINGS.CARD_SHEET_TAG_TINTS) ? "on" : "off";
}

/** A card's angle in degrees, −2…+2, always the same for the same id (FNV-1a hash). */
export function cardTilt(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return Math.round(((h >>> 0) % 401) - 200) / 100;
}

/** Give every sheet card under root its angle (--mh-cs-tilt; the CSS uses it while data-tilt="on"). */
export function applyCardTilts(root) {
  for (const card of root?.querySelectorAll(".mh-cs-layer .mh-cs-card[data-card-id]") ?? []) {
    card.style.setProperty("--mh-cs-tilt", `${cardTilt(card.dataset.cardId)}deg`);
  }
}
