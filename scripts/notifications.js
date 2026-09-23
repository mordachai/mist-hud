// notifications.js — Token-side animated notifications
// Merged from token-status-notification.js + token-tag-notification.js

const SYSTEM_FONT = {
  "city-of-mist": { family: "Bangers",   size: 32, stroke: "#000000" },
  "otherscape":   { family: "Bruno Ace", size: 27, stroke: "#00821C" },
  "legend":       { family: "Bangers",   size: 30, stroke: "#000000" },
};

function _getSystemStyle() {
  const sys = game.settings.get("city-of-mist", "system");
  return SYSTEM_FONT[sys] ?? { family: "Arial", size: 25, stroke: "#000000" };
}

function _tokenCenter(token) {
  return { x: token.x + token.w / 2, y: token.y };
}

function _scroll(token, text, fill, extra = {}) {
  const style = _getSystemStyle();
  return canvas.interface.createScrollingText(
    _tokenCenter(token),
    text,
    {
      duration: 3000,
      distance: 150,
      direction: CONST.TEXT_ANCHOR_POINTS.TOP,
      anchor:    CONST.TEXT_ANCHOR_POINTS.CENTER,
      fontSize:  style.size,
      fill,
      stroke:         style.stroke,
      strokeThickness: 2,
      fontFamily:      style.family,
      ...extra,
    }
  );
}

// ── Status notifications ──────────────────────────────────────────────────────

export class TokenStatusNotification {
  /**
   * Show an animated status drop above a token.
   * @param {Token}  token
   * @param {string} statusName
   * @param {number} tier
   * @param {object} options  Override any scroll text options
   */
  static show(token, statusName, tier, options = {}) {
    if (!game.settings.get("mist-hud", "enableStatusNotifications")) return null;
    const sys = game.settings.get("city-of-mist", "system");
    const fill = sys === "otherscape" ? "#ABFF00" : "#E0E0FF";
    return _scroll(token, `${statusName} - ${tier}`, fill, options);
  }

  /** Pre-load the Bangers font for CoM notifications. */
  static preloadFonts() {
    if (!game.settings.get("mist-hud", "enableStatusNotifications")) return;
    const face = new FontFace("Bangers", "url(modules/mist-hud/ui/fonts/bangers-regular.ttf)");
    face.load().then(f => document.fonts.add(f)).catch(() => {});
  }
}

// ── Tag notifications ─────────────────────────────────────────────────────────

export class TokenTagNotification {
  /**
   * Show an animated tag drop above a token.
   * @param {Token}   token
   * @param {string}  tagName
   * @param {boolean} isInverted
   * @param {string}  cssClass   "positive" | "negative" | ""
   * @param {object}  options
   */
  static show(token, tagName, isInverted = false, cssClass = "", options = {}) {
    if (!game.settings.get("mist-hud", "enableTagNotifications")) return null;
    const fill = cssClass === "positive" ? "#7FFF7F"
               : cssClass === "negative" ? "#FF7F7F"
               : isInverted             ? "#FFA500"
               : "#FFFFFF";
    const text = `${isInverted ? "↓ " : ""}${tagName}`;
    return _scroll(token, text, fill, options);
  }
}
