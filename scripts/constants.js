// constants.js — Module-wide constants

export const MODULE_ID = "mist-hud";

export const FLAG_KEYS = {
  SELECTED_TAGS:       "selected-tags",
  SELECTED_CREW_TAGS:  "selected-crew-tags",
  INVERTED_TAGS:       "inverted-tags",
  STATUS_STATES:       "status-states",
  RECEIVED_BONUSES:    "received-bonuses",
  NPC_INFLUENCE:       "npc-influence",
  IS_COLLAPSED:        "isCollapsed",
  // On a relationship tag item: id of the character the relationship is with.
  RELATIONSHIP_TARGET: "relationship-target",
};

export const SETTINGS = {
  ROLL_IS_DYNAMITE:            "rollIsDynamite",
  NPC_ACCORDION_STATE:         "npcAccordionState",
  LAST_SELECTED_TAB:           "lastSelectedTab",
  ENABLE_STATUS_NOTIFICATIONS: "enableStatusNotifications",
  ENABLE_TAG_NOTIFICATIONS:    "enableTagNotifications",
  USE_TEXT_BUTTONS:            "useTextButtons",
  ENABLE_STATUS_TABS:          "enableStatusTabs",
  DEBUG_MODE:                  "debugMode",
  LAYOUT_MODE:                 "layoutMode",
  DOCK_SIDE:                   "dockSide",
  WIDE_LAYOUT:                 "wideLayout",
  IMPORTED_STATUS_COLLECTION:  "importedStatusCollection",
};

export const SOCKET_NAME = "module.mist-hud";

/**
 * Active City of Mist engine system. The system's own "system" setting flips to
 * "custom" when related settings (e.g. movesInclude) change, so fall back to the
 * base system in that case.
 */
export function getActiveSystem() {
  const sys = game.settings.get("city-of-mist", "system");
  if (sys !== "custom") return sys;
  return game.settings.get("city-of-mist", "baseSystem")
      ?? game.settings.get("city-of-mist", "movesInclude")
      ?? sys;
}
