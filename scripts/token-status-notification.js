// token-status-notification.js

/**
 * Provides methods to display animated status notifications over tokens
 * using Foundry VTT's built-in scrolling text functionality.
 */
export class TokenStatusNotification {
  /**
   * Create and play an animated status notification
   * @param {Token} token - The token that received the status
   * @param {string} statusName - Name of the status applied
   * @param {number} tier - Tier level of the applied status
   * @param {Object} options - Configuration options
   * @returns {Object|null} The scrolling text object or null if animations are disabled
   */
  static show(token, statusName, tier, options = {}) {
    // Check if notifications are enabled in settings
    if (!game.settings.get("mist-hud", "enableStatusNotifications")) {
      return null; // Skip creating the notification if disabled
    }
    
    // Get the current system
    const activeSystem = game.settings.get("city-of-mist", "system");
    
    // System-specific styling
    let fontFamily = "Arial";
    let textColor = "#DDDDDD";
    let stroke = "#000000";
    let fontsize = 25;
    
    if (activeSystem === "city-of-mist") {
      fontFamily = "Bangers";
      textColor = "#E0E0FF";
      stroke = "#000000"; 
      fontsize = 32;
    } else if (activeSystem === "otherscape") {
      fontFamily = "Bruno Ace";
      textColor = "#ABFF00";
      stroke = "#00821C";
      fontsize = 27;
    }
    
    // Default configuration
    const config = foundry.utils.mergeObject({
      duration: 3000,         // Animation duration in milliseconds
      distance: 150,          // How far the notification travels upward
      fontSize: fontsize,           // Base font size in pixels
      fill: textColor,        // Text color based on system
      stroke: stroke,    // Text outline color (transparent)
      strokeThickness: 2,     // Thickness of text outline
      fontFamily: fontFamily  // Font family based on system
    }, options);
    
    // Format the display text
    const displayText = `${statusName} - ${tier}`;
    
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
        classes: ["mh-status-notification"]
      }
    );
  }
  
  /**
   * Pre-load the custom font for notifications
   * Should be called during module initialization
   */
  static preloadFonts() {
    // Only preload fonts if animations are enabled
    if (!game.settings.get("mist-hud", "enableStatusNotifications")) {
      return; // Skip font loading if animations are disabled
    }
    
    // Load the Bangers font for City of Mist
    const fontFace = new FontFace(
      "Bangers", 
      `url(modules/mist-hud/ui/fonts/bangers-regular.ttf)`
    );
    
    fontFace.load().then(loadedFace => {
      // Add the loaded font to the document
      document.fonts.add(loadedFace);
      console.log(`Font loaded: Bangers`);
    }).catch(error => {
      console.error(`Error loading font Bangers:`, error);
    });
  }
}

// Register a hook to preload fonts when Foundry is ready
Hooks.once('ready', () => {
  TokenStatusNotification.preloadFonts();
});