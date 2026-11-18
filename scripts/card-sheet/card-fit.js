// card-fit.js — fit text to the card sheet's fixed-size cards (plan § 7).
//
// Cards never grow: every size inside a card is in card-relative units
// (container queries), and an element marked `data-fit` shrinks its text
// through the `--mh-fit` factor (font-size: calc(base * var(--mh-fit, 1)))
// until it fits its box. Lists scroll inside the face instead (CSS only).
// The factor is relative, so it stays right while the window scales the cards.

const MIN_FIT = 0.4;
const STEP = 0.05;

const overflows = el =>
  el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;

/** Shrink one element's text until it fits its box (or reaches MIN_FIT). */
export function fitText(el) {
  el.style.setProperty("--mh-fit", "1");
  // Not laid out (minimised window, hidden layer): leave it at full size.
  if (!el.clientHeight || !el.clientWidth) return;
  let fit = 1;
  while (fit > MIN_FIT && overflows(el)) {
    fit = Math.max(MIN_FIT, +(fit - STEP).toFixed(2));
    el.style.setProperty("--mh-fit", String(fit));
  }
}

/** Fit every `[data-fit]` element under root. */
export function fitCards(root) {
  if (!root) return;
  for (const el of root.querySelectorAll("[data-fit]")) fitText(el);
}

/**
 * Fit now, again whenever a web font finishes loading (a handwritten title
 * font is much wider than its fallback, and it only starts loading once a
 * card uses it), and whenever the root changes size. Returns a disconnect
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
