export function getReceivedBonuses(receiverActor) {
    if (!receiverActor) return [];
    const messages = [];
    console.log("Scanning for bonuses for actor id:", receiverActor.id);

    // O problema pode estar aqui:
    const activeBonuses = receiverActor.getFlag("mist-hud", "received-bonuses") || {}; // Alterado de active-bonuses para received-bonuses

    for (const provider of game.actors.contents) {
        if (provider.id === receiverActor.id) continue;
        console.log(`Checking provider ${provider.name} with id ${provider.id}:`, activeBonuses);
        
        if (activeBonuses[provider.id]?.type === "help") {
            messages.push({
                giverName: provider.name,
                type: "help",
                amount: activeBonuses[provider.id].amount
            });
        }
        if (activeBonuses[provider.id]?.type === "hurt") {
            messages.push({
                giverName: provider.name,
                type: "hurt",
                amount: activeBonuses[provider.id].amount
            });
        }
    }

    console.log("Found bonus messages:", messages);
    return messages;
}
