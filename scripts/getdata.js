import { MistHUDData } from './mh-data.js';

function logPlayerCharacterData() {
    const actors = game.actors.filter(actor => actor.hasPlayerOwner && actor.type === "character");

    if (!actors.length) {
        console.warn("No player characters found.");
        return;
    }

    actors.forEach(actor => {
        const mistHUDData = new MistHUDData(actor);
        const allTags = actor.items.contents.filter(item => item.type === "tag" && item.system);

        // Organize subtags
        const subTagsByParent = mistHUDData.getSubtags(allTags);

        // Fetch Themes
        const themes = mistHUDData.getThemes();

        // Fetch Loadout and Story Tags
        const loadoutTags = mistHUDData.getLoadoutTags(); // Fetch with activated state handled in mh-data.js
        const storyTags = allTags.filter(tag => tag.system.subtype === 'story');

        // Output Character Info
        console.log(`Character Name: ${actor.name}`);
        console.log(`Token Image: ${actor.prototypeToken.texture.src}`);

        // Output Themes and Associated Tags
        console.log("Themes:");
        themes.forEach(theme => {
            console.log(`- Theme Name: ${theme.themeName}`);
            console.log(`  Themebook: ${theme.localizedThemebookName}`);
            console.log(`  Mystery: ${theme.mystery}`);

            // Fetch Power and Weakness Tags for the Current Theme
            const powerTags = allTags.filter(tag => tag.system.theme_id === theme.themeId && tag.system.subtype === 'power');
            const weaknessTags = allTags.filter(tag => tag.system.theme_id === theme.themeId && tag.system.subtype === 'weakness');

            // Print Power Tags
            printTagsByType("Power Tags", powerTags, subTagsByParent);

            // Print Weakness Tags
            printTagsByType("Weakness Tags", weaknessTags, subTagsByParent);
        });

        // Output Global Tags
        console.log("Story Tags:");
        printTagsByType("Story Tags", storyTags, subTagsByParent);

        console.log("Loadout Tags:");
        printLoadoutTags(loadoutTags);
    });
}

function printTagsByType(label, tags, subTagsByParent) {
    if (label) console.log(`${label}:`);
    tags.forEach(tag => {
        printTagWithSubtags(tag, subTagsByParent, 0);
    });
}

function printLoadoutTags(tags) {
    console.log("Loadout Tags:");
    tags.forEach(tag => {
        const burnState = tag.burnState || "Unburned";
        const invertedState = tag.invertedState || "Normal";
        const activatedState = tag.activatedState ? "Activated" : "Inactive"; // Handle boolean state here

        console.log(`- ${tag.name} (Burn: ${burnState}, Inversion: ${invertedState}, Loadout: ${activatedState})`);
        if (tag.subtags && tag.subtags.length > 0) {
            tag.subtags.forEach(subtag => {
                console.log(`  -- ${subtag.name} (Burn: ${subtag.burnState}, Inversion: ${subtag.invertedState})`);
            });
        }
    });
}

function printTagWithSubtags(tag, subTagsByParent, level) {
    const indent = "  ".repeat(level);
    const burnState = tag.system.burned ? "Burned" : "Unburned";
    const invertedState = tag.system.inverted ? "Inverted" : "Normal";

    console.log(`${indent}- ${tag.name} (Burn: ${burnState}, Inversion: ${invertedState})`);

    const subtags = subTagsByParent[tag._id] || [];
    subtags.forEach(subtag => {
        printTagWithSubtags(subtag, subTagsByParent, level + 1);
    });
}

window.logPlayerCharacterData = logPlayerCharacterData;
