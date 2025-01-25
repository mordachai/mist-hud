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
        this.resetWindowSize();
    } 
    
    //NOT IN USE
    async importJSON() {
        new FilePicker({
            type: "file",
            current: "/",
            callback: async (path) => {
                try {
                    const response = await fetch(path);
                    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
                    const importedData = await response.json();
                    if (!Array.isArray(importedData)) throw new Error("Invalid JSON format. Expected an array.");
    
                    // Store in Foundry settings
                    await game.settings.set("mist-hud", "importedStatusCollection", importedData);
    
                    // Update local list and re-render
                    this.statuses = importedData;

                    this.render(true);
                    this.resetWindowSize();

                    ui.notifications.info("Statuses imported successfully!");
                } catch (error) {
                    ui.notifications.error("Failed to import JSON: " + error.message);
                }
            },
            extensions: [".json"],
        }).browse();
    }
    
    async importCSV() {
        new FilePicker({
            type: "file",
            current: "/",
            callback: async (path) => {
                try {
                    const response = await fetch(path);
                    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
                    const csvText = await response.text();
                    const importedData = this.parseCSV(csvText);
    
                    if (!Array.isArray(importedData)) throw new Error("Invalid CSV format. Expected an array.");
    
                    // Store in Foundry settings
                    await game.settings.set("mist-hud", "importedStatusCollection", importedData);
    
                    // Update local list and re-render
                    this.statuses = importedData;
                    this.render(true);
                    ui.notifications.info("CSV imported successfully!");
                } catch (error) {
                    ui.notifications.error("Failed to import CSV: " + error.message);
                }
            },
            extensions: [".csv"],
        }).browse();
    }

    parseCSV(csvText) {
        const rows = csvText.split("\n").map(row => row.trim()).filter(row => row.length);
        const headers = rows.shift().split(",").map(header => header.trim().replace(/^"(.*)"$/, '$1')); // Removes quotes
    
        if (headers[0] !== "status_type") {
            throw new Error("Invalid CSV format: First column must be 'status_type'.");
        }
    
        return rows.map(row => {
            const cols = row.split(",").map(col => col.trim().replace(/^"(.*)"$/, '$1')); // Removes surrounding quotes
            const statusType = cols.shift(); // First column is status_type
            const statusScale = cols.filter(Boolean); // Remaining columns are tier statuses
    
            return { status_type: statusType, status_scale: statusScale };
        });
    }
  
    async resetToDefault() {
        try {
            // Load default statuses from the module folder
            const defaultStatuses = await this.loadStatuses();
    
            // Store in Foundry settings
            await game.settings.set("mist-hud", "importedStatusCollection", defaultStatuses);
    
            // Update local list and re-render
            this.statuses = defaultStatuses;
            this.render(true);
            this.resetWindowSize();
    
            ui.notifications.info("Statuses reset to default!");
        } catch (error) {
            ui.notifications.error("Failed to reset statuses: " + error.message);
        }
    }

    downloadSampleCSV() {
        const filePath = "/modules/mist-hud/data/statuses-collection-sample.csv";
        
        // Create a hidden anchor element and trigger the download
        const link = document.createElement("a");
        link.href = filePath;
        link.download = "statuses-collection-sample.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    
        ui.notifications.info("Downloading sample CSV...");
    }    
    
    async loadStatuses() {
        const response = await fetch("modules/mist-hud/data/status-collection.json");
        return response.json();
    }

    activateListeners(html) {
        super.activateListeners(html);

        // html.find(".mh-import-json").on("click", () => this.importJSON());

        html.find(".mh-sample-csv").on("click", () => this.downloadSampleCSV());

        html.find(".mh-import-csv").on("click", () => this.importCSV());

        html.find(".mh-reset-json").on("click", () => this.resetToDefault());

        html.find(".npc-status").each((i, el) => {
            el.setAttribute("draggable", "true");
            el.addEventListener("dragstart", (ev) => {
                const text = el.textContent.trim();
    
                const match = text.match(/^(.*?)-(\d+)$/);
                let name, tier;
    
                if (match) {
                    name = match[1];
                    tier = parseInt(match[2], 10);
                } else {
                    name = text;
                    tier = 1;
                }
    
                const statusData = { type: "status", name, tier };
                ev.dataTransfer.setData("text/plain", JSON.stringify(statusData));
            });
        });
    }

    resetWindowSize() {
        setTimeout(() => {
            const app = this.element;
            if (!app.length) return;
    
            // Auto-adjust the window size to fit content
            const content = app.find(".window-content");
            const width = content.outerWidth(true) + 20; // Add padding
            const height = content.outerHeight(true) + 40;
    
            app.css({ width: `${width}px`, height: `${height}px` });
            this.setPosition({ width, height });
    
        }, 50); // Small delay to ensure Foundry has re-rendered content
    }
    
}

export default statusScreenApp;



