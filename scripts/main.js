import { DataHandler } from "./data-handler.js";
import { RebellionSheet } from "./sheet.js";
import { PF2E_SKILL_LABELS, CHECK_LABELS, CATEGORY_LABELS } from "./config.js";
import { getTeamDefinition, getEarnIncomeDC, calculateEarnIncome, formatIncome, getHalfRankBonus, getTeamProficiencyBonus } from "./teams.js";
import { getAllyData } from "./allies.js";

/**
 * Get readable category name
 */
function getCategoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
}

/**
 * Get manager display name (actor name instead of ID)
 */
function getManagerDisplayName(managerId) {
    if (!managerId) return "";
    
    // Try to find actor by ID first
    const actor = game.actors.get(managerId);
    if (actor) return actor.name;
    
    // Try to find ally by slug
    const allyData = getAllyData(managerId);
    if (allyData) return allyData.name;
    
    // If it's already a name (not an ID), return as is
    return managerId;
}

Hooks.once("init", () => {

    // Register @Rebellion enricher for inline check buttons
    CONFIG.TextEditor.enrichers.push({
        // Pattern: @Rebellion[type:notoriety] @Rebellion[type:notoriety/2] @Rebellion[type:notoriety*2] 
        // @Rebellion[type:notoriety+dangers] @Rebellion[type:dangers] 
        // @Rebellion[type:loyalty|dc:10] @Rebellion[type:security|dc:15] @Rebellion[type:secrecy|dc:20]
        pattern: /@Rebellion\[type:([^\]|]+)(?:\|dc:(\d+))?\]/gi,
        enricher: (match, options) => {
            const typeExpr = match[1]; // e.g. "notoriety", "notoriety/2", "notoriety+dangers", "loyalty"
            const dcParam = match[2]; // e.g. "10" or undefined
            
            const a = document.createElement("a");
            a.classList.add("rebellion-inline-check");
            a.dataset.type = typeExpr;
            if (dcParam) a.dataset.dc = dcParam;
            
            // Generate label based on type
            let label = "";
            let icon = "fa-dice-d20";
            
            if (typeExpr === "notoriety") {
                label = "Известность";
                icon = "fa-eye";
            } else if (typeExpr === "notoriety/2") {
                label = "Известность ÷2";
                icon = "fa-eye";
            } else if (typeExpr === "notoriety*2") {
                label = "Известность ×2";
                icon = "fa-eye";
            } else if (typeExpr === "notoriety+dangers") {
                label = "Известность + Опасность";
                icon = "fa-eye";
            } else if (typeExpr === "(notoriety+dangers)/2") {
                label = "(Известность + Опасность) ÷2";
                icon = "fa-eye";
            } else if (typeExpr === "(notoriety+dangers)*2") {
                label = "(Известность + Опасность) ×2";
                icon = "fa-eye";
            } else if (typeExpr === "dangers") {
                label = "Опасность";
                icon = "fa-skull-crossbones";
            } else if (typeExpr === "loyalty") {
                label = dcParam ? `Верность КС ${dcParam}` : "Верность";
                icon = "fa-heart";
            } else if (typeExpr === "security") {
                label = dcParam ? `Безопасность КС ${dcParam}` : "Безопасность";
                icon = "fa-shield-alt";
            } else if (typeExpr === "secrecy") {
                label = dcParam ? `Секретность КС ${dcParam}` : "Секретность";
                icon = "fa-user-secret";
            } else {
                label = typeExpr;
            }
            
            // Создаем контейнер для кнопки и кнопки отправки в чат
            const container = document.createElement("span");
            container.style.cssText = `
                display: inline-flex;
                align-items: center;
            `;
            
            // Основная кнопка броска
            a.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
            a.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
                color: white;
                border-radius: 4px 0 0 4px;
                cursor: pointer;
                font-size: 0.9em;
                text-decoration: none;
                border: 1px solid #718096;
                border-right: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                line-height: 1;
                height: auto;
            `;
            
            // Кнопка отправки в чат - простая иконка
            const chatButton = document.createElement("a");
            chatButton.classList.add("rebellion-chat-btn");
            chatButton.dataset.type = typeExpr;
            if (dcParam) chatButton.dataset.dc = dcParam;
            chatButton.innerHTML = `<i class="fas fa-comment"></i>`;
            chatButton.title = "Отправить в чат";
            chatButton.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 8px;
                background: #718096;
                color: white;
                border-radius: 0 4px 4px 0;
                cursor: pointer;
                font-size: 0.9em;
                text-decoration: none;
                border: 1px solid #718096;
                border-left: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                line-height: 1;
                height: auto;
            `;
            
            container.appendChild(a);
            container.appendChild(chatButton);
            
            return container;
        }
    });

    // Register @Rebellion[%] enricher for d100 rolls
    // Patterns: @Rebellion[%], @Rebellion[%|dc:20], @Rebellion[%+danger], @Rebellion[%+danger|dc:20]
    CONFIG.TextEditor.enrichers.push({
        pattern: /@Rebellion\[%(\+danger)?(?:\|dc:(\d+))?\]/gi,
        enricher: (match, options) => {
            const hasDanger = !!match[1]; // "+danger" or undefined
            const dcParam = match[2]; // e.g. "20" or undefined
            
            const a = document.createElement("a");
            a.classList.add("rebellion-percent-check");
            a.dataset.hasDanger = hasDanger ? "true" : "false";
            if (dcParam) a.dataset.dc = dcParam;
            
            // Generate label
            let label = "";
            const icon = "fa-percent";
            
            if (hasDanger) {
                label = dcParam ? `d100 + Опасность КС ${dcParam}` : "d100 + Опасность";
            } else {
                label = dcParam ? `d100 КС ${dcParam}` : "d100";
            }
            
            // Создаем контейнер для кнопки и кнопки отправки в чат
            const container = document.createElement("span");
            container.style.cssText = `
                display: inline-flex;
                align-items: center;
            `;
            
            // Основная кнопка броска
            a.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
            a.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
                color: white;
                border-radius: 4px 0 0 4px;
                cursor: pointer;
                font-size: 0.9em;
                text-decoration: none;
                border: 1px solid #718096;
                border-right: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                line-height: 1;
                height: auto;
            `;
            
            // Кнопка отправки в чат
            const chatButton = document.createElement("a");
            chatButton.classList.add("rebellion-percent-chat-btn");
            chatButton.dataset.hasDanger = hasDanger ? "true" : "false";
            if (dcParam) chatButton.dataset.dc = dcParam;
            chatButton.innerHTML = `<i class="fas fa-comment"></i>`;
            chatButton.title = "Отправить в чат";
            chatButton.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 8px;
                background: #718096;
                color: white;
                border-radius: 0 4px 4px 0;
                cursor: pointer;
                font-size: 0.9em;
                text-decoration: none;
                border: 1px solid #718096;
                border-left: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                line-height: 1;
                height: auto;
            `;
            
            container.appendChild(a);
            container.appendChild(chatButton);
            
            return container;
        }
    });

    // Register @Rebellion[(1d6)[supporters]] enricher for dice rolls with adjustment buttons
    // Patterns: @Rebellion[(1d6)[supporters]], @Rebellion[(1d6)[notoriety]], @Rebellion[(1d6)[treasury]]
    CONFIG.TextEditor.enrichers.push({
        pattern: /@Rebellion\[\(([^)]+)\)\[([^\]]+)\]\]/gi,
        enricher: (match, options) => {
            const diceExpr = match[1]; // e.g. "1d6"
            const statType = match[2]; // e.g. "supporters", "notoriety", "treasury"
            
            const a = document.createElement("a");
            a.classList.add("rebellion-dice-roll");
            a.dataset.dice = diceExpr;
            a.dataset.stat = statType;
            
            let label = "";
            let icon = "fa-dice";
            
            if (statType === "supporters") {
                label = `${diceExpr} Сторонники`;
                icon = "fa-users";
            } else if (statType === "notoriety") {
                label = `${diceExpr} Известность`;
                icon = "fa-eye";
            } else if (statType === "treasury") {
                label = `${diceExpr} Казна`;
                icon = "fa-coins";
            } else {
                label = `${diceExpr} ${statType}`;
            }
            
            // Создаем контейнер для кнопки и кнопки отправки в чат
            const container = document.createElement("span");
            container.style.cssText = `
                display: inline-flex;
                align-items: center;
            `;
            
            // Основная кнопка броска
            a.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
            a.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
                color: white;
                border-radius: 4px 0 0 4px;
                cursor: pointer;
                font-size: 0.9em;
                text-decoration: none;
                border: 1px solid #718096;
                border-right: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                line-height: 1;
                height: auto;
            `;
            
            // Кнопка отправки в чат
            const chatButton = document.createElement("a");
            chatButton.classList.add("rebellion-dice-chat-btn");
            chatButton.dataset.dice = diceExpr;
            chatButton.dataset.stat = statType;
            chatButton.innerHTML = `<i class="fas fa-comment"></i>`;
            chatButton.title = "Отправить в чат";
            chatButton.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 8px;
                background: #718096;
                color: white;
                border-radius: 0 4px 4px 0;
                cursor: pointer;
                font-size: 0.9em;
                text-decoration: none;
                border: 1px solid #718096;
                border-left: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                line-height: 1;
                height: auto;
            `;
            
            container.appendChild(a);
            container.appendChild(chatButton);
            
            return container;
        }
    });

    // Handlebars helpers
    Handlebars.registerHelper("plus", (a, b) => Number(a) + Number(b));
    Handlebars.registerHelper("or", (...args) => {
        // Убираем последний аргумент (это объект options от Handlebars)
        const values = args.slice(0, -1);
        return values.some(v => !!v);
    });
    Handlebars.registerHelper("eq", (a, b) => a === b);
    Handlebars.registerHelper("ne", (a, b) => a !== b);
    Handlebars.registerHelper("gt", (a, b) => a > b);
    Handlebars.registerHelper("gte", (a, b) => a >= b);
    Handlebars.registerHelper("lt", (a, b) => a < b);
    Handlebars.registerHelper("debug", (value, label) => {
        console.log(`🔍 TEMPLATE DEBUG ${label}:`, value);
        return "";
    });

    DataHandler.init();
});

Hooks.once("ready", () => {
    console.log("Rebellion: Module ready, setting up reroll integration");

    // Function to perform rebellion roll
    async function performRebellionRoll(typeExpr, dcParam, ev) {
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        
        let checkType = null;
        let dc = dcParam;
        let checkLabel = "";
        
        // Parse type expression
        if (typeExpr === "notoriety") {
            checkType = null; // Простой d100 бросок без модификаторов восстания
            dc = data.notoriety || 0;
            checkLabel = `Известность (КС ${dc})`;
        } else if (typeExpr === "notoriety/2") {
            checkType = null; // Простой d100 бросок без модификаторов восстания
            dc = Math.floor((data.notoriety || 0) / 2);
            checkLabel = `Известность ÷2 (КС ${dc})`;
        } else if (typeExpr === "notoriety*2") {
            checkType = null; // Простой d100 бросок без модификаторов восстания
            dc = (data.notoriety || 0) * 2;
            checkLabel = `Известность ×2 (КС ${dc})`;
        } else if (typeExpr === "notoriety+dangers") {
            checkType = null; // Простой d100 бросок без модификаторов восстания
            const effectiveDanger = DataHandler.getEffectiveDanger(data);
            dc = (data.notoriety || 0) + effectiveDanger;
            checkLabel = `Известность + Опасность (КС ${dc})`;
        } else if (typeExpr === "(notoriety+dangers)/2") {
            checkType = null; // Простой d100 бросок без модификаторов восстания
            const effectiveDanger = DataHandler.getEffectiveDanger(data);
            dc = Math.floor(((data.notoriety || 0) + effectiveDanger) / 2);
            checkLabel = `(Известность + Опасность) ÷2 (КС ${dc})`;
        } else if (typeExpr === "(notoriety+dangers)*2") {
            checkType = null; // Простой d100 бросок без модификаторов восстания
            const effectiveDanger = DataHandler.getEffectiveDanger(data);
            dc = ((data.notoriety || 0) + effectiveDanger) * 2;
            checkLabel = `(Известность + Опасность) ×2 (КС ${dc})`;
        } else if (typeExpr === "dangers") {
            checkType = null; // Простой d100 бросок без модификаторов восстания
            dc = DataHandler.getEffectiveDanger(data);
            checkLabel = `Опасность (КС ${dc})`;
        } else if (typeExpr === "loyalty") {
            checkType = "loyalty";
            checkLabel = dc ? `Верность (КС ${dc})` : "Верность";
        } else if (typeExpr === "security") {
            checkType = "security";
            checkLabel = dc ? `Безопасность (КС ${dc})` : "Безопасность";
        } else if (typeExpr === "secrecy") {
            checkType = "secrecy";
            checkLabel = dc ? `Секретность (КС ${dc})` : "Секретность";
        }
        
        // Check if this is a d100 check (notoriety/danger related)
        const isD100Check = (typeExpr === "notoriety" || typeExpr === "notoriety/2" || typeExpr === "notoriety*2" || typeExpr === "notoriety+dangers" || typeExpr === "(notoriety+dangers)/2" || typeExpr === "(notoriety+dangers)*2" || typeExpr === "dangers");
        
        if (!checkType && !isD100Check) {
            ui.notifications.error(`Неизвестный тип проверки: ${typeExpr}`);
            return;
        }
        
        // For notoriety checks, use empty bonus (no rebellion modifiers)
        const checkBonus = checkType ? bonuses[checkType] : { total: 0, parts: [] };
        
        if (isD100Check) {
            // Create dialog title without DC
            let dialogTitle = "";
            if (typeExpr === "notoriety") {
                dialogTitle = "Бросок: Известность";
            } else if (typeExpr === "notoriety/2") {
                dialogTitle = "Бросок: Известность ÷2";
            } else if (typeExpr === "notoriety*2") {
                dialogTitle = "Бросок: Известность ×2";
            } else if (typeExpr === "notoriety+dangers") {
                dialogTitle = "Бросок: Известность + Опасность";
            } else if (typeExpr === "(notoriety+dangers)/2") {
                dialogTitle = "Бросок: (Известность + Опасность) ÷2";
            } else if (typeExpr === "(notoriety+dangers)*2") {
                dialogTitle = "Бросок: (Известность + Опасность) ×2";
            } else if (typeExpr === "dangers") {
                dialogTitle = "Бросок: Опасность";
            }
            
            // Show dialog to get modifier for d100 checks
            let modifier = await Dialog.prompt({
                title: dialogTitle,
                content: `
                    <form>
                        <div class="form-group">
                            <label>Модификатор:</label>
                            <div class="form-fields">
                                <input type="number" value="0" />
                            </div>
                        </div>
                        ${dc ? `<div class="form-group"><label>КС: ${dc}</label></div>` : ""}
                    </form>
                `,
                callback: html => html.find('input').val(),
                close: () => null,
                rejectClose: false
            });
            
            if (modifier !== null) {
                const manualModifier = parseInt(modifier || 0);
                const totalModifier = manualModifier + checkBonus.total;
                const roll = await new Roll(`1d100 + ${totalModifier}`).roll({ async: true });
                const total = roll.total;
                
                let resultText = "";
                let resultColor = "#666";
                if (dc) {
                    const success = total >= dc;
                    resultText = success ? "✅ Успех!" : "❌ Провал!";
                    resultColor = success ? "#2e7d32" : "#c62828";
                }
                
                await ChatMessage.create({
                    roll: roll,
                    content: await roll.render(),
                    sound: CONFIG.sounds.dice,
                    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                    speaker: ChatMessage.getSpeaker(),
                    flags: {
                        pf2e: {
                            context: {
                                type: "skill-check",
                                skill: checkType,
                                action: checkType
                            }
                        }
                    }
                });
                
                // Create result message
                let modifierBreakdown = "";
                if (manualModifier !== 0) {
                    modifierBreakdown = `<div style="font-size: 0.9em; color: #666; margin-top: 4px;">Модификатор: ${manualModifier > 0 ? '+' : ''}${manualModifier}</div>`;
                } else if (checkBonus.total !== 0) {
                    // Only show rebellion bonus if it's not a notoriety check
                    const parts = [];
                    if (checkBonus.total !== 0) parts.push(`Восстание: ${checkBonus.total > 0 ? '+' : ''}${checkBonus.total}`);
                    if (manualModifier !== 0) parts.push(`Ручной: ${manualModifier > 0 ? '+' : ''}${manualModifier}`);
                    modifierBreakdown = `<div style="font-size: 0.9em; color: #666; margin-top: 4px;">Модификаторы: ${parts.join(', ')}</div>`;
                }
                
                const resultMessage = `
                    <div style="border: 2px solid ${resultColor}; padding: 10px; border-radius: 8px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);">
                        <h4 style="margin: 0 0 8px 0; color: #2d3748;">
                            <i class="fas fa-dice"></i> ${dialogTitle.replace("Бросок: ", "")}
                        </h4>
                        <div style="font-size: 1.1em;">
                            <strong>Результат: ${total}</strong>
                            ${dc ? `<span style="color: #666;"> против КС ${dc}</span>` : ""}
                        </div>
                        ${modifierBreakdown}
                        ${resultText ? `<div style="margin-top: 8px; font-weight: bold; color: ${resultColor};">${resultText}</div>` : ""}
                    </div>
                `;
                
                await ChatMessage.create({
                    content: resultMessage,
                    speaker: ChatMessage.getSpeaker()
                });
            }
            
        } else if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            // Use PF2e System Roll for other checks (d20)
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));
            
            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character");
            
            // Set state for result handling
            game.rebellionState = {
                isRebellionInlineCheck: true,
                checkType,
                checkLabel,
                dc,
                timestamp: Date.now()
            };
            
            await game.pf2e.Check.roll(
                new game.pf2e.CheckModifier(checkLabel, { modifiers }),
                {
                    actor: actor,
                    type: 'skill-check',
                    createMessage: true,
                    skipDialog: false,
                    dc: dc ? { value: dc } : undefined
                },
                ev
            );
        } else {
            // Fallback roll for d20 checks
            const roll = new Roll("1d20");
            await roll.evaluate();
            const total = roll.total + checkBonus.total;
            
            let resultText = "";
            let resultColor = "#666";
            if (dc) {
                const success = total >= dc;
                resultText = success ? "✅ Успех!" : "❌ Провал!";
                resultColor = success ? "#2e7d32" : "#c62828";
            }
            
            const message = `
                <div style="border: 2px solid #4a5568; padding: 10px; border-radius: 8px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);">
                    <h4 style="margin: 0 0 8px 0; color: #2d3748;">
                        <i class="fas fa-dice-d20"></i> ${checkLabel}
                    </h4>
                    <div style="font-size: 1.1em;">
                        <strong>1d20 (${roll.total}) + ${checkBonus.total} = ${total}</strong>
                        ${dc ? `<span style="color: #666;"> против КС ${dc}</span>` : ""}
                    </div>
                    ${resultText ? `<div style="margin-top: 8px; font-weight: bold; color: ${resultColor};">${resultText}</div>` : ""}
                </div>
            `;
            
            await ChatMessage.create({
                content: message,
                speaker: ChatMessage.getSpeaker(),
                flags: {
                    pf2e: {
                        context: {
                            type: "skill-check",
                            skill: checkType,
                            action: checkType
                        }
                    }
                }
            });
        }
    }

    // Global listener for @Rebellion chat buttons
    $(document).on('click', '.rebellion-chat-btn', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const target = ev.currentTarget;
        const typeExpr = target.dataset.type;
        const dcParam = target.dataset.dc ? parseInt(target.dataset.dc) : null;
        
        // Get button text for chat
        let buttonText = "";
        if (typeExpr === "notoriety") {
            buttonText = "Известность";
        } else if (typeExpr === "notoriety/2") {
            buttonText = "Известность ÷2";
        } else if (typeExpr === "notoriety*2") {
            buttonText = "Известность ×2";
        } else if (typeExpr === "notoriety+dangers") {
            buttonText = "Известность + Опасность";
        } else if (typeExpr === "(notoriety+dangers)/2") {
            buttonText = "(Известность + Опасность) ÷2";
        } else if (typeExpr === "(notoriety+dangers)*2") {
            buttonText = "(Известность + Опасность) ×2";
        } else if (typeExpr === "dangers") {
            buttonText = "Опасность";
        } else if (typeExpr === "loyalty") {
            buttonText = "Верность";
        } else if (typeExpr === "security") {
            buttonText = "Безопасность";
        } else if (typeExpr === "secrecy") {
            buttonText = "Секретность";
        } else {
            buttonText = typeExpr;
        }
        
        // Create simple button in chat
        const chatContent = `
            <button class="rebellion-roll-from-chat" 
                    data-type="${typeExpr}" 
                    data-dc="${dcParam || ''}"
                    style="background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%); color: white; border: 1px solid #718096; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">
                ${buttonText}
            </button>
        `;
        
        await ChatMessage.create({
            content: chatContent,
            speaker: ChatMessage.getSpeaker()
        });
    });

    // Global listener for roll buttons from chat
    $(document).on('click', '.rebellion-roll-from-chat', async (ev) => {
        ev.preventDefault();
        
        const button = ev.currentTarget;
        const typeExpr = button.dataset.type;
        const dcParam = button.dataset.dc ? parseInt(button.dataset.dc) : null;
        
        // Use the same function as the main button
        await performRebellionRoll(typeExpr, dcParam, ev);
        
        // Disable button after use
        button.disabled = true;
        button.style.opacity = '0.5';
        button.innerHTML = '<i class="fas fa-check"></i> Выполнено';
    });

    // Global listener for @Rebellion inline check buttons
    $(document).on('click', '.rebellion-inline-check', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const target = ev.currentTarget;
        const typeExpr = target.dataset.type;
        const dcParam = target.dataset.dc ? parseInt(target.dataset.dc) : null;
        
        // Use the same function as chat buttons
        await performRebellionRoll(typeExpr, dcParam, ev);
    });

    // Function to perform d100 percent roll
    async function performPercentRoll(hasDanger, dcParam) {
        const data = DataHandler.get();
        const effectiveDanger = hasDanger ? DataHandler.getEffectiveDanger(data) : 0;
        
        const dialogTitle = hasDanger ? "Бросок: d100 + Опасность" : "Бросок: d100";
        
        // Show dialog to get modifier
        let modifier = await Dialog.prompt({
            title: dialogTitle,
            content: `
                <form>
                    <div class="form-group">
                        <label>Модификатор:</label>
                        <div class="form-fields">
                            <input type="number" value="0" />
                        </div>
                    </div>
                    ${hasDanger ? `<div class="form-group"><label>Опасность: ${effectiveDanger}</label></div>` : ""}
                    ${dcParam ? `<div class="form-group"><label>КС: ${dcParam}</label></div>` : ""}
                </form>
            `,
            callback: html => html.find('input').val(),
            close: () => null,
            rejectClose: false
        });
        
        if (modifier !== null) {
            const manualModifier = parseInt(modifier || 0);
            const totalModifier = manualModifier + effectiveDanger;
            const roll = await new Roll(`1d100 + ${totalModifier}`).roll({ async: true });
            const total = roll.total;
            
            let resultText = "";
            let resultColor = "#666";
            if (dcParam) {
                const success = total < dcParam; // Меньше DC = провал для % бросков
                resultText = success ? "❌ Провал!" : "✅ Успех!";
                resultColor = success ? "#c62828" : "#2e7d32";
            }
            
            await ChatMessage.create({
                roll: roll,
                content: await roll.render(),
                sound: CONFIG.sounds.dice,
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                speaker: ChatMessage.getSpeaker()
            });
            
            // Create result message
            let modifierBreakdown = "";
            if (effectiveDanger !== 0 || manualModifier !== 0) {
                const parts = [];
                if (effectiveDanger !== 0) parts.push(`Опасность: ${effectiveDanger > 0 ? '+' : ''}${effectiveDanger}`);
                if (manualModifier !== 0) parts.push(`Ручной: ${manualModifier > 0 ? '+' : ''}${manualModifier}`);
                modifierBreakdown = `<div style="font-size: 0.9em; color: #666; margin-top: 4px;">Модификаторы: ${parts.join(', ')}</div>`;
            }
            
            const labelText = hasDanger ? "d100 + Опасность" : "d100";
            const resultMessage = `
                <div style="border: 2px solid ${dcParam ? resultColor : '#6b46c1'}; padding: 10px; border-radius: 8px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);">
                    <h4 style="margin: 0 0 8px 0; color: #2d3748;">
                        <i class="fas fa-percent"></i> ${labelText}
                    </h4>
                    <div style="font-size: 1.1em;">
                        <strong>Результат: ${total}</strong>
                        ${dcParam ? `<span style="color: #666;"> против КС ${dcParam}</span>` : ""}
                    </div>
                    ${modifierBreakdown}
                    ${resultText ? `<div style="margin-top: 8px; font-weight: bold; color: ${resultColor};">${resultText}</div>` : ""}
                </div>
            `;
            
            await ChatMessage.create({
                content: resultMessage,
                speaker: ChatMessage.getSpeaker()
            });
        }
    }

    // Global listener for @Rebellion[%] inline check buttons
    $(document).on('click', '.rebellion-percent-check', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const target = ev.currentTarget;
        const hasDanger = target.dataset.hasDanger === "true";
        const dcParam = target.dataset.dc ? parseInt(target.dataset.dc) : null;
        
        await performPercentRoll(hasDanger, dcParam);
    });

    // Global listener for @Rebellion[%] chat buttons
    $(document).on('click', '.rebellion-percent-chat-btn', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const target = ev.currentTarget;
        const hasDanger = target.dataset.hasDanger === "true";
        const dcParam = target.dataset.dc ? parseInt(target.dataset.dc) : null;
        
        // Get button text for chat
        let buttonText = hasDanger ? "d100 + Опасность" : "d100";
        if (dcParam) buttonText += ` КС ${dcParam}`;
        
        // Create button in chat
        const chatContent = `
            <button class="rebellion-percent-roll-from-chat" 
                    data-has-danger="${hasDanger}" 
                    data-dc="${dcParam || ''}"
                    style="background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%); color: white; border: 1px solid #805ad5; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">
                <i class="fas fa-percent"></i> ${buttonText}
            </button>
        `;
        
        await ChatMessage.create({
            content: chatContent,
            speaker: ChatMessage.getSpeaker()
        });
    });

    // Global listener for percent roll buttons from chat
    $(document).on('click', '.rebellion-percent-roll-from-chat', async (ev) => {
        ev.preventDefault();
        
        const button = ev.currentTarget;
        const hasDanger = button.dataset.hasDanger === "true";
        const dcParam = button.dataset.dc ? parseInt(button.dataset.dc) : null;
        
        await performPercentRoll(hasDanger, dcParam);
        
        // Disable button after use
        button.disabled = true;
        button.style.opacity = '0.5';
        button.innerHTML = '<i class="fas fa-check"></i> Выполнено';
    });
    
    // Global listener for @Rebellion dice roll buttons
    $(document).on('click', '.rebellion-dice-roll', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const target = ev.currentTarget;
        const diceExpr = target.dataset.dice;
        const statType = target.dataset.stat;
        
        // Perform the dice roll
        const roll = await new Roll(diceExpr).roll({ async: true });
        const result = roll.total;
        
        let statLabel = "";
        let icon = "fa-dice";
        
        if (statType === "supporters") {
            statLabel = "Сторонники";
            icon = "fa-users";
        } else if (statType === "notoriety") {
            statLabel = "Известность";
            icon = "fa-eye";
        } else if (statType === "treasury") {
            statLabel = "Казна";
            icon = "fa-coins";
        } else {
            statLabel = statType;
        }
        
        // Create chat message with roll and adjustment buttons
        await ChatMessage.create({
            roll: roll,
            content: await roll.render(),
            sound: CONFIG.sounds.dice,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            speaker: ChatMessage.getSpeaker()
        });
        
        // Create result message with adjustment buttons
        const resultMessage = `
            <div style="border: 2px solid #667eea; padding: 10px; border-radius: 8px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);">
                <h5 style="margin: 0 0 8px 0; color: #2d3748; font-size: 1.1em;">
                    <i class="fas ${icon}"></i> ${statLabel}: ${result}
                </h5>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="rebellion-adjust-stat" 
                            data-stat="${statType}" 
                            data-value="${result}" 
                            data-operation="add"
                            style="background: #48bb78; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-plus"></i> Добавить ${result}
                    </button>
                    <button class="rebellion-adjust-stat" 
                            data-stat="${statType}" 
                            data-value="${result}" 
                            data-operation="subtract"
                            style="background: #f56565; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-minus"></i> Отнять ${result}
                    </button>
                </div>
            </div>
        `;
        
        await ChatMessage.create({
            content: resultMessage,
            speaker: ChatMessage.getSpeaker()
        });
    });

    // Global listener for @Rebellion dice chat buttons
    $(document).on('click', '.rebellion-dice-chat-btn', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const target = ev.currentTarget;
        const diceExpr = target.dataset.dice;
        const statType = target.dataset.stat;
        
        let statLabel = "";
        let icon = "fa-dice";
        
        if (statType === "supporters") {
            statLabel = "Сторонники";
            icon = "fa-users";
        } else if (statType === "notoriety") {
            statLabel = "Известность";
            icon = "fa-eye";
        } else if (statType === "treasury") {
            statLabel = "Казна";
            icon = "fa-coins";
        } else {
            statLabel = statType;
        }
        
        // Create button in chat
        const chatContent = `
            <button class="rebellion-dice-roll-from-chat" 
                    data-dice="${diceExpr}" 
                    data-stat="${statType}"
                    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: 1px solid #667eea; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">
                <i class="fas ${icon}"></i> ${diceExpr} ${statLabel}
            </button>
        `;
        
        await ChatMessage.create({
            content: chatContent,
            speaker: ChatMessage.getSpeaker()
        });
    });

    // Global listener for dice roll buttons from chat
    $(document).on('click', '.rebellion-dice-roll-from-chat', async (ev) => {
        ev.preventDefault();
        
        const button = ev.currentTarget;
        const diceExpr = button.dataset.dice;
        const statType = button.dataset.stat;
        
        // Perform the dice roll directly (same logic as main handler)
        const roll = await new Roll(diceExpr).roll({ async: true });
        const result = roll.total;
        
        let statLabel = "";
        let icon = "fa-dice";
        
        if (statType === "supporters") {
            statLabel = "Сторонники";
            icon = "fa-users";
        } else if (statType === "notoriety") {
            statLabel = "Известность";
            icon = "fa-eye";
        } else if (statType === "treasury") {
            statLabel = "Казна";
            icon = "fa-coins";
        } else {
            statLabel = statType;
        }
        
        // Create chat message with roll and adjustment buttons
        await ChatMessage.create({
            roll: roll,
            content: await roll.render(),
            sound: CONFIG.sounds.dice,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            speaker: ChatMessage.getSpeaker()
        });
        
        // Create result message with adjustment buttons
        const resultMessage = `
            <div style="border: 2px solid #667eea; padding: 10px; border-radius: 8px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);">
                <h5 style="margin: 0 0 8px 0; color: #2d3748; font-size: 1.1em;">
                    <i class="fas ${icon}"></i> ${statLabel}: ${result}
                </h5>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="rebellion-adjust-stat" 
                            data-stat="${statType}" 
                            data-value="${result}" 
                            data-operation="add"
                            style="background: #48bb78; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-plus"></i> Добавить ${result}
                    </button>
                    <button class="rebellion-adjust-stat" 
                            data-stat="${statType}" 
                            data-value="${result}" 
                            data-operation="subtract"
                            style="background: #f56565; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-minus"></i> Отнять ${result}
                    </button>
                </div>
            </div>
        `;
        
        await ChatMessage.create({
            content: resultMessage,
            speaker: ChatMessage.getSpeaker()
        });
        
        // Disable button after use
        button.disabled = true;
        button.style.opacity = '0.5';
        button.innerHTML = '<i class="fas fa-check"></i> Выполнено';
    });

    // Global listener for stat adjustment buttons
    $(document).on('click', '.rebellion-adjust-stat', async (ev) => {
        ev.preventDefault();
        
        const button = ev.currentTarget;
        const statType = button.dataset.stat;
        const value = parseInt(button.dataset.value);
        const operation = button.dataset.operation;
        
        const data = DataHandler.get();
        let oldValue, newValue;
        let updateData = {};
        
        if (statType === "supporters") {
            oldValue = data.supporters;
            newValue = operation === "add" ? data.supporters + value : Math.max(0, data.supporters - value);
            updateData.supporters = newValue;
        } else if (statType === "notoriety") {
            oldValue = data.notoriety;
            newValue = operation === "add" ? Math.min(100, data.notoriety + value) : Math.max(0, data.notoriety - value);
            updateData.notoriety = newValue;
        } else if (statType === "treasury") {
            oldValue = data.treasury;
            newValue = operation === "add" ? data.treasury + value : Math.max(0, data.treasury - value);
            updateData.treasury = newValue;
        }
        
        await DataHandler.update(updateData);
        
        // Log the change to phase report and chat
        let logMessage = "";
        let notificationText = "";
        
        if (statType === "supporters") {
            if (operation === "add") {
                logMessage = `Появляются новые сторонники (+${value}): ${oldValue} → ${newValue}`;
                notificationText = `Появляются новые сторонники (+${value}). Новое значение: ${newValue}`;
            } else {
                logMessage = `Уходят сторонники (-${value}): ${oldValue} → ${newValue}`;
                notificationText = `Уходят сторонники (-${value}). Новое значение: ${newValue}`;
            }
        } else if (statType === "notoriety") {
            if (operation === "add") {
                logMessage = `Известность увеличена (+${value}): ${oldValue} → ${newValue}`;
                notificationText = `Известность увеличена (+${value}). Новое значение: ${newValue}`;
            } else {
                logMessage = `Известность падает (-${value}): ${oldValue} → ${newValue}`;
                notificationText = `Известность падает (-${value}). Новое значение: ${newValue}`;
            }
        } else if (statType === "treasury") {
            if (operation === "add") {
                logMessage = `Казна пополнена (+${value} зм): ${oldValue} → ${newValue}`;
                notificationText = `Казна пополнена (+${value} зм). Новое значение: ${newValue}`;
            } else {
                logMessage = `Казна истощается (-${value} зм): ${oldValue} → ${newValue}`;
                notificationText = `Казна истощается (-${value} зм). Новое значение: ${newValue}`;
            }
        }
        
        const changeText = operation === "add" ? `+${value}` : `-${value}`;
        
        // Add to phase report with beautiful card
        const currentData = DataHandler.get();
        let icon = "";
        let color = "";
        
        if (statType === "supporters") {
            icon = "👥";
            color = operation === "add" ? "#27ae60" : "#e74c3c";
        } else if (statType === "notoriety") {
            icon = "⚠️";
            color = operation === "add" ? "#e74c3c" : "#27ae60";
        } else if (statType === "treasury") {
            icon = "💰";
            color = operation === "add" ? "#27ae60" : "#e74c3c";
        }
        
        const journalCard = `
            <div style="
                border: 2px solid ${color}; 
                padding: 15px; 
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); 
                border-radius: 10px; 
                margin: 10px 0; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <span style="font-size: 1.8em;">${icon}</span>
                    <div>
                        <h5 style="margin: 0; color: ${color}; font-size: 1.2em;">
                            ${logMessage.split(':')[0]}
                        </h5>
                        <div style="color: #6c757d; font-size: 0.9em; margin-top: 2px;">
                            ${new Date().toLocaleString('ru-RU')}
                        </div>
                    </div>
                </div>
                
                <div style="
                    background: rgba(0,0,0,0.05); 
                    padding: 12px; 
                    border-radius: 6px; 
                    font-family: monospace;
                    border-left: 4px solid ${color};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #495057; font-weight: 500;">
                            Изменение: <strong style="color: ${color};">${changeText}</strong>
                        </span>
                        <span style="color: #6c757d;">
                            ${oldValue} → <strong style="color: ${color};">${newValue}</strong>
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        const newPhaseReport = (currentData.phaseReport || "") + journalCard;
        await DataHandler.update({ phaseReport: newPhaseReport });
        
        // Create chat message
        const chatMessage = `
            <div style="border: 2px solid #667eea; padding: 15px; border-radius: 8px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);">
                <h5 style="margin: 0 0 8px 0; color: #2d3748; font-size: 1.1em;">
                    <i class="fas ${statType === 'supporters' ? 'fa-users' : statType === 'notoriety' ? 'fa-eye' : 'fa-coins'}"></i> 
                    ${logMessage.split(':')[0]}
                </h5>
                <div style="color: #666; font-size: 0.9em;">
                    Изменение: <strong style="color: ${operation === 'add' ? '#27ae60' : '#e74c3c'};">${changeText}</strong>
                </div>
            </div>
        `;
        
        await ChatMessage.create({
            content: chatMessage,
            speaker: ChatMessage.getSpeaker()
        });
        
        ui.notifications.info(notificationText);
        
        // Disable button after use
        button.disabled = true;
        button.style.opacity = '0.5';
        button.innerHTML = `<i class="fas fa-check"></i> ${changeText}`;
    });

    // Global listener for Rebellion mitigation buttons
    $(document).on('click', '.roll-mitigate-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onMitigateRoll(ev);
    });

    // Global listener for Player Skill mitigation buttons
    $(document).on('click', '.pf2e-mitigation-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onPlayerSkillRoll(ev);
    });

    // Global listener for Stukach roll buttons
    $(document).on('click', '.roll-stukach-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onStukachRoll(ev);
    });
    
    // Global listener for Failed Protest roll buttons
    $(document).on('click', '.roll-failed-protest-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onFailedProtestRoll(ev);
    });

    // Global listener for Catastrophic Mission roll buttons
    $(document).on('click', '.roll-catastrophic-mission-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onCatastrophicMissionRoll(ev);
    });

    // Global listener for Ally Danger roll buttons
    $(document).on('click', '.roll-ally-danger-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onAllyDangerRoll(ev);
    });

    // Global listener for Traitor roll buttons
    $(document).on('click', '.roll-traitor-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorRoll(ev);
    });

    // Global listeners for Traitor action buttons (removed traitor-redeem-btn)

    $(document).on('click', '.traitor-execute-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorExecute(ev);
    });

    $(document).on('click', '.traitor-exile-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorExile(ev);
    });

    $(document).on('click', '.traitor-imprison-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorImprison(ev);
    });

    $(document).on('click', '.traitor-execute-loyalty-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorExecuteLoyalty(ev);
    });

    $(document).on('click', '.traitor-exile-security-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorExileSecurity(ev);
    });

    $(document).on('click', '.traitor-persuade-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorPersuade(ev);
    });

    $(document).on('click', '.traitor-persuade-attempt-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorPersuadeAttempt(ev);
    });

    $(document).on('click', '.traitor-execute-from-prison-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorExecuteFromPrison(ev);
    });

    $(document).on('click', '.traitor-exile-from-prison-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorExileFromPrison(ev);
    });

    $(document).on('click', '.traitor-prison-secrecy-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorPrisonSecrecy(ev);
    });

    $(document).on('click', '.collect-supporters-bonus-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onCollectSupportersBonus(ev);
    });

    $(document).on('click', '.traitor-redeem-attempt-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onTraitorRedeemAttempt(ev);
    });

    // Global listener for Invasion ignore buttons
    $(document).on('click', '.invasion-ignore-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onIgnoreInvasion(ev);
    });

    // Global listener for Manipulate Events choice buttons (Cabalists)
    $(document).on('click', '.manipulate-choose-event-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onManipulateChooseEvent(ev);
    });

    // Global listener for Rescue Character result button
    $(document).on('click', '.rescue-result-btn', (ev) => {
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onRescueResult(ev);
    });

    // Add reroll buttons to chat messages after they're created
    Hooks.on('renderChatMessage', (message, html, data) => {
        // Обработка результатов @Rebellion inline check
        if (game.rebellionState?.isRebellionInlineCheck && message.isRoll) {
            const stateTimestamp = game.rebellionState.timestamp || 0;
            const messageTimestamp = message.timestamp || Date.now();
            if (messageTimestamp < stateTimestamp) {
                return;
            }
            
            console.log("Rebellion: Обработка результата @Rebellion inline check", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const { checkType, checkLabel, dc } = game.rebellionState;
                const total = roll.total;
                
                // Clear state
                game.rebellionState = null;
                
                // Show result if DC was specified
                if (dc) {
                    const success = total >= dc;
                    setTimeout(async () => {
                        const resultMessage = `
                            <div style="border: 2px solid ${success ? '#2e7d32' : '#c62828'}; padding: 10px; border-radius: 8px; background: ${success ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)'};">
                                <h4 style="margin: 0 0 8px 0; color: ${success ? '#2e7d32' : '#c62828'};">
                                    ${success ? '✅' : '❌'} ${checkLabel}
                                </h4>
                                <div style="font-size: 1.1em;">
                                    <strong>${total}</strong> против КС <strong>${dc}</strong>
                                </div>
                                <div style="margin-top: 8px; font-weight: bold; color: ${success ? '#2e7d32' : '#c62828'};">
                                    ${success ? 'Успех!' : 'Провал!'}
                                </div>
                            </div>
                        `;
                        
                        await ChatMessage.create({
                            content: resultMessage,
                            speaker: ChatMessage.getSpeaker(),
                            flags: { "pf2e-ts-adv-pf1ehr": { isRebellionInlineResult: true } }
                        });
                    }, 100);
                }
            }
            return;
        }
        
        // Обработка результатов броска найма команды
        if (game.rebellionState?.isHireTeamRoll && message.isRoll) {
            // Проверяем, что это не наше собственное сообщение с результатом
            if (message.flags?.["pf2e-ts-adv-pf1ehr"]?.isHireTeamResult) {
                return; // Игнорируем наши собственные сообщения с результатами
            }
            
            console.log("Rebellion: Обработка результата броска найма команды", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const { teamSlug, checkType, dc, teamDef } = game.rebellionState;
                const total = roll.total;
                const success = total >= dc;
                const rollResult = roll.dice[0]?.results?.[0]?.result || 1;
                const critFail = rollResult === 1;
                
                console.log(`Rebellion: Результат найма команды - ${total} vs DC ${dc}, успех: ${success}, критический провал: ${critFail}`);
                
                // Clear state immediately to prevent double processing
                const state = game.rebellionState;
                game.rebellionState = null;
                
                // Apply result immediately like other events
                setTimeout(async () => {
                    try {
                        const data = DataHandler.get();
                        
                        // Create beautiful hire message like in _handleHireTeamResult
                        let hireMessage = `
                            <div style="
                                border: 3px solid ${success ? '#2e7d32' : (critFail ? '#b71c1c' : '#d32f2f')}; 
                                padding: 15px; 
                                background: ${success ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : (critFail ? 'linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)' : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)')}; 
                                border-radius: 12px; 
                                margin: 10px 0; 
                                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                            ">
                                <h5 style="color: ${success ? '#2e7d32' : (critFail ? '#b71c1c' : '#d32f2f')}; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 2em;">${success ? '🤝' : (critFail ? '💥' : '❌')}</span>
                                    Найм команды: ${teamDef.label}
                                </h5>
                                
                                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                                    <img src="${teamDef.icon}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 3px solid ${success ? '#2e7d32' : (critFail ? '#b71c1c' : '#d32f2f')};">
                                    <div>
                                        <strong style="font-size: 1.2em; color: ${success ? '#2e7d32' : (critFail ? '#b71c1c' : '#d32f2f')};">${teamDef.label}</strong>
                                        <div style="color: #666; font-size: 0.9em; margin-top: 2px;">
                                            Ранг ${teamDef.rank} • ${getCategoryLabel(teamDef.category)}
                                        </div>
                                    </div>
                                </div>
                        `;

                        if (success) {
                            hireMessage += `
                                <div style="padding: 12px; background: rgba(46, 125, 50, 0.1); border-radius: 8px; border: 2px solid #2e7d32;">
                                    <strong style="color: #2e7d32;">✅ Успех! Команда нанята</strong>
                                    <div style="margin-top: 8px; color: #1b5e20;">
                                        🎉 ${teamDef.label} присоединилась к восстанию!
                                    </div>
                                </div>
                            `;
                            
                            // Add team to rebellion
                            const teams = JSON.parse(JSON.stringify(data.teams));
                            teams.push({
                                type: teamSlug,
                                currentAction: null,
                                disabled: false,
                                missing: false
                            });
                            
                            await DataHandler.update({ 
                                teams, 
                                actionsUsed: (data.actionsUsed || 0) + 1 
                            });
                            
                        } else if (critFail) {
                            hireMessage += `
                                <div style="padding: 12px; background: rgba(183, 28, 28, 0.1); border-radius: 8px; border: 2px solid #b71c1c;">
                                    <strong style="color: #b71c1c;">Критический провал!</strong>
                                    <div style="margin-top: 8px; color: #b71c1c;">
                                        Попытка найма провалилась катастрофически!
                                    </div>
                                </div>
                            `;
                            
                            await DataHandler.update({ 
                                actionsUsed: (data.actionsUsed || 0) + 1 
                            });
                            
                        } else {
                            hireMessage += `
                                <div style="padding: 12px; background: rgba(211, 47, 47, 0.1); border-radius: 8px; border: 2px solid #d32f2f;">
                                    <strong style="color: #d32f2f;">Неудача</strong>
                                    <div style="margin-top: 8px; color: #c62828;">
                                        Не удалось нанять команду. Попробуйте снова на следующей неделе.
                                    </div>
                                </div>
                            `;
                            
                            await DataHandler.update({ 
                                actionsUsed: (data.actionsUsed || 0) + 1 
                            });
                        }

                        hireMessage += `</div>`;
                        
                        await ChatMessage.create({
                            content: hireMessage,
                            speaker: ChatMessage.getSpeaker(),
                            flags: {
                                "pf2e-ts-adv-pf1ehr": {
                                    isHireTeamResult: true
                                }
                            }
                        });
                        
                        console.log("Rebellion: Результат найма команды обработан");
                        
                    } catch (error) {
                        console.error("Rebellion: Ошибка при обработке результата найма команды:", error);
                    }
                }, 100);
            }
            return;
        }

        // Обработка результатов броска бонусного действия Мантикке
        if (game.rebellionState?.isManticceBonusRoll && message.isRoll) {
            // Проверяем timestamp для защиты от повторной обработки
            const stateTimestamp = game.rebellionState.timestamp || 0;
            const messageTimestamp = message.timestamp || Date.now();
            if (messageTimestamp < stateTimestamp) {
                return;
            }
            
            console.log("Rebellion: Обработка результата броска бонусного действия Мантикке", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const { teamIdx, teamType, dc, totalMod } = game.rebellionState;
                const total = roll.total;
                
                console.log(`Rebellion: Результат бонусного действия Мантикке - ${total} vs DC ${dc}`);
                
                // Clear state immediately to prevent double processing
                game.rebellionState = null;
                
                // Apply result
                setTimeout(async () => {
                    try {
                        const data = DataHandler.get();
                        const team = data.teams[teamIdx];
                        if (!team) {
                            console.error("Rebellion: Команда не найдена при обработке результата");
                            return;
                        }
                        
                        const def = getTeamDefinition(team.type);
                        const teamRank = def.rank || 1;
                        
                        // Уровень задачи = уровень игрока (если игрок) или первого члена Party (если ГМ)
                        let playerLevel = 1;
                        if (!game.user.isGM && game.user.character) {
                            playerLevel = game.user.character.level || 1;
                        } else if (game.actors.party && game.actors.party.members && game.actors.party.members.length > 0) {
                            playerLevel = game.actors.party.members[0].level || 1;
                        } else {
                            const playerCharacter = game.actors.find(a => a.type === "character" && a.hasPlayerOwner);
                            if (playerCharacter) playerLevel = playerCharacter.level || 1;
                        }
                        
                        // Use PF2e Earn Income table
                        const earnIncomeResult = calculateEarnIncome(playerLevel, teamRank, total, dc);
                        const incomeInCopper = earnIncomeResult.income;
                        const incomeInGold = incomeInCopper / 100;
                        const formattedIncome = formatIncome(incomeInCopper);
                        
                        // Получаем sheet для создания сообщения
                        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
                        
                        const rollObj = {
                            total: roll.dice?.[0]?.results?.[0]?.result || roll.total,
                            result: roll.dice?.[0]?.results?.[0]?.result || roll.total
                        };
                        
                        // Determine result type
                        let resultType = earnIncomeResult.result;
                        const profLabel = { trained: 'Обученный', expert: 'Эксперт', master: 'Мастер' }[earnIncomeResult.proficiency] || earnIncomeResult.proficiency;
                        
                        let additionalInfo = `👑 <strong>Бонусное действие королевы Мантикке</strong><br>`;
                        additionalInfo += `<strong>Заработок Денег (7 дней)</strong><br>`;
                        additionalInfo += `Уровень: ${playerLevel}, Мастерство: ${profLabel}<br>`;
                        additionalInfo += `💰 Заработано: <strong>${formattedIncome}</strong>`;
                        
                        if (resultType === 'criticalSuccess') {
                            additionalInfo += `<br><em>Критический успех!</em>`;
                        } else if (resultType === 'criticalFailure') {
                            additionalInfo += `<br><em>Критический провал!</em>`;
                        }
                        
                        const chatMessage = sheet._createTeamActionMessage(
                            team, 'earnGold', 
                            resultType === 'criticalFailure' ? 'critical' : (resultType === 'failure' ? 'failure' : 'success'), 
                            rollObj, total, dc, additionalInfo
                        );
                        
                        ChatMessage.create({ content: chatMessage, speaker: ChatMessage.getSpeaker() });
                        await sheet._logToJournal(chatMessage);
                        
                        // Update treasury and mark bonus action as used
                        await DataHandler.update({ 
                            treasury: data.treasury + incomeInGold,
                            manticceBonusUsedThisWeek: true
                        });
                        
                        ui.notifications.info(`Бонусное действие выполнено! Заработано ${formattedIncome}.`);
                        
                        console.log("Rebellion: Результат бонусного действия Мантикке обработан");
                        
                        // Обновляем интерфейс
                        if (sheet.rendered) sheet.render();
                        
                    } catch (error) {
                        console.error("Rebellion: Ошибка при обработке результата бонусного действия Мантикке:", error);
                    }
                }, 100);
            }
            return;
        }

        // Обработка результатов броска действия Серебряных Воронов
        if (game.rebellionState?.isSilverRavensActionRoll && message.isRoll) {
            // Проверяем timestamp для защиты от повторной обработки
            const stateTimestamp = game.rebellionState.timestamp || 0;
            const messageTimestamp = message.timestamp || Date.now();
            if (messageTimestamp < stateTimestamp) {
                return;
            }
            
            console.log("Rebellion: Обработка результата броска Серебряных Воронов", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const { selectedAction, checkType, dc, totalMod } = game.rebellionState;
                const total = roll.total;
                const rollResult = roll.dice?.[0]?.results?.[0]?.result || roll.total;
                
                console.log(`Rebellion: Результат Серебряных Воронов - ${total} vs DC ${dc}, действие: ${selectedAction}`);
                
                // Clear state immediately to prevent double processing
                game.rebellionState = null;
                
                // Apply result
                setTimeout(async () => {
                    try {
                        const data = DataHandler.get();
                        const bonuses = DataHandler.getRollBonuses(data, selectedAction);
                        
                        // Создаем виртуальную команду Silver Ravens
                        const silverRavensTeam = {
                            label: "Серебряные Вороны",
                            type: "silverRavens",
                            currentAction: selectedAction,
                            manager: "",
                            bonus: 0,
                            isStrategistTarget: false
                        };
                        
                        // Получаем sheet для вызова _processSilverRavensActionResult
                        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
                        
                        // Создаем объект roll для передачи в обработчик
                        const rollObj = {
                            total: rollResult,
                            result: rollResult
                        };
                        
                        await sheet._processSilverRavensActionResult(silverRavensTeam, selectedAction, checkType, dc, rollObj, total, data, bonuses);
                        
                        console.log("Rebellion: Результат Серебряных Воронов обработан");
                        
                    } catch (error) {
                        console.error("Rebellion: Ошибка при обработке результата Серебряных Воронов:", error);
                    }
                }, 100);
            }
            return;
        }

        // Обработка результатов броска действия команды
        if (game.rebellionState?.isTeamActionRoll && message.isRoll) {
            // Проверяем, что это не наше собственное сообщение с результатом
            if (message.flags?.["pf2e-ts-adv-pf1ehr"]?.isTeamActionResult) {
                return; // Игнорируем наши собственные сообщения с результатами
            }
            
            // Проверяем, что сообщение создано после установки состояния (защита от повторной обработки)
            const stateTimestamp = game.rebellionState.timestamp || 0;
            const messageTimestamp = message.timestamp || Date.now();
            if (messageTimestamp < stateTimestamp) {
                return; // Сообщение создано до установки состояния
            }
            
            console.log("Rebellion: Обработка результата броска действия команды", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const { teamIdx, teamType, selectedAction, checkType, dc, totalMod } = game.rebellionState;
                const total = roll.total;
                const rollResult = roll.dice?.[0]?.results?.[0]?.result || roll.total;
                
                console.log(`Rebellion: Результат действия команды - ${total} vs DC ${dc}, действие: ${selectedAction}`);
                
                // Clear state immediately to prevent double processing
                game.rebellionState = null;
                
                // Apply result
                setTimeout(async () => {
                    try {
                        const data = DataHandler.get();
                        const teams = JSON.parse(JSON.stringify(data.teams));
                        const team = teams[teamIdx];
                        if (!team) {
                            console.error("Rebellion: Команда не найдена при обработке результата");
                            return;
                        }
                        
                        team.currentAction = selectedAction;
                        team.hasActed = true;
                        
                        const def = getTeamDefinition(team.type);
                        const bonuses = DataHandler.getRollBonuses(data, selectedAction);
                        
                        // Получаем sheet для вызова _processTeamActionResult
                        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
                        
                        // Создаем объект roll для передачи в обработчик
                        const rollObj = {
                            total: rollResult, // Только результат кубика без модификаторов
                            result: rollResult
                        };
                        
                        await sheet._processTeamActionResult(team, selectedAction, checkType, dc, rollObj, total, teamIdx, teams, data, bonuses, def);
                        
                        console.log("Rebellion: Результат действия команды обработан");
                        
                        // Обновляем интерфейс
                        if (sheet.rendered) sheet.render();
                        
                    } catch (error) {
                        console.error("Rebellion: Ошибка при обработке результата действия команды:", error);
                    }
                }, 100);
            }
            return;
        }

        // Обработка результатов броска "Стукач"
        if (game.rebellionState?.isStukachRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Стукач", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 15;
                const success = total >= dc;
                
                console.log(`Rebellion: Результат Стукач - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    
                    let resultMessage = `<h3>🕵️ Результат события: Стукач</h3>`;
                    
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Стукач нейтрализован! Верные сторонники справились с ситуацией.</p>`;
                        resultMessage += `<p><strong>Последствия:</strong> Потеря 1 сторонника, но никаких дальнейших проблем.</p>`;
                        await DataHandler.update({ supporters: Math.max(0, rebellionData.supporters - 1) });
                    } else {
                        const notRoll = new Roll("1d6");
                        await notRoll.evaluate();
                        const notGain = notRoll.total;
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Стукач ускользнул! Информация попала к врагам.</p>`;
                        resultMessage += `<p><strong>Последствия:</strong> Потеря 1 сторонника, +${notGain} Известность.</p>`;
                        await DataHandler.update({
                            supporters: Math.max(0, rebellionData.supporters - 1),
                            notoriety: rebellionData.notoriety + notGain
                        });
                    }
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker(),
                        flags: {
                            "pf2e-ts-adv-pf1ehr": {
                                isStukachResult: true
                            }
                        }
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем лист восстания
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000); // Небольшая задержка для корректного отображения
            }
            
            return; // Не обрабатываем reroll кнопки для Стукач
        }
        
        // Обработка результатов броска "Провальный протест"
        if (game.rebellionState?.isFailedProtestRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Провальный протест", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 25;
                const success = total >= dc;
                
                console.log(`Rebellion: Результат Провальный протест - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    
                    // Случайный модификатор поселения (всегда применяется)
                    const settlementModifiers = ["Коррупция", "Преступность", "Экономика", "Закон", "Знание", "Общество"];
                    const randomModifier = settlementModifiers[Math.floor(Math.random() * settlementModifiers.length)];
                    
                    // Добавляем временное событие с модификатором поселения
                    const events = JSON.parse(JSON.stringify(rebellionData.events || []));
                    events.push({
                        name: "Провальный протест",
                        desc: `Модификатор поселения Кинтарго "${randomModifier}" уменьшен на 4`,
                        weekStarted: rebellionData.week + 1,
                        duration: 1,
                        isPersistent: false
                    });
                    
                    let resultMessage = `<h3>🏛️ Результат события: Провальный протест</h3>`;
                    
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Потери сторонников предотвращены успешной проверкой Безопасности!</p>`;
                        resultMessage += `<p style="color:black">Однако модификатор поселения Кинтарго "${randomModifier}" все равно уменьшен на 4 на следующую неделю.</p>`;
                        await DataHandler.update({ events });
                    } else {
                        const suppRoll = new Roll("2d6");
                        await suppRoll.evaluate();
                        const loss = suppRoll.total;
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Протест провалился! Сторонники разочарованы.</p>`;
                        resultMessage += `<p><strong>Последствия:</strong> Потеря ${loss} сторонников и населения. Модификатор поселения Кинтарго "${randomModifier}" уменьшен на 4 на следующую неделю.</p>`;
                        await DataHandler.update({
                            supporters: Math.max(0, rebellionData.supporters - loss),
                            population: Math.max(0, rebellionData.population - loss),
                            events
                        });
                    }
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker(),
                        flags: {
                            "pf2e-ts-adv-pf1ehr": {
                                isFailedProtestResult: true
                            }
                        }
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем лист восстания
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000); // Небольшая задержка для корректного отображения
            }
            
            return; // Не обрабатываем reroll кнопки для Провальный протест
        }

        // Обработка результатов броска "Катастрофическая миссия"
        if (game.rebellionState?.isCatastrophicMissionRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Катастрофическая миссия", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 20;
                const success = total >= dc;
                const teamType = game.rebellionState.teamType;
                
                console.log(`Rebellion: Результат Катастрофическая миссия - ${total} vs DC ${dc}, успех: ${success}, команда: ${teamType}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    
                    // Бросок на известность в любом случае
                    const notorietyRoll = new Roll("1d6");
                    await notorietyRoll.evaluate();
                    const notorietyGain = notorietyRoll.total;
                    
                    const teams = JSON.parse(JSON.stringify(rebellionData.teams));
                    const teamIndex = teams.findIndex(t => t.type === teamType);
                    const teamDef = getTeamDefinition(teamType);
                    
                    let resultMessage = `<h3>⚔️ Результат события: Катастрофическая миссия</h3>`;
                    
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Команда ${teamDef?.label || teamType} достигла цели, но получила значительный урон. Команда становится недееспособной.</p>`;
                        if (teamIndex !== -1) teams[teamIndex].disabled = true;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Команда ${teamDef?.label || teamType} достигла цели, но получила критический урон. Команда уничтожена и должна быть заменена.</p>`;
                        if (teamIndex !== -1) teams.splice(teamIndex, 1);
                    }
                    
                    resultMessage += `<p style="color:red">Известность увеличена на ${notorietyGain}.</p>`;
                    
                    await DataHandler.update({ 
                        teams, 
                        notoriety: rebellionData.notoriety + notorietyGain 
                    });
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker(),
                        flags: {
                            "pf2e-ts-adv-pf1ehr": {
                                isCatastrophicMissionResult: true
                            }
                        }
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем лист восстания
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000); // Небольшая задержка для корректного отображения
            }
            
            return; // Не обрабатываем reroll кнопки для Катастрофическая миссия
        }

        // Обработка результатов броска "Союзник в опасности"
        if (game.rebellionState?.isAllyDangerRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Союзник в опасности", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = game.rebellionState.dc;
                const success = total >= dc;
                const allyIndex = game.rebellionState.allyIndex;
                const allyName = game.rebellionState.allyName;
                
                console.log(`Rebellion: Результат Союзник в опасности - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    const allies = JSON.parse(JSON.stringify(rebellionData.allies));
                    const ally = allies[allyIndex];
                    
                    let resultMessage = `<h3>⚠️ Результат события: Союзник в опасности</h3>`;
                    resultMessage += `<p><strong>Союзник:</strong> ${allyName}</p>`;
                    
                    if (success) {
                        // Успех - союзник пропадает на неделю
                        ally.missing = true;
                        ally.missingWeek = rebellionData.week;
                        resultMessage += `<p style="color:#d84315"><strong>✅ Успех!</strong> ${allyName} пропадает без вести на неделю, но не схвачен.</p>`;
                        resultMessage += `<p>На следующей неделе будет проведена еще одна проверка Безопасности против того же КС для возвращения союзника.</p>`;
                    } else {
                        // Провал - союзник схвачен
                        ally.captured = true;
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> ${allyName} схвачен!</p>`;
                        resultMessage += `<p>Союзник может быть спасен успешным действием "Спасение персонажа".</p>`;
                    }
                    
                    await DataHandler.update({ allies });
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker(),
                        flags: {
                            "pf2e-ts-adv-pf1ehr": {
                                isAllyDangerResult: true
                            }
                        }
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем лист восстания
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000); // Небольшая задержка для корректного отображения
            }
            
            return; // Не обрабатываем reroll кнопки для Союзник в опасности
        }

        // Обработка результатов броска "Предатель"
        if (game.rebellionState?.isTraitorRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Предатель", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 20;
                const success = total >= dc;
                const teamType = game.rebellionState.teamType;
                
                console.log(`Rebellion: Результат Предатель - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    const traitorTeamDef = getTeamDefinition(teamType);
                    
                    let resultMessage = `<h3>🕵️ Результат события: Предатель</h3>`;
                    
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель в команде ${traitorTeamDef.label} обнаружен и пойман до того, как смог нанести значительный ущерб.</p>`;
                        resultMessage += `<p><strong>Что делать с предателем?</strong></p>`;
                        
                        // Кнопки выбора действий с предателем
                        resultMessage += `<div style="margin: 10px 0;">
                            <button class="traitor-execute-btn" data-team-type="${teamType}" style="background: #f44336; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                ⚔️ Казнить
                            </button>
                            <button class="traitor-exile-btn" data-team-type="${teamType}" style="background: #ff9800; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                🚪 Изгнать
                            </button>
                            <button class="traitor-imprison-btn" data-team-type="${teamType}" style="background: #9e9e9e; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                🔒 Тюрьма
                            </button>
                        </div>`;
                    } else {
                        const notRoll = new Roll("2d6");
                        await notRoll.evaluate();
                        const notGain = notRoll.total;
                        
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Предатель в команде ${traitorTeamDef.label} сбежал!</p>`;
                        resultMessage += `<p><strong>Последствия:</strong> Команда недееспособна, +${notGain} Известность.</p>`;
                        
                        await DataHandler.update({
                            notoriety: rebellionData.notoriety + notGain
                        });
                    }
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем интерфейс
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000); // Небольшая задержка для корректного отображения
            }
            
            return; // Не обрабатываем reroll кнопки для Предатель
        }

        // Обработка результатов броска "Казнь предателя"
        if (game.rebellionState?.isTraitorExecuteLoyaltyRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Казнь предателя", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 20;
                const success = total >= dc;
                const teamType = game.rebellionState.teamType;
                
                console.log(`Rebellion: Результат Казнь предателя - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    const traitorTeamDef = getTeamDefinition(teamType);
                    
                    let resultMessage = `<h3>⚔️ Результат проверки морального духа</h3>`;
                    
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Серебряные Вороны понимают необходимость казни. Моральный дух не пострадал.</p>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Казнь предателя нанесла ущерб моральному духу.</p>`;
                        
                        // Добавляем постоянный эффект "Низкий боевой дух"
                        const currentEvents = rebellionData.events || [];
                        const lowMoraleEvent = {
                            name: "Низкий боевой дух",
                            desc: "Постоянный низкий боевой дух после казни предателя. -4 Верность. Смягчение: Выступление КС 20 снижает до -2.",
                            weekStarted: rebellionData.week,
                            duration: 999,
                            isPersistent: true,
                            mitigate: "performance",
                            dc: 20
                        };
                        
                        // Проверяем, есть ли уже событие "Низкий боевой дух"
                        const existingMoraleIndex = currentEvents.findIndex(e => e.name === "Низкий боевой дух");
                        if (existingMoraleIndex !== -1) {
                            // Заменяем существующее событие на постоянное
                            currentEvents[existingMoraleIndex] = lowMoraleEvent;
                        } else {
                            // Добавляем новое событие
                            currentEvents.push(lowMoraleEvent);
                        }
                        
                        await DataHandler.update({ events: currentEvents });
                        resultMessage += `<p><strong>Эффект:</strong> Постоянный "Низкий боевой дух" (-4 Верность). Можно смягчить проверкой Выступления КС 20.</p>`;
                    }
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем интерфейс
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000);
            }
            
            return; // Не обрабатываем reroll кнопки для Казнь предателя
        }

        // Обработка результатов броска "Изгнание предателя"
        if (game.rebellionState?.isTraitorExileSecurityRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Изгнание предателя", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 25;
                const success = total >= dc;
                const teamType = game.rebellionState.teamType;
                
                console.log(`Rebellion: Результат Изгнание предателя - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    const traitorTeamDef = getTeamDefinition(teamType);
                    
                    let resultMessage = `<h3>🚪 Результат изгнания предателя</h3>`;
                    
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель убежден никогда не возвращаться в Кинтарго. Угроза устранена.</p>`;
                    } else {
                        const notRoll = new Roll("2d6");
                        await notRoll.evaluate();
                        const notGain = notRoll.total;
                        
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Предатель пробрался обратно в город и доложил Барзиллаю Труну.</p>`;
                        resultMessage += `<p><strong>Последствия:</strong> +${notGain} Известность.</p>`;
                        
                        await DataHandler.update({
                            notoriety: rebellionData.notoriety + notGain
                        });
                    }
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем интерфейс
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000);
            }
            
            return; // Не обрабатываем reroll кнопки для Изгнание предателя
        }

        // Обработка результатов броска "Содержание предателя в тюрьме"
        if (game.rebellionState?.isTraitorPrisonSecrecyRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Содержание предателя", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 20;
                const success = total >= dc;
                const teamType = game.rebellionState.teamType;
                const eventIndex = game.rebellionState.eventIndex;
                
                console.log(`Rebellion: Результат Содержание предателя - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    const traitorTeamDef = getTeamDefinition(teamType);
                    
                    let resultMessage = `<h3>🔒 Результат проверки содержания предателя</h3>`;
                    
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель из команды ${traitorTeamDef.label} остается в заключении.</p>`;
                        resultMessage += `<p>Тюремное заключение продолжается. Проверка потребуется снова в следующую фазу содержания.</p>`;
                        resultMessage += `<p>Вы по-прежнему можете переубедить, казнить или изгнать предателя.</p>`;
                    } else {
                        const notRoll = new Roll("2d6");
                        await notRoll.evaluate();
                        const notGain = notRoll.total;
                        
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Предатель сбежал из заключения!</p>`;
                        resultMessage += `<p><strong>Последствия:</strong> +${notGain} Известность.</p>`;
                        
                        // Удаляем эффект "Предатель в тюрьме"
                        const events = JSON.parse(JSON.stringify(rebellionData.events || []));
                        events.splice(eventIndex, 1);
                        
                        await DataHandler.update({
                            events: events,
                            notoriety: rebellionData.notoriety + notGain
                        });
                    }
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем интерфейс
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000);
            }
            
            return; // Не обрабатываем reroll кнопки для Содержание предателя
        }

        // Обработка результатов броска "Переубеждение предателя"
        if (game.rebellionState?.isTraitorPersuadeAttemptRoll && message.isRoll) {
            console.log("Rebellion: Обработка результата броска Переубеждение предателя", message);
            
            const roll = message.rolls?.[0];
            if (roll) {
                const total = roll.total;
                const dc = 20;
                const success = total >= dc;
                const teamType = game.rebellionState.teamType;
                const eventIndex = game.rebellionState.eventIndex;
                
                console.log(`Rebellion: Результат Переубеждение предателя - ${total} vs DC ${dc}, успех: ${success}`);
                
                // Применяем результат
                setTimeout(async () => {
                    const rebellionData = DataHandler.get();
                    const traitorTeamDef = getTeamDefinition(teamType);
                    
                    let resultMessage = `<h3>✨ Результат переубеждения предателя</h3>`;
                    
                    if (success) {
                        const supportersRoll = new Roll("1d6");
                        await supportersRoll.evaluate();
                        const supportersGain = supportersRoll.total;
                        
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель из команды ${traitorTeamDef.label} переубежден!</p>`;
                        resultMessage += `<p><strong>Результаты:</strong></p>`;
                        resultMessage += `<ul>
                            <li>Предатель меняет верность</li>
                            <li>Команда ${traitorTeamDef.label} восстановлена и больше не недееспособна</li>
                            <li>+${supportersGain} сторонников в начале следующей фазы содержания</li>
                            <li>Больше нет угрозы увеличения Известности от этого предателя</li>
                        </ul>`;
                        
                        // Восстанавливаем команду
                        const teams = JSON.parse(JSON.stringify(rebellionData.teams));
                        const teamIndex = teams.findIndex(t => t.type === teamType);
                        if (teamIndex !== -1) {
                            teams[teamIndex].disabled = false;
                        }
                        
                        // Удаляем эффект "Предатель в тюрьме"
                        const events = JSON.parse(JSON.stringify(rebellionData.events || []));
                        events.splice(eventIndex, 1);
                        
                        // Добавляем эффект бонусных сторонников (активируется в следующую фазу содержания)
                        events.push({
                            name: "Бонус от переубеждения",
                            desc: `+${supportersGain} сторонников от успешного переубеждения предателя`,
                            weekStarted: rebellionData.week + 1, // Активируется в следующую неделю
                            duration: 1,
                            supportersBonus: supportersGain,
                            needsSupportersCollection: true
                        });
                        
                        await DataHandler.update({
                            teams: teams,
                            events: events
                        });
                        
                        // Force sheet update to refresh maintenance event count
                        setTimeout(() => {
                            const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                            if (sheet) {
                                sheet.render(false); // Force refresh without closing
                            }
                        }, 100);
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Попытка переубеждения не удалась.</p>`;
                        resultMessage += `<p>Предатель остается в заключении. Можете попробовать снова или выбрать другой вариант (казнь, изгнание).</p>`;
                    }
                    
                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });
                    
                    // Очищаем состояние
                    game.rebellionState = null;
                    
                    // Обновляем интерфейс
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                    
                }, 1000);
            }
            
            return; // Не обрабатываем reroll кнопки для Переубеждение предателя
        }
        
        if (!message.isRoll) return;
        
        console.log("Rebellion: Checking message for reroll buttons", message);
        
        const rebellionData = DataHandler.get();
        const securityReroll = DataHandler.getRerollForCheck(rebellionData, 'security');
        const loyaltyReroll = DataHandler.getRerollForCheck(rebellionData, 'loyalty');
        const secrecyReroll = DataHandler.getRerollForCheck(rebellionData, 'secrecy');
        
        console.log("Rebellion: Reroll availability", { 
            security: securityReroll.available, 
            loyalty: loyaltyReroll.available,
            secrecy: secrecyReroll.available 
        });
        console.log("Rebellion: Security reroll details", securityReroll);
        console.log("Rebellion: Loyalty reroll details", loyaltyReroll);
        console.log("Rebellion: Secrecy reroll details", secrecyReroll);
        
        const context = message.flags?.pf2e?.context;
        const flavor = message.flavor?.toLowerCase() || '';
        const content = message.content?.toLowerCase() || '';
        
        console.log("Rebellion: Message context and flavor", { context, flavor });
        
        // Check for security check (Chuko)
        if (securityReroll.available) {
            const isSecurityCheck = context?.skill === 'security' || 
                                   context?.action === 'security' ||
                                   flavor.includes('безопасность') ||
                                   flavor.includes('security') ||
                                   content.includes('безопасность') ||
                                   content.includes('security') ||
                                   (flavor.includes('organization') && flavor.includes('security')) ||
                                   (content.includes('organization') && content.includes('security'));

            console.log("Rebellion: Is security check?", isSecurityCheck);
            if (isSecurityCheck) {
                const rerollButton = $(`
                    <button class="rebellion-reroll-btn" 
                            data-message-id="${message.id}" 
                            data-type="security"
                            style="margin: 5px; padding: 4px 8px; background: #4a90e2; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">
                        🔄 Переброс Чуко
                    </button>
                `);
                html.find('.message-content').append(rerollButton);
                console.log("Rebellion: Added Chuko reroll button");
            }
        }
        
        // Check for loyalty check (Shensen)
        if (loyaltyReroll.available) {
            const isLoyaltyCheck = context?.skill === 'loyalty' || 
                                  context?.action === 'loyalty' ||
                                  flavor.includes('лояльность') ||
                                  flavor.includes('loyalty') ||
                                  flavor.includes('верность') ||
                                  content.includes('лояльность') ||
                                  content.includes('loyalty') ||
                                  content.includes('верность') ||
                                  (flavor.includes('organization') && flavor.includes('loyalty')) ||
                                  (content.includes('organization') && content.includes('loyalty'));

            console.log("Rebellion: Is loyalty check?", isLoyaltyCheck);
            if (isLoyaltyCheck) {
                const rerollButton = $(`
                    <button class="rebellion-reroll-btn" 
                            data-message-id="${message.id}" 
                            data-type="loyalty"
                            style="margin: 5px; padding: 4px 8px; background: #e91e63; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">
                        🔄 Переброс Шенсен
                    </button>
                `);
                html.find('.message-content').append(rerollButton);
                console.log("Rebellion: Added Shensen reroll button");
            }
        }
        
        // Check for secrecy check (Strea Vestori)
        if (secrecyReroll.available) {
            const isSecrecyCheck = context?.skill === 'secrecy' || 
                                  context?.action === 'secrecy' ||
                                  flavor.includes('секретность') ||
                                  flavor.includes('secrecy') ||
                                  flavor.includes('тайность') ||
                                  content.includes('секретность') ||
                                  content.includes('secrecy') ||
                                  content.includes('тайность') ||
                                  (flavor.includes('organization') && flavor.includes('secrecy')) ||
                                  (content.includes('organization') && content.includes('secrecy'));

            console.log("Rebellion: Is secrecy check?", isSecrecyCheck);
            if (isSecrecyCheck) {
                const rerollButton = $(`
                    <button class="rebellion-reroll-btn" 
                            data-message-id="${message.id}" 
                            data-type="secrecy"
                            style="margin: 5px; padding: 4px 8px; background: #9c27b0; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">
                        🔄 Переброс Стреа
                    </button>
                `);
                html.find('.message-content').append(rerollButton);
                console.log("Rebellion: Added Strea reroll button");
            }
        }
        

    });

    // Handle reroll button clicks
    $(document).on('click', '.rebellion-reroll-btn', async (ev) => {
        ev.preventDefault();
        
        const messageId = $(ev.currentTarget).data('message-id');
        const rerollType = $(ev.currentTarget).data('type');
        
        console.log("Rebellion: Reroll button clicked", { messageId, rerollType });
        
        const message = game.messages.get(messageId);
        if (!message || !message.isRoll) return;
        
        const data = DataHandler.get();
        const rerollInfo = DataHandler.getRerollForCheck(data, rerollType);
        
        if (!rerollInfo.available) {
            ui.notifications.warn("Переброс уже использован на этой неделе!");
            return;
        }
        
        let allyName = '';
        let skillName = '';
        let colorScheme = {};
        
        if (rerollType === 'security') {
            allyName = 'Чуко';
            skillName = 'Безопасность';
            colorScheme = {
                border: '#4a90e2',
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                color: '#1976d2'
            };
        } else if (rerollType === 'loyalty') {
            allyName = 'Шенсен';
            skillName = 'Лояльность';
            colorScheme = {
                border: '#e91e63',
                background: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)',
                color: '#c2185b'
            };
        } else if (rerollType === 'secrecy') {
            allyName = 'Стреа Вестори';
            skillName = 'Секретность';
            colorScheme = {
                border: '#9c27b0',
                background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                color: '#7b1fa2'
            };
        }
        
        // Confirm reroll
        const confirmed = await Dialog.confirm({
            title: `Переброс ${allyName}`,
            content: `<p><strong>${allyName}</strong> позволяет перебросить одну проверку ${skillName.toLowerCase()} раз в неделю.</p>
                     <p>Использовать переброс для этой проверки?</p>`,
            yes: () => true,
            no: () => false
        });

        if (!confirmed) return;
        
        // Get original roll data
        const originalRoll = message.rolls[0];
        const originalTotal = originalRoll.total;
        
        // Extract bonus from original roll
        let bonus = 0;
        if (originalRoll.terms && originalRoll.terms.length > 0) {
            const dieTerm = originalRoll.terms.find(t => t.faces === 20);
            if (dieTerm && dieTerm.results && dieTerm.results[0]) {
                bonus = originalTotal - dieTerm.results[0].result;
            }
        }
        
        // Mark reroll as used
        await DataHandler.useReroll(data, rerollType);
        
        // Perform the reroll - create a proper roll message
        const rollFormula = `1d20 + ${bonus}`;
        const newRoll = new Roll(rollFormula);
        await newRoll.evaluate();
        
        // Create and post the new roll message with proper flags for event detection
        await newRoll.toMessage({
            speaker: ChatMessage.getSpeaker(),
            flavor: `<h4 class="action"><strong>Переброс ${allyName}: ${skillName}</strong></h4>`,
            flags: {
                pf2e: {
                    context: {
                        type: "skill-check",
                        skill: rerollType,
                        action: rerollType
                    }
                },
                "pf2e-ts-adv-pf1ehr": {
                    isMitigation: true,
                    isReroll: true,
                    originalMessageId: messageId
                }
            }
        });
        
        // Show simple notification
        ui.notifications.info(`${allyName} предоставляет переброс! Исходный результат: ${originalTotal}`);
        
        // Disable the button
        $(ev.currentTarget).prop('disabled', true).css('opacity', '0.5').text('Использован');
    });

});

Hooks.on("rebellionDataChanged", () => {
    Object.values(ui.windows).forEach(app => {
        if (app instanceof RebellionSheet) app.render(false);
    });
});

Hooks.on("renderActorDirectory", (app, html, data) => {
    const $html = $(html);
    const header = $html.find(".header-actions");

    // Удаляем старую кнопку если есть
    header.find(".silver-raven-btn").remove();

    const button = $(`<button class="silver-raven-btn" style="min-width: 32px; flex: 0 0 32px; background-color: #194680; color: #c0c0c0; border: 1px solid #c9ad6a;" title="Лист Восстания"><i class="fas fa-crow"></i></button>`);

    button.on("click", (ev) => {
        ev.preventDefault();
        const existing = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
        if (existing && existing.rendered) existing.bringToTop();
        else {
            // Check if there is a 'closed' instance we should reuse? FormApplications usually are singletons if ID matches?
            // "rebellion-sheet" ID.
            // Just creating new one is fine, Foundry handles singleton by ID usually.
            new RebellionSheet().render(true);
        }
    });

    header.prepend(button);
});

Hooks.on('createChatMessage', async (message) => {
    // Only process rolls
    if (!message.isRoll) return;

    // Check if it's a skill check
    // We need to match against active events in DataHandler
    const data = DataHandler.get();
    if (!data.events || data.events.length === 0) return;

    // Iterate accessible events with mitigation
    for (const event of data.events) {
        if (!event.mitigate) continue;

        // Check if message matches the skill
        const context = message.flags?.pf2e?.context;
        const customFlags = message.flags?.["pf2e-ts-adv-pf1ehr"];

        // Check for mitigation flag in flags, context, OR global state
        const state = game.rebellionState;
        const isMitigation = customFlags?.isMitigation || context?.isMitigation || state?.isMitigation;
        const targetEventName = customFlags?.eventName || context?.eventName || state?.eventName;

        // Strict Mode: Only process if it has our custom indicator
        if (!isMitigation) {
            // Skip processing for standard sheet rolls as per user request
            continue;
        }

        const skill = event.mitigate;
        const skillLabel = PF2E_SKILL_LABELS[skill] || CHECK_LABELS[skill] || skill;

        console.log(`Rebellion Debug: Checking message against event '${event.name}' (Skill: ${skill}, Label: ${skillLabel})`);

        // Match condition
        let match = false;

        // 1. Check strict event name match if available
        if (targetEventName === event.name) {
            match = true;
        }
        // 2. Context Match (Preferred)
        else if (context && context.type === "skill-check" && (context.skill === skill || context.action === skill)) {
            console.log(`- MATCH via context flag!`);
            match = true;
        }
        // 3. Flavor Text Match (Fallback)
        else if (message.flavor) {
            const flavorLower = message.flavor.toLowerCase();
            const labelLower = skillLabel.toLowerCase();
            const skillLower = skill.toLowerCase();

            if (flavorLower.includes(labelLower) || flavorLower.includes(skillLower)) {
                console.log(`- MATCH via flavor text!`);
                match = true;
            }
        }

        if (match) {
            // Check DC: Roll result is in message.rolls[0].total
            const roll = message.rolls[0];
            if (!roll) {
                console.log(`- No roll in message, skipping.`);
                return;
            }

            const total = roll.total;
            const success = total >= event.dc;
            console.log(`- Roll Total: ${total}. Target DC: ${event.dc}. Result: ${success ? "Success" : "Failure"}`);

            // We found a matching roll! Apply mitigation logic.
            const sheet = Object.values(ui.windows).find(w => w.constructor.name === "RebellionSheet") || new RebellionSheet();
            console.log(`- Calling sheet._handleMitigationResult...`);
            console.log(`- Roll Object:`, roll);
            console.log(`- Roll JSON:`, roll.toJSON ? roll.toJSON() : "No toJSON()");

            try {
                // Pass the roll object so _handleMitigationResult can display the actual roll outcome
                await sheet._handleMitigationResult(event.name, skill, event.dc, { total: 0 }, data, success, roll, total);
                console.log(`- Handler executed successfully.`);
            } catch (err) {
                console.error(`- Error in handler:`, err);
            }

            break; // Handle one event per roll
        }
    }


});
    // Обработчики для события "Дьявольское проникновение"
    $(document).on('click', '.roll-devil-weeks-btn', (ev) => {
        console.log("=== DEVIL WEEKS BUTTON CLICKED (main.js) ===");
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onDevilWeeksRoll(ev);
    });

    $(document).on('click', '.roll-devil-perception-btn', (ev) => {
        console.log("=== DEVIL PERCEPTION BUTTON CLICKED (main.js) ===");
        ev.preventDefault();
        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
        sheet._onDevilPerceptionRoll(ev);
    });

    // Обработчик для кнопки информации об Инквизиции
    $(document).on('click', '.show-inquisition-info-btn', (ev) => {
        ev.preventDefault();
        const message = `
            <h3>🏛️ Как завершить постоянную Инквизицию</h3>
            <p><strong>Требуется:</strong> Действие "Залечь на дно" с успешной проверкой Секретности КС 20.</p>
            <p><strong>Эффект при успехе:</strong> Постоянная Инквизиция завершается.</p>
            <p><strong>Эффект при провале:</strong> Инквизиция продолжается.</p>
            <p><em>Примечание: Только постоянная Инквизиция может быть завершена таким образом. Временная Инквизиция (1 неделя) завершается автоматически.</em></p>
        `;
        ChatMessage.create({
            content: message,
            speaker: { alias: "Система восстания" }
        });
    });