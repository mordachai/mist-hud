import { moveConfig } from './mh-theme-config.js';

class DynamitePanel extends FormApplication {
  constructor(object, options) {
    super(object, options);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dynamite-panel",
      title: "Dynamite Moves Control",
      template: "modules/mist-hud/templates/dynamite-panel.hbs",
      width: 600,
      height: "auto",
      closeOnSubmit: true
    });
  }

  async getData() {
    const players = game.actors.filter(actor => actor.type === "character");
    const moves = Object.entries(moveConfig).filter(([key, move]) => move.hasDynamite);

    return {
      players: players.map(player => ({
        id: player.id,
        name: player.name,
        owner: this.getPlayerOwnerName(player),
        dynamiteMoves: player.getFlag("mist-hud", "dynamiteMoves") || []
      })),
      moves: moves.map(([key, move]) => ({
        id: key,
        name: game.i18n.localize(move.name)
      }))
    };
  }

  getPlayerOwnerName(player) {
    const nonGMOwners = game.users.filter(user => !user.isGM && player.testUserPermission(user, "OWNER"));
    const ownerUser = nonGMOwners.length > 0 ? nonGMOwners[0] : null;
    return ownerUser ? `(${ownerUser.name})` : "(no owner)";
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".dynamite-toggle").on("change", async (event) => {
      const actorId = event.currentTarget.dataset.playerId;
      const moveId = event.currentTarget.dataset.moveId;

      const actor = game.actors.get(actorId);
      let dynamiteMoves = actor.getFlag("mist-hud", "dynamiteMoves") || [];
      dynamiteMoves = dynamiteMoves.map(id => String(id));

      if (event.currentTarget.checked) {
        if (!dynamiteMoves.includes(moveId)) {
          dynamiteMoves.push(moveId);
          await actor.setFlag("mist-hud", "dynamiteMoves", dynamiteMoves);
        }
      } else {
        dynamiteMoves = dynamiteMoves.filter(id => id !== moveId);
        if (dynamiteMoves.length > 0) {
          await actor.setFlag("mist-hud", "dynamiteMoves", dynamiteMoves);
        } else {
          await actor.unsetFlag("mist-hud", "dynamiteMoves");
        }
      }

      this.render();
    });
  }

  async _updateObject(event, formData) {
    // Updates are handled dynamically in activateListeners
  }
}

globalThis.launchDynamitePanel = function() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can manage Dynamite moves.");
    return;
  }
  new DynamitePanel().render(true);
};

Hooks.on('createActor', () => {
  const panel = Object.values(ui.windows).find(app => app instanceof DynamitePanel);
  if (panel) {
    panel.render();
  }
});

// Hooks.once('init', () => {
//   console.log('Dynamite Panel Initialized');
// });

// Updated Handlebars helper for "mist-hud" flag scope
Handlebars.registerHelper('getFlag', function(actorId, key) {
  const actor = game.actors.get(actorId);
  if (!actor) return null;
  return actor.getFlag("mist-hud", key);
});

Handlebars.registerHelper('includes', function(array, value) {
  if (!Array.isArray(array)) return false;
  return array.includes(value);
});
