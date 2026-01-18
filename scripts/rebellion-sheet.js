import { MODULE_ID, registerSettings } from "./settings.js";

// --- КОНСТАНТЫ ---

export const REBELLION_PROGRESSION = {
    1: { min: 0, max: 9, focus: 2, secondary: 0, actions: 1, maxTeams: 2 },
    2: { min: 10, max: 14, focus: 3, secondary: 0, actions: 2, maxTeams: 2 },
    3: { min: 15, max: 19, focus: 3, secondary: 1, actions: 2, maxTeams: 3 },
    4: { min: 20, max: 29, focus: 4, secondary: 1, actions: 2, maxTeams: 3 },
    5: { min: 30, max: 39, focus: 4, secondary: 1, actions: 2, maxTeams: 4 },
    6: { min: 40, max: 54, focus: 5, secondary: 2, actions: 2, maxTeams: 4 },
    7: { min: 55, max: 74, focus: 5, secondary: 2, actions: 3, maxTeams: 4 },
    8: { min: 75, max: 104, focus: 6, secondary: 2, actions: 3, maxTeams: 5 },
    9: { min: 105, max: 159, focus: 6, secondary: 3, actions: 3, maxTeams: 5 },
    10: { min: 160, max: 234, focus: 7, secondary: 3, actions: 3, maxTeams: 5 },
    11: { min: 235, max: 329, focus: 7, secondary: 3, actions: 4, maxTeams: 6 },
    12: { min: 330, max: 474, focus: 8, secondary: 4, actions: 4, maxTeams: 6 },
    13: { min: 475, max: 664, focus: 8, secondary: 4, actions: 4, maxTeams: 6 },
    14: { min: 665, max: 954, focus: 9, secondary: 4, actions: 4, maxTeams: 6 },
    15: { min: 955, max: 1349, focus: 9, secondary: 5, actions: 5, maxTeams: 7 },
    16: { min: 1350, max: 1899, focus: 10, secondary: 5, actions: 5, maxTeams: 7 },
    17: { min: 1900, max: 2699, focus: 10, secondary: 5, actions: 5, maxTeams: 7 },
    18: { min: 2700, max: 3849, focus: 11, secondary: 6, actions: 5, maxTeams: 7 },
    19: { min: 3850, max: 5349, focus: 11, secondary: 6, actions: 6, maxTeams: 7 },
    20: { min: 5350, max: 999999, focus: 12, secondary: 6, actions: 6, maxTeams: 8 }
};

export const OFFICER_ROLES = {
    demagogue: { label: "Демагог", check: "loyalty", abilities: ["con", "cha"] },
    partisan: { label: "Партизан", check: "security", abilities: ["str", "wis"] },
    recruiter: { label: "Вербовщик", check: "special", abilities: [] },
    sentinel: { label: "Страж", check: "secondary", abilities: [] },
    spymaster: { label: "Шпион", check: "secrecy", abilities: ["dex", "int"] },
    strategist: { label: "Стратег", check: "special", abilities: [] }
};

const FOCUS_LABELS = {
    loyalty: "Верность",
    secrecy: "Секретность",
    security: "Безопасность"
};

const TEAM_TYPES = {
    sneak: { label: "Проныры", rank: 1, type: "outlaw", img: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/Teams_SNEAKStr.webp", upgrades: ["thief"] },
    thief: { label: "Воры", rank: 2, type: "outlaw", img: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_THIEVEStr.webp", upgrades: ["smuggler", "saboteur"] },
    smuggler: { label: "Контрабандисты", rank: 3, type: "outlaw", img: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_SMUGGLERStr.webp", upgrades: [] },
    saboteur: { label: "Саботажники", rank: 3, type: "outlaw", img: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_SABOTEURStr.webp", upgrades: [] },
    fushi: { label: "Сестры Фуши", rank: 2, type: "unique", img: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/fushisisters_troopstr.webp", upgrades: [], isUnique: true },
    generic: { label: "Отряд", rank: 1, type: "generic", img: "icons/svg/mystery-man.svg", upgrades: [] }
};

const UNIQUE_ALLIES = {
    "laria": { 
        match: ["laria", "лариа", "longroad", "лонгроуд"], 
        img: "modules/pf2e-ts-adv-pf1ehr/97/portret/lariat.webp",
        desc: "Бонус +2 к проверкам Верности (Действие: Вербовать сторонников)."
    }
};

const REBELLION_ACTIONS = {
    rest: "Отдых (Нет действия)",
    recruit: "Вербовать сторонников",
    gather: "Сбор информации",
    earn: "Заработок золота",
    reduce: "Снижение опасности",
    sabotage: "Саботаж",
    rescue: "Спасение персонажа",
    special: "Специальное действие",
    upgrade: "Улучшение команды"
};

// --- СОХРАНЕНИЕ ДАННЫХ ---
async function updateRebellionData(updateData, reset = false) {
    if (reset) {
        const defaultData = {
            rank: 1, supporters: 0, population: 11900, treasury: 10, notoriety: 0, danger: 0,
            focus: "loyalty", focusLocked: false, miscBonuses: { loyalty: 0, secrecy: 0, security: 0 }, 
            officers: {}, teams: [], allies: []
        };
        if (game.user.isGM) await game.settings.set("pf2e", "rebellionData", defaultData);
        else game.socket.emit(`module.${MODULE_ID}`, { type: "overrideData", payload: defaultData });
        return;
    }

    if (game.user.isGM) {
        const currentData = game.settings.get("pf2e", "rebellionData") || {};
        
        // 1. Сливаем данные
        let newData = foundry.utils.mergeObject(currentData, updateData);

        // 2. ИСПРАВЛЕНИЕ: Принудительно превращаем teams и allies обратно в массивы,
        // если mergeObject превратил их в объекты (например {0:..., 1:...})
        if (newData.teams && !Array.isArray(newData.teams)) {
            newData.teams = Object.values(newData.teams);
        }
        if (newData.allies && !Array.isArray(newData.allies)) {
            newData.allies = Object.values(newData.allies);
        }

        await game.settings.set("pf2e", "rebellionData", newData);
    } else {
        game.socket.emit(`module.${MODULE_ID}`, { type: "updateData", payload: updateData });
    }
}

// --- ЛИСТ ---
export class RebellionSheet extends FormApplication {
    constructor(object, options) {
        super(object, options);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "rebellion-sheet",
            title: "Лист Восстания: Серебряные Вороны",
            template: "modules/pf2e-ts-adv-pf1ehr/templates/rebellion-sheet.hbs",
            classes: ["pf2e", "rebellion-sheet-window"],
            width: 760, height: 850, resizable: true, 
            submitOnChange: true, 
            closeOnSubmit: false,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: ".sheet-body" }]
        });
    }

    getData() {
        const storedData = game.settings.get("pf2e", "rebellionData") || {};
        const data = foundry.utils.mergeObject({
            rank: 1, supporters: 0, population: 11900, treasury: 10, notoriety: 0, danger: 0,
            focus: "loyalty", focusLocked: false, miscBonuses: { loyalty: 0, secrecy: 0, security: 0 }, 
            officers: {}, teams: [], allies: []
        }, storedData);

        // Гарантия массивов при чтении
        if (data.teams && !Array.isArray(data.teams)) data.teams = Object.values(data.teams);
        if (!data.teams) data.teams = [];
        if (data.allies && !Array.isArray(data.allies)) data.allies = Object.values(data.allies);
        if (!data.allies) data.allies = [];

        // Проверяем Ларию (только если она активна)
        const hasLaria = data.allies.some(a => a.key === "laria" && !a.disabled && !a.missing);

        const nextRankData = REBELLION_PROGRESSION[data.rank + 1];
        const canLevelUp = nextRankData && data.supporters >= nextRankData.min;
        const nextLevelMin = nextRankData ? nextRankData.min : null;
        const progression = REBELLION_PROGRESSION[data.rank];
        const minTreasury = data.rank * 10;
        const focusLabel = FOCUS_LABELS[data.focus] || "Верность";

        const officersData = {};
        for (const [key, role] of Object.entries(OFFICER_ROLES)) {
            const officer = data.officers[key] || {};
            let dynamicBonus = officer.bonus;
            let img = null;
            if (officer.uuid) {
                const actor = fromUuidSync(officer.uuid);
                if (actor) {
                    img = actor.img;
                    if (role.abilities.length > 0) {
                        const mods = role.abilities.map(abil => actor.abilities[abil].mod);
                        dynamicBonus = Math.max(...mods);
                    }
                }
            }
            officersData[key] = { label: role.label, name: officer.name, uuid: officer.uuid, bonus: dynamicBonus, img: img };
        }

        const sentinelBonus = !!data.officers.sentinel?.uuid ? 1 : 0;
        const checks = {
            loyalty: { label: "Верность", base: 0, officer: officersData.demagogue.bonus || 0, misc: data.miscBonuses.loyalty, total: 0 },
            secrecy: { label: "Секретность", base: 0, officer: officersData.spymaster.bonus || 0, misc: data.miscBonuses.secrecy, total: 0 },
            security: { label: "Безопасность", base: 0, officer: officersData.partisan.bonus || 0, misc: data.miscBonuses.security, total: 0 }
        };

        for (const [type, obj] of Object.entries(checks)) {
            const isFocus = data.focus === type;
            obj.base = isFocus ? progression.focus : progression.secondary;
            if (!isFocus && sentinelBonus) obj.officer += 1;
            obj.total = obj.base + obj.officer + obj.misc;
        }

        let usedActions = 0;
        let standardTeamCount = 0;
        let bonusTeamCount = 0;

        const standardTeams = [];
        const uniqueTeams = [];

        data.teams.forEach((team, index) => {
            const def = TEAM_TYPES[team.key] || TEAM_TYPES.generic;
            
            // Если команда отключена, она автоматически "Rest"
            const isDisabled = team.disabled || team.missing;
            if (isDisabled && team.action !== "rest") {
                team.action = "rest"; // Визуально сбрасываем, сохранение произойдет при следующем апдейте
            }

            if (team.action !== 'rest' && !isDisabled) {
                usedActions++;
            }

            // Бонусы
            let activeBonuses = [];
            if (team.bonus) activeBonuses.push(`+${team.bonus}`);
            if (hasLaria && team.action === "recruit" && !isDisabled) {
                activeBonuses.push(`<span style="color:#0a0; font-weight:bold" title="Бонус Ларии">+2 (Лария)</span>`);
            }

            const teamData = {
                ...team,
                originalIndex: index,
                label: team.name || def.label,
                img: def.img,
                rank: def.rank,
                isUnique: def.isUnique,
                displayBonus: activeBonuses.join(" "),
                isBlocked: isDisabled // Флаг для шаблона
            };

            if (def.isUnique) {
                bonusTeamCount++;
                uniqueTeams.push(teamData);
            } else {
                standardTeamCount++;
                standardTeams.push(teamData);
            }
        });

        const processedAllies = data.allies.map((ally, index) => {
            return { ...ally, originalIndex: index };
        });

        const totalActions = progression.actions + (data.officers.strategist?.uuid ? 1 : 0);
        
        return { 
            data, progression, minTreasury, officersData, checks, 
            hasStrategist: !!data.officers.strategist?.uuid, 
            canLevelUp, nextLevelMin, focusLabel, isGM: game.user.isGM,
            standardTeams, uniqueTeams, allies: processedAllies,
            actionsList: REBELLION_ACTIONS,
            focusOptions: FOCUS_LABELS,
            rankOptions: { 1: "Уровень 1", 2: "Уровень 2", 3: "Уровень 3" },
            stats: {
                actions: { current: usedActions, max: totalActions },
                teams: { current: standardTeamCount, max: progression.maxTeams, bonus: bonusTeamCount }
            }
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('[data-action="roll"]').click(this._onRoll.bind(this));
        html.find('[data-action="level-up"]').click(this._onLevelUp.bind(this));
        html.find('.notoriety-roll').click(this._onRollNotoriety.bind(this));
        html.find('[data-action="adjust-stat"]').click(this._onAdjustStat.bind(this));
        html.find('.focus-lock-btn').click(this._onToggleLock.bind(this));
        
        if (game.user.isGM) {
            html.find('.reset-data-btn').click(this._onReset.bind(this));
            html.find('[data-action="week-maintenance"]').click(this._onMaintenance.bind(this));
        } else {
            html.find('.reset-data-btn').remove();
            html.find('[data-action="week-maintenance"]').remove();
        }

        const dragDrop = new DragDrop({ dropSelector: ".sheet-body", callbacks: { drop: this._onDrop.bind(this) } });
        dragDrop.bind(html[0]);

        html.find('.clear-officer').click(ev => {
            const role = $(ev.currentTarget).data("role");
            const officers = this.object.officers;
            officers[role] = { name: "", uuid: "", bonus: 0 };
            updateRebellionData({ officers });
        });

        html.find('.delete-team').click(this._onDeleteTeam.bind(this));
        html.find('.delete-ally').click(this._onDeleteAlly.bind(this));
        html.find('.team-upgrade-btn').click(this._onUpgradeTeam.bind(this));
        
        // ВАЖНО: Удалены ручные обработчики change для select и checkbox команд/союзников.
        // Теперь мы полностью полагаемся на submitOnChange: true и корректную работу updateRebellionData.
        // Это предотвращает двойные срабатывания и ошибки.
    }

    // --- ЛОГИКА ---

    _getTeamsFromSettings() {
        const d = game.settings.get("pf2e", "rebellionData") || {};
        let teams = d.teams || [];
        if (!Array.isArray(teams)) teams = Object.values(teams);
        return foundry.utils.duplicate(teams); 
    }

    _getAlliesFromSettings() {
        const d = game.settings.get("pf2e", "rebellionData") || {};
        let allies = d.allies || [];
        if (!Array.isArray(allies)) allies = Object.values(allies);
        return foundry.utils.duplicate(allies); 
    }

    async _onAdjustStat(event) {
        event.preventDefault();
        const field = event.currentTarget.dataset.field;
        const value = parseInt(event.currentTarget.dataset.value);
        const data = this.getData().data; 
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            const current = parseInt(data[parent][child]) || 0;
            const update = {}; update[parent] = { ...data[parent] }; update[parent][child] = current + value;
            await updateRebellionData(update);
        } else {
            const current = parseInt(data[field]) || 0;
            const update = {}; update[field] = Math.max(0, current + value);
            if (field === 'notoriety') update[field] = Math.min(100, update[field]);
            await updateRebellionData(update);
        }
    }

    async _onDeleteTeam(event) {
        event.preventDefault();
        const idx = $(event.currentTarget).closest('.team-entry').data('index');
        const teams = this._getTeamsFromSettings();
        const teamName = teams[idx] ? teams[idx].name : "Команда";
        new Dialog({
            title: "Роспуск", content: `<p>Распустить <strong>${teamName}</strong>?</p>`,
            buttons: { yes: { label: "Да", callback: async () => { const freshTeams = this._getTeamsFromSettings(); freshTeams.splice(idx, 1); await updateRebellionData({ teams: freshTeams }); } }, no: { label: "Нет" } }, default: "no"
        }).render(true);
    }

    async _onDeleteAlly(event) {
        event.preventDefault();
        const idx = $(event.currentTarget).closest('.ally-entry').data('index');
        const allies = this._getAlliesFromSettings();
        const allyName = allies[idx] ? allies[idx].name : "Союзник";
        new Dialog({
            title: "Удаление", content: `<p>Удалить <strong>${allyName}</strong>?</p>`,
            buttons: { yes: { label: "Да", callback: async () => { const freshAllies = this._getAlliesFromSettings(); freshAllies.splice(idx, 1); await updateRebellionData({ allies: freshAllies }); } }, no: { label: "Нет" } }, default: "no"
        }).render(true);
    }

    async _onUpgradeTeam(event) {
        event.preventDefault();
        const idx = $(event.currentTarget).closest('.team-entry').data('index');
        const teams = this._getTeamsFromSettings();
        const currentTeam = teams[idx];
        const def = TEAM_TYPES[currentTeam.key];
        if (!def || !def.upgrades.length) return;
        let optionsHtml = def.upgrades.map(key => { const upg = TEAM_TYPES[key]; return `<option value="${key}">${upg.label} (Ранг ${upg.rank})</option>`; }).join("");
        new Dialog({
            title: "Улучшение", content: `<form><div class="form-group"><label>Специализация:</label><select name="upgradeKey">${optionsHtml}</select></div></form>`,
            buttons: { ok: { label: "Улучшить", callback: async (html) => {
                const newKey = html.find('[name="upgradeKey"]').val();
                const newDef = TEAM_TYPES[newKey];
                const freshTeams = this._getTeamsFromSettings();
                freshTeams[idx].key = newKey;
                freshTeams[idx].name = newDef.label;
                await updateRebellionData({ teams: freshTeams });
            }}}
        }).render(true);
    }

    async _onDrop(event) {
        event.preventDefault();
        const dataStr = event.dataTransfer.getData("text/plain");
        if (!dataStr) return;
        const dragData = JSON.parse(dataStr);

        if (dragData.type === "Actor") {
            const actor = await fromUuid(dragData.uuid);
            if (!actor) return;

            // Определяем активную вкладку
            const activeTab = this._tabs[0].active;
            const dropTarget = $(event.target).closest(".officer-drop");

            // 1. Если навели прямо на слот Офицера
            if (dropTarget.length > 0) {
                const role = dropTarget.data("role");
                const officers = this.object.officers;
                officers[role] = { name: actor.name, uuid: dragData.uuid, bonus: 0 };
                updateRebellionData({ officers });
                return;
            }

            const nameLower = actor.name.toLowerCase();

            // 2. Вкладка СОЮЗНИКИ
            if (activeTab === "allies") {
                let allyData = { name: actor.name, img: actor.img, desc: "", key: "generic" };
                for (const [key, val] of Object.entries(UNIQUE_ALLIES)) {
                    if (val.match.some(m => nameLower.includes(m))) {
                        allyData.key = key;
                        allyData.img = val.img; 
                        allyData.desc = val.desc;
                        break;
                    }
                }
                const allies = this._getAlliesFromSettings();
                allies.push(allyData);
                updateRebellionData({ allies });
                ui.notifications.info(`Союзник ${actor.name} добавлен!`);
                return;
            }

            // 3. Вкладка КОМАНДЫ (или по умолчанию, если не офицер)
            if (activeTab === "teams") {
                let teamKey = null;
                if (nameLower.includes("sneak") || nameLower.includes("проныры")) teamKey = "sneak";
                else if (nameLower.includes("thief") || nameLower.includes("воры")) teamKey = "thief";
                else if (nameLower.includes("smuggler") || nameLower.includes("контрабандисты")) teamKey = "smuggler";
                else if (nameLower.includes("saboteur") || nameLower.includes("саботажники")) teamKey = "saboteur";
                else if (nameLower.includes("fushi") || nameLower.includes("фуши")) teamKey = "fushi";

                if (teamKey) {
                    const teams = this._getTeamsFromSettings();
                    teams.push({ key: teamKey, name: actor.name, action: "rest", bonus: 0 });
                    updateRebellionData({ teams });
                    ui.notifications.info(`Команда ${actor.name} добавлена!`);
                } else {
                    ui.notifications.warn("Перетащите Проныр, Воров, Саботажников или Сестер Фуши.");
                }
            }
        }
    }

    async _updateObject(event, formData) { 
        // Используем expandObject, чтобы form data (teams.0.action) стала структурой
        const expanded = foundry.utils.expandObject(formData);
        await updateRebellionData(expanded); 
    }
    
    // ... [Остальные методы _onToggleLock, _onReset, _onLevelUp, _onRoll, _onRollNotoriety без изменений] ...
    async _onToggleLock(event) { event.preventDefault(); const d = this.getData().data; await updateRebellionData({ focusLocked: !d.focusLocked }); }
    async _onReset(event) { event.preventDefault(); new Dialog({ title: "Сброс", content: "<p>Сбросить ВСЕ данные?</p>", buttons: { yes: { label: "Да", callback: () => updateRebellionData({}, true) }, no: { label: "Нет" } } }).render(true); }
    async _onLevelUp(event) { event.preventDefault(); const d = this.getData(); if (d.canLevelUp) { await updateRebellionData({ rank: d.data.rank + 1 }); ui.notifications.info(`Уровень ${d.data.rank + 1}!`); } }
    async _onRoll(event) { event.preventDefault(); const type = event.currentTarget.dataset.type; const d = this.getData(); const roll = new Roll("1d20 + @b", { b: d.checks[type].total }); await roll.evaluate(); ChatMessage.create({ flavor: `<strong>Восстание: ${d.checks[type].label}</strong>`, content: await roll.render() }); }
    async _onRollNotoriety(event) { event.preventDefault(); const d = this.getData().data; new Dialog({ title: "Известность", content: `<p>База: ${d.notoriety}. +Опасность (${d.danger})?</p>`, buttons: { yes: { label: "Да", callback: () => this._doNotorietyRoll(d.notoriety + d.danger, `${d.notoriety}+${d.danger}`) }, no: { label: "Нет", callback: () => this._doNotorietyRoll(d.notoriety, `${d.notoriety}`) } } }).render(true); }
    async _doNotorietyRoll(th, formula) { const r = await new Roll("1d100").evaluate(); const c = r.total <= th; ChatMessage.create({ content: `<div class="pf2e chat-card"><div class="card-content"><p>Порог: <strong>${th}</strong></p><div class="dice-roll"><h4 class="dice-total ${c?'failure':'success'}">${r.total}</h4></div><p style="color:${c?'#a00':'#0a0'}">${c?"ВАС ЗАМЕТИЛИ!":"Тишина"}</p></div></div>` }); }
    async _onMaintenance() { if (!game.user.isGM) return; const d = this.getData().data; const r = await new Roll("1d20 + @b", { b: this.getData().checks.loyalty.total }).evaluate(); let l = r.total >= 10 ? (await new Roll("1d6").evaluate()).total : (await new Roll(`2d4 + ${d.rank}`).evaluate()).total; if (d.treasury < d.rank * 10) l += (await new Roll(`2d4 + ${d.rank}`).evaluate()).total; const n = Math.max(0, d.supporters - l); new Dialog({ title: "Содержание", content: `<p>Потеряно: ${l}. Было: ${d.supporters} -> ${n}</p>`, buttons: { yes: { label: "Ок", callback: () => updateRebellionData({ supporters: n }) } } }).render(true); }
}

Hooks.once("init", () => { registerSettings(); Hooks.on("updateSetting", (s) => { if (s.key==="pf2e.rebellionData") Object.values(ui.windows).forEach(w => {if(w instanceof RebellionSheet) w.render(false)}) }) });
Hooks.once("ready", () => { if (game.user.isGM) game.socket.on(`module.${MODULE_ID}`, (p) => { if (p.type==="updateData") { const c = game.settings.get("pf2e", "rebellionData") || {}; game.settings.set("pf2e", "rebellionData", foundry.utils.mergeObject(c, p.payload, {insertKeys: false})); } else if (p.type==="overrideData") game.settings.set("pf2e", "rebellionData", p.payload); }) });
Hooks.on('renderActorDirectory', (app, html, data) => { if (!game.settings.get(MODULE_ID,"enableRebellionSheet")) return; const $h=$(html); let a=$h.find('.header-actions'); if(!a.length)a=$h.closest('.directory').find('.header-actions'); if(a.find('.rebellion-sheet-btn').length)return; const b=$(`<button type="button" class="rebellion-sheet-btn" style="flex:0 0 30px;width:30px;padding:0;margin-left:5px;background:#19568b;color:white;border:1px solid #0d2f4a;display:flex;align-items:center;justify-content:center"><i class="fas fa-crow"></i></button>`).click(e=>{e.preventDefault(); new RebellionSheet(game.settings.get("pf2e","rebellionData")||{}).render(true)}); a.append(b); });