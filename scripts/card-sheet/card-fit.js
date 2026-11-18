// card-fit.js — fit text to the card sheet's fixed-size cards (plan § 7).
//
// Cards never grow: every size inside a card is in card-relative units
// (container queries), and an element marked `data-fit` shrinks its text
// through the `--mh-fit` factor (font-size: calc(base * var(--mh-fit, 1)))
// until it fits its box. The base size is large, so a short text stays big
// and a long one gets smaller. `data-fit-lines="n"` also caps the number of
// lines (the theme title: at most 3); words are never broken, so a word wider
// than the box shrinks the text too. Lists scroll inside the face instead
// (CSS only). The factor is relative, so it stays right while the window
// scales the cards.

const MIN_FIT = 0.3;
const STEP = 0.04;
/** Size of a text that does not fit even at MIN_FIT, and is clamped instead. */
const CLAMP_FIT = 0.45;

const overflows = el =>
  el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;

/** Number of text lines in el (distinct line tops; works under 3D transforms). */
function lineCount(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const tops = [];
  for (const r of range.getClientRects()) {
    if (!r.width || !r.height) continue;
    if (!tops.some(t => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
  }
  return tops.length;
}

const fits = (el, maxLines) =>
  !overflows(el) && (!maxLines || lineCount(el) <= maxLines);

/** Shrink one element's text until it fits its box and its line cap (or reaches MIN_FIT). */
export function fitText(el) {
  el.style.setProperty("--mh-fit", "1");
  if ("fitClamped" in el.dataset) {
    delete el.dataset.fitClamped;
    delete el.dataset.tooltip;
  }
  // Not laid out (minimised window, hidden layer): leave it at full size.
  if (!el.clientHeight || !el.clientWidth) return;
  const maxLines = Number(el.dataset.fitLines) || 0;
  let fit = 1;
  while (fit > MIN_FIT && !fits(el, maxLines)) {
    fit = Math.max(MIN_FIT, +(fit - STEP).toFixed(2));
    el.style.setProperty("--mh-fit", String(fit));
  }
  // Still too long at the smallest size: the CSS clamps it (words may break,
  // ellipsis on the last line) and the full text goes in a tooltip.
  if (!fits(el, maxLines)) {
    el.style.setProperty("--mh-fit", String(CLAMP_FIT));
    el.dataset.fitClamped = "";
    el.dataset.tooltip = el.textContent.trim();
  }
}

/** Fit every `[data-fit]` element under root. */
export function fitCards(root) {
  if (!root) return;
  for (const el of root.querySelectorAll("[data-fit]")) fitText(el);
}

/**
 * Fit now, again whenever a web font finishes loading (a title font is much
 * wider than its fallback, and it only starts loading once a card uses it),
 * and whenever the root changes size. Returns a disconnect
 * function.
 */
export function watchFit(root) {
  if (!root) return () => {};
  let frame = 0;
  const refit = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (root.isConnected) fitCards(root); });
  };
  fitCards(root);
  document.fonts?.ready?.then(refit);
  document.fonts?.addEventListener?.("loadingdone", refit);
  // The cards follow the root's width and height (whichever limits them).
  const size = () => `${root.clientWidth}x${root.clientHeight}`;
  let lastSize = size();
  const observer = new ResizeObserver(() => {
    if (size() === lastSize) return;
    lastSize = size();
    refit();
  });
  observer.observe(root);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.fonts?.removeEventListener?.("loadingdone", refit);
  };
}
