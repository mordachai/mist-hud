// hud-fold.js — shared behaviour of the floating HUD windows (player and NPC):
//   • auto-fold: after N seconds without interaction the window minimizes
//     (client setting "autoFoldDelay", 0 = never);
//   • a single click on the folded header (or the portrait in it) unfolds it.
//     Core only unfolds on double-click.

import { MODULE_ID, SETTINGS } from "./constants.js";

/** Pixels a press may move and still count as a click (more = a window drag). */
const DRAG_TOLERANCE = 5;
/** After a click-unfold, swallow core's double-click toggle for this long (ms). */
const DBLCLICK_GUARD = 600;

/** Seconds without interaction before a HUD folds; 0 = never. */
function foldDelay() {
  try { return Number(game.settings.get(MODULE_ID, SETTINGS.AUTO_FOLD_DELAY)) || 0; }
  catch { return 0; }
}

/** The HUD still counts as in use even though the pointer left its window. */
function isBusy(app) {
  const el = app.element;
  if (el?.matches(":hover")) return true;
  // Theme tooltip and loadout popup live on <body>, outside the window
  if (document.querySelector(".mh-tooltip:hover")) return true;
  if (app._loadoutPopup || app._rolling) return true;
  const active = document.activeElement;
  if (active && el?.contains(active) && active.matches("input, textarea, select, [contenteditable]")) return true;
  return false;
}

export function cancelFold(app) {
  if (app._mhFoldTimer) clearTimeout(app._mhFoldTimer);
  app._mhFoldTimer = null;
}

/** (Re)start the countdown. No-op when the setting is off or the HUD is already folded. */
export function scheduleFold(app) {
  cancelFold(app);
  const delay = foldDelay();
  if (!delay || !app.rendered || app.minimized) return;
  app._mhFoldTimer = setTimeout(() => {
    app._mhFoldTimer = null;
    if (!app.rendered || app.minimized) return;
    if (isBusy(app)) return scheduleFold(app);
    app.minimize();
  }, delay * 1000);
}

/** Restart the countdown on every open HUD (the setting changed). */
export function rescheduleAllFolds() {
  for (const app of foundry.applications.instances.values()) {
    if (!app._mhFoldable) continue;
    if (app.element?.matches(":hover")) cancelFold(app);
    else scheduleFold(app);
  }
}

/**
 * Wire the fold behaviour to a HUD window. Call once, from _onFirstRender:
 * the frame element and its header survive re-renders.
 */
export function attachFoldBehaviour(app) {
  const el = app.element;
  if (!el || app._mhFoldable) return;
  app._mhFoldable = true;

  // The countdown only runs while the pointer is outside the window
  el.addEventListener("pointerenter", () => cancelFold(app));
  el.addEventListener("pointerleave", () => scheduleFold(app));

  const header = el.querySelector(".window-header");
  let down = null;
  let unfoldedAt = 0;
  header?.addEventListener("pointerdown", ev => { down = { x: ev.clientX, y: ev.clientY }; });
  header?.addEventListener("click", ev => {
    if (!app.minimized || !down) return;
    if (ev.target.closest("button, a, input, [data-action]")) return; // header controls keep their job
    if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > DRAG_TOLERANCE) return;
    unfoldedAt = Date.now();
    app.maximize();
  });
  // The first click of a double-click already unfolded; without this, core's
  // dblclick handler on the header would fold the window straight back.
  el.addEventListener("dblclick", ev => {
    if (Date.now() - unfoldedAt < DBLCLICK_GUARD) { ev.stopPropagation(); ev.preventDefault(); }
  }, { capture: true });

  scheduleFold(app);
}
