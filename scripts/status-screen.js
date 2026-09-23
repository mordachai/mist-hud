// status-screen.js — Status browser / CSV importer (ApplicationV2)

import { MODULE_ID, SETTINGS } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class StatusScreen extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:      "status-screen",
    classes: ["status-screen"],
    window:  { title: "Statuses MC Screen", resizable: true, minimizable: true },
    position: { width: 500, height: "auto" },
  };

  static PARTS = {
    app: { template: "modules/mist-hud/templates/status-screen.hbs" },
  };

  /** @type {object[]} */
  #statuses = [];

  async _prepareContext(_options) {
    const stored = game.settings.get(MODULE_ID, SETTINGS.IMPORTED_STATUS_COLLECTION) ?? [];
    if (!this.#statuses.length) {
      this.#statuses = stored.length
        ? stored
        : await this.#loadCSV("modules/mist-hud/data/status-collection-default.csv");
    }

    const enableTabs = game.settings.get(MODULE_ID, SETTINGS.ENABLE_STATUS_TABS);

    if (enableTabs) {
      const statusesGrouped = this.#statuses.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
        return acc;
      }, {});
      return { enableTabs, statusesGrouped };
    }

    return { enableTabs, statuses: this.#statuses };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);

    if (context.enableTabs) {
      const stored = game.settings.get(MODULE_ID, SETTINGS.LAST_SELECTED_TAB)
        || html.find(".status-tab").first().data("tab");

      html.find(".status-tab").removeClass("active");
      html.find(".tab-content").hide();
      html.find(`.tab-content[data-tab="${stored}"]`).show();
      html.find(`.status-tab[data-tab="${stored}"]`).addClass("active");

      html.find(".status-tab").on("click", (event) => {
        const tab = $(event.currentTarget).data("tab");
        html.find(".status-tab").removeClass("active");
        $(event.currentTarget).addClass("active");
        html.find(".tab-content").hide();
        html.find(`.tab-content[data-tab="${tab}"]`).show();
        game.settings.set(MODULE_ID, SETTINGS.LAST_SELECTED_TAB, tab);
        this.#resetWindowSize();
        this.#makeStatusesDraggable(html);
      });
    }

    this.#makeStatusesDraggable(html);
    html.find(".mh-import-csv").on("click",  () => this.importCSV());
    html.find(".mh-reset-json").on("click",  () => this.resetToDefault());
    html.find(".mh-sample-csv").on("click",  () => this.downloadSampleCSV());

    this.#resetWindowSize();
  }

  // ── CSV import ───────────────────────────────────────────────────────────

  async importCSV() {
    new FilePicker({
      type: "file", current: "/",
      callback: async (path) => {
        try {
          const res = await fetch(path);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = this.#parseCSV(await res.text());
          await game.settings.set(MODULE_ID, SETTINGS.IMPORTED_STATUS_COLLECTION, data);
          this.#statuses = data;
          this.render(true);
          ui.notifications.info("CSV imported successfully!");
        } catch (e) {
          ui.notifications.error("Failed to import CSV: " + e.message);
        }
      },
      extensions: [".csv"],
    }).browse();
  }

  async resetToDefault() {
    try {
      const data = await this.#loadCSV("modules/mist-hud/data/status-collection-default.csv");
      await game.settings.set(MODULE_ID, SETTINGS.IMPORTED_STATUS_COLLECTION, data);
      this.#statuses = data;
      this.render(true);
      ui.notifications.info("Statuses reset to default!");
    } catch (e) {
      ui.notifications.error("Failed to reset: " + e.message);
    }
  }

  downloadSampleCSV() {
    const link = document.createElement("a");
    link.href = "/modules/mist-hud/data/statuses-collection-sample.csv";
    link.download = "statuses-collection-sample.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ui.notifications.info("Downloading sample CSV…");
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  async #loadCSV(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return this.#parseCSV(await res.text());
    } catch (e) {
      console.error("Error loading CSV:", e);
      return [];
    }
  }

  #parseCSV(csvText) {
    const rows    = csvText.split("\n").map(r => r.trim()).filter(Boolean);
    const headers = rows.shift().split(",").map(h => h.trim().replace(/^"(.*)"$/, "$1"));

    // Validate expected column order
    const catIdx  = headers.indexOf("category");
    const typeIdx = headers.indexOf("status_type");
    if (catIdx === -1 || typeIdx === -1) {
      throw new Error("CSV must have columns 'category' and 'status_type'.");
    }

    return rows.map(row => {
      const cols = row.split(",").map(c => c.trim().replace(/^"(.*)"$/, "$1"));
      const category    = cols[catIdx]  ?? "";
      const status_type = cols[typeIdx] ?? "";
      // remaining cols are tier scale
      const status_scale = cols.filter((_, i) => i !== catIdx && i !== typeIdx && cols[i]);
      return { category, status_type, status_scale };
    });
  }

  #makeStatusesDraggable(html) {
    html.find(".npc-status").each((_, el) => {
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (ev) => {
        const text  = el.textContent.trim();
        const match = text.match(/^(.*?)-(\d+)$/);
        const name  = match ? match[1] : text;
        const tier  = match ? parseInt(match[2], 10) : 1;
        ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "status", name, tier }));
      });
    });
  }

  #resetWindowSize() {
    this.setPosition({ height: "auto" });
  }
}

// Global helper so macros / settings buttons can open the screen
globalThis.openStatusScreen = function () {
  StatusScreen.open();
};

StatusScreen.open = function () {
  const existing = foundry.applications.instances.get("status-screen");
  if (existing) { existing.bringToFront(); return; }
  new StatusScreen().render(true);
};

export default StatusScreen;
