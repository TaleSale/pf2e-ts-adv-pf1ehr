import { REBELLION_PROGRESSION, FOCUS_TYPES, OFFICER_ROLES, EVENT_TABLE } from "./config.js";
import { ALLY_DEFINITIONS } from "./allies.js";
import { TEAMS, getTeamDefinition } from "./teams.js";

const SETTING_KEY = "rebellionData";
const MODULE_ID = "pf2e-ts-adv-pf1ehr";

// Очередь для последовательной обработки сохранений
let saveQueue = Promise.resolve();

export class DataHandler {
    static init() {
        game.settings.register(MODULE_ID, SETTING_KEY, {
            scope: "world", config: false, type: Object, default: this.defaultData(), onChange: () => Hooks.callAll("rebellionDataChanged")
        });
        game.settings.register(MODULE_ID, "journalEntry", {
            scope: "world", config: false, type: String, default: ""
        });
        game.socket.on(`module.${MODULE_ID}`, async (payload) => { 
            if (payload.type === "update" && game.user.isGM) {
                // Только GM обрабатывает обновления от игроков
                console.log("Rebellion: GM получил обновление от игрока", payload.senderId);
                console.log("Rebellion: Данные для сохранения:", payload.data);
                // Добавляем в очередь чтобы сохранения шли последовательно
                saveQueue = saveQueue.then(async () => {
                    try {
                        await DataHandler.save(payload.data);
                        console.log("Rebellion: Данные успешно сохранены GM");
                    } catch (e) {
                        console.error("Rebellion: Ошибка сохранения:", e);
                    }
                });
            }
        });
    }

    static defaultData() {
        return {
            week: 1,
            rank: 1,
            maxRank: 20,               // Campaign max rank (full table)
            supporters: 0,
            population: 11900,
            treasury: 10,
            notoriety: 0,
            danger: 20,                // Kintargo danger rating (starts at 20%)
            focus: "loyalty",
            phaseReport: "",
            weeksWithoutEvent: 0,      // For doubling event chance
            actionsUsedThisWeek: 0,    // Track actions in Activity Phase
            strategistUsed: false,     // Track if Strategist bonus was used this week (once per week limit)
            recruitedThisPhase: false, // Track if Recruit Supporters was used this phase (once per phase limit)
            silverRavensAction: "",    // Current action selected for Silver Ravens (PC actions)
            tempBonuses: { loyalty: 0, security: 0, secrecy: 0 },
            activeEvents: [],          // Persistent events [{name, effect, weekStarted, isPersistent}]
            officers: [],
            teams: [],
            allies: [],
            events: [],                // Custom effects/notes
            caches: [],                // [{location, size, contents, value}]
            customGifts: {},           // Custom PC gifts by rank {rank: "gift text"}
            monthlyActions: {},        // Track monthly actions by ally slug {allySlug: {lastUsedWeek: number, lastUsedMonth: number}}
            eventsThisPhase: []        // Track events that occurred in current event phase
        };
    }

    static get() {
        const d = game.settings.get(MODULE_ID, SETTING_KEY);
        // Force Arrays - but preserve team structure
        if (d.teams && !Array.isArray(d.teams)) {
            // For teams, we need to preserve the object structure with indices
            const teamsObject = d.teams;
            d.teams = [];
            Object.keys(teamsObject).forEach(key => {
                const index = parseInt(key);
                d.teams[index] = teamsObject[key];
            });
        }
        ["officers", "allies", "events", "activeEvents", "caches"].forEach(key => {
            if (d[key] && !Array.isArray(d[key])) d[key] = Object.values(d[key]);
        });
        
        // Ensure monthlyActions exists
        if (!d.monthlyActions) d.monthlyActions = {};
        const data = foundry.utils.mergeObject(this.defaultData(), d);

        // Auto-repair officers
        if (!data.officers) data.officers = [];

        // 1. Remove invalid officers (no role)
        const validOfficers = data.officers.filter(o => o.role && OFFICER_ROLES[o.role]);
        data.officers = validOfficers;

        // Ensure teams array is properly structured
        if (!data.teams) data.teams = [];
        if (Array.isArray(data.teams)) {
            // Remove any undefined/null entries from the teams array
            // This handles cases where teams have been properly deleted
            data.teams = data.teams.filter(team => team !== null && team !== undefined);
        }

        return data;
    }

    static async update(newData) {
        // Обрабатываем логику стратега
        if (window.currentStrategistAction && newData.hasOwnProperty('actionsUsedThisWeek')) {
            const currentData = this.get();
            
            // Для бонусного действия стратега не увеличиваем actionsUsedThisWeek
            newData.actionsUsedThisWeek = currentData.actionsUsedThisWeek;
            newData.strategistUsed = true;
            
            // Снимаем цель стратега со всех команд
            if (newData.teams) {
                newData.teams.forEach(t => t.isStrategistTarget = false);
            }
            
            // Сбрасываем флаг
            window.currentStrategistAction = false;
        }
        
        // GM может сохранять напрямую, игроки только через сокеты
        if (game.user.isGM) {
            await this.save(newData);
        } else {
            // Проверяем, есть ли активный GM
            const activeGM = game.users.find(u => u.isGM && u.active);
            if (!activeGM) {
                ui.notifications.warn("Нет активного GM для сохранения изменений");
                return;
            }
            // Игроки отправляют данные через сокеты для обработки GM
            console.log("Rebellion: Игрок отправляет данные GM:", newData);
            game.socket.emit(`module.${MODULE_ID}`, { 
                type: "update", 
                data: newData, 
                senderId: game.user.id 
            });
            console.log("Rebellion: Данные отправлены через сокет");
        }
    }

    static async reset() {
        // Complete reset - directly set to default data without merging
        await game.settings.set(MODULE_ID, SETTING_KEY, this.defaultData());
    }

    static async save(data) {
        console.log("Rebellion save(): вызов из:", new Error().stack);
        console.log("Rebellion save(): входные данные:", JSON.stringify(data));
        const current = DataHandler.get();
        console.log("Rebellion save(): текущие данные treasury:", current.treasury);

        // Special handling for teams to preserve types and managers
        if (data.teams) {
            // If the new teams array is shorter than current, it means teams were deleted
            // In this case, use the new array directly
            if (Array.isArray(data.teams) && data.teams.length < (current.teams?.length || 0)) {
                current.teams = data.teams;
                delete data.teams;
            }
            // Fix: Skip processing if teams array contains only undefined values
            else if (Array.isArray(data.teams) && data.teams.every(t => t === undefined)) {
                delete data.teams;
            } else if (Array.isArray(data.teams)) {
                const preservedTeams = data.teams.map((team, i) => {
                    // Fix: If team is undefined, return current team to preserve existing data
                    if (team === undefined) {
                        return current.teams[i] ?? null;
                    }

                    const currentTeam = current.teams[i];

                    // If current team exists, preserve its properties
                    if (currentTeam) {
                        // Always preserve existing team type if available
                        if (currentTeam.type) {
                            // Only override if incoming team type is missing or invalid
                            if (!team.type || !TEAMS[team.type]) {
                                team.type = currentTeam.type;
                            }
                        }

                        // Use manager from update if provided, otherwise preserve existing
                        if (team.manager !== undefined) {
                            // Use new manager (including empty string for "Нет")
                        } else if (currentTeam.manager) {
                            team.manager = currentTeam.manager;
                        }
                    }

                    // Ensure team has required properties
                    if (!team.type) team.type = 'streetPerformers';
                    if (!team.manager && team.manager !== "") team.manager = "";
                    if (!team.bonus) team.bonus = 0;
                    if (team.disabled === undefined || team.disabled === null) team.disabled = false;
                    if (team.missing === undefined || team.missing === null) team.missing = false;
                    if (team.canAutoRecover === undefined || team.canAutoRecover === null) team.canAutoRecover = false;
                    if (!team.currentAction) team.currentAction = "";

                    return team;
                });
                current.teams = preservedTeams;
                delete data.teams;
            } else {
                Object.entries(data.teams).forEach(([idx, updateData]) => {
                    const i = Number(idx);
                    if (current.teams[i]) {
                        if (updateData.type === undefined || !TEAMS[updateData.type]) {
                            const preservedType = current.teams[i].type;
                            updateData.type = preservedType;
                        }
                        // Preserve manager from update data
                        if (updateData.manager !== undefined) {
                            current.teams[i].manager = updateData.manager;
                        } else if (current.teams[i].manager) {
                            // Preserve existing manager
                        }
                        foundry.utils.mergeObject(current.teams[i], updateData);
                        
                        // Ensure team has required properties after merge
                        const team = current.teams[i];
                        if (team.disabled === undefined || team.disabled === null) team.disabled = false;
                        if (team.missing === undefined || team.missing === null) team.missing = false;
                        if (team.canAutoRecover === undefined || team.canAutoRecover === null) team.canAutoRecover = false;
                    } else {
                        if (!updateData.type || !TEAMS[updateData.type]) {
                            updateData.type = 'unknown';
                        }
                        current.teams[i] = updateData;
                    }
                });
                delete data.teams;
            }
        }

        // Smart merge for arrays with numeric indices (officers, etc)
        ["officers", "allies", "events", "activeEvents", "caches"].forEach(key => {
            if (data[key] && typeof data[key] === 'object') {
                const updates = data[key];

                if (!Array.isArray(updates)) {
                    // It's an object map.
                    Object.entries(updates).forEach(([idx, updateData]) => {
                        const i = Number(idx);
                        if (current[key][i]) {
                            // For teams, preserve the manager field if it exists in the update
                            if (key === 'teams' && updateData.manager !== undefined) {
                                current[key][i].manager = updateData.manager;
                            }
                            foundry.utils.mergeObject(current[key][i], updateData);
                        } else {
                            current[key][i] = updateData;
                        }
                    });
                    delete data[key];
                } else {
                    // It IS an array (direct save call?). Replace it.
                    current[key] = updates;
                    delete data[key];
                }
            }
        });

        // Special handling for monthlyActions (object with string keys, not array)
        if (data.monthlyActions && typeof data.monthlyActions === 'object') {
            if (!current.monthlyActions) current.monthlyActions = {};
            foundry.utils.mergeObject(current.monthlyActions, data.monthlyActions);
            delete data.monthlyActions;
        }

        const merged = foundry.utils.mergeObject(current, data);
        console.log("Rebellion save(): merged данные:", JSON.stringify(merged));
        await game.settings.set(MODULE_ID, SETTING_KEY, merged);
        console.log("Rebellion save(): сохранено в settings");
    }

    static getRollBonuses(data, actionContext = null) {
        const rankInfo = REBELLION_PROGRESSION[data.rank] || REBELLION_PROGRESSION[1];
        const focusData = FOCUS_TYPES[data.focus] || FOCUS_TYPES.loyalty;

        const stats = {
            loyalty: { total: 0, parts: [] },
            security: { total: 0, parts: [] },
            secrecy: { total: 0, parts: [] },
            maxActions: rankInfo.actions,
            recruitmentBonus: 0
        };

        const add = (t, l, v) => {
            if (v !== 0) {
                stats[t].total += v;
                stats[t].parts.push({ label: l, value: v });
            }
        };

        // Base bonuses from Focus and Rank
        ["loyalty", "security", "secrecy"].forEach(t => {
            const bonusType = focusData.bonuses[t];
            const bonus = bonusType === "focus" ? rankInfo.focusBonus : rankInfo.secondaryBonus;
            add(t, bonusType === "focus" ? "Приоритет" : "Вторичный", bonus);
            if (data.tempBonuses[t]) add(t, "Временный", data.tempBonuses[t]);
        });

        // Apply active event effects (using data.events)
        if (data.events?.length) {
            console.log("🎯 ПРИМЕНЕНИЕ БОНУСОВ ОТ СОБЫТИЙ");
            console.log("Текущая неделя:", data.week);
            console.log("Все события:", data.events);
            
            data.events.forEach(ev => {
                // Проверяем, что событие активно на текущей неделе
                const isActive = (ev.weekStarted || 0) <= (data.week || 0);
                console.log(`Событие "${ev.name}": weekStarted=${ev.weekStarted}, активно=${isActive}`);
                
                if (!isActive) return;
                
                // Positive events
                if (ev.name === "Неделя Секретности") {
                    console.log("✅ Применяем бонус +6 от 'Неделя Секретности'");
                    add("loyalty", ev.name, 6);
                    add("security", ev.name, 6);
                    add("secrecy", ev.name, 6);
                }
                if (ev.name === "Все спокойно") {
                    console.log(`✅ Применяем бонус +1 Безопасность от "${ev.name}"`);
                    add("security", ev.name, 1);
                }
                
                // Negative events
                if (ev.name === "Усиленные патрули") add("secrecy", ev.name, ev.mitigated ? -2 : -4);
                if (ev.name === "Низкий боевой дух") add("loyalty", ev.name, ev.mitigated ? -2 : -4);
                if (ev.name === "Болезнь") add("security", ev.name, ev.mitigated ? -2 : -4);
                if (ev.name === "Разлад в рядах") {
                    const penalty = ev.mitigated ? -2 : -4;
                    add("loyalty", ev.name, penalty);
                    add("security", ev.name, penalty);
                    add("secrecy", ev.name, penalty);
                }
                // Инквизиция не дает прямых модификаторов к проверкам, только влияет на потери сторонников и военное положение
                
                // Эффекты от действий фазы деятельности
                if (ev.isActionEffect) {
                    // Городское влияние: +2 к социальным проверкам (применяется к Верности)
                    if (ev.name === "Городское влияние" && ev.socialBonus) {
                        add("loyalty", "Городское влияние", ev.socialBonus);
                    }
                    // Собранная информация: бонус к проверкам Знания (применяется к Секретности для knowledge action)
                    if (ev.name === "Собранная информация" && ev.knowledgeBonus && actionContext === 'knowledge') {
                        add("secrecy", "Собранная информация", ev.knowledgeBonus);
                    }
                    // Убежище: бонусы собираются отдельно и ограничиваются максимумом +5
                }
                
                // Кастомные модификаторы
                if (ev.isCustomModifier && ev.modifierValue && ev.affectedChecks?.length) {
                    // Проверяем длительность для временных эффектов
                    let isStillActive = true;
                    if (!ev.isPersistent && ev.duration) {
                        const weeksElapsed = (data.week || 0) - (ev.weekStarted || 0);
                        isStillActive = weeksElapsed < ev.duration;
                    }
                    
                    if (isStillActive) {
                        ev.affectedChecks.forEach(checkType => {
                            if (['loyalty', 'security', 'secrecy'].includes(checkType)) {
                                add(checkType, ev.name, ev.modifierValue);
                            }
                        });
                    }
                }
            });
        }
        
        // Calculate safehouse bonus separately with max +5 limit
        const safehouseEvents = (data.events || []).filter(ev => 
            ev.isActionEffect && ev.name.startsWith("Убежище:") && ev.securityBonus
        );
        if (safehouseEvents.length > 0) {
            // Each safehouse gives +1, max total +5
            const totalSafehouseBonus = Math.min(5, safehouseEvents.reduce((sum, ev) => sum + (ev.securityBonus || 1), 0));
            add("security", `Убежища (${safehouseEvents.length})`, totalSafehouseBonus);
        }

        // Officer bonuses
        const officersByRole = {};
        data.officers.forEach(off => {
            // Skip disabled/missing/captured officers
            if (off.disabled || off.missing || off.captured) return;
            
            // Sentinel is special - doesn't require actorId, only selectedChecks matter
            if (off.role === 'sentinel') {
                if (!officersByRole.sentinel) officersByRole.sentinel = [];
                officersByRole.sentinel.push({ name: "Страж", val: 0, checks: off.selectedChecks });
                return;
            }
            
            // Other officers require actorId
            if (!off.actorId) return;
            
            const actor = game.actors.get(off.actorId);
            const allyDef = ALLY_DEFINITIONS[off.actorId];
            let val = 0, name = "НПС";
            if (actor) {
                name = actor.name;
                const roleData = OFFICER_ROLES[off.role];
                if (off.role === 'recruiter') val = actor.level || 1;
                else if (roleData && roleData.abilities?.length) {
                    // Helper to get ability mod
                    const getMod = (a, attr) => a.system?.abilities?.[attr]?.mod ?? a.abilities?.[attr]?.mod ?? 0;

                    // Always pick the best attribute
                    const mods = roleData.abilities.map(attr => getMod(actor, attr));
                    val = Math.max(...mods);
                }
            } else if (allyDef) {
                name = allyDef.name;
                
                // If ally has bound actor, get modifiers from the actor sheet
                const allyData = data.allies.find(a => a.slug === off.actorId);
                if (allyData && allyData.actorId) {
                    const boundActor = game.actors.get(allyData.actorId);
                    if (boundActor) {
                        const getMod = (a, attr) => a.system?.abilities?.[attr]?.mod ?? a.abilities?.[attr]?.mod ?? 0;
                        const roleData = OFFICER_ROLES[off.role];
                        
                        if (off.role === 'recruiter') {
                            val = boundActor.level || 1;
                        } else if (roleData && roleData.abilities?.length) {
                            if (off.selectedAttribute) {
                                val = getMod(boundActor, off.selectedAttribute);
                            } else {
                                const mods = roleData.abilities.map(attr => getMod(boundActor, attr));
                                val = Math.max(...mods);
                            }
                        }
                    }
                }
            }
            if (!officersByRole[off.role]) officersByRole[off.role] = [];
            officersByRole[off.role].push({ name, val, checks: off.selectedChecks });
        });

        // Apply officer bonuses (Demagogue, Partisan, Spymaster)
        ["demagogue", "partisan", "spymaster"].forEach(role => {
            if (officersByRole[role]?.length) {
                const best = officersByRole[role].reduce((p, c) => (p.val > c.val ? p : c));
                add(OFFICER_ROLES[role].target, OFFICER_ROLES[role].label, best.val);
            }
        });

        // Strategist adds +1 action
        if (officersByRole.strategist?.length) stats.maxActions += 1;

        // Manticce (Королева Мантикке) adds +1 bonus action for Earn Gold
        // This is handled separately in activity phase - not a general action increase
        // if (this.isAllyActive(data, 'manticce')) stats.maxActions += 1;

        // Recruiter adds to recruitment roll
        if (officersByRole.recruiter?.length) {
            stats.recruitmentBonus = officersByRole.recruiter.reduce((s, r) => s + r.val, 0);
        }

        // Sentinel adds +1 to two secondary checks
        if (officersByRole.sentinel?.length) {
            const s = officersByRole.sentinel[0];
            console.log("Sentinel officer found:", s);
            console.log("Sentinel checks:", s.checks);
            if (s.checks?.length) {
                s.checks.forEach(c => {
                    console.log("Adding Sentinel bonus to:", c);
                    add(c, "Страж", 1);
                });
            }
        } else {
            console.log("No sentinel in officersByRole:", officersByRole);
        }

        // Ally bonuses - only from enabled allies
        data.allies.forEach(a => {
            // Check if ally is enabled and active
            if (a.enabled === false || a.missing || a.captured) return;

            // Apply bonuses based on ally slug
            if (a.slug === 'blosodriette') {
                add('secrecy', 'Блосодриетта', 1);
                add('loyalty', 'Бес', -1);
            }
            if (a.slug === 'jilia') {
                add('security', 'Джилия', 2);
                add('loyalty', 'Джилия', 2);
            }
            if (a.slug === 'jackdaw') {
                ['loyalty', 'security', 'secrecy'].forEach(t => add(t, "Галка", 1));
            }
            if (a.slug === 'mialari' && a.selectedBonus) {
                add(a.selectedBonus, "Миалари", 1);
            }
            if (a.slug === 'tayacet') {
                if (a.revealed) {
                    add('loyalty', "Таясет", 2);
                } else {
                    add('secrecy', "Таясет", 2);
                    add('security', "Таясет", 2);
                }
            }

            // Context-specific ally bonuses (only applied for specific actions)
            if (actionContext) {
                // Laria: +2 Loyalty for Recruit Supporters action
                if (a.slug === 'laria' && actionContext === 'recruitSupporters') {
                    add('loyalty', 'Лариа', 2);
                }
                // Octavio: +4 Security for Rescue Character action
                if (a.slug === 'octavio' && actionContext === 'rescueCharacter') {
                    add('security', 'Октавио', 4);
                }
                // Vendalfek: +4 Secrecy for Spread Disinformation action
                if (a.slug === 'vendalfek' && actionContext === 'disinformation') {
                    add('secrecy', 'Вендалфек', 4);
                }
            }
        });

        // Team bonuses
        data.teams.forEach(t => {
            if (!t.disabled && !t.missing && t.type === 'acisaziScouts') add('secrecy', "Разведчики", 1);
        });

        // Safehouse bonus comes from "Убежище:" events, not from caches directly
        // Each activation gives +1 Security (max +5 total from all active safehouse events)
        
        return stats;
    }

    /**
     * Get action-specific bonus for an ally
     * @param {Object} data - rebellion data
     * @param {string} action - action name (recruitSupporters, rescueCharacter, disinformation)
     * @returns {Object} - { bonus: number, source: string }
     */
    static getActionAllyBonus(data, action) {
        let bonus = 0;
        let sources = [];

        data.allies.forEach(a => {
            if (a.enabled === false || a.missing || a.captured) return;

            // Laria: +2 Loyalty for Recruit Supporters
            if (a.slug === 'laria' && action === 'recruitSupporters') {
                bonus += 2;
                sources.push('Лариа (+2)');
            }
            // Octavio: +4 Security for Rescue Character
            if (a.slug === 'octavio' && action === 'rescueCharacter') {
                bonus += 4;
                sources.push('Октавио (+4)');
            }
            // Vendalfek: +4 Secrecy for Spread Disinformation (when team exists)
            if (a.slug === 'vendalfek' && action === 'disinformation') {
                const hasDisinfoTeam = data.teams.some(t =>
                    !t.disabled && !t.missing &&
                    ['rumormongers', 'agitators', 'cognoscenti'].includes(t.type)
                );
                if (hasDisinfoTeam) {
                    bonus += 4;
                    sources.push('Вендалфек (+4)');
                }
            }
        });

        return { bonus, sources };
    }

    /**
     * Check if ally allows action without team
     * @param {Object} data - rebellion data
     * @param {string} action - action name
     * @returns {boolean}
     */
    static allyEnablesAction(data, action) {
        // Vendalfek allows Spread Disinformation without a team
        if (action === 'disinformation' && this.isAllyActive(data, 'vendalfek')) {
            return true;
        }
        return false;
    }

    /**
     * Check if ally can provide weekly reroll
     * @param {Object} data - rebellion data
     * @param {string} checkType - loyalty, security, or secrecy
     * @returns {{available: boolean, allyName: string}}
     */
    static getRerollForCheck(data, checkType) {
        const rerollAllies = {
            'security': { slug: 'chuko', name: 'Чуко' },
            'loyalty': { slug: 'shensen', name: 'Шенсен' },
            'secrecy': { slug: 'strea', name: 'Стреа' }
        };

        const allyInfo = rerollAllies[checkType];
        if (!allyInfo) return { available: false, allyName: null };

        const ally = data.allies.find(a => a.slug === allyInfo.slug);
        if (!ally || ally.enabled === false || ally.missing || ally.captured) {
            return { available: false, allyName: null };
        }

        // Check if reroll was used this week
        const rerollUsed = ally.rerollUsedThisWeek || false;
        return { available: !rerollUsed, allyName: allyInfo.name };
    }

    /**
     * Mark reroll as used for this week
     * @param {Object} data - rebellion data
     * @param {string} checkType - loyalty, security, or secrecy
     */
    static async useReroll(data, checkType) {
        const rerollAllies = {
            'security': 'chuko',
            'loyalty': 'shensen',
            'secrecy': 'strea'
        };

        const slug = rerollAllies[checkType];
        if (!slug) return;

        const allies = JSON.parse(JSON.stringify(data.allies));
        const idx = allies.findIndex(a => a.slug === slug);
        if (idx !== -1) {
            allies[idx].rerollUsedThisWeek = true;
            await this.update({ allies });
        }
    }

    /**
     * Reset weekly rerolls (call at start of new week)
     * @param {Object} data - rebellion data
     */
    static async resetWeeklyRerolls(data) {
        const allies = JSON.parse(JSON.stringify(data.allies));
        let changed = false;
        allies.forEach(a => {
            if (a.rerollUsedThisWeek) {
                a.rerollUsedThisWeek = false;
                changed = true;
            }
        });
        if (changed) await this.update({ allies });
    }

    static isAllyActive(data, slug) {
        const ally = data.allies.find(a => a.slug === slug);
        // Ally must exist, be enabled, and not be missing/captured
        return ally && ally.enabled !== false && !ally.missing && !ally.captured;
    }

    static isEventActive(data, eventName) {
        const result = data.events && data.events.some(e => {
            const isActive = e.name === eventName && (e.weekStarted || 0) <= (data.week || 0);
            if (e.name === eventName) {
                console.log(`🔍 Проверка активности "${eventName}": weekStarted=${e.weekStarted}, currentWeek=${data.week}, активно=${isActive}`);
            }
            return isActive;
        });
        
        console.log(`🔍 isEventActive("${eventName}") = ${result}`);
        return result;
    }
    
    // Проверяет, доступен ли переброс события от действия "Манипулирование событиями"
    static canRerollEvent(data) {
        return data.events?.some(e => 
            e.name === "Манипулирование событиями" && 
            e.allowEventReroll && 
            (e.weekStarted || 0) <= (data.week || 0)
        ) || false;
    }
    
    // Использует переброс события (удаляет эффект)
    static async useEventReroll(data) {
        const events = data.events?.filter(e => 
            !(e.name === "Манипулирование событиями" && e.allowEventReroll)
        ) || [];
        await this.update({ events });
    }

    // Get effective danger with event modifiers
    static getEffectiveDanger(data) {
        let danger = data.danger || 0;
        console.log(`🎯 getEffectiveDanger НАЧАЛО: базовая опасность=${danger}, неделя=${data.week}`);
        
        // Apply danger modifiers from active events
        if (data.events?.length) {
            console.log(`🎯 Проверяем ${data.events.length} событий:`);
            data.events.forEach((ev, index) => {
                console.log(`🔍 Событие ${index + 1}:`, ev);
                console.log(`   - Название: "${ev.name}"`);
                console.log(`   - weekStarted: ${ev.weekStarted}`);
                console.log(`   - duration: ${ev.duration}`);
                console.log(`   - dangerReduction: ${ev.dangerReduction}`);
                console.log(`   - dangerIncrease: ${ev.dangerIncrease}`);
                
                const isActive = (ev.weekStarted || 0) <= (data.week || 0);
                console.log(`   - Активно: ${isActive} (${ev.weekStarted || 0} <= ${data.week || 0})`);
                
                if (!isActive) {
                    console.log(`   ❌ Событие НЕ активно, пропускаем`);
                    return;
                }
                
                // Событие "Уменьшенная угроза" (от таблицы событий)
                if (ev.name === "Уменьшенная угроза" && ev.dangerReduction) {
                    console.log(`   ✅ ПРИМЕНЯЕМ снижение опасности: -${ev.dangerReduction}`);
                    const oldDanger = danger;
                    danger = Math.max(0, danger - ev.dangerReduction);
                    console.log(`   📊 Опасность: ${oldDanger} -> ${danger}`);
                }
                
                // Эффект от действия "Снижение опасности"
                if (ev.name === "Сниженная опасность (действие)" && ev.dangerReduction) {
                    console.log(`   ✅ ПРИМЕНЯЕМ снижение опасности от действия: -${ev.dangerReduction}`);
                    const oldDanger = danger;
                    danger = Math.max(0, danger - ev.dangerReduction);
                    console.log(`   📊 Опасность: ${oldDanger} -> ${danger}`);
                }
                
                if (ev.name === "Опасные времена" && ev.dangerIncrease) {
                    console.log(`   ✅ ПРИМЕНЯЕМ увеличение опасности: +${ev.dangerIncrease}`);
                    const oldDanger = danger;
                    danger += ev.dangerIncrease;
                    console.log(`   📊 Опасность: ${oldDanger} -> ${danger}`);
                }
                
                if (ev.name === "Опасные времена" && !ev.dangerIncrease) {
                    console.log(`   ⚠️ ПРОБЛЕМА: Событие "Опасные времена" без dangerIncrease!`);
                }
                
                // Кастомные модификаторы опасности
                if (ev.isCustomModifier && ev.modifierValue && ev.affectedChecks?.includes('danger')) {
                    // Проверяем длительность для временных эффектов
                    let isStillActive = true;
                    if (!ev.isPersistent && ev.duration) {
                        const weeksElapsed = (data.week || 0) - (ev.weekStarted || 0);
                        isStillActive = weeksElapsed < ev.duration;
                    }
                    
                    if (isStillActive) {
                        console.log(`   ✅ ПРИМЕНЯЕМ кастомный модификатор опасности "${ev.name}": ${ev.modifierValue >= 0 ? '+' : ''}${ev.modifierValue}`);
                        const oldDanger = danger;
                        danger += ev.modifierValue;
                        console.log(`   📊 Опасность: ${oldDanger} -> ${danger}`);
                    }
                }
            });
        } else {
            console.log(`🎯 Нет событий для проверки`);
        }
        
        console.log(`🎯 getEffectiveDanger ИТОГ: ${danger}`);
        return danger;
    }

    // Calculate event chance
    static getEventChance(data) {
        // Проверяем гарантированное событие от действия
        const guaranteedEvent = data.events?.find(e => 
            e.name === "Гарантированное событие" && 
            e.guaranteeEvent && 
            (e.weekStarted || 0) <= (data.week || 0)
        );
        if (guaranteedEvent) {
            return 100; // Гарантированное событие
        }
        
        const effectiveDanger = this.getEffectiveDanger(data);
        let chance = effectiveDanger + data.notoriety;
        if (data.weeksWithoutEvent > 0) chance *= 2;
        return Math.min(95, Math.max(10, chance));
    }

    // Get minimum treasury
    static getMinTreasury(data) {
        // Use maintenance settings if available, otherwise fall back to default formula
        const maintenanceSettings = data.maintenanceSettings;
        
        if (maintenanceSettings && maintenanceSettings.minTreasury) {
            const rankKey = `rank${data.rank}`;
            if (maintenanceSettings.minTreasury[rankKey] !== undefined) {
                return maintenanceSettings.minTreasury[rankKey];
            }
        }
        
        // Lookup table for min treasury by rank
        const minTreasuryByRank = {
                                    1: 2,
                                    2: 3,
                                    3: 4,
                                    4: 5,
                                    5: 7,
                                    6: 9,
                                    7: 12,
                                    8: 15,
                                    9: 18,
                                    10: 22,
                                    11: 26,
                                    12: 29,
                                    13: 32,
                                    14: 35,
                                    15: 38,
                                    16: 40,
                                    17: 42,
                                    18: 43,
                                    19: 44,
                                    20: 45
                                    };
        return minTreasuryByRank[data.rank] ?? 19;
    }

    // Check if treasury is below minimum
    static isTreasuryLow(data) {
        return data.treasury < this.getMinTreasury(data);
    }

    // Check if can recruit (not at max rank)
    static canRecruit(data) {
        return data.rank < data.maxRank;
    }

    // Calculate new rank based on supporters
    static calculateRank(supporters, currentRank, maxRank) {
        for (let r = maxRank; r >= 1; r--) {
            if (supporters >= REBELLION_PROGRESSION[r].minSupporters) {
                return Math.max(r, currentRank); // Rank never drops
            }
        }
        return currentRank;
    }

    // Get actions remaining this week
    static getActionsRemaining(data) {
        const bonuses = this.getRollBonuses(data);
        let maxActions = bonuses.maxActions;
        
        // Add Manticce bonus actions for Earn Gold
        const manticceBonusActions = this.getManticceBonusActionCount(data);
        maxActions += manticceBonusActions;
        
        return maxActions - data.actionsUsedThisWeek;
    }

    // Check if team is operational
    static isTeamOperational(team) {
        return !team.disabled && !team.missing;
    }

    // Check if team is blocked by rivalry
    static isTeamBlockedByRivalry(team) {
        return team.blockedByRivalry || false;
    }

    // Check if team is effectively operational (considering rivalry)
    static isTeamEffectivelyOperational(team) {
        return this.isTeamOperational(team) && !this.isTeamBlockedByRivalry(team);
    }

    // Apply rivalry effects to teams
    static async applyRivalryEffects(data) {
        const rivalryActive = this.isEventActive(data, "Соперничество");
        const rivalryEvent = data.events.find(e => e.name === "Соперничество");
        
        if (!rivalryActive || !rivalryEvent || !rivalryEvent.affectedTeams) {
            // No rivalry active, ensure no teams are marked as blocked by rivalry
            const teams = JSON.parse(JSON.stringify(data.teams));
            let changed = false;
            
            teams.forEach(team => {
                if (team.blockedByRivalry) {
                    delete team.blockedByRivalry;
                    changed = true;
                }
            });
            
            if (changed) {
                await this.update({ teams });
            }
            return;
        }
        
        // Mark teams as blocked by rivalry (but don't change disabled state)
        const teams = JSON.parse(JSON.stringify(data.teams));
        let changed = false;
        
        teams.forEach(team => {
            const shouldBeBlocked = rivalryEvent.affectedTeams.includes(team.type);
            
            if (shouldBeBlocked && !team.blockedByRivalry) {
                team.blockedByRivalry = true;
                changed = true;
            } else if (!shouldBeBlocked && team.blockedByRivalry) {
                delete team.blockedByRivalry;
                changed = true;
            }
        });
        
        if (changed) {
            await this.update({ teams });
        }
    }

    // Remove rivalry effects from teams
    static async removeRivalryEffects(data) {
        const teams = JSON.parse(JSON.stringify(data.teams));
        let changed = false;
        
        teams.forEach(team => {
            if (team.blockedByRivalry) {
                delete team.blockedByRivalry;
                changed = true;
            }
        });
        
        if (changed) {
            await this.update({ teams });
        }
    }

    // Count operational teams (excluding unique teams)
    static countOperationalTeams(data) {
        return data.teams.filter(t => {
            if (!this.isTeamOperational(t)) return false;
            // Unique teams don't count towards the limit
            const def = TEAMS[t.type];
            if (def?.unique) return false;
            return true;
        }).length;
    }

    // Count effectively operational teams (excluding those blocked by rivalry)
    static countEffectivelyOperationalTeams(data) {
        return data.teams.filter(t => this.isTeamEffectivelyOperational(t)).length;
    }

    // Count disabled teams
    static countDisabledTeams(data) {
        // Считаем только команды, которые можно восстановить за золото
        // Исключаем команды с canAutoRecover - они восстановятся сами
        return data.teams.filter(t => t.disabled && !t.missing && !t.canAutoRecover).length;
    }

    // Count missing teams
    static countMissingTeams(data) {
        return data.teams.filter(t => t.missing).length;
    }

    // Count missing allies (who need recovery check)
    static countMissingAllies(data) {
        return data.allies ? data.allies.filter(a => a.missing).length : 0;
    }

    // Count maintenance events (events that trigger at start of maintenance phase)
    static countMaintenanceEvents(data) {
        // Count active events that have maintenance phase effects
        // This could include persistent events or special conditions
        let count = 0;
        
        console.log("🔍 countMaintenanceEvents: неделя", data.week);
        console.log("🔍 Всего событий:", (data.events || []).length);
        
        // Check for active events that need maintenance phase processing
        if (data.activeEvents) {
            const persistentCount = data.activeEvents.filter(event => 
                event.isPersistent && 
                (event.name.includes('Болезнь') || 
                 event.name.includes('Недееспособн') || 
                 event.name.includes('Пропавш'))
            ).length;
            count += persistentCount;
            console.log("🔍 Постоянные события:", persistentCount);
        }
        
        // Check for imprisoned traitor events
        if (data.events) {
            const traitorCount = data.events.filter(event => 
                event.name === "Предатель в тюрьме" && event.needsSecrecyCheck
            ).length;
            count += traitorCount;
            console.log("🔍 События 'Предатель в тюрьме':", traitorCount);
        }
        
        // Check for supporters bonus events (only if active this week)
        if (data.events) {
            const bonusEvents = data.events.filter(event => 
                event.name === "Бонус от переубеждения" && 
                event.needsSupportersCollection &&
                event.weekStarted <= data.week // Событие активно с указанной недели
            );
            count += bonusEvents.length;
            console.log("🔍 События 'Бонус от переубеждения':", bonusEvents.length);
            
            // Детальная информация о событиях бонуса
            (data.events || []).forEach((event, index) => {
                if (event.name === "Бонус от переубеждения") {
                    console.log(`🔍 Бонус ${index + 1}:`, {
                        name: event.name,
                        weekStarted: event.weekStarted,
                        needsSupportersCollection: event.needsSupportersCollection,
                        активно: event.weekStarted <= data.week
                    });
                }
            });
        }
        
        console.log("🔍 Итого maintenanceEventCount:", count);
        
        return count;
    }

    // === MONTHLY ACTIONS TRACKING ===

    /**
     * Check if ally can use monthly action
     * @param {Object} data - rebellion data
     * @param {string} allySlug - ally identifier
     * @returns {boolean}
     */
    static canUseMonthlyAction(data, allySlug) {
        if (!data.monthlyActions) data.monthlyActions = {};
        
        const lastUsed = data.monthlyActions[allySlug];
        
        console.log(`canUseMonthlyAction - allySlug: ${allySlug}, currentWeek: ${data.week}, lastUsed:`, lastUsed);
        
        // If never used, can use
        if (!lastUsed) {
            console.log(`Never used - can use: true`);
            return true;
        }
        
        // Can use if 4 weeks have passed since last use
        const weeksSinceLastUse = data.week - lastUsed.lastUsedWeek;
        const canUse = weeksSinceLastUse >= 4;
        console.log(`Weeks since last use: ${weeksSinceLastUse}, can use: ${canUse}`);
        return canUse;
    }

    /**
     * Mark monthly action as used
     * @param {Object} data - rebellion data
     * @param {string} allySlug - ally identifier
     */
    static async useMonthlyAction(data, allySlug) {
        console.log(`useMonthlyAction called - allySlug: ${allySlug}, week: ${data.week}`);
        
        const monthlyActions = { ...data.monthlyActions };
        
        monthlyActions[allySlug] = {
            lastUsedWeek: data.week
        };
        
        console.log(`Setting monthlyActions[${allySlug}] =`, monthlyActions[allySlug]);
        
        await this.update({ monthlyActions });
        console.log(`useMonthlyAction completed`);
    }

    /**
     * Get monthly action status for ally
     * @param {Object} data - rebellion data
     * @param {string} allySlug - ally identifier
     * @returns {Object} - {canUse: boolean, lastUsedWeek: number, currentMonth: number}
     */
    static getMonthlyActionStatus(data, allySlug) {
        const lastUsed = data.monthlyActions?.[allySlug];
        const canUse = this.canUseMonthlyAction(data, allySlug);
        
        let weeksUntilAvailable = null;
        if (!canUse && lastUsed) {
            // Calculate weeks until available (4 weeks after last use)
            const nextAvailableWeek = lastUsed.lastUsedWeek + 4;
            weeksUntilAvailable = Math.max(0, nextAvailableWeek - data.week);
        }
        
        return {
            canUse: canUse,
            lastUsedWeek: lastUsed?.lastUsedWeek || null,
            weeksUntilAvailable: weeksUntilAvailable
        };
    }

    /**
     * Get all allies with monthly actions and their status
     * @param {Object} data - rebellion data
     * @returns {Array} - [{slug, name, action, status}]
     */
    static getAlliesWithMonthlyActions(data) {
        const monthlyAllies = [];
        
        data.allies.forEach(ally => {
            if (ally.enabled === false || ally.missing || ally.captured) return;
            
            const allyDef = ALLY_DEFINITIONS[ally.slug];
            if (!allyDef) return;
            
            // Check for monthly actions
            if (allyDef.bonuses?.freeCacheMonthly) {
                const status = this.getMonthlyActionStatus(data, ally.slug);
                monthlyAllies.push({
                    slug: ally.slug,
                    name: allyDef.name,
                    action: 'Создание бесплатного тайника',
                    actionType: 'freeCacheMonthly',
                    status: status
                });
            }
            
            // TODO: Add other monthly actions here as they are discovered/added
            // Examples of potential monthly actions:
            // - Monthly recruitment bonus
            // - Monthly treasury contribution
            // - Monthly special mission
            // - Monthly equipment provision
            
        });
        
        return monthlyAllies;
    }


    /**
     * Check if team can use Manticce's bonus Earn Gold action
     * @param {Object} data - rebellion data
     * @param {Object} team - team object
     * @returns {boolean}
     */
    static canUseManticceBonusAction(data, team) {
        console.log('=== Checking Manticce bonus action ===');
        console.log('Team:', team);
        
        // Manticce must be active
        const manticceActive = this.isAllyActive(data, 'manticce');
        console.log('Manticce active:', manticceActive);
        if (!manticceActive) return false;
        
        // Check if bonus action was already used this turn
        const manticceBonusUsed = data.manticceBonusUsedThisWeek || false;
        console.log('Manticce bonus used this week:', manticceBonusUsed);
        if (manticceBonusUsed) {
            console.log('Manticce bonus action already used this week');
            return false;
        }
        
        // Find Manticce ally to get favorite player
        const manticceAlly = data.allies.find(a => a.slug === 'manticce');
        console.log('Manticce ally:', manticceAlly);
        if (!manticceAlly || !manticceAlly.favoritePlayer) {
            console.log('No Manticce ally or no favorite player');
            return false;
        }
        
        // Check if team manager is the favorite player
        console.log('Team manager:', team.manager, 'Favorite player:', manticceAlly.favoritePlayer);
        
        // Get manager name (could be ID or name)
        let managerName = team.manager;
        if (team.manager) {
            // Try to find actor by ID first
            const actor = game.actors.get(team.manager);
            if (actor) {
                managerName = actor.name;
            } else {
                // If not found by ID, assume it's already a name
                managerName = team.manager;
            }
        }
        
        console.log('Manager name:', managerName, 'Favorite player:', manticceAlly.favoritePlayer);
        if (managerName !== manticceAlly.favoritePlayer) {
            console.log('Manager name does not match favorite player');
            return false;
        }
        
        // Team must have earnGold capability (not necessarily selected as current action)
        const teamDef = getTeamDefinition(team.type);
        console.log('Team definition:', teamDef);
        console.log('Team caps:', teamDef?.caps);
        if (!teamDef || !teamDef.caps || !teamDef.caps.includes('earnGold')) {
            console.log('Team does not have earnGold capability');
            return false;
        }
        
        console.log('✅ Can use Manticce bonus action!');
        return true;
    }

    /**
     * Get count of teams that can use Manticce bonus action
     * @param {Object} data - rebellion data
     * @returns {number}
     */
    static getManticceBonusActionCount(data) {
        if (!this.isAllyActive(data, 'manticce')) return 0;
        
        const manticceAlly = data.allies.find(a => a.slug === 'manticce');
        if (!manticceAlly || !manticceAlly.favoritePlayer) return 0;
        
        // Count teams doing earnGold with favorite player as manager
        return data.teams.filter(team => 
            !team.disabled && !team.missing &&
            team.currentAction === 'earnGold' &&
            team.manager === manticceAlly.favoritePlayer
        ).length;
    }

    // === EVENT PHASE TRACKING ===

    /**
     * Add event to current phase tracking
     * @param {Object} data - rebellion data
     * @param {string} eventName - name of the event
     */
    static async addEventToCurrentPhase(data, eventName) {
        const eventsThisPhase = [...(data.eventsThisPhase || [])];
        eventsThisPhase.push(eventName);
        await this.update({ eventsThisPhase });
    }

    /**
     * Check if event occurred in current phase
     * @param {Object} data - rebellion data
     * @param {string} eventName - name of the event
     * @returns {number} - count of how many times this event occurred
     */
    static getEventCountThisPhase(data, eventName) {
        if (!data.eventsThisPhase) return 0;
        return data.eventsThisPhase.filter(e => e === eventName).length;
    }

    /**
     * Clear events from current phase (call at start of new week)
     * @param {Object} data - rebellion data
     */
    static async clearCurrentPhaseEvents(data) {
        await this.update({ eventsThisPhase: [] });
    }

    /**
     * Check if rivalry should become permanent
     * @param {Object} data - rebellion data
     * @returns {boolean}
     */
    static shouldRivalryBecomePermanent(data) {
        return this.getEventCountThisPhase(data, "Соперничество") >= 1;
    }
}