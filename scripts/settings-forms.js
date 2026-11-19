// settings-forms.js — the "HUD Settings" and "Sheet Settings" forms (fixes phase 5).
//
// Two small ApplicationV2 forms over the module's client settings, opened
// from the core Module Settings list (game.settings.registerMenu, in
// settings.js), from the HUDs' ⋮ menu (HUD Settings) and from the card
// sheet's header (Sheet Settings). Saving writes each changed value with
// game.settings.set, so every setting's own onChange runs as from the core
// list (the card sheet's tilt and mask apply at once, the HUDs re-render…).

import { MODULE_ID, SETTINGS } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { BooleanField, NumberField } = foundry.data.fields;

const TEMPLATE = "modules/mist-hud/templates/settings-form.hbs";

const localize = key => (key ? game.i18n.localize(key) : "");

/** What the template needs to show one setting, or null if it is not registered. */
function fieldFor(appId, key) {
  const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
  if (!setting) return null;
  const value = game.settings.get(MODULE_ID, key);
  const type = setting.type;
  const field = {
    key,
    id:    `${appId}-${key}`,
    name:  localize(setting.name),
    hint:  localize(setting.hint),
    value,
  };
  if (setting.choices) {
    field.options = Object.entries(setting.choices).map(([v, label]) => ({
      value: v, label: localize(label), selected: v === value,
    }));
  } else if (type === Boolean || type instanceof BooleanField) {
    field.checkbox = true;
  } else if (setting.range && (type === Number || type instanceof NumberField)) {
    field.range = setting.range;
  } else {
    field.text = true;
  }
  return field;
}

class MistSettingsForm extends HandlebarsApplicationMixin(ApplicationV2) {
  /** The settings this form shows, in order (SETTINGS keys). */
  static KEYS = [];

  /** Intro line at the top of the form (lang key). */
  static INTRO = "";

  /**
   * One window per form: opening it again (the core list's menu button, the
   * HUD's ⋮ entry, the sheet's header button) brings the open one forward.
   * A derived constructor may hand back another object instead of `this`.
   */
  constructor(options = {}) {
    const open = foundry.applications.instances.get(new.target.DEFAULT_OPTIONS.id);
    if (open instanceof new.target) return open;
    super(options);
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["mh-settings-form"],
    window: { icon: "fa-solid fa-gear", contentClasses: ["standard-form"] },
    position: { width: 540, height: "auto" },
    form: { handler: MistSettingsForm.#onSubmit, submitOnChange: false, closeOnSubmit: true },
  };

  static PARTS = {
    form:   { template: TEMPLATE },
    footer: { template: "templates/generic/form-footer.hbs" },
  };

  /** Open the form, or bring it forward. */
  static open() {
    const app = new this();
    if (app.rendered) {
      if (app.minimized) app.maximize();
      app.bringToFront();
    } else {
      app.render({ force: true });
    }
    return app;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.intro = localize(this.constructor.INTRO);
    context.fields = this.constructor.KEYS.map(key => fieldFor(this.id, key)).filter(Boolean);
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-floppy-disk", label: "MistHUD.settingsForm.save" },
    ];
    return context;
  }

  /** Save: only the values that changed, each with its own onChange. */
  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    for (const key of this.constructor.KEYS) {
      if (!(key in data)) continue;
      const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
      if (!setting) continue;
      let value = data[key];
      if (setting.type === Number || setting.type instanceof NumberField) value = Number(value);
      if (value === game.settings.get(MODULE_ID, key)) continue;
      await game.settings.set(MODULE_ID, key, value);
    }
  }
}

/** HUD Settings: how and when the HUDs open, fold and lay out (client settings). */
export class HudSettingsForm extends MistSettingsForm {
  static DEFAULT_OPTIONS = {
    id: "mist-hud-hud-settings",
    window: { title: "MistHUD.settingsForm.hud.title", icon: "fa-solid fa-square-user" },
  };

  static INTRO = "MistHUD.settingsForm.hud.intro";

  static KEYS = [
    SETTINGS.HUD_FOR_PCS,
    SETTINGS.HUD_FOR_NPCS,
    SETTINGS.OPEN_ON_SELECT,
    SETTINGS.AUTO_FOLD_DELAY,
    SETTINGS.WIDE_LAYOUT,
    SETTINGS.USE_TEXT_BUTTONS,
  ];
}

/** Sheet Settings: the card sheet's look and move bar (client settings). */
export class SheetSettingsForm extends MistSettingsForm {
  static DEFAULT_OPTIONS = {
    id: "mist-hud-sheet-settings",
    window: { title: "MistHUD.settingsForm.sheet.title", icon: "fa-solid fa-id-card" },
  };

  static INTRO = "MistHUD.settingsForm.sheet.intro";

  static KEYS = [
    SETTINGS.CARD_SHEET_TILT,
    SETTINGS.CARD_SHEET_PORTRAIT_MASK,
    SETTINGS.CARD_SHEET_TEXT_BUTTONS,
    SETTINGS.CARD_SHEET_MOD_TOTAL,
    SETTINGS.CARD_SHEET_TAG_LEADERS,
    SETTINGS.CARD_SHEET_TAG_TINTS,
  ];
}
