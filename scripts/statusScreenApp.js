class statusScreenApp extends Application {
    constructor() {
        super({ title: "Statuses MC Screen", id: "status-screen", width: 'fit-content', height: 'fit-content' });
        this.statuses = [];
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/mist-hud/templates/status-screen.hbs",
            resizable: false,
            title: "Statuses MC Screen",
            popOut: true,
            header: true,
            closeOnSubmit: false,
            submitOnChange: false,
            dragDrop: [{ dragSelector: ".window-header" }],
            id: "status-screen",
            classes: ["status-screen"],
            headerButtons: true,
            minimizable: true,
        });
    }
    
    async getData() {
        let storedStatuses = game.settings.get("mist-hud", "importedStatusCollection") || [];
        if (!this.statuses.length) {
            this.statuses = storedStatuses.length ? storedStatuses : await this.loadStatuses();
        }
        return { statuses: this.statuses };
    }
    
    render(force = false, options = {}) {
        super.render(force, options);
    }
        
    importJSON() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file) return;
    
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (!Array.isArray(importedData)) throw new Error("Invalid JSON format.");
    
                    // Store in Foundry settings
                    await game.settings.set("mist-hud", "importedStatusCollection", importedData);
                    
                    // Update local list and re-render
                    this.statuses = importedData;
                    this.render(true);
                    ui.notifications.info("Statuses imported successfully!");
                } catch (error) {
                    ui.notifications.error("Failed to import JSON: " + error.message);
                }
            };
            reader.readAsText(file);
        });
    
        input.click();
    }

    async resetToDefault() {
        try {
            // Load default statuses from file
            const defaultStatuses = await this.loadStatuses();
    
            // Store in Foundry settings
            await game.settings.set("mist-hud", "importedStatusCollection", defaultStatuses);
    
            // Update local list and re-render
            this.statuses = defaultStatuses;
            this.render(true);
            
            ui.notifications.info("Statuses reset to default!");
        } catch (error) {
            ui.notifications.error("Failed to reset statuses: " + error.message);
        }
    }

    async loadStatuses() {
        const response = await fetch("modules/mist-hud/data/status-collection.json");
        return response.json();
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find(".mh-import-json").on("click", () => this.importJSON());

        html.find(".mh-reset-json").on("click", () => this.resetToDefault());

        html.find(".npc-status").each((i, el) => {
            el.setAttribute("draggable", "true");
            el.addEventListener("dragstart", (ev) => {
                const text = el.textContent.trim();
    
                // ✅ Improved Regex: Extracts last number as tier
                const match = text.match(/^(.*?)-(\d+)$/);
                let name, tier;
    
                if (match) {
                    name = match[1]; // Everything before the last hyphen
                    tier = parseInt(match[2], 10); // The last number
                } else {
                    name = text;
                    tier = 1; // Default to tier 1 if parsing fails
                }
    
                const statusData = { type: "status", name, tier };
                ev.dataTransfer.setData("text/plain", JSON.stringify(statusData));
            });
        });
    }
}

export default statusScreenApp;
