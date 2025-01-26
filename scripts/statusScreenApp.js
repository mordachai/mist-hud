class statusScreenApp extends Application {
    constructor() {
        super({ title: "Statuses MC Screen", id: "status-screen", width: 'fit-content', height: 'fit-content' });
        this.statuses = [];
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/mist-hud/templates/status-screen.hbs",
            resizable: true,
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
            this.statuses = storedStatuses.length ? storedStatuses : await this.loadCSV("modules/mist-hud/data/status-collection-default.csv");
        }
    
        const enableTabs = game.settings.get("mist-hud", "enableStatusTabs");
    
        if (enableTabs) {
            // Group statuses by category
            const grouped = this.statuses.reduce((acc, status) => {
                if (!acc[status.category]) acc[status.category] = [];
                acc[status.category].push(status);
                return acc;
            }, {});
    
            return { enableTabs, statusesGrouped: grouped };
        }
    
        return { enableTabs, statuses: this.statuses };
    }    
    
    render(force = false, options = {}) {
        super.render(force, options);
        // Ensure it runs AFTER Foundry finishes rendering
        setTimeout(() => {
            this.element.css({ display: "block", height: "auto", width: "auto" });
        }, 50);  // Small delay to ensure Foundry completes layout
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

    async loadCSV(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
            const csvText = await response.text();
            return this.parseCSV(csvText);
        } catch (error) {
            console.error("Error loading CSV:", error);
            return [];
        }
    }    

    parseCSV(csvText) {
        const rows = csvText.split("\n").map(row => row.trim()).filter(row => row.length);
        const headers = rows.shift().split(",").map(header => header.trim().replace(/^"(.*)"$/, '$1')); // Removes quotes
    
        if (headers[0] !== "category" || headers[1] !== "status_type") {
            throw new Error("Invalid CSV format: First two columns must be 'category' and 'status_type'.");
        }
    
        return rows.map(row => {
            const cols = row.split(",").map(col => col.trim().replace(/^"(.*)"$/, '$1')); // Removes surrounding quotes
            const category = cols.shift();   // First column is category
            const statusType = cols.shift(); // Second column is status_type
            const statusScale = cols.filter(Boolean); // Remaining columns are tier statuses
    
            return { category, status_type: statusType, status_scale: statusScale };
        });
    }    
  
    async resetToDefault() {
        try {
            // Load the default statuses from the CSV instead of JSON
            const defaultStatuses = await this.loadCSV("modules/mist-hud/data/status-collection-default.csv");
    
            // Store in Foundry settings
            await game.settings.set("mist-hud", "importedStatusCollection", defaultStatuses);
    
            // Update local list and re-render
            this.statuses = defaultStatuses;
            this.render(true);
    
            ui.notifications.info("Statuses reset to default from CSV!");
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
    
    makeStatusesDraggable(html) {
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

    activateListeners(html) {
        super.activateListeners(html);
    
        // Ensure tabs are enabled
        if (game.settings.get("mist-hud", "enableStatusTabs")) {
            const storedTab = game.settings.get("mist-hud", "lastSelectedTab") || html.find(".status-tab").first().data("tab");
    
            // Remove active class from all tab buttons and hide all tabs
            html.find(".status-tab").removeClass("active");
            html.find(".tab-content").hide();
    
            // Show the stored tab content and mark its button as active
            html.find(`.tab-content[data-tab='${storedTab}']`).show();
            html.find(`.status-tab[data-tab='${storedTab}']`).addClass("active");
    
            // 🔄 Tab switching logic
            html.find(".status-tab").on("click", (event) => {
                const tabName = $(event.currentTarget).data("tab");
    
                // Remove active class from all buttons
                html.find(".status-tab").removeClass("active");
    
                // Add active class to clicked button
                $(event.currentTarget).addClass("active");
    
                // Hide all tab content, then show the selected one
                html.find(".tab-content").hide();
                html.find(`.tab-content[data-tab='${tabName}']`).show();
    
                // 🔄 Save last selected tab
                game.settings.set("mist-hud", "lastSelectedTab", tabName);
    
                // 🔄 Adjust window size
                this.resetWindowSize();
    
                // Reinitialize draggable elements when switching tabs
                this.makeStatusesDraggable(html);
            });
        }
    
        // Initialize draggable statuses when the UI is rendered
        this.makeStatusesDraggable(html);
    
        // 📂 Import CSV
        html.find(".mh-import-csv").on("click", () => this.importCSV());
    
        // 🔄 Reset to Default
        html.find(".mh-reset-json").on("click", () => this.resetToDefault());
    
        // 📥 Download Sample CSV
        html.find(".mh-sample-csv").on("click", () => this.downloadSampleCSV());
    }

    resetWindowSize() {
        setTimeout(() => {
            const app = this.element;
            if (!app.length) return;
    
            // Auto-adjust the window size to fit content
            const content = app.find(".window-content");
    
            // Get the natural content width and height
            const newWidth = content[0].scrollWidth + 20;  // Add some padding
            const newHeight = content[0].scrollHeight + 40; 
    
            // Ensure the width doesn't keep expanding indefinitely
            const maxWidth = Math.min(newWidth, window.innerWidth * 0.55); // Limit to 90% of screen width
            const minWidth = 400; // Set a reasonable minimum width
    
            // Apply new size
            this.setPosition({
                width: Math.max(minWidth, maxWidth),
                height: newHeight
            });
    
        }, 50); // Small delay to allow Foundry to render content before resizing
    }
    
    
}

export default statusScreenApp;



