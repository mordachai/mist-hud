// mh-drag-pos.js

let isDragging = false;
let dragStartX, dragStartY;
let savedPosition = {
  top: -1,
  left: -1
};

export function makeDraggable(element, dragHandle, actorId) {
  if (!actorId || !element || !dragHandle) return;

  console.log("makeDraggable initialized");

  dragHandle.addEventListener('mousedown', dragMouseDown);
  document.addEventListener('mousemove', elementDrag);
  document.addEventListener('mouseup', closeDragElement);

  function dragMouseDown(e) {
    e.preventDefault(); // Prevent text selection
    isDragging = true;
    const rect = element.getBoundingClientRect();
    dragStartX = e.clientX - rect.left;
    dragStartY = e.clientY - rect.top;
  }

  function elementDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const newX = e.clientX - dragStartX;
    const newY = e.clientY - dragStartY;
    element.style.left = `${newX}px`;
    element.style.top = `${newY}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    savedPosition.left = newX;
    savedPosition.top = newY;
  }

  function closeDragElement(e) {
    isDragging = false;
  }
}

export function getHUDPosition(actorId) {
  let position = {
    top: savedPosition.top > 0 ? `${savedPosition.top}px` : '100px',
    left: savedPosition.left > 0 ? `${savedPosition.left}px` : '150px'
  };

  const container = document.querySelector('.mh-hud');
  if (container) {
    container.style.left = position.left;
    container.style.top = position.top;
  }

  return position;
}

export function setHUDPosition(actorId, position) {
  const actor = game.actors.get(actorId);
  if (!actor) return;
  actor.setFlag("mist-hud", "hudPosition", position);
}