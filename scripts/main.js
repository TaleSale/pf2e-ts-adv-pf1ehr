import { DataHandler } from "./data-handler.js";
import { RebellionSheet } from "./sheet.js";
import { PF2E_SKILL_LABELS, CHECK_LABELS, CATEGORY_LABELS } from "./config.js";
import { getTeamDefinition, getEarnIncomeDC, calculateEarnIncome, formatIncome, getHalfRankBonus, getTeamProficiencyBonus, getAllyData } from "./utils.js";
import { openRebellionEnricherBuilder } from "./rebellion-enricher-builder.js";

// === Centralized type/stat config dictionaries ===
const TYPE_CONFIG = {
    "notoriety": { label: "Известность", icon: "fa-eye" },
    "notoriety/2": { label: "Известность ÷2", icon: "fa-eye" },
    "notoriety*2": { label: "Известность ×2", icon: "fa-eye" },
    "notoriety+dangers": { label: "Известность + Опасность", icon: "fa-eye" },
    "(notoriety+dangers)/2": { label: "(Известность + Опасность) ÷2", icon: "fa-eye" },
    "(notoriety+dangers)*2": { label: "(Известность + Опасность) ×2", icon: "fa-eye" },
    "dangers": { label: "Опасность", icon: "fa-skull-crossbones" },
    "loyalty": { label: "Верность", icon: "fa-heart" },
    "security": { label: "Безопасность", icon: "fa-shield-alt" },
    "secrecy": { label: "Секретность", icon: "fa-user-secret" },
};

const D100_TYPES = new Set(["notoriety", "notoriety/2", "notoriety*2", "notoriety+dangers", "(notoriety+dangers)/2", "(notoriety+dangers)*2", "dangers"]);
const D20_TYPES = new Set(["loyalty", "security", "secrecy"]);

const STAT_CONFIG = {
    "supporters": { label: "Сторонники", icon: "fa-users", emoji: "👥", addVerb: "Появляются новые сторонники", subVerb: "Уходят сторонники", unit: "" },
    "notoriety": { label: "Известность", icon: "fa-eye", emoji: "⚠️", addVerb: "Известность увеличена", subVerb: "Известность падает", unit: "" },
    "treasury": { label: "Казна", icon: "fa-coins", emoji: "💰", addVerb: "Казна пополнена", subVerb: "Казна истощается", unit: " зм" },
};

/**
 * Create an enricher button pair (main action + chat send) with consistent styling.
 */
function createEnricherButton(mainClass, chatClass, icon, label, datasets) {
    const container = document.createElement("span");
    container.style.cssText = "display: inline-flex; align-items: center;";

    const mainBtn = document.createElement("a");
    mainBtn.classList.add(mainClass);
    mainBtn.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
    mainBtn.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 8px;
        background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
        color: white; border-radius: 4px 0 0 4px; cursor: pointer;
        font-size: 0.9em; text-decoration: none;
        border: 1px solid #718096; border-right: none;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        line-height: 1; height: auto;
    `;

    const chatBtn = document.createElement("a");
    chatBtn.classList.add(chatClass);
    chatBtn.innerHTML = `<i class="fas fa-comment"></i>`;
    chatBtn.title = "Отправить в чат";
    chatBtn.style.cssText = `
        display: inline-flex; align-items: center; justify-content: center;
        padding: 2px 8px;
        background: #718096; color: white;
        border-radius: 0 4px 4px 0; cursor: pointer;
        font-size: 0.9em; text-decoration: none;
        border: 1px solid #718096; border-left: none;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        line-height: 1; height: auto;
    `;

    for (const [key, value] of Object.entries(datasets)) {
        mainBtn.dataset[key] = value;
        chatBtn.dataset[key] = value;
    }

    container.appendChild(mainBtn);
    container.appendChild(chatBtn);
    return container;
}

function getTypeLabel(typeExpr, dcParam) {
    const cfg = TYPE_CONFIG[typeExpr];
    if (!cfg) return typeExpr;
    if (D20_TYPES.has(typeExpr) && dcParam) return `${cfg.label} КС ${dcParam}`;
    return cfg.label;
}

function getTypeIcon(typeExpr) {
    return TYPE_CONFIG[typeExpr]?.icon || "fa-dice-d20";
}

function getStatConfig(statType) {
    return STAT_CONFIG[statType] || { label: statType, icon: "fa-dice", emoji: "🎲", addVerb: statType, subVerb: statType, unit: "" };
}

function registerRebellionEnricherApi() {
    const currentModule = game.modules.get("pf2e-ts-adv-pf1ehr");
    if (currentModule) {
        currentModule.api = {
            ...(currentModule.api ?? {}),
            openRebellionEnricherBuilder
        };
    }

    globalThis.Rebellion ??= {};
    globalThis.Rebellion.api = {
        ...(globalThis.Rebellion.api ?? {}),
        openRebellionEnricherBuilder
    };
}

/**
 * Build a styled result card for roll outcomes.
 * @param {Object} opts
 * @param {string} opts.icon - FontAwesome icon class (e.g. "fa-dice")
 * @param {string} opts.title - Card title text
 * @param {number|string} opts.result - Roll total to display
 * @param {number|null} [opts.dc] - DC value (null = no DC comparison)
 * @param {boolean|null} [opts.success] - true/false/null; if null, derived from result >= dc
 * @param {string} [opts.extra] - Additional HTML to insert after result line
 * @param {string} [opts.borderColor] - Override border color
 * @param {string} [opts.background] - Override background gradient
 * @returns {string} HTML string
 */
function buildResultCard({ icon = "fa-dice", title, result, dc = null, success = null, extra = "", borderColor = null, background = null }) {
    if (success === null && dc != null) success = result >= dc;
    const color = dc != null ? (success ? "#2e7d32" : "#c62828") : "#666";
    const border = borderColor || (dc != null ? color : "#4a5568");
    const bg = background || "linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)";
    const successText = dc != null ? (success ? "✅ Успех!" : "❌ Провал!") : "";

    return `
        <div style="border: 2px solid ${border}; padding: 10px; border-radius: 8px; background: ${bg};">
            <h4 style="margin: 0 0 8px 0; color: #2d3748;">
                <i class="fas ${icon}"></i> ${title}
            </h4>
            <div style="font-size: 1.1em;">
                <strong>Результат: ${result}</strong>
                ${dc != null ? `<span style="color: #666;"> против КС ${dc}</span>` : ""}
            </div>
            ${extra}
            ${successText ? `<div style="margin-top: 8px; font-weight: bold; color: ${color};">${successText}</div>` : ""}
        </div>
    `;
}

/**
 * Build modifier breakdown HTML for roll results.
 * @param {Array<{label: string, value: number}>} parts - Modifier parts
 * @returns {string} HTML string or empty string
 */
function buildModifierBreakdown(parts) {
    const visible = parts.filter(p => p.value !== 0);
    if (visible.length === 0) return "";
    const text = visible.map(p => `${p.label}: ${p.value > 0 ? '+' : ''}${p.value}`).join(", ");
    return `<div style="font-size: 0.9em; color: #666; margin-top: 4px;">Модификаторы: ${text}</div>`;
}

/**
 * Build a stat adjustment card with +/- buttons.
 * @param {Object} statCfg - Config from getStatConfig()
 * @param {number} result - Dice roll result value
 * @param {string} statType - Stat key (e.g. "supporters")
 * @returns {string} HTML string
 */
function buildStatAdjustCard(statCfg, result, statType) {
    return `
        <div style="border: 2px solid #667eea; padding: 10px; border-radius: 8px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);">
            <h5 style="margin: 0 0 8px 0; color: #2d3748; font-size: 1.1em;">
                <i class="fas ${statCfg.icon}"></i> ${statCfg.label}: ${result}
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
}


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
        pattern: /@Rebellion\[type:([^\]|]+)(?:\|dc:(\d+))?\]/gi,
        enricher: (match, options) => {
            const typeExpr = match[1];
            const dcParam = match[2];
            const datasets = { type: typeExpr };
            if (dcParam) datasets.dc = dcParam;
            return createEnricherButton(
                "rebellion-inline-check", "rebellion-chat-btn",
                getTypeIcon(typeExpr), getTypeLabel(typeExpr, dcParam), datasets
            );
        }
    });

    // Register @Rebellion[%|DC:75|R] enricher for reverse d100 rolls (success on <= DC)
    CONFIG.TextEditor.enrichers.push({
        pattern: /@Rebellion\[%(\+danger)?\|dc:(\d+)\|r\]/gi,
        enricher: (match, options) => {
            const hasDanger = !!match[1];
            const dcParam = match[2];
            const label = hasDanger ? `d100 + Опасность ≤ КС ${dcParam}` : `d100 ≤ КС ${dcParam}`;
            return createEnricherButton(
                "rebellion-percent-check", "rebellion-percent-chat-btn",
                "fa-percent", label,
                { hasDanger: hasDanger ? "true" : "false", dc: dcParam, reverse: "true" }
            );
        }
    });

    // Register @Rebellion[%] enricher for d100 rolls
    CONFIG.TextEditor.enrichers.push({
        pattern: /@Rebellion\[%(\+danger)?(?:\|dc:(\d+))?\]/gi,
        enricher: (match, options) => {
            const hasDanger = !!match[1];
            const dcParam = match[2];
            let label = hasDanger ? "d100 + Опасность" : "d100";
            if (dcParam) label += ` КС ${dcParam}`;
            const datasets = { hasDanger: hasDanger ? "true" : "false" };
            if (dcParam) datasets.dc = dcParam;
            return createEnricherButton(
                "rebellion-percent-check", "rebellion-percent-chat-btn",
                "fa-percent", label, datasets
            );
        }
    });

    // Register @Rebellion[(1d6)[supporters]] enricher for dice rolls
    CONFIG.TextEditor.enrichers.push({
        pattern: /@Rebellion\[\(([^)]+)\)\[([^\]]+)\]\]/gi,
        enricher: (match, options) => {
            const diceExpr = match[1];
            const statType = match[2];
            const cfg = getStatConfig(statType);
            return createEnricherButton(
                "rebellion-dice-roll", "rebellion-dice-chat-btn",
                cfg.icon, `${diceExpr} ${cfg.label}`, { dice: diceExpr, stat: statType }
            );
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
    registerRebellionEnricherApi();
});

Hooks.once("ready", () => {
    console.log("Rebellion: Module ready, setting up reroll integration");
    const EVENT_REROLL_WINDOW_MS = 15000;
    registerRebellionEnricherApi();

    /**
     * Shared d100 roll with dialog for manual modifier input.
     * @param {Object} opts
     * @param {string} opts.title - Dialog & card title (e.g. "Известность")
     * @param {number} opts.baseMod - Base modifier added to the roll (e.g. checkBonus.total or danger)
     * @param {number|null} opts.dc - DC to compare against (null = no comparison)
     * @param {string} [opts.icon] - Card icon (default "fa-dice")
     * @param {Array<{label:string,value:number}>} [opts.dialogInfoLines] - Extra info lines in dialog
     * @param {Array<{label:string}>} [opts.modLabels] - Labels for [baseMod, manualMod] in breakdown
     * @param {Object|null} [opts.chatFlags] - Extra flags for the roll ChatMessage
     * @param {string|null} [opts.borderColor] - Override card border when no DC
     */
    async function rollD100WithDialog({ title, baseMod = 0, dc = null, icon = "fa-dice", dialogInfoLines = [], modLabels = ["Бонус", "Ручной"], chatFlags = null, borderColor = null, lowIsSuccess = false }) {
        const dialogInfoHtml = dialogInfoLines
            .map(line => `<div class="form-group"><label>${line.label}: ${line.value}</label></div>`)
            .join("");

        let modifier = await Dialog.prompt({
            title: `Бросок: ${title}`,
            content: `
                <form>
                    <div class="form-group">
                        <label>Модификатор:</label>
                        <div class="form-fields">
                            <input type="number" value="0" />
                        </div>
                    </div>
                    ${dialogInfoHtml}
                    ${dc ? `<div class="form-group"><label>КС: ${dc}</label></div>` : ""}
                </form>
            `,
            callback: html => html.find('input').val(),
            close: () => null,
            rejectClose: false
        });

        if (modifier === null) return;

        const manualModifier = parseInt(modifier || 0);
        const totalModifier = manualModifier + baseMod;
        const roll = await new Roll(`1d100 + ${totalModifier}`).roll({ async: true });
        const total = roll.total;

        const rollMsgData = {
            roll: roll,
            content: await roll.render(),
            sound: CONFIG.sounds.dice,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            speaker: ChatMessage.getSpeaker()
        };
        if (chatFlags) rollMsgData.flags = chatFlags;
        await ChatMessage.create(rollMsgData);

        const modBreakdown = buildModifierBreakdown([
            { label: modLabels[0], value: baseMod },
            { label: modLabels[1], value: manualModifier }
        ]);
        const success = dc != null ? (lowIsSuccess ? total <= dc : total >= dc) : null;
        const resultMessage = buildResultCard({
            icon,
            title,
            result: total,
            dc,
            success,
            extra: modBreakdown,
            borderColor: !dc ? (borderColor || null) : null
        });

        await ChatMessage.create({
            content: resultMessage,
            speaker: ChatMessage.getSpeaker()
        });
    }

    // Function to perform rebellion roll
    async function performRebellionRoll(typeExpr, dcParam, ev) {
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);

        let checkType = null;
        let dc = dcParam;
        let checkLabel = "";

        // Parse type expression - using centralized config
        const isD100Check = D100_TYPES.has(typeExpr);
        const isD20Check = D20_TYPES.has(typeExpr);

        if (isD100Check) {
            checkType = null;
            const effectiveDanger = DataHandler.getEffectiveDanger(data);
            const dcCalc = {
                "notoriety": () => data.notoriety || 0,
                "notoriety/2": () => Math.floor((data.notoriety || 0) / 2),
                "notoriety*2": () => (data.notoriety || 0) * 2,
                "notoriety+dangers": () => (data.notoriety || 0) + effectiveDanger,
                "(notoriety+dangers)/2": () => Math.floor(((data.notoriety || 0) + effectiveDanger) / 2),
                "(notoriety+dangers)*2": () => ((data.notoriety || 0) + effectiveDanger) * 2,
                "dangers": () => effectiveDanger,
            };
            dc = dcCalc[typeExpr]?.() ?? 0;
            const typeCfg = TYPE_CONFIG[typeExpr] || { label: typeExpr };
            checkLabel = `${typeCfg.label} (КС ${dc})`;
        } else if (isD20Check) {
            checkType = typeExpr;
            const typeCfg = TYPE_CONFIG[typeExpr] || { label: typeExpr };
            checkLabel = dc ? `${typeCfg.label} (КС ${dc})` : typeCfg.label;
        }


        if (!checkType && !isD100Check) {
            ui.notifications.error(`Неизвестный тип проверки: ${typeExpr}`);
            return;
        }

        // For notoriety checks, use empty bonus (no rebellion modifiers)
        const checkBonus = checkType ? bonuses[checkType] : { total: 0, parts: [] };

        if (isD100Check) {
            const typeCfg = TYPE_CONFIG[typeExpr] || { label: typeExpr };
            await rollD100WithDialog({
                title: typeCfg.label,
                baseMod: checkBonus.total,
                dc,
                icon: "fa-dice",
                modLabels: ["Восстание", "Ручной"],
                chatFlags: { pf2e: { context: { type: "skill-check", skill: checkType, action: checkType } } }
            });

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

            const message = buildResultCard({
                icon: "fa-dice-d20",
                title: checkLabel,
                result: total, dc,
                extra: `<div style="font-size: 0.9em; color: #666; margin-top: 4px;">1d20 (${roll.total}) + ${checkBonus.total} = ${total}</div>`
            });

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

        const buttonText = getTypeLabel(typeExpr, dcParam);

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
    async function performPercentRoll(hasDanger, dcParam, isReverse = false) {
        const data = DataHandler.get();
        const effectiveDanger = hasDanger ? DataHandler.getEffectiveDanger(data) : 0;
        const labelText = hasDanger ? "d100 + Опасность" : "d100";
        const titleText = isReverse ? `${labelText} (успех при ≤ КС)` : labelText;
        const dialogInfoLines = [];
        if (hasDanger) dialogInfoLines.push({ label: "Опасность", value: effectiveDanger });
        if (isReverse && dcParam != null) dialogInfoLines.push({ label: "Условие успеха", value: `<= ${dcParam}` });

        await rollD100WithDialog({
            title: titleText,
            baseMod: effectiveDanger,
            dc: dcParam,
            icon: "fa-percent",
            dialogInfoLines,
            modLabels: ["Опасность", "Ручной"],
            borderColor: '#6b46c1',
            lowIsSuccess: isReverse
        });
    }

    // Global listener for @Rebellion[%] inline check buttons
    $(document).on('click', '.rebellion-percent-check', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const target = ev.currentTarget;
        const hasDanger = target.dataset.hasDanger === "true";
        const dcParam = target.dataset.dc ? parseInt(target.dataset.dc) : null;
        const isReverse = target.dataset.reverse === "true";

        await performPercentRoll(hasDanger, dcParam, isReverse);
    });

    // Global listener for @Rebellion[%] chat buttons
    $(document).on('click', '.rebellion-percent-chat-btn', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const target = ev.currentTarget;
        const hasDanger = target.dataset.hasDanger === "true";
        const dcParam = target.dataset.dc ? parseInt(target.dataset.dc) : null;
        const isReverse = target.dataset.reverse === "true";

        // Get button text for chat
        let buttonText = hasDanger ? "d100 + Опасность" : "d100";
        if (dcParam) buttonText += isReverse ? ` ≤ КС ${dcParam}` : ` КС ${dcParam}`;

        // Create button in chat
        const chatContent = `
            <button class="rebellion-percent-roll-from-chat" 
                    data-has-danger="${hasDanger}" 
                    data-dc="${dcParam || ''}"
                    data-reverse="${isReverse}"
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
        const isReverse = button.dataset.reverse === "true";

        await performPercentRoll(hasDanger, dcParam, isReverse);

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

        const statCfg = getStatConfig(statType);
        const statLabel = statCfg.label;
        const icon = statCfg.icon;

        // Create chat message with roll and adjustment buttons
        await ChatMessage.create({
            roll: roll,
            content: await roll.render(),
            sound: CONFIG.sounds.dice,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            speaker: ChatMessage.getSpeaker()
        });

        // Create result message with adjustment buttons
        const resultMessage = buildStatAdjustCard(statCfg, result, statType);

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

        const statCfg = getStatConfig(statType);
        const statLabel = statCfg.label;
        const icon = statCfg.icon;

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

        const statCfg = getStatConfig(statType);
        const statLabel = statCfg.label;
        const icon = statCfg.icon;

        // Create chat message with roll and adjustment buttons
        await ChatMessage.create({
            roll: roll,
            content: await roll.render(),
            sound: CONFIG.sounds.dice,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            speaker: ChatMessage.getSpeaker()
        });

        // Create result message with adjustment buttons
        const resultMessage = buildStatAdjustCard(statCfg, result, statType);

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

        const statCfgAdj = getStatConfig(statType);
        oldValue = data[statType] ?? 0;
        const maxVal = statType === "notoriety" ? 100 : Infinity;
        newValue = operation === "add" ? Math.min(maxVal, oldValue + value) : Math.max(0, oldValue - value);
        updateData[statType] = newValue;

        await DataHandler.update(updateData);

        // Log the change to phase report and chat
        const statCfgLog = getStatConfig(statType);
        const verb = operation === "add" ? statCfgLog.addVerb : statCfgLog.subVerb;
        const sign = operation === "add" ? `+${value}` : `-${value}`;
        const logMessage = `${verb} (${sign}${statCfgLog.unit}): ${oldValue} → ${newValue}`;
        const notificationText = `${verb} (${sign}${statCfgLog.unit}). Новое значение: ${newValue}`;

        const changeText = operation === "add" ? `+${value}` : `-${value}`;

        // Add to phase report with beautiful card
        const currentData = DataHandler.get();
        const iconAdj = statCfgLog.emoji;
        const colorPositive = operation === "add" ? (statType === "notoriety" ? "#e74c3c" : "#27ae60") : (statType === "notoriety" ? "#27ae60" : "#e74c3c");
        const color = colorPositive;

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
                    <span style="font-size: 1.8em;">${iconAdj}</span>
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
                    <i class="fas ${statCfgLog.icon}"></i> 
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

    // === Delegated button listeners (table-driven) ===
    const BUTTON_ACTIONS = {
        '.roll-mitigate-btn': '_onMitigateRoll',
        '.restore-disabled-team-btn': '_onRestoreDisabledTeam',
        '.pf2e-mitigation-btn': '_onPlayerSkillRoll',
        '.roll-stukach-btn': '_onStukachRoll',
        '.roll-failed-protest-btn': '_onFailedProtestRoll',
        '.roll-catastrophic-mission-btn': '_onCatastrophicMissionRoll',
        '.roll-ally-danger-btn': '_onAllyDangerRoll',
        '.roll-traitor-btn': '_onTraitorRoll',
        '.traitor-execute-btn': '_onTraitorExecute',
        '.traitor-exile-btn': '_onTraitorExile',
        '.traitor-imprison-btn': '_onTraitorImprison',
        '.traitor-execute-loyalty-btn': '_onTraitorExecuteLoyalty',
        '.traitor-exile-security-btn': '_onTraitorExileSecurity',
        '.traitor-persuade-btn': '_onTraitorPersuade',
        '.traitor-persuade-attempt-btn': '_onTraitorPersuadeAttempt',
        '.traitor-execute-from-prison-btn': '_onTraitorExecuteFromPrison',
        '.traitor-exile-from-prison-btn': '_onTraitorExileFromPrison',
        '.traitor-prison-secrecy-btn': '_onTraitorPrisonSecrecy',
        '.collect-supporters-bonus-btn': '_onCollectSupportersBonus',
        '.traitor-redeem-attempt-btn': '_onTraitorRedeemAttempt',
        '.invasion-ignore-btn': '_onIgnoreInvasion',
        '.manipulate-choose-event-btn': '_onManipulateChooseEvent',
        '.rescue-result-btn': '_onRescueResult',
    };

    for (const [selector, method] of Object.entries(BUTTON_ACTIONS)) {
        $(document).on('click', selector, (ev) => {
            ev.preventDefault();
            const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
            sheet[method](ev);
        });
    }

    // Add reroll buttons to chat messages after they're created
    Hooks.on('renderChatMessage', async (message, html, data) => {
        const rollContext = message.flags?.pf2e?.context ?? {};
        const customRollFlags = message.flags?.["pf2e-ts-adv-pf1ehr"] ?? {};
        const nestedRollContext = rollContext?.context ?? {};
        const isRerollMessage = !!customRollFlags.isReroll || !!rollContext.isReroll || !!nestedRollContext.isReroll;
        const eventRollResults = game.rebellionEventRollResults ?? (game.rebellionEventRollResults = {});
        const teamActionRollResults = game.rebellionTeamActionRollResults ?? (game.rebellionTeamActionRollResults = {});
        const silverActionRollResults = game.rebellionSilverActionRollResults ?? (game.rebellionSilverActionRollResults = {});
        const processedEventMessages = game.rebellionProcessedEventMessages ?? (game.rebellionProcessedEventMessages = new Set());
        const processedActionMessages = game.rebellionProcessedActionMessages ?? (game.rebellionProcessedActionMessages = new Set());
        const pendingRerolls = game.rebellionPendingRerolls ?? (game.rebellionPendingRerolls = []);
        const now = Date.now();
        for (let i = pendingRerolls.length - 1; i >= 0; i--) {
            const entry = pendingRerolls[i];
            const startedAt = entry?.startedAt ?? 0;
            const resolvedAt = entry?.resolvedAt ?? startedAt;
            const tooOld = (now - startedAt) > 120000;
            const resolvedLongAgo = !!entry?.resolved && (now - resolvedAt) > 15000;
            if (tooOld || resolvedLongAgo) pendingRerolls.splice(i, 1);
        }
        const cloneData = (value) => foundry.utils.deepClone(value);
        const messageTimestamp = message.timestamp ?? Date.now();
        const pendingRerollEntry = (!message.isRoll || !isRerollMessage || customRollFlags.originalMessageId)
            ? null
            : [...pendingRerolls]
                .reverse()
                .find(entry =>
                    entry &&
                    entry.source === "module-reroll" &&
                    !entry.resolved &&
                    (!entry.matchedMessageId || entry.matchedMessageId === message.id) &&
                    (Date.now() - (entry.startedAt ?? 0)) <= 30000 &&
                    messageTimestamp >= ((entry.startedAt ?? 0) - 2000)
                ) || null;
        if (pendingRerollEntry && !pendingRerollEntry.matchedMessageId) {
            pendingRerollEntry.matchedMessageId = message.id;
        }

        const getContextValue = (key) =>
            customRollFlags[key] ??
            rollContext[key] ??
            nestedRollContext[key];
        const pendingContextValue = (key) => pendingRerollEntry?.contextData?.[key];
        const contextEventName = getContextValue("eventName") || pendingContextValue("eventName") || null;
        const hasContextFlag = (flagName) => {
            const value = getContextValue(flagName);
            if (value === true) return true;
            return pendingContextValue(flagName) === true;
        };
        const appendAllyRerollButton = (checkType) => {
            if (!checkType || isRerollMessage) return false;

            const rebellionData = DataHandler.get();
            const rerollInfo = DataHandler.getRerollForCheck(rebellionData, checkType);
            if (!rerollInfo.available) return false;

            const buttonConfigByType = {
                security: { color: "#4a90e2", label: "Переброс Чуко" },
                loyalty: { color: "#e91e63", label: "Переброс Шенсен" },
                secrecy: { color: "#9c27b0", label: "Переброс Стреа" }
            };
            const cfg = buttonConfigByType[checkType];
            if (!cfg) return false;

            if (html.find(`.rebellion-reroll-btn[data-message-id="${message.id}"][data-type="${checkType}"]`).length > 0) {
                return true;
            }

            const rerollButton = $(`
                <button class="rebellion-reroll-btn"
                        data-message-id="${message.id}"
                        data-type="${checkType}"
                        style="margin: 5px; padding: 4px 8px; background: ${cfg.color}; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">
                    ${cfg.label}
                </button>
            `);
            html.find('.message-content').append(rerollButton);
            return true;
        };
        const matchesEventName = (...names) => !!contextEventName && names.includes(contextEventName);
        const isEventRollMessage = (stateFlag, ...eventNames) => {
            const stateMatch = !!game.rebellionState?.[stateFlag];
            const flagMatch = hasContextFlag(stateFlag);
            const nameMatch = matchesEventName(...eventNames);
            const rerollNameMatch = isRerollMessage && nameMatch;
            return message.isRoll && (stateMatch || flagMatch || rerollNameMatch);
        };
        const getEventResultKey = () => customRollFlags.originalMessageId || pendingRerollEntry?.originalMessageId || message.id;
        const toFiniteNumber = (value) => {
            if (value === null || value === undefined) return null;
            if (typeof value === "number") return Number.isFinite(value) ? value : null;
            if (typeof value === "string") {
                const match = value.match(/-?\d+(?:[.,]\d+)?/);
                if (!match) return null;
                const numeric = Number(match[0].replace(",", "."));
                return Number.isFinite(numeric) ? numeric : null;
            }
            if (typeof value === "object") {
                if ("value" in value) return toFiniteNumber(value.value);
                if ("dc" in value) return toFiniteNumber(value.dc);
            }
            return null;
        };
        const firstFiniteNumber = (...values) => {
            for (const value of values) {
                const numeric = toFiniteNumber(value);
                if (numeric !== null) return numeric;
            }
            return null;
        };
        const parseDcFromText = (text) => {
            if (typeof text !== "string" || !text.length) return null;
            const match = text.match(/(?:DC|КС|КС)\s*[:=]?\s*(\d+)/i);
            if (!match) return null;
            const numeric = Number(match[1]);
            return Number.isFinite(numeric) ? numeric : null;
        };

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
                        const resultMessage = buildResultCard({
                            icon: success ? "fa-check-circle" : "fa-times-circle",
                            title: checkLabel,
                            result: total, dc, success,
                            background: success
                                ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'
                                : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)'
                        });

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
                                actionsUsedThisWeek: (data.actionsUsedThisWeek || 0) + 1
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
                                actionsUsedThisWeek: (data.actionsUsedThisWeek || 0) + 1
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
                                actionsUsedThisWeek: (data.actionsUsedThisWeek || 0) + 1
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
        const isSilverRavensActionRoll = message.isRoll && (
            !!game.rebellionState?.isSilverRavensActionRoll ||
            (isRerollMessage && hasContextFlag("isSilverRavensActionRoll"))
        );
        let handledSilverRavensActionRoll = false;
        if (isSilverRavensActionRoll) {
            const stateTimestamp = game.rebellionState?.timestamp || 0;
            const messageTimestamp = message.timestamp || Date.now();
            if (stateTimestamp && messageTimestamp < stateTimestamp) {
                return;
            }

            const roll = message.rolls?.[0];
            if (roll) {
                if (processedActionMessages.has(message.id)) return;

                const resultKey = getEventResultKey();
                const previousResult = silverActionRollResults[resultKey] ?? null;
                const selectedAction =
                    game.rebellionState?.selectedAction ??
                    getContextValue("selectedAction") ??
                    pendingContextValue("selectedAction") ??
                    previousResult?.selectedAction ??
                    null;
                const checkType =
                    game.rebellionState?.checkType ??
                    getContextValue("checkType") ??
                    getContextValue("skill") ??
                    pendingContextValue("checkType") ??
                    pendingContextValue("skill") ??
                    previousResult?.checkType ??
                    null;
                appendAllyRerollButton(checkType);
                const dc = firstFiniteNumber(
                    game.rebellionState?.dc,
                    getContextValue("dc"),
                    pendingContextValue("dc"),
                    previousResult?.dc,
                    parseDcFromText(message.flavor),
                    parseDcFromText(message.content)
                );

                if (!selectedAction || !checkType) {
                    console.warn("Rebellion: Silver Ravens reroll skipped due to missing context", { selectedAction, checkType, messageId: message.id });
                    if (game.rebellionState?.isSilverRavensActionRoll) {
                        game.rebellionState = null;
                    }
                } else {
                    processedActionMessages.add(message.id);
                    handledSilverRavensActionRoll = true;

                    const baselineData = cloneData(previousResult?.preData ?? DataHandler.get());
                    if (previousResult) {
                        await DataHandler.update(cloneData(baselineData));
                    }

                    if (game.rebellionState?.isSilverRavensActionRoll) {
                        game.rebellionState = null;
                    }

                    const total = roll.total;
                    const rollResult = roll.dice?.[0]?.results?.[0]?.result || roll.total;

                    setTimeout(async () => {
                        try {
                            const data = cloneData(baselineData);
                            const bonuses = DataHandler.getRollBonuses(data, selectedAction);
                            const silverRavensTeam = {
                                label: "РЎРµСЂРµР±СЂСЏРЅС‹Рµ Р’РѕСЂРѕРЅС‹",
                                type: "silverRavens",
                                currentAction: selectedAction,
                                manager: "",
                                bonus: 0,
                                isStrategistTarget: false
                            };
                            const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
                            const rollObj = {
                                total: rollResult,
                                result: rollResult
                            };

                            await sheet._processSilverRavensActionResult(silverRavensTeam, selectedAction, checkType, dc, rollObj, total, data, bonuses);
                            silverActionRollResults[resultKey] = {
                                preData: baselineData,
                                selectedAction,
                                checkType,
                                dc,
                                timestamp: Date.now()
                            };
                        } catch (error) {
                            console.error("Rebellion: РћС€РёР±РєР° РїСЂРё РѕР±СЂР°Р±РѕС‚РєРµ СЂРµР·СѓР»СЊС‚Р°С‚Р° РЎРµСЂРµР±СЂСЏРЅС‹С… Р’РѕСЂРѕРЅРѕРІ:", error);
                        }
                    }, 100);
                }
            }
            if (handledSilverRavensActionRoll) return;
        }

        const isTeamActionRoll = message.isRoll && (
            !!game.rebellionState?.isTeamActionRoll ||
            (isRerollMessage && hasContextFlag("isTeamActionRoll"))
        );
        let handledTeamActionRoll = false;
        if (isTeamActionRoll) {
            if (message.flags?.["pf2e-ts-adv-pf1ehr"]?.isTeamActionResult) {
                return;
            }

            const stateTimestamp = game.rebellionState?.timestamp || 0;
            const messageTimestamp = message.timestamp || Date.now();
            if (stateTimestamp && messageTimestamp < stateTimestamp) {
                return;
            }

            const roll = message.rolls?.[0];
            if (roll) {
                if (processedActionMessages.has(message.id)) return;

                const resultKey = getEventResultKey();
                const previousResult = teamActionRollResults[resultKey] ?? null;
                const selectedAction =
                    game.rebellionState?.selectedAction ??
                    getContextValue("selectedAction") ??
                    pendingContextValue("selectedAction") ??
                    previousResult?.selectedAction ??
                    null;
                const checkType =
                    game.rebellionState?.checkType ??
                    getContextValue("checkType") ??
                    getContextValue("skill") ??
                    pendingContextValue("checkType") ??
                    pendingContextValue("skill") ??
                    previousResult?.checkType ??
                    null;
                appendAllyRerollButton(checkType);
                const teamType =
                    game.rebellionState?.teamType ??
                    getContextValue("teamType") ??
                    pendingContextValue("teamType") ??
                    previousResult?.teamType ??
                    null;
                const teamIdxRaw =
                    game.rebellionState?.teamIdx ??
                    getContextValue("teamIdx") ??
                    pendingContextValue("teamIdx") ??
                    previousResult?.teamIdx;
                let resolvedTeamIdx = Number(teamIdxRaw);
                const dc = firstFiniteNumber(
                    game.rebellionState?.dc,
                    getContextValue("dc"),
                    pendingContextValue("dc"),
                    previousResult?.dc,
                    parseDcFromText(message.flavor),
                    parseDcFromText(message.content)
                );

                if (!selectedAction || !checkType) {
                    console.warn("Rebellion: Team action reroll skipped due to missing context", { selectedAction, checkType, messageId: message.id });
                    if (game.rebellionState?.isTeamActionRoll) {
                        game.rebellionState = null;
                    }
                } else {
                    processedActionMessages.add(message.id);
                    handledTeamActionRoll = true;

                    const baselineData = cloneData(previousResult?.preData ?? DataHandler.get());
                    if (previousResult) {
                        await DataHandler.update(cloneData(baselineData));
                    }

                    if (game.rebellionState?.isTeamActionRoll) {
                        game.rebellionState = null;
                    }

                    const total = roll.total;
                    const rollResult = roll.dice?.[0]?.results?.[0]?.result || roll.total;

                    setTimeout(async () => {
                        try {
                            const data = cloneData(baselineData);
                            const teams = cloneData(data.teams || []);

                            if (!Number.isFinite(resolvedTeamIdx) || resolvedTeamIdx < 0 || resolvedTeamIdx >= teams.length) {
                                resolvedTeamIdx = teamType ? teams.findIndex(t => t?.type === teamType) : -1;
                            }
                            const team = resolvedTeamIdx >= 0 ? teams[resolvedTeamIdx] : null;
                            if (!team) {
                                console.error("Rebellion: РљРѕРјР°РЅРґР° РЅРµ РЅР°Р№РґРµРЅР° РїСЂРё РѕР±СЂР°Р±РѕС‚РєРµ СЂРµСЂРѕР»Р»Р° РґРµР№СЃС‚РІРёСЏ", { teamIdxRaw, teamType, resultKey });
                                return;
                            }

                            team.currentAction = selectedAction;
                            team.hasActed = true;

                            const def = getTeamDefinition(team.type);
                            const bonuses = DataHandler.getRollBonuses(data, selectedAction);
                            const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
                            const rollObj = {
                                total: rollResult,
                                result: rollResult
                            };

                            await sheet._processTeamActionResult(team, selectedAction, checkType, dc, rollObj, total, resolvedTeamIdx, teams, data, bonuses, def);
                            teamActionRollResults[resultKey] = {
                                preData: baselineData,
                                teamIdx: resolvedTeamIdx,
                                teamType: team.type,
                                selectedAction,
                                checkType,
                                dc,
                                timestamp: Date.now()
                            };

                            if (sheet.rendered) sheet.render();
                        } catch (error) {
                            console.error("Rebellion: РћС€РёР±РєР° РїСЂРё РѕР±СЂР°Р±РѕС‚РєРµ СЂРµР·СѓР»СЊС‚Р°С‚Р° РґРµР№СЃС‚РІРёСЏ РєРѕРјР°РЅРґС‹:", error);
                        }
                    }, 100);
                }
            }
            if (handledTeamActionRoll) return;
        }

        if (isEventRollMessage("isStukachRoll", "Стукач")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Стукач", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 15;
                    const success = total >= dc;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const rebellionData = DataHandler.get();
                    const preSupporters = firstFiniteNumber(previousResult?.preSupporters, rebellionData.supporters, 0);
                    const preNotoriety = firstFiniteNumber(previousResult?.preNotoriety, rebellionData.notoriety, 0);

                    let notGain = 0;
                    if (!success) {
                        const notRoll = new Roll("1d6");
                        await notRoll.evaluate();
                        notGain = notRoll.total;
                    }

                    await DataHandler.update({
                        supporters: Math.max(0, preSupporters - 1),
                        notoriety: preNotoriety + (success ? 0 : notGain)
                    });

                    eventRollResults[resultKey] = {
                        eventName: "Стукач",
                        preSupporters,
                        preNotoriety,
                        success,
                        notGain,
                        total,
                        dc,
                        timestamp: Date.now()
                    };

                    const rerollMarker = previousResult || isRerollMessage
                        ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                        : "";

                    let resultMessage = `<h3>🕵️ Результат события: Стукач</h3>`;
                    resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Стукач нейтрализован. Потеряно 1 сторонник.</p>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Стукач ускользнул. Потеряно 1 сторонник и +${notGain} Известность.</p>`;
                    }
                    resultMessage += rerollMarker;

                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker(),
                        flags: {
                            "pf2e-ts-adv-pf1ehr": {
                                isStukachResult: true
                            }
                        }
                    });

                    if (game.rebellionState?.isStukachRoll) game.rebellionState = null;
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                }
            }
        }
        if (isEventRollMessage("isFailedProtestRoll", "Провальный протест")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Провальный протест", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 25;
                    const success = total >= dc;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const rebellionData = DataHandler.get();

                    const preSupporters = firstFiniteNumber(previousResult?.preSupporters, rebellionData.supporters, 0);
                    const prePopulation = firstFiniteNumber(previousResult?.prePopulation, rebellionData.population, 0);
                    const preEvents = cloneData(previousResult?.preEvents ?? rebellionData.events ?? []);

                    const settlementModifiers = ["Коррупция", "Преступность", "Экономика", "Закон", "Знание", "Общество"];
                    const randomModifier = settlementModifiers[Math.floor(Math.random() * settlementModifiers.length)];

                    const events = cloneData(preEvents);
                    events.push({
                        name: "Провальный протест",
                        desc: `Модификатор поселения Кинтарго "${randomModifier}" уменьшен на 4`,
                        weekStarted: (rebellionData.week ?? 0) + 1,
                        duration: 1,
                        isPersistent: false
                    });

                    let supporters = preSupporters;
                    let population = prePopulation;
                    let loss = 0;
                    if (!success) {
                        const suppRoll = new Roll("2d6");
                        await suppRoll.evaluate();
                        loss = suppRoll.total;
                        supporters = Math.max(0, preSupporters - loss);
                        population = Math.max(0, prePopulation - loss);
                    }

                    await DataHandler.update({ supporters, population, events });

                    eventRollResults[resultKey] = {
                        eventName: "Провальный протест",
                        preSupporters,
                        prePopulation,
                        preEvents,
                        success,
                        total,
                        dc,
                        loss,
                        randomModifier,
                        timestamp: Date.now()
                    };

                    const rerollMarker = previousResult || isRerollMessage
                        ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                        : "";

                    let resultMessage = `<h3>🏛️ Результат события: Провальный протест</h3>`;
                    resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Потери сторонников предотвращены.</p>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Потеряно ${loss} сторонников и населения.</p>`;
                    }
                    resultMessage += `<p>Модификатор поселения Кинтарго "${randomModifier}" уменьшен на 4 на следующую неделю.</p>`;
                    resultMessage += rerollMarker;

                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker(),
                        flags: {
                            "pf2e-ts-adv-pf1ehr": {
                                isFailedProtestResult: true
                            }
                        }
                    });

                    if (game.rebellionState?.isFailedProtestRoll) game.rebellionState = null;
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                }
            }
        }
        if (isEventRollMessage("isCatastrophicMissionRoll", "Катастроф. миссия", "Катастрофическая миссия")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Катастрофическая миссия", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 20;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const teamType = game.rebellionState?.teamType || getContextValue("teamType") || pendingContextValue("teamType") || previousResult?.teamType || null;
                    if (!teamType) {
                        console.warn("Rebellion: Не удалось определить команду для Катастрофической миссии", message.id);
                    } else {
                        const success = total >= dc;
                        const rebellionData = DataHandler.get();
                        const preTeams = cloneData(previousResult?.preTeams ?? rebellionData.teams ?? []);
                        const preNotoriety = firstFiniteNumber(previousResult?.preNotoriety, rebellionData.notoriety, 0);

                        const notorietyRoll = new Roll("1d6");
                        await notorietyRoll.evaluate();
                        const notorietyGain = notorietyRoll.total;

                        const teams = cloneData(preTeams);
                        const teamIndex = teams.findIndex(t => t.type === teamType);
                        const teamDef = getTeamDefinition(teamType);

                        if (success) {
                            if (teamIndex !== -1) teams[teamIndex].disabled = true;
                        } else {
                            if (teamIndex !== -1) teams.splice(teamIndex, 1);
                        }

                        await DataHandler.update({
                            teams,
                            notoriety: preNotoriety + notorietyGain
                        });

                        eventRollResults[resultKey] = {
                            eventName: "Катастроф. миссия",
                            preTeams,
                            preNotoriety,
                            teamType,
                            success,
                            total,
                            dc,
                            notorietyGain,
                            timestamp: Date.now()
                        };

                        const rerollMarker = previousResult || isRerollMessage
                            ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                            : "";

                        const teamLabel = teamDef?.label || teamType;
                        let resultMessage = `<h3>⚔️ Результат события: Катастрофическая миссия</h3>`;
                        resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;
                        if (success) {
                            resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Команда ${teamLabel} достигла цели, но стала недееспособной.</p>`;
                        } else {
                            resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Команда ${teamLabel} уничтожена и должна быть заменена.</p>`;
                        }
                        resultMessage += `<p style="color:red">Известность увеличена на ${notorietyGain}.</p>`;
                        resultMessage += rerollMarker;

                        await ChatMessage.create({
                            content: resultMessage,
                            speaker: ChatMessage.getSpeaker(),
                            flags: {
                                "pf2e-ts-adv-pf1ehr": {
                                    isCatastrophicMissionResult: true
                                }
                            }
                        });

                        if (game.rebellionState?.isCatastrophicMissionRoll) game.rebellionState = null;
                        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                        if (sheet) sheet.render();
                    }
                }
            }
        }
        if (isEventRollMessage("isAllyDangerRoll", "Союзник в опасности")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Союзник в опасности", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const dc = firstFiniteNumber(
                        game.rebellionState?.dc,
                        getContextValue("dc"),
                        pendingContextValue("dc"),
                        previousResult?.dc,
                        rollContext?.dc,
                        nestedRollContext?.dc,
                        parseDcFromText(message.flavor),
                        parseDcFromText(message.content)
                    );
                    const allyIndex = firstFiniteNumber(
                        game.rebellionState?.allyIndex,
                        getContextValue("allyIndex"),
                        pendingContextValue("allyIndex"),
                        previousResult?.allyIndex
                    );
                    const allyName = game.rebellionState?.allyName || getContextValue("allyName") || pendingContextValue("allyName") || previousResult?.allyName || "Союзник";
                    if (dc === null || allyIndex === null || allyIndex < 0) {
                        console.warn("Rebellion: Не удалось определить параметры для события 'Союзник в опасности'", { dc, allyIndex, messageId: message.id });
                    } else {
                        const total = roll.total;
                        const success = total >= dc;
                        const rebellionData = DataHandler.get();
                        const preAllies = cloneData(previousResult?.preAllies ?? rebellionData.allies ?? []);
                        const allies = cloneData(preAllies);
                        const ally = allies[allyIndex];

                        if (ally) {
                            if (success) {
                                ally.missing = true;
                                ally.captured = false;
                                ally.missingWeek = rebellionData.week;
                            } else {
                                ally.captured = true;
                                ally.missing = false;
                                delete ally.missingWeek;
                            }

                            await DataHandler.update({ allies });

                            eventRollResults[resultKey] = {
                                eventName: "Союзник в опасности",
                                preAllies,
                                dc,
                                allyIndex,
                                allyName,
                                success,
                                total,
                                timestamp: Date.now()
                            };

                            const rerollMarker = previousResult || isRerollMessage
                                ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                                : "";

                            let resultMessage = `<h3>⚠️ Результат события: Союзник в опасности</h3>`;
                            resultMessage += `<p><strong>Союзник:</strong> ${allyName}</p>`;
                            resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;
                            if (success) {
                                resultMessage += `<p style="color:#d84315"><strong>✅ Успех!</strong> ${allyName} пропадает без вести на неделю, но не схвачен.</p>`;
                            } else {
                                resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> ${allyName} схвачен.</p>`;
                            }
                            resultMessage += rerollMarker;

                            await ChatMessage.create({
                                content: resultMessage,
                                speaker: ChatMessage.getSpeaker(),
                                flags: {
                                    "pf2e-ts-adv-pf1ehr": {
                                        isAllyDangerResult: true
                                    }
                                }
                            });

                            if (game.rebellionState?.isAllyDangerRoll) game.rebellionState = null;
                            const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                            if (sheet) sheet.render();
                        }
                    }
                }
            }
        }
        if (isEventRollMessage("isDevilPerceptionRoll", "Дьявольское проникн.", "Дьявольское проникновение")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Дьявольское проникновение", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const rebellionData = DataHandler.get();
                    const devilEvent = (rebellionData.events || []).find(e => e.name === "Дьявольское проникн." || e.name === "Дьявольское проникновение");

                    const normalizeHistory = (value) => {
                        if (Array.isArray(value)) {
                            return value
                                .map(v => Number(v))
                                .filter(v => Number.isFinite(v) && v > 0);
                        }
                        if (typeof value === "string") {
                            return value
                                .split(",")
                                .map(v => Number(v))
                                .filter(v => Number.isFinite(v) && v > 0);
                        }
                        return [];
                    };

                    const totalWeeks = firstFiniteNumber(
                        game.rebellionState?.devilWeeks,
                        getContextValue("devilWeeks"),
                        pendingContextValue("devilWeeks"),
                        previousResult?.totalWeeks,
                        game.rebellionDevilInfiltration?.devilWeeks,
                        devilEvent?.devilWeeks
                    );
                    const rollHistory = normalizeHistory(
                        game.rebellionState?.devilRollHistory ??
                        getContextValue("devilRollHistory") ??
                        pendingContextValue("devilRollHistory") ??
                        previousResult?.rollHistory ??
                        game.rebellionDevilInfiltration?.devilRollHistory ??
                        devilEvent?.devilRollHistory
                    );
                    const sentinelName = game.rebellionState?.sentinelName ||
                        getContextValue("sentinelName") ||
                        pendingContextValue("sentinelName") ||
                        previousResult?.sentinelName ||
                        null;
                    const perceptionBonus = firstFiniteNumber(
                        game.rebellionState?.perceptionBonus,
                        getContextValue("perceptionBonus"),
                        pendingContextValue("perceptionBonus"),
                        previousResult?.perceptionBonus,
                        0
                    ) ?? 0;

                    if (totalWeeks === null || totalWeeks <= 0) {
                        console.warn("Rebellion: Не удалось определить недели для события 'Дьявольское проникновение'", { totalWeeks, messageId: message.id });
                    } else {
                        const preNotoriety = firstFiniteNumber(previousResult?.preNotoriety, rebellionData.notoriety, 0);
                        const dataForResolve = cloneData(rebellionData);
                        dataForResolve.notoriety = preNotoriety;

                        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet) || new RebellionSheet();
                        if (sheet && typeof sheet._resolveDevilPerceptionResult === "function") {
                            const resolution = await sheet._resolveDevilPerceptionResult({
                                data: dataForResolve,
                                totalWeeks,
                                rollHistory,
                                sentinelName,
                                perceptionBonus,
                                perceptionTotal: roll.total,
                                perceptionRoll: roll,
                                isReroll: !!previousResult || isRerollMessage
                            });

                            eventRollResults[resultKey] = {
                                eventName: "Дьявольское проникн.",
                                preNotoriety,
                                totalWeeks,
                                rollHistory,
                                sentinelName,
                                perceptionBonus,
                                perceptionTotal: roll.total,
                                resolvedWeeks: resolution?.resolvedWeeks ?? null,
                                loyaltyTotal: resolution?.loyaltyTotal ?? null,
                                notorietyGain: resolution?.notorietyGain ?? null,
                                timestamp: Date.now()
                            };
                        } else {
                            console.error("Rebellion: Не найден RebellionSheet для обработки Дьявольского проникновения");
                        }
                    }
                }
            }
        }
        if (isEventRollMessage("isTraitorRoll", "Предатель")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Предатель", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 20;
                    const success = total >= dc;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const teamType = game.rebellionState?.teamType || getContextValue("teamType") || pendingContextValue("teamType") || previousResult?.teamType || null;
                    const rebellionData = DataHandler.get();
                    const preNotoriety = firstFiniteNumber(previousResult?.preNotoriety, rebellionData.notoriety, 0);
                    const preTeams = cloneData(previousResult?.preTeams ?? rebellionData.teams ?? []);
                    const teams = cloneData(preTeams);
                    const traitorTeamDef = teamType ? getTeamDefinition(teamType) : null;

                    let notGain = 0;
                    if (!success) {
                        const notRoll = new Roll("2d6");
                        await notRoll.evaluate();
                        notGain = notRoll.total;
                        if (teamType) {
                            const teamIndex = teams.findIndex(t => t.type === teamType);
                            if (teamIndex !== -1) teams[teamIndex].disabled = true;
                        }
                    }

                    await DataHandler.update({
                        teams,
                        notoriety: preNotoriety + (success ? 0 : notGain)
                    });

                    eventRollResults[resultKey] = {
                        eventName: "Предатель",
                        preNotoriety,
                        preTeams,
                        teamType,
                        success,
                        total,
                        dc,
                        notGain,
                        timestamp: Date.now()
                    };

                    const rerollMarker = previousResult || isRerollMessage
                        ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                        : "";

                    let resultMessage = `<h3>🕵️ Результат события: Предатель</h3>`;
                    resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;

                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель в команде ${traitorTeamDef?.label || teamType || "неизвестной"} обнаружен и пойман.</p>`;
                        resultMessage += `<p><strong>Что делать с предателем?</strong></p>`;
                        resultMessage += `<div style="margin: 10px 0;">
                            <button class="traitor-execute-btn" data-team-type="${teamType || ""}" style="background: #f44336; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                ⚔️ Казнить
                            </button>
                            <button class="traitor-exile-btn" data-team-type="${teamType || ""}" style="background: #ff9800; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                🚪 Изгнать
                            </button>
                            <button class="traitor-imprison-btn" data-team-type="${teamType || ""}" style="background: #9e9e9e; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                🔒 Тюрьма
                            </button>
                        </div>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Предатель в команде ${traitorTeamDef?.label || teamType || "неизвестной"} сбежал.</p>`;
                        resultMessage += `<p><strong>Последствия:</strong> Команда недееспособна, +${notGain} Известность.</p>`;
                    }
                    resultMessage += rerollMarker;

                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });

                    if (game.rebellionState?.isTraitorRoll) game.rebellionState = null;
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                }
            }
        }
        if (isEventRollMessage("isTraitorExecuteLoyaltyRoll", "Казнь предателя")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Казнь предателя", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 20;
                    const success = total >= dc;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const teamType = game.rebellionState?.teamType || getContextValue("teamType") || pendingContextValue("teamType") || previousResult?.teamType || null;
                    const rebellionData = DataHandler.get();
                    const preEvents = cloneData(previousResult?.preEvents ?? rebellionData.events ?? []);
                    const events = cloneData(preEvents);

                    if (!success) {
                        const lowMoraleEvent = {
                            name: "Низкий боевой дух",
                            desc: "Постоянный низкий боевой дух после казни предателя. -4 Верность. Смягчение: Выступление КС 20 снижает до -2.",
                            weekStarted: rebellionData.week,
                            duration: 999,
                            isPersistent: true,
                            mitigate: "performance",
                            dc: 20
                        };

                        const existingMoraleIndex = events.findIndex(e => e.name === "Низкий боевой дух");
                        if (existingMoraleIndex !== -1) events[existingMoraleIndex] = lowMoraleEvent;
                        else events.push(lowMoraleEvent);
                    }

                    await DataHandler.update({ events });

                    eventRollResults[resultKey] = {
                        eventName: "Казнь предателя",
                        preEvents,
                        teamType,
                        success,
                        total,
                        dc,
                        timestamp: Date.now()
                    };

                    const rerollMarker = previousResult || isRerollMessage
                        ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                        : "";

                    let resultMessage = `<h3>⚔️ Результат проверки морального духа</h3>`;
                    resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Серебряные Вороны принимают необходимость казни. Моральный дух не пострадал.</p>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Казнь предателя нанесла ущерб моральному духу.</p>`;
                        resultMessage += `<p><strong>Эффект:</strong> Добавлено постоянное событие "Низкий боевой дух" (-4 Верность).</p>`;
                    }
                    resultMessage += rerollMarker;

                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });

                    if (game.rebellionState?.isTraitorExecuteLoyaltyRoll) game.rebellionState = null;
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                }
            }
        }
        if (isEventRollMessage("isTraitorExileSecurityRoll", "Изгнание предателя")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Изгнание предателя", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 25;
                    const success = total >= dc;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const rebellionData = DataHandler.get();
                    const preNotoriety = firstFiniteNumber(previousResult?.preNotoriety, rebellionData.notoriety, 0);

                    let notGain = 0;
                    if (!success) {
                        const notRoll = new Roll("2d6");
                        await notRoll.evaluate();
                        notGain = notRoll.total;
                    }

                    await DataHandler.update({ notoriety: preNotoriety + (success ? 0 : notGain) });

                    eventRollResults[resultKey] = {
                        eventName: "Изгнание предателя",
                        preNotoriety,
                        success,
                        total,
                        dc,
                        notGain,
                        timestamp: Date.now()
                    };

                    const rerollMarker = previousResult || isRerollMessage
                        ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                        : "";

                    let resultMessage = `<h3>🚪 Результат изгнания предателя</h3>`;
                    resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель убежден никогда не возвращаться в Кинтарго.</p>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Предатель вернулся и доложил врагу. +${notGain} Известность.</p>`;
                    }
                    resultMessage += rerollMarker;

                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });

                    if (game.rebellionState?.isTraitorExileSecurityRoll) game.rebellionState = null;
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                }
            }
        }
        if (isEventRollMessage("isTraitorPrisonSecrecyRoll", "Содержание предателя в тюрьме")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Содержание предателя в тюрьме", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 20;
                    const success = total >= dc;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const teamType = game.rebellionState?.teamType || getContextValue("teamType") || pendingContextValue("teamType") || previousResult?.teamType || null;
                    const eventIndex = Number(game.rebellionState?.eventIndex ?? getContextValue("eventIndex") ?? pendingContextValue("eventIndex") ?? previousResult?.eventIndex ?? -1);

                    const rebellionData = DataHandler.get();
                    const preEvents = cloneData(previousResult?.preEvents ?? rebellionData.events ?? []);
                    const preNotoriety = firstFiniteNumber(previousResult?.preNotoriety, rebellionData.notoriety, 0);
                    const events = cloneData(preEvents);

                    let notGain = 0;
                    if (!success) {
                        const notRoll = new Roll("2d6");
                        await notRoll.evaluate();
                        notGain = notRoll.total;

                        if (eventIndex >= 0 && eventIndex < events.length) {
                            events.splice(eventIndex, 1);
                        } else {
                            const fallbackIndex = events.findIndex(e => String(e?.name || "").toLowerCase().includes("предатель") && String(e?.name || "").toLowerCase().includes("тюрьм"));
                            if (fallbackIndex !== -1) events.splice(fallbackIndex, 1);
                        }
                    }

                    await DataHandler.update({
                        events,
                        notoriety: preNotoriety + (success ? 0 : notGain)
                    });

                    eventRollResults[resultKey] = {
                        eventName: "Содержание предателя в тюрьме",
                        preEvents,
                        preNotoriety,
                        teamType,
                        eventIndex,
                        success,
                        total,
                        dc,
                        notGain,
                        timestamp: Date.now()
                    };

                    const rerollMarker = previousResult || isRerollMessage
                        ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                        : "";

                    const traitorTeamDef = teamType ? getTeamDefinition(teamType) : null;
                    let resultMessage = `<h3>🔒 Результат проверки содержания предателя</h3>`;
                    resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;
                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель из команды ${traitorTeamDef?.label || teamType || "неизвестной"} остается в заключении.</p>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Предатель сбежал из заключения. +${notGain} Известность.</p>`;
                    }
                    resultMessage += rerollMarker;

                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });

                    if (game.rebellionState?.isTraitorPrisonSecrecyRoll) game.rebellionState = null;
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                }
            }
        }
        if (isEventRollMessage("isTraitorPersuadeAttemptRoll", "Переубеждение предателя")) {
            if (!processedEventMessages.has(message.id)) {
                console.log("Rebellion: Обработка результата броска Переубеждение предателя", message);
                const roll = message.rolls?.[0];
                if (roll) {
                    processedEventMessages.add(message.id);
                    const total = roll.total;
                    const dc = 20;
                    const success = total >= dc;
                    const resultKey = getEventResultKey();
                    const previousResult = eventRollResults[resultKey] ?? null;
                    const teamType = game.rebellionState?.teamType || getContextValue("teamType") || pendingContextValue("teamType") || previousResult?.teamType || null;
                    const eventIndex = Number(game.rebellionState?.eventIndex ?? getContextValue("eventIndex") ?? pendingContextValue("eventIndex") ?? previousResult?.eventIndex ?? -1);
                    const rebellionData = DataHandler.get();
                    const preTeams = cloneData(previousResult?.preTeams ?? rebellionData.teams ?? []);
                    const preEvents = cloneData(previousResult?.preEvents ?? rebellionData.events ?? []);

                    const teams = cloneData(preTeams);
                    const events = cloneData(preEvents);
                    let supportersGain = 0;

                    if (success) {
                        const supportersRoll = new Roll("1d6");
                        await supportersRoll.evaluate();
                        supportersGain = supportersRoll.total;

                        const teamIndex = teamType ? teams.findIndex(t => t.type === teamType) : -1;
                        if (teamIndex !== -1) {
                            teams[teamIndex].disabled = false;
                        }

                        if (eventIndex >= 0 && eventIndex < events.length) {
                            events.splice(eventIndex, 1);
                        } else {
                            const fallbackIndex = events.findIndex(e => String(e?.name || "").toLowerCase().includes("предатель") && String(e?.name || "").toLowerCase().includes("тюрьм"));
                            if (fallbackIndex !== -1) events.splice(fallbackIndex, 1);
                        }

                        events.push({
                            name: "Бонус от переубеждения",
                            desc: `+${supportersGain} сторонников от успешного переубеждения предателя`,
                            weekStarted: (rebellionData.week ?? 0) + 1,
                            duration: 1,
                            supportersBonus: supportersGain,
                            needsSupportersCollection: true
                        });
                    }

                    await DataHandler.update({ teams, events });

                    eventRollResults[resultKey] = {
                        eventName: "Переубеждение предателя",
                        preTeams,
                        preEvents,
                        teamType,
                        eventIndex,
                        success,
                        total,
                        dc,
                        supportersGain,
                        timestamp: Date.now()
                    };

                    const rerollMarker = previousResult || isRerollMessage
                        ? `<p style="color:#1565c0"><strong>🔄 Результат обновлен после переброса.</strong></p>`
                        : "";

                    const traitorTeamDef = teamType ? getTeamDefinition(teamType) : null;
                    let resultMessage = `<h3>✨ Результат переубеждения предателя</h3>`;
                    resultMessage += `<p><strong>${total}</strong> против КС <strong>${dc}</strong></p>`;

                    if (success) {
                        resultMessage += `<p style="color:green"><strong>✅ Успех!</strong> Предатель из команды ${traitorTeamDef?.label || teamType || "неизвестной"} переубежден.</p>`;
                        resultMessage += `<p>Команда восстановлена. В следующей фазе содержания можно получить +${supportersGain} сторонников.</p>`;
                    } else {
                        resultMessage += `<p style="color:red"><strong>❌ Провал!</strong> Переубеждение не удалось. Предатель остается в заключении.</p>`;
                    }
                    resultMessage += rerollMarker;

                    await ChatMessage.create({
                        content: resultMessage,
                        speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
                    });

                    if (game.rebellionState?.isTraitorPersuadeAttemptRoll) game.rebellionState = null;
                    const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                    if (sheet) sheet.render();
                }
            }
        }

        // Обработка результатов проверки "Поиск пропавшей команды"
        const missingSearchContext = message.flags?.pf2e?.context ?? {};
        const missingSearchFlags = message.flags?.["pf2e-ts-adv-pf1ehr"] ?? {};
        const lowerFlavor = (message.flavor || "").toLowerCase();
        const lowerContent = (message.content || "").toLowerCase();
        const hasPendingMissingSearch = !!(game.rebellionMissingSearchMap && Object.keys(game.rebellionMissingSearchMap).length > 0);
        const missingSearchByFlavor = hasPendingMissingSearch &&
            (lowerFlavor.includes("поиск пропавшей команды") || lowerContent.includes("поиск пропавшей команды"));
        if ((missingSearchContext.isMissingTeamSearchRoll || missingSearchFlags.isMissingTeamSearchRoll || missingSearchByFlavor) && message.isRoll) {
            const processedRolls = game.rebellionProcessedMissingRolls ?? (game.rebellionProcessedMissingRolls = new Set());
            const alreadyProcessed = processedRolls.has(message.id);
            if (!alreadyProcessed) {
                processedRolls.add(message.id);
                const roll = message.rolls?.[0];
                if (roll) {
                    const pendingEntries = Object.entries(game.rebellionMissingSearchMap || {});
                    const pendingByLabel = pendingEntries.find(([, value]) => {
                        const label = String(value?.teamLabel || "").toLowerCase();
                        return !!label && (lowerFlavor.includes(label) || lowerContent.includes(label));
                    });
                    const fallbackPending = pendingByLabel || pendingEntries[0] || null;

                    const missingSearchKey = missingSearchContext.missingSearchKey || missingSearchFlags.missingSearchKey || fallbackPending?.[0] || `missing:${message.id}`;
                    const mapEntry = game.rebellionMissingSearchMap?.[missingSearchKey] ?? fallbackPending?.[1] ?? {};
                    const teamType = missingSearchContext.teamType || missingSearchFlags.teamType || mapEntry?.teamType || null;
                    const teamLabel = missingSearchContext.teamLabel || missingSearchFlags.teamLabel || mapEntry?.teamLabel || teamType || "Команда";
                    console.log("Rebellion: Processing missing team search roll", { missingSearchKey, teamType, teamLabel, messageId: message.id });

                    const total = roll.total;
                    const d20Result = roll.dice?.find(d => d.faces === 20)?.results?.find(r => r.active && !r.discarded)?.result
                        ?? roll.dice?.[0]?.results?.[0]?.result
                        ?? total;
                    const outcome = total >= 15 ? "success" : d20Result === 1 ? "criticalFailure" : "failure";
                    const isRerollMessage = !!missingSearchContext.isReroll || !!missingSearchFlags.isReroll || !!message.flags?.pf2e?.context?.isReroll;

                    try {
                        const rebellionData = DataHandler.get();
                        const teams = JSON.parse(JSON.stringify(rebellionData.teams || []));
                        let resolvedTeamType = teamType;
                        let resolvedTeamLabel = teamLabel;
                        const teamSnapshot = mapEntry?.teamSnapshot ? foundry.utils.deepClone(mapEntry.teamSnapshot) : null;
                        const previousResult = game.rebellionMissingSearchResults?.[missingSearchKey] ?? null;

                        // If this check was rerolled, rollback previously applied outcome.
                        if (previousResult?.outcome === "success") {
                            const previousIndex = teams.findIndex(t => t.missingSearchKey === missingSearchKey);
                            if (previousIndex !== -1) {
                                teams[previousIndex].missing = teamSnapshot?.missing ?? true;
                                teams[previousIndex].disabled = teamSnapshot?.disabled ?? false;
                                teams[previousIndex].canAutoRecover = teamSnapshot?.canAutoRecover ?? false;
                            }
                        } else if (previousResult?.outcome === "criticalFailure") {
                            const alreadyRestored = teams.some(t => t.missingSearchKey === missingSearchKey);
                            if (!alreadyRestored && teamSnapshot) {
                                const restoredTeam = foundry.utils.deepClone(teamSnapshot);
                                restoredTeam.missingSearchKey = missingSearchKey;
                                teams.push(restoredTeam);
                            }
                        }

                        if (!resolvedTeamType && game.rebellionMissingSearchMap?.[missingSearchKey]) {
                            resolvedTeamType = game.rebellionMissingSearchMap[missingSearchKey].teamType || null;
                            resolvedTeamLabel = game.rebellionMissingSearchMap[missingSearchKey].teamLabel || resolvedTeamLabel;
                        }

                        let teamIndex = teams.findIndex(t => t.missingSearchKey === missingSearchKey);
                        if (teamIndex === -1 && resolvedTeamType) {
                            teamIndex = teams.findIndex(t => t.type === resolvedTeamType);
                        }
                        if (teamIndex === -1 && teamSnapshot) {
                            const restoredTeam = foundry.utils.deepClone(teamSnapshot);
                            restoredTeam.missingSearchKey = missingSearchKey;
                            teams.push(restoredTeam);
                            teamIndex = teams.length - 1;
                        }
                        if (teamIndex === -1) {
                            return;
                        }

                        if (outcome === "success") {
                            teams[teamIndex].missing = false;
                            teams[teamIndex].disabled = true;
                            teams[teamIndex].canAutoRecover = true;
                        } else if (outcome === "criticalFailure") {
                            teams.splice(teamIndex, 1);
                        } else {
                            teams[teamIndex].missing = true;
                        }

                        // Once reroll has happened, this outcome is final for the key.
                        if (isRerollMessage) {
                            for (const team of teams) {
                                if (team.missingSearchKey === missingSearchKey) delete team.missingSearchKey;
                            }
                            if (game.rebellionMissingSearchMap) delete game.rebellionMissingSearchMap[missingSearchKey];
                        }

                        await DataHandler.update({ teams });

                        game.rebellionMissingSearchResults ??= {};
                        game.rebellionMissingSearchResults[missingSearchKey] = {
                            outcome,
                            teamType: resolvedTeamType,
                            teamLabel: resolvedTeamLabel,
                            total,
                            messageId: message.id,
                            timestamp: Date.now()
                        };

                        const outcomeText = outcome === "success"
                            ? `<p style="color:#2e7d32; margin: 8px 0 0 0;"><strong>✅ Успех!</strong> Команда найдена, но недееспособна до следующей недели.</p>`
                            : outcome === "criticalFailure"
                                ? `<p style="color:#b71c1c; margin: 8px 0 0 0;"><strong>💥 Критический провал!</strong> Команда потеряна навсегда.</p>`
                                : `<p style="color:#d32f2f; margin: 8px 0 0 0;"><strong>❌ Провал!</strong> Команда не найдена и остается пропавшей.</p>`;
                        const rerollMarker = previousResult
                            ? `<p style="color:#1565c0; margin: 8px 0 0 0;"><strong>🔄 Обновлено после переброса.</strong></p>`
                            : "";

                        const resultMessage = `
                            <div style="border: 2px solid #ff9800; padding: 12px; border-radius: 10px; background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);">
                                <h5 style="margin: 0 0 8px 0; color: #e65100;">Поиск пропавшей команды: ${resolvedTeamLabel}</h5>
                                <div style="font-size: 1.05em;"><strong>${total}</strong> против КС <strong>15</strong></div>
                                ${outcomeText}
                                ${rerollMarker}
                            </div>
                        `;

                        await ChatMessage.create({
                            content: resultMessage,
                            speaker: ChatMessage.getSpeaker(),
                            flags: {
                                "pf2e-ts-adv-pf1ehr": {
                                    isMissingTeamSearchResult: true,
                                    missingSearchKey,
                                    outcome
                                }
                            }
                        });

                        const sheet = Object.values(ui.windows).find(w => w instanceof RebellionSheet);
                        if (sheet) sheet.render();
                    } catch (error) {
                        console.error("Rebellion: Ошибка обработки поиска пропавшей команды:", error);
                    }
                }
            }
            // Кнопки переброса обрабатываются ниже в общем блоке.
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

        const context = message.flags?.pf2e?.context ?? {};
        const moduleFlags = message.flags?.["pf2e-ts-adv-pf1ehr"] ?? {};
        const flavor = message.flavor?.toLowerCase() || '';
        const content = message.content?.toLowerCase() || '';
        const contextText = JSON.stringify(context).toLowerCase();

        // Do not offer reroll for rerolled messages
        if (context.isReroll || moduleFlags.isReroll) return;

        console.log("Rebellion: Message context and flavor", { context, flavor });

        const normalizeCheckType = (value) => {
            if (typeof value !== "string") return null;
            const normalized = value.toLowerCase();
            if (normalized.includes("security") || normalized.includes("безопас")) return "security";
            if (normalized.includes("loyalty") || normalized.includes("лояль") || normalized.includes("верност")) return "loyalty";
            if (normalized.includes("secrecy") || normalized.includes("секрет") || normalized.includes("тайност")) return "secrecy";
            return null;
        };

        const getNativeCheckType = () => {
            const nestedContext = context?.context ?? {};
            const candidates = [
                context?.skill,
                context?.action,
                context?.identifier,
                context?.slug,
                context?.statistic,
                nestedContext?.skill,
                nestedContext?.action,
                nestedContext?.identifier,
                nestedContext?.slug,
                message.flags?.pf2e?.modifierName
            ];

            for (const candidate of candidates) {
                const matched = normalizeCheckType(candidate);
                if (matched) return matched;
            }

            if (Array.isArray(context?.options)) {
                for (const option of context.options) {
                    const matched = normalizeCheckType(option);
                    if (matched) return matched;
                }
            }

            return null;
        };

        const detectedType = getNativeCheckType();
        console.log("Rebellion: Detected check type for reroll", detectedType);

        // Fallback for mitigation rolls where skill is not exposed in standard PF2e context fields
        const isMitigationRoll =
            !!moduleFlags.isMitigation ||
            !!context.isMitigation ||
            !!context?.context?.isMitigation ||
            !!game.rebellionState?.isMitigation;
        const targetEventName =
            moduleFlags.eventName ||
            context.eventName ||
            context?.context?.eventName ||
            game.rebellionState?.eventName ||
            null;
        const mitigationSkill = isMitigationRoll && targetEventName
            ? rebellionData.events?.find(e => e.name === targetEventName)?.mitigate ?? null
            : null;
        const mitigationDetectedType = normalizeCheckType(mitigationSkill);
        const eventTypeByName = {
            "Стукач": "loyalty",
            "Предатель": "loyalty",
            "Казнь предателя": "loyalty",
            "Переубеждение предателя": "loyalty",
            "Провальный протест": "security",
            "Катастроф. миссия": "security",
            "Катастрофическая миссия": "security",
            "Союзник в опасности": "security",
            "Изгнание предателя": "security",
            "Содержание предателя в тюрьме": "secrecy"
        };
        const eventTypeByFlag =
            (hasContextFlag("isStukachRoll") || hasContextFlag("isTraitorRoll") || hasContextFlag("isTraitorExecuteLoyaltyRoll") || hasContextFlag("isTraitorPersuadeAttemptRoll")) ? "loyalty" :
                (hasContextFlag("isFailedProtestRoll") || hasContextFlag("isCatastrophicMissionRoll") || hasContextFlag("isAllyDangerRoll") || hasContextFlag("isTraitorExileSecurityRoll") || hasContextFlag("isMissingTeamSearchRoll")) ? "security" :
                    hasContextFlag("isTraitorPrisonSecrecyRoll") ? "secrecy" :
                        null;
        const eventDetectedType = eventTypeByName[targetEventName] || eventTypeByName[contextEventName] || eventTypeByFlag || null;
        const resolvedType = detectedType || mitigationDetectedType || eventDetectedType;
        console.log("Rebellion: Mitigation-derived reroll type", { isMitigationRoll, targetEventName, mitigationSkill, mitigationDetectedType, eventDetectedType, detectedType, resolvedType });

        const rerollConfig = {
            security: {
                available: securityReroll.available,
                aliases: ["безопасность", "security"],
                color: "#4a90e2",
                buttonLabel: "Переброс Чуко"
            },
            loyalty: {
                available: loyaltyReroll.available,
                aliases: ["лояльность", "loyalty", "верность"],
                color: "#e91e63",
                buttonLabel: "Переброс Шенсен"
            },
            secrecy: {
                available: secrecyReroll.available,
                aliases: ["секретность", "secrecy", "тайность"],
                color: "#9c27b0",
                buttonLabel: "Переброс Стреа"
            }
        };

        for (const [checkType, config] of Object.entries(rerollConfig)) {
            if (!config.available) continue;

            const fallbackTextMatch = config.aliases.some(alias =>
                contextText.includes(alias) ||
                flavor.includes(alias) ||
                content.includes(alias)
            );
            const isTargetCheck = resolvedType ? resolvedType === checkType : fallbackTextMatch;

            if (!isTargetCheck) continue;

            const rerollButton = $(`
                <button class="rebellion-reroll-btn" 
                        data-message-id="${message.id}" 
                        data-type="${checkType}"
                        style="margin: 5px; padding: 4px 8px; background: ${config.color}; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">
                    ${config.buttonLabel}
                </button>
            `);
            html.find('.message-content').append(rerollButton);
            console.log(`Rebellion: Added reroll button for ${checkType}`);

            // When type was detected from flags/state, no need to evaluate other check types.
            if (resolvedType) break;
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

        if (rerollType === 'security') {
            allyName = 'Чуко';
            skillName = 'Безопасность';
        } else if (rerollType === 'loyalty') {
            allyName = 'Шенсен';
            skillName = 'Лояльность';
        } else if (rerollType === 'secrecy') {
            allyName = 'Стреа Вестори';
            skillName = 'Секретность';
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
        const originalTotal = originalRoll?.total ?? 0;

        // Prefer PF2e native reroll handling to preserve check context and DoS.
        const hasNativeReroll = !!game.pf2e?.Check?.rerollFromMessage;
        if (!hasNativeReroll) {
            ui.notifications.error("Нативный PF2E переброс недоступен.");
            return;
        }

        const moduleFlags = message.flags?.["pf2e-ts-adv-pf1ehr"] ?? {};
        const context = message.flags?.pf2e?.context ?? {};
        const nestedContext = context?.context ?? {};
        const getContextValue = (key) => moduleFlags[key] ?? context[key] ?? nestedContext[key];
        const eventName = getContextValue("eventName") ?? null;
        const isMitigationContext = !!moduleFlags.isMitigation || !!context.isMitigation || !!context?.context?.isMitigation;
        const pendingRerolls = game.rebellionPendingRerolls ?? (game.rebellionPendingRerolls = []);
        const pendingEntry = {
            source: "module-reroll",
            originalMessageId: messageId,
            rerollType,
            eventName,
            startedAt: Date.now(),
            resolved: false,
            contextData: {
                isMitigation: isMitigationContext,
                eventName,
                isStukachRoll: getContextValue("isStukachRoll") === true,
                isFailedProtestRoll: getContextValue("isFailedProtestRoll") === true,
                isCatastrophicMissionRoll: getContextValue("isCatastrophicMissionRoll") === true,
                isAllyDangerRoll: getContextValue("isAllyDangerRoll") === true,
                isTraitorRoll: getContextValue("isTraitorRoll") === true,
                isTraitorExecuteLoyaltyRoll: getContextValue("isTraitorExecuteLoyaltyRoll") === true,
                isTraitorExileSecurityRoll: getContextValue("isTraitorExileSecurityRoll") === true,
                isTraitorPrisonSecrecyRoll: getContextValue("isTraitorPrisonSecrecyRoll") === true,
                isTraitorPersuadeAttemptRoll: getContextValue("isTraitorPersuadeAttemptRoll") === true,
                isDevilPerceptionRoll: getContextValue("isDevilPerceptionRoll") === true,
                isTeamActionRoll: getContextValue("isTeamActionRoll") === true,
                isSilverRavensActionRoll: getContextValue("isSilverRavensActionRoll") === true,
                teamIdx: getContextValue("teamIdx"),
                selectedAction: getContextValue("selectedAction"),
                checkType: getContextValue("checkType") ?? getContextValue("skill") ?? getContextValue("action"),
                teamType: getContextValue("teamType"),
                eventIndex: getContextValue("eventIndex"),
                allyIndex: getContextValue("allyIndex"),
                allyName: getContextValue("allyName"),
                dc: getContextValue("dc"),
                devilWeeks: getContextValue("devilWeeks"),
                devilRollHistory: getContextValue("devilRollHistory"),
                sentinelName: getContextValue("sentinelName"),
                perceptionBonus: getContextValue("perceptionBonus")
            }
        };
        pendingRerolls.push(pendingEntry);

        let temporaryMitigationState = false;
        if (isMitigationContext && !game.rebellionState) {
            game.rebellionState = {
                isMitigation: true,
                eventName,
                timestamp: Date.now()
            };
            temporaryMitigationState = true;
        }

        const rerollStart = pendingEntry.startedAt;

        try {
            await game.pf2e.Check.rerollFromMessage(message, { keep: "new" });

            // Mark reroll as used only after successful reroll
            await DataHandler.useReroll(data, rerollType);

            // Best-effort: add module flags to the new reroll message for strict detection.
            const findRerollMessage = () => [...game.messages.contents]
                .reverse()
                .find(m =>
                    m.isRoll &&
                    m.id !== messageId &&
                    m.flags?.pf2e?.context?.isReroll &&
                    (m.timestamp ?? 0) >= rerollStart - 10000
                );

            let rerollMessage = findRerollMessage();
            for (let attempt = 0; !rerollMessage && attempt < 8; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 150));
                rerollMessage = findRerollMessage();
            }

            if (rerollMessage) {
                if (isMitigationContext) {
                    await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "isMitigation", true);
                }
                await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "isReroll", true);
                await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "originalMessageId", messageId);
                if (eventName) {
                    await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "eventName", eventName);
                }

                const eventRollPassThroughKeys = [
                    "isStukachRoll",
                    "isFailedProtestRoll",
                    "isCatastrophicMissionRoll",
                    "isAllyDangerRoll",
                    "isTraitorRoll",
                    "isTraitorExecuteLoyaltyRoll",
                    "isTraitorExileSecurityRoll",
                    "isTraitorPrisonSecrecyRoll",
                    "isTraitorPersuadeAttemptRoll",
                    "isDevilPerceptionRoll",
                    "isTeamActionRoll",
                    "isSilverRavensActionRoll",
                    "teamIdx",
                    "selectedAction",
                    "checkType",
                    "teamType",
                    "eventIndex",
                    "allyIndex",
                    "allyName",
                    "dc",
                    "devilWeeks",
                    "devilRollHistory",
                    "sentinelName",
                    "perceptionBonus"
                ];

                for (const key of eventRollPassThroughKeys) {
                    const value = getContextValue(key) ?? pendingEntry.contextData?.[key];
                    const shouldSet = key.startsWith("is") ? value === true : value !== undefined && value !== null;
                    if (shouldSet) {
                        await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", key, value);
                    }
                }

                const contextMissingKey = context.missingSearchKey ?? context?.context?.missingSearchKey ?? null;
                if (contextMissingKey) {
                    const contextTeamType = context.teamType ?? context?.context?.teamType ?? null;
                    const contextTeamLabel = context.teamLabel ?? context?.context?.teamLabel ?? null;
                    await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "isMissingTeamSearchRoll", true);
                    await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "missingSearchKey", contextMissingKey);
                    if (contextTeamType) await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "teamType", contextTeamType);
                    if (contextTeamLabel) await rerollMessage.setFlag("pf2e-ts-adv-pf1ehr", "teamLabel", contextTeamLabel);
                }
                pendingEntry.resolved = true;
                pendingEntry.resolvedAt = Date.now();
                pendingEntry.rerollMessageId = rerollMessage.id;
            } else {
                console.warn("Rebellion: Reroll message was not found for flag sync", { messageId, rerollType, rerollStart });
            }
        } catch (error) {
            pendingEntry.resolved = true;
            pendingEntry.failed = true;
            pendingEntry.failedAt = Date.now();
            console.error("Rebellion: Native reroll failed:", error);
            ui.notifications.error("Не удалось выполнить переброс.");
            return;
        } finally {
            if (temporaryMitigationState) {
                setTimeout(() => {
                    if (game.rebellionState?.isMitigation) {
                        game.rebellionState = null;
                    }
                }, 10000);
            }
        }

        // Show simple notification
        ui.notifications.info(`${allyName} предоставляет переброс. Исходный результат: ${originalTotal}`);

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

    const button = $(`<button class="silver-raven-btn" style="min-width: 32px; flex: 0 0 32px; background-color: #194680; color: #c0c0c0; border: 1px solid #c9ad6a;" title="\u041b\u0438\u0441\u0442 \u0412\u043e\u0441\u0441\u0442\u0430\u043d\u0438\u044f"><i class="fas fa-crow"></i></button>`);

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
            <h3>🛡️ Как завершить постоянную Инквизицию</h3>
            <p><strong>Требуется:</strong> действие "Залечь на дно" с успешной проверкой Секретности КС 20.</p>
            <p><strong>Эффект при успехе:</strong> постоянная Инквизиция завершается.</p>
            <p><strong>Эффект при провале:</strong> Инквизиция продолжается.</p>
            <p><em>Примечание: только постоянная Инквизиция может быть завершена таким образом. Временная Инквизиция (1 неделя) завершается автоматически.</em></p>
        `;
    ChatMessage.create({
        content: message,
        speaker: { alias: "Система восстания" }
    });
});

