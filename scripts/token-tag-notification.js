// token-tag-notification.js

/**
 * Provides methods to display animated tag notifications over tokens
 * using Foundry VTT's built-in scrolling text functionality.
 */
export class TokenTagNotification {
  /**
   * Create and play an animated tag notification
   * @param {Token} token - The token that received the tag
   * @param {string} tagName - Name of the tag applied
   * @param {boolean} isInverted - Whether the tag is inverted
   * @param {string} cssClass - Additional CSS class for styling (positive/negative)
   * @param {Object} options - Configuration options
   * @returns {Object|null} The scrolling text object or null if animations are disabled
   */
  static show(token, tagName, isInverted = false, cssClass = "", options = {}) {
    // Check if notifications are enabled in settings
    if (!game.settings.get("mist-hud", "enableTagNotifications")) {
      return null; // Skip creating the notification if disabled
    }
    
    // Get the current system
    const activeSystem = game.settings.get("city-of-mist", "system");
    
    // System-specific styling
    let fontFamily = "Arial";
    let textColor = "#FFFFFF";
    let stroke = "#000000";
    let fontsize = 25;
    
    if (activeSystem === "city-of-mist") {
      fontFamily = "Bangers";
      stroke = "#000000"; 
      fontsize = 32;
    } else if (activeSystem === "otherscape") {
      fontFamily = "Bruno Ace";
      stroke = "#00821C";
      fontsize = 27;
    }
    
    // Adjust color based on tag state
    if (cssClass === "positive") {
      textColor = "#7FFF7F"; // Light green for positive tags
    } else if (cssClass === "negative") {
      textColor = "#FF7F7F"; // Light red for negative tags
    } else if (isInverted) {
      textColor = "#FFA500"; // Orange for inverted tags
    } else {
      textColor = "#FFFFFF"; // White for normal tags
    }
    
    // Default configuration
    const config = foundry.utils.mergeObject({
      duration: 3000,         // Animation duration in milliseconds
      distance: 150,          // How far the notification travels upward
      fontSize: fontsize,     // Base font size in pixels
      fill: textColor,        // Text color based on tag state
      stroke: stroke,         // Text outline color
      strokeThickness: 2,     // Thickness of text outline
      fontFamily: fontFamily  // Font family based on system
    }, options);
    
    // Format the display text with an indicator for inverted tags
    const prefix = isInverted ? "↑ " : "";
    const displayText = `${prefix}${tagName}`;
    
    // Get the token position - center horizontally, top of token vertically
    const position = {
      x: token.x + (token.w / 2),
      y: token.y
    };
    
    // Create a scrolling text using Foundry's built-in method
    return canvas.interface.createScrollingText(
      position,
      displayText,
      {
        duration: config.duration,
        distance: config.distance,
        direction: CONST.TEXT_ANCHOR_POINTS.TOP,
        fontSize: config.fontSize,
        fill: config.fill,
        stroke: config.stroke,
        strokeThickness: config.strokeThickness,
        fontFamily: config.fontFamily,
        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
        classes: ["mh-tag-notification"]
      }
    );
  }
}

// No need to preload fonts as they're already handled by TokenStatusNotification
