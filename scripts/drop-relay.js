// drop-relay.js — system draggables (the card sheet's deck cards, chat
// statuses and tags, scene tags) dropped on an actor's window or token
// (fixes 2026-11-19, phase 1).
//
// A system draggable is an element with class "draggable" and
// data-draggable-type ("status" / "tag"), data-name and data-options; the
// system marks it ".dragging" while it moves (DragAndDrop.addDragFunctionality).
// The system itself takes such drops on its own sheets and on the canvas
// tokens, for the actor's owners only. This file adds:
//   - dropOnActor(): the same drop for the card sheet, the deck window and
//     the player / NPC HUDs; an owner gets the system's own drop
//     (DragAndDrop.dropDraggableOnActor: the status merge dialog,
//     createStoryTag), anyone else asks a GM over the module socket
//     (init.js "createDroppedItem");
//   - bindDropTarget(): the dragover / drop listeners of such a window;
//   - bindCanvasRelay(): a drop on a token the user does not own goes to
//     the GM too (the system's canvas drop does nothing then).
// A deck card dropped back on its own actor does nothing.

import { SOCKET_NAME } from "./constants.js";
import { currentSystemDraggable, dropDraggableOnActor } from "./card-sheet/system-adapter.js";

/** What a system draggable holds, as the GM relay wants it; null if it is not a status or tag. */
function draggableData(dragging) {
  const type = dragging.data("draggableType");
  if (type !== "status" && type !== "tag") return null;
  const options = { ...(dragging.data("options") ?? {}) };
  return {
    kind: type === "status" ? "status" : "story-tag",
    drop: {
      name:      String(dragging.data("name") ?? ""),
      tier:      Number(options.tier ?? dragging.data("tier")) || 1,
      temporary: !!options.temporary,
      permanent: !!options.permanent,
    },
  };
}

/** The actor a deck card came from (uuid), if it is one. */
const sourceActor = dragging => dragging.data("sourceActor") ?? null;

/**
 * Drop a system draggable on an actor: the system's way for an owner, a GM
 * relay for anyone else.
 * @param {jQuery} dragging  currentSystemDraggable()
 * @param {Actor}  actor
 * @returns {Promise<boolean>} true when something was done (or asked)
 */
export async function dropOnActor(dragging, actor) {
  if (!dragging || !actor) return false;
  if (sourceActor(dragging) && sourceActor(dragging) === actor.uuid) return false;
  if (actor.isOwner) {
    await dropDraggableOnActor(dragging, actor);
    return true;
  }
  const data = draggableData(dragging);
  if (!data) return false;
  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("MistHUD.notify.noGMForDrop"));
    return false;
  }
  game.socket.emit(SOCKET_NAME, {
    type: "dropAction", action: "createDroppedItem",
    kind: data.kind, actorUuid: actor.uuid, drop: data.drop,
  });
  return true;
}

/**
 * Make a window a drop target for system draggables. Caught in the capture
 * phase, before any DragDrop of the window (the system patches
 * DragDrop._handleDrop to drop on the canvas token under the pointer).
 * @param {HTMLElement} element
 * @param {() => Actor|null} getActor  the window's actor at drop time
 */
export function bindDropTarget(element, getActor) {
  if (!element || element.dataset.mhDropTarget) return;
  element.dataset.mhDropTarget = "1";
  element.addEventListener("dragover", event => {
    if (currentSystemDraggable()) event.preventDefault();
  }, { capture: true });
  element.addEventListener("drop", event => {
    const dragging = currentSystemDraggable();
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
    void dropOnActor(dragging, getActor());
  }, { capture: true });
}

/** The token under a client point on the canvas, as the system's canvas drop finds it. */
function tokenAt(clientX, clientY) {
  if (!canvas?.ready) return null;
  const { x, y } = canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
  const Token = foundry.canvas.placeables.Token;
  return canvas.tokens.objects.children
    .filter(t => t instanceof Token)
    .find(t => {
      const b = t.bounds;
      return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
    }) ?? null;
}

/**
 * A system draggable dropped on a token this user does not own: the system
 * drops nothing (DragAndDrop.dropDraggableOnActor needs ownership), so it is
 * relayed to a GM. Owned tokens are left to the system.
 */
export function bindCanvasRelay() {
  const board = document.getElementById("board");
  if (!board || board.dataset.mhDropRelay) return;
  board.dataset.mhDropRelay = "1";
  board.addEventListener("drop", event => {
    const dragging = currentSystemDraggable();
    if (!dragging) return;
    const actor = tokenAt(event.clientX, event.clientY)?.document?.actor;
    if (!actor || actor.isOwner) return;
    void dropOnActor(dragging, actor);
  });
}
