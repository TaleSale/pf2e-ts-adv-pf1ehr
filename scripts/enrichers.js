import { DataHandler } from "./data-handler.js";

export function registerEnrichers() {
    CONFIG.TextEditor.enrichers.push({
        pattern: /@Rebellion\[([^\]]+)\](?:{([^}]+)})?/gm,
        enricher: async (match, options) => {
            const config = match[1].split("|");
            const type = config[0]; // loyalty, notoriety, etc.
            const label = match[2] || (type === "notoriety" ? "Проверка Известности" : "Проверка Восстания");

            const a = document.createElement("a");
            a.classList.add("rebellion-link", "content-link");
            a.draggable = false;
            a.innerHTML = `<i class="fas fa-fist-raised"></i> ${label}`;

            a.addEventListener("click", async () => {
                if (type === "notoriety") {
                    await handleNotorietyCheck();
                } else {
                    const data = DataHandler.getRollData(type);
                    const roll = new Roll(`1d20 + ${data.total}`);
                    await roll.toMessage({
                        flavor: `<strong>${label}</strong><br>${data.breakdown}`
                    });
                }
            });

            return a;
        }
    });
}

async function handleNotorietyCheck() {
    const data = DataHandler.get();
    
    // Dialog to optionally add danger
    new Dialog({
        title: "Проверка Известности",
        content: `<p>Текущая Известность: <strong>${data.notoriety}</strong></p>
                  <p>Бросок d100. Если результат МЕНЬШЕ или РАВЕН, Трун замечает вас.</p>`,
        buttons: {
            roll: {
                label: "Бросить",
                callback: async () => {
                    const roll = new Roll("1d100");
                    await roll.evaluate();
                    
                    const isCaught = roll.total <= data.notoriety;
                    const resultText = isCaught 
                        ? `<span style="color:red; font-weight:bold">ПРОВАЛ! (Вас заметили)</span>` 
                        : `<span style="color:green">УСПЕХ! (Вы в тени)</span>`;

                    roll.toMessage({
                        flavor: `<strong>Проверка Известности</strong><br>Порог: ${data.notoriety}<br>${resultText}`
                    });
                }
            }
        }
    }).render(true);
}