import { DataHandler } from "./data-handler.js";
import { REBELLION_PROGRESSION, OFFICER_ROLES, FOCUS_TYPES, CHECK_LABELS, ABILITY_LABELS, EVENT_TABLE, CACHE_LIMITS, PF2E_SKILL_LABELS, CATEGORY_LABELS } from "./config.js";
import { getTeamDefinition, TEAMS, UNIVERSAL_ACTIONS, SPECIFIC_ACTIONS, findTeamByActorName, ACTION_CHECKS, ACTION_DC, getUpgradeOptions, canUpgrade, getEarnIncomeDC, calculateEarnIncome, formatIncome, getTeamProficiency, getEarnIncomeModifier, getTeamProficiencyBonus, getHalfRankBonus } from "./teams.js";
import { findAllyByActorName, getAllyData, ALLY_DEFINITIONS, getAllAllies } from "./allies.js";
import { JournalLogger } from "./journal-logger.js";
import { AutoLogger } from "./auto-logger.js";

const MODULE_ID = "pf2e-ts-adv-pf1ehr";

// Глобальный флаг для отслеживания бонусного действия стратега
window.currentStrategistAction = false;

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

export class RebellionSheet extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "rebellion-sheet", title: "Лист Восстания", template: "modules/pf2e-ts-adv-pf1ehr/templates/rebellion-sheet.hbs",
            width: 850, height: 950, resizable: true,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "overview" }],
            classes: ["rebellion-sheet-window"], dragDrop: [{ dragSelector: null, dropSelector: ".window-content" }]
        });
    }

    /**
     * Helper function to update data with strategist bonus logic
     */
    async _updateDataWithStrategist(updateData, team) {
        const data = DataHandler.get();
        
        // Проверяем глобальный флаг бонусного действия стратега
        if (window.currentStrategistAction) {
            // Это бонусное действие стратега
            updateData.strategistUsed = true;
            
            // Снимаем цель стратега с команды
            if (updateData.teams) {
                const teamIdx = data.teams.findIndex(t => t.type === team.type);
                if (teamIdx >= 0) {
                    updateData.teams[teamIdx].isStrategistTarget = false;
                }
            }
            
            // НЕ увеличиваем actionsUsedThisWeek для бонусного действия
            if (!updateData.hasOwnProperty('actionsUsedThisWeek')) {
                updateData.actionsUsedThisWeek = data.actionsUsedThisWeek;
            }
            
            // Сбрасываем флаг
            window.currentStrategistAction = false;
        } else {
            // Обычное действие, увеличиваем счетчик
            if (!updateData.hasOwnProperty('actionsUsedThisWeek')) {
                updateData.actionsUsedThisWeek = data.actionsUsedThisWeek + 1;
            }
        }
        
        await DataHandler.update(updateData);
    }

    /**
     * Get player level for Earn Income task
     * If current user is a player - returns their character level
     * If current user is GM - returns first party member's level
     */
    _getPlayerLevel() {
        // Если игрок - берём уровень его персонажа
        if (!game.user.isGM && game.user.character) {
            return game.user.character.level || 1;
        }
        
        // Если ГМ или нет персонажа - берём уровень первого члена Party
        if (game.actors.party && game.actors.party.members && game.actors.party.members.length > 0) {
            return game.actors.party.members[0].level || 1;
        }
        
        // Fallback: ищем первого персонажа игрока
        const playerCharacter = game.actors.find(a => a.type === "character" && a.hasPlayerOwner);
        if (playerCharacter) {
            return playerCharacter.level || 1;
        }
        
        // Если ничего не нашли - возвращаем 1
        return 1;
    }

    /**
     * Smart update function that handles strategist bonus logic
     */
    async _smartUpdate(updateData) {
        const data = DataHandler.get();
        
        // Если это бонусное действие стратега, не увеличиваем actionsUsedThisWeek
        if (window.currentStrategistAction) {
            updateData.strategistUsed = true;
            
            // Снимаем цель стратега с всех команд
            if (updateData.teams) {
                updateData.teams.forEach(t => t.isStrategistTarget = false);
            }
            
            // НЕ увеличиваем actionsUsedThisWeek
            if (updateData.hasOwnProperty('actionsUsedThisWeek')) {
                updateData.actionsUsedThisWeek = data.actionsUsedThisWeek;
            }
            
            // Сбрасываем флаг
            window.currentStrategistAction = false;
        }
        
        await DataHandler.update(updateData);
    }

    async getData() {
        const data = DataHandler.get();
        
        // Apply rivalry effects to teams if rivalry is active
        await DataHandler.applyRivalryEffects(data);
        
        const bonuses = DataHandler.getRollBonuses(data);
        const rankInfo = REBELLION_PROGRESSION[data.rank];
        const minTreasury = DataHandler.getMinTreasury(data);
        const eventChance = DataHandler.getEventChance(data);
        const actionsRemaining = DataHandler.getActionsRemaining(data);

        // Use Party Members if available (PF2e specific) or fallback to Player Characters
        let partyMembers = [];
        if (game.actors.party && game.actors.party.members) {
            partyMembers = game.actors.party.members;
        } else {
            partyMembers = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
        }

        const candidateActors = partyMembers.map(a => ({ id: a.id, name: a.name }));
        data.allies.forEach(a => { const d = getAllyData(a.slug); if (d?.canBeOfficer && !a.missing && !a.captured) candidateActors.push({ id: a.slug, name: a.name }); });

        const officerList = await Promise.all(data.officers.map(async (off, index) => {
            const roleDef = OFFICER_ROLES[off.role];
            const actor = game.actors.get(off.actorId);
            const allyDef = getAllyData(off.actorId);
            let name = "Неизвестный", img = "icons/svg/mystery-man.svg", bonus = 0;
            let isInvalid = false;

            if (roleDef && actor) {
                // Check if actor is still in the candidate list (squad)
                if (!candidateActors.some(c => c.id === actor.id)) {
                    isInvalid = true;
                    // We still calculate bonus but mark as invalid/red?
                    // User said: "should be marked as inactive".
                    // Maybe we treat it as "missing"? But missing is a checkbox.
                    // Let's just flag it for UI display mostly.
                }

                name = actor.name; img = actor.img;
                const getMod = (a, attr) => a.system?.abilities?.[attr]?.mod ?? a.abilities?.[attr]?.mod ?? 0;

                if (off.role === 'recruiter') bonus = actor.level;
                else if (roleDef.abilities?.length) {
                    if (off.selectedAttribute) {
                        bonus = getMod(actor, off.selectedAttribute);
                    } else {
                        const mods = roleDef.abilities.map(attr => getMod(actor, attr));
                        bonus = Math.max(...mods);
                    }
                }
            } else if (allyDef) { 
                name = allyDef.name; 
                img = allyDef.img; 
                
                // If officer is an ally, sync their missing/captured state
                const allyData = data.allies.find(a => a.slug === off.actorId);
                if (allyData) {
                    off.missing = allyData.missing || false;
                    off.captured = allyData.captured || false;
                    
                    // If ally has bound actor, get modifiers from the actor sheet
                    if (allyData.actorId) {
                        const boundActor = game.actors.get(allyData.actorId);
                        if (boundActor) {
                            const getMod = (a, attr) => a.system?.abilities?.[attr]?.mod ?? a.abilities?.[attr]?.mod ?? 0;
                            
                            if (off.role === 'recruiter') {
                                bonus = boundActor.level || 1;
                            } else if (roleDef.abilities?.length) {
                                if (off.selectedAttribute) {
                                    bonus = getMod(boundActor, off.selectedAttribute);
                                } else {
                                    const mods = roleDef.abilities.map(attr => getMod(boundActor, attr));
                                    bonus = Math.max(...mods);
                                }
                            }
                        }
                    }
                }
            }
            else if (off.actorId) {
                // ID exists but actor not found?
                isInvalid = true;
            }

            // Convert selectedChecks array to object for template lookup helper
            const selectedChecksObj = {};
            if (off.selectedChecks && Array.isArray(off.selectedChecks)) {
                off.selectedChecks.forEach(check => {
                    selectedChecksObj[check] = true;
                });
            }

            return {
                ...off, index,
                label: roleDef?.label || "Неизвестная роль",
                desc: roleDef?.desc || "",
                actorName: name, actorImg: img, bonus,
                isInvalid, // Pass flag to template
                // Display which attributes are eligible (e.g. "Сила/Мудрость")
                attributeLabel: roleDef?.abilities?.map(a => ABILITY_LABELS[a]).join(" / ") || "",
                needsCheckSelector: !!roleDef?.hasCheckSelector,
                checkOptions: Object.entries(CHECK_LABELS).map(([k, v]) => ({ key: k, label: v })),
                selectedChecks: selectedChecksObj // Override array with object for template
            };
        }));

        const teamManagers = officerList.filter(o => o.actorName !== "Неизвестный").map(o => ({
            name: o.actorName,
            role: o.label,
            bonus: o.bonus,
            id: o.actorId // Store both name and ID for reference
        }));

        // Molly can be a team manager and grants Covert + Sabotage to her team
        if (DataHandler.isAllyActive(data, 'molly')) teamManagers.push({
            name: ALLY_DEFINITIONS.molly.name,
            role: "Союзник (Тайная операция, Саботаж)",
            bonus: 0,
            id: 'molly'
        });

        const hasVendalfek = DataHandler.isAllyActive(data, 'vendalfek');
        const hasManticce = DataHandler.isAllyActive(data, 'manticce');

        // Create Silver Ravens team (always first, but NOT counted as a team)
        // Silver Ravens is a virtual team for PC actions, not a real team
        // Get current action from stored data (if any)
        const srStoredAction = data.silverRavensAction || "";
        const srCheckType = ACTION_CHECKS[srStoredAction];
        
        // Calculate modifiers dynamically based on selected action
        let srMods = [];
        let srTotal = 0;
        let srActionDC = null;
        
        if (srCheckType) {
            const srBaseBonus = bonuses[srCheckType].total;
            srMods = bonuses[srCheckType].parts.map(p => `${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}`);
            srTotal = srBaseBonus;
            
            // Add Laria bonus for recruitSupporters
            if (srStoredAction === 'recruitSupporters' && DataHandler.isAllyActive(data, 'laria')) {
                srTotal += 2;
                srMods.push("Лариа: +2");
            }
            
            // Get DC for action
            srActionDC = ACTION_DC[srStoredAction];
            if (srActionDC === "rank") srActionDC = 10 + data.rank;
        }
        
        const silverRavensTeam = {
            type: "silverRavens",
            label: "Серебряные Вороны",
            manager: "",
            currentAction: srStoredAction,
            bonus: 0,
            disabled: false,
            missing: false,
            canAutoRecover: false,
            isStrategistTarget: false,
            idx: -1, // Special index for Silver Ravens
            icon: "modules/pf2e-ts-adv-pf1ehr/Ring_Raven.webp",
            desc: "Счётчик действий ПИ. Не является командой.",
            rank: 0,
            isOperational: true,
            isEffectivelyOperational: true,
            allActions: {
                recruitSupporters: data.recruitedThisPhase ? "Вербовать сторонников (использовано)" : "Вербовать сторонников",
                lieLow: "Залечь на дно",
                guarantee: "Гарантирование события",
                changeOfficer: "Смена роли офицера",
                special: "Специальное"
            },
            availableManagers: candidateActors,
            canUseManticce: false,
            isSilverRavens: true,
            modifiersStr: srMods.length ? `${srMods.join(" + ")} = <strong>${srTotal >= 0 ? '+' : ''}${srTotal}</strong>` : "Нет действия",
            totalModifier: srTotal,
            actionDC: srActionDC
        };

        const teams = [silverRavensTeam, ...(data.teams || []).map((t, idx) => {
            // Create a copy of the team to avoid modifying original data
            const team = { ...t };
            // Ensure team has a valid type - this should never happen but handle it gracefully
            if (!team.type || !TEAMS[team.type]) {
                team.type = 'streetPerformers'; // Fallback to a valid type
            }
            const def = getTeamDefinition(team.type);

            // Ensure team has all required properties
            if (!team.manager && team.manager !== "") team.manager = "";
            if (!team.currentAction) team.currentAction = "";
            if (!team.disabled) team.disabled = false;
            if (!team.missing) team.missing = false;
            if (!team.canAutoRecover) team.canAutoRecover = false;
            if (!team.isStrategistTarget) team.isStrategistTarget = false;

            const acts = { ...UNIVERSAL_ACTIONS };
            if (def.unique) delete acts.upgrade;
            def.caps.forEach(c => { if (SPECIFIC_ACTIONS[c]) acts[c] = SPECIFIC_ACTIONS[c]; });
            
            // Mark recruitSupporters as used if already done this phase
            if (acts['recruitSupporters'] && data.recruitedThisPhase) {
                acts['recruitSupporters'] = acts['recruitSupporters'] + " (использовано)";
            }

            // Molly: Team she manages gains Covert Operation and Sabotage
            const hasMollyManager = DataHandler.isAllyActive(data, 'molly') &&
                (team.manager === 'molly' || team.manager === 'Молли Мэйфилд' || team.manager?.toLowerCase()?.includes('molly'));
            if (hasMollyManager) {
                if (!acts['covert']) acts['covert'] = SPECIFIC_ACTIONS['covert'] + " (Молли)";
                if (!acts['sabotage']) acts['sabotage'] = SPECIFIC_ACTIONS['sabotage'] + " (Молли)";
            }

            // Vendalfek: Enables Disinformation without a team that normally has it
            if (hasVendalfek && !acts['disinformation']) acts['disinformation'] = SPECIFIC_ACTIONS['disinformation'] + " (Вендалфек)";

            const checkType = ACTION_CHECKS[team.currentAction];
            let baseBonus = checkType ? bonuses[checkType].total : 0;
            let mgrBonus = 0;
            if (team.manager) {
                // First try to find by name in officer list
                const m = teamManagers.find(x => x.name === team.manager);
                if (m) {
                    mgrBonus = m.bonus;
                } else {
                    // Then try to find by actor ID or name
                    const actor = game.actors.get(team.manager) || game.actors.getName(team.manager);
                    if (actor) {
                        mgrBonus = actor.system.abilities?.cha?.mod || 0;
                        // Don't modify the manager name here - it should be preserved as selected by user
                    }
                }
            }
            let total = baseBonus + mgrBonus + (team.isStrategistTarget ? 2 : 0);
            if (team.currentAction === 'recruitSupporters' && DataHandler.isAllyActive(data, 'laria')) total += 2;
            if (team.currentAction === 'rescue' && DataHandler.isAllyActive(data, 'octavio')) total += 4;
            // Vendalfek: +4 if any team in rebellion naturally has disinformation action
            if (team.currentAction === 'disinformation' && hasVendalfek) {
                const hasDisinfoTeam = data.teams.some(t => 
                    !t.disabled && !t.missing && 
                    ['rumormongers', 'agitators', 'cognoscenti'].includes(t.type)
                );
                if (hasDisinfoTeam) total += 4;
            }
            // Сбор информации: +удвоенный ранг команды
            const teamRank = def.rank || 1;
            if (team.currentAction === 'gatherInfo') total += teamRank * 2;

            let mods = [];
            if (checkType) mods.push(`База (${CHECK_LABELS[checkType]}): ${baseBonus}`);
            if (mgrBonus) mods.push(`Командир: ${mgrBonus}`);
            if (team.isStrategistTarget) mods.push(`Стратег: +2`);
            if (team.currentAction === 'recruitSupporters' && DataHandler.isAllyActive(data, 'laria')) mods.push("Лариа: +2");
            if (team.currentAction === 'rescue' && DataHandler.isAllyActive(data, 'octavio')) mods.push("Октавио: +4");
            // Vendalfek: +4 if any team in rebellion naturally has disinformation action
            if (team.currentAction === 'disinformation' && hasVendalfek) {
                const hasDisinfoTeam = data.teams.some(t => 
                    !t.disabled && !t.missing && 
                    ['rumormongers', 'agitators', 'cognoscenti'].includes(t.type)
                );
                if (hasDisinfoTeam) mods.push("Вендалфек: +4");
            }
            // Сбор информации: +удвоенный ранг команды
            if (team.currentAction === 'gatherInfo') mods.push(`Ранг команды ×2: +${teamRank * 2}`);
            // Заработок Денег: +½ ранга восстания (вверх) + мастерство команды
            if (team.currentAction === 'earnGold') {
                const halfRankBonus = getHalfRankBonus(data.rank);
                const profBonus = getTeamProficiencyBonus(teamRank);
                const profLabel = { 1: 'Обуч.', 2: 'Эксп.', 3: 'Мастер' }[teamRank] || 'Обуч.';
                mods.push(`½ ранга: +${halfRankBonus}`);
                mods.push(`Мастерство (${profLabel}): +${profBonus}`);
                total += halfRankBonus + profBonus;
            }

            // Get DC for current action
            let actionDC = ACTION_DC[t.currentAction];
            if (actionDC === "rank") actionDC = 10 + data.rank;
            else if (actionDC === "level") actionDC = "10 + уровень";
            else if (actionDC === "earnIncome") {
                // Use PF2e Earn Income DC based on rebellion rank
                const earnDC = getEarnIncomeDC(data.rank);
                const proficiency = getTeamProficiency(def.rank || 1);
                const profLabel = { trained: 'Обуч.', expert: 'Эксп.', master: 'Мастер' }[proficiency] || proficiency;
                actionDC = `${earnDC} (${profLabel})`;
            }
            else if (typeof actionDC === 'object' && t.currentAction === 'cache') {
                // For cache action, show DC range based on team's max cache size
                const maxSize = def?.cacheSize || 'small';
                if (maxSize === 'small') actionDC = "15";
                else if (maxSize === 'medium') actionDC = "15/20";
                else actionDC = "15/20/30";
            }

            return {
                ...team, idx, label: def.label, icon: def.icon, desc: def.desc,
                rank: def.rank || 1,
                category: def.category,
                isUnique: def.unique || false,
                canUpgrade: canUpgrade(team.type),
                upgradeCost: (() => {
                    const upgradeOptions = getUpgradeOptions(team.type);
                    if (!upgradeOptions.length) return 0;
                    const teamsSettings = data.teamsSettings || {};
                    return teamsSettings.teamUpgradeCosts?.[upgradeOptions[0].slug] || upgradeOptions[0].upgradeCost || 0;
                })(),
                upgradeOptions: getUpgradeOptions(team.type),
                allActions: acts, availableManagers: teamManagers, managerBonus: mgrBonus,
                modifiersStr: mods.length ? `${mods.join(" + ")} = <strong>${total >= 0 ? '+' : ''}${total}</strong>` : "Нет действия",
                totalModifier: total,
                actionDC: actionDC,
                canUseManticce: DataHandler.canUseManticceBonusAction(data, team),
                isOperational: DataHandler.isTeamOperational(team),
                blockedByRivalry: team.blockedByRivalry || false,
                isEffectivelyOperational: DataHandler.isTeamEffectivelyOperational(team)
            };
        })];
        
        // Разделяем команды на обычные и уникальные
        const regularTeams = teams.filter(t => !t.isUnique);
        const uniqueTeams = teams.filter(t => t.isUnique);

        // Process allies with full data from definitions
        const allies = (data.allies || []).map((a, idx) => {
            const def = getAllyData(a.slug);
            if (!def) return { ...a, idx, name: a.name || 'Неизвестный', img: 'icons/svg/mystery-man.svg', description: '', enabled: false };
            
            const hasMonthlyAction = def?.bonuses?.freeCacheMonthly || false;
            const monthlyStatus = hasMonthlyAction ? DataHandler.getMonthlyActionStatus(data, a.slug) : null;
            
            // Get actor info if bound
            let actorName = null;
            let finalImg = a.img || def.img;
            if (a.actorId) {
                const actor = game.actors.get(a.actorId);
                if (actor) {
                    actorName = actor.name;
                    // Use token image if available, otherwise use actor image, fallback to original
                    finalImg = actor.prototypeToken?.texture?.src || actor.img || finalImg;
                }
            }
            
            return {
                ...a,
                idx,
                name: def.name,
                img: finalImg,
                description: def.description || def.desc,
                canBeOfficer: def.canBeOfficer,
                hasState: def.hasState,
                hasChoice: def.hasChoice,
                adventure: def.adventure,
                enabled: a.enabled !== false, // Default to true if not set
                hasMonthlyAction: hasMonthlyAction,
                monthlyActionStatus: monthlyStatus,
                actorName: actorName
            };
        });

        // Count active and total allies
        const activeAllyCount = allies.filter(a => a.enabled && !a.missing && !a.captured).length;
        const totalAllyCount = allies.length;
        const enabledAllyCount = allies.filter(a => a.enabled).length;
        const hasVisibleAllies = game.user.isGM ? totalAllyCount > 0 : enabledAllyCount > 0;

        // Hireable teams (rank 1 only)
        const hireableTeams = Object.entries(TEAMS).filter(([slug, def]) => def.rank === 1 && def.hireDC).map(([slug, def]) => ({
            slug, label: def.label, hireDC: def.hireDC, hireCheck: def.hireCheck, category: def.category
        }));

        // Unique teams available for hiring (not already hired)
        const currentTeamTypes = data.teams.map(t => t.type);
        const availableUniqueTeams = Object.entries(TEAMS)
            .filter(([slug, def]) => def.unique && !currentTeamTypes.includes(slug))
            .map(([slug, def]) => ({
                slug, label: def.label, rank: def.rank, category: def.category, desc: def.desc
            }));
        const hasUniqueTeams = availableUniqueTeams.length > 0;

        // Progression table for gifts tab
        const progression = Object.entries(REBELLION_PROGRESSION).map(([rank, info]) => ({
            rank: Number(rank),
            minSupporters: info.minSupporters,
            focusBonus: info.focusBonus,
            secondaryBonus: info.secondaryBonus,
            actions: info.actions,
            maxTeams: info.maxTeams,
            gift: data.customGifts?.[rank] || info.gift, // Use custom gift if available
            isCustomGift: !!data.customGifts?.[rank], // Flag for custom gifts
            title: info.title,
            isCurrent: Number(rank) === data.rank,
            isAchieved: Number(rank) <= data.rank
        }));



        // Calculate effective danger for display
        const effectiveDanger = DataHandler.getEffectiveDanger(data);
        
        // Debug: проверяем передачу данных в шаблон
        const maintenanceCount = DataHandler.countMaintenanceEvents(data);
        console.log("getData: maintenanceEventCount =", maintenanceCount);
        
        return {
            data, isGM: game.user.isGM, bonuses, officerList, candidateActors, focusTypes: FOCUS_TYPES,
            minTreasury, maxActions: bonuses.maxActions, maxTeams: rankInfo.maxTeams,
            actionsRemaining, eventChance, teams, regularTeams, uniqueTeams, allies, mialariOptions: CHECK_LABELS,
            hireableTeams, availableUniqueTeams, hasUniqueTeams, rankInfo, treasuryLow: DataHandler.isTreasuryLow(data),
            canRecruit: DataHandler.canRecruit(data),
            operationalTeamCount: DataHandler.countOperationalTeams(data),
            gift: rankInfo.gift, title: rankInfo.title,
            progression,
            CHECK_LABELS, PF2E_SKILL_LABELS,
            activeAllyCount, totalAllyCount, hasVisibleAllies,
            // Player characters for special ally fields
            playerCharacters: partyMembers.map(a => ({ name: a.name, id: a.id })),
            // Effective danger with event modifiers
            effectiveDanger,
            // Maintenance start phase data
            disabledTeamCount: DataHandler.countDisabledTeams(data),
            missingTeamCount: DataHandler.countMissingTeams(data),
            missingAllyCount: DataHandler.countMissingAllies(data),
            maintenanceEventCount: DataHandler.countMaintenanceEvents(data),
            // Strategist status
            strategistUsed: data.strategistUsed || false,
            hasStrategist: data.officers.some(o => o.role === 'strategist' && o.actorId),
            // Manticce bonus action status
            manticceBonusUsedThisWeek: data.manticceBonusUsedThisWeek || false
        };
    }

    async _updateObject(event, formData) {
        const expanded = foundry.utils.expandObject(formData);

        const currentData = DataHandler.get();

        if (expanded.officers) {
            const newOfficers = JSON.parse(JSON.stringify(currentData.officers));
            for (const [k, v] of Object.entries(expanded.officers)) {
                const idx = parseInt(k);
                if (newOfficers[idx]) {
                    // Convert string boolean values to actual booleans
                    if (v.disabled === "true") v.disabled = true;
                    if (v.disabled === "false") v.disabled = false;
                    if (v.missing === "true") v.missing = true;
                    if (v.missing === "false") v.missing = false;
                    if (v.captured === "true") v.captured = true;
                    if (v.captured === "false") v.captured = false;
                    
                    if (v.actorId !== undefined) newOfficers[idx].actorId = v.actorId;
                    if (v.selectedAttribute !== undefined) newOfficers[idx].selectedAttribute = v.selectedAttribute;
                    if (v.disabled !== undefined) newOfficers[idx].disabled = v.disabled;
                    if (v.missing !== undefined) newOfficers[idx].missing = v.missing;
                    if (v.captured !== undefined) newOfficers[idx].captured = v.captured;
                }
            }
            expanded.officers = newOfficers;
        } else if (currentData.officers.length) {
            expanded.officers = currentData.officers;
        }

        // Handle teams updates properly, preserving existing teams if not in form data
        if (expanded.teams && typeof expanded.teams === 'object' && !Array.isArray(expanded.teams)) {
            // expanded.teams is object map from form
            const teamsObject = expanded.teams;
            expanded.teams = currentData.teams.map((t, i) => {
                const update = teamsObject[i.toString()];
                if (update) {
                    // Debug: log team updates
                    if (update.disabled !== undefined || update.missing !== undefined) {
                        console.log(`Team ${i} update:`, {
                            disabled: update.disabled,
                            missing: update.missing
                        });
                    }
                    
                    // Convert string boolean values to actual booleans
                    if (update.disabled === "true") update.disabled = true;
                    if (update.disabled === "false") update.disabled = false;
                    if (update.missing === "true") update.missing = true;
                    if (update.missing === "false") update.missing = false;
                    
                    // Debug: log after conversion
                    if (update.disabled !== undefined || update.missing !== undefined) {
                        console.log(`Team ${i} after conversion:`, {
                            disabled: update.disabled,
                            missing: update.missing
                        });
                    }
                    
                    if (t) {
                        // Existing team: preserve original type
                        const result = foundry.utils.mergeObject(t, update);
                        // Ensure type is preserved - only set if missing or invalid
                        if (!result.type || !TEAMS[result.type]) {
                            result.type = t.type;
                        }

                        // Don't convert manager actor ID to name - preserve the user's selection
                        // The manager field should contain exactly what the user selected
                        if (update.manager !== undefined) {
                            result.manager = update.manager;
                        } else if (t.manager) {
                            // Preserve existing manager if not in update
                            result.manager = t.manager;
                        }

                        // Ensure team type is always preserved
                        if (!result.type || !TEAMS[result.type]) {
                            result.type = t.type;
                        }

                        return result;
                    } else {
                        // New team: use update (from hiring)
                        return update;
                    }
                } else {
                    // No update for this team - preserve existing data
                    return t;
                }
            });
        } else if (!expanded.teams) {
            expanded.teams = currentData.teams;
        } else if (Array.isArray(expanded.teams)) {
            // Convert array to object map with indices as keys
            const teamsMap = {};
            expanded.teams.forEach((team, index) => {
                teamsMap[index.toString()] = team;
            });
            expanded.teams = teamsMap;
        }

        // Handle allies updates properly - merge updates with existing ally data
        if (expanded.allies && typeof expanded.allies === 'object' && !Array.isArray(expanded.allies)) {
            const alliesObject = expanded.allies;
            expanded.allies = currentData.allies.map((ally, i) => {
                const update = alliesObject[i.toString()];
                if (update) {
                    // Debug: log ally updates
                    if (update.missing !== undefined || update.captured !== undefined) {
                        console.log(`Ally ${i} update:`, {
                            missing: update.missing,
                            captured: update.captured
                        });
                    }
                    
                    // Convert string boolean values to actual booleans
                    if (update.missing === "true") update.missing = true;
                    if (update.missing === "false") update.missing = false;
                    if (update.captured === "true") update.captured = true;
                    if (update.captured === "false") update.captured = false;
                    if (update.revealed === "true") update.revealed = true;
                    if (update.revealed === "false") update.revealed = false;
                    
                    // Debug: log after conversion
                    if (update.missing !== undefined || update.captured !== undefined) {
                        console.log(`Ally ${i} after conversion:`, {
                            missing: update.missing,
                            captured: update.captured
                        });
                    }
                    
                    return foundry.utils.mergeObject({ ...ally }, update);
                }
                return ally;
            });
        } else if (!expanded.allies) {
            expanded.allies = currentData.allies;
        } else if (expanded.allies && Array.isArray(expanded.allies)) {
            expanded.allies = Object.assign({}, expanded.allies);
        }

        // Handle caches updates properly - merge updates with existing cache data
        if (expanded.caches && typeof expanded.caches === 'object' && !Array.isArray(expanded.caches)) {
            const cachesObject = expanded.caches;
            expanded.caches = currentData.caches.map((cache, i) => {
                const update = cachesObject[i.toString()];
                if (update) {
                    return foundry.utils.mergeObject({ ...cache }, update);
                }
                return cache;
            });
        } else if (!expanded.caches) {
            expanded.caches = currentData.caches;
        } else if (expanded.caches && Array.isArray(expanded.caches)) {
            expanded.caches = Object.assign({}, expanded.caches);
        }

        // Handle events updates properly - merge updates with existing event data
        if (expanded.events && typeof expanded.events === 'object' && !Array.isArray(expanded.events)) {
            const eventsObject = expanded.events;
            expanded.events = currentData.events.map((event, i) => {
                const update = eventsObject[i.toString()];
                if (update) {
                    // Только обновляем name и desc из формы, сохраняем остальные свойства события
                    return {
                        ...event,
                        name: update.name !== undefined ? update.name : event.name,
                        desc: update.desc !== undefined ? update.desc : event.desc
                    };
                }
                return event;
            });
        } else if (!expanded.events) {
            expanded.events = currentData.events;
        } else if (expanded.events && Array.isArray(expanded.events)) {
            expanded.events = Object.assign({}, expanded.events);
        }

        // Log focus change if it occurred
        if (expanded.focus && expanded.focus !== currentData.focus) {
            const focusChangeMessage = await AutoLogger.logFocusChange(currentData.focus, expanded.focus, FOCUS_TYPES);
            await this._logToJournal(focusChangeMessage);
            
            ChatMessage.create({ 
                content: focusChangeMessage, 
                speaker: ChatMessage.getSpeaker() 
            });
        }

        await DataHandler.update(expanded);
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.level-up-btn').click(() => this._onLevelUp());
        html.find('.reset-btn').click(() => this._onReset());
        html.find('.spinner-control a').click((ev) => this._onSpinnerClick(ev));

        // Save spinner input values on blur (when user finishes manual editing)
        html.find('.spinner-control input').on('blur change', (ev) => this._onSpinnerInputChange(ev));

        // New step-based phase handlers
        html.find('.step-btn[data-action="maintenance-attrition"]').click(() => this._onMaintenanceAttrition());
        html.find('.step-btn[data-action="maintenance-notoriety"]').click(() => this._onMaintenanceNotoriety());
        html.find('.step-btn[data-action="maintenance-treasury"]').click(() => this._onMaintenanceTreasury());
        html.find('.step-btn[data-action="maintenance-rankup"]').click(() => this._onMaintenanceRankup());
        html.find('.step-btn[data-action="treasury-deposit"]').click(() => this._onTreasuryDeposit());
        html.find('.step-btn[data-action="treasury-withdraw"]').click(() => this._onTreasuryWithdraw());
        html.find('.step-btn[data-action="go-to-teams"]').click(() => this._tabs[0].activate("teams"));
        html.find('.step-btn[data-action="event-check"]').click(() => this._onAutomatedEventPhase());

        // Maintenance start phase handlers
        html.find('.step-btn[data-action="maintenance-recover-disabled"]').click(() => this._onMaintenanceRecoverDisabled());
        html.find('.step-btn[data-action="maintenance-handle-missing"]').click(() => this._onMaintenanceHandleMissing());
        html.find('.step-btn[data-action="maintenance-handle-events"]').click(() => this._onMaintenanceHandleEvents());

        html.find('.add-officer-btn:not(.archive-btn):not(.test-event-btn)').click(() => this._onAddOfficerDialog());
        html.find('.remove-officer').click((ev) => this._onRemoveOfficer(ev));

        // Officer Auto-Save
        // Select triggers re-render to update bonus and attributes immediately.
        html.find('select[name="focus"]').change(() => this.submit({ preventClose: true, preventRender: false }));
        html.find('select[name^="officers."]').change((ev) => this.submit({ preventClose: true, preventRender: false }));
        html.find('input[name^="officers."]').change((ev) => this.submit({ preventClose: true, preventRender: true }));

        // Team Auto-Save - automatic recalculation after selection
        html.find('select[name^="teams."]').change((ev) => this.submit({ preventClose: true, preventRender: false }));
        
        // Silver Ravens action Auto-Save
        html.find('select[name="silverRavensAction"]').change((ev) => this.submit({ preventClose: true, preventRender: false }));
        // Team checkbox Auto-Save - save disabled/missing states immediately
        html.find('input[name^="teams."][type="checkbox"]').change((ev) => {
            console.log("Team checkbox changed:", ev.target.name, "=", ev.target.checked);
            
            // Create a custom form data object that includes false values
            const formData = new FormData(this.form);
            
            // Ensure unchecked checkboxes are included as false
            html.find('input[name^="teams."][type="checkbox"]').each((i, checkbox) => {
                if (!checkbox.checked) {
                    formData.set(checkbox.name, "false");
                }
            });
            
            // Convert FormData to object and submit
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            this._updateObject(ev, data);
        });

        // Ally Auto-Save - automatic recalculation after selection (for Mialari bonus)
        html.find('select[name^="allies."]').change((ev) => this.submit({ preventClose: true, preventRender: false }));
        
        // Ally checkbox Auto-Save - save missing/captured states immediately
        html.find('input[name^="allies."][type="checkbox"]').change((ev) => {
            console.log("Ally checkbox changed:", ev.target.name, "=", ev.target.checked);
            
            // Create a custom form data object that includes false values
            const formData = new FormData(this.form);
            
            // Ensure unchecked checkboxes are included as false
            html.find('input[name^="allies."][type="checkbox"]').each((i, checkbox) => {
                if (!checkbox.checked) {
                    formData.set(checkbox.name, "false");
                }
            });
            
            // Convert FormData to object and submit
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            this._updateObject(ev, data);
        });

        // Event Mitigation Button - use the same class as organization checks

        html.find('.pf2e-roll-button').click((ev) => this._onPlayerSkillRoll(ev));
        // Обработчик кнопок смягчения удален
        html.find('.roll-stukach-btn').click((ev) => this._onStukachRoll(ev));
        html.find('.roll-failed-protest-btn').click((ev) => this._onFailedProtestRoll(ev));
        html.find('.roll-catastrophic-mission-btn').click((ev) => this._onCatastrophicMissionRoll(ev));
        html.find('.roll-ally-danger-btn').click((ev) => this._onAllyDangerRoll(ev));
        html.find('.roll-traitor-btn').click((ev) => this._onTraitorRoll(ev));
        html.find('.roll-devil-weeks-btn').click((ev) => this._onDevilWeeksRoll(ev));
        html.find('.roll-devil-perception-btn').click((ev) => this._onDevilPerceptionRoll(ev));

        html.find('.delete-team').click((ev) => this._onDeleteTeam(ev));
        html.find('.delete-ally').click((ev) => this._onDeleteAlly(ev));
        html.find('.add-ally-btn').click(() => this._onAddAllyDialog());
        html.find('.ally-settings-btn').click(() => this._onAllySettingsDialog());
        html.find('.ally-enabled-check').change((ev) => this._onAllyEnabledChange(ev));
        html.find('input[name$=".revealed"]').change((ev) => this._onAllyRevealedChange(ev));

        // Cache handlers
        html.find('.add-cache-btn').click(() => this._onAddCacheDialog());
        html.find('.delete-cache').click((ev) => this._onDeleteCache(ev));
        html.find('.cache-active-check').change((ev) => this._onCacheActiveChange(ev));
        html.find('.hetamon-settings-btn').click(() => this._onHetamonSettingsDialog());
        html.find('.cache-limits-settings-btn').click(() => this._onCacheLimitsSettingsDialog());
        html.find('.maintenance-settings-btn').click(() => this._onMaintenanceSettingsDialog());
        html.find('.teams-settings-btn').click(() => this._onTeamsSettingsDialog());
        
        // Cache Auto-Save - automatic save after editing
        html.find('input[name^="caches."]').change((ev) => this.submit({ preventClose: true, preventRender: true }));
        html.find('select[name^="caches."]').change((ev) => this.submit({ preventClose: true, preventRender: false })); // Re-render for type/size changes
        
        html.find('.execute-monthly-action-btn').click((ev) => this._onExecuteMonthlyAction(ev));
        html.find('.roll-check').click((ev) => this._onRollCheckDialogSafe(ev));
        html.find('.sentinel-check').change((ev) => this._onSentinelCheck(ev));
        html.find('.strategist-check').change((ev) => this._onStrategistCheck(ev));
        html.find('.archive-btn').click(() => this._onArchiveWeek());
        html.find('.test-event-btn').click(() => this._onTestEvent());

        html.find('.hire-team-btn').click(() => this._onHireTeamDialog());
        html.find('.hire-unique-team-btn').click(() => this._onHireUniqueTeamDialog());
        html.find('.recover-team-btn').click((ev) => this._onRecoverTeam(ev));
        html.find('.find-team-btn').click((ev) => this._onFindMissingTeam(ev));
        html.find('.execute-action-btn').click((ev) => this._onExecuteAction(ev));
        html.find('.execute-manticce-bonus-btn').click((ev) => this._onExecuteManticceBonusAction(ev));
        html.find('.add-custom-effect-btn').click((ev) => this._onAddCustomEffect(ev));
        html.find('.delete-effect').click(async (ev) => {
            const i = ev.currentTarget.dataset.index; 
            const d = DataHandler.get(); 
            const event = d.events[i];
            
            // Отменяем эффекты события перед удалением
            if (event) {
                await this._revertEventEffects(event, d);
            }
            
            // Удаляем событие из списка
            d.events.splice(i, 1); 
            await DataHandler.update({ events: d.events });
        });

        // Edit gift button handler
        html.find('.edit-gift-btn').click((ev) => this._onEditGift(ev));

        // Team drag-and-drop reordering
        this._initTeamDragDrop(html);

        // Add global click handler for mitigation buttons in chat messages
        this._addChatMessageMitigationHandler();
    }

    // Initialize drag-and-drop for team reordering
    _initTeamDragDrop(html) {
        const teamCards = html.find('.team-card[draggable="true"]');
        
        teamCards.on('dragstart', (ev) => {
            const card = ev.currentTarget;
            const teamIdx = card.dataset.index;
            const teamList = $(card).closest('.teams-list');
            const teamType = teamList.data('team-type');
            
            ev.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
                teamIdx: teamIdx,
                teamType: teamType
            }));
            ev.originalEvent.dataTransfer.effectAllowed = 'move';
            
            $(card).addClass('dragging');
        });
        
        teamCards.on('dragend', (ev) => {
            $(ev.currentTarget).removeClass('dragging');
            html.find('.team-card').removeClass('drag-over drag-over-top drag-over-bottom');
        });
        
        teamCards.on('dragover', (ev) => {
            ev.preventDefault();
            ev.originalEvent.dataTransfer.dropEffect = 'move';
            
            const card = ev.currentTarget;
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            
            $(card).removeClass('drag-over-top drag-over-bottom');
            if (ev.originalEvent.clientY < midY) {
                $(card).addClass('drag-over-top');
            } else {
                $(card).addClass('drag-over-bottom');
            }
        });
        
        teamCards.on('dragleave', (ev) => {
            $(ev.currentTarget).removeClass('drag-over drag-over-top drag-over-bottom');
        });
        
        teamCards.on('drop', async (ev) => {
            ev.preventDefault();
            
            const dropTarget = ev.currentTarget;
            const dropList = $(dropTarget).closest('.teams-list');
            const dropTeamType = dropList.data('team-type');
            
            let dragData;
            try {
                dragData = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
            } catch (e) {
                return;
            }
            
            // Only allow dropping within the same team type (regular or unique)
            if (dragData.teamType !== dropTeamType) {
                ui.notifications.warn("Нельзя перемещать команды между разными секциями");
                return;
            }
            
            const dragIdx = parseInt(dragData.teamIdx);
            const dropIdx = parseInt(dropTarget.dataset.index);
            
            if (dragIdx === dropIdx) return;
            
            // Determine if dropping above or below
            const rect = dropTarget.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const dropAbove = ev.originalEvent.clientY < midY;
            
            await this._reorderTeam(dragIdx, dropIdx, dropAbove);
            
            html.find('.team-card').removeClass('drag-over drag-over-top drag-over-bottom dragging');
        });
    }

    // Reorder team in the data
    async _reorderTeam(fromIdx, toIdx, dropAbove) {
        const data = DataHandler.get();
        const teams = [...data.teams];
        
        // Find the actual array indices (team.idx is the data array index)
        const fromArrayIdx = teams.findIndex((t, i) => i === fromIdx);
        const toArrayIdx = teams.findIndex((t, i) => i === toIdx);
        
        if (fromArrayIdx === -1 || toArrayIdx === -1) return;
        
        // Remove the team from its original position
        const [movedTeam] = teams.splice(fromArrayIdx, 1);
        
        // Calculate new position
        let newIdx = toArrayIdx;
        if (fromArrayIdx < toArrayIdx) {
            // Moving down - adjust for removed element
            newIdx = dropAbove ? toArrayIdx - 1 : toArrayIdx;
        } else {
            // Moving up
            newIdx = dropAbove ? toArrayIdx : toArrayIdx + 1;
        }
        
        // Insert at new position
        teams.splice(newIdx, 0, movedTeam);
        
        await DataHandler.update({ teams });
    }

    // Add global click handler for mitigation buttons in chat messages
    _addChatMessageMitigationHandler() {
        // Remove existing handler if any
        $(document).off('click', '.roll-check[data-event]');
        $(document).off('click', '.pf2e-roll-button');
        // Обработчик кнопок смягчения удален
        $(document).off('click', '.roll-stukach-btn');
        $(document).off('click', '.roll-failed-protest-btn');
        $(document).off('click', '.roll-catastrophic-mission-btn');
        $(document).off('click', '.roll-traitor-btn');
        $(document).off('click', '.roll-devil-weeks-btn');
        $(document).off('click', '.roll-devil-perception-btn');

        $(document).off('click', '.traitor-execute-btn');
        $(document).off('click', '.traitor-exile-btn');
        $(document).off('click', '.traitor-imprison-btn');
        $(document).off('click', '.traitor-execute-loyalty-btn');
        $(document).off('click', '.traitor-exile-security-btn');
        $(document).off('click', '.traitor-prison-secrecy-btn');
        $(document).off('click', '.traitor-persuade-btn');
        $(document).off('click', '.traitor-persuade-attempt-btn');
        $(document).off('click', '.traitor-execute-from-prison-btn');
        $(document).off('click', '.traitor-exile-from-prison-btn');
        $(document).off('click', '.rebellion-reroll-btn');
        $(document).off('click', '.invasion-ignore-btn');
        $(document).off('click', '.rescue-result-btn');

        // Add new handlers for mitigation buttons in chat messages
        // Обработчики кнопок смягчения удалены
        $(document).on('click', '.roll-stukach-btn', (ev) => this._onStukachRoll(ev));
        $(document).on('click', '.roll-failed-protest-btn', (ev) => this._onFailedProtestRoll(ev));
        $(document).on('click', '.roll-catastrophic-mission-btn', (ev) => this._onCatastrophicMissionRoll(ev));
        $(document).on('click', '.roll-ally-danger-btn', (ev) => this._onAllyDangerRoll(ev));
        $(document).on('click', '.roll-traitor-btn', (ev) => this._onTraitorRoll(ev));

        $(document).on('click', '.traitor-execute-btn', (ev) => this._onTraitorExecute(ev));
        $(document).on('click', '.traitor-exile-btn', (ev) => this._onTraitorExile(ev));
        $(document).on('click', '.traitor-imprison-btn', (ev) => this._onTraitorImprison(ev));
        $(document).on('click', '.traitor-execute-loyalty-btn', (ev) => this._onTraitorExecuteLoyalty(ev));
        $(document).on('click', '.traitor-exile-security-btn', (ev) => this._onTraitorExileSecurity(ev));
        $(document).on('click', '.traitor-prison-secrecy-btn', (ev) => this._onTraitorPrisonSecrecy(ev));
        $(document).on('click', '.traitor-persuade-btn', (ev) => this._onTraitorPersuade(ev));
        $(document).on('click', '.traitor-persuade-attempt-btn', (ev) => this._onTraitorPersuadeAttempt(ev));
        $(document).on('click', '.traitor-execute-from-prison-btn', (ev) => this._onTraitorExecuteFromPrison(ev));
        $(document).on('click', '.traitor-exile-from-prison-btn', (ev) => this._onTraitorExileFromPrison(ev));
        $(document).on('click', '.collect-supporters-bonus-btn', (ev) => this._onCollectSupportersBonus(ev));
        $(document).on('click', '.invasion-ignore-btn', (ev) => this._onIgnoreInvasion(ev));
        $(document).on('click', '.manipulate-choose-event-btn', (ev) => this._onManipulateChooseEvent(ev));
        // Обработчик .rescue-result-btn удалён - rescue теперь обрабатывается через _processTeamActionResult

        // Add handler for reroll buttons (Chuko, Shensen, Strea)
        $(document).on('click', '.rebellion-reroll-btn', async (ev) => {
            const btn = ev.currentTarget;
            const type = btn.dataset.type;
            const bonus = parseInt(btn.dataset.bonus) || 0;

            const data = DataHandler.get();
            const rerollInfo = DataHandler.getRerollForCheck(data, type);

            if (!rerollInfo.available) {
                ui.notifications.warn("Переброс уже использован на этой неделе!");
                return;
            }

            // Mark reroll as used
            await DataHandler.useReroll(data, type);

            // Perform the reroll
            const roll = new Roll("1d20");
            await roll.evaluate();
            const total = roll.total + bonus;

            // Create beautiful reroll message
            const rerollMessage = `
                <div style="
                    border: 3px solid #4a90e2; 
                    padding: 15px; 
                    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); 
                    border-radius: 12px; 
                    margin: 10px 0; 
                    box-shadow: 0 4px 8px rgba(74, 144, 226, 0.3);
                ">
                    <h5 style="color: #1976d2; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                        Переброс: ${CHECK_LABELS[type]}
                    </h5>
                    
                    <div style="background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <strong style="color: #1976d2; font-size: 1.1em;">${rerollInfo.allyName}</strong>
                            <span style="color: #666;">предоставляет переброс!</span>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 8px; text-align: center; border: 2px dashed #4a90e2;">
                        <div style="font-size: 1.4em; color: #1976d2; font-weight: bold;">
                            1d20 (${roll.total}) + ${bonus} = <span style="font-size: 1.2em; color: #d32f2f;">${total}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 10px; font-size: 1.2em;">
                        Удача благоволит смелым!
                    </div>
                </div>
            `;

            ChatMessage.create({
                content: rerollMessage,
                speaker: ChatMessage.getSpeaker(),
                flags: {
                    pf2e: {
                        context: {
                            type: "skill-check",
                            skill: type
                        }
                    }
                }
            });

            // Log to journal with special formatting
            if (this._logToJournal) {
                await this._logToJournal(rerollMessage, { important: false, skipTimestamp: true });
            }

            // Disable the button
            $(btn).prop('disabled', true).css('opacity', '0.5').text('Переброс использован');
        });
    }

    // === HIRE TEAM ===
    async _onHireTeamDialog() {
        const data = DataHandler.get();
        const rankInfo = REBELLION_PROGRESSION[data.rank];

        // Count only non-unique teams for limit check
        const nonUniqueTeamCount = DataHandler.countOperationalTeams(data);
        if (nonUniqueTeamCount >= rankInfo.maxTeams) {
            ui.notifications.warn(`Достигнут лимит команд (${rankInfo.maxTeams})!`);
            return;
        }

        if (DataHandler.getActionsRemaining(data) <= 0) {
            ui.notifications.warn("Действия исчерпаны на этой неделе!");
            return;
        }

        // Get hireable teams
        const hireableTeams = Object.entries(TEAMS).filter(([slug, def]) => def.rank === 1 && def.hireDC).map(([slug, def]) => {
            // Calculate bonus for hiring this team
            const checkType = def.hireCheck;
            const bonuses = DataHandler.getRollBonuses(data);
            const bonus = bonuses[checkType].total;

            return { slug, label: def.label, hireDC: def.hireDC, hireCheck: def.hireCheck, category: def.category, bonus };
        });

        let content = `<form><p>Выберите команду для найма:</p><div class="form-group"><select id="team-select">`;
        hireableTeams.forEach(t => {
            content += `<option value="${t.slug}">${t.label} (${CHECK_LABELS[t.hireCheck]} КС ${t.hireDC}, бонус +${t.bonus})</option>`;
        });
        content += `</select></div></form>`;

        new Dialog({
            title: "Нанять команду",
            content,
            buttons: {
                hire: {
                    label: "Нанять",
                    callback: async (html) => {
                        try {
                            const slug = html.find('#team-select').val();
                            const def = TEAMS[slug];
                            if (!def) return;

                            const checkType = def.hireCheck;
                            const dc = def.hireDC;

                            // Use standard roll handler
                            await this._performHireTeamRoll(slug, checkType, dc);
                        } catch (err) { 
                            ui.notifications.error(`Ошибка при найме: ${err.message}`); 
                        }
                    }
                },
                cancel: { label: "Отмена" }
            }
        }).render(true);
    }

    // === PERFORM HIRE TEAM ROLL ===
    async _performHireTeamRoll(teamSlug, checkType, dc) {
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses[checkType];
        const teamDef = TEAMS[teamSlug];

        const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
        if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

        // Try to use PF2e System Roll if available
        if (game.pf2e && game.pf2e.Check) {
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({ 
                label: p.label, 
                modifier: p.value, 
                type: "untyped" 
            }));

            try {
                // Set up rebellion state for the roll result handling
                game.rebellionState = {
                    isHireTeamRoll: true,
                    teamSlug,
                    checkType,
                    dc,
                    teamDef,
                    timestamp: Date.now()
                };

                console.log("Rebellion: Состояние установлено для найма команды:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier(CHECK_LABELS[checkType], { modifiers }),
                    { 
                        actor: actor, 
                        type: 'check', 
                        createMessage: true, 
                        skipDialog: false,
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: checkType,
                            action: checkType,
                            isHireTeamRoll: true,
                            teamSlug: teamSlug
                        }
                    }
                );
                console.log("PF2e Check.roll выполнен для найма команды.");
                return;
            } catch (error) {
                console.warn("Rebellion: PF2e бросок не удался, используем fallback:", error);
                // Fall through to custom dialog
            } finally {
                // Clear state after timeout
                setTimeout(() => {
                    if (game.rebellionState?.isHireTeamRoll) {
                        game.rebellionState = null;
                    }
                }, 10000);
            }
        }

        // Fallback to custom dialog if PF2e not available
        let content = `<form>
            <div class="form-group">
                <label>Команда для найма:</label>
                <div style="font-weight: bold; color: #333;">${teamDef.label}</div>
            </div>
            <div class="form-group">
                <label>Проверка:</label>
                <div>${CHECK_LABELS[checkType]} против КС ${dc}</div>
            </div>
            <div class="form-group">
                <label>Базовый бонус:</label>
                <input type="number" value="${checkBonus.total}" disabled>
            </div>
            <div class="form-group">
                <label>Дополнительный модификатор:</label>
                <input type="number" name="modifier" value="0">
            </div>
            <p><small>Из чего состоит бонус:</small></p>
            <ul>
                ${checkBonus.parts.map(p => `<li>${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}</li>`).join('')}
            </ul>
        </form>`;

        new Dialog({
            title: `Найм команды: ${teamDef.label}`,
            content,
            buttons: {
                roll: {
                    label: "Бросок",
                    callback: async (html) => {
                        const mod = parseInt(html.find('[name="modifier"]').val()) || 0;
                        const totalBonus = checkBonus.total + mod;
                        const roll = new Roll("1d20");
                        await roll.evaluate();
                        const total = roll.total + totalBonus;
                        
                        // Handle the result using the same logic as PF2e callback
                        await this._handleHireTeamResult(total, roll.total, totalBonus, dc);
                    }
                },
                cancel: { 
                    label: "Отмена" 
                }
            }
        }).render(true);
    }

    // === SHOW HIRE TEAM FALLBACK DIALOG ===
    _showHireTeamFallbackDialog(teamSlug, checkType, dc) {
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses[checkType];
        const teamDef = TEAMS[teamSlug];

        let content = `<form>
            <div class="form-group">
                <label>Команда для найма:</label>
                <div style="font-weight: bold; color: #333;">${teamDef.label}</div>
            </div>
            <div class="form-group">
                <label>Проверка:</label>
                <div>${CHECK_LABELS[checkType]} против КС ${dc}</div>
            </div>
            <div class="form-group">
                <label>Базовый бонус:</label>
                <input type="number" value="${checkBonus.total}" disabled>
            </div>
            <div class="form-group">
                <label>Дополнительный модификатор:</label>
                <input type="number" name="modifier" value="0">
            </div>
            <p><small>Из чего состоит бонус:</small></p>
            <ul>
                ${checkBonus.parts.map(p => `<li>${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}</li>`).join('')}
            </ul>
        </form>`;

        new Dialog({
            title: `Найм команды: ${teamDef.label}`,
            content,
            buttons: {
                roll: {
                    label: "Бросок",
                    callback: async (html) => {
                        const mod = parseInt(html.find('[name="modifier"]').val()) || 0;
                        const totalBonus = checkBonus.total + mod;
                        const roll = new Roll("1d20");
                        await roll.evaluate();
                        const total = roll.total + totalBonus;
                        
                        // Handle the result using the same logic as PF2e callback
                        await this._handleHireTeamResult(total, roll.total, totalBonus, dc);
                    }
                },
                cancel: { 
                    label: "Отмена",
                    callback: () => {
                        // Clear state if dialog is cancelled
                        delete game.rebellionState;
                    }
                }
            }
        }).render(true);
    }

    // === HANDLE HIRE TEAM RESULT ===
    async _handleHireTeamResult(total, rollResult, bonus, dc) {
        const state = game.rebellionState;
        if (!state || state.type !== 'hireTeam') return;

        const { teamSlug, teamDef } = state;
        const data = DataHandler.get();
        
        const success = total >= dc;
        const critFail = rollResult === 1;

        // Create beautiful hire message
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
                    <strong style="color: #2e7d32;">Успех! Команда нанята</strong>
                    <div style="margin-top: 8px; color: #1b5e20;">
                        ${teamDef.label} присоединилась к восстанию!
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
            
            // Spend action and update data
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
            
            // Still spend action on critical failure
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
            
            // Still spend action on failure
            await DataHandler.update({ 
                actionsUsed: (data.actionsUsed || 0) + 1 
            });
        }

        hireMessage += `</div>`;

        // Send to chat and log
        ChatMessage.create({ 
            content: hireMessage, 
            speaker: ChatMessage.getSpeaker(),
            flags: {
                pf2e: {
                    context: {
                        type: "skill-check",
                        skill: state.checkType
                    }
                }
            }
        });
        await this._logToJournal(hireMessage);

        // Clear the state
        setTimeout(() => {
            delete game.rebellionState;
        }, 100);
    }

    // === RECOVER DISABLED TEAM ===
    async _onRecoverTeam(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const team = data.teams[idx];
        if (!team || !team.disabled) return;

        const maintenanceSettings = data.maintenanceSettings || { teamRestoreCost: 10 };
        const cost = maintenanceSettings.teamRestoreCost;

        if (data.treasury < cost) {
            ui.notifications.warn(`Недостаточно золота! Восстановление стоит ${cost} зм.`);
            return;
        }

        if (!await Dialog.confirm({ title: "Восстановить команду?", content: `Стоимость: ${cost} зм` })) return;

        const teams = JSON.parse(JSON.stringify(data.teams));
        teams[idx].disabled = false;
        await DataHandler.update({ teams, treasury: data.treasury - cost });
        ui.notifications.info("Команда восстановлена!");

        const teamDef = getTeamDefinition(team.type);
        let message = `
            <div style="
                border: 3px solid #2e7d32; 
                padding: 15px; 
                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
                border-radius: 12px; 
                margin: 10px 0; 
                box-shadow: 0 4px 8px rgba(46, 125, 50, 0.3);
            ">
                <h5 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 2em;">🩹</span>
                    Восстановление команды
                </h5>
                
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                    <img src="${teamDef.icon}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 3px solid #2e7d32;">
                    <div>
                        <strong style="font-size: 1.2em; color: #2e7d32;">${teamDef.label}</strong>
                        <div style="color: #666; font-size: 0.9em; margin-top: 2px;">
                            Ранг ${teamDef.rank} • ${getCategoryLabel(teamDef.category)}
                        </div>
                    </div>
                </div>
                
                <div style="background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="color: #2e7d32; font-weight: bold; font-size: 1.1em;">
                        Стоимость восстановления: ${cost} зм
                    </div>
                    <div style="margin-top: 8px; color: #1b5e20;">
                        Команда готова к действию!
                    </div>
                </div>
            </div>
        `;
        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    // === FIND MISSING TEAM ===
    async _onFindMissingTeam(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const team = data.teams[idx];
        if (!team || !team.missing) return;

        const bonuses = DataHandler.getRollBonuses(data);
        const roll = new Roll("1d20");
        await roll.evaluate();
        const total = roll.total + bonuses.security.total;
        const dc = 15;

        const teamDef = getTeamDefinition(team.type);
        const success = total >= dc;
        const critFail = roll.total === 1;
        
        let message = `
            <div style="
                border: 3px solid ${success ? '#2e7d32' : (critFail ? '#b71c1c' : '#d32f2f')}; 
                padding: 15px; 
                background: ${success ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : (critFail ? 'linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)' : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)')}; 
                border-radius: 12px; 
                margin: 10px 0; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            ">
                <h5 style="color: ${success ? '#2e7d32' : (critFail ? '#b71c1c' : '#d32f2f')}; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                    Поиск пропавшей команды
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
                
                <div style="background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                    <strong>Проверка Безопасности:</strong>
                    <span style="color: ${success ? '#2e7d32' : (critFail ? '#b71c1c' : '#d32f2f')}; font-weight: bold;">
                        1d20(${roll.total}) + ${bonuses.security.total} = ${total} против КС ${dc}
                    </span>
                </div>
        `;

        if (success) {
            message += `
                <div style="padding: 12px; background: rgba(46, 125, 50, 0.1); border-radius: 8px; border: 2px solid #2e7d32;">
                    <strong style="color: #2e7d32;">Успех!</strong>
                    <div style="margin-top: 8px; color: #1b5e20;">
                        Команда найдена! Будет доступна на следующей неделе.
                    </div>
                </div>
            `;
            const teams = JSON.parse(JSON.stringify(data.teams));
            teams[idx].missing = false;
            teams[idx].disabled = true; // Still can't act this week
            await DataHandler.update({ teams });
        } else if (critFail) {
            message += `
                <div style="padding: 12px; background: rgba(183, 28, 28, 0.1); border-radius: 8px; border: 2px solid #b71c1c;">
                    <strong style="color: #b71c1c;">Критический провал!</strong>
                    <div style="margin-top: 8px; color: #b71c1c;">
                        Команда потеряна навсегда!
                    </div>
                </div>
            `;
            const teams = JSON.parse(JSON.stringify(data.teams));
            teams.splice(idx, 1);
            await DataHandler.update({ teams });
        } else {
            message += `
                <div style="padding: 12px; background: rgba(211, 47, 47, 0.1); border-radius: 8px; border: 2px solid #d32f2f;">
                    <strong style="color: #d32f2f;">Провал</strong>
                    <div style="margin-top: 8px; color: #d32f2f;">
                        Команда всё ещё пропала
                    </div>
                </div>
            `;
        }
        
        message += `</div>`;

        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    // === EXECUTE ACTION WITH ROLL ===
    // Helper function to create beautiful team action messages
    _createTeamActionMessage(team, action, result, roll, total, dc, additionalInfo = "") {
        const def = getTeamDefinition(team.type);
        const actionLabel = SPECIFIC_ACTIONS[action] || UNIVERSAL_ACTIONS[action] || action;
        const checkType = ACTION_CHECKS[action];
        const checkLabel = checkType ? CHECK_LABELS[checkType] : "";

        // Determine result color and icon
        let resultColor = "black", resultIcon = "⚪", resultText = "Выполнено";
        let gradientColor = "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)";

        // Check if DC is unknown (roll exists but no DC provided)
        const isUnknownDC = roll && !dc;

        if (isUnknownDC) {
            resultColor = "#444";
            resultIcon = "";
            resultText = "";
            gradientColor = "linear-gradient(135deg, #e3e3e3 0%, #c0c0c0 100%)";
        } else if (result === null) {
            // For rescue action - neutral display without success/failure indication
            resultColor = "#666";
            resultIcon = "";
            resultText = "Результат";
            gradientColor = "linear-gradient(135deg, #f0f0f0 0%, #d0d0d0 100%)";
        } else if (result === "success") {
            resultColor = "#2e7d32";
            resultIcon = "";
            resultText = "Успех";
            gradientColor = "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)";
        } else if (result === "failure") {
            resultColor = "#d32f2f";
            resultIcon = "";
            resultText = "Провал";
            gradientColor = "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)";
        } else if (result === "critical") {
            resultColor = "#b71c1c";
            resultIcon = "";
            resultText = "Критический провал";
            gradientColor = "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)";
        }

        // Create beautiful HTML message with enhanced styling
        return `
            <div style="
                border: 2px solid ${resultColor}; 
                padding: 15px; 
                background: ${gradientColor}; 
                border-radius: 12px; 
                margin: 10px 0; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                position: relative;
            ">
                <div style="position: absolute; top: -10px; right: 15px; background: ${resultColor}; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.8em; font-weight: bold;">
                    ${resultIcon} ${resultText}
                </div>
                
                <h5 style="color: ${resultColor}; margin: 0 0 15px 0; font-size: 1.2em; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.5em;">${resultIcon}</span>
                    ${actionLabel}
                </h5>
                
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                    <img src="${def.icon}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 3px solid ${resultColor};">
                    <div>
                        <strong style="font-size: 1.2em; color: ${resultColor};">${def.label}</strong>
                        <div style="color: #666; font-size: 0.9em; margin-top: 2px;">
                            Ранг ${def.rank} • ${getCategoryLabel(def.category)}
                        </div>
                        ${team.manager ? `<div style="color: #888; font-size: 0.8em; margin-top: 2px;">Командир: ${getManagerDisplayName(team.manager)}</div>` : ''}
                    </div>
                </div>

                ${checkType && roll && roll.total !== undefined ? `
                <div style="background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${resultColor};">
                    <div style="text-align: center; margin-bottom: 8px;">
                        <strong style="color: ${resultColor};">Проверка ${checkLabel}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="color: ${resultColor}; font-weight: bold; font-size: 1.1em;">
                            1d20(${roll.total}) + ${total - roll.total} = ${total}
                            ${dc ? (action === 'rescue' ? ` vs КС ${dc} (10 + уровень)` : ` vs КС ${dc}`) : ''}
                        </span>
                    </div>
                </div>
                ` : ''}

                ${additionalInfo ? `
                <div style="padding: 12px; background: rgba(255,255,255,0.8); border-radius: 8px; margin-top: 12px; border: 1px solid ${resultColor};">
                    <strong style="color: ${resultColor};">Результат:</strong>
                    <div style="margin-top: 5px; color: #333;">${additionalInfo}</div>
                </div>
                ` : ''}
            </div>
        `;
    }

    // Вспомогательная функция для показа диалога броска PF2e
    async _showTeamActionRollDialog(team, selectedAction, checkType, dc, bonuses, teamIdx, ev) {
        const data = DataHandler.get();
        const def = getTeamDefinition(team.type);
        const checkBonus = bonuses[checkType] || { total: 0, parts: [] };
        
        // Для действия rescue сначала запрашиваем уровень персонажа
        if (selectedAction === 'rescue') {
            const level = await this._showRescueLevelDialog();
            if (level === null) {
                ui.notifications.info("Спасение персонажа отменено.");
                return;
            }
            dc = 10 + level; // КС = 10 + уровень персонажа
        }
        
        // Рассчитываем дополнительные модификаторы
        let additionalMods = [];
        let totalMod = checkBonus.total;
        
        // Бонус командира
        if (team.manager) {
            const mgr = game.actors.getName(team.manager) || game.actors.get(team.manager);
            if (mgr) {
                const mgrBonus = mgr.system?.abilities?.cha?.mod || 0;
                if (mgrBonus !== 0) {
                    additionalMods.push({ label: `Командир (${mgr.name})`, value: mgrBonus });
                    totalMod += mgrBonus;
                }
            }
        }
        
        // Ручной бонус команды
        if (team.bonus) {
            additionalMods.push({ label: "Ручной бонус", value: team.bonus });
            totalMod += team.bonus;
        }
        
        // Бонус стратега
        if (team.isStrategistTarget) {
            additionalMods.push({ label: "Стратег", value: 2 });
            totalMod += 2;
        }
        
        // Специфические бонусы действий
        if (selectedAction === 'recruitSupporters' && DataHandler.isAllyActive(data, 'laria')) {
            additionalMods.push({ label: "Лариа", value: 2 });
            totalMod += 2;
        }
        if (selectedAction === 'rescue' && DataHandler.isAllyActive(data, 'octavio')) {
            additionalMods.push({ label: "Октавио", value: 4 });
            totalMod += 4;
        }
        if (selectedAction === 'gatherInfo') {
            const teamRank = def?.rank || 1;
            additionalMods.push({ label: `Ранг команды ×2`, value: teamRank * 2 });
            totalMod += teamRank * 2;
        }
        // Earn Income: добавляем полранга восстания (вверх) + мастерство команды
        if (selectedAction === 'earnGold') {
            const teamRank = def?.rank || 1;
            const halfRankBonus = getHalfRankBonus(data.rank);
            const profBonus = getTeamProficiencyBonus(teamRank);
            const profLabel = { 1: 'Обуч.', 2: 'Эксп.', 3: 'Мастер' }[teamRank] || 'Обуч.';
            additionalMods.push({ label: `½ ранга (${data.rank})`, value: halfRankBonus });
            additionalMods.push({ label: `Мастерство (${profLabel})`, value: profBonus });
            totalMod += halfRankBonus + profBonus;
        }
        if (selectedAction === 'sabotage' && (team.type === 'bellflower' || team.type === 'lacunafex')) {
            additionalMods.push({ label: team.type === 'bellflower' ? "Сеть Колокольчиков" : "Лакунафекс", value: 2 });
            totalMod += 2;
        }
        if (selectedAction === 'covert' && team.type === 'lacunafex') {
            additionalMods.push({ label: "Лакунафекс", value: 2 });
            totalMod += 2;
        }
        if (selectedAction === 'disinformation' && DataHandler.isAllyActive(data, 'vendalfek')) {
            const hasDisinfoTeam = data.teams.some(t => 
                !t.disabled && !t.missing && 
                ['rumormongers', 'agitators', 'cognoscenti'].includes(t.type)
            );
            if (hasDisinfoTeam) {
                additionalMods.push({ label: "Вендалфек", value: 4 });
                totalMod += 4;
            }
        }
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска действия команды...");
            
            // Создаем модификаторы из базовых бонусов
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));
            
            // Добавляем дополнительные модификаторы
            additionalMods.forEach(m => {
                modifiers.push(new game.pf2e.Modifier({
                    label: m.label,
                    modifier: m.value,
                    type: "untyped"
                }));
            });

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            const checkLabel = CHECK_LABELS[checkType] || checkType;
            const actionLabel = UNIVERSAL_ACTIONS[selectedAction] || SPECIFIC_ACTIONS[selectedAction] || selectedAction;

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isTeamActionRoll: true,
                    teamIdx: teamIdx,
                    teamType: team.type,
                    selectedAction: selectedAction,
                    checkType: checkType,
                    dc: dc,
                    totalMod: totalMod,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска действия команды:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier(checkLabel, { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: dc ? { value: dc } : undefined,
                        title: `${def.label}: ${actionLabel}`,
                        notes: [`Действие команды ${def.label}`],
                        context: {
                            type: "skill-check",
                            skill: checkType,
                            action: checkType,
                            isTeamActionRoll: true,
                            teamIdx: teamIdx,
                            selectedAction: selectedAction
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для действия команды.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к автоброску
                game.rebellionState = null;
                return this._fallbackTeamActionRoll(team, selectedAction, checkType, dc, bonuses, teamIdx, additionalMods, totalMod);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            return this._fallbackTeamActionRoll(team, selectedAction, checkType, dc, bonuses, teamIdx, additionalMods, totalMod);
        }
    }

    // Fallback функция для автоброска действия команды без PF2e API
    async _fallbackTeamActionRoll(team, selectedAction, checkType, dc, bonuses, teamIdx, additionalMods, totalMod) {
        const data = DataHandler.get();
        const def = getTeamDefinition(team.type);
        const teams = JSON.parse(JSON.stringify(data.teams));
        teams[teamIdx].currentAction = selectedAction;
        teams[teamIdx].hasActed = true;
        
        // Для rescue нужно сначала запросить уровень
        if (selectedAction === 'rescue' && dc === "level") {
            const level = await this._showRescueLevelDialog();
            if (level === null) {
                ui.notifications.info("Спасение персонажа отменено.");
                return;
            }
            dc = 10 + level;
        }
        
        const roll = new Roll("1d20");
        await roll.evaluate();
        const total = roll.total + totalMod;
        
        // Обрабатываем результат напрямую
        await this._processTeamActionResult(team, selectedAction, checkType, dc, roll, total, teamIdx, teams, data, bonuses, def);
    }

    // Диалог для ввода уровня персонажа при спасении
    async _showRescueLevelDialog() {
        return new Promise((resolve) => {
            new Dialog({
                title: "Спасение персонажа",
                content: `
                    <form>
                        <div class="form-group">
                            <label>Уровень спасаемого персонажа:</label>
                            <input type="number" name="level" min="1" max="20" value="1" style="width: 60px;">
                        </div>
                        <p style="color: #666; font-size: 0.9em;">КС = 10 + уровень персонажа</p>
                        <p style="color: #666; font-size: 0.9em;">При успехе: Известность +уровень</p>
                        <p style="color: #666; font-size: 0.9em;">При провале: Известность +половина уровня</p>
                    </form>
                `,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-dice-d20"></i>',
                        label: "Бросить проверку",
                        callback: (html) => {
                            const lvl = parseInt(html.find('[name="level"]').val()) || 1;
                            resolve(Math.max(1, Math.min(20, lvl)));
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Отмена",
                        callback: () => resolve(null)
                    }
                },
                default: "ok"
            }).render(true);
        });
    }

    // Вспомогательная функция для показа диалога броска PF2e для Серебряных Воронов
    async _showSilverRavensRollDialog(silverRavensTeam, selectedAction, checkType, dc, bonuses, ev) {
        const data = DataHandler.get();
        const checkBonus = bonuses[checkType] || { total: 0, parts: [] };
        
        // Рассчитываем дополнительные модификаторы
        let additionalMods = [];
        let totalMod = checkBonus.total;
        
        // Специфические бонусы действий
        if (selectedAction === 'recruitSupporters' && DataHandler.isAllyActive(data, 'laria')) {
            additionalMods.push({ label: "Лариа", value: 2 });
            totalMod += 2;
        }
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска для Серебряных Воронов...");
            
            // Создаем модификаторы из базовых бонусов
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));
            
            // Добавляем дополнительные модификаторы
            additionalMods.forEach(m => {
                modifiers.push(new game.pf2e.Modifier({
                    label: m.label,
                    modifier: m.value,
                    type: "untyped"
                }));
            });

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            const checkLabel = CHECK_LABELS[checkType] || checkType;
            const actionLabel = UNIVERSAL_ACTIONS[selectedAction] || SPECIFIC_ACTIONS[selectedAction] || selectedAction;

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isSilverRavensActionRoll: true,
                    selectedAction: selectedAction,
                    checkType: checkType,
                    dc: dc,
                    totalMod: totalMod,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска Серебряных Воронов:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier(checkLabel, { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: dc ? { value: dc } : undefined,
                        title: `Серебряные Вороны: ${actionLabel}`,
                        notes: [`Действие Серебряных Воронов`],
                        context: {
                            type: "skill-check",
                            skill: checkType,
                            action: checkType,
                            isSilverRavensActionRoll: true,
                            selectedAction: selectedAction
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для Серебряных Воронов.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к автоброску
                game.rebellionState = null;
                return this._fallbackSilverRavensRoll(silverRavensTeam, selectedAction, checkType, dc, bonuses, totalMod);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок для Серебряных Воронов.");
            return this._fallbackSilverRavensRoll(silverRavensTeam, selectedAction, checkType, dc, bonuses, totalMod);
        }
    }

    // Fallback функция для автоброска Серебряных Воронов без PF2e API
    async _fallbackSilverRavensRoll(silverRavensTeam, selectedAction, checkType, dc, bonuses, totalMod) {
        const data = DataHandler.get();
        
        const roll = new Roll("1d20");
        await roll.evaluate();
        const total = roll.total + totalMod;
        
        // Обрабатываем результат напрямую
        await this._processSilverRavensActionResult(silverRavensTeam, selectedAction, checkType, dc, roll, total, data, bonuses);
    }

    // Функция обработки результата броска Серебряных Воронов
    async _processSilverRavensActionResult(silverRavensTeam, selectedAction, checkType, dc, roll, total, data, bonuses) {
        // Handle specific actions
        if (selectedAction === 'recruitSupporters' && dc) {
            const success = total >= dc;
            if (success) {
                const recruitRoll = new Roll("2d6");
                await recruitRoll.evaluate();
                let supportersGained = recruitRoll.total + (bonuses.recruitmentBonus || 0);
                
                let recruitmentDetails = `2d6: ${recruitRoll.total}`;
                if (bonuses.recruitmentBonus > 0) {
                    recruitmentDetails += ` + бонус Вербовщиков: ${bonuses.recruitmentBonus}`;
                }
                
                // Check for Secrecy Week event doubling
                const secrecyWeekEvent = data.events?.find(e => e.name === "Неделя Секретности");
                if (secrecyWeekEvent) {
                    supportersGained *= 2;
                    recruitmentDetails += ` × 2 (Неделя Секретности)`;
                }
                
                const newSupporters = Math.min(data.supporters + supportersGained, data.population);
                const actualGained = newSupporters - data.supporters;
                
                const message = this._createTeamActionMessage(
                    silverRavensTeam, selectedAction, "success", roll, total, dc, 
                    `Завербовано ${actualGained} сторонников (${recruitmentDetails})`
                );
                
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ 
                    supporters: newSupporters, 
                    actionsUsedThisWeek: data.actionsUsedThisWeek + 1,
                    recruitedThisPhase: true
                });
            } else {
                // Check for natural 1 - not auto-fail but +1d6 Notoriety
                let additionalInfo = "Не удалось завербовать сторонников";
                let notorietyIncrease = 0;
                const rollResult = roll.total || roll.result || 0;
                
                if (rollResult === 1) {
                    const notRoll = new Roll("1d6");
                    await notRoll.evaluate();
                    notorietyIncrease = notRoll.total;
                    additionalInfo = `Не удалось завербовать. Естественная 1: +${notorietyIncrease} Известность`;
                }
                
                const message = this._createTeamActionMessage(
                    silverRavensTeam, selectedAction, "failure", roll, total, dc, additionalInfo
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ 
                    actionsUsedThisWeek: data.actionsUsedThisWeek + 1,
                    recruitedThisPhase: true,
                    notoriety: data.notoriety + notorietyIncrease
                });
            }
        } else {
            // Generic success/fail for other actions
            const success = total >= dc;
            const result = success ? "success" : "failure";
            const actionInfo = success ? "Действие выполнено успешно" : "Действие провалено";
            
            const message = this._createTeamActionMessage(
                silverRavensTeam, selectedAction, result, roll, total, dc, actionInfo
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            await DataHandler.update({ actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
        }
        
        // Обновляем интерфейс
        this.render();
    }

    async _onExecuteAction(ev) {
        ev.preventDefault();
        const idx = ev.currentTarget.dataset.index;
        const data = DataHandler.get();
        
        // Получаем настройки действий команд
        const teamsSettings = data.teamsSettings || {
            actions: {
                blackMarketActivation: 8,
                goldEarningModifier: 1.0,
                marketUpdate: 15,
                urbanInfluence: 15
            }
        };
        
        // Handle Silver Ravens team (core team)
        if (idx === 'core' || idx === '-1' || idx === -1) {
            return this._onExecuteSilverRavensAction(ev);
        }
        
        const teamIdx = Number(idx);
        const team = data.teams[teamIdx];
        if (!team) {
            ui.notifications.warn("Команда не найдена!");
            return;
        }

        // Read action from DOM in case form wasn't saved yet
        const $form = $(ev.currentTarget).closest('form');
        const actionSelect = $form.find(`select[name="teams.${idx}.currentAction"]`);
        const selectedAction = actionSelect.val() || team.currentAction;

        if (!selectedAction || selectedAction === '') {
            ui.notifications.warn("Выберите действие для команды!");
            return;
        }

        // Redirect special actions to their handlers
        if (selectedAction === 'upgrade') {
            this._onUpgradeTeam(ev);
            return;
        }
        if (selectedAction === 'recruitTeam') {
            this._onHireTeamDialog();
            return;
        }

        // Проверяем лимит действий, но не для бонусного действия стратега
        const isStrategistBonus = team.isStrategistTarget && !data.strategistUsed;
        if (!isStrategistBonus && DataHandler.getActionsRemaining(data) <= 0) {
            ui.notifications.warn("Действия исчерпаны на этой неделе!");
            return;
        }

        // Устанавливаем глобальный флаг для отслеживания бонусного действия стратега
        if (isStrategistBonus) {
            window.currentStrategistAction = true;
            ui.notifications.info("Использовано бонусное действие стратега!");
        } else {
            window.currentStrategistAction = false;
        }

        // Update team.currentAction with selected value for further processing
        // We need to persist this change!
        const teams = JSON.parse(JSON.stringify(data.teams));
        teams[teamIdx].currentAction = selectedAction;
        teams[teamIdx].hasActed = true;
        team.currentAction = selectedAction; // Update local ref for calculation

        // Get bonuses with action context for ally-specific bonuses
        const bonuses = DataHandler.getRollBonuses(data, selectedAction);
        const checkType = ACTION_CHECKS[team.currentAction];
        let dc = ACTION_DC[team.currentAction];
        const def = getTeamDefinition(team.type);

        if (!checkType) {
            // Actions without check - handle specific actions
            
            // Залечь на дно (lieLow) - забирает ВСЕ действия, снижает Известность на кол-во команд
            if (selectedAction === 'lieLow') {
                // Проверяем, что это первое действие на неделе
                if (data.actionsUsedThisWeek > 0) {
                    ui.notifications.warn("Залечь на дно можно только если вы не предпринимали никаких действий на этой неделе!");
                    return;
                }
                
                // Считаем количество команд восстания (операционных)
                const teamCount = DataHandler.countOperationalTeams(data);
                const notorietyReduction = teamCount;
                
                // Уменьшаем Известность
                const newNotoriety = Math.max(0, data.notoriety - notorietyReduction);
                const actualReduction = data.notoriety - newNotoriety;
                
                // Используем ВСЕ действия
                const maxActions = bonuses.maxActions + DataHandler.getManticceBonusActionCount(data);
                
                let actionInfo = `<strong>Залечь на дно!</strong><br>`;
                actionInfo += `Восстание прекращает всю активность на эту неделю.<br>`;
                actionInfo += `Известность снижена на ${actualReduction} (было ${data.notoriety}, стало ${newNotoriety}).<br>`;
                actionInfo += `Использовано действий: ${maxActions}`;
                
                // Проверяем постоянную Инквизицию
                const inquisitionEvent = data.events?.find(e => e.name === "Инквизиция" && e.isPersistent);
                if (inquisitionEvent) {
                    // Требуется проверка Секретности КС 20
                    const secrecyRoll = new Roll("1d20");
                    await secrecyRoll.evaluate();
                    const secrecyTotal = secrecyRoll.total + bonuses.secrecy.total;
                    
                    if (secrecyTotal >= 20) {
                        const filteredEvents = data.events.filter(e => e.name !== "Инквизиция");
                        await DataHandler.update({ events: filteredEvents });
                        actionInfo += `<br><strong style='color:green'>Постоянная Инквизиция завершена!</strong> (Секретность: ${secrecyTotal} vs КС 20)`;
                    } else {
                        actionInfo += `<br><span style='color:#d84315'>Инквизиция продолжается.</span> (Секретность: ${secrecyTotal} vs КС 20)`;
                    }
                }
                
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null, actionInfo
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ 
                    teams, 
                    notoriety: newNotoriety,
                    actionsUsedThisWeek: maxActions 
                });
                return;
            }
            
            // Гарантирование события (guarantee) - гарантирует событие на следующей неделе
            if (selectedAction === 'guarantee') {
                const currentEvents = JSON.parse(JSON.stringify(data.events || []));
                currentEvents.push({
                    name: "Гарантированное событие",
                    desc: "На следующей неделе гарантированно произойдет событие.",
                    weekStarted: data.week + 1,
                    duration: 1,
                    isPersistent: false,
                    isActionEffect: true,
                    guaranteeEvent: true
                });
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    `Событие гарантировано! На следующей неделе обязательно произойдет событие.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, events: currentEvents, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                return;
            }
            
            // Смена роли офицера (changeOfficer) - просто информационное сообщение
            if (selectedAction === 'changeOfficer') {
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    `Смена роли офицера подготовлена. Измените назначение офицера во вкладке "Офицеры".`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                return;
            }
            
            // Специальное действие (special) - ГМ определяет результат
            if (selectedAction === 'special') {
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    `Специальное действие выполнено. ГМ определяет результат.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                return;
            }
            
            // Манипулирование событиями (manipulate) - Каббалисты
            if (selectedAction === 'manipulate') {
                const currentEvents = JSON.parse(JSON.stringify(data.events || []));
                
                // Находим командира команды каббалистов для бонуса Харизмы
                let charismaBonus = 0;
                let managerName = team.manager || "";
                if (managerName) {
                    // Ищем актора по имени или ID
                    const actor = game.actors.get(managerName) || game.actors.getName(managerName);
                    if (actor) {
                        charismaBonus = actor.system?.abilities?.cha?.mod || 0;
                        managerName = actor.name;
                    }
                }
                
                currentEvents.push({
                    name: "Манипулирование событиями",
                    desc: `Каббалисты манипулируют событиями. ГМ бросает дважды, командир выбирает результат.${charismaBonus > 0 ? ` Бонус Харизмы командира: +${charismaBonus}` : ''}`,
                    weekStarted: data.week + 1,
                    duration: 1,
                    isPersistent: false,
                    isActionEffect: true,
                    allowEventChoice: true,
                    charismaBonus: charismaBonus,
                    managerName: managerName
                });
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    `Манипулирование подготовлено! На следующей неделе ГМ бросит дважды по таблице событий, и командир${managerName ? ` (${managerName})` : ''} выберет результат.${charismaBonus > 0 ? ` При вредном событии можно добавить +${charismaBonus} (Харизма) к броскам d20.` : ''}`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, events: currentEvents, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                return;
            }
            
            // Обновление рынка (refreshMarket) - стоимость из настроек
            if (selectedAction === 'refreshMarket') {
                const refreshCost = teamsSettings.actions.marketUpdate;
                
                if (data.treasury < refreshCost) {
                    ui.notifications.warn(`Недостаточно золота! Обновление рынка стоит ${refreshCost} зм, а в казне ${data.treasury} зм.`);
                    return;
                }
                
                // Проверяем ранг команды для бонуса переброса
                const teamRank = def?.rank || 1;
                const canReroll = teamRank >= 3;
                
                let resultText = `Рынок обновлен! Потрачено ${refreshCost} зм на взятки и расходы.<br>`;
                resultText += `ГМ случайным образом определяет новые магические предметы (малые, средние, крупные).`;
                
                if (canReroll) {
                    resultText += `<br><br><strong>Бонус команды ${teamRank}-го ранга:</strong> Можно попросить ГМ перебросить один результат в каждой категории (малый, средний, крупный).`;
                }
                
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    resultText
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ 
                    teams, 
                    treasury: data.treasury - refreshCost,
                    actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                });
                return;
            }
            
            // Восстановление персонажа (restore) - снимает негативные состояния
            if (selectedAction === 'restore') {
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    `Заклинатели могут бесплатно исцелить персонажей или использовать на них одно заклинание 3 уровня.<br><br>Более сильные эффекты заклинаний предоставляются посредством использования свитков и требуют расхода золота, равного стоимости соответствующего свитка.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                return;
            }
            
            // Специальный заказ (specialOrder) - заказ дорогого предмета через контакты торговых лордов
            if (selectedAction === 'specialOrder') {
                const deliveryRoll = new Roll("2d6");
                await deliveryRoll.evaluate();
                const deliveryDays = deliveryRoll.total;
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    `<b>Специальный заказ размещен!</b><br>` +
                    `• Скидка <b>5%</b> на стоимость предмета (благодаря опыту торговых лордов в торге)<br>` +
                    `• Время доставки: <b>${deliveryDays} дней</b> (2d6 = ${deliveryRoll.result})<br>` +
                    `• За дополнительные <b>60 зм</b> доставка телепортацией за 1 день<br>` +
                    `• ГМ определяет, доступен ли предмет для заказа`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                return;
            }
            
            // Городское влияние (urbanInfluence) - манипулирование модификаторами Кинтарго
            if (selectedAction === 'urbanInfluence') {
                const cost = teamsSettings.actions.urbanInfluence;
                if (data.treasury < cost) {
                    ui.notifications.warn(`Недостаточно золота! Требуется ${cost} зм, в казне ${data.treasury} зм.`);
                    return;
                }
                
                const modifiers = ["Коррупция", "Преступность", "Экономика", "Закон", "Знание", "Общество"];
                const dialogContent = `
                    <form>
                        <p>Стоимость: <strong>${cost} зм</strong></p>
                        <div class="form-group">
                            <label>Модификатор поселения:</label>
                            <select name="modifier">
                                ${modifiers.map(m => `<option value="${m}">${m}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Направление изменения:</label>
                            <select name="direction">
                                <option value="+2">+2</option>
                                <option value="-2">-2</option>
                            </select>
                        </div>
                    </form>
                `;
                
                new Dialog({
                    title: "Городское влияние",
                    content: dialogContent,
                    buttons: {
                        confirm: {
                            icon: '<i class="fas fa-check"></i>',
                            label: "Подтвердить",
                            callback: async (html) => {
                                const modifier = html.find('[name="modifier"]').val();
                                const direction = html.find('[name="direction"]').val();
                                
                                const currentEvents = JSON.parse(JSON.stringify(data.events || []));
                                currentEvents.push({
                                    name: "Городское влияние",
                                    desc: `Модификатор поселения "${modifier}" изменён на ${direction} на 1 неделю.`,
                                    weekStarted: data.week + 1,
                                    duration: 1,
                                    isPersistent: false,
                                    isActionEffect: true,
                                    isTextOnly: true
                                });
                                
                                const message = this._createTeamActionMessage(
                                    team, selectedAction, "success", null, null, null,
                                    `Городское влияние! Модификатор "${modifier}" изменён на ${direction} на следующую неделю. Потрачено ${cost} зм.`
                                );
                                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                                await this._logToJournal(message);
                                await DataHandler.update({ 
                                    teams, 
                                    events: currentEvents, 
                                    treasury: data.treasury - cost,
                                    actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                                });
                            }
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "Отмена"
                        }
                    },
                    default: "confirm"
                }).render(true);
                return;
            }
            
            // Активация убежища (safehouse) - запрашиваем местоположение и создаем событие на следующую неделю
            if (selectedAction === 'safehouse') {
                const location = await Dialog.prompt({
                    title: "Активация убежища",
                    content: `
                        <form>
                            <div class="form-group">
                                <label>Где находится убежище?</label>
                                <div class="form-fields">
                                    <input type="text" placeholder="Например: лавка торговца, заброшенный дом, подвал таверны..." style="width: 100%;" />
                                </div>
                            </div>
                        </form>
                    `,
                    callback: html => html.find('input').val(),
                    close: () => null,
                    rejectClose: false
                });
                
                if (location !== null && location.trim() !== "") {
                    const currentEvents = JSON.parse(JSON.stringify(data.events || []));
                    const safehouseName = `Убежище: ${location.trim()}`;
                    currentEvents.push({
                        name: safehouseName,
                        desc: `Убежище активировано в локации: ${location.trim()}. +1 к Безопасности. Команда может укрыться здесь при необходимости.`,
                        weekStarted: data.week + 1,
                        duration: 1,
                        isPersistent: false,
                        isActionEffect: true,
                        securityBonus: 1
                    });
                    const message = this._createTeamActionMessage(
                        team, selectedAction, "success", null, null, null,
                        `Убежище активировано в локации: ${location.trim()}! +1 к Безопасности на следующую неделю. Команда может укрыться здесь.`
                    );
                    ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                    await this._logToJournal(message);
                    await DataHandler.update({ teams, events: currentEvents, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                } else {
                    ui.notifications.warn("Активация убежища отменена - не указано местоположение.");
                }
                return;
            }
            
            // Общий случай для других действий без проверки
            await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });

            // Create beautiful message for actions without checks
            const message = this._createTeamActionMessage(
                team, selectedAction, "success", null, 0, 0,
                "Действие выполнено успешно"
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            return;
        }

        if (dc === "rank") dc = 10 + data.rank;
        if (dc === "earnIncome") dc = getEarnIncomeDC(data.rank);

        // Handle cache action - need to select cache size first
        if (selectedAction === 'cache' && typeof dc === 'object') {
            const maxCacheSize = def?.cacheSize || 'small';
            const cacheSizeOptions = this._getCacheSizeOptions(maxCacheSize);
            
            // Show cache size selection dialog
            const selectedSize = await this._showCacheSizeDialog(cacheSizeOptions);
            if (!selectedSize) {
                ui.notifications.info("Создание тайника отменено.");
                return;
            }
            
            dc = ACTION_DC.cache[selectedSize];
            team.selectedCacheSize = selectedSize;
            teams[teamIdx].selectedCacheSize = selectedSize;
        }

        // Проверки для действия "Вербовать сторонников" ПЕРЕД роллом
        if (selectedAction === 'recruitSupporters') {
            // Check once per phase limit
            if (data.recruitedThisPhase) {
                ui.notifications.warn("Вербовать сторонников можно только один раз за фазу Деятельности!");
                return;
            }
            
            // Check max rank limit
            if (data.rank >= data.maxRank) {
                ui.notifications.warn("Нельзя вербовать сторонников на максимальном ранге восстания!");
                return;
            }
        }
        
        // Проверки для действия "Активация черного рынка" ПЕРЕД роллом
        if (selectedAction === 'blackMarket') {
            const blackMarketCost = teamsSettings.actions.blackMarketActivation;
            if (data.treasury < blackMarketCost) {
                ui.notifications.warn(`Недостаточно золота! Активация черного рынка стоит ${blackMarketCost} зм, а в казне ${data.treasury} зм.`);
                return;
            }
        }

        // Используем диалог броска PF2e вместо автоброска
        return this._showTeamActionRollDialog(team, selectedAction, checkType, dc, bonuses, teamIdx, ev);
    }

    // Функция обработки результата броска действия команды
    async _processTeamActionResult(team, selectedAction, checkType, dc, roll, total, teamIdx, teams, data, bonuses, def) {
        // Получаем настройки действий команд
        const teamsSettings = data.teamsSettings || {
            actions: {
                blackMarketActivation: 8,
                goldEarningModifier: 1.0,
                marketUpdate: 15,
                urbanInfluence: 15
            }
        };
        
        // Process specific actions - используем selectedAction вместо team.currentAction
        if (selectedAction === 'earnGold') {
            // Use PF2e Earn Income table
            const teamRank = def.rank || 1;
            // Уровень задачи = уровень игрока (если игрок) или первого члена Party (если ГМ)
            const playerLevel = this._getPlayerLevel();
            const earnIncomeResult = calculateEarnIncome(playerLevel, teamRank, total, dc);
            const incomeInCopper = earnIncomeResult.income;
            // Правильная конвертация: медные монеты в золотые с учетом серебряных
            // 1 зм = 100 мм, 1 см = 10 мм
            const incomeInGold = incomeInCopper / 100; // Convert to gold for treasury (with decimal precision)
            const formattedIncome = formatIncome(incomeInCopper);
            
            // Apply gold earning modifier from settings
            const finalGold = incomeInGold * teamsSettings.actions.goldEarningModifier;
            const modifierText = teamsSettings.actions.goldEarningModifier !== 1.0 ? 
                ` (× ${teamsSettings.actions.goldEarningModifier} = ${finalGold.toFixed(2)} зм)` : '';
            
            // Determine result type for message
            let resultType = earnIncomeResult.result;
            const profLabel = { trained: 'Обученный', expert: 'Эксперт', master: 'Мастер' }[earnIncomeResult.proficiency] || earnIncomeResult.proficiency;
            
            let additionalInfo = `<strong>Заработок Денег (7 дней)</strong><br>`;
            additionalInfo += `Уровень: ${playerLevel}, Мастерство: ${profLabel}<br>`;
            additionalInfo += `Заработано: <strong>${formattedIncome}</strong>${modifierText}`;
            
            if (resultType === 'criticalSuccess') {
                additionalInfo += `<br><em>Критический успех! Доход как за уровень ${Math.min(20, playerLevel + 1)}</em>`;
            } else if (resultType === 'criticalFailure') {
                additionalInfo += `<br><em>Критический провал! Доход потерян</em>`;
            }
            
            const message = this._createTeamActionMessage(
                team, selectedAction, resultType === 'criticalFailure' ? 'critical' : (resultType === 'failure' ? 'failure' : 'success'), 
                roll, total, dc, additionalInfo
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            await DataHandler.update({ teams, treasury: data.treasury + finalGold, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
        } else if (selectedAction === 'recruitSupporters' && dc) {
            const success = total >= dc;
            if (success) {
                const recruitRoll = new Roll("2d6");
                await recruitRoll.evaluate();
                let recruited = recruitRoll.total + bonuses.recruitmentBonus;
                
                // Неделя Секретности удваивает вербовку
                let recruitmentDetails = `2d6: ${recruitRoll.total}`;
                if (bonuses.recruitmentBonus > 0) {
                    recruitmentDetails += ` + бонус Вербовщиков: ${bonuses.recruitmentBonus}`;
                }
                if (DataHandler.isEventActive(data, "Неделя Секретности")) {
                    recruited *= 2;
                    recruitmentDetails += ` × 2 (Неделя Секретности)`;
                }
                
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", roll, total, dc,
                    `Завербовано: <strong>${recruited}</strong> сторонников (${recruitmentDetails})`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, supporters: data.supporters + recruited, actionsUsedThisWeek: data.actionsUsedThisWeek + 1, recruitedThisPhase: true });
            } else {
                const result = roll.total === 1 ? "critical" : "failure";
                let additionalInfo = "Сторонники не завербованы";
                let notorietyIncrease = 0;
                
                if (roll.total === 1) {
                    const notRoll = new Roll("1d6");
                    await notRoll.evaluate();
                    notorietyIncrease = notRoll.total;
                    additionalInfo = `Естественная 1! +${notorietyIncrease} Известность`;
                }
                
                await DataHandler.update({ teams, notoriety: data.notoriety + notorietyIncrease, actionsUsedThisWeek: data.actionsUsedThisWeek + 1, recruitedThisPhase: true });
                
                const message = this._createTeamActionMessage(
                    team, selectedAction, result, roll, total, dc, additionalInfo
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
            }
        } else if (selectedAction === 'disinformation' && dc) {
            const success = total >= dc;
            if (success) {
                const redRoll = new Roll("1d6");
                await redRoll.evaluate();
                const reduction = redRoll.total;
                const bonus = Math.floor((total - dc) / 10);
                const totalRed = reduction + bonus;
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", roll, total, dc,
                    `Известность снижена на <strong>${totalRed}</strong> (1d6: ${reduction} + бонус за превышение: ${bonus})`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, notoriety: Math.max(0, data.notoriety - totalRed), actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            } else if (total + 5 < dc) {
                const incRoll = new Roll("1d6");
                await incRoll.evaluate();
                const inc = incRoll.total;
                const message = this._createTeamActionMessage(
                    team, selectedAction, "critical", roll, total, dc,
                    `Критический провал! Известность +${inc}`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, notoriety: data.notoriety + inc, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            } else {
                const message = this._createTeamActionMessage(
                    team, selectedAction, "failure", roll, total, dc,
                    "Дезинформация не удалась"
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            }
        } else if (selectedAction === 'reduceDanger' && dc) {
            const success = total >= dc;
            if (success) {
                let reduction = 5 + Math.floor((total - dc) / 10) * 5;
                // Добавляем событие снижения опасности на следующую неделю
                const currentEvents = JSON.parse(JSON.stringify(data.events || []));
                currentEvents.push({
                    name: "Сниженная опасность (действие)",
                    desc: `Опасность снижена на ${reduction}% благодаря действию команды.`,
                    weekStarted: data.week + 1,
                    duration: 1,
                    isPersistent: false,
                    isActionEffect: true,
                    dangerReduction: reduction
                });
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", roll, total, dc,
                    `Опасность снижена на <strong>${reduction}%</strong> на следующую неделю`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, events: currentEvents, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            } else {
                const incRoll = new Roll("1d4");
                await incRoll.evaluate();
                const inc = incRoll.total;
                const message = this._createTeamActionMessage(
                    team, selectedAction, "failure", roll, total, dc,
                    `Провал! Опасность +5%, Известность +${inc}`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, notoriety: data.notoriety + inc, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            }
        } else if (selectedAction === 'cache' && dc) {
            // Cache creation action
            const success = total >= dc;
            if (success) {
                // Show cache creation dialog
                await this._showCacheCreationDialog(team, roll, total, dc);
            } else {
                const result = roll.total === 1 ? "critical" : "failure";
                let additionalInfo = "Не удалось создать тайник";
                
                if (roll.total === 1) {
                    const notRoll = new Roll("1d4");
                    await notRoll.evaluate();
                    const not = notRoll.total;
                    additionalInfo = `Критический провал! +${not} Известность`;
                    await DataHandler.update({ teams, notoriety: data.notoriety + not, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                } else {
                    await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
                }
                
                const message = this._createTeamActionMessage(
                    team, selectedAction, result, roll, total, dc, additionalInfo
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
            }
        } else if (selectedAction === 'rescue' && dc) {
            // Rescue Character action - результат уже получен из диалога
            // dc здесь = 10 + level (установлен в _showRescueLevelDialog)
            const level = dc - 10;
            const success = total >= dc;
            const notorietyIncrease = success ? level : Math.floor(level / 2);
            
            await DataHandler.update({ 
                teams,
                notoriety: data.notoriety + notorietyIncrease,
                actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
            });
            
            let resultInfo;
            if (success) {
                resultInfo = `Персонаж уровня <strong>${level}</strong> спасён! Известность +${notorietyIncrease}`;
            } else {
                resultInfo = `Попытка спасти персонажа уровня <strong>${level}</strong> не удалась. Известность +${notorietyIncrease} (половина уровня)`;
            }
            
            const message = this._createTeamActionMessage(
                team, selectedAction, success ? "success" : "failure", roll, total, dc, resultInfo
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
        } else if (selectedAction === 'blackMarket' && dc) {
            // Активация черного рынка - КС 20, Секретность, стоимость из настроек
            const blackMarketCost = teamsSettings.actions.blackMarketActivation;
            const success = total >= dc;
            if (success) {
                // Добавляем событие активации черного рынка на следующую неделю
                const currentEvents = JSON.parse(JSON.stringify(data.events || []));
                currentEvents.push({
                    name: "Черный рынок активен",
                    desc: "Черный рынок активирован. Доступны редкие и запрещенные товары.",
                    weekStarted: data.week + 1,
                    duration: 1,
                    isPersistent: false,
                    isActionEffect: true
                });
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", roll, total, dc,
                    `Черный рынок активирован! Доступ к редким товарам на следующую неделю. Потрачено ${blackMarketCost} зм.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ 
                    teams, 
                    events: currentEvents, 
                    treasury: data.treasury - blackMarketCost,
                    actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                });
            } else {
                const result = roll.total === 1 ? "critical" : "failure";
                let additionalInfo = `Не удалось активировать черный рынок. Потрачено ${blackMarketCost} зм.`;
                
                if (roll.total === 1) {
                    const notRoll = new Roll("1d6");
                    await notRoll.evaluate();
                    const not = notRoll.total;
                    additionalInfo = `Критический провал! Контакты раскрыты. +${not} Известность. Потрачено ${blackMarketCost} зм.`;
                    await DataHandler.update({ 
                        teams, 
                        notoriety: data.notoriety + not, 
                        treasury: data.treasury - blackMarketCost,
                        actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                    });
                } else {
                    await DataHandler.update({ 
                        teams, 
                        treasury: data.treasury - blackMarketCost,
                        actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                    });
                }
                
                const message = this._createTeamActionMessage(
                    team, selectedAction, result, roll, total, dc, additionalInfo
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
            }
        } else if (selectedAction === 'gatherInfo' && dc) {
            // Сбор информации - КС 15, Секретность + удвоенный ранг команды
            const teamRank = def.rank || 1;
            const rankBonus = teamRank * 2;
            const adjustedTotal = total + rankBonus;
            const success = adjustedTotal >= dc;
            
            // При натуральной 1 - не автопровал, но +1d6 к Известности
            let nat1Penalty = 0;
            let nat1Info = "";
            if (roll.total === 1) {
                const notRoll = new Roll("1d6");
                await notRoll.evaluate();
                nat1Penalty = notRoll.total;
                nat1Info = ` Натуральная 1: +${nat1Penalty} Известность`;
            }
            
            if (success) {
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", roll, adjustedTotal, dc,
                    `Информация собрана! (бонус ранга команды: +${rankBonus})${nat1Info}`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ 
                    teams, 
                    notoriety: data.notoriety + nat1Penalty,
                    actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                });
            } else {
                const message = this._createTeamActionMessage(
                    team, selectedAction, "failure", roll, adjustedTotal, dc,
                    `Не удалось собрать полезную информацию (бонус ранга команды: +${rankBonus})${nat1Info}`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ 
                    teams, 
                    notoriety: data.notoriety + nat1Penalty,
                    actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                });
            }
        } else if (selectedAction === 'sabotage' && dc) {
            // Саботаж - КС 20, Секретность
            // Бонус +2 для Сети Колокольчиков и Лакунафекс
            let sabotageBonus = 0;
            let bonusSource = "";
            if (team.type === 'bellflower') {
                sabotageBonus = 2;
                bonusSource = " (включая +2 от Сети Колокольчиков)";
            } else if (team.type === 'lacunafex') {
                sabotageBonus = 2;
                bonusSource = " (включая +2 от Лакунафекс)";
            }
            const adjustedTotal = total + sabotageBonus;
            const success = adjustedTotal >= dc;
            
            if (success) {
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", roll, adjustedTotal, dc,
                    `Саботаж успешен!${bonusSource} Цель повреждена или уничтожена.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            } else {
                const result = roll.total === 1 ? "critical" : "failure";
                
                // При провале саботаж имеет обратный эффект - уменьшает сторонников и население на 2d6
                const penaltyRoll = new Roll("2d6");
                await penaltyRoll.evaluate();
                const penalty = penaltyRoll.total;
                
                const newSupporters = Math.max(0, data.supporters - penalty);
                const newPopulation = Math.max(0, data.population - penalty);
                
                let additionalInfo = `Саботаж провален! Обратный эффект: -${penalty} Сторонников (было ${data.supporters}, стало ${newSupporters}), -${penalty} Население (было ${data.population}, стало ${newPopulation})`;
                
                if (roll.total === 1 || adjustedTotal + 5 < dc) {
                    const notRoll = new Roll("1d6");
                    await notRoll.evaluate();
                    const not = notRoll.total;
                    additionalInfo = `Критический провал! Обратный эффект: -${penalty} Сторонников, -${penalty} Население. Команда обнаружена: +${not} Известность`;
                    await DataHandler.update({ 
                        teams, 
                        supporters: newSupporters,
                        population: newPopulation,
                        notoriety: data.notoriety + not, 
                        actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                    });
                } else {
                    await DataHandler.update({ 
                        teams, 
                        supporters: newSupporters,
                        population: newPopulation,
                        actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                    });
                }
                
                const message = this._createTeamActionMessage(
                    team, selectedAction, result, roll, adjustedTotal, dc, additionalInfo
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
            }
        } else if (selectedAction === 'covert') {
            // Тайная операция - без фиксированного КС, результат определяет ГМ
            // Бонус +2 для Лакунафекс
            let covertBonus = 0;
            let bonusSource = "";
            if (team.type === 'lacunafex') {
                covertBonus = 2;
                bonusSource = " (включая +2 от Лакунафекс)";
            }
            const adjustedTotal = total + covertBonus;
            const message = this._createTeamActionMessage(
                team, selectedAction, null, roll, adjustedTotal, null,
                `Тайная операция выполнена${bonusSource}. Результат: ${adjustedTotal}. ГМ определяет успех.`
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
        } else if (selectedAction === 'safehouse') {
            // Активация убежища - запрашиваем местоположение и создаем событие на следующую неделю
            const location = await Dialog.prompt({
                title: "Активация убежища",
                content: `
                    <form>
                        <div class="form-group">
                            <label>Где находится убежище?</label>
                            <div class="form-fields">
                                <input type="text" placeholder="Например: лавка торговца, заброшенный дом, подвал таверны..." style="width: 100%;" />
                            </div>
                        </div>
                    </form>
                `,
                callback: html => html.find('input').val(),
                close: () => null,
                rejectClose: false
            });
            
            if (location !== null && location.trim() !== "") {
                const currentEvents = JSON.parse(JSON.stringify(data.events || []));
                const safehouseName = `Убежище активно: ${location.trim()}`;
                currentEvents.push({
                    name: safehouseName,
                    desc: `Убежище активировано в локации: ${location.trim()}. +1 к Безопасности. Команда может укрыться здесь при необходимости.`,
                    weekStarted: data.week + 1,
                    duration: 1,
                    isPersistent: false,
                    isActionEffect: true,
                    securityBonus: 1
                });
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", null, null, null,
                    `Убежище активировано в локации: ${location.trim()}! +1 к Безопасности на следующую неделю. Команда может укрыться здесь.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, events: currentEvents, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            } else {
                ui.notifications.warn("Активация убежища отменена - не указано местоположение.");
                return;
            }
        } else if (selectedAction === 'knowledge') {
            // Проверка Знания - результат = информация, без КС
            const message = this._createTeamActionMessage(
                team, selectedAction, null, roll, total, null,
                `📚 Проверка Знания: результат ${total}. ГМ предоставляет информацию соответствующего уровня.`
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
        } else if (selectedAction === 'dismiss' && dc) {
            // Роспуск команды - требует проверки Верности КС 10
            const success = total >= dc;
            
            if (success) {
                // Удаляем команду
                teams.splice(teamIdx, 1);
                const message = this._createTeamActionMessage(
                    team, selectedAction, "success", roll, total, dc,
                    `👋 Команда ${def.label} распущена. Члены команды разошлись мирно.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            } else {
                // Провал - команда недовольна
                const notRoll = new Roll("1d4");
                await notRoll.evaluate();
                const not = notRoll.total;
                const message = this._createTeamActionMessage(
                    team, selectedAction, "failure", roll, total, dc,
                    `😠 Команда ${def.label} недовольна попыткой роспуска! +${not} Известность. Команда остается.`
                );
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                await this._logToJournal(message);
                await DataHandler.update({ teams, notoriety: data.notoriety + not, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
            }
        } else {
            // Generic success/fail for other actions
            const result = total >= dc ? "success" : "failure";
            let actionInfo = result === "success" ? "Действие выполнено успешно" : "Действие провалено";
            
            // Специальная обработка для действия "Залечь на дно" при постоянной Инквизиции
            if (selectedAction === "lieLow" && result === "success") {
                const inquisitionEvent = data.events?.find(e => e.name === "Инквизиция" && e.isPersistent);
                if (inquisitionEvent) {
                    // Завершаем постоянную Инквизицию
                    const filteredEvents = data.events.filter(e => e.name !== "Инквизиция");
                    await DataHandler.update({ events: filteredEvents });
                    actionInfo += "<br><strong style='color:green'>Постоянная Инквизиция завершена!</strong> Трун и церковь отступили.";
                }
            }
            
            const message = this._createTeamActionMessage(
                team, selectedAction, result, roll, total, dc, actionInfo
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            await DataHandler.update({ teams, actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
        }
    }

    async _onExecuteSilverRavensAction(ev) {
        ev.preventDefault();
        const data = DataHandler.get();
        
        if (DataHandler.getActionsRemaining(data) <= 0) {
            ui.notifications.warn("Действия исчерпаны на этой неделе!");
            return;
        }

        // Read action from DOM or saved data
        const $form = $(ev.currentTarget).closest('form');
        const actionSelect = $form.find(`select[name="silverRavensAction"]`);
        const selectedAction = actionSelect.val() || data.silverRavensAction;

        if (!selectedAction || selectedAction === '') {
            ui.notifications.warn("Выберите действие для Серебряных воронов!");
            return;
        }

        // Create a virtual team object for Silver Ravens
        const silverRavensTeam = {
            label: "Серебряные Вороны",
            type: "silverRavens",
            currentAction: selectedAction,
            manager: "",
            bonus: 0,
            isStrategistTarget: false
        };

        // Calculate bonuses for the action
        const checkType = ACTION_CHECKS[selectedAction];
        const bonuses = DataHandler.getRollBonuses(data, selectedAction);
        let dc = null;

        if (checkType) {
            // Determine DC
            if (ACTION_DC[selectedAction] === "rank") {
                dc = 10 + data.rank;
            } else if (typeof ACTION_DC[selectedAction] === "number") {
                dc = ACTION_DC[selectedAction];
            }
        }
        
        // Проверки для действия "Вербовать сторонников" ПЕРЕД роллом
        if (selectedAction === 'recruitSupporters') {
            // Check once per phase limit
            if (data.recruitedThisPhase) {
                ui.notifications.warn("Вербовать сторонников можно только один раз за фазу Деятельности!");
                return;
            }
            
            // Check max rank limit
            if (data.rank >= data.maxRank) {
                ui.notifications.warn("Нельзя вербовать сторонников на максимальном ранге восстания!");
                return;
            }
        }
        
        // Если есть проверка с КС, используем диалог броска
        if (checkType && dc) {
            return this._showSilverRavensRollDialog(silverRavensTeam, selectedAction, checkType, dc, bonuses, ev);
        }

        // Handle specific actions without checks
        if (selectedAction === 'lieLow') {
            // Залечь на дно - забирает ВСЕ действия, снижает Известность на кол-во команд
            // Проверяем, что это первое действие на неделе
            if (data.actionsUsedThisWeek > 0) {
                ui.notifications.warn("Залечь на дно можно только если вы не предпринимали никаких действий на этой неделе!");
                return;
            }
            
            // Считаем количество команд восстания (операционных)
            const teamCount = DataHandler.countOperationalTeams(data);
            const notorietyReduction = teamCount;
            
            // Уменьшаем Известность
            const newNotoriety = Math.max(0, data.notoriety - notorietyReduction);
            const actualReduction = data.notoriety - newNotoriety;
            
            // Используем ВСЕ действия
            const bonuses = DataHandler.getRollBonuses(data);
            const maxActions = bonuses.maxActions + DataHandler.getManticceBonusActionCount(data);
            
            let actionInfo = `<strong>Залечь на дно!</strong><br>`;
            actionInfo += `Восстание прекращает всю активность на эту неделю.<br>`;
            actionInfo += `Известность снижена на ${actualReduction} (было ${data.notoriety}, стало ${newNotoriety}).<br>`;
            actionInfo += `Использовано действий: ${maxActions}`;
            
            // Проверяем постоянную Инквизицию
            const inquisitionEvent = data.events?.find(e => e.name === "Инквизиция" && e.isPersistent);
            if (inquisitionEvent) {
                // Требуется проверка Секретности КС 20
                const secrecyRoll = new Roll("1d20");
                await secrecyRoll.evaluate();
                const secrecyTotal = secrecyRoll.total + bonuses.secrecy.total;
                
                if (secrecyTotal >= 20) {
                    const filteredEvents = data.events.filter(e => e.name !== "Инквизиция");
                    await DataHandler.update({ events: filteredEvents });
                    actionInfo += `<br><strong style='color:green'>Постоянная Инквизиция завершена!</strong> (Секретность: ${secrecyTotal} vs КС 20)`;
                } else {
                    actionInfo += `<br><span style='color:#d84315'>Инквизиция продолжается.</span> (Секретность: ${secrecyTotal} vs КС 20)`;
                }
            }
            
            const message = this._createTeamActionMessage(
                silverRavensTeam, selectedAction, "success", null, null, null, actionInfo
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            await DataHandler.update({ 
                notoriety: newNotoriety,
                actionsUsedThisWeek: maxActions 
            });
        } else {
            // Other actions (guarantee, changeOfficer, special)
            const message = this._createTeamActionMessage(
                silverRavensTeam, selectedAction, null, null, null, null, "Действие выполнено"
            );
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            await DataHandler.update({ actionsUsedThisWeek: data.actionsUsedThisWeek + 1 });
        }

        // Clear the action selection
        actionSelect.val('');
    }

    async _onExecuteManticceBonusAction(ev) {
        ev.preventDefault();
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const team = data.teams[idx];
        if (!team) {
            ui.notifications.warn("Команда не найдена!");
            return;
        }

        // Verify this is a valid bonus action
        if (!DataHandler.canUseManticceBonusAction(data, team)) {
            const manticceBonusUsed = data.manticceBonusUsedThisWeek || false;
            if (manticceBonusUsed) {
                ui.notifications.warn("Бонусное действие королевы уже использовано на этой неделе!");
            } else {
                ui.notifications.warn("Бонусное действие королевы недоступно для этой команды!");
            }
            return;
        }

        // Execute Earn Gold action as bonus (doesn't count against action limit)
        const def = getTeamDefinition(team.type);
        const bonuses = DataHandler.getRollBonuses(data);
        const dc = getEarnIncomeDC(data.rank); // Use PF2e Earn Income DC based on rebellion rank
        const checkType = 'security';
        const teamRank = def.rank || 1;
        
        // Добавляем бонус ½ ранга восстания + мастерство команды
        const halfRankBonus = getHalfRankBonus(data.rank);
        const profBonus = getTeamProficiencyBonus(teamRank);
        
        let totalMod = bonuses.security.total + (team.bonus || 0) + halfRankBonus + profBonus;
        if (team.manager) {
            const m = data.officers.find(x => x.actorId === team.manager);
            if (m) totalMod += m.bonus || 0;
        }

        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска для бонусного действия Мантикке...");
            
            const checkBonus = bonuses[checkType] || { total: 0, parts: [] };
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));
            
            // Добавляем бонусы Earn Income
            const profLabel = { 1: 'Обуч.', 2: 'Эксп.', 3: 'Мастер' }[teamRank] || 'Обуч.';
            modifiers.push(new game.pf2e.Modifier({
                label: `½ ранга (${data.rank})`,
                modifier: halfRankBonus,
                type: "untyped"
            }));
            modifiers.push(new game.pf2e.Modifier({
                label: `Мастерство (${profLabel})`,
                modifier: profBonus,
                type: "untyped"
            }));
            // Добавляем бонус команды
            if (team.bonus) {
                modifiers.push(new game.pf2e.Modifier({
                    label: "Ручной бонус",
                    modifier: team.bonus,
                    type: "untyped"
                }));
            }

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isManticceBonusRoll: true,
                    teamIdx: idx,
                    teamType: team.type,
                    dc: dc,
                    totalMod: totalMod,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска бонусного действия Мантикке:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Безопасность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false,
                        dc: { value: dc },
                        title: `${def.label}: Бонусное действие Мантикке`,
                        notes: [`Бонусное действие королевы Мантикке`],
                        context: {
                            type: "skill-check",
                            skill: checkType,
                            action: checkType,
                            isManticceBonusRoll: true,
                            teamIdx: idx
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для бонусного действия Мантикке.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                game.rebellionState = null;
                await this._fallbackManticceBonusRoll(team, def, dc, totalMod, data);
            }
        } else {
            console.log("PF2e API недоступен. Используем fallback бросок для бонусного действия Мантикке.");
            await this._fallbackManticceBonusRoll(team, def, dc, totalMod, data);
        }
    }

    // Fallback функция для автоброска бонусного действия Мантикке
    async _fallbackManticceBonusRoll(team, def, dc, totalMod, data) {
        const roll = new Roll("1d20");
        await roll.evaluate();
        const total = roll.total + totalMod;
        
        // Use PF2e Earn Income table
        const teamRank = def.rank || 1;
        // Уровень задачи = уровень игрока (если игрок) или первого члена Party (если ГМ)
        const playerLevel = this._getPlayerLevel();
        const earnIncomeResult = calculateEarnIncome(playerLevel, teamRank, total, dc);
        const incomeInCopper = earnIncomeResult.income;
        const incomeInGold = incomeInCopper / 100;
        const formattedIncome = formatIncome(incomeInCopper);
        
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
        
        const message = this._createTeamActionMessage(
            team, 'earnGold', 
            resultType === 'criticalFailure' ? 'critical' : (resultType === 'failure' ? 'failure' : 'success'), 
            roll, total, dc, additionalInfo
        );
        
        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
        
        // Update treasury and mark bonus action as used
        await DataHandler.update({ 
            treasury: data.treasury + incomeInGold,
            manticceBonusUsedThisWeek: true
        });
        
        ui.notifications.info(`Бонусное действие выполнено! Заработано ${formattedIncome}.`);
    }

    async _onUpgradeTeam(ev) {
        ev.preventDefault();
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const team = data.teams[idx];
        if (!team) return;

        const def = getTeamDefinition(team.type);
        if (!def.next) return;

        if (DataHandler.getActionsRemaining(data) <= 0) {
            ui.notifications.warn("Действия исчерпаны на этой неделе!");
            return;
        }

        const options = getUpgradeOptions(team.type);
        if (!options.length) return;

        const teamsSettings = data.teamsSettings || {};
        
        let content = `<p>Выберите улучшение для команды <strong>${def.label}</strong>:</p><form>`;
        options.forEach((opt, i) => {
            const capsList = (opt.caps || []).map(c => SPECIFIC_ACTIONS[c] || UNIVERSAL_ACTIONS[c] || c).join(', ');
            let details = [`Ранг ${opt.rank}`];
            if (capsList) details.push(`Действия: ${capsList}`);
            if (opt.desc) details.push(`<strong>Бонус:</strong> <em>${opt.desc}</em>`);

            const cost = teamsSettings.teamUpgradeCosts?.[opt.slug] || opt.upgradeCost || 0;

            content += `<div class="form-group" style="margin-bottom: 8px;">
                <label style="cursor: pointer;">
                    <input type="radio" name="upgrade" value="${opt.slug}" ${i === 0 ? 'checked' : ''}> 
                    <span style="font-size: 1.1em; font-weight: bold;">${opt.label}</span> (${cost} зм)
                    <div style="margin-left: 20px; font-size: 0.9em; color: #444; margin-top: 2px;">
                        ${details.join('<br>')}
                    </div>
                </label>
            </div>`;
        });
        content += `</form>`;

        new Dialog({
            title: "Улучшить команду",
            content,
            buttons: {
                upgrade: {
                    label: "Улучшить",
                    callback: async (html) => {
                        const newType = html.find('input[name="upgrade"]:checked').val();
                        const newDef = getTeamDefinition(newType);
                        const data = DataHandler.get();
                        const teamsSettings = data.teamsSettings || {};
                        const cost = teamsSettings.teamUpgradeCosts?.[newType] || newDef.upgradeCost || 0;

                        if (data.treasury < cost) {
                            ui.notifications.warn(`Недостаточно золота! Нужно ${cost} зм.`);
                            return;
                        }

                        const teams = JSON.parse(JSON.stringify(data.teams));
                        teams[idx].type = newType;
                        await DataHandler.update({
                            teams,
                            treasury: data.treasury - cost,
                            actionsUsedThisWeek: data.actionsUsedThisWeek + 1
                        });
                        ui.notifications.info(`${def.label} улучшена до ${newDef.label}!`);

                        let message = `
                            <div style="
                                border: 3px solid #4a90e2; 
                                padding: 15px; 
                                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); 
                                border-radius: 12px; 
                                margin: 10px 0; 
                                box-shadow: 0 4px 8px rgba(74, 144, 226, 0.3);
                            ">
                                <h5 style="color: #1976d2; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                                    Улучшение команды
                                </h5>
                                
                                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <img src="${def.icon}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #666;">
                                        <span style="font-size: 1.5em; color: #1976d2;">→</span>
                                        <img src="${newDef.icon}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 3px solid #1976d2;">
                                    </div>
                                    <div>
                                        <div style="color: #666; font-size: 0.9em;">Было:</div>
                                        <strong style="color: #666;">${def.label}</strong>
                                        <div style="color: #1976d2; font-size: 0.9em; margin-top: 5px;">Стало:</div>
                                        <strong style="font-size: 1.2em; color: #1976d2;">${newDef.label}</strong>
                                    </div>
                                </div>
                                
                                <div style="background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="color: #1976d2; font-weight: bold; font-size: 1.1em;">
                                        Стоимость улучшения: ${cost} зм
                                    </div>
                                    <div style="margin-top: 8px; color: #0d47a1;">
                                        Команда стала сильнее!
                                    </div>
                                </div>
                            </div>
                        `;
                        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                        await this._logToJournal(message);
                    }
                },
                cancel: { label: "Отмена" }
            }
        }).render(true);
    }

    async _onPhaseClick(ev) {
        const phase = ev.currentTarget.dataset.action;
        const data = DataHandler.get();
        let log = data.phaseReport ? data.phaseReport + "\n" : "";
        log += `--- Фаза: ${phase === 'maintenance' ? 'Содержание' : phase === 'activity' ? 'Деятельность' : 'Событие'} ---\n`;

        if (phase === 'maintenance') {
            // Step 1: Supporter Attrition
            const roll = new Roll("1d20");
            await roll.evaluate();
            const bonuses = DataHandler.getRollBonuses(data);
            const total = roll.total + bonuses.loyalty.total;
            let lost = 0;
            let resultText = "";

            if (roll.total === 20) {
                const gain = new Roll("1d6").evaluate({ async: false }).total;
                lost = -gain;
                resultText = "Крит! Прирост сторонников.";
            }
            else if (total >= 10) {
                lost = new Roll("1d6").evaluate({ async: false }).total;
                resultText = "Успех.";
            }
            else {
                lost = new Roll(`2d4 + ${data.rank}`).evaluate({ async: false }).total;
                resultText = "Провал.";
            }

            // Ally effects
            if (DataHandler.isAllyActive(data, 'rexus') && data.notoriety > 0) {
                await DataHandler.update({ notoriety: Math.max(0, data.notoriety - 1) });
                log += "Рексус снизил Известность на 1.\n";
            }
            if (DataHandler.isAllyActive(data, 'hetamon')) {
                const hRoll = new Roll("1d6").evaluate({ async: false }).total;
                await DataHandler.update({ notoriety: Math.max(0, data.notoriety - hRoll) });
                log += `Хетамон снизил Известность на ${hRoll}.\n`;
            }

            // Step 2: Notoriety 100
            if (data.notoriety >= 100) {
                const punish = new Roll(`1d20 + ${data.rank}`).evaluate({ async: false }).total;
                lost += punish;
                await DataHandler.update({ population: Math.max(0, data.population - punish) });
                log += `Известность 100! Казни: -${punish} сторонников и населения.\n`;
            }

            // Step 3: Low Treasury
            const minTreasury = DataHandler.getMinTreasury(data);
            if (data.treasury < minTreasury && !DataHandler.isAllyActive(data, 'manticce')) {
                const tPunish = new Roll(`2d4 + ${data.rank}`).evaluate({ async: false }).total;
                lost += tPunish;
                log += `Нехватка казны! Потеряно еще ${tPunish} сторонников.\n`;
            }

            const newSupp = Math.max(0, data.supporters - lost);

            // Step 4: Rank Up (rank never drops)
            const newRank = DataHandler.calculateRank(newSupp, data.rank, data.maxRank);
            if (newRank > data.rank) {
                const newRankInfo = REBELLION_PROGRESSION[newRank];
                const customGift = data.customGifts?.[newRank];
                const giftText = customGift || newRankInfo.gift;
                
                log += `\nПОВЫШЕНИЕ РАНГА! ${data.rank} → ${newRank}\n`;
                if (giftText) log += `Дар ПИ: ${giftText}\n`;
                if (newRankInfo.title) log += `Титул: ${newRankInfo.title}\n`;
            }

            await DataHandler.update({
                supporters: newSupp,
                rank: newRank,
                phaseReport: log,
                actionsUsedThisWeek: 0, // Reset for new week
                strategistUsed: false, // Reset strategist usage for new week
                recruitedThisPhase: false // Reset recruit limit for new week
            });

            log += `Проверка убыли (Верность): 1d20(${roll.total}) + ${bonuses.loyalty.total} = ${total}. ${resultText}\n`;
            log += `Изменение сторонников: ${lost > 0 ? '-' : '+'}${Math.abs(lost)}. Всего: ${newSupp}.\n`;
        }
        else if (phase === 'activity') {
            const actionsRemaining = DataHandler.getActionsRemaining(data);
            const operationalTeams = DataHandler.countOperationalTeams(data);
            log += `=== ФАЗА ДЕЯТЕЛЬНОСТИ ===\n`;
            log += `Доступно действий: ${actionsRemaining}\n`;
            log += `Рабочих команд: ${operationalTeams}\n`;

            // Send summary to chat
            ChatMessage.create({
                content: `<h5>Фаза Деятельности</h5>
                    <p><strong>Доступно действий:</strong> ${actionsRemaining}</p>
                    <p><strong>Рабочих команд:</strong> ${operationalTeams}</p>
                    <p><em>Перейдите во вкладку "Команды".</em></p>`,
                speaker: ChatMessage.getSpeaker()
            });
        }
        else if (phase === 'event') {
            const chance = DataHandler.getEventChance(data);
            const d100 = new Roll("1d100").evaluate({ async: false }).total;
            log += `Шанс события: ${chance}% ${data.weeksWithoutEvent > 0 ? '(×2 за тихую неделю)' : ''}. Бросок: ${d100}.\n`;

            if (d100 <= chance) {
                const effectiveDanger = DataHandler.getEffectiveDanger(data);
                const evRoll = new Roll(`1d100 + ${effectiveDanger}`).evaluate({ async: false }).total;
                const event = EVENT_TABLE.find(e => evRoll >= e.min && evRoll <= e.max) || EVENT_TABLE[EVENT_TABLE.length - 1];

                // Check immunities
                if (event.name === "Усиленные патрули" && DataHandler.isAllyActive(data, 'cassius')) {
                    const bonus = new Roll("3d6").evaluate({ async: false }).total;
                    await DataHandler.update({ supporters: data.supporters + bonus, weeksWithoutEvent: 0 });
                    log += `Событие: Усиленные патрули. Кассий предотвратил! +${bonus} сторонников.\n`;
                } else if (event.name === "Низкий боевой дух" && DataHandler.isAllyActive(data, 'octavio')) {
                    await DataHandler.update({ weeksWithoutEvent: 0 });
                    log += `Событие: Низкий боевой дух. Октавио предотвратил!\n`;
                } else if (event.name === "Болезнь" && DataHandler.isAllyActive(data, 'hetamon')) {
                    await DataHandler.update({ weeksWithoutEvent: 0 });
                    log += `Событие: Болезнь. Хетамон предотвратил!\n`;
                } else if (event.name === "Все спокойно") {
                    // Событие "Все спокойно" предотвращает события на следующую неделю
                    log += `СОБЫТИЕ: ${event.name} (Бросок ${evRoll})\n${event.desc}\nСледующая неделя без событий.\n`;
                } else {
                    await DataHandler.update({ weeksWithoutEvent: 0 });
                    log += `СОБЫТИЕ: ${event.name} (Бросок ${evRoll})\n${event.desc}\n`;
                    if (event.persistent) log += `Это событие может стать постоянным!\n`;
                    if (event.mitigate) log += `Смягчение: ${event.mitigate} КС ${event.dc}\n`;
                }
            } else {
                await DataHandler.update({ weeksWithoutEvent: data.weeksWithoutEvent + 1 });
                log += "Событий нет.\n";
            }
        }

        await DataHandler.update({ phaseReport: log });
    }

    // === NEW KINGMAKER-STYLE STEP HANDLERS ===

    async _onMaintenanceAttrition() {
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const roll = new Roll("1d20");
        await roll.evaluate();
        const total = roll.total + bonuses.loyalty.total;
        let lost = 0;
        let resultText = "";
        let color = "green";
        
        // Create phase header for beautiful logging
        const phaseHeader = `
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0 10px 0;
                text-align: center;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            ">
                <h5 style="margin: 0; font-size: 1.4em;">
                    ФАЗА СОДЕРЖАНИЯ - Убыль сторонников
                </h5>
                <div style="margin-top: 5px; font-size: 0.9em; opacity: 0.9;">
                    Неделя ${data.week} • Проверка Верности КС 10
                </div>
            </div>
        `;
        
        await this._logToJournal(phaseHeader, { skipTimestamp: true });

        if (roll.total === 20) {
            const gainRoll = new Roll("1d6");
            await gainRoll.evaluate();
            lost = -(gainRoll.total || 0);
            resultText = "Критический успех! Прирост сторонников.";
            color = "#4caf50";
        } else if (total >= 10) {
            const lossRoll = new Roll("1d6");
            await lossRoll.evaluate();
            lost = lossRoll.total || 0;
            resultText = "Успех. Минимальные потери.";
            color = "#2196f3";
        } else {
            const lossRoll = new Roll(`2d4 + ${data.rank}`);
            await lossRoll.evaluate();
            lost = lossRoll.total || 0;
            resultText = "Провал. Значительные потери.";
            color = "#f44336";
        }

        // Проверяем эффект Инквизиции (удваивает потери сторонников)
        const inquisitionEvent = data.events?.find(e => e.name === "Инквизиция");
        let inquisitionMultiplier = 1;
        if (inquisitionEvent && lost > 0) {
            if (inquisitionEvent.mitigated) {
                inquisitionMultiplier = 1.5; // Смягченная Инквизиция
                resultText += " Инквизиция (смягчена): ×1.5 потери.";
            } else {
                inquisitionMultiplier = 2; // Полная Инквизиция
                resultText += " Инквизиция: ×2 потери.";
            }
            lost = Math.floor(lost * inquisitionMultiplier);
            color = "#8b0000"; // Темно-красный для Инквизиции
        }

        const currentSupp = data.supporters || 0;
        const newSupp = Math.max(0, currentSupp - lost);
        await DataHandler.update({ supporters: newSupp });

        // Ally effects (Rexus only - Hetamon is handled at maintenance phase start)
        let allyEffects = [];
        if (DataHandler.isAllyActive(data, 'rexus') && (data.notoriety || 0) > 0) {
            await DataHandler.update({ notoriety: Math.max(0, (data.notoriety || 0) - 1) });
            allyEffects.push("Рексус: -1 Известность");
        }

        let message = `
            <div style="
                border: 3px solid ${color}; 
                padding: 15px; 
                background: linear-gradient(135deg, ${color}15 0%, ${color}25 100%); 
                border-radius: 12px; 
                margin: 10px 0; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            ">
                <h5 style="color: ${color}; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                    Шаг 1: Убыль сторонников
                </h5>
                
                <div style="background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                    <strong>Проверка Верности:</strong>
                    <span style="color: ${color}; font-weight: bold; font-size: 1.1em;">
                        1d20(${roll.total}) + ${bonuses.loyalty.total} = ${total} против КС 10
                    </span>
                </div>
                
                <div style="background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${color};">
                    <strong style="color: ${color};">${resultText}</strong>
                    <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #333;">Изменение: ${lost > 0 ? `-${lost}` : `+${Math.abs(lost)}`} сторонников</span>
                        <span style="font-weight: bold; color: ${color};">Всего: ${newSupp}</span>
                    </div>
                </div>
                
                ${allyEffects.length > 0 ? `
                <div style="background: rgba(76, 175, 80, 0.1); padding: 12px; border-radius: 8px; border: 2px solid #4caf50;">
                    <strong style="color: #2e7d32;">Эффекты союзников:</strong>
                    <div style="margin-top: 8px; color: #333;">
                        ${allyEffects.map(effect => `<div style="margin: 4px 0;">• ${effect}</div>`).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    async _onMaintenanceNotoriety() {
        const data = DataHandler.get();
        if ((data.notoriety || 0) < 100) {
            ui.notifications.info("Известность ниже 100 - казней нет.");
            return;
        }

        const punishRoll = new Roll(`1d20 + ${data.rank || 1}`);
        await punishRoll.evaluate();
        const punish = punishRoll.total || 0;
        const currentSupp = data.supporters || 0;
        const currentPop = data.population || 0;
        const newSupp = Math.max(0, currentSupp - punish);
        const newPop = Math.max(0, currentPop - punish);
        await DataHandler.update({ supporters: newSupp, population: newPop });

        let message = `
            <div style="
                border: 3px solid #8b0000; 
                padding: 15px; 
                background: linear-gradient(135deg, #8b000015 0%, #8b000025 100%); 
                border-radius: 12px; 
                margin: 10px 0;
                box-shadow: 0 4px 8px rgba(139,0,0,0.3);
            ">
                <h5 style="margin: 0 0 10px 0; color: #8b0000; border-bottom: 2px solid #8b0000; padding-bottom: 8px;">
                    Шаг 2: Казни (Известность 100+)
                </h5>
                <p style="color:red; font-weight: bold; margin: 10px 0;">
                    <strong>Трунау устраивает массовые казни!</strong>
                </p>
                <div style="background: rgba(139,0,0,0.1); padding: 10px; border-radius: 6px; margin: 10px 0;">
                    <p style="margin: 5px 0;">Потеряно: <strong style="color: #8b0000; font-size: 1.2em;">${punish}</strong> сторонников и населения</p>
                </div>
                <p style="margin: 5px 0; font-size: 0.9em;">Сторонников: <strong>${newSupp}</strong> | Население: <strong>${newPop}</strong></p>
            </div>`;
        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    async _onMaintenanceTreasury() {
        const data = DataHandler.get();
        const minTreasury = DataHandler.getMinTreasury(data);

        if (data.treasury >= minTreasury) {
            ui.notifications.info("Казна в норме - потерь нет.");
            return;
        }

        if (DataHandler.isAllyActive(data, 'manticce')) {
            let message = `
            <div style="
                border: 3px solid #4caf50; 
                padding: 15px; 
                background: linear-gradient(135deg, #4caf5015 0%, #4caf5025 100%); 
                border-radius: 12px; 
                margin: 10px 0;
                box-shadow: 0 4px 8px rgba(76,175,80,0.3);
            ">
                <h5 style="margin: 0 0 10px 0; color: #4caf50; border-bottom: 2px solid #4caf50; padding-bottom: 8px;">
                    Шаг 3: Проверка казны
                </h5>
                <p style="margin: 10px 0;">Казна ниже минимума (${data.treasury}/${minTreasury} зм)</p>
                <p style="color:green; font-weight: bold; margin: 10px 0;">
                    <strong>👑 Королева Мантикке покрывает расходы!</strong>
                </p>
            </div>`;
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
            return;
        }

        const lossRoll = new Roll(`2d4 + ${data.rank}`);
        await lossRoll.evaluate();
        const lost = lossRoll.total || 0;
        const currentSupp = data.supporters || 0;
        const newSupp = Math.max(0, currentSupp - lost);
        await DataHandler.update({ supporters: newSupp });

        let message = `
            <div style="
                border: 3px solid #ff9800; 
                padding: 15px; 
                background: linear-gradient(135deg, #ff980015 0%, #ff980025 100%); 
                border-radius: 12px; 
                margin: 10px 0;
                box-shadow: 0 4px 8px rgba(255,152,0,0.3);
            ">
                <h5 style="margin: 0 0 10px 0; color: #ff9800; border-bottom: 2px solid #ff9800; padding-bottom: 8px;">
                    Шаг 3: Нехватка казны
                </h5>
                <p style="color:red; margin: 10px 0;">Казна ниже минимума (${data.treasury || 0}/${minTreasury} зм)</p>
                <div style="background: rgba(255,152,0,0.1); padding: 10px; border-radius: 6px; margin: 10px 0;">
                    <p style="margin: 5px 0;">Потеряно сторонников: <strong style="color: #f44336; font-size: 1.2em;">${lost}</strong></p>
                </div>
                <p style="margin: 5px 0; font-size: 0.9em;">Всего сторонников: <strong>${newSupp}</strong></p>
            </div>`;
        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    async _onMaintenanceRankup() {
        const data = DataHandler.get();
        const newRank = DataHandler.calculateRank(data.supporters, data.rank, data.maxRank);

        if (newRank > data.rank) {
            let giftsHtml = "";
            for (let r = data.rank + 1; r <= newRank; r++) {
                const info = REBELLION_PROGRESSION[r];
                if (info) {
                    const customGift = data.customGifts?.[r];
                    const giftText = customGift || info.gift;
                    if (giftText) giftsHtml += `<p><strong>Ранг ${r} Дар:</strong> ${giftText}</p>`;
                    if (info.title) giftsHtml += `<p><strong>Ранг ${r} Титул:</strong> ${info.title}</p>`;
                }
            }

            await DataHandler.update({ rank: newRank, actionsUsedThisWeek: 0, strategistUsed: false, recruitedThisPhase: false });

            let message = `
                <div style="
                    border: 3px solid #27ae60; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #d5f4e6 0%, #a8e6cf 100%); 
                    border-radius: 15px; 
                    margin: 15px 0; 
                    box-shadow: 0 6px 12px rgba(39, 174, 96, 0.3);
                ">
                    <h5 style="color: #27ae60; margin: 0 0 15px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                        Шаг 4: Повышение ранга!
                    </h5>
                    
                    <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-size: 1.3em; color: #27ae60; font-weight: bold; text-align: center;">
                            Ранг ${data.rank} → ${newRank}
                        </div>
                    </div>
                    
                    ${giftsHtml ? `<div style="background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; margin-bottom: 12px; color: #2c3e50; font-weight: 500;">${giftsHtml}</div>` : ''}
                    
                    <div style="text-align: center; color: #27ae60; font-weight: 600; font-size: 1.1em;">
                        Действия сброшены на новую неделю
                    </div>
                </div>
            `;
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
        } else {
            await DataHandler.update({ actionsUsedThisWeek: 0, strategistUsed: false, recruitedThisPhase: false });
            let message = `
                <div style="
                    border: 3px solid #3498db; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #ebf3fd 0%, #d6eaff 100%); 
                    border-radius: 15px; 
                    margin: 15px 0; 
                    box-shadow: 0 6px 12px rgba(52, 152, 219, 0.3);
                ">
                    <h5 style="color: #2980b9; margin: 0 0 15px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                        Шаг 4: Проверка ранга
                    </h5>
                    
                    <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-size: 1.2em; color: #2c3e50; font-weight: bold; margin-bottom: 8px;">
                            Ранг остаётся: <span style="color: #2980b9;">${data.rank}</span>
                        </div>
                        <div style="color: #34495e; font-weight: 500;">
                            Сторонников: <strong>${data.supporters}</strong> (нужно <strong>${REBELLION_PROGRESSION[data.rank + 1]?.minSupporters || '∞'}</strong> для повышения)
                        </div>
                    </div>
                    
                    <div style="text-align: center; color: #2980b9; font-weight: 600; font-size: 1.1em;">
                        ⏰ Действия сброшены на новую неделю
                    </div>
                </div>
            `;
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
        }
    }

    async _onTreasuryDeposit() {
        const amount = await this._promptTreasuryAmount("Вклад в казну", "Сколько золота внести?");
        if (amount > 0) {
            const data = DataHandler.get();
            await DataHandler.update({ treasury: data.treasury + amount });
            ui.notifications.info(`Внесено ${amount} зм в казну.`);
            let message = `
                <div style="
                    border: 3px solid #f39c12; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #fef9e7 0%, #fcf3cf 100%); 
                    border-radius: 15px; 
                    margin: 15px 0; 
                    box-shadow: 0 6px 12px rgba(243, 156, 18, 0.3);
                ">
                    <h5 style="color: #e67e22; margin: 0 0 15px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                        💰 Вклад в казну
                    </h5>
                    
                    <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.3em; color: #e67e22; font-weight: bold;">
                            Внесено: ${amount} зм
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 12px; color: #d68910; font-weight: 500; font-size: 1em;">
                        Казна пополнена!
                    </div>
                </div>
            `;
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
        }
    }

    async _onTreasuryWithdraw() {
        const amount = await this._promptTreasuryAmount("Снятие из казны", "Сколько золота снять?");
        if (amount > 0) {
            const data = DataHandler.get();
            if (data.treasury < amount) {
                ui.notifications.warn("Недостаточно золота в казне!");
                return;
            }
            await DataHandler.update({ treasury: data.treasury - amount });
            ui.notifications.info(`Снято ${amount} зм из казны.`);
            let message = `
                <div style="
                    border: 3px solid #e74c3c; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #fdedec 0%, #fadbd8 100%); 
                    border-radius: 15px; 
                    margin: 15px 0; 
                    box-shadow: 0 6px 12px rgba(231, 76, 60, 0.3);
                ">
                    <h5 style="color: #c0392b; margin: 0 0 15px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                        <span style="font-size: 2em;">💸</span>
                        Снятие из казны
                    </h5>
                    
                    <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.3em; color: #c0392b; font-weight: bold;">
                            Снято: ${amount} зм
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 12px; color: #a93226; font-weight: 500; font-size: 1em;">
                        📤 Средства изъяты из казны
                    </div>
                </div>
            `;
            ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            await this._logToJournal(message);
        }
    }

    async _promptTreasuryAmount(title, label) {
        return new Promise(resolve => {
            new Dialog({
                title,
                content: `<form><div class="form-group"><label>${label}</label><input type="number" name="amount" value="0" min="0"></div></form>`,
                buttons: {
                    ok: { label: "OK", callback: html => resolve(Number(html.find('[name="amount"]').val()) || 0) },
                    cancel: { label: "Отмена", callback: () => resolve(0) }
                }
            }).render(true);
        });
    }

    async _onRollCheckDialog(ev) {
        const type = ev.currentTarget.dataset.type;
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses[type];
        const rerollInfo = DataHandler.getRerollForCheck(data, type);

        // Try to use PF2e System Roll if available
        if (game.pf2e && game.pf2e.Check) {
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({ label: p.label, modifier: p.value, type: "untyped" }));
            // We use 'untyped' to allow stacking usually, or maybe 'circumstance'/'status'?
            // Standard PF2e stacking rules apply if we use proper types. 
            // For simplicity, let's trust the calculated total or pass parts.
            // If we assume parts are pre-calculated to stack, 'untyped' ensures they all apply.
            // But wait, parts include "Focus", "Secondary". These are typed bonuses.
            // If I pass them all as untyped, they stack.
            // However, parts are already summed into total. So passing them as untyped is fine.

            await game.pf2e.Check.roll(
                new game.pf2e.CheckModifier(CHECK_LABELS[type], { modifiers }),
                { actor: game.user.character, type: 'skill-check', createMessage: true, skipDialog: false },
                ev
            );
            return;
        }

        let content = `<form>
            <div class="form-group">
                <label>Базовый бонус (${CHECK_LABELS[type]}):</label>
                <input type="number" value="${checkBonus.total}" disabled>
            </div>
            <div class="form-group">
                <label>Дополнительный модификатор:</label>
                <input type="number" name="modifier" value="0">
            </div>
            <p><small>Из чего состоит бонус:</small></p>
            <ul>
                ${checkBonus.parts.map(p => `<li>${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}</li>`).join('')}
            </ul>
            ${rerollInfo.available ? `<p style="color:green"><strong>${rerollInfo.allyName}</strong> позволяет переброс этой проверки (1 раз в неделю)</p>` : ''}
        </form>`;

        const executeRoll = async (html, useReroll = false) => {
            const mod = parseInt(html.find('[name="modifier"]').val()) || 0;
            const totalBonus = checkBonus.total + mod;
            const roll = new Roll("1d20");
            await roll.evaluate();
            let total = roll.total + totalBonus;
            let rerollUsed = false;
            let rerollResult = null;

            // If this was a reroll, mark it as used
            if (useReroll) {
                await DataHandler.useReroll(DataHandler.get(), type);
                rerollUsed = true;
            }

            let messageContent = `<h5>Проверка: ${CHECK_LABELS[type]}</h5>
                <p>1d20 (${roll.total}) + ${totalBonus} (${mod !== 0 ? 'мод. ' + mod : 'бонус'}) = <strong>${total}</strong></p>
                <ul>
                    ${checkBonus.parts.map(p => `<li>${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}</li>`).join('')}
                    ${mod !== 0 ? `<li>Дополнительно: ${mod}</li>` : ''}
                </ul>`;

            if (useReroll) {
                messageContent += `<p style="color:blue">Результат переброса (${rerollInfo.allyName})</p>`;
            }

            // Check if reroll is still available after this roll (only if not using reroll)
            const currentData = DataHandler.get();
            const currentRerollInfo = DataHandler.getRerollForCheck(currentData, type);
            if (!useReroll && currentRerollInfo.available) {
                messageContent += `<div style="margin-top:10px;">
                    <button class="rebellion-reroll-btn" data-type="${type}" data-bonus="${totalBonus}" style="background: #336699; color: white; cursor: pointer;">
                        Переброс (${currentRerollInfo.allyName})
                    </button>
                </div>`;
            }

            ChatMessage.create({
                content: messageContent,
                speaker: ChatMessage.getSpeaker(),
                flags: {
                    pf2e: {
                        context: {
                            type: "skill-check",
                            skill: type
                        }
                    },
                    rebellionReroll: { type, bonus: totalBonus, available: !useReroll && currentRerollInfo.available }
                }
            });
        };

        new Dialog({
            title: `Проверка: ${CHECK_LABELS[type]}`,
            content,
            buttons: {
                roll: {
                    label: "Бросок",
                    callback: async (html) => executeRoll(html, false)
                }
            },
            default: "roll"
        }).render(true);
    }

    // === MAINTENANCE START PHASE HANDLERS ===

    async _onMaintenanceRecoverDisabled() {
        const data = DataHandler.get();
        // Исключаем команды с canAutoRecover - они восстановятся сами
        const disabledTeams = data.teams.filter(t => t.disabled && !t.missing && !t.canAutoRecover);
        
        if (disabledTeams.length === 0) {
            const autoRecoverTeams = data.teams.filter(t => t.disabled && !t.missing && t.canAutoRecover);
            if (autoRecoverTeams.length > 0) {
                ui.notifications.info(`Нет команд для восстановления за золото. ${autoRecoverTeams.length} команд(ы) восстановятся автоматически на следующей неделе.`);
            } else {
                ui.notifications.info("Нет недееспособных команд для восстановления.");
            }
            return;
        }

        // Разделяем команды на обычные и недееспособные из-за события
        const regularDisabledTeams = disabledTeams.filter(t => !t.disabledByEvent);
        const eventDisabledTeams = disabledTeams.filter(t => t.disabledByEvent);
        
        const maintenanceSettings = data.maintenanceSettings || { teamRestoreCost: 10 };
        const regularCostPerTeam = maintenanceSettings.teamRestoreCost;
        const eventCostPerTeam = DataHandler.getMinTreasury(data); // Стоимость равна минимальной казне

        // Создаем список команд с галочками
        let teamsCheckboxes = "";
        
        regularDisabledTeams.forEach((team, index) => {
            const def = getTeamDefinition(team.type);
            teamsCheckboxes += `
                <div style="margin: 5px 0; display: flex; align-items: center;">
                    <input type="checkbox" id="regular_${index}" checked style="margin-right: 8px;">
                    <label for="regular_${index}" style="flex: 1;">${def.label} (${regularCostPerTeam} зм)</label>
                </div>
            `;
        });
        
        eventDisabledTeams.forEach((team, index) => {
            const def = getTeamDefinition(team.type);
            teamsCheckboxes += `
                <div style="margin: 5px 0; display: flex; align-items: center;">
                    <input type="checkbox" id="event_${index}" checked style="margin-right: 8px;">
                    <label for="event_${index}" style="flex: 1;">${def.label} (${eventCostPerTeam} зм - из события)</label>
                </div>
            `;
        });

        // Создаем диалог с галочками
        const result = await new Promise((resolve) => {
            new Dialog({
                title: "Восстановление недееспособных команд",
                content: `
                    <div style="margin-bottom: 15px;">
                        <p>Выберите команды для восстановления:</p>
                        <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0; max-height: 300px; overflow-y: auto;">
                            ${teamsCheckboxes}
                        </div>
                        <div style="margin-top: 10px;">
                            <button type="button" id="select-all" style="margin-right: 10px;">Выбрать все</button>
                            <button type="button" id="deselect-all">Снять все</button>
                        </div>
                        <p><strong>В казне:</strong> ${data.treasury} зм</p>
                        <p id="cost-display"><strong>Стоимость:</strong> Рассчитывается...</p>
                    </div>
                `,
                buttons: {
                    recover: {
                        label: "Восстановить",
                        callback: (html) => {
                            const selectedTeams = [];
                            
                            // Собираем выбранные обычные команды
                            regularDisabledTeams.forEach((team, index) => {
                                if (html.find(`#regular_${index}`).is(':checked')) {
                                    selectedTeams.push({
                                        team: team,
                                        cost: regularCostPerTeam,
                                        type: 'regular'
                                    });
                                }
                            });
                            
                            // Собираем выбранные команды из события
                            eventDisabledTeams.forEach((team, index) => {
                                if (html.find(`#event_${index}`).is(':checked')) {
                                    selectedTeams.push({
                                        team: team,
                                        cost: eventCostPerTeam,
                                        type: 'event'
                                    });
                                }
                            });
                            
                            resolve(selectedTeams);
                        }
                    },
                    cancel: {
                        label: "Отмена",
                        callback: () => resolve(null)
                    }
                },
                render: (html) => {
                    // Функция обновления стоимости
                    const updateCost = () => {
                        let totalCost = 0;
                        regularDisabledTeams.forEach((team, index) => {
                            if (html.find(`#regular_${index}`).is(':checked')) {
                                totalCost += regularCostPerTeam;
                            }
                        });
                        eventDisabledTeams.forEach((team, index) => {
                            if (html.find(`#event_${index}`).is(':checked')) {
                                totalCost += eventCostPerTeam;
                            }
                        });
                        
                        const costDisplay = html.find('#cost-display');
                        if (totalCost > data.treasury) {
                            costDisplay.html(`<strong style="color: red;">Стоимость: ${totalCost} зм (недостаточно золота!)</strong>`);
                        } else {
                            costDisplay.html(`<strong>Стоимость: ${totalCost} зм</strong>`);
                        }
                    };
                    
                    // Обработчики событий
                    html.find('input[type="checkbox"]').change(updateCost);
                    html.find('#select-all').click(() => {
                        html.find('input[type="checkbox"]').prop('checked', true);
                        updateCost();
                    });
                    html.find('#deselect-all').click(() => {
                        html.find('input[type="checkbox"]').prop('checked', false);
                        updateCost();
                    });
                    
                    // Первоначальный расчет стоимости
                    updateCost();
                }
            }).render(true);
        });

        if (!result || result.length === 0) return;

        // Проверяем достаточность средств
        const totalCost = result.reduce((sum, item) => sum + item.cost, 0);
        if (data.treasury < totalCost) {
            ui.notifications.warn(`Недостаточно золота! Нужно ${totalCost} зм, а в казне ${data.treasury} зм.`);
            return;
        }

        // Восстанавливаем выбранные команды
        const teams = JSON.parse(JSON.stringify(data.teams));
        let recoveredCount = 0;
        
        result.forEach(item => {
            const teamIndex = teams.findIndex(t => t === item.team || (t.type === item.team.type && t.disabled));
            if (teamIndex !== -1) {
                teams[teamIndex].disabled = false;
                teams[teamIndex].disabledByEvent = false;
                recoveredCount++;
            }
        });

        await DataHandler.update({ 
            teams, 
            treasury: data.treasury - totalCost 
        });

        // Создаем красивое сообщение
        const recoveredTeamNames = result.map(item => {
            const def = getTeamDefinition(item.team.type);
            return def.label;
        }).join(', ');
        
        const message = `
            <div style="
                border: 3px solid #4caf50; 
                padding: 20px; 
                background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%); 
                border-radius: 15px; 
                margin: 15px 0; 
                box-shadow: 0 6px 12px rgba(76, 175, 80, 0.3);
            ">
                <h5 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                    <span style="font-size: 2em;">🔧</span>
                    Восстановление недееспособных команд
                </h5>
                
                <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                    <div style="font-size: 1.2em; color: #2e7d32; font-weight: bold; margin-bottom: 10px;">
                        Восстановлено команд: ${recoveredCount}
                    </div>
                    <div style="color: #388e3c;">
                        ${recoveredTeamNames}
                    </div>
                </div>
                
                <div style="background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="color: #d32f2f; font-weight: bold; margin-bottom: 8px;">
                        Потрачено: ${totalCost} зм
                    </div>
                    <div style="color: #666; margin-top: 5px;">
                        Остаток в казне: ${data.treasury - totalCost} зм
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 12px; color: #2e7d32; font-weight: 600; font-size: 1.1em;">
                    Команды готовы к действию!
                </div>
            </div>
        `;

        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
        
        ui.notifications.info(`Восстановлено ${recoveredCount} команд за ${totalCost} зм.`);
    }

    async _onMaintenanceHandleMissing() {
        const data = DataHandler.get();
        const missingTeams = data.teams.filter(t => t.missing);
        
        if (missingTeams.length === 0) {
            ui.notifications.info("Нет пропавших команд для обработки.");
            return;
        }

        // Create dialog to choose action for each missing team
        let content = `
            <div style="margin-bottom: 15px;">
                <h5>Обработка пропавших команд</h5>
                <p>Выберите действие для каждой пропавшей команды:</p>
            </div>
        `;

        missingTeams.forEach((team, index) => {
            const def = getTeamDefinition(team.type);
            content += `
                <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #ff9800;">
                    <h5 style="margin: 0 0 10px 0; color: #e65100;">${def.label}</h5>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label style="margin: 0;">
                            <input type="radio" name="action_${index}" value="search" checked>
                            Искать (проверка Безопасности)
                        </label>
                        <label style="margin: 0;">
                            <input type="radio" name="action_${index}" value="abandon">
                            Списать как потерянную
                        </label>
                    </div>
                </div>
            `;
        });

        const result = await new Promise(resolve => {
            new Dialog({
                title: "Обработка пропавших команд",
                content: `<form>${content}</form>`,
                buttons: {
                    ok: { 
                        label: "Выполнить", 
                        callback: html => {
                            const actions = {};
                            missingTeams.forEach((team, index) => {
                                const action = html.find(`input[name="action_${index}"]:checked`).val();
                                actions[index] = action;
                            });
                            resolve(actions);
                        }
                    },
                    cancel: { label: "Отмена", callback: () => resolve(null) }
                }
            }).render(true);
        });

        if (!result) return;

        // Process each team based on chosen action
        const teams = JSON.parse(JSON.stringify(data.teams));
        const bonuses = DataHandler.getRollBonuses(data);
        let messages = [];

        for (let i = 0; i < missingTeams.length; i++) {
            const team = missingTeams[i];
            const action = result[i];
            const def = getTeamDefinition(team.type);
            const teamIndex = teams.findIndex(t => t.type === team.type && t.missing);

            if (action === 'search') {
                // Perform security check to find the team
                const roll = new Roll("1d20");
                await roll.evaluate();
                const total = roll.total + bonuses.security.total;
                const success = total >= 15; // DC 15 for finding missing teams
                const critFail = roll.total === 1;

                if (success) {
                    teams[teamIndex].missing = false;
                    teams[teamIndex].disabled = true; // Found but can't act this week
                    teams[teamIndex].canAutoRecover = true; // Can recover automatically next week (rescued)
                    messages.push(`
                        <div style="color: #2e7d32; margin: 10px 0; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 5px;">
                            <strong>${def.label}</strong><br>
                            Проверка Безопасности: 1d20(${roll.total}) + ${bonuses.security.total} = ${total} ≥ 15<br>
                            <em>Команда найдена! Недееспособна до следующей недели.</em>
                        </div>
                    `);
                } else if (critFail) {
                    // Critical failure - team is lost permanently
                    teams.splice(teamIndex, 1);
                    messages.push(`
                        <div style="color: #b71c1c; margin: 10px 0; padding: 10px; background: rgba(244, 67, 54, 0.1); border-radius: 5px;">
                            <strong>${def.label}</strong><br>
                            Проверка Безопасности: 1d20(${roll.total}) + ${bonuses.security.total} = ${total}<br>
                            <em>Критический провал! Команда потеряна навсегда.</em>
                        </div>
                    `);
                } else {
                    messages.push(`
                        <div style="color: #d32f2f; margin: 10px 0; padding: 10px; background: rgba(244, 67, 54, 0.1); border-radius: 5px;">
                            <strong>${def.label}</strong><br>
                            Проверка Безопасности: 1d20(${roll.total}) + ${bonuses.security.total} = ${total} < 15<br>
                            <em>Команда не найдена. Остается пропавшей.</em>
                        </div>
                    `);
                }
            } else if (action === 'abandon') {
                // Remove team permanently
                teams.splice(teamIndex, 1);
                messages.push(`
                    <div style="color: #666; margin: 10px 0; padding: 10px; background: rgba(158, 158, 158, 0.1); border-radius: 5px;">
                        <strong>${def.label}</strong><br>
                        <em>Команда списана как потерянная.</em>
                    </div>
                `);
            }
        }

        await DataHandler.update({ teams });

        // Create summary message
        const summaryMessage = `
            <div style="
                border: 3px solid #ff9800; 
                padding: 20px; 
                background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); 
                border-radius: 15px; 
                margin: 15px 0; 
                box-shadow: 0 6px 12px rgba(255, 152, 0, 0.3);
            ">
                <h5 style="color: #e65100; margin: 0 0 15px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                    Обработка пропавших команд
                </h5>
                
                <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px;">
                    ${messages.join('')}
                </div>
            </div>
        `;

        ChatMessage.create({ content: summaryMessage, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(summaryMessage);
    }

    async _onMaintenanceHandleEvents() {
        const data = DataHandler.get();
        
        // Handle maintenance phase events
        let messages = [];
        let hasEvents = false;

        // Check for persistent events that need maintenance phase processing
        if (data.activeEvents) {
            const maintenanceEvents = data.activeEvents.filter(event => 
                event.isPersistent && 
                (event.name.includes('Болезнь') || 
                 event.name.includes('Недееспособн') || 
                 event.name.includes('Пропавш'))
            );

            for (const event of maintenanceEvents) {
                hasEvents = true;
                messages.push(`
                    <div style="color: #7b1fa2; margin: 10px 0; padding: 10px; background: rgba(156, 39, 176, 0.1); border-radius: 5px;">
                        <strong>📅 ${event.name}</strong><br>
                        <em>Эффект: ${event.effect}</em><br>
                        <small>Активно с недели ${event.weekStarted}</small>
                    </div>
                `);
            }

            // Check for imprisoned traitor events
            const imprisonedTraitorEvents = (data.events || []).filter(event => 
                event.name === "Предатель в тюрьме" && event.needsSecrecyCheck
            );

            for (const event of imprisonedTraitorEvents) {
                hasEvents = true;
                const traitorTeamDef = getTeamDefinition(event.traitorTeam);
                messages.push(`
                    <div style="margin: 10px 0; padding: 10px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 5px;">
                        <strong>Предатель в тюрьме</strong><br>
                        <em>Предатель из команды ${traitorTeamDef.label} заключен в тюрьму</em><br>
                        
                        <p><strong>Проверка содержания:</strong></p>
                        <button class="traitor-prison-secrecy-btn" 
                                data-event-index="${(data.events || []).indexOf(event)}"
                                data-team-type="${event.traitorTeam}"
                                style="background: #f44336; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                            Проверка Секретности (КС 20)
                        </button>
                        <small style="display: block; margin-top: 5px;">При провале: предатель сбегает, +2d6 Известность</small>
                        
                        <p style="margin-top: 15px;"><strong>Действия с предателем:</strong></p>
                        <div style="margin: 5px 0;">
                            <button class="traitor-persuade-btn" 
                                    data-event-index="${(data.events || []).indexOf(event)}"
                                    data-team-type="${event.traitorTeam}"
                                    style="background: #4caf50; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                Переубедить
                            </button>
                            <button class="traitor-execute-from-prison-btn" 
                                    data-event-index="${(data.events || []).indexOf(event)}"
                                    data-team-type="${event.traitorTeam}"
                                    style="background: #f44336; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                Казнить
                            </button>
                            <button class="traitor-exile-from-prison-btn" 
                                    data-event-index="${(data.events || []).indexOf(event)}"
                                    data-team-type="${event.traitorTeam}"
                                    style="background: #ff9800; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                                Изгнать
                            </button>
                        </div>
                    </div>
                `);
            }
        }

        // Check for supporters bonus from persuaded traitor (only if active this week)
        const supportersBonusEvents = (data.events || []).filter(event => 
            event.name === "Бонус от переубеждения" && 
            event.needsSupportersCollection &&
            event.weekStarted <= data.week // Событие активно с указанной недели
        );

        for (const event of supportersBonusEvents) {
            hasEvents = true;
            messages.push(`
                <div style="margin: 10px 0; padding: 10px; background: #e8f5e8; border: 1px solid #4caf50; border-radius: 5px;">
                    <strong>Бонус от переубеждения предателя</strong><br>
                    <em>Готов к получению: +${event.supportersBonus} сторонников</em><br>
                    
                    <p><strong>Получить сторонников:</strong></p>
                    <button class="collect-supporters-bonus-btn" 
                            data-event-index="${(data.events || []).indexOf(event)}"
                            data-supporters-bonus="${event.supportersBonus}"
                            style="background: #4caf50; color: white; margin: 2px; padding: 5px 10px; border: none; cursor: pointer;">
                        Получить +${event.supportersBonus} сторонников
                    </button>
                    <small style="display: block; margin-top: 5px;">Можно получить только один раз</small>
                </div>
            `);
        }

        // Check for ally effects that trigger at maintenance phase start
        const allyEffects = [];
        
        // Rexus effect is handled in attrition step, but we can mention it here
        if (DataHandler.isAllyActive(data, 'rexus') && (data.notoriety || 0) > 0) {
            allyEffects.push("Рексус снизит Известность на 1 в шаге убыли сторонников");
        }
        
        // Hetamon effect - happens immediately at start of maintenance phase
        if (DataHandler.isAllyActive(data, 'hetamon')) {
            const hRoll = new Roll("1d6");
            await hRoll.evaluate();
            const hVal = hRoll.total || 0;
            const oldNotoriety = data.notoriety || 0;
            const newNotoriety = Math.max(0, oldNotoriety - hVal);
            await DataHandler.update({ notoriety: newNotoriety });
            allyEffects.push(`Хетамон: -${hVal} Известность (${oldNotoriety} → ${newNotoriety})`);
        }

        if (allyEffects.length > 0) {
            hasEvents = true;
            messages.push(`
                <div style="color: #2e7d32; margin: 10px 0; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 5px;">
                    <strong>Эффекты союзников:</strong><br>
                    ${allyEffects.map(effect => `• ${effect}`).join('<br>')}
                </div>
            `);
        }

        if (!hasEvents) {
            ui.notifications.info("Нет событий для обработки в начале фазы содержания.");
            return;
        }

        // Create summary message
        const summaryMessage = `
            <div style="
                border: 3px solid #9c27b0; 
                padding: 20px; 
                background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); 
                border-radius: 15px; 
                margin: 15px 0; 
                box-shadow: 0 6px 12px rgba(156, 39, 176, 0.3);
            ">
                <h5 style="color: #7b1fa2; margin: 0 0 15px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                    <span style="font-size: 2em;">📅</span>
                    События начала фазы содержания
                </h5>
                
                <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px;">
                    ${messages.join('')}
                </div>
                
                <div style="text-align: center; margin-top: 12px; color: #7b1fa2; font-weight: 600; font-size: 1.1em;">
                    Подготовка к основным шагам фазы содержания
                </div>
            </div>
        `;

        ChatMessage.create({ content: summaryMessage, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(summaryMessage);
    }

    async _onAutomatedEventPhase() {
        const data = DataHandler.get();
        const chance = DataHandler.getEventChance(data);
        const roll = new Roll("1d100");
        await roll.evaluate();
        const d100 = roll.total || 0;
        const eventHappens = d100 <= chance;

        let message = `<h5>Фаза Событий</h5>
            <p>Шанс: <strong>${chance}%</strong> ${data.weeksWithoutEvent > 0 ? '(×2 за тихую неделю)' : ''}</p>
            <p>Бросок: <strong>${d100}</strong></p>
            <p style="color:${eventHappens ? 'red' : 'green'}"><strong>${eventHappens ? 'СОБЫТИЕ ПРОИСХОДИТ!' : 'Событий нет'}</strong></p>`;

        if (!eventHappens) {
            // Проверяем, активно ли событие "Все спокойно"
            const allCalmActive = DataHandler.isEventActive(data, "Все спокойно");
            
            if (allCalmActive) {
                message = `<h5>Фаза Событий</h5>
                    <p><strong>Все спокойно</strong> - событий нет на этой неделе</p>
                    <p style="color:green">Эффект "Все спокойно" предотвращает события</p>`;
            }
            
            await DataHandler.update({ weeksWithoutEvent: data.weeksWithoutEvent + 1 });
            ChatMessage.create({
                content: message,
                speaker: ChatMessage.getSpeaker()
            });
            return;
        }

        // Проверяем, активно ли "Манипулирование событиями" от Каббалистов
        const manipulateEvent = data.events?.find(e => 
            e.name === "Манипулирование событиями" && 
            e.allowEventChoice && 
            (e.weekStarted || 0) <= (data.week || 0)
        );

        if (manipulateEvent) {
            // Каббалисты манипулируют событиями - бросаем дважды и даем выбор
            await this._rollManipulatedEvents(data, message, manipulateEvent);
        } else {
            // Обычное событие
            await this._rollAndProcessEvent(data, message);
        }
    }

    /**
     * Обработка манипулирования событиями от Каббалистов
     * ГМ бросает дважды, командир выбирает результат
     */
    async _rollManipulatedEvents(data, initialMessage, manipulateEvent) {
        const effectiveDanger = DataHandler.getEffectiveDanger(data);
        const charismaBonus = manipulateEvent.charismaBonus || 0;
        const managerName = manipulateEvent.managerName || "Командир каббалистов";
        
        // Первый бросок
        const roll1 = new Roll(`1d100 + ${effectiveDanger}`);
        await roll1.evaluate();
        const evRoll1 = roll1.total || 0;
        let event1 = EVENT_TABLE.find(e => evRoll1 >= e.min && evRoll1 <= e.max) || EVENT_TABLE[EVENT_TABLE.length - 1];
        
        // Если первое событие "Бросьте дважды", перебрасываем
        if (event1.name === "Бросьте дважды") {
            const reroll1 = new Roll(`1d100 + ${effectiveDanger}`);
            await reroll1.evaluate();
            const rerollResult1 = reroll1.total || 0;
            event1 = EVENT_TABLE.find(e => rerollResult1 >= e.min && rerollResult1 <= e.max && e.name !== "Бросьте дважды") || EVENT_TABLE[0];
        }
        
        // Второй бросок
        const roll2 = new Roll(`1d100 + ${effectiveDanger}`);
        await roll2.evaluate();
        const evRoll2 = roll2.total || 0;
        let event2 = EVENT_TABLE.find(e => evRoll2 >= e.min && evRoll2 <= e.max) || EVENT_TABLE[EVENT_TABLE.length - 1];
        
        // Если второе событие "Бросьте дважды", перебрасываем
        if (event2.name === "Бросьте дважды") {
            const reroll2 = new Roll(`1d100 + ${effectiveDanger}`);
            await reroll2.evaluate();
            const rerollResult2 = reroll2.total || 0;
            event2 = EVENT_TABLE.find(e => rerollResult2 >= e.min && rerollResult2 <= e.max && e.name !== "Бросьте дважды") || EVENT_TABLE[0];
        }
        
        // Сохраняем оба события для выбора
        const pendingEvents = JSON.parse(JSON.stringify(data.events || []));
        
        // Удаляем использованный эффект манипулирования
        const manipulateIndex = pendingEvents.findIndex(e => 
            e.name === "Манипулирование событиями" && e.allowEventChoice
        );
        if (manipulateIndex !== -1) {
            pendingEvents.splice(manipulateIndex, 1);
        }
        
        // Добавляем ожидающий выбор события
        pendingEvents.push({
            name: "Ожидание выбора события",
            desc: "Каббалисты манипулируют событиями. Выберите одно из двух событий.",
            weekStarted: data.week,
            duration: 0, // Мгновенное - удалится после выбора
            isPersistent: false,
            isActionEffect: true,
            pendingEventChoice: true,
            event1: event1,
            event2: event2,
            roll1: evRoll1,
            roll2: evRoll2,
            charismaBonus: charismaBonus,
            managerName: managerName
        });
        
        await DataHandler.update({ events: pendingEvents });
        
        // Формируем сообщение с двумя кнопками выбора
        let message = initialMessage;
        message += `<hr>
            <div style="
                border: 3px solid #9c27b0; 
                padding: 15px; 
                background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); 
                border-radius: 12px; 
                margin: 10px 0;
            ">
                <h5 style="color: #7b1fa2; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
                    Манипулирование событиями (Каббалисты)
                </h5>
                <p style="margin-bottom: 15px;">
                    <strong>${managerName}</strong> манипулирует событиями. Выберите одно из двух выпавших событий:
                    ${charismaBonus > 0 ? `<br><em style="color: #7b1fa2;">При вредном событии можно добавить +${charismaBonus} (Харизма) к броскам d20.</em>` : ''}
                </p>
                
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="
                        flex: 1; 
                        min-width: 200px; 
                        background: ${event1.positive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}; 
                        padding: 12px; 
                        border-radius: 8px;
                        border: 2px solid ${event1.positive ? '#4caf50' : '#f44336'};
                    ">
                        <h5 style="color: ${event1.positive ? '#2e7d32' : '#c62828'}; margin: 0 0 8px 0;">
                            Событие 1: ${event1.name}
                        </h5>
                        <p style="font-size: 0.9em; margin: 0 0 8px 0;">Бросок: ${evRoll1}</p>
                        <p style="font-size: 0.9em; margin: 0 0 12px 0;">${event1.desc}</p>
                        <button class="manipulate-choose-event-btn" 
                                data-event-index="1"
                                data-event-name="${event1.name}"
                                style="
                                    background: ${event1.positive ? '#4caf50' : '#f44336'}; 
                                    color: white; 
                                    border: none; 
                                    padding: 8px 16px; 
                                    border-radius: 6px; 
                                    cursor: pointer;
                                    width: 100%;
                                ">
                            Выбрать это событие
                        </button>
                    </div>
                    
                    <div style="
                        flex: 1; 
                        min-width: 200px; 
                        background: ${event2.positive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}; 
                        padding: 12px; 
                        border-radius: 8px;
                        border: 2px solid ${event2.positive ? '#4caf50' : '#f44336'};
                    ">
                        <h5 style="color: ${event2.positive ? '#2e7d32' : '#c62828'}; margin: 0 0 8px 0;">
                            ${event2.positive ? '✅' : '⚠️'} Событие 2: ${event2.name}
                        </h5>
                        <p style="font-size: 0.9em; margin: 0 0 8px 0;">Бросок: ${evRoll2}</p>
                        <p style="font-size: 0.9em; margin: 0 0 12px 0;">${event2.desc}</p>
                        <button class="manipulate-choose-event-btn" 
                                data-event-index="2"
                                data-event-name="${event2.name}"
                                style="
                                    background: ${event2.positive ? '#4caf50' : '#f44336'}; 
                                    color: white; 
                                    border: none; 
                                    padding: 8px 16px; 
                                    border-radius: 6px; 
                                    cursor: pointer;
                                    width: 100%;
                                ">
                            Выбрать это событие
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
    }

    async _rollAndProcessEvent(data, initialMessage = "", isRecursive = false) {
        const effectiveDanger = DataHandler.getEffectiveDanger(data);
        const roll = new Roll(`1d100 + ${effectiveDanger}`);
        await roll.evaluate();
        const evRoll = roll.total || 0;
        const event = EVENT_TABLE.find(e => evRoll >= e.min && evRoll <= e.max) || EVENT_TABLE[EVENT_TABLE.length - 1];

        let message = initialMessage;
        if (message) message += "<hr>";
        
        message += `<h5>📜 ${event.name}</h5>
            <p>Бросок: 1d100 + ${effectiveDanger} (Опасность) = <strong>${evRoll}</strong></p>
            <p>${event.desc}</p>`;

        // Проверяем иммунитеты союзников
        if (event.name === "Усиленные патрули" && DataHandler.isAllyActive(data, 'cassius')) {
            const bonusRoll = new Roll("3d6");
            await bonusRoll.evaluate();
            const bonus = bonusRoll.total || 0;
            await DataHandler.update({ supporters: data.supporters + bonus, weeksWithoutEvent: 0 });
            message += `<p style="color:green"><strong>Кассий предотвратил! +${bonus} сторонников</strong></p>`;
        } else if (event.name === "Низкий боевой дух" && DataHandler.isAllyActive(data, 'octavio')) {
            await DataHandler.update({ weeksWithoutEvent: 0 });
            message += `<p style="color:green"><strong>Октавио предотвратил!</strong></p>`;
        } else if (event.name === "Болезнь" && DataHandler.isAllyActive(data, 'hetamon')) {
            await DataHandler.update({ weeksWithoutEvent: 0 });
            message += `<p style="color:green"><strong>Хетамон предотвратил!</strong></p>`;
        } else {
            // Применяем эффекты события
            message += await this._applyEventEffects(event, data);
            
            // Если событие "Бросьте дважды", заменяем его двумя случайными событиями
            if (event.name === "Бросьте дважды") {
                console.log("🎲 Обнаружено событие 'Бросьте дважды', генерируем два случайных события...");
                
                // Заменяем сообщение о "Бросьте дважды" на информацию о двух событиях
                message = message.replace(
                    `<h5>📜 ${event.name}</h5>
            <p>Бросок: 1d100 + ${effectiveDanger} (Опасность) = <strong>${evRoll}</strong></p>
            <p>${event.desc}</p>`,
                    `<h5>📜 ${event.name}</h5>
            <p>Бросок: 1d100 + ${effectiveDanger} (Опасность) = <strong>${evRoll}</strong></p>
            <p>${event.desc}</p>
            <p style="color:blue"><strong>Генерируем два случайных события:</strong></p>`
                );
                
                // Первое событие
                message += "<hr>";
                const firstEventMessage = await this._rollSecondEvent(data);
                console.log("🎲 Первое событие сгенерировано:", firstEventMessage);
                message += firstEventMessage;
                
                // Второе событие
                message += "<hr>";
                const secondEventMessage = await this._rollSecondEvent(data);
                console.log("🎲 Второе событие сгенерировано:", secondEventMessage);
                message += secondEventMessage;
            }
        }

        // Сбрасываем счетчик недель без событий только в основном вызове
        if (!isRecursive) {
            await DataHandler.update({ weeksWithoutEvent: 0 });
        }

        // Создаем сообщение в чате только для основного вызова, не для рекурсивного
        if (!isRecursive) {
            console.log("💬 Отправляем итоговое сообщение в чат. Длина:", message.length);
            console.log("💬 Содержимое сообщения:", message);
            ChatMessage.create({
                content: message,
                speaker: ChatMessage.getSpeaker()
            });
        }

        return message;
    }

    async _rollSecondEvent(data) {
        console.log("🎲 _rollSecondEvent вызван с данными:", data);
        // Создаем таблицу событий без "Бросьте дважды" для второго события
        const filteredEventTable = EVENT_TABLE.filter(e => e.name !== "Бросьте дважды");
        console.log("🎲 Отфильтрованная таблица событий (без 'Бросьте дважды'):", filteredEventTable.length, "событий");
        
        const effectiveDanger2 = DataHandler.getEffectiveDanger(data);
        const roll = new Roll(`1d100 + ${effectiveDanger2}`);
        await roll.evaluate();
        const evRoll = roll.total || 0;
        console.log("🎲 Бросок для второго события:", evRoll);
        
        // Находим событие в отфильтрованной таблице
        // Нужно пересчитать диапазоны для отфильтрованной таблицы
        let adjustedRoll = evRoll;
        
        // Если бросок попадает в диапазон "Бросьте дважды" (49-51), перебрасываем
        if (evRoll >= 49 && evRoll <= 51) {
            const reroll = new Roll(`1d100 + ${effectiveDanger2}`);
            await reroll.evaluate();
            adjustedRoll = reroll.total || 0;
            
            // Если снова попали в "Бросьте дважды", берем ближайшее событие
            if (adjustedRoll >= 49 && adjustedRoll <= 51) {
                adjustedRoll = 52; // Берем "Стукач" как следующее событие
            }
        }
        
        const event = EVENT_TABLE.find(e => adjustedRoll >= e.min && adjustedRoll <= e.max) || EVENT_TABLE[EVENT_TABLE.length - 1];
        
        let message = `<h5>📜 ${event.name}</h5>
            <p>Бросок: 1d100 + ${effectiveDanger2} (Опасность) = <strong>${adjustedRoll}</strong></p>
            <p>${event.desc}</p>`;

        // Проверяем иммунитеты союзников для второго события
        if (event.name === "Усиленные патрули" && DataHandler.isAllyActive(data, 'cassius')) {
            const bonusRoll = new Roll("3d6");
            await bonusRoll.evaluate();
            const bonus = bonusRoll.total || 0;
            await DataHandler.update({ supporters: data.supporters + bonus });
            message += `<p style="color:green"><strong>Кассий предотвратил! +${bonus} сторонников</strong></p>`;
        } else if (event.name === "Низкий боевой дух" && DataHandler.isAllyActive(data, 'octavio')) {
            message += `<p style="color:green"><strong>Октавио предотвратил!</strong></p>`;
        } else if (event.name === "Болезнь" && DataHandler.isAllyActive(data, 'hetamon')) {
            message += `<p style="color:green"><strong>Хетамон предотвратил!</strong></p>`;
        } else {
            // Применяем эффекты второго события
            message += await this._applyEventEffects(event, data);
        }

        console.log("🎲 _rollSecondEvent завершен. Возвращаем сообщение:", message);
        return message;
    }

    async _applyEventEffects(event, data) {
        let message = "";

        switch (event.name) {
            case "Неделя Секретности":
                console.log("🎲 ПРИМЕНЕНИЕ СОБЫТИЯ 'Неделя Секретности'");
                console.log("Текущая неделя:", data.week);
                
                // Добавляем событие в активные события на следующую неделю
                const currentEvents = data.events || [];
                if (!currentEvents.find(e => e.name === event.name)) {
                    const newEvent = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: data.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false
                    };
                    
                    console.log("Добавляем событие:", newEvent);
                    currentEvents.push(newEvent);
                    await DataHandler.update({ events: currentEvents });
                    console.log("✅ Событие добавлено в базу");
                } else {
                    console.log("❌ Событие уже существует");
                }
                message += `<p style="color:green"><strong>Неделя Секретности!</strong> +6 к проверкам на след. неделю. Удвоенная вербовка.</p>`;
                break;

            case "Успешный протест":
                const suppRoll = new Roll("2d6");
                await suppRoll.evaluate();
                const gain = suppRoll.total;
                await DataHandler.update({ supporters: data.supporters + gain });
                message += `<p style="color:green"><strong>Успешный протест!</strong> +${gain} сторонников.</p>`;
                break;

            case "Уменьшенная угроза":
                console.log("🎲 ПРИМЕНЕНИЕ СОБЫТИЯ 'Уменьшенная угроза'");
                console.log("Текущая неделя:", data.week);
                
                // Добавляем событие в активные события на следующую неделю
                const currentEvents2 = data.events || [];
                if (!currentEvents2.find(e => e.name === event.name)) {
                    const newEvent2 = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: data.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false,
                        dangerReduction: 10 // Сохраняем значение уменьшения
                    };
                    
                    console.log("Добавляем событие:", newEvent2);
                    currentEvents2.push(newEvent2);
                    await DataHandler.update({ events: currentEvents2 });
                    console.log("✅ Событие добавлено в базу");
                } else {
                    console.log("❌ Событие уже существует");
                }
                message += `<p style="color:green"><strong>Уменьшенная угроза!</strong> Опасность будет снижена на 10 на след. неделю.</p>`;
                break;

            case "Пожертвование":
                const loyaltyRoll = new Roll("1d20");
                await loyaltyRoll.evaluate();
                const loyaltyBonus = DataHandler.getRollBonuses(data).loyalty.total;
                const donation = (loyaltyRoll.total + loyaltyBonus) * 20;
                await DataHandler.update({ treasury: data.treasury + donation });
                message += `<p style="color:green"><strong>Пожертвование!</strong> Казна +${donation} зм.</p>`;
                break;

            case "Рост поддержки":
                const growthRoll = new Roll("2d6");
                await growthRoll.evaluate();
                const growth = growthRoll.total;
                await DataHandler.update({ supporters: data.supporters + growth });
                message += `<p style="color:green"><strong>Рост поддержки!</strong> +${growth} сторонников.</p>`;
                break;

            case "Рыночный бум":
                message += `<p style="color:green"><strong>Рыночный бум!</strong> Новые магические предметы доступны на рынке.</p>`;
                break;

            case "Все спокойно":
                console.log("🎲 ПРИМЕНЕНИЕ СОБЫТИЯ 'Все спокойно'");
                console.log("Текущая неделя:", data.week);
                
                // Добавляем событие в активные события на следующую неделю
                const currentEvents3 = data.events || [];
                if (!currentEvents3.find(e => e.name === event.name)) {
                    const newEvent3 = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: data.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false
                    };
                    
                    console.log("Добавляем событие:", newEvent3);
                    currentEvents3.push(newEvent3);
                    await DataHandler.update({ events: currentEvents3 });
                    console.log("✅ Событие добавлено в базу");
                } else {
                    console.log("❌ Событие уже существует");
                }
                
                // Событие "Все спокойно" предотвращает события на следующую неделю
                // weeksWithoutEvent не изменяем - пусть накапливается для будущих недель
                
                message += `<p style="color:green"><strong>Все спокойно!</strong> +1 Безопасность на след. неделю. Нет события след. неделю.</p>`;
                break;

            case "Стукач":
                message += `<p><strong>Стукач обнаружен!</strong> Один из ваших сторонников сливал информацию врагам. Требуется проверка Верности КС 15.</p>`;
                message += `<button class="roll-stukach-btn" 
                                    data-event="Стукач">
                    🎲 Проверка Верности (КС 15)
                </button>`;
                break;

            case "Соперничество":
                // Проверяем, сколько раз событие произошло в этой фазе (до добавления текущего)
                const rivalryCount = DataHandler.getEventCountThisPhase(data, event.name);
                
                // Добавляем событие в отслеживание текущей фазы
                await DataHandler.addEventToCurrentPhase(data, event.name);
                
                const operationalTeams = data.teams.filter(t => !t.disabled && !t.missing);
                if (operationalTeams.length >= 2) {
                    const teamsToDisable = [];
                    for (let i = 0; i < 2 && operationalTeams.length > 0; i++) {
                        const randomIndex = Math.floor(Math.random() * operationalTeams.length);
                        teamsToDisable.push(operationalTeams[randomIndex]);
                        operationalTeams.splice(randomIndex, 1);
                    }

                    const currentEvents = data.events || [];
                    
                    // Если это второй раз в фазе, делаем существующее соперничество постоянным
                    if (rivalryCount >= 1) {
                        // Находим существующее событие соперничества и делаем его постоянным
                        const existingRivalry = currentEvents.find(e => e.name === "Соперничество");
                        if (existingRivalry) {
                            existingRivalry.duration = 999; // Делаем постоянным
                            existingRivalry.isPersistent = true;
                            existingRivalry.desc = "Постоянное соперничество между командами. Смягчение: Обман, Дипломатия или Запугивание КС 20.";
                            existingRivalry.mitigate = "diplomacy";
                            existingRivalry.dc = 20;
                            // Добавляем новые заблокированные команды к существующим
                            if (!existingRivalry.affectedTeams) existingRivalry.affectedTeams = [];
                            existingRivalry.affectedTeams.push(...teamsToDisable.map(t => t.type));
                        }
                        
                        await DataHandler.update({ events: currentEvents });
                        
                        // Применяем эффекты соперничества и обновляем отображение
                        await DataHandler.applyRivalryEffects(DataHandler.get());
                        this.render(true); // Принудительный полный ререндер для обновления визуального отображения
                        
                        message += `<p style="color:red"><strong>⚠️ ПОСТОЯННОЕ СОПЕРНИЧЕСТВО!</strong></p>`;
                        message += `<p style="color:red">Дополнительные команды ${teamsToDisable.map(t => getTeamDefinition(t.type).label).join(", ")} будут заблокированы со следующей недели!</p>`;
                        message += `<p style="color:red">Соперничество теперь постоянное и не пройдет само по себе.</p>`;
                        // Кнопки смягчения удалены - соперничество теперь постоянное без возможности смягчения
                    } else {
                        // Первое соперничество - создаем временное событие
                        // Начинается со следующей недели и длится одну неделю
                        const temporaryRivalry = {
                            name: "Соперничество",
                            desc: "Временное соперничество между командами. Команды заблокированы со следующей недели.",
                            weekStarted: data.week + 1, // Начинается со следующей недели
                            duration: 1, // Длится одну неделю
                            isPersistent: false,
                            mitigate: "diplomacy",
                            dc: 20,
                            affectedTeams: teamsToDisable.map(t => t.type)
                        };
                        
                        currentEvents.push(temporaryRivalry);
                        await DataHandler.update({ events: currentEvents });
                        
                        // Применяем эффекты соперничества и обновляем отображение
                        await DataHandler.applyRivalryEffects(DataHandler.get());
                        this.render(true); // Принудительный полный ререндер для обновления визуального отображения
                        
                        message += `<p style="color:red"><strong>Соперничество!</strong> Команды ${teamsToDisable.map(t => getTeamDefinition(t.type).label).join(", ")} будут заблокированы со следующей недели.</p>`;
                        message += `<p style="color:#d84315"><strong>Внимание:</strong> Если "Соперничество" выпадет еще раз в этой фазе событий, оно станет постоянным!</p>`;
                        // Кнопки смягчения удалены - временное соперничество проходит само
                    }
                } else {
                    message += `<p style="color:#d84315"><strong>Соперничество!</strong> Недостаточно команд для блокировки.</p>`;
                }
                break;

            case "Опасные времена":
                console.log("🎲 ПРИМЕНЕНИЕ СОБЫТИЯ 'Опасные времена'");
                console.log("Текущая неделя:", data.week);
                
                // Добавляем событие в отслеживание фазы
                await DataHandler.addEventToCurrentPhase(data, "Опасные времена");
                
                // Проверяем количество событий в текущей фазе
                const updatedData = DataHandler.get();
                const eventCount = DataHandler.getEventCountThisPhase(updatedData, "Опасные времена");
                console.log("Количество 'Опасные времена' в фазе:", eventCount);
                
                // Добавляем событие в активные события на следующую неделю (как "Уменьшенная угроза")
                const dangerousEvents = updatedData.events || [];
                if (!dangerousEvents.find(e => e.name === event.name)) {
                    const shouldBePermanent = eventCount >= 2;
                    
                    console.log(`🔧 СОЗДАНИЕ СОБЫТИЯ: updatedData.week=${updatedData.week}, weekStarted будет=${updatedData.week + 1}`);
                    
                    const newEvent = {
                        name: event.name,
                        desc: shouldBePermanent ? 
                            "Постоянные опасные времена. Опасность увеличена на 10. Смягчение: Запугивание КС 20 снижает до +5." :
                            event.desc,
                        weekStarted: updatedData.week + 1, // Начинает действовать со следующей недели
                        duration: shouldBePermanent ? 999 : 1,
                        isPersistent: shouldBePermanent,
                        dangerIncrease: 10, // Сохраняем значение увеличения
                        mitigate: "intimidation",
                        dc: 20
                    };
                    
                    console.log("Добавляем событие:", newEvent);
                    dangerousEvents.push(newEvent);
                    await DataHandler.update({ events: dangerousEvents });
                    console.log("✅ Событие добавлено в базу");
                    
                    if (shouldBePermanent) {
                        message += `<p style="color:red"><strong>Опасные времена стали постоянными!</strong> +10 Опасность навсегда со следующей недели.</p>`;
                    } else {
                        message += `<p style="color:red"><strong>Опасные времена!</strong> Опасность будет увеличена на 10 на след. неделю.</p>`;
                    }
                } else {
                    // Если событие уже существует, проверяем нужно ли сделать его постоянным
                    const existingEvent = dangerousEvents.find(e => e.name === event.name);
                    if (eventCount >= 2 && !existingEvent.isPersistent) {
                        existingEvent.isPersistent = true;
                        existingEvent.duration = 999;
                        existingEvent.desc = "Постоянные опасные времена. Опасность увеличена на 10. Смягчение: Запугивание КС 20 снижает до +5.";
                        
                        await DataHandler.update({ events: dangerousEvents });
                        message += `<p style="color:red"><strong>Опасные времена стали постоянными!</strong> Эффект будет действовать навсегда.</p>`;
                        console.log("✅ Событие стало постоянным");
                    } else {
                        console.log("❌ Событие уже существует");
                        message += `<p style="color:red"><strong>Опасные времена продолжаются!</strong> Эффект уже активен.</p>`;
                    }
                }
                break;

            case "Пропавшие без вести":
                // Выбираем команду, которая была задействована в действии на этой неделе
                const activeTeams = data.teams.filter(t => !t.disabled && !t.missing && t.hasActed);
                if (activeTeams.length > 0) {
                    const randomIndex = Math.floor(Math.random() * activeTeams.length);
                    const teamToLose = activeTeams[randomIndex];

                    const teams = JSON.parse(JSON.stringify(data.teams));
                    const index = teams.findIndex(t => t.type === teamToLose.type);
                    if (index !== -1) teams[index].missing = true;

                    await DataHandler.update({ teams });
                    message += `<p style="color:red"><strong>Пропавшие без вести!</strong> Команда ${getTeamDefinition(teamToLose.type).label}, которая была задействована в действии, пропала без вести.</p>`;
                } else {
                    // Если ни одна команда не была задействована в действии, рассматриваем как "Опасные времена"
                    message += `<p style="color:#d84315"><strong>Пропавшие без вести!</strong> Ни одна команда не была задействована в действии на этой неделе. Рассматривается как "Опасные времена".</p>`;
                    
                    // Вызываем событие "Опасные времена"
                    const dangerousTimesEvent = { name: "Опасные времена", desc: "+10 Опасность. Запугивание КС 20 снижает до +5." };
                    const dangerousMessage = await this._applyEventEffects(dangerousTimesEvent, data);
                    message += dangerousMessage;
                }
                break;

            case "Тайник обнаружен":
                if (data.caches && data.caches.length > 0) {
                    const randomIndex = Math.floor(Math.random() * data.caches.length);
                    const caches = JSON.parse(JSON.stringify(data.caches));
                    caches.splice(randomIndex, 1);
                    await DataHandler.update({ caches });
                    message += `<p style="color:red"><strong>Тайник обнаружен!</strong> Потеря тайника.</p>`;
                } else {
                    const lossRoll = new Roll("1d6");
                    await lossRoll.evaluate();
                    const loss = lossRoll.total;
                    await DataHandler.update({
                        supporters: Math.max(0, data.supporters - loss),
                        population: Math.max(0, data.population - loss)
                    });
                    message += `<p style="color:red"><strong>Тайник обнаружен!</strong> -${loss} сторонников и населения.</p>`;
                }
                break;

            case "Усиленные патрули":
                // Добавляем событие в отслеживание текущей фазы
                await DataHandler.addEventToCurrentPhase(data, event.name);
                
                // Проверяем количество событий в текущей фазе
                const updatedDataPatrols = DataHandler.get();
                const patrolsCount = DataHandler.getEventCountThisPhase(updatedDataPatrols, "Усиленные патрули");
                
                console.log("Количество 'Усиленные патрули' в фазе:", patrolsCount);
                
                // Получаем или создаем список событий
                const patrolsEvents = updatedDataPatrols.events || [];
                const existingPatrolsEvent = patrolsEvents.find(e => e.name === event.name);
                
                if (!existingPatrolsEvent) {
                    // Создаем новое событие (всегда временное при первом выпадении)
                    console.log(`🔧 СОЗДАНИЕ СОБЫТИЯ: updatedDataPatrols.week=${updatedDataPatrols.week}, weekStarted будет=${updatedDataPatrols.week + 1}`);
                    
                    const newEvent = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: updatedDataPatrols.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false,
                        secrecyPenalty: -4, // Сохраняем значение штрафа
                        mitigate: "survival",
                        dc: 20,
                        mitigated: false
                    };
                    
                    patrolsEvents.push(newEvent);
                    await DataHandler.update({ events: patrolsEvents });
                    console.log("✅ Событие добавлено в базу");
                    
                    message += `<p style="color:red"><strong>Усиленные патрули!</strong> Секретность будет снижена на 4 на след. неделю.</p>`;
                } else {
                    // Если событие уже существует и это второе выпадение в фазе, делаем постоянным
                    if (patrolsCount >= 2 && !existingPatrolsEvent.isPersistent) {
                        existingPatrolsEvent.isPersistent = true;
                        existingPatrolsEvent.duration = 999;
                        existingPatrolsEvent.desc = "Постоянные усиленные патрули. -4 Секретность. Смягчение: Выживание КС 20 снижает до -2.";
                        
                        await DataHandler.update({ events: patrolsEvents });
                        message += `<p style="color:red"><strong>Усиленные патрули стали постоянными!</strong> Эффект будет действовать навсегда.</p>`;
                        console.log("✅ Событие стало постоянным");
                    } else {
                        console.log("❌ Событие уже существует");
                        message += `<p style="color:red"><strong>Усиленные патрули продолжаются!</strong> Эффект уже активен.</p>`;
                    }
                }
                break;

            case "Низкий боевой дух":
                // Добавляем событие в отслеживание текущей фазы
                await DataHandler.addEventToCurrentPhase(data, event.name);
                
                // Проверяем количество событий в текущей фазе
                const updatedDataMorale = DataHandler.get();
                const moraleCount = DataHandler.getEventCountThisPhase(updatedDataMorale, "Низкий боевой дух");
                
                console.log("Количество 'Низкий боевой дух' в фазе:", moraleCount);
                
                // Получаем или создаем список событий
                const moraleEvents = updatedDataMorale.events || [];
                const existingMoraleEvent = moraleEvents.find(e => e.name === event.name);
                
                if (!existingMoraleEvent) {
                    // Создаем новое событие (всегда временное при первом выпадении)
                    console.log(`🔧 СОЗДАНИЕ СОБЫТИЯ: updatedDataMorale.week=${updatedDataMorale.week}, weekStarted будет=${updatedDataMorale.week + 1}`);
                    
                    const newEvent = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: updatedDataMorale.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false,
                        loyaltyPenalty: -4, // Сохраняем значение штрафа
                        mitigate: "performance",
                        dc: 20,
                        mitigated: false
                    };
                    
                    moraleEvents.push(newEvent);
                    await DataHandler.update({ events: moraleEvents });
                    console.log("✅ Событие добавлено в базу");
                    
                    message += `<p style="color:red"><strong>Низкий боевой дух!</strong> Верность будет снижена на 4 на след. неделю.</p>`;
                } else {
                    // Если событие уже существует и это второе выпадение в фазе, делаем постоянным
                    if (moraleCount >= 2 && !existingMoraleEvent.isPersistent) {
                        existingMoraleEvent.isPersistent = true;
                        existingMoraleEvent.duration = 999;
                        existingMoraleEvent.desc = "Постоянный низкий боевой дух. -4 Верность. Смягчение: Выступление КС 20 снижает до -2.";
                        
                        await DataHandler.update({ events: moraleEvents });
                        message += `<p style="color:red"><strong>Низкий боевой дух стал постоянным!</strong> Эффект будет действовать навсегда.</p>`;
                        console.log("✅ Событие стало постоянным");
                    } else {
                        console.log("❌ Событие уже существует");
                        message += `<p style="color:red"><strong>Низкий боевой дух продолжается!</strong> Эффект уже активен.</p>`;
                    }
                }
                break;

            case "Болезнь":
                // Добавляем событие в отслеживание текущей фазы
                await DataHandler.addEventToCurrentPhase(data, event.name);
                
                // Проверяем количество событий в текущей фазе
                const updatedDataDisease = DataHandler.get();
                const diseaseCount = DataHandler.getEventCountThisPhase(updatedDataDisease, "Болезнь");
                
                console.log("Количество 'Болезнь' в фазе:", diseaseCount);
                
                // Получаем или создаем список событий
                const diseaseEvents = updatedDataDisease.events || [];
                const existingDiseaseEvent = diseaseEvents.find(e => e.name === event.name);
                
                if (!existingDiseaseEvent) {
                    // Создаем новое событие (всегда временное при первом выпадении)
                    console.log(`🔧 СОЗДАНИЕ СОБЫТИЯ: updatedDataDisease.week=${updatedDataDisease.week}, weekStarted будет=${updatedDataDisease.week + 1}`);
                    
                    const newEvent = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: updatedDataDisease.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false,
                        securityPenalty: -4, // Сохраняем значение штрафа
                        mitigate: "medicine",
                        dc: 20,
                        mitigated: false
                    };
                    
                    diseaseEvents.push(newEvent);
                    await DataHandler.update({ events: diseaseEvents });
                    console.log("✅ Событие добавлено в базу");
                    
                    message += `<p style="color:red"><strong>Болезнь!</strong> Безопасность будет снижена на 4 на след. неделю.</p>`;
                } else {
                    // Если событие уже существует и это второе выпадение в фазе, делаем постоянным
                    if (diseaseCount >= 2 && !existingDiseaseEvent.isPersistent) {
                        existingDiseaseEvent.isPersistent = true;
                        existingDiseaseEvent.duration = 999;
                        existingDiseaseEvent.desc = "Постоянная болезнь. -4 Безопасность. Смягчение: Медицина КС 20 снижает до -2.";
                        
                        await DataHandler.update({ events: diseaseEvents });
                        message += `<p style="color:red"><strong>Болезнь стала постоянной!</strong> Эффект будет действовать навсегда.</p>`;
                        console.log("✅ Событие стало постоянным");
                    } else {
                        console.log("❌ Событие уже существует");
                        message += `<p style="color:red"><strong>Болезнь продолжается!</strong> Эффект уже активен.</p>`;
                    }
                }
                break;

            case "Недееспособная команда":
                // Выбираем команду, которая была задействована в действии на этой неделе
                const activeTeamsForDisabling = data.teams.filter(t => !t.disabled && !t.missing && t.hasActed);
                if (activeTeamsForDisabling.length > 0) {
                    const randomIndex = Math.floor(Math.random() * activeTeamsForDisabling.length);
                    const teamToDisable = activeTeamsForDisabling[randomIndex];

                    const teams = JSON.parse(JSON.stringify(data.teams));
                    const index = teams.findIndex(t => t.type === teamToDisable.type);
                    if (index !== -1) {
                        teams[index].disabled = true;
                        teams[index].disabledByEvent = true; // Отмечаем, что команда недееспособна из-за события
                    }

                    await DataHandler.update({ teams });
                    message += `<p style="color:red"><strong>Недееспособная команда!</strong> Команда ${getTeamDefinition(teamToDisable.type).label}, которая была задействована в действии, получила урон и стала недееспособной.</p>`;
                } else {
                    // Если ни одна команда не была задействована в действии, рассматриваем как "Опасные времена"
                    message += `<p style="color:#d84315"><strong>Недееспособная команда!</strong> Ни одна команда не была задействована в действии на этой неделе. Рассматривается как "Опасные времена".</p>`;
                    
                    // Вызываем событие "Опасные времена"
                    const dangerousTimesEvent = { name: "Опасные времена", desc: "+10 Опасность. Запугивание КС 20 снижает до +5." };
                    const dangerousMessage = await this._applyEventEffects(dangerousTimesEvent, data);
                    message += dangerousMessage;
                }
                break;

            case "Разлад в рядах":
                // Добавляем событие в отслеживание текущей фазы
                await DataHandler.addEventToCurrentPhase(data, event.name);
                
                // Проверяем количество событий в текущей фазе
                const updatedDataDisorder = DataHandler.get();
                const disorderCount = DataHandler.getEventCountThisPhase(updatedDataDisorder, "Разлад в рядах");
                
                console.log("Количество 'Разлад в рядах' в фазе:", disorderCount);
                
                // Получаем или создаем список событий
                const disorderEvents = updatedDataDisorder.events || [];
                const existingDisorderEvent = disorderEvents.find(e => e.name === event.name);
                
                if (!existingDisorderEvent) {
                    // Создаем новое событие (всегда временное при первом выпадении)
                    console.log(`🔧 СОЗДАНИЕ СОБЫТИЯ: updatedDataDisorder.week=${updatedDataDisorder.week}, weekStarted будет=${updatedDataDisorder.week + 1}`);
                    
                    const newEvent = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: updatedDataDisorder.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false,
                        allPenalty: -4, // Сохраняем значение штрафа ко всем проверкам
                        mitigate: "diplomacy",
                        dc: 20,
                        mitigated: false
                    };
                    
                    disorderEvents.push(newEvent);
                    await DataHandler.update({ events: disorderEvents });
                    console.log("✅ Событие добавлено в базу");
                    
                    message += `<p style="color:red"><strong>Разлад в рядах!</strong> Все проверки будут снижены на 4 на след. неделю.</p>`;
                } else {
                    // Если событие уже существует и это второе выпадение в фазе, делаем постоянным
                    if (disorderCount >= 2 && !existingDisorderEvent.isPersistent) {
                        existingDisorderEvent.isPersistent = true;
                        existingDisorderEvent.duration = 999;
                        existingDisorderEvent.desc = "Постоянный разлад в рядах. -4 ко всем проверкам. Смягчение: Дипломатия КС 20 снижает до -2.";
                        
                        await DataHandler.update({ events: disorderEvents });
                        message += `<p style="color:red"><strong>Разлад в рядах стал постоянным!</strong> Эффект будет действовать навсегда.</p>`;
                        console.log("✅ Событие стало постоянным");
                    } else {
                        console.log("❌ Событие уже существует");
                        message += `<p style="color:red"><strong>Разлад в рядах продолжается!</strong> Эффект уже активен.</p>`;
                    }
                }
                break;

            case "Вторжение":
                message += `<p style="color:red"><strong>Вторжение!</strong></p>`;
                message += `<p>Опасное существо вторглось! ГМ бросает или выбирает бродячего монстра из таблиц столкновений, доступных ему в приключениях, и вы должны вмешаться, чтобы сразиться с этим нарушителем. Место, в котором происходит вторжение, выбирается ГМ.</p>`;
                message += `<p>Если вы решите не разбираться с захватчиком лично, Серебряные Вороны сами справляются с ситуацией, но при этом 1d4 случайно определенных команды теряются, а 1d4 случайно определенных команды становятся недееспособными. Кроме того, неспособность партии справиться с захватчиком заставляет восстание получить постоянное событие "Низкий боевой дух".</p>`;
                message += `<p><button class="invasion-ignore-btn" style="background-color: #8b0000; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer;">Игнорировать вторжение</button></p>`;
                break;

            case "Провальный протест":
                message += `<p><strong>Провальный протест!</strong> Ваши сторонники потерпели неудачу в протесте против Дома Трун или церкви Асмодея. Требуется проверка Безопасности КС 25.</p>`;
                
                message += `<button class="roll-failed-protest-btn" 
                                    data-event="Провальный протест">
                    🎲 Проверка Безопасности (КС 25)
                </button>`;
                break;

            case "Союзник в опасности":
                if (data.allies && data.allies.length > 0) {
                    // Выбираем случайного союзника из доступных (не схваченных и не пропавших)
                    const availableAllies = data.allies.filter(ally => !ally.captured && !ally.missing);
                    if (availableAllies.length > 0) {
                        const randomIndex = Math.floor(Math.random() * availableAllies.length);
                        const allyInDanger = availableAllies[randomIndex];
                        
                        // Импортируем определения союзников для получения уровня
                        const { ALLY_DEFINITIONS } = await import('./allies.js');
                        const allyData = ALLY_DEFINITIONS[allyInDanger.slug];
                        const allyLevel = allyData?.level || 5; // По умолчанию уровень 5
                        const dc = Math.max(10, 20 - allyLevel); // КС = 20 - уровень, минимум 10
                        
                        message += `<p style="color:red"><strong>Союзник в опасности!</strong> ${allyInDanger.name} (уровень ${allyLevel}) попал в беду.</p>`;
                        message += `<p>Требуется проверка Безопасности КС ${dc}. При успехе союзник пропадает на неделю, при провале - схвачен.</p>`;
                        
                        message += `<button class="roll-ally-danger-btn" 
                                            data-ally-index="${data.allies.indexOf(allyInDanger)}"
                                            data-dc="${dc}"
                                            data-ally-name="${allyInDanger.name}">
                            🎲 Проверка Безопасности (КС ${dc})
                        </button>`;
                    } else {
                        message += `<p style="color:#d84315"><strong>Союзник в опасности!</strong> Все союзники уже в опасности или схвачены.</p>`;
                    }
                } else {
                    message += `<p style="color:#d84315"><strong>Союзник в опасности!</strong> Нет доступных союзников.</p>`;
                }
                break;

            case "Катастроф. миссия":
                // Выбираем команду, которая была задействована в действии на этой неделе
                const activeTeamsForCatastrophe = data.teams.filter(t => !t.disabled && !t.missing && t.hasActed);
                
                if (activeTeamsForCatastrophe.length > 0) {
                    const randomIndex = Math.floor(Math.random() * activeTeamsForCatastrophe.length);
                    const teamInDanger = activeTeamsForCatastrophe[randomIndex];
                    
                    message += `<p><strong>Катастрофическая миссия!</strong> Команда ${getTeamDefinition(teamInDanger.type).label}, которая была задействована в действии на этой неделе, достигла своей цели, но получила значительный урон в процессе. Требуется проверка Безопасности КС 20.</p>`;
                    
                    message += `<button class="roll-catastrophic-mission-btn" 
                                        data-event="Катастроф. миссия"
                                        data-team-type="${teamInDanger.type}">
                        🎲 Проверка Безопасности (КС 20)
                    </button>`;
                } else {
                    // Если ни одна команда не была задействована в действии, рассматриваем как "Опасные времена"
                    message += `<p style="color:#d84315"><strong>Катастрофическая миссия!</strong> Ни одна команда не была задействована в действии на этой неделе. Рассматривается как "Опасные времена".</p>`;
                    
                    // Вызываем событие "Опасные времена"
                    const dangerousTimesEvent = { name: "Опасные времена", desc: "+10 Опасность. Запугивание КС 20 снижает до +5." };
                    const dangerousMessage = await this._applyEventEffects(dangerousTimesEvent, data);
                    message += dangerousMessage;
                }
                break;

            case "Предатель":
                const operationalTeams5 = data.teams.filter(t => !t.disabled && !t.missing);
                if (operationalTeams5.length > 0) {
                    const randomIndex = Math.floor(Math.random() * operationalTeams5.length);
                    const traitorTeam = operationalTeams5[randomIndex];
                    const traitorTeamDef = getTeamDefinition(traitorTeam.type);

                    message += `<p><strong>Предатель!</strong> Один из Серебряных Воронов оказывается предателем! Команда ${traitorTeamDef.label} - та, в которой укрылся предатель.</p>`;
                    message += `<p>Требуется проверка Верности КС 20 для обнаружения предателя до того, как он нанесет значительный ущерб.</p>`;
                    
                    message += `<button class="roll-traitor-btn" 
                                        data-event="Предатель"
                                        data-team-type="${traitorTeam.type}">
                        🎲 Проверка Верности (КС 20)
                    </button>`;

                    // Команда становится недееспособной в любом случае
                    const teams = JSON.parse(JSON.stringify(data.teams));
                    const index = teams.findIndex(t => t.type === traitorTeam.type);
                    if (index !== -1) teams[index].disabled = true;
                    await DataHandler.update({ teams });
                } else {
                    message += `<p style="color:#d84315"><strong>Предатель!</strong> Нет доступных команд - событие не происходит.</p>`;
                }
                break;

            case "Дьявольское проникн.":
                message += `<p><strong>Дьявольское проникновение!</strong> Один из Серебряных Воронов на самом деле является магически замаскированным дьяволом или одержим дьявольским духом.</p>`;
                message += `<p>Необходимо определить, как долго проникновение продолжалось незамеченным.</p>`;
                
                message += `<button class="roll-devil-weeks-btn" data-event="Дьявольское проникн.">🎲 Недели проникновения</button>`;
                break;

            case "Инквизиция":
                // Добавляем событие в отслеживание текущей фазы
                await DataHandler.addEventToCurrentPhase(data, event.name);
                
                // Проверяем количество событий в текущей фазе
                const updatedDataInquisition = DataHandler.get();
                const inquisitionCount = DataHandler.getEventCountThisPhase(updatedDataInquisition, "Инквизиция");
                
                console.log("Количество 'Инквизиция' в фазе:", inquisitionCount);
                
                // Получаем или создаем список событий
                const inquisitionEvents = updatedDataInquisition.events || [];
                const existingInquisitionEvent = inquisitionEvents.find(e => e.name === event.name);
                
                if (!existingInquisitionEvent) {
                    // Создаем новое событие (всегда временное при первом выпадении)
                    console.log(`🔧 СОЗДАНИЕ СОБЫТИЯ: updatedDataInquisition.week=${updatedDataInquisition.week}, weekStarted будет=${updatedDataInquisition.week + 1}`);
                    
                    const newEvent = {
                        name: event.name,
                        desc: event.desc,
                        weekStarted: updatedDataInquisition.week + 1, // Начинает действовать со следующей недели
                        duration: 1,
                        isPersistent: false,
                        mitigate: "secrecy",
                        dc: 20,
                        mitigated: false
                    };
                    
                    inquisitionEvents.push(newEvent);
                    await DataHandler.update({ events: inquisitionEvents });
                    console.log("✅ Событие добавлено в базу");
                    
                    message += `<p style="color:red"><strong>Инквизиция!</strong> Трун и церковь устали от восстания. На следующую неделю восстание теряет в два раза больше сторонников, а бонусы и штрафы от военного положения удваиваются.</p>`;
                } else {
                    // Если событие уже существует и это второе выпадение в фазе, делаем постоянным
                    if (inquisitionCount >= 2 && !existingInquisitionEvent.isPersistent) {
                        existingInquisitionEvent.isPersistent = true;
                        existingInquisitionEvent.duration = 999;
                        existingInquisitionEvent.desc = "Постоянная Инквизиция. ×2 потеря сторонников. ×2 модификаторы военного положения. Смягчение: Секретность КС 20 при 'Залечь на дно'.";
                        
                        await DataHandler.update({ events: inquisitionEvents });
                        message += `<p style="color:red"><strong>Инквизиция стала постоянной!</strong> Эффект будет действовать навсегда, пока не будет завершен действием 'Залечь на дно' с успешной проверкой Секретности КС 20.</p>`;
                        message += `<button class="show-inquisition-info-btn" style="margin-top: 10px;">ℹ️ Как завершить Инквизицию</button>`;
                        
                        console.log("✅ Событие стало постоянным");
                    } else {
                        console.log("❌ Событие уже существует");
                        message += `<p style="color:red"><strong>Инквизиция продолжается!</strong> Эффект уже активен.</p>`;
                        if (existingInquisitionEvent && existingInquisitionEvent.isPersistent) {
                            message += `<button class="show-inquisition-info-btn" style="margin-top: 10px;">ℹ️ Как завершить Инквизицию</button>`;
                        }
                    }
                }
                break;

            default:
                message += `<p>Событие ${event.name} не имеет специальных эффектов.</p>`;
                break;
        }

        // Добавляем событие в список эффектов (только если это постоянный эффект)
        // Исключаем события со специальной обработкой
        if (event.persistent && 
            event.name !== "Опасные времена" && 
            event.name !== "Соперничество" &&
            event.name !== "Усиленные патрули" &&
            event.name !== "Низкий боевой дух" &&
            event.name !== "Болезнь" &&
            event.name !== "Разлад в рядах" &&
            event.name !== "Инквизиция" &&
            event.name !== "Предатель") {
            const currentEvents = data.events || [];
            if (!currentEvents.find(e => e.name === event.name)) {
                currentEvents.push({
                    name: event.name,
                    desc: event.desc,
                    weekStarted: data.week,
                    duration: 1,
                    mitigate: event.mitigate,
                    dc: event.dc,
                    isPersistent: event.persistent || false
                });
                await DataHandler.update({ events: currentEvents });
            }
        }

        // Кнопки смягчения удалены - события теперь не имеют возможности смягчения

        return message;
    }

    async _revertEventEffects(event, data) {
        let message = "";

        switch (event.name) {
            case "Неделя Секретности":
                // Эффект временный, не требует отмены
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Неделя Секретности" завершен.</p>`;
                break;

            case "Успешный протест":
                // Нельзя отменить полученных сторонников, но можем уведомить
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Успешный протест" отменен (сторонники остаются).</p>`;
                break;

            case "Уменьшенная угроза":
                // Эффект временный, не требует отмены (применяется через getEffectiveDanger)
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Уменьшенная угроза" завершен.</p>`;
                break;

            case "Пожертвование":
                // Нельзя отменить полученные деньги, но можем уведомить
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Пожертвование" отменен (казна остается).</p>`;
                break;

            case "Рост поддержки":
                // Нельзя отменить полученных сторонников, но можем уведомить
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Рост поддержки" отменен (сторонники остаются).</p>`;
                break;

            case "Рыночный бум":
                // Эффект временный, не требует отмены
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Рыночный бум" завершен.</p>`;
                break;

            case "Все спокойно":
                // Эффект временный, не требует отмены
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Все спокойно" завершен.</p>`;
                break;

            case "Стукач":
                // "Стукач" не является эффектом - это одноразовое событие без длительности
                // Не требует отмены, так как не имеет продолжающегося эффекта
                message += `<p style="color:blue"><strong>Примечание:</strong> "Стукач" не является эффектом и не требует отмены.</p>`;
                break;

            case "Соперничество":
                // Remove rivalry effects from teams
                await DataHandler.removeRivalryEffects(data);
                
                // Принудительный полный ререндер для обновления визуального отображения
                this.render(true);
                
                // Find the rivalry event to get affected teams for message
                const rivalryEvent = data.events.find(e => e.name === "Соперничество");
                
                if (rivalryEvent && rivalryEvent.affectedTeams) {
                    const teamNames = rivalryEvent.affectedTeams.map(type => getTeamDefinition(type).label).join(", ");
                    if (rivalryEvent.isPersistent) {
                        message += `<p style="color:blue"><strong>Отмена:</strong> Постоянное соперничество завершено. Команды ${teamNames} восстановлены.</p>`;
                    } else {
                        message += `<p style="color:blue"><strong>Отмена:</strong> Команды ${teamNames} восстановлены.</p>`;
                    }
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Соперничество" отменен.</p>`;
                }
                break;

            case "Опасные времена":
                console.log("🔄 ОТМЕНА СОБЫТИЯ 'Опасные времена'");
                
                // Находим событие в активных событиях
                const currentEvents = data.events || [];
                const dangerousEvent = currentEvents.find(e => e.name === "Опасные времена");
                
                if (dangerousEvent) {
                    // Событие будет удалено из списка, эффект прекратится автоматически
                    const dangerReduction = dangerousEvent.dangerIncrease || 10;
                    
                    if (dangerousEvent.isPersistent) {
                        message += `<p style="color:blue"><strong>Отмена:</strong> Постоянные опасные времена завершены. Эффект опасности (+${dangerReduction}) прекращен.</p>`;
                    } else {
                        message += `<p style="color:blue"><strong>Отмена:</strong> Опасные времена завершены. Эффект опасности (+${dangerReduction}) прекращен.</p>`;
                    }
                    
                    console.log(`✅ Событие завершено, эффект опасности (+${dangerReduction}) прекращен`);
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Опасные времена" завершен.</p>`;
                    console.log("✅ Событие завершено");
                }
                break;

            case "Пропавшие без вести":
                // Возвращаем пропавшие команды
                const teams2 = JSON.parse(JSON.stringify(data.teams));
                let foundTeams = [];
                teams2.forEach(team => {
                    if (team.missing) {
                        team.missing = false;
                        foundTeams.push(getTeamDefinition(team.type).label);
                    }
                });
                if (foundTeams.length > 0) {
                    await DataHandler.update({ teams: teams2 });
                    message += `<p style="color:blue"><strong>Отмена:</strong> Команды ${foundTeams.join(", ")} найдены и возвращены.</p>`;
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Пропавшие без вести" отменен (нет пропавших команд).</p>`;
                }
                break;

            case "Тайник обнаружен":
                // Нельзя точно восстановить тайник или потерянных людей
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Тайник обнаружен" отменен (потери остаются).</p>`;
                break;

            case "Усиленные патрули":
                // Удаляем событие из активных событий
                const patrolsEvents = data.events ? data.events.filter(e => e.name !== "Усиленные патрули") : [];
                await DataHandler.update({ events: patrolsEvents });
                message += `<p style="color:blue"><strong>Отмена:</strong> Усиленные патрули отменены.</p>`;
                break;

            case "Низкий боевой дух":
                // Удаляем событие из активных событий
                const moraleEvents = data.events ? data.events.filter(e => e.name !== "Низкий боевой дух") : [];
                await DataHandler.update({ events: moraleEvents });
                message += `<p style="color:blue"><strong>Отмена:</strong> Низкий боевой дух отменен.</p>`;
                break;

            case "Болезнь":
                // Удаляем событие из активных событий
                const diseaseEvents = data.events ? data.events.filter(e => e.name !== "Болезнь") : [];
                await DataHandler.update({ events: diseaseEvents });
                message += `<p style="color:blue"><strong>Отмена:</strong> Болезнь отменена.</p>`;
                break;

            case "Недееспособная команда":
                // Восстанавливаем недееспособные команды
                const teams3 = JSON.parse(JSON.stringify(data.teams));
                let restoredTeams2 = [];
                teams3.forEach(team => {
                    if (team.disabled) {
                        team.disabled = false;
                        restoredTeams2.push(getTeamDefinition(team.type).label);
                    }
                });
                if (restoredTeams2.length > 0) {
                    await DataHandler.update({ teams: teams3 });
                    message += `<p style="color:blue"><strong>Отмена:</strong> Команды ${restoredTeams2.join(", ")} восстановлены.</p>`;
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Недееспособная команда" отменен (нет недееспособных команд).</p>`;
                }
                break;

            case "Разлад в рядах":
                // Удаляем событие из активных событий
                const disorderEvents = data.events ? data.events.filter(e => e.name !== "Разлад в рядах") : [];
                await DataHandler.update({ events: disorderEvents });
                message += `<p style="color:blue"><strong>Отмена:</strong> Разлад в рядах отменен.</p>`;
                break;

            case "Инквизиция":
                // Удаляем событие из активных событий
                const inquisitionEvents = data.events ? data.events.filter(e => e.name !== "Инквизиция") : [];
                await DataHandler.update({ events: inquisitionEvents });
                message += `<p style="color:blue"><strong>Отмена:</strong> Инквизиция отменена.</p>`;
                break;

            case "Вторжение":
                // Эффект требует вмешательства ПИ, не можем автоматически отменить
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Вторжение" отменен.</p>`;
                break;

            case "Провальный протест":
                // "Провальный протест" не является эффектом - это одноразовое событие без длительности
                // Удаляем связанное событие с модификатором поселения, если оно есть
                const events = JSON.parse(JSON.stringify(data.events || []));
                const filteredEvents = events.filter(e => e.name !== "Провальный протест");
                await DataHandler.update({ events: filteredEvents });
                
                message += `<p style="color:blue"><strong>Примечание:</strong> "Провальный протест" не является эффектом, но модификатор поселения отменен.</p>`;
                break;

            case "Союзник в опасности":
                // Возвращаем пропавших союзников
                if (data.allies && data.allies.length > 0) {
                    const allies = JSON.parse(JSON.stringify(data.allies));
                    let rescuedAllies = [];
                    allies.forEach(ally => {
                        if (ally.missing) {
                            ally.missing = false;
                            rescuedAllies.push(ally.name);
                        }
                    });
                    if (rescuedAllies.length > 0) {
                        await DataHandler.update({ allies });
                        message += `<p style="color:blue"><strong>Отмена:</strong> Союзники ${rescuedAllies.join(", ")} спасены.</p>`;
                    } else {
                        message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Союзник в опасности" отменен (нет пропавших союзников).</p>`;
                    }
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Союзник в опасности" отменен (нет союзников).</p>`;
                }
                break;

            case "Катастроф. миссия":
                // Нельзя восстановить уничтоженные команды, но можем восстановить поврежденные
                const teams4 = JSON.parse(JSON.stringify(data.teams));
                let restoredTeams3 = [];
                teams4.forEach(team => {
                    if (team.disabled) {
                        team.disabled = false;
                        restoredTeams3.push(getTeamDefinition(team.type).label);
                    }
                });
                if (restoredTeams3.length > 0) {
                    await DataHandler.update({ teams: teams4 });
                    message += `<p style="color:blue"><strong>Отмена:</strong> Поврежденные команды ${restoredTeams3.join(", ")} восстановлены.</p>`;
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Катастроф. миссия" отменен.</p>`;
                }
                break;

            case "Предатель":
                // Восстанавливаем недееспособные команды и убираем известность
                const teams5 = JSON.parse(JSON.stringify(data.teams));
                let restoredTeams4 = [];
                teams5.forEach(team => {
                    if (team.disabled) {
                        team.disabled = false;
                        restoredTeams4.push(getTeamDefinition(team.type).label);
                    }
                });
                
                const updates = { teams: teams5 };
                if (data.notoriety >= 2) {
                    updates.notoriety = data.notoriety - 2;
                }
                
                await DataHandler.update(updates);
                
                if (restoredTeams4.length > 0) {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Команды ${restoredTeams4.join(", ")} восстановлены, известность снижена.</p>`;
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Предатель" отменен, известность снижена.</p>`;
                }
                break;

            case "Дьявольское проникн.":
                // Убираем добавленную известность (максимум 6d6 за 6 недель)
                if (data.notoriety >= 1) {
                    const maxPossibleGain = 36; // 6 недель × 6 максимум за d6
                    const reductionAmount = Math.min(data.notoriety, maxPossibleGain);
                    await DataHandler.update({ notoriety: Math.max(0, data.notoriety - reductionAmount) });
                    message += `<p style="color:blue"><strong>Отмена:</strong> Известность снижена на ${reductionAmount}.</p>`;
                } else {
                    message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Дьявольское проникн." отменен.</p>`;
                }
                break;

            case "Инквизиция":
                // Эффект временный, не требует отмены
                message += `<p style="color:blue"><strong>Отмена:</strong> Эффект "Инквизиция" завершен.</p>`;
                break;

            default:
                message += `<p style="color:blue"><strong>Отмена:</strong> Событие ${event.name} отменено.</p>`;
                break;
        }

        // Логируем отмену в журнал
        if (message) {
            await this._logToJournal(message, { important: false });
        }

        return message;
    }

    async _logToJournal(htmlContent, options = {}) {
        const data = DataHandler.get();
        const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        // Проверяем, содержит ли контент уже красивое оформление (рамки и фон)
        const hasStyledContent = htmlContent.includes('border:') && htmlContent.includes('background:');
        
        // Создаем красивый заголовок с временной меткой только для простых сообщений
        let formattedContent = htmlContent;
        if (!options.skipTimestamp && !hasStyledContent) {
            formattedContent = `
                <div style="margin: 10px 0; padding: 8px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; border-left: 4px solid #4a90e2;">
                    <div style="font-size: 0.8em; color: #2c3e50; margin-bottom: 5px; font-weight: 600;">⏰ ${timestamp}</div>
                    ${htmlContent}
                </div>
            `;
        } else if (!options.skipTimestamp && hasStyledContent) {
            // Для красиво оформленных сообщений добавляем только временную метку
            formattedContent = `
                <div style="font-size: 0.8em; color: #2c3e50; margin: 5px 0 10px 0; text-align: right; font-weight: 600;">
                    ⏰ ${timestamp}
                </div>
                ${htmlContent}
            `;
        }
        
        // Добавляем к отчету с красивым разделителем
        const separator = options.skipSeparator ? "" : "<div style='margin: 15px 0; border-bottom: 2px dashed #ddd;'></div>";
        const newReport = (data.phaseReport || "") + formattedContent + separator;
        await DataHandler.update({ phaseReport: newReport });
        
        // Автоматически сохраняем в чат если это важное событие
        if (options.important) {
            ChatMessage.create({ 
                content: htmlContent, 
                speaker: ChatMessage.getSpeaker() 
            });
        }
    }

    async _onArchiveWeek() {
        const data = DataHandler.get();
        if (!await Dialog.confirm({ title: "Завершить неделю?", content: `Архивировать Неделю ${data.week}?` })) return;

        // Check for teams that rested (didn't act)
        let phaseReport = data.phaseReport || "";
        const teams = JSON.parse(JSON.stringify(data.teams));
        let teamsChanged = false;

        for (const team of teams) {
            if (!team.disabled && !team.missing && !team.hasActed) {
                const def = getTeamDefinition(team.type);
                const message = `
                    <div style="
                        border: 2px solid #9e9e9e; 
                        padding: 15px; 
                        background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); 
                        border-radius: 12px; 
                        margin: 10px 0; 
                        box-shadow: 0 4px 8px rgba(158, 158, 158, 0.2);
                    ">
                        <h5 style="color: #616161; margin: 0 0 15px 0; font-size: 1.2em; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 2em;">💤</span>
                            Отдых команды
                        </h5>
                        
                        <div style="display: flex; align-items: center; gap: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                            <img src="${def.icon}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 3px solid #9e9e9e;">
                            <div>
                                <strong style="font-size: 1.2em; color: #424242;">${def.label}</strong>
                                <div style="color: #666; font-size: 0.9em; margin-top: 2px;">
                                    Ранг ${def.rank} • ${getCategoryLabel(def.category)}
                                </div>
                                <div style="color: #757575; font-size: 0.9em; margin-top: 5px; font-style: italic;">
                                    😴 Команда восстанавливает силы
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: rgba(255,255,255,0.8); padding: 10px; border-radius: 8px; margin-top: 10px; text-align: center;">
                            <span style="color: #616161; font-size: 0.9em;">
                                ⏰ Команда не выполняла действий на этой неделе
                            </span>
                        </div>
                    </div>
                `;

                phaseReport += message;
                ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
            }

            // Reset hasActed for next week
            if (team.hasActed) {
                team.hasActed = false;
                teamsChanged = true;
            }
            
            // Reset disabled status ONLY for teams that can auto-recover
            // (teams that were rescued and marked for auto-recovery)
            // НЕ восстанавливаем обычные недееспособные команды - для них нужно тратить золото
            if (team.disabled && !team.missing && team.canAutoRecover) {
                team.disabled = false;
                team.canAutoRecover = false; // Сбрасываем флаг после восстановления
                teamsChanged = true;
            }
        }

        if (teamsChanged) {
            await DataHandler.update({ teams });
        }

        // Update phaseReport in local data for archiving
        data.phaseReport = phaseReport;
        await DataHandler.update({ phaseReport });

        // Clean up expired events (проверяем для СЛЕДУЮЩЕЙ недели)
        let eventsStr = "Нет активных событий";
        if (data.events?.length) {
            console.log("🔍 ФИЛЬТРАЦИЯ СОБЫТИЙ - НАЧАЛО");
            console.log("Текущая неделя:", data.week);
            console.log("Следующая неделя:", data.week + 1);
            console.log("События до фильтрации:", data.events);
            
            const nextWeek = data.week + 1; // Фильтруем для следующей недели
            console.log(`🔍 ФИЛЬТРАЦИЯ СОБЫТИЙ: текущая неделя=${data.week}, следующая неделя=${nextWeek}`);
            
            const remainingEvents = data.events.filter((e, index) => {
                console.log(`\n📋 Событие ${index + 1}: "${e.name}"`);
                console.log(`   - weekStarted: ${e.weekStarted}`);
                console.log(`   - duration: ${e.duration}`);
                console.log(`   - isPersistent: ${e.isPersistent}`);
                
                // Постоянные события остаются всегда
                if (e.isPersistent) {
                    console.log(`   - Результат: ✅ ОСТАЕТСЯ (постоянное)`);
                    return true;
                }
                
                const duration = e.duration || 1;
                const weekStarted = e.weekStarted || 0;
                const shouldRemain = nextWeek < (weekStarted + duration);
                
                console.log(`   - Расчет: ${nextWeek} < (${weekStarted} + ${duration}) = ${nextWeek} < ${weekStarted + duration} = ${shouldRemain}`);
                console.log(`   - Результат: ${shouldRemain ? '✅ ОСТАЕТСЯ' : '❌ УДАЛЯЕТСЯ'}`);
                
                return shouldRemain;
            });

            console.log("\n📊 РЕЗУЛЬТАТ ФИЛЬТРАЦИИ:");
            console.log("События ДО фильтрации:", data.events.map(e => `"${e.name}" (week:${e.weekStarted}, dur:${e.duration})`));
            console.log("События ПОСЛЕ фильтрации:", remainingEvents.map(e => `"${e.name}" (week:${e.weekStarted}, dur:${e.duration})`));
            console.log("Удалено событий:", data.events.length - remainingEvents.length);
            
            // Показываем какие именно события удалены
            const removedEvents = data.events.filter(e => !remainingEvents.some(r => r.name === e.name));
            if (removedEvents.length > 0) {
                console.log("🗑️ УДАЛЕННЫЕ СОБЫТИЯ:", removedEvents.map(e => `"${e.name}"`));
            }

            if (remainingEvents.length !== data.events.length) {
                console.log("✅ ОБНОВЛЯЕМ СОБЫТИЯ В БАЗЕ");
                
                // Проверяем, удалилось ли событие соперничества
                const rivalryWasRemoved = data.events.some(e => e.name === "Соперничество") && 
                                         !remainingEvents.some(e => e.name === "Соперничество");
                
                if (rivalryWasRemoved) {
                    console.log("🔄 Соперничество удалено, восстанавливаем команды");
                    await DataHandler.removeRivalryEffects(data);
                }
                
                await DataHandler.update({ events: remainingEvents });
                eventsStr = "События обновлены (истекшие удалены).";
            } else {
                console.log("❌ СОБЫТИЯ НЕ ИЗМЕНИЛИСЬ");
                eventsStr = "События активны.";
            }
            
            console.log("🔍 ФИЛЬТРАЦИЯ СОБЫТИЙ - КОНЕЦ");
        } else {
            console.log("🔍 НЕТ СОБЫТИЙ ДЛЯ ФИЛЬТРАЦИИ");
        }

        try {
            let journal = game.journal.get(game.settings.get(MODULE_ID, "journalEntry"));
            if (!journal) {
                journal = game.journal.getName("Rebellion Journal");
                if (!journal) {
                    journal = await JournalEntry.create({ name: "Rebellion Journal" });
                    ui.notifications.info("Создан новый журнал 'Rebellion Journal'.");
                }
                await game.settings.set(MODULE_ID, "journalEntry", journal.id);
            }

            // Use the new JournalLogger
            const content = JournalLogger.createWeeklyReport(data, data.phaseReport);

            await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: `Неделя ${data.week}`, text: { content: content, format: 1 } }]);

            await DataHandler.update({
                week: data.week + 1,
                phaseReport: "",
                actionsUsedThisWeek: 0,
                strategistUsed: false,
                recruitedThisPhase: false,
                manticceBonusUsedThisWeek: false,
            });

            // Reset weekly ally rerolls (Chuko, Shensen, Strea)
            await DataHandler.resetWeeklyRerolls(DataHandler.get());

            // Clear events from current phase (for rivalry tracking)
            await DataHandler.clearCurrentPhaseEvents(DataHandler.get());

            // Apply rivalry effects for events that become active on the new week
            await DataHandler.applyRivalryEffects(DataHandler.get());
            
            // Force re-render to show any newly blocked teams
            this.render(true);

            // Note: Monthly actions are automatically reset based on month calculation
            // No need to manually reset them here as they use week-based month calculation

            // Create beautiful week completion message using JournalLogger
            const completionMessage = JournalLogger.createWeekCompletionMessage(data.week);
            
            ChatMessage.create({ 
                content: completionMessage, 
                speaker: ChatMessage.getSpeaker() 
            });

            ui.notifications.info(`Неделя ${data.week} завершена! Архив создан.`);
        } catch (err) {
            ui.notifications.error(`Ошибка при завершении недели: ${err.message}`);
        }
    }


    async _onSentinelCheck(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const val = ev.currentTarget.value;
        const checked = ev.currentTarget.checked;
        const data = DataHandler.get();
        const officers = JSON.parse(JSON.stringify(data.officers));
        
        console.log("_onSentinelCheck:", { idx, val, checked, officersCount: officers.length });
        
        // Check if officer exists
        if (!officers[idx]) {
            console.log("Officer not found at index:", idx);
            return;
        }
        
        // Initialize selectedChecks array if not exists
        if (!officers[idx].selectedChecks) {
            officers[idx].selectedChecks = [];
        }

        console.log("Before update:", officers[idx].selectedChecks);

        if (checked) {
            if (officers[idx].selectedChecks.length >= 2) { 
                ev.currentTarget.checked = false; 
                return; 
            }
            officers[idx].selectedChecks.push(val);
        } else {
            officers[idx].selectedChecks = officers[idx].selectedChecks.filter(c => c !== val);
        }
        
        console.log("After update:", officers[idx].selectedChecks);
        
        await DataHandler.update({ officers });
        
        // Verify save
        const savedData = DataHandler.get();
        console.log("Saved selectedChecks:", savedData.officers[idx]?.selectedChecks);
        
        this.render();
    }

    async _onStrategistCheck(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        
        // Проверяем, есть ли офицер-стратег
        const hasStrategist = data.officers.some(o => o.role === 'strategist' && o.actorId);
        if (!hasStrategist) {
            ui.notifications.warn("Нет назначенного офицера-стратега!");
            ev.currentTarget.checked = false;
            return;
        }
        
        // Проверяем, не использован ли бонус стратега на этой неделе
        if (ev.currentTarget.checked && data.strategistUsed) {
            ui.notifications.warn("Бонус стратега уже использован на этой неделе!");
            ev.currentTarget.checked = false;
            return;
        }
        
        const teams = JSON.parse(JSON.stringify(data.teams));
        teams.forEach((t, i) => {
            if (i === idx) {
                t.isStrategistTarget = ev.currentTarget.checked;
            } else if (ev.currentTarget.checked) {
                // Снимаем стратега с других команд
                t.isStrategistTarget = false;
            }
        });
        await DataHandler.update({ teams });
        
        // Обновляем интерфейс
        this.render(false);
    }

    async _onTestEvent() {
        if (!game.user.isGM) {
            ui.notifications.warn("Только ГМ может тестировать события!");
            return;
        }

        const data = DataHandler.get();
        
        // Создаем список всех событий для выбора
        const eventOptions = EVENT_TABLE.map(event => 
            `<option value="${event.name}">${event.name} (${event.min}-${event.max})</option>`
        ).join('');

        const content = `
            <form>
                <div class="form-group">
                    <label>Выберите событие для тестирования:</label>
                    <select id="event-select" style="width: 100%; margin-top: 5px;">
                        ${eventOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label>
                        <input type="checkbox" id="ignore-immunities" style="margin-right: 5px;">
                        Игнорировать иммунитеты союзников
                    </label>
                </div>
            </form>
        `;

        new Dialog({
            title: "🧪 Тестирование События",
            content,
            buttons: {
                test: {
                    icon: '<i class="fas fa-dice"></i>',
                    label: "Запустить событие",
                    callback: async (html) => {
                        const selectedEventName = html.find('#event-select').val();
                        const ignoreImmunities = html.find('#ignore-immunities').is(':checked');
                        
                        const event = EVENT_TABLE.find(e => e.name === selectedEventName);
                        if (!event) {
                            ui.notifications.error("Событие не найдено!");
                            return;
                        }

                        await this._testSpecificEvent(event, data, ignoreImmunities);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Отмена"
                }
            },
            default: "test"
        }).render(true);
    }

    async _testSpecificEvent(event, data, ignoreImmunities = false) {
        let message = `<h5>🧪 ТЕСТ СОБЫТИЯ</h5>`;
        
        // Специальная обработка для "Бросьте дважды" - генерируем два случайных события
        if (event.name === "Бросьте дважды") {
            message += `<h5>📜 ${event.name}</h5>`;
            message += `<p><strong>Диапазон:</strong> ${event.min}-${event.max}</p>`;
            message += `<p><strong>Описание:</strong> ${event.desc}</p>`;
            message += `<p style="color:blue"><strong>Генерируем два случайных события:</strong></p>`;
            
            // Первое событие
            message += "<hr>";
            const firstEventMessage = await this._rollSecondEvent(data);
            message += firstEventMessage;
            
            // Второе событие
            message += "<hr>";
            const secondEventMessage = await this._rollSecondEvent(data);
            message += secondEventMessage;
            
        } else {
            // Обычная обработка для всех остальных событий
            message += `<h5>📜 ${event.name}</h5>`;
            message += `<p><strong>Диапазон:</strong> ${event.min}-${event.max}</p>`;
            message += `<p><strong>Описание:</strong> ${event.desc}</p>`;

            // Проверяем иммунитеты союзников (если не игнорируем)
            if (!ignoreImmunities) {
                if (event.name === "Усиленные патрули" && DataHandler.isAllyActive(data, 'cassius')) {
                    const bonusRoll = new Roll("3d6");
                    await bonusRoll.evaluate();
                    const bonus = bonusRoll.total || 0;
                    await DataHandler.update({ supporters: data.supporters + bonus, weeksWithoutEvent: 0 });
                    message += `<p style="color:green"><strong>Кассий предотвратил! +${bonus} сторонников</strong></p>`;
                } else if (event.name === "Низкий боевой дух" && DataHandler.isAllyActive(data, 'octavio')) {
                    await DataHandler.update({ weeksWithoutEvent: 0 });
                    message += `<p style="color:green"><strong>Октавио предотвратил!</strong></p>`;
                } else if (event.name === "Болезнь" && DataHandler.isAllyActive(data, 'hetamon')) {
                    await DataHandler.update({ weeksWithoutEvent: 0 });
                    message += `<p style="color:green"><strong>Хетамон предотвратил!</strong></p>`;
                } else {
                    // Применяем эффекты события
                    message += await this._applyEventEffects(event, data);
                }
            } else {
                // Игнорируем иммунитеты и применяем эффекты напрямую
                message += `<p style="color:#d84315"><em>⚠️ Иммунитеты союзников игнорированы</em></p>`;
                message += await this._applyEventEffects(event, data);
            }
        }

        console.log("🧪 ТЕСТ: Отправляем итоговое сообщение в чат. Длина:", message.length);
        console.log("🧪 ТЕСТ: Содержимое сообщения:", message);
        ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
    }

    async _onRollCheck(ev) {
        const type = ev.currentTarget.dataset.type;
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        new Roll(`1d20 + ${bonuses[type].total} `).toMessage({ speaker: ChatMessage.getSpeaker() });
    }

    async _onAddOfficerDialog() {
        let content = `<form><div class="form-group"><label>Роль:</label><select id="role-select">`;
        for (const [key, val] of Object.entries(OFFICER_ROLES)) { content += `<option value="${key}">${val.label}</option>`; }
        content += `</select></div></form>`;
        new Dialog({
            title: "Добавить", content, buttons: {
                add: {
                    label: "OK", callback: async (html) => {
                        const role = html.find('#role-select').val();
                        const d = DataHandler.get(); d.officers.push({ role, actorId: "", bonus: 0, locked: false, selectedChecks: [], disabled: false, missing: false, captured: false });
                        await DataHandler.update({ officers: d.officers });
                    }
                }
            }
        }).render(true);
    }

    async _onRemoveOfficer(ev) {
        if (await Dialog.confirm({ title: "Уволить?", content: "" })) {
            const idx = Number(ev.currentTarget.dataset.index); const d = DataHandler.get(); d.officers.splice(idx, 1); await DataHandler.update({ officers: d.officers });
        }
    }

    async _onSpinnerClick(ev) {
        const btn = ev.currentTarget;
        const action = btn.dataset.action;
        const target = btn.dataset.target;

        // Read value from the input in the same spinner control, not from saved data
        const $spinner = $(btn).closest('.spinner-control');
        const $input = $spinner.find('input');
        const inputVal = parseInt($input.val()) || 0;

        const newVal = action === "increase" ? inputVal + 1 : Math.max(0, inputVal - 1);

        // Update the input immediately for visual feedback
        $input.val(newVal);

        // Save to data
        await DataHandler.update({ [target]: newVal });
    }

    async _onSpinnerInputChange(ev) {
        ev.preventDefault();
        const input = ev.currentTarget;
        const target = input.name;
        const val = parseInt(input.value) || 0;

        const data = DataHandler.get();
        if (data[target] !== val) {
            await DataHandler.update({ [target]: val });
        }
    }

    async _onLevelUp() { const d = DataHandler.get(); if (d.rank < d.maxRank) await DataHandler.update({ rank: d.rank + 1 }); }
    async _onReset() { 
        if (game.user.isGM && await Dialog.confirm({ 
            title: "Сброс листа восстания", 
            content: "Это сбросит все данные восстания, включая кастомные дары ПИ. Продолжить?" 
        })) {
            // Complete reset without merging
            await DataHandler.reset();
            // Re-render the sheet to show the reset data
            this.render(false);
            ui.notifications.info("Лист восстания сброшен! Кастомные дары ПИ также сброшены.");
        }
    }
    async _onDeleteTeam(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        
        // Silver Ravens (idx -1) cannot be deleted
        if (idx < 0) {
            ui.notifications.warn("Серебряные Вороны не могут быть удалены!");
            return;
        }
        
        if (await Dialog.confirm({ title: "Удалить команду?", content: "Вы уверены, что хотите удалить эту команду?" })) {
            const data = DataHandler.get();

            // Create a proper copy of the teams array
            const teams = JSON.parse(JSON.stringify(data.teams));

            // Remove the team at the specified index
            teams.splice(idx, 1);

            // Update the data with the modified teams array
            await DataHandler.update({ teams: teams });

            ui.notifications.info("Команда успешно удалена!");
        }
    }
    async _onDeleteAlly(ev) { if (await Dialog.confirm({ title: "Удалить?", content: "" })) { const idx = Number(ev.currentTarget.dataset.index); const d = DataHandler.get(); d.allies.splice(idx, 1); await DataHandler.update({ allies: d.allies }); } }

    async _onEditGift(ev) {
        if (!game.user.isGM) return;
        
        const rank = Number(ev.currentTarget.dataset.rank);
        const data = DataHandler.get();
        
        // Get current gift - check custom gifts first, then default
        const currentGift = data.customGifts?.[rank] || REBELLION_PROGRESSION[rank]?.gift || "";
        
        const content = `
            <form>
                <div class="form-group">
                    <label>Дар ПИ для ранга ${rank}:</label>
                    <textarea id="gift-text" rows="3" style="width: 100%; resize: vertical;">${currentGift}</textarea>
                    <div style="margin-top: 8px; font-size: 11px; color: #666;">
                        <strong>Оригинальный дар:</strong> ${REBELLION_PROGRESSION[rank]?.gift || "—"}
                    </div>
                </div>
            </form>
        `;
        
        const sheet = this; // Save reference to this
        
        new Dialog({
            title: `Редактировать дар ПИ - Ранг ${rank}`,
            content: content,
            buttons: {
                save: {
                    label: "Сохранить",
                    callback: async (html) => {
                        const newGift = html.find('#gift-text').val().trim();
                        
                        // Save to module data
                        const currentData = DataHandler.get();
                        if (!currentData.customGifts) currentData.customGifts = {};
                        
                        if (newGift && newGift !== REBELLION_PROGRESSION[rank]?.gift) {
                            currentData.customGifts[rank] = newGift;
                        } else {
                            // Remove custom gift if it's empty or same as original
                            delete currentData.customGifts[rank];
                        }
                        
                        // Direct settings update to avoid mergeObject issues
                        await game.settings.set("pf2e-ts-adv-pf1ehr", "rebellionData", currentData);
                        
                        // Force a complete re-render
                        setTimeout(() => {
                            sheet.render(true);
                        }, 100);
                        
                        ui.notifications.info(`Дар ПИ для ранга ${rank} обновлен!`);
                    }
                },
                reset: {
                    label: "Сбросить",
                    callback: async (html) => {
                        // Reset to original gift - use direct settings update to avoid mergeObject issues
                        const currentData = DataHandler.get();
                        if (!currentData.customGifts) currentData.customGifts = {};
                        
                        console.log(`Before reset - customGifts[${rank}]:`, currentData.customGifts[rank]);
                        delete currentData.customGifts[rank];
                        console.log(`After delete - customGifts:`, currentData.customGifts);
                        
                        // Direct settings update to avoid mergeObject
                        await game.settings.set("pf2e-ts-adv-pf1ehr", "rebellionData", currentData);
                        
                        // Verify the update worked
                        const updatedData = DataHandler.get();
                        console.log(`After update - customGifts:`, updatedData.customGifts);
                        
                        // Force a complete re-render
                        setTimeout(() => {
                            sheet.render(true);
                        }, 100);
                        
                        ui.notifications.info(`Дар ПИ для ранга ${rank} сброшен к оригиналу!`);
                    }
                },
                cancel: {
                    label: "Отмена"
                }
            },
            default: "save"
        }).render(true);
    }

    /**
     * Handler for adding custom modifier effect
     */
    async _onAddCustomEffect(ev) {
        ev.preventDefault();
        const data = DataHandler.get();
        const currentWeek = data.week || 1;
        
        const content = `
            <form class="custom-effect-form">
                <div class="form-group">
                    <label>Название:</label>
                    <input type="text" id="effect-name" placeholder="Название эффекта" style="width: 100%;">
                </div>
                <div class="form-group">
                    <label>Описание:</label>
                    <input type="text" id="effect-desc" placeholder="Описание (опционально)" style="width: 100%;">
                </div>
                <div class="form-group">
                    <label>Старт:</label>
                    <select id="effect-start" style="width: 100%;">
                        <option value="current" selected>Текущая неделя (${currentWeek})</option>
                        <option value="next">Следующая неделя (${currentWeek + 1})</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Длительность:</label>
                    <select id="effect-duration-type" style="width: 100%;">
                        <option value="permanent" selected>Постоянный</option>
                        <option value="temporary">Временный</option>
                    </select>
                </div>
                <div class="form-group" id="duration-weeks-group" style="display: none;">
                    <label>Длительность (недель):</label>
                    <input type="number" id="effect-duration-weeks" value="1" min="1" style="width: 100%;">
                </div>
                <div class="form-group">
                    <label>Модификатор:</label>
                    <input type="number" id="effect-modifier" value="0" style="width: 100%;">
                    <div style="font-size: 10px; color: #666; margin-top: 2px;">Может быть отрицательным (штраф) или положительным (бонус)</div>
                </div>
                <div class="form-group">
                    <label>Применяется к проверкам:</label>
                    <div style="display: flex; gap: 15px; margin-top: 5px; flex-wrap: wrap;">
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="check-loyalty" value="loyalty"> Верность
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="check-security" value="security"> Безопасность
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="check-secrecy" value="secrecy"> Секретность
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="check-danger" value="danger"> Опасность
                        </label>
                    </div>
                </div>
            </form>
        `;
        
        const sheet = this;
        
        new Dialog({
            title: "Добавить кастомный модификатор",
            content: content,
            buttons: {
                add: {
                    label: "Добавить",
                    callback: async (html) => {
                        const name = html.find('#effect-name').val().trim();
                        if (!name) {
                            ui.notifications.warn("Введите название эффекта");
                            return;
                        }
                        
                        const desc = html.find('#effect-desc').val().trim();
                        const startType = html.find('#effect-start').val();
                        const durationType = html.find('#effect-duration-type').val();
                        const durationWeeks = parseInt(html.find('#effect-duration-weeks').val()) || 1;
                        const modifier = parseInt(html.find('#effect-modifier').val()) || 0;
                        
                        const affectedChecks = [];
                        if (html.find('#check-loyalty').is(':checked')) affectedChecks.push('loyalty');
                        if (html.find('#check-security').is(':checked')) affectedChecks.push('security');
                        if (html.find('#check-secrecy').is(':checked')) affectedChecks.push('secrecy');
                        if (html.find('#check-danger').is(':checked')) affectedChecks.push('danger');
                        
                        if (affectedChecks.length === 0) {
                            ui.notifications.warn("Выберите хотя бы одну проверку");
                            return;
                        }
                        
                        const weekStarted = startType === 'current' ? currentWeek : currentWeek + 1;
                        
                        const newEffect = {
                            name: name,
                            desc: desc || `Модификатор ${modifier >= 0 ? '+' : ''}${modifier}`,
                            weekStarted: weekStarted,
                            isPersistent: durationType === 'permanent',
                            duration: durationType === 'temporary' ? durationWeeks : null,
                            isCustomModifier: true,
                            modifierValue: modifier,
                            affectedChecks: affectedChecks
                        };
                        
                        const currentData = DataHandler.get();
                        if (!currentData.events) currentData.events = [];
                        currentData.events.push(newEffect);
                        
                        await DataHandler.update({ events: currentData.events });
                        
                        ui.notifications.info(`Модификатор "${name}" добавлен!`);
                        sheet.render(true);
                    }
                },
                cancel: {
                    label: "Отмена"
                }
            },
            default: "add",
            render: (html) => {
                // Toggle duration weeks input based on duration type
                html.find('#effect-duration-type').on('change', function() {
                    const isTemporary = $(this).val() === 'temporary';
                    html.find('#duration-weeks-group').toggle(isTemporary);
                });
            }
        }).render(true);
    }

    async _onDrop(event) {
        const d = TextEditor.getDragEventData(event);
        if (d.type !== "Actor") return;
        const actor = await fromUuid(d.uuid);
        if (!actor) return;
        const tab = this._tabs[0].active;
        if (tab === "teams") await this._addTeam(actor);
        else if (tab === "allies") await this._addAlly(actor);
        else ui.notifications.info("Используйте кнопки.");
    }

    async _addTeam(actor) {
        const d = DataHandler.get(); const rank = REBELLION_PROGRESSION[d.rank];
        // Count only non-unique teams for limit check
        const nonUniqueTeamCount = DataHandler.countOperationalTeams(d);
        if (nonUniqueTeamCount >= rank.maxTeams) ui.notifications.warn("Лимит!");
        const type = findTeamByActorName(actor.name);
        d.teams.push({ type, manager: "", disabled: false, missing: false, currentAction: "", managerLocked: false, actionLocked: false, canAutoRecover: false });
        await DataHandler.update({ teams: d.teams });
    }

    async _addAlly(actor) {
        const d = DataHandler.get(); const slug = findAllyByActorName(actor.name);
        let newAlly;
        if (slug) {
            const def = getAllyData(slug);
            newAlly = { slug, name: def.name, img: def.img, description: def.desc, missing: false, captured: false };
            if (def.hasState) newAlly.revealed = false; if (def.hasChoice) newAlly.selectedBonus = "loyalty";
        } else {
            newAlly = { slug: "generic", name: actor.name, img: actor.img, description: "Союзник", missing: false, captured: false };
        }
        if (slug && d.allies.some(a => a.slug === slug)) { ui.notifications.warn("Уже есть"); return; }
        if (slug && d.allies.some(a => a.slug === slug)) { ui.notifications.warn("Уже есть"); return; }
        // If unique, maybe just clear the actorId?
        // But the UI has a trash icon.
        // If I remove a unique role, my DataHandler.get() will restore it next time (empty).
        // So effectively it "Resets" it. That's fine.
        d.officers.splice(idx, 1);
        await DataHandler.update({ officers: d.officers });
    }

    async _onMitigateRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const btn = ev.currentTarget;
        // Prioritize data-skill, and ensure we don't accidentally pick up empty strings or unrelated data-type
        const skill = btn.dataset.skill || btn.dataset.mitigate;
        const dc = Number(btn.dataset.dc);
        const name = btn.dataset.event || btn.dataset.name;

        console.log(`=== _onMitigateRoll CLICKED ===`);
        console.log(`Button:`, btn);
        console.log(`Skill: ${skill}, DC: ${dc}, Name: ${name}`);

        if (!skill) {
            console.error("Rebellion: Mitigation button missing data-skill attribute!");
            ui.notifications.error("Ошибка кнопки: навык не указан.");
            return;
        }

        const isRebellionSkill = Object.keys(CHECK_LABELS).includes(skill);
        console.log(`Is Rebellion Skill? ${isRebellionSkill}`);

        const skillName = isRebellionSkill ? CHECK_LABELS[skill] : (PF2E_SKILL_LABELS[skill] || skill);

        // Ensure skillName is not undefined
        if (!skillName) {
            console.error(`Rebellion: Could not resolve skill name for '${skill}'`);
            ui.notifications.warn(`Неизвестный навык: ${skill}`);
            return;
        }

        if (isRebellionSkill) {
            // Perform Rebellion Organization Check via Chat
            const data = DataHandler.get();
            const bonuses = DataHandler.getRollBonuses(data);
            const checkBonus = bonuses[skill] || { total: 0, parts: [] }; // Fallback if missing

            // Use PF2e System Roll if available to show standard dialog
            console.log(`Checking for PF2e System API...`);

            if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
                console.log(`PF2e API found. Attempting standard roll...`);
                const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                    label: p.label,
                    modifier: p.value,
                    type: "untyped"
                }));

                const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
                if (!actor) console.warn("Rebellion: Still no actor found. Dialog might not appear.");

                try {
                    // Set state for main.js hook to recognize this roll
                    game.rebellionState = {
                        isMitigation: true,
                        eventName: name,
                        timestamp: Date.now()
                    };
                    console.log("Rebellion: State set for mitigation roll:", game.rebellionState);

                    await game.pf2e.Check.roll(
                        new game.pf2e.CheckModifier(skillName, { modifiers }),
                        {
                            actor: actor,
                            type: 'check',
                            createMessage: true,
                            skipDialog: false,
                            dc: { value: dc },
                            // check: { label: skillName }, // Removed as it might cause duplication or issues in some system versions
                            context: {
                                type: "skill-check",
                                skill: skill,
                                action: skill,
                                isMitigation: true,
                                eventName: name
                            }
                        },
                        ev
                    );
                    console.log("PF2e Check.roll promise resolved.");
                } catch (err) {
                    console.error("Rebellion: PF2e Check.roll failed:", err);
                    throw err;
                } finally {
                    // Cleanup state - Long timeout to allow user to config roll dialog
                    setTimeout(() => {
                        game.rebellionState = null;
                        console.log("Rebellion: State cleared.");
                    }, 60000);
                }
            } else {
                // Fallback if PF2e API is missing methods
                const r = new Roll("1d20 + @bonus", { bonus: checkBonus.total });
                await r.evaluate();
                content: `<h5 class="action">Проверка: ${skillName}</h5>`;
                await r.toMessage({
                    speaker: ChatMessage.getSpeaker(),
                    flavor: flavor,
                    flags: {
                        pf2e: {
                            context: {
                                type: "skill-check",
                                skill: skill
                            }
                        },
                        "pf2e-ts-adv-pf1ehr": {
                            isMitigation: true,
                            eventName: name
                        }
                    }
                });
            }
        } else {
            // Create a chat message with the interactive mitigation button (same style as in _onEventRoll)
            const content = `<p>Для смягчения события <strong>${name}</strong> требуется проверка:</p>
            <button class="pf2e-mitigation-btn"
                    data-event="${name}"
                    data-skill="${skill}"
                    data-dc="${dc}">
                🎲 Смягчить ${skillName} (КС ${dc})
            </button>`;

            ChatMessage.create({
                content: content,
                speaker: ChatMessage.getSpeaker(),
                flags: {
                    "pf2e-ts-adv-pf1ehr": {
                        isMitigation: true,
                        eventName: name
                    }
                }
            });
        }
    }

    // Helper method to handle mitigation results
    async _handleMitigationResult(eventName, skillName, dc, checkBonus, data, success = null, roll = null, total = null) {
        if (success === null) {
            // If success is null, we need to get the result from the user
            let content = `<form>
                <div class="form-group">
                    <label>Результат броска:</label>
                    <select name="result">
                        <option value="success">Успех</option>
                        <option value="failure">Провал</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Если известен бросок кубика:</label>
                    <input type="number" name="rollTotal" placeholder="1d20">
                    <input type="number" name="total" placeholder="Сумма">
                </div>
            </form>`;

            new Dialog({
                title: `Результат смягчения: ${skillName}`,
                content,
                buttons: {
                    confirm: {
                        label: "Подтвердить",
                        callback: async (html) => {
                            const result = html.find('[name="result"]').val();
                            const rollTotal = parseInt(html.find('[name="rollTotal"]').val()) || null;
                            const totalVal = parseInt(html.find('[name="total"]').val()) || null;

                            const isSuccess = result === "success";
                            const r = rollTotal ? new Roll(`1d20[${rollTotal}]`) : new Roll("1d20");
                            const t = totalVal || (rollTotal ? rollTotal + checkBonus.total : null);

                            await this._handleMitigationResult(eventName, skillName, dc, checkBonus, data, isSuccess, r, t);
                        }
                    }
                },
                default: "confirm"
            }).render(true);
            return;
        }

        let resultColor = success ? "green" : "red";
        let resultText = success ? "УСПЕХ" : "ПРОВАЛ";
        let resultIcon = success ? "✅" : "❌";

        let message = `<h5>🛡️ Смягчение события: ${eventName}</h5>
            <p>Проверка ${skillName}:`;

        if (roll && total !== null) {
            let dieResult = "?";
            // Try to extract d20 result from various roll structures
            if (roll.terms && roll.terms.length > 0) {
                const dieTerm = roll.terms.find(t => t.faces === 20);
                if (dieTerm && dieTerm.results && dieTerm.results[0]) {
                    dieResult = dieTerm.results[0].result;
                } else if (roll.dice && roll.dice.length > 0 && roll.dice[0].faces === 20) {
                    dieResult = roll.dice[0].total;
                }
            }
            // Fallback if structure is unknown but we have total
            if (dieResult === "?") dieResult = total;

            // Handle case where roll might be a plain object
            if (typeof roll.evaluate !== 'function' && !roll.terms && roll.dice) {
                // It might be a simplified roll object from message
                if (roll.dice.length > 0 && roll.dice[0].results && roll.dice[0].results[0]) {
                    dieResult = roll.dice[0].results[0].result;
                }
            }

            const dieVal = Number(dieResult) || 0;
            const bonus = total - dieVal;
            message += ` <strong>1d20(${dieResult}) + ${bonus} = ${total}</strong> против КС ${dc}</p>`;
        } else {
            message += ` <strong>КС ${dc}</strong></p>`;
        }

        message += `<p style="color:${resultColor}"><strong>${resultIcon} ${resultText}</strong></p>`;

        if (success) {
            // Для событий со специальной обработкой смягчения не удаляем событие, а только смягчаем эффект
            if (eventName === "Опасные времена" || 
                eventName === "Усиленные патрули" || 
                eventName === "Низкий боевой дух" || 
                eventName === "Болезнь" || 
                eventName === "Разлад в рядах") {
                message += `<p style="color:green"><strong>Событие "${eventName}" смягчено!</strong></p>`;
                // Apply specific mitigation effects based on event type
                await this._applyEventMitigationEffects(eventName, message);
            } else {
                // Remove the event effect for other events
                const updatedEvents = data.events.filter(e => e.name !== eventName);
                await DataHandler.update({ events: updatedEvents });

                message += `<p style="color:green"><strong>Эффект события "${eventName}" удалён!</strong></p>`;

                if (eventName === "Провальный протест") {
                    message += `<p>Провальный протест отменён! Потери сторонников и населения предотвращены.</p>`;
                }

                // Apply specific mitigation effects based on event type
                await this._applyEventMitigationEffects(eventName, message);
            }
        } else {
            message += `<p style="color:red"><strong>Эффект события остаётся в силе.</strong></p>`;
        }

        // Show result immediately in chat
        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    async _onPlayerSkillRoll(ev) {
        ev.preventDefault();
        const skill = ev.currentTarget.dataset.skill;
        const dc = Number(ev.currentTarget.dataset.dc);
        const name = ev.currentTarget.dataset.event; // Event name
        const skillName = PF2E_SKILL_LABELS[skill] || skill;

        // Actor selection logic
        let actor = null;
        if (canvas.tokens.controlled.length > 0) {
            actor = canvas.tokens.controlled[0].actor;
        } else {
            actor = game.user.character;
        }

        if (!actor) {
            ui.notifications.warn("Для броска из листа персонажа нужно выбрать токен на сцене или назначить персонажа!");
            return;
        }

        const statistic = actor.getStatistic(skill);
        if (!statistic) {
            ui.notifications.warn(`У актера ${actor.name} не найден навык ${skillName}!`);
            return;
        }

        try {
            // Set State for detection
            game.rebellionState = {
                isMitigation: true,
                eventName: name,
                timestamp: Date.now()
            };
            console.log("Rebellion: State set for Player Skill roll:", game.rebellionState);

            await statistic.roll({
                dc: { value: dc },
                skipDialog: false, // Force dialog so user can verify bonuses
                extraRollOptions: ["action:" + skill, "mitigate"], // Tag it
                // Pass flags/context explicitly if possible (depends on PF2e version)
                context: {
                    isMitigation: true,
                    eventName: name
                },
                event: ev
            });
            console.log("PF2e Statistic.roll promise resolved.");

        } catch (err) {
            console.error("Rebellion: Player Skill Roll failed:", err);
        } finally {
            // Cleanup state - Long timeout to allow user to config roll dialog
            setTimeout(() => {
                game.rebellionState = null;
                console.log("Rebellion: State cleared (Player Skill).");
            }, 60000);
        }
    }

    async _onStukachRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onStukachRoll CLICKED ===");
        
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.loyalty || { total: 0, parts: [] };
        const dc = 15;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isStukachRoll: true,
                    eventName: "Стукач",
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска Стукач:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Верность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "loyalty",
                            action: "loyalty",
                            isStukachRoll: true,
                            eventName: "Стукач"
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для Стукач.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackStukachRoll(data, checkBonus, dc);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Стукач).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackStukachRoll(data, checkBonus, dc);
        }
    }

    // Fallback функция для броска Стукач без PF2e API
    async _fallbackStukachRoll(data, checkBonus, dc) {
        const loyaltyRoll = new Roll("1d20");
        await loyaltyRoll.evaluate();
        const total = loyaltyRoll.total + checkBonus.total;
        
        let message = `<h5>🕵️ Событие: Стукач</h5>`;
        message += `<p><strong>Проверка Верности:</strong> ${loyaltyRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= dc) {
            message += `<p style="color:green"><strong>✅ Успех!</strong> Стукач нейтрализован! Верные сторонники справились с ситуацией.</p>`;
            message += `<p><strong>Последствия:</strong> Потеря 1 сторонника, но никаких дальнейших проблем.</p>`;
            await DataHandler.update({ supporters: Math.max(0, data.supporters - 1) });
        } else {
            const notRoll = new Roll("1d6");
            await notRoll.evaluate();
            const notGain = notRoll.total;
            message += `<p style="color:red"><strong>❌ Провал!</strong> Стукач ускользнул! Информация попала к врагам.</p>`;
            message += `<p><strong>Последствия:</strong> Потеря 1 сторонника, +${notGain} Известность.</p>`;
            await DataHandler.update({
                supporters: Math.max(0, data.supporters - 1),
                notoriety: data.notoriety + notGain
            });
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isStukachRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onTraitorRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onTraitorRoll CLICKED ===");
        
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.loyalty || { total: 0, parts: [] };
        const dc = 20;
        const teamType = ev.currentTarget.dataset.teamType;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isTraitorRoll: true,
                    eventName: "Предатель",
                    teamType: teamType,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска Предатель:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Верность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "loyalty",
                            action: "loyalty",
                            isTraitorRoll: true,
                            eventName: "Предатель",
                            teamType: teamType
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для Предатель.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackTraitorRoll(data, checkBonus, dc, teamType);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Предатель).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackTraitorRoll(data, checkBonus, dc, teamType);
        }
    }

    // Fallback функция для броска Предатель без PF2e API
    async _fallbackTraitorRoll(data, checkBonus, dc, teamType) {
        const loyaltyRoll = new Roll("1d20");
        await loyaltyRoll.evaluate();
        const total = loyaltyRoll.total + checkBonus.total;
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>🕵️ Событие: Предатель</h5>`;
        message += `<p><strong>Проверка Верности:</strong> ${loyaltyRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= 20) {
            message += `<p style="color:green"><strong>✅ Успех!</strong> Предатель в команде ${traitorTeamDef.label} обнаружен и пойман до того, как смог нанести значительный ущерб.</p>`;
            message += `<p><strong>Что делать с предателем?</strong></p>`;
            
            // Кнопки выбора действий с предателем
            message += `<div style="margin: 10px 0;">
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
            message += `<p style="color:red"><strong>❌ Провал!</strong> Предатель в команде ${traitorTeamDef.label} сбежал!</p>`;
            message += `<p><strong>Последствия:</strong> Команда недееспособна, +${notGain} Известность.</p>`;
            await DataHandler.update({
                notoriety: data.notoriety + notGain
            });
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isTraitorRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onFailedProtestRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onFailedProtestRoll CLICKED ===");
        
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.security || { total: 0, parts: [] };
        const dc = 25;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isFailedProtestRoll: true,
                    eventName: "Провальный протест",
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска Провальный протест:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Безопасность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "security",
                            action: "security",
                            isFailedProtestRoll: true,
                            eventName: "Провальный протест"
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для Провальный протест.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackFailedProtestRoll(data, checkBonus, dc);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Провальный протест).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackFailedProtestRoll(data, checkBonus, dc);
        }
    }

    // Fallback функция для броска Провальный протест без PF2e API
    async _fallbackFailedProtestRoll(data, checkBonus, dc) {
        const securityRoll = new Roll("1d20");
        await securityRoll.evaluate();
        const total = securityRoll.total + checkBonus.total;
        
        // Случайный модификатор поселения (всегда применяется)
        const settlementModifiers = ["Коррупция", "Преступность", "Экономика", "Закон", "Знание", "Общество"];
        const randomModifier = settlementModifiers[Math.floor(Math.random() * settlementModifiers.length)];
        
        // Добавляем временное событие с модификатором поселения
        const events = JSON.parse(JSON.stringify(data.events || []));
        events.push({
            name: "Провальный протест",
            desc: `Модификатор поселения Кинтарго "${randomModifier}" уменьшен на 4`,
            weekStarted: data.week + 1,
            duration: 1,
            isPersistent: false
        });
        
        let message = `<h5>🏛️ Событие: Провальный протест</h5>`;
        message += `<p><strong>Проверка Безопасности:</strong> ${securityRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= dc) {
            message += `<p style="color:green"><strong>✅ Успех!</strong> Потери сторонников предотвращены успешной проверкой Безопасности!</p>`;
            message += `<p style="color:black">Однако модификатор поселения Кинтарго "${randomModifier}" все равно уменьшен на 4 на следующую неделю.</p>`;
            await DataHandler.update({ events });
        } else {
            const suppRoll = new Roll("2d6");
            await suppRoll.evaluate();
            const loss = suppRoll.total;
            message += `<p style="color:red"><strong>❌ Провал!</strong> Протест провалился! Сторонники разочарованы.</p>`;
            message += `<p><strong>Последствия:</strong> Потеря ${loss} сторонников и населения. Модификатор поселения Кинтарго "${randomModifier}" уменьшен на 4 на следующую неделю.</p>`;
            await DataHandler.update({
                supporters: Math.max(0, data.supporters - loss),
                population: Math.max(0, data.population - loss),
                events
            });
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isFailedProtestRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onCatastrophicMissionRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onCatastrophicMissionRoll CLICKED ===");
        
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.security || { total: 0, parts: [] };
        const dc = 20;
        const teamType = ev.currentTarget.dataset.teamType;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isCatastrophicMissionRoll: true,
                    eventName: "Катастроф. миссия",
                    teamType: teamType,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска Катастрофическая миссия:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Безопасность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "security",
                            action: "security",
                            isCatastrophicMissionRoll: true,
                            eventName: "Катастроф. миссия",
                            teamType: teamType
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для Катастрофическая миссия.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackCatastrophicMissionRoll(data, checkBonus, dc, teamType);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Катастрофическая миссия).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackCatastrophicMissionRoll(data, checkBonus, dc, teamType);
        }
    }

    // Fallback функция для броска Катастрофическая миссия без PF2e API
    async _fallbackCatastrophicMissionRoll(data, checkBonus, dc, teamType) {
        const securityRoll = new Roll("1d20");
        await securityRoll.evaluate();
        const total = securityRoll.total + checkBonus.total;
        
        // Бросок на известность в любом случае
        const notorietyRoll = new Roll("1d6");
        await notorietyRoll.evaluate();
        const notorietyGain = notorietyRoll.total;
        
        const teams = JSON.parse(JSON.stringify(data.teams));
        const teamIndex = teams.findIndex(t => t.type === teamType);
        const teamDef = getTeamDefinition(teamType);
        
        let message = `<h5>⚔️ Событие: Катастрофическая миссия</h5>`;
        message += `<p><strong>Проверка Безопасности:</strong> ${securityRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= 20) {
            message += `<p style="color:green"><strong>✅ Успех!</strong> Команда ${teamDef.label} достигла цели, но получила значительный урон. Команда становится недееспособной.</p>`;
            if (teamIndex !== -1) teams[teamIndex].disabled = true;
        } else {
            message += `<p style="color:red"><strong>❌ Провал!</strong> Команда ${teamDef.label} достигла цели, но получила критический урон. Команда уничтожена и должна быть заменена.</p>`;
            if (teamIndex !== -1) teams.splice(teamIndex, 1);
        }
        
        message += `<p style="color:red">Известность увеличена на ${notorietyGain}.</p>`;
        
        await DataHandler.update({ 
            teams, 
            notoriety: data.notoriety + notorietyGain 
        });
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isCatastrophicMissionRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onIgnoreInvasion(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onIgnoreInvasion CLICKED ===");
        
        const data = DataHandler.get();
        // Ищем команды которые могут быть потеряны или выведены из строя
        const availableTeams = data.teams.filter(t => !t.disabled && !t.missing);
        
        console.log("Доступные команды для эффектов вторжения:", availableTeams.length);
        console.log("Все команды:", data.teams.map(t => ({ name: t.name, status: t.status })));
        
        // Бросаем 1d4 для потерянных команд
        const lostTeamsRoll = new Roll("1d4");
        await lostTeamsRoll.evaluate();
        const lostTeamsCount = Math.min(lostTeamsRoll.total, availableTeams.length);
        
        // Бросаем 1d4 для недееспособных команд
        const disabledTeamsRoll = new Roll("1d4");
        await disabledTeamsRoll.evaluate();
        const disabledTeamsCount = Math.min(disabledTeamsRoll.total, Math.max(0, availableTeams.length - lostTeamsCount));
        
        let teamsToLose = [];
        let teamsToDisable = [];
        let updatedTeams = [...data.teams];
        
        // Применяем эффекты только если есть доступные команды
        if (availableTeams.length > 0) {
            // Выбираем случайные команды для потери
            const shuffledTeams = [...availableTeams].sort(() => Math.random() - 0.5);
            teamsToLose = shuffledTeams.slice(0, lostTeamsCount);
            teamsToDisable = shuffledTeams.slice(lostTeamsCount, lostTeamsCount + disabledTeamsCount);
            
            // Применяем эффекты к командам
            updatedTeams = data.teams.map(team => {
                if (teamsToLose.find(t => t.type === team.type)) {
                    return { ...team, missing: true };
                } else if (teamsToDisable.find(t => t.type === team.type)) {
                    return { ...team, disabled: true };
                }
                return team;
            });
        }
        
        // Добавляем постоянное событие "Низкий боевой дух"
        const currentEvents = data.events || [];
        const lowMoraleEvent = {
            name: "Низкий боевой дух",
            desc: "Постоянный низкий боевой дух. -4 Верность. Смягчение: Выступление КС 20 снижает до -2.",
            weekStarted: data.week,
            duration: 999, // Постоянное событие
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
        
        // Обновляем данные
        await DataHandler.update({ 
            teams: updatedTeams,
            events: currentEvents
        });
        
        // Создаем сообщение о результатах
        let message = `<h5><i class="fas fa-crow header-logo"></i> Вторжение проигнорировано!</h5>`;
        message += `<p style="color:red">Серебряные Вороны сами справились с захватчиком, но понесли потери:</p>`;
        
        if (availableTeams.length > 0) {
            message += `<p><strong>Потеряно команд:</strong> ${lostTeamsCount} (бросок: ${lostTeamsRoll.total})</p>`;
            if (teamsToLose.length > 0) {
                message += `<ul>`;
                teamsToLose.forEach(team => {
                    const teamDef = TEAMS[team.type];
                    const teamName = teamDef ? teamDef.label : team.type;
                    message += `<li style="color:red">${teamName} - пропала</li>`;
                });
                message += `</ul>`;
            }
            
            message += `<p><strong>Недееспособных команд:</strong> ${disabledTeamsCount} (бросок: ${disabledTeamsRoll.total})</p>`;
            if (teamsToDisable.length > 0) {
                message += `<ul>`;
                teamsToDisable.forEach(team => {
                    const teamDef = TEAMS[team.type];
                    const teamName = teamDef ? teamDef.label : team.type;
                    message += `<li style="color:#d84315">${teamName} - недееспособна</li>`;
                });
                message += `</ul>`;
            }
        } else {
            message += `<p style="color:#d84315"><strong>Нет доступных команд для потерь</strong> (бросок потерь: ${lostTeamsRoll.total}, бросок недееспособности: ${disabledTeamsRoll.total})</p>`;
        }
        
        message += `<p style="color:red"><strong>Постоянный эффект:</strong> Восстание получает событие "Низкий боевой дух" (-4 Верность).</p>`;
        message += `<p><em>Событие "Низкий боевой дух" можно смягчить проверкой Выступления КС 20.</em></p>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        // Отключаем кнопку после использования
        $(ev.currentTarget).prop('disabled', true).text('Эффекты применены');
        
        this.render();
    }

    /**
     * Обработчик результата спасения персонажа
     */
    async _onRescueResult(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onRescueResult CLICKED ===");
        
        const rollTotal = parseInt($(ev.currentTarget).data('roll-total')) || 0;
        
        // Запрашиваем уровень персонажа
        const level = await new Promise((resolve) => {
            new Dialog({
                title: "Спасение персонажа",
                content: `
                    <form>
                        <div class="form-group">
                            <label>Уровень спасаемого персонажа:</label>
                            <input type="number" name="level" min="1" max="20" value="1" style="width: 60px;">
                        </div>
                        <p style="color: #666; font-size: 0.9em;">КС = 10 + уровень персонажа</p>
                    </form>
                `,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "Определить результат",
                        callback: (html) => {
                            const lvl = parseInt(html.find('[name="level"]').val()) || 1;
                            resolve(Math.max(1, Math.min(20, lvl)));
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Отмена",
                        callback: () => resolve(null)
                    }
                },
                default: "ok"
            }).render(true);
        });
        
        if (level === null) return;
        
        const dc = 10 + level;
        const success = rollTotal >= dc;
        const data = DataHandler.get();
        const notorietyIncrease = success ? level : Math.floor(level / 2);
        
        await DataHandler.update({ 
            notoriety: data.notoriety + notorietyIncrease 
        });
        
        let message;
        if (success) {
            message = `
                <div style="border: 2px solid #2e7d32; padding: 15px; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 12px; margin: 10px 0;">
                    <h5 style="color: #2e7d32; margin: 0 0 10px 0;">✅ Спасение успешно!</h5>
                    <p>Результат броска: <strong>${rollTotal}</strong> vs КС <strong>${dc}</strong> (10 + ${level})</p>
                    <p>Персонаж уровня <strong>${level}</strong> спасён.</p>
                    <p style="color: #d32f2f;"><strong>Известность +${notorietyIncrease}</strong></p>
                </div>
            `;
        } else {
            message = `
                <div style="border: 2px solid #d32f2f; padding: 15px; background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); border-radius: 12px; margin: 10px 0;">
                    <h5 style="color: #d32f2f; margin: 0 0 10px 0;">❌ Спасение провалено!</h5>
                    <p>Результат броска: <strong>${rollTotal}</strong> vs КС <strong>${dc}</strong> (10 + ${level})</p>
                    <p>Попытка спасти персонажа уровня <strong>${level}</strong> не удалась.</p>
                    <p style="color: #d32f2f;"><strong>Известность +${notorietyIncrease}</strong> (половина уровня)</p>
                    <p><em>Персонаж не спасён.</em></p>
                </div>
            `;
        }
        
        await ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
        
        // Отключаем кнопку
        $(ev.currentTarget).prop('disabled', true).text(success ? '✅ Успех' : '❌ Провал');
        
        this.render();
    }

    /**
     * Обработчик выбора события при манипулировании (Каббалисты)
     */
    async _onManipulateChooseEvent(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        const button = ev.currentTarget;
        const eventIndex = parseInt(button.dataset.eventIndex);
        const eventName = button.dataset.eventName;
        
        console.log("=== _onManipulateChooseEvent CLICKED ===");
        console.log("Выбран индекс события:", eventIndex);
        console.log("Название события:", eventName);
        
        const data = DataHandler.get();
        
        // Находим ожидающий выбор события
        const pendingChoice = data.events?.find(e => e.pendingEventChoice);
        if (!pendingChoice) {
            ui.notifications.warn("Нет ожидающего выбора события!");
            return;
        }
        
        // Получаем выбранное событие
        const chosenEvent = eventIndex === 1 ? pendingChoice.event1 : pendingChoice.event2;
        const chosenRoll = eventIndex === 1 ? pendingChoice.roll1 : pendingChoice.roll2;
        const charismaBonus = pendingChoice.charismaBonus || 0;
        const managerName = pendingChoice.managerName || "Командир каббалистов";
        
        console.log("Выбранное событие:", chosenEvent);
        console.log("Бросок:", chosenRoll);
        console.log("Бонус Харизмы:", charismaBonus);
        
        // Удаляем ожидающий выбор из событий
        const updatedEvents = data.events.filter(e => !e.pendingEventChoice);
        await DataHandler.update({ events: updatedEvents, weeksWithoutEvent: 0 });
        
        // Формируем сообщение о выборе
        let message = `
            <div style="
                border: 3px solid #9c27b0; 
                padding: 15px; 
                background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); 
                border-radius: 12px; 
                margin: 10px 0;
            ">
                <h5 style="color: #7b1fa2; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5em;">🎭</span>
                    Манипулирование событиями - Выбор сделан
                </h5>
                <p><strong>${managerName}</strong> выбрал событие:</p>
                <h5 style="color: ${chosenEvent.positive ? '#2e7d32' : '#c62828'}; margin: 10px 0;">
                    ${chosenEvent.positive ? '✅' : '⚠️'} ${chosenEvent.name}
                </h5>
                <p>${chosenEvent.desc}</p>
                ${!chosenEvent.positive && charismaBonus > 0 ? `
                    <p style="color: #7b1fa2; font-style: italic;">
                        💡 При бросках d20 для этого события можно добавить +${charismaBonus} (Харизма командира).
                    </p>
                ` : ''}
            </div>
        `;
        
        // Применяем эффекты выбранного события
        const effectsMessage = await this._applyEventEffects(chosenEvent, DataHandler.get());
        message += effectsMessage;
        
        // Если событие вредное и есть бонус Харизмы, сохраняем его для будущих бросков
        if (!chosenEvent.positive && charismaBonus > 0) {
            const currentData = DataHandler.get();
            const events = currentData.events || [];
            events.push({
                name: "Бонус Харизмы (Каббалисты)",
                desc: `+${charismaBonus} к броскам d20 для события "${chosenEvent.name}"`,
                weekStarted: currentData.week,
                duration: 1,
                isPersistent: false,
                isActionEffect: true,
                charismaBonus: charismaBonus,
                forEvent: chosenEvent.name
            });
            await DataHandler.update({ events });
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        // Отключаем обе кнопки выбора
        $(button).closest('.manipulate-choose-event-btn').parent().find('.manipulate-choose-event-btn')
            .prop('disabled', true)
            .css('opacity', '0.5');
        $(button).text('✓ Выбрано');
        
        this.render();
    }

    // Helper method to handle player skill mitigation results
    async _handlePlayerSkillMitigationResult(eventName, skillName, dc, actor = null, success = null, roll = null, total = null) {
        console.log("=== _handlePlayerSkillMitigationResult вызван ===");
        console.log("Событие:", eventName);
        console.log("Навык:", skillName);
        console.log("DC:", dc);
        console.log("Актер:", actor ? actor.name : 'null');
        console.log("Успех:", success);
        console.log("Бросок:", roll);
        console.log("Сумма:", total);

        if (success === null) {
            // If success is null, we need to get the result from the user
            let content = `<form>
                <div class="form-group">
                    <label>Результат броска:</label>
                    <select name="result">
                        <option value="success">Успех</option>
                        <option value="failure">Провал</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Если известен бросок кубика:</label>
                    <input type="number" name="rollTotal" placeholder="1d20">
                    <input type="number" name="total" placeholder="Сумма">
                </div>
            </form>`;

            new Dialog({
                title: `Результат смягчения: ${skillName}`,
                content,
                buttons: {
                    confirm: {
                        label: "Подтвердить",
                        callback: async (html) => {
                            const result = html.find('[name="result"]').val();
                            const rollTotal = parseInt(html.find('[name="rollTotal"]').val()) || null;
                            const totalVal = parseInt(html.find('[name="total"]').val()) || null;

                            const isSuccess = result === "success";
                            const r = rollTotal ? new Roll(`1d20[${rollTotal}]`) : new Roll("1d20");
                            const t = totalVal || (rollTotal ? rollTotal : null);

                            await this._handlePlayerSkillMitigationResult(eventName, skillName, dc, actor, isSuccess, r, t);
                        }
                    }
                },
                default: "confirm"
            }).render(true);
            return;
        }

        console.log("=== Создание сообщения о результате ===");

        let resultColor = success ? "green" : "red";
        let resultText = success ? "УСПЕХ" : "ПРОВАЛ";
        let resultIcon = success ? "✅" : "❌";

        let message = `<h5>🛡️ Смягчение события: ${eventName}</h5>
            <p>Проверка ${skillName}:`;

        if (roll && total !== null) {
            message += ` <strong>1d20(${roll.total}) + ${total - roll.total} = ${total}</strong> против КС ${dc}</p>`;
        } else {
            message += ` <strong>КС ${dc}</strong></p>`;
        }

        message += `<p style="color:${resultColor}"><strong>${resultIcon} ${resultText}</strong></p>`;

        if (success) {
            console.log("=== Успех! Применяем эффекты смягчения ===");
            
            // Для событий со специальной обработкой смягчения не удаляем событие, а только смягчаем эффект
            if (eventName === "Опасные времена" || 
                eventName === "Усиленные патрули" || 
                eventName === "Низкий боевой дух" || 
                eventName === "Болезнь" || 
                eventName === "Разлад в рядах") {
                message += `<p style="color:green"><strong>Событие "${eventName}" смягчено!</strong></p>`;
            } else {
                // Remove the event effect for other events
                const data = DataHandler.get();
                const updatedEvents = data.events.filter(e => e.name !== eventName);
                await DataHandler.update({ events: updatedEvents });

                message += `<p style="color:green"><strong>Эффект события "${eventName}" удалён!</strong></p>`;
            }

            // Apply specific mitigation effects based on event type
            await this._applyEventMitigationEffects(eventName, message);
        } else {
            console.log("=== Провал! Эффект остаётся ===");
            message += `<p style="color:red"><strong>Эффект события остаётся в силе.</strong></p>`;
        }

        console.log("=== Отправка сообщения в чат ===");
        console.log("Сообщение:", message);

        // Show result immediately in chat
        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    // Apply specific mitigation effects based on event type
    async _applyEventMitigationEffects(eventName, message) {
        console.log("=== _applyEventMitigationEffects вызван ===");
        console.log("Событие:", eventName);
        console.log("Сообщение:", message);

        const data = DataHandler.get();

        switch (eventName) {
            // "Стукач" убран - не имеет возможности смягчения

            case "Соперничество":
                // Remove rivalry effects from teams
                await DataHandler.removeRivalryEffects(data);
                
                // Принудительный полный ререндер для обновления визуального отображения
                this.render(true);
                
                // Find the rivalry event to get affected teams for message
                const rivalryEvent = data.events.find(e => e.name === "Соперничество");
                
                if (rivalryEvent && rivalryEvent.affectedTeams) {
                    const teamNames = rivalryEvent.affectedTeams.map(type => getTeamDefinition(type).label).join(", ");
                    if (rivalryEvent.isPersistent) {
                        message += `<p style="color:green">Постоянное соперничество улажено! Команды ${teamNames} восстановлены навсегда.</p>`;
                    } else {
                        message += `<p style="color:green">Соперничество улажено! Команды ${teamNames} восстановлены.</p>`;
                    }
                } else {
                    message += `<p style="color:green">Соперничество улажено! Все заблокированные команды восстановлены.</p>`;
                }
                break;

            case "Опасные времена":
                console.log("🛡️ СМЯГЧЕНИЕ СОБЫТИЯ 'Опасные времена'");
                
                // Находим событие в активных событиях
                const currentEvents = data.events || [];
                const dangerousEvent = currentEvents.find(e => e.name === "Опасные времена");
                
                if (dangerousEvent && !dangerousEvent.mitigated) {
                    // Помечаем событие как смягченное
                    dangerousEvent.mitigated = true;
                    dangerousEvent.dangerIncrease = 5; // Уменьшаем с 10 до 5
                    
                    // Обновляем только событие, не базовую опасность
                    await DataHandler.update({ events: currentEvents });
                    
                    if (dangerousEvent.isPersistent) {
                        message += `<p style="color:green">Постоянные опасные времена смягчены! Увеличение опасности уменьшено до +5.</p>`;
                    } else {
                        message += `<p style="color:green">Опасные времена смягчены! Увеличение опасности уменьшено до +5.</p>`;
                    }
                    
                    console.log("✅ Событие смягчено, эффект уменьшен с +10 до +5");
                } else if (dangerousEvent && dangerousEvent.mitigated) {
                    message += `<p style="color:#d84315">Опасные времена уже смягчены.</p>`;
                    console.log("⚠️ Событие уже смягчено");
                } else {
                    message += `<p style="color:#d84315">Событие "Опасные времена" не найдено для смягчения.</p>`;
                    console.log("⚠️ Событие не найдено");
                }
                break;



            case "Тайник обнаружен":
                // If mitigated, reduce loss
                if (data.caches && data.caches.length > 0) {
                    const caches = JSON.parse(JSON.stringify(data.caches));
                    caches.pop(); // Remove last cache instead of random
                    await DataHandler.update({ caches });
                    message += `<p style="color:green">Тайник обнаружен, но часть припасов спасена.</p>`;
                } else {
                    const lossRoll = new Roll("1d4");
                    await lossRoll.evaluate();
                    const loss = lossRoll.total;
                    await DataHandler.update({
                        supporters: Math.max(0, data.supporters - loss),
                        population: Math.max(0, data.population - loss)
                    });
                    message += `<p style="color:green">Потери сторонников и населения снижены.</p>`;
                }
                break;

            case "Усиленные патрули":
                // Отмечаем событие как смягченное
                const patrolsEvents = data.events || [];
                const patrolsEvent = patrolsEvents.find(e => e.name === "Усиленные патрули");
                if (patrolsEvent) {
                    patrolsEvent.mitigated = true;
                    await DataHandler.update({ events: patrolsEvents });
                    message += `<p style="color:green">Патрули обмануты! Штраф к Секретности снижен до -2.</p>`;
                } else {
                    message += `<p style="color:#d84315">Событие 'Усиленные патрули' не найдено для смягчения.</p>`;
                }
                break;

            case "Низкий боевой дух":
                // Отмечаем событие как смягченное
                const moraleEvents = data.events || [];
                const moraleEvent = moraleEvents.find(e => e.name === "Низкий боевой дух");
                if (moraleEvent) {
                    moraleEvent.mitigated = true;
                    await DataHandler.update({ events: moraleEvents });
                    message += `<p style="color:green">Мораль восстановлена! Штраф к Верности снижен до -2.</p>`;
                } else {
                    message += `<p style="color:#d84315">Событие 'Низкий боевой дух' не найдено для смягчения.</p>`;
                }
                break;

            case "Болезнь":
                // Отмечаем событие как смягченное
                const diseaseEvents = data.events || [];
                const diseaseEvent = diseaseEvents.find(e => e.name === "Болезнь");
                if (diseaseEvent) {
                    diseaseEvent.mitigated = true;
                    await DataHandler.update({ events: diseaseEvents });
                    message += `<p style="color:green">Болезнь остановлена! Штраф к Безопасности снижен до -2.</p>`;
                } else {
                    message += `<p style="color:#d84315">Событие 'Болезнь' не найдено для смягчения.</p>`;
                }
                break;

            case "Недееспособная команда":
                // Смягчение: потратить золото равное минимальной казне для восстановления команды
                const minTreasury = DataHandler.getMinTreasury(data);
                const eventDisabledTeams = data.teams.filter(t => t.disabled && t.disabledByEvent);
                
                if (eventDisabledTeams.length === 0) {
                    message += `<p style="color:#d84315">Нет команд, недееспособных из-за события "Недееспособная команда".</p>`;
                    break;
                }
                
                const totalCost = eventDisabledTeams.length * minTreasury;
                
                if (data.treasury < totalCost) {
                    message += `<p style="color:red">Недостаточно золота для смягчения! Нужно ${totalCost} зм (${minTreasury} зм за команду), а в казне ${data.treasury} зм.</p>`;
                    break;
                }
                
                const teams3 = JSON.parse(JSON.stringify(data.teams));
                const restoredTeams = [];
                
                teams3.forEach(team => {
                    if (team.disabled && team.disabledByEvent) {
                        team.disabled = false;
                        team.disabledByEvent = false;
                        const def = getTeamDefinition(team.type);
                        restoredTeams.push(def.label);
                    }
                });
                
                await DataHandler.update({ 
                    teams: teams3, 
                    treasury: data.treasury - totalCost 
                });
                
                message += `<p style="color:green">Команды восстановлены за ${totalCost} зм! Восстановлены: ${restoredTeams.join(", ")}</p>`;
                break;

            case "Разлад в рядах":
                // Отмечаем событие как смягченное
                const disorderEvents = data.events || [];
                const disorderEvent = disorderEvents.find(e => e.name === "Разлад в рядах");
                if (disorderEvent) {
                    disorderEvent.mitigated = true;
                    await DataHandler.update({ events: disorderEvents });
                    message += `<p style="color:green">Разлад улажен! Штрафы ко всем проверкам снижены до -2.</p>`;
                } else {
                    message += `<p style="color:#d84315">Событие 'Разлад в рядах' не найдено для смягчения.</p>`;
                }
                break;



            case "Союзник в опасности":
                // If mitigated, rescue the ally (both missing and captured)
                if (data.allies && data.allies.length > 0) {
                    const allies = JSON.parse(JSON.stringify(data.allies));
                    let rescuedAllies = [];
                    
                    // Rescue missing allies
                    allies.forEach(ally => {
                        if (ally.missing) {
                            ally.missing = false;
                            rescuedAllies.push(ally.name);
                        }
                    });
                    
                    // Rescue captured allies
                    allies.forEach(ally => {
                        if (ally.captured) {
                            ally.captured = false;
                            rescuedAllies.push(ally.name);
                        }
                    });
                    
                    if (rescuedAllies.length > 0) {
                        await DataHandler.update({ allies });
                        message += `<p style="color:green">Союзники спасены: ${rescuedAllies.join(", ")}!</p>`;
                    } else {
                        message += `<p style="color:blue">Отмена: Эффект "Союзник в опасности" отменен (нет пропавших или схваченных союзников).</p>`;
                    }
                }
                break;

            case "Катастроф. миссия":
                // If mitigated, restore disabled teams instead of destroying them
                const teams4 = JSON.parse(JSON.stringify(data.teams));
                teams4.forEach(team => {
                    if (team.disabled) team.disabled = false;
                });
                await DataHandler.update({ teams: teams4 });
                message += `<p style="color:green">Команды спасены от уничтожения!</p>`;
                break;

            case "Предатель":
                // If mitigated, prevent notoriety increase
                const teams5 = JSON.parse(JSON.stringify(data.teams));
                teams5.forEach(team => {
                    if (team.disabled) team.disabled = false;
                });
                await DataHandler.update({ teams: teams5 });
                message += `<p style="color:green">Предатель пойман, известность не увеличилась!</p>`;
                break;

            case "Дьявольское проникн.":
                // If mitigated, officer's perception halves the infiltration duration
                message += `<p style="color:green">Офицер обнаружил проникновение раньше! Длительность проникновения уменьшена вдвое.</p>`;
                break;



            case "Инквизиция":
                // If mitigated, reduce supporter loss multiplier from 2x to 1.5x
                message += `<p style="color:green">Инквизиция частично остановлена. ×1.5 потеря сторонников.</p>`;
                break;

            default:
                // For other events, just remove the effect
                break;
        }
    }







    // Add chat message handler for mitigation buttons
    _addChatMessageMitigationHandler() {
        // Remove existing handler if any
        $(document).off('click', '.event-mitigate-btn');

        // Add new handler for mitigation buttons in chat messages
        $(document).on('click', '.event-mitigate-btn', async (ev) => {
            const btn = ev.currentTarget;
            const eventName = btn.dataset.event;
            const skill = btn.dataset.skill;
            const dc = Number(btn.dataset.dc);
            const macro = btn.dataset.macro;

            console.log(`=== НАЖАТИЕ НА КНОПКУ СМЯГЧЕНИЯ ===`);
            console.log(`Событие: ${eventName}`);
            console.log(`Навык: ${skill}`);
            console.log(`DC: ${dc}`);
            console.log(`Макрос: ${macro}`);

            // Check if it's a PF2e skill or rebellion skill
            const isPF2eSkill = game.pf2e?.system?.skills?.[skill];
            const isRebellionSkill = Object.keys(CHECK_LABELS).includes(skill);

            if (isPF2eSkill) {
                // For PF2e skills, need to select token
                const selectedTokens = canvas.tokens.controlled;

                if (!selectedTokens || selectedTokens.length === 0) {
                    ui.notifications.warn("Для броска из листа персонажа нужно выбрать токен на сцене!");
                    return;
                }

                const token = selectedTokens[0];
                const actor = token.actor;

                if (!actor) {
                    ui.notifications.warn("У выбранного токена нет актера!");
                    return;
                }

                console.log(`Используем актера: ${actor.name}`);

                // Execute the macro
                ChatMessage.create({
                    content: macro,
                    speaker: ChatMessage.getSpeaker()
                });

                // Show dialog for result input
                new Dialog({
                    title: `Результат смягчения: ${eventName}`,
                    content: `<form>
                        <div class="form-group">
                            <label>Результат броска:</label>
                            <select name="result">
                                <option value="success">Успех</option>
                                <option value="failure">Провал</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Если известен бросок кубика:</label>
                            <input type="number" name="rollTotal" placeholder="1d20">
                            <input type="number" name="total" placeholder="Сумма">
                        </div>
                    </form>`,
                    buttons: {
                        confirm: {
                            label: "Подтвердить",
                            callback: async (html) => {
                                const result = html.find('[name="result"]').val();
                                const rollTotal = parseInt(html.find('[name="rollTotal"]').val()) || null;
                                const totalVal = parseInt(html.find('[name="total"]').val()) || null;

                                const isSuccess = result === "success";
                                const roll = rollTotal ? { total: rollTotal } : null;
                                const total = totalVal;

                                await this._handleMitigationResult(eventName, skill, dc, isSuccess, roll, total);
                            }
                        }
                    },
                    default: "confirm"
                }).render(true);
            } else if (isRebellionSkill) {
                // For rebellion skills - automatic roll
                const data = DataHandler.get();
                const bonuses = DataHandler.getRollBonuses(data);
                const checkBonus = bonuses[skill];

                console.log(`Бросок организации для ${skill}: ${checkBonus.total}`);

                // Make the roll
                const roll = new Roll("1d20");
                await roll.evaluate();
                const total = roll.total + checkBonus.total;
                const success = total >= dc;

                console.log(`Бросок: 1d20(${roll.total}) + ${checkBonus.total} = ${total} (КС ${dc})`);
                console.log(`Результат: ${success ? 'Успех' : 'Провал'}`);

                // Process the result
                await this._handleMitigationResult(eventName, skill, dc, success, roll, total);

                // Send result message
                ChatMessage.create({
                    content: `<h5>🛡️ Результат смягчения: ${eventName}</h5>
                        <p>Проверка ${skill}: <strong>1d20(${roll.total}) + ${checkBonus.total} = ${total}</strong> против КС ${dc}</p>
                        <p style="color:${success ? 'green' : 'red'}"><strong>${success ? 'УСПЕХ' : 'ПРОВАЛ'}</strong></p>`,
                    speaker: ChatMessage.getSpeaker()
                });
            }
        });

        console.log("✅ Обработчик кнопок смягчения добавлен");
    }

    async _onRollCheckDialogSafe(ev) {
        const type = ev.currentTarget.dataset.type;
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses[type];

        // Try to use PF2e System Roll if available
        try {
            if (game.pf2e && game.pf2e.Check) {
                const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({ label: p.label, modifier: p.value, type: "untyped" }));
                const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character");

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier(CHECK_LABELS[type], { modifiers }),
                    { actor, type: 'skill-check', createMessage: true, skipDialog: false, title: `Проверка: ${CHECK_LABELS[type]} ` },
                    ev
                );
                return;
            }
        } catch (e) {
            ui.notifications.warn("PF2e System Roll не сработал. Используем стандартное окно.");
        }

        let content = `<form>
            <div class="form-group">
                <label>Базовый бонус (${CHECK_LABELS[type]}):</label>
                <input type="number" value="${checkBonus.total}" disabled>
            </div>
            <div class="form-group">
                <label>Дополнительный модификатор:</label>
                <input type="number" name="modifier" value="0">
            </div>
            <p><small>Из чего состоит бонус:</small></p>
            <ul>
                ${checkBonus.parts.map(p => `<li>${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}</li>`).join('')}
            </ul>
        </form>`;

        new Dialog({
            title: `Проверка: ${CHECK_LABELS[type]}`,
            content,
            buttons: {
                roll: {
                    label: "Бросок",
                    callback: async (html) => {
                        const mod = parseInt(html.find('[name="modifier"]').val()) || 0;
                        const totalBonus = checkBonus.total + mod;
                        const roll = new Roll("1d20");
                        await roll.evaluate();
                        const total = roll.total + totalBonus;

                        ChatMessage.create({
                            content: `<h5>🎲 Проверка: ${CHECK_LABELS[type]}</h5>
                                <p>1d20 (${roll.total}) + ${totalBonus} (${mod !== 0 ? 'мод. ' + mod : 'бонус'}) = <strong>${total}</strong></p>
                                <ul>
                                    ${checkBonus.parts.map(p => `<li>${p.label}: ${p.value >= 0 ? '+' : ''}${p.value}</li>`).join('')}
                                    ${mod !== 0 ? `<li>Дополнительно: ${mod}</li>` : ''}
                                </ul>`,
                            speaker: ChatMessage.getSpeaker()
                        });
                    }
                }
            },
            default: "roll"
        }).render(true);
    }

    // === ALLY MANAGEMENT METHODS ===

    /**
     * Show dialog to add a new ally from the list of available allies
     */
    async _onAddAllyDialog() {
        const data = DataHandler.get();
        const existingSlugs = (data.allies || []).map(a => a.slug);

        // Get all allies grouped by adventure
        const allAllies = getAllAllies().filter(a => !existingSlugs.includes(a.slug));

        if (allAllies.length === 0) {
            ui.notifications.info("Все союзники уже добавлены.");
            return;
        }

        // Group by adventure for the dialog
        const grouped = {};
        allAllies.forEach(ally => {
            const adv = ally.adventure || 1;
            if (!grouped[adv]) grouped[adv] = [];
            grouped[adv].push(ally);
        });

        const adventureNames = {
            1: "В яркой тени Ада",
            2: "Поворот Потока",
            3: "Танец Проклятых",
            4: "Песня Серебра",
            5: "Ад снаружи",
            6: "Разбитые оковы"
        };

        let optionsHtml = '';
        Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach(adv => {
            optionsHtml += `<optgroup label="Приключение ${adv}: ${adventureNames[adv] || ''}">`;
            grouped[adv].forEach(ally => {
                optionsHtml += `<option value="${ally.slug}">${ally.name}${ally.canBeOfficer ? ' ⭐' : ''}</option>`;
            });
            optionsHtml += `</optgroup>`;
        });

        const content = `
            <form>
                <p>Выберите союзника для добавления:</p>
                <div class="form-group">
                    <select id="ally-select" style="width: 100%;">
                        ${optionsHtml}
                    </select>
                </div>
                <div id="ally-preview" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 5px;"></div>
            </form>
        `;

        new Dialog({
            title: "Добавить союзника",
            content,
            buttons: {
                add: {
                    label: "Добавить",
                    callback: async (html) => {
                        const slug = html.find('#ally-select').val();
                        if (!slug) return;

                        const allyDef = getAllyData(slug);
                        if (!allyDef) return;

                        const currentData = DataHandler.get();
                        const allies = [...(currentData.allies || [])];
                        allies.push({
                            slug,
                            name: allyDef.name,
                            img: allyDef.img,
                            enabled: true, // GM can then toggle
                            disabled: false,
                            missing: false,
                            revealed: false,
                            selectedBonus: allyDef.hasChoice ? 'loyalty' : null
                        });

                        await DataHandler.update({ allies });
                        ui.notifications.info(`Союзник "${allyDef.name}" добавлен!`);

                        let message = `
                            <div style="
                                border: 3px solid #4caf50; 
                                padding: 20px; 
                                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
                                border-radius: 15px; 
                                margin: 15px 0; 
                                box-shadow: 0 6px 12px rgba(76, 175, 80, 0.4);
                            ">
                                <h5 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 1.5em; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 2em;">🤝</span>
                                    Новый союзник присоединился!
                                </h5>
                                
                                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 15px; padding: 15px; background: rgba(255,255,255,0.8); border-radius: 10px;">
                                    <img src="${allyDef.img}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 4px solid #4caf50;">
                                    <div>
                                        <strong style="font-size: 1.4em; color: #2e7d32;">${allyDef.name}</strong>
                                        <div style="color: #666; font-size: 0.9em; margin-top: 5px;">
                                            Присоединился к Серебряным Воронам
                                        </div>
                                    </div>
                                </div>
                                
                                <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 8px; border-left: 4px solid #4caf50;">
                                    <div style="color: #2e7d32; font-weight: bold; margin-bottom: 8px;">📋 Описание:</div>
                                    <div style="color: #424242; font-style: italic; line-height: 1.4;">
                                        ${allyDef.description || allyDef.desc}
                                    </div>
                                </div>
                                
                                <div style="text-align: center; margin-top: 15px; font-size: 1.2em;">
                                    🎉 Добро пожаловать в ряды восстания! 🎉
                                </div>
                            </div>
                        `;
                        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                        await this._logToJournal(message);
                    }
                },
                cancel: { label: "Отмена" }
            },
            render: (html) => {
                const updatePreview = () => {
                    const slug = html.find('#ally-select').val();
                    const ally = getAllyData(slug);
                    if (ally) {
                        html.find('#ally-preview').html(`
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <img src="${ally.img}" style="width: 48px; height: 48px; border-radius: 5px; object-fit: cover;">
                                <div>
                                    <strong>${ally.name}</strong>
                                    ${ally.canBeOfficer ? ' <span style="color: #194680; font-weight: bold;">⭐ Офицер</span>' : ''}
                                    <br>
                                    <span style="font-size: 11px; color: #666;">${ally.description || ally.desc}</span>
                                </div>
                            </div>
                        `);
                    }
                };
                html.find('#ally-select').on('change', updatePreview);
                updatePreview();
            }
        }).render(true);
    }

    /**
     * Show dialog to auto-configure ally sheet bindings
     */
    async _onAllySettingsDialog() {
        const confirmed = await Dialog.confirm({
            title: "Автопривязка союзников",
            content: "<p>Автоматически привязать всех союзников к персонажам?</p><p>Система найдет персонажей с именами, соответствующими именам союзников, и привяжет их листы.</p>",
            yes: () => true,
            no: () => false
        });

        if (!confirmed) return;

        const data = DataHandler.get();
        const allies = [...(data.allies || [])];
        let updatedCount = 0;
        let conflicts = [];

        for (let i = 0; i < allies.length; i++) {
            const ally = allies[i];

            // Ищем NPC персонажей с именем, соответствующим имени союзника
            // Разбиваем имя союзника на слова для более гибкого поиска
            const allyNameLower = ally.name.toLowerCase().trim();
            const allyWords = allyNameLower.split(/\s+/);
            
            const matchingActors = game.actors.filter(actor => {
                if (actor.type !== "npc") return false;
                
                const actorNameLower = actor.name.toLowerCase().trim();
                
                // Точное совпадение
                if (actorNameLower === allyNameLower) return true;
                
                // Частичное совпадение (одно содержит другое)
                if (actorNameLower.includes(allyNameLower) || allyNameLower.includes(actorNameLower)) return true;
                
                // Проверяем, содержит ли имя персонажа все слова из имени союзника
                const allWordsMatch = allyWords.every(word => actorNameLower.includes(word));
                if (allWordsMatch && allyWords.length > 1) return true;
                
                return false;
            });

            if (matchingActors.length === 0) {
                continue; // Не найдено подходящих персонажей
            } else if (matchingActors.length === 1) {
                // Найден один персонаж - автоматически привязываем
                const actor = matchingActors[0];
                allies[i] = {
                    ...ally,
                    actorId: actor.id,
                    img: actor.prototypeToken?.texture?.src || actor.img || ally.img
                };
                updatedCount++;
            } else {
                // Найдено несколько персонажей - добавляем в список конфликтов
                conflicts.push({
                    allyIndex: i,
                    ally: ally,
                    actors: matchingActors
                });
            }
        }

        // Если есть конфликты, показываем диалог выбора
        if (conflicts.length > 0) {
            await this._resolveAllyConflicts(conflicts, allies);
        }

        // Обновляем данные
        await DataHandler.update({ allies });
        
        ui.notifications.info(`Автопривязка завершена. Привязано союзников: ${updatedCount + conflicts.length}`);
    }

    /**
     * Resolve conflicts when multiple actors match ally names
     */
    async _resolveAllyConflicts(conflicts, allies) {
        for (const conflict of conflicts) {
            const { allyIndex, ally, actors } = conflict;
            
            let optionsHtml = '';
            actors.forEach((actor, index) => {
                optionsHtml += `<option value="${index}">${actor.name} (ID: ${actor.id})</option>`;
            });

            const content = `
                <form>
                    <p>Для союзника <strong>"${ally.name}"</strong> найдено несколько подходящих персонажей:</p>
                    <div class="form-group">
                        <select id="actor-select" style="width: 100%;">
                            ${optionsHtml}
                        </select>
                    </div>
                    <div id="actor-preview" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 5px;"></div>
                </form>
            `;

            const selectedIndex = await new Promise((resolve) => {
                new Dialog({
                    title: `Выбор персонажа для "${ally.name}"`,
                    content,
                    buttons: {
                        select: {
                            label: "Выбрать",
                            callback: (html) => {
                                const index = parseInt(html.find('#actor-select').val());
                                resolve(index);
                            }
                        },
                        skip: {
                            label: "Пропустить",
                            callback: () => resolve(-1)
                        }
                    },
                    render: (html) => {
                        const updatePreview = () => {
                            const index = parseInt(html.find('#actor-select').val());
                            const actor = actors[index];
                            if (actor) {
                                const tokenImg = actor.prototypeToken?.texture?.src || actor.img;
                                html.find('#actor-preview').html(`
                                    <div style="display: flex; gap: 10px; align-items: center;">
                                        <img src="${tokenImg}" style="width: 48px; height: 48px; border-radius: 5px; object-fit: cover;">
                                        <div>
                                            <strong>${actor.name}</strong><br>
                                            <span style="font-size: 11px; color: #666;">ID: ${actor.id}</span><br>
                                            <span style="font-size: 11px; color: #666;">Токен: ${tokenImg}</span>
                                        </div>
                                    </div>
                                `);
                            }
                        };
                        html.find('#actor-select').on('change', updatePreview);
                        updatePreview();
                    }
                }).render(true);
            });

            if (selectedIndex >= 0) {
                const selectedActor = actors[selectedIndex];
                allies[allyIndex] = {
                    ...ally,
                    actorId: selectedActor.id,
                    img: selectedActor.prototypeToken?.texture?.src || selectedActor.img || ally.img
                };
            }
        }
    }

    /**
     * Show dialog to bind ally to a character
     */
    async _onBindAllyDialog(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const allies = [...(data.allies || [])];
        const ally = allies[idx];
        
        if (!ally) return;

        // Get all NPC actors
        const characterActors = game.actors.filter(actor => actor.type === "npc");
        
        if (characterActors.length === 0) {
            ui.notifications.warn("Не найдено NPC персонажей для привязки.");
            return;
        }

        let optionsHtml = '<option value="">Выберите персонажа...</option>';
        characterActors.forEach(actor => {
            optionsHtml += `<option value="${actor.id}">${actor.name}</option>`;
        });

        const content = `
            <form>
                <p>Выберите персонажа для привязки к союзнику <strong>"${ally.name}"</strong>:</p>
                <div class="form-group">
                    <select id="actor-select" style="width: 100%;">
                        ${optionsHtml}
                    </select>
                </div>
                <div id="actor-preview" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 5px;"></div>
            </form>
        `;

        new Dialog({
            title: `Привязать персонажа к "${ally.name}"`,
            content,
            buttons: {
                bind: {
                    label: "Привязать",
                    callback: async (html) => {
                        const actorId = html.find('#actor-select').val();
                        if (!actorId) return;

                        const actor = game.actors.get(actorId);
                        if (!actor) return;

                        allies[idx] = {
                            ...ally,
                            actorId: actor.id,
                            img: actor.prototypeToken?.texture?.src || actor.img || ally.img
                        };

                        await DataHandler.update({ allies });
                        ui.notifications.info(`Союзник "${ally.name}" привязан к персонажу "${actor.name}"`);
                    }
                },
                cancel: { label: "Отмена" }
            },
            render: (html) => {
                const updatePreview = () => {
                    const actorId = html.find('#actor-select').val();
                    const actor = game.actors.get(actorId);
                    if (actor) {
                        const tokenImg = actor.prototypeToken?.texture?.src || actor.img;
                        html.find('#actor-preview').html(`
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <img src="${tokenImg}" style="width: 48px; height: 48px; border-radius: 5px; object-fit: cover;">
                                <div>
                                    <strong>${actor.name}</strong><br>
                                    <span style="font-size: 11px; color: #666;">ID: ${actor.id}</span><br>
                                    <span style="font-size: 11px; color: #666;">Токен: ${tokenImg}</span>
                                </div>
                            </div>
                        `);
                    } else {
                        html.find('#actor-preview').html('');
                    }
                };
                html.find('#actor-select').on('change', updatePreview);
            }
        }).render(true);
    }

    /**
     * Unbind ally from character
     */
    async _onUnbindAlly(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const allies = [...(data.allies || [])];
        const ally = allies[idx];
        
        if (!ally) return;

        const confirmed = await Dialog.confirm({
            title: "Отвязать персонажа",
            content: `<p>Отвязать персонажа от союзника <strong>"${ally.name}"</strong>?</p>`,
            yes: () => true,
            no: () => false
        });

        if (!confirmed) return;

        // Get original ally definition to restore original image
        const def = getAllyData(ally.slug);
        
        allies[idx] = {
            ...ally,
            actorId: null,
            img: def?.img || ally.img
        };

        await DataHandler.update({ allies });
        ui.notifications.info(`Персонаж отвязан от союзника "${ally.name}"`);
    }

    /**
     * Handle ally enable/disable toggle
     */
    async _onAllyEnabledChange(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const enabled = ev.currentTarget.checked;

        const data = DataHandler.get();
        const allies = [...(data.allies || [])];

        if (allies[idx]) {
            allies[idx].enabled = enabled;
            await DataHandler.update({ allies });

            const allyName = allies[idx].name || getAllyData(allies[idx].slug)?.name || "Союзник";
            if (enabled) {
                ui.notifications.info(`${allyName} теперь активен и виден игрокам.`);
            } else {
                ui.notifications.info(`${allyName} скрыт от игроков.`);
            }
        }
    }

    /**
     * Handle ally revealed state change (for Tayacet)
     */
    async _onAllyRevealedChange(ev) {
        const name = ev.currentTarget.name;
        const revealed = ev.currentTarget.checked;
        
        // Extract index from name like "allies.2.revealed"
        const match = name.match(/allies\.(\d+)\.revealed/);
        if (!match) return;
        
        const idx = Number(match[1]);
        const data = DataHandler.get();
        const allies = [...(data.allies || [])];

        if (allies[idx]) {
            allies[idx].revealed = revealed;
            await DataHandler.update({ allies });

            const allyName = allies[idx].name || getAllyData(allies[idx].slug)?.name || "Союзник";
            if (revealed) {
                ui.notifications.info(`${allyName}: прикрытие раскрыто (+2 к верности).`);
            } else {
                ui.notifications.info(`${allyName}: прикрытие сохранено (+2 к секретности и безопасности).`);
            }
        }
    }

    /**
     * Delete an ally
     */
    async _onDeleteAlly(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const allies = [...(data.allies || [])];

        if (!allies[idx]) return;

        const allyName = allies[idx].name || getAllyData(allies[idx].slug)?.name || "Союзник";

        if (!await Dialog.confirm({
            title: "Удалить союзника?",
            content: `<p>Вы уверены, что хотите удалить <strong>${allyName}</strong>?</p><p>Это действие нельзя отменить.</p>`
        })) return;

        allies.splice(idx, 1);
        await DataHandler.update({ allies });
        ui.notifications.info(`${allyName} удалён из списка союзников.`);
    }

    /**
     * Execute monthly action for ally
     */
    async _onExecuteMonthlyAction(ev) {
        const allySlug = ev.currentTarget.dataset.ally;
        const data = DataHandler.get();
        
        const allyDef = getAllyData(allySlug);
        if (!allyDef) {
            ui.notifications.error("Союзник не найден!");
            return;
        }

        // Check if ally has monthly action
        if (!allyDef.bonuses?.freeCacheMonthly) {
            ui.notifications.warn("У этого союзника нет месячного действия!");
            return;
        }
        
        // Check if action can be used
        if (!DataHandler.canUseMonthlyAction(data, allySlug)) {
            ui.notifications.warn("Месячное действие уже использовано в этом месяце!");
            return;
        }

        // Handle different types of monthly actions
        if (allyDef.bonuses?.freeCacheMonthly) {
            await this._handleFreeCacheMonthly(allySlug, allyDef);
        }
    }



    /**
     * Handle free cache creation monthly action
     */
    async _handleFreeCacheMonthly(allySlug, allyDef) {
        const self = this;
        
        // Get current data to check usage limits
        const data = DataHandler.get();
        const hetamonUsage = data.hetamonCacheUsage || { small: 0, medium: 0, large: 0 };
        
        // Get Hetamon cache settings from data or use defaults
        const hetamonSettings = data.hetamonSettings || {
            small: {
                value: 50,
                maxUses: 3
            },
            medium: {
                value: 120,
                maxUses: 2
            },
            large: {
                value: 600,
                maxUses: 1
            }
        };

        const hetamonCaches = {
            small: {
                maxUses: hetamonSettings.small.maxUses,
                currentUses: hetamonUsage.small,
                value: hetamonSettings.small.value
            },
            medium: {
                maxUses: hetamonSettings.medium.maxUses,
                currentUses: hetamonUsage.medium,
                value: hetamonSettings.medium.value
            },
            large: {
                maxUses: hetamonSettings.large.maxUses,
                currentUses: hetamonUsage.large,
                value: hetamonSettings.large.value
            }
        };
        
        // Create cache creation dialog
        const content = `
            <form>
                <div class="form-group">
                    <label>Тип тайника культа Милани:</label>
                    <select id="cache-size" style="width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 6px; height: 40px; font-size: 14px;">
                        <option value="small">Малый тайник (${hetamonCaches.small.currentUses}/${hetamonCaches.small.maxUses} использовано)</option>
                        <option value="medium">Средний тайник (${hetamonCaches.medium.currentUses}/${hetamonCaches.medium.maxUses} использовано)</option>
                        <option value="large">Крупный тайник (${hetamonCaches.large.currentUses}/${hetamonCaches.large.maxUses} использовано)</option>
                    </select>
                </div>
                <div id="cache-info" style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <strong>Доступно:</strong> ${hetamonCaches.small.maxUses - hetamonCaches.small.currentUses} из ${hetamonCaches.small.maxUses} тайников<br>
                    <strong>Статус:</strong> ${hetamonCaches.small.currentUses < hetamonCaches.small.maxUses ? '<span style="color: green;">&#x2705; Можно создать</span>' : '<span style="color: red;">&#x274C; Лимит исчерпан</span>'}
                </div>
                <div class="form-group">
                    <label>Местоположение тайника:</label>
                    <input type="text" id="cache-location" placeholder="Район Кинтарго" style="width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 8px;">
                </div>
                <div class="form-group">
                    <label>Стоимость (зм):</label>
                    <input type="number" id="cache-value" readonly style="width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 8px; background: #f9f9f9;" value="${hetamonCaches.small.value}">
                </div>
            </form>

        `;

        new Dialog({
            title: `${allyDef.name}: Создание бесплатного тайника`,
            content,
            buttons: {
                create: {
                    label: "Создать",
                    callback: async (html) => {
                        const size = html.find('#cache-size').val();
                        const location = html.find('#cache-location').val() || "Тайник культа Милани";
                        const value = parseInt(html.find('#cache-value').val()) || 0;

                        // Check Hetamon's usage limits
                        const currentData = DataHandler.get();
                        const hetamonUsage = currentData.hetamonCacheUsage || { small: 0, medium: 0, large: 0 };
                        const cacheInfo = hetamonCaches[size];
                        
                        if (hetamonUsage[size] >= cacheInfo.maxUses) {
                            ui.notifications.warn(`Хетамон уже использовал все доступные ${size === 'small' ? 'малые' : size === 'medium' ? 'средние' : 'крупные'} тайники!`);
                            return;
                        }

                        const data = DataHandler.get();
                        const caches = JSON.parse(JSON.stringify(data.caches || []));
                        
                        caches.push({
                            type: 'cache',
                            size: size,
                            location: location,
                            value: value,
                            active: true,
                            createdBy: allySlug,
                            createdWeek: data.week
                        });

                        // Update Hetamon's usage counter
                        const updatedUsage = { ...hetamonUsage };
                        updatedUsage[size] = (updatedUsage[size] || 0) + 1;
                        
                        await DataHandler.update({ 
                            caches,
                            hetamonCacheUsage: updatedUsage
                        });

                        // Log the action
                        const message = `
                            <div style="
                                border: 3px solid #4caf50;
                                padding: 15px;
                                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
                                border-radius: 12px;
                                margin: 10px 0;
                                box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
                            ">
                                <h5 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 2em;">&#x1F4E6;</span>
                                    Месячное действие: Создание тайника
                                </h5>
                                
                                <div style="background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                                    <strong style="color: #2e7d32;">&#x1F91D; ${allyDef.name}</strong> использует свою месячную способность
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
                                    <div style="background: rgba(255,255,255,0.7); padding: 8px; border-radius: 6px;">
                                        <strong>&#x1F4CD; Место:</strong> ${location}
                                    </div>
                                    <div style="background: rgba(255,255,255,0.7); padding: 8px; border-radius: 6px;">
                                        <strong>&#x1F4CF; Размер:</strong> ${size === 'small' ? 'Малый' : size === 'medium' ? 'Средний' : 'Большой'}
                                    </div>
                                </div>
                                
                                ${value > 0 ? `
                                    <div style="background: rgba(255,255,255,0.7); padding: 8px; border-radius: 6px; margin: 10px 0;">
                                        <strong>&#x1F4B0; Стоимость:</strong> ${value} зм
                                    </div>
                                ` : ''}
                                
                                <div style="text-align: center; margin-top: 15px; color: #1b5e20; font-weight: bold;">
                                    &#x2705; Тайник успешно создан бесплатно!
                                </div>
                            </div>
                        `;

                        await self._logToJournal(message, { important: true });
                        ui.notifications.info(`${allyDef.name} создал бесплатный тайник!`);
                        
                        // Mark monthly action as used
                        const freshData = DataHandler.get();
                        console.log(`Before useMonthlyAction - Week: ${freshData.week}, AllySlug: ${allySlug}`);
                        console.log(`Before - monthlyActions:`, freshData.monthlyActions);
                        
                        await DataHandler.useMonthlyAction(freshData, allySlug);
                        
                        const afterData = DataHandler.get();
                        console.log(`After useMonthlyAction - monthlyActions:`, afterData.monthlyActions);
                        console.log(`Can use after:`, DataHandler.canUseMonthlyAction(afterData, allySlug));
                        
                        // Re-render to update UI
                        self.render(false);
                    }
                },
                cancel: { label: "Отмена" }
            },
            default: "create"
        }).render(true);
        
        // Add event listener after dialog is rendered
        setTimeout(() => {
            const sizeSelect = document.getElementById('cache-size');
            if (sizeSelect) {
                sizeSelect.addEventListener('change', function() {
                    const size = this.value;
                    const cache = hetamonCaches[size];
                    
                    if (cache) {
                        const remaining = cache.maxUses - cache.currentUses;
                        const canUse = remaining > 0;
                        
                        document.getElementById('cache-info').innerHTML = 
                            '<strong>Доступно:</strong> ' + remaining + ' из ' + cache.maxUses + ' тайников<br>' +
                            '<strong>Статус:</strong> ' + (canUse ? '<span style="color: green;">&#x2705; Можно создать</span>' : '<span style="color: red;">&#x274C; Лимит исчерпан</span>');
                        
                        document.getElementById('cache-value').value = cache.value;
                    }
                });
            }
        }, 100);
    }

    /**
     * Delete a team
     */
    async _onDeleteTeam(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        
        // Silver Ravens (idx -1) cannot be deleted
        if (idx < 0) {
            ui.notifications.warn("Серебряные Вороны не могут быть удалены!");
            return;
        }
        
        const data = DataHandler.get();
        const teams = [...(data.teams || [])];

        if (!teams[idx]) return;

        const teamDef = getTeamDefinition(teams[idx].type);
        const teamName = teamDef?.label || "Команда";

        if (!await Dialog.confirm({
            title: "Распустить команду?",
            content: `<p>Вы уверены, что хотите распустить <strong>${teamName}</strong>?</p>`
        })) return;

        // Loyalty check for notoriety
        const bonuses = DataHandler.getRollBonuses(data);
        const roll = new Roll("1d20");
        await roll.evaluate();
        const total = roll.total + bonuses.loyalty.total;

        let message = `<h5>📤 Роспуск команды: ${teamName}</h5>`;
        message += `<p>Проверка Верности: 1d20(${roll.total}) + ${bonuses.loyalty.total} = <strong>${total}</strong> против КС 10</p>`;

        if (total >= 10) {
            message += `<p style="color:green">Успех! Команда распущена без последствий.</p>`;
        } else {
            const notRoll = new Roll("1d4");
            await notRoll.evaluate();
            message += `<p style="color:red">Провал! Известность +${notRoll.total}</p>`;
            await DataHandler.update({ notoriety: data.notoriety + notRoll.total });
        }

        teams.splice(idx, 1);
        await DataHandler.update({ teams });

        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
        await this._logToJournal(message);
    }

    // === HIRE UNIQUE TEAM ===
    async _onHireUniqueTeamDialog() {
        const data = DataHandler.get();

        // Unique teams don't count towards team limit, so no limit check needed

        // Get unique teams that are not already hired
        const currentTeamTypes = data.teams.map(t => t.type);
        const uniqueTeams = Object.entries(TEAMS)
            .filter(([slug, def]) => def.unique && !currentTeamTypes.includes(slug))
            .map(([slug, def]) => ({
                slug,
                label: def.label,
                category: def.category,
                rank: def.rank,
                desc: def.desc || "",
                icon: def.icon
            }));

        if (uniqueTeams.length === 0) {
            ui.notifications.warn("Нет доступных уникальных команд для найма!");
            return;
        }

        let content = `
            <form>
                <p><strong>Выберите уникальную команду для найма:</strong></p>
                <p><em>Уникальные команды нанимаются без проверок и не тратят действия.</em></p>
                <div class="form-group">
                    <select id="unique-team-select" style="width: 100%; margin-bottom: 10px;">
        `;
        
        uniqueTeams.forEach(t => {
            content += `<option value="${t.slug}">${t.label} (Ранг ${t.rank}) - ${t.desc}</option>`;
        });
        
        content += `
                    </select>
                </div>
                <div id="team-preview" style="margin-top: 15px; padding: 10px; border: 1px solid #ccc; border-radius: 5px; background: #f9f9f9;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img id="preview-icon" src="${uniqueTeams[0]?.icon || 'icons/svg/mystery-man.svg'}" style="width: 40px; height: 40px; border-radius: 50%;">
                        <div>
                            <strong id="preview-name">${uniqueTeams[0]?.label || ''}</strong>
                            <div id="preview-desc" style="color: #666; font-size: 0.9em;">${uniqueTeams[0]?.desc || ''}</div>
                        </div>
                    </div>
                </div>
            </form>
        `;

        new Dialog({
            title: "Нанять уникальную команду",
            content,
            buttons: {
                hire: {
                    label: "Нанять",
                    callback: async (html) => {
                        try {
                            const slug = html.find('#unique-team-select').val();
                            const def = TEAMS[slug];
                            if (!def) return;

                            // Add team without any checks or action cost
                            const currentData = DataHandler.get();
                            const teams = [...currentData.teams];
                            teams.push({
                                type: slug,
                                manager: "",
                                bonus: 0,
                                disabled: false,
                                missing: false,
                                currentAction: "",
                                managerLocked: false,
                                actionLocked: false
                            });

                            await DataHandler.update({ teams });

                            // Create beautiful hire message
                            let hireMessage = `
                                <div style="
                                    border: 3px solid #6a1b9a; 
                                    padding: 15px; 
                                    background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); 
                                    border-radius: 12px; 
                                    margin: 10px 0; 
                                    box-shadow: 0 4px 8px rgba(106, 27, 154, 0.3);
                                ">
                                    <h5 style="color: #6a1b9a; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                                        <span style="font-size: 2em;">⭐</span>
                                        Найм уникальной команды: ${def.label}
                                    </h5>
                                    
                                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                                        <img src="${def.icon}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 3px solid #6a1b9a;">
                                        <div>
                                            <strong style="font-size: 1.2em; color: #6a1b9a;">${def.label}</strong>
                                            <div style="color: #666; font-size: 0.9em; margin-top: 2px;">
                                                Ранг ${def.rank} • ${getCategoryLabel(def.category)} • Уникальная
                                            </div>
                                            ${def.desc ? `<div style="color: #888; font-size: 0.8em; margin-top: 2px;">${def.desc}</div>` : ''}
                                        </div>
                                    </div>
                                    
                                    <div style="padding: 12px; background: rgba(106, 27, 154, 0.1); border-radius: 8px; border: 2px solid #6a1b9a;">
                                        <strong style="color: #6a1b9a;">✨ Уникальная команда присоединилась!</strong>
                                        <div style="margin-top: 8px; color: #4a148c;">
                                            🎉 ${def.label} теперь служит Серебряным Воронам!
                                        </div>

                                    </div>
                                </div>
                            `;

                            ChatMessage.create({ 
                                content: hireMessage, 
                                speaker: ChatMessage.getSpeaker() 
                            });
                            
                            await this._logToJournal(hireMessage);
                            ui.notifications.info(`Уникальная команда ${def.label} нанята!`);

                        } catch (err) {
                            ui.notifications.error(`Ошибка при найме уникальной команды: ${err.message}`);
                        }
                    }
                },
                cancel: { label: "Отмена" }
            },
            render: (html) => {
                // Update preview when selection changes
                html.find('#unique-team-select').change(function() {
                    const selectedSlug = $(this).val();
                    const selectedTeam = uniqueTeams.find(t => t.slug === selectedSlug);
                    if (selectedTeam) {
                        html.find('#preview-icon').attr('src', selectedTeam.icon);
                        html.find('#preview-name').text(selectedTeam.label);
                        html.find('#preview-desc').text(selectedTeam.desc);
                    }
                });
            }
        }).render(true);
    }

    // === CACHE METHODS ===

    /**
     * Show dialog to add a new cache
     */
    async _onAddCacheDialog() {
        // Get current cache limits
        const data = DataHandler.get();
        const cacheLimits = data.cacheLimits || {
            small: { maxValue: 62 },
            medium: { maxValue: 143 },
            large: { maxValue: null }
        };

        const content = `
            <form style="max-width: 500px;">
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f9f9f9;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Размер тайника:</label>
                        <select id="cache-size" style="width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 8px; height: 40px; font-size: 14px;">
                            <option value="small">Малый (до ${cacheLimits.small.maxValue || 'без лимита'} зм, КС 15)</option>
                            <option value="medium">Средний (до ${cacheLimits.medium.maxValue || 'без лимита'} зм, КС 20)</option>
                            <option value="large">Большой (${cacheLimits.large.maxValue ? 'до ' + cacheLimits.large.maxValue + ' зм' : 'без лимита'}, КС 30)</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Местоположение:</label>
                        <input type="text" id="cache-location" placeholder="Район Кинтарго" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Стоимость (зм):</label>
                        <input type="number" id="cache-value" value="0" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                </div>
            </form>
        `;

        const dialog = new Dialog({
            title: "Создать тайник",
            content,
            buttons: {
                create: {
                    label: "Создать",
                    callback: async (html) => {
                        const type = "cache"; // Всегда создаем обычный тайник
                        const size = html.find('#cache-size').val();
                        const location = html.find('#cache-location').val() || "Неизвестное место";
                        const value = parseInt(html.find('#cache-value').val()) || 0;

                        // Validate cache limits using custom limits
                        const data = DataHandler.get();
                        const cacheLimits = data.cacheLimits || {
                            small: { maxValue: 62 },
                            medium: { maxValue: 143 },
                            large: { maxValue: null }
                        };
                        
                        const limit = cacheLimits[size];
                        if (limit.maxValue && value > limit.maxValue) {
                            ui.notifications.warn(`Стоимость превышает лимит для ${size === 'small' ? 'малого' : size === 'medium' ? 'среднего' : 'большого'} тайника (${limit.maxValue} зм)!`);
                            return;
                        }
                        const caches = [...(data.caches || [])];
                        
                        caches.push({
                            type: type,
                            size: size,
                            location: location,
                            value: value,
                            active: true,
                            created: data.week
                        });

                        await DataHandler.update({ caches });

                        // Log the action
                        const sizeLabel = size === 'small' ? 'Малый' : size === 'medium' ? 'Средний' : 'Большой';
                        const message = `
                            <div style="
                                border: 3px solid #2e7d32; 
                                padding: 15px; 
                                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
                                border-radius: 12px; 
                                margin: 10px 0; 
                                box-shadow: 0 4px 8px rgba(46, 125, 50, 0.3);
                            ">
                                <h5 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 2em;">📦</span>
                                    Создан новый тайник
                                </h5>
                                
                                <div style="background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                        <div><strong>Размер:</strong> ${sizeLabel}</div>
                                        <div><strong>Стоимость:</strong> ${value} зм</div>
                                        <div><strong>Неделя:</strong> ${data.week}</div>
                                    </div>
                                    <div><strong>Местоположение:</strong> ${location}</div>
                                </div>
                                
                                <div style="text-align: center; margin-top: 15px; color: #1b5e20; font-weight: bold;">
                                    ✅ Тайник успешно создан!
                                </div>
                            </div>
                        `;

                        await this._logToJournal(message, { important: true });
                        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                        ui.notifications.info(`${sizeLabel} тайник создан!`);
                    }
                },
                cancel: { label: "Отмена" }
            },
            default: "create"
        }, {
            width: 550,
            height: 350
        });
        
        // Render dialog
        dialog.render(true, {
            focus: true
        });
    }

    /**
     * Delete a cache
     */
    async _onDeleteCache(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const data = DataHandler.get();
        const caches = [...(data.caches || [])];

        if (!caches[idx]) return;

        const cache = caches[idx];
        const sizeLabel = cache.size === 'small' ? 'Малый' : cache.size === 'medium' ? 'Средний' : 'Большой';

        if (!await Dialog.confirm({
            title: "Удалить тайник?",
            content: `<p>Вы уверены, что хотите удалить <strong>${sizeLabel} тайник</strong> в локации "${cache.location}"?</p><p>Это действие нельзя отменить.</p>`
        })) return;

        caches.splice(idx, 1);
        await DataHandler.update({ caches });
        ui.notifications.info(`${sizeLabel} тайник удалён.`);

        // Log the deletion
        const message = `
            <div style="
                border: 3px solid #d32f2f; 
                padding: 15px; 
                background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); 
                border-radius: 12px; 
                margin: 10px 0; 
                box-shadow: 0 4px 8px rgba(211, 47, 47, 0.3);
            ">
                <h5 style="color: #d32f2f; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 2em;">🗑️</span>
                    Тайник удалён
                </h5>
                
                <div style="background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px;">
                    <div><strong>Размер:</strong> ${sizeLabel}</div>
                    <div><strong>Местоположение:</strong> ${cache.location}</div>
                    <div><strong>Содержимое:</strong> ${cache.contents}</div>
                    <div><strong>Стоимость:</strong> ${cache.value} зм</div>
                </div>
            </div>
        `;

        await this._logToJournal(message);
        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
    }

    /**
     * Handle cache active/inactive toggle
     */
    async _onCacheActiveChange(ev) {
        const idx = Number(ev.currentTarget.dataset.index);
        const active = ev.currentTarget.checked;

        const data = DataHandler.get();
        const caches = [...(data.caches || [])];

        if (caches[idx]) {
            caches[idx].active = active;
            await DataHandler.update({ caches });

            const cache = caches[idx];
            const sizeLabel = cache.size === 'small' ? 'Малый' : cache.size === 'medium' ? 'Средний' : 'Большой';
            
            if (active) {
                ui.notifications.info(`${sizeLabel} тайник активирован.`);
            } else {
                ui.notifications.info(`${sizeLabel} тайник деактивирован.`);
            }
        }
    }

    /**
     * Get available cache size options based on team's max cache size
     */
    _getCacheSizeOptions(maxCacheSize) {
        const sizes = {
            small: { label: "Малый", desc: "до 5 фунтов, до 900 зм", dc: 15 },
            medium: { label: "Средний", desc: "до 10 фунтов, до 2,500 зм", dc: 20 },
            large: { label: "Крупный", desc: "до 20 фунтов, без лимита стоимости", dc: 30 }
        };
        
        const options = [];
        options.push({ value: 'small', ...sizes.small });
        
        if (maxCacheSize === 'medium' || maxCacheSize === 'large') {
            options.push({ value: 'medium', ...sizes.medium });
        }
        
        if (maxCacheSize === 'large') {
            options.push({ value: 'large', ...sizes.large });
        }
        
        return options;
    }

    /**
     * Show Hetamon settings dialog
     */
    async _onHetamonSettingsDialog() {
        const data = DataHandler.get();
        const hetamonSettings = data.hetamonSettings || {
            small: {
                value: 50,
                maxUses: 3
            },
            medium: {
                value: 120,
                maxUses: 2
            },
            large: {
                value: 600,
                maxUses: 1
            }
        };

        const content = `
            <form style="max-width: 600px;">
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f9f9f9;">
                    <h4 style="margin: 0 0 10px 0; color: #1976d2;">&#x1F4E6; Малые тайники</h4>
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Стоимость по умолчанию (зм):</label>
                            <input type="number" id="hetamon-small-value" value="${hetamonSettings.small.value}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Максимальное количество использований:</label>
                            <input type="number" id="hetamon-small-maxuses" value="${hetamonSettings.small.maxUses}" min="1" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f9f9f9;">
                    <h4 style="margin: 0 0 10px 0; color: #1976d2;">&#x1F4E6; Средние тайники</h4>
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Стоимость по умолчанию (зм):</label>
                            <input type="number" id="hetamon-medium-value" value="${hetamonSettings.medium.value}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Максимальное количество использований:</label>
                            <input type="number" id="hetamon-medium-maxuses" value="${hetamonSettings.medium.maxUses}" min="1" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f9f9f9;">
                    <h4 style="margin: 0 0 10px 0; color: #1976d2;">&#x1F4E6; Большие тайники</h4>
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Стоимость по умолчанию (зм):</label>
                            <input type="number" id="hetamon-large-value" value="${hetamonSettings.large.value}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Максимальное количество использований:</label>
                            <input type="number" id="hetamon-large-maxuses" value="${hetamonSettings.large.maxUses}" min="1" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                    </div>
                </div>
            </form>
        `;

        new Dialog({
            title: "Настройки тайников Хетамона",
            content,
            resizable: true,
            buttons: {
                save: {
                    label: "Сохранить",
                    callback: async (html) => {
                        const newSettings = {
                            small: {
                                value: parseInt(html.find('#hetamon-small-value').val()) || 0,
                                maxUses: parseInt(html.find('#hetamon-small-maxuses').val()) || 1
                            },
                            medium: {
                                value: parseInt(html.find('#hetamon-medium-value').val()) || 0,
                                maxUses: parseInt(html.find('#hetamon-medium-maxuses').val()) || 1
                            },
                            large: {
                                value: parseInt(html.find('#hetamon-large-value').val()) || 0,
                                maxUses: parseInt(html.find('#hetamon-large-maxuses').val()) || 1
                            }
                        };

                        await DataHandler.update({ hetamonSettings: newSettings });
                        ui.notifications.info("Настройки тайников Хетамона сохранены!");
                    }
                },
                cancel: { label: "Отмена" }
            },
            default: "save"
        }, {
            width: 550,
            height: 450
        }).render(true);
    }

    /**
     * Show cache limits settings dialog
     */
    async _onCacheLimitsSettingsDialog() {
        const data = DataHandler.get();
        const cacheLimits = data.cacheLimits || {
            small: { maxValue: 62 },
            medium: { maxValue: 143 },
            large: { maxValue: null }
        };

        const content = `
            <form style="max-width: 500px;">
                <p style="margin-bottom: 20px; color: #666;">Настройте максимальную стоимость для каждого размера тайника.</p>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #fff8e1;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #e65100;">&#x1F4E6; Малые тайники - максимальная стоимость (зм):</label>
                    <input type="number" id="cache-small-limit" value="${cacheLimits.small.maxValue || 900}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #fff8e1;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #e65100;">&#x1F4E6; Средние тайники - максимальная стоимость (зм):</label>
                    <input type="number" id="cache-medium-limit" value="${cacheLimits.medium.maxValue || 2500}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #fff8e1;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #e65100;">&#x1F4E6; Большие тайники - максимальная стоимость (зм):</label>
                    <input type="number" id="cache-large-limit" value="${cacheLimits.large.maxValue || ''}" min="0" placeholder="Без лимита" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    <small style="display: block; margin-top: 5px; color: #666; font-style: italic;">Оставьте пустым для отсутствия лимита</small>
                </div>
            </form>
        `;

        new Dialog({
            title: "Настройки лимитов тайников",
            content,
            resizable: true,
            buttons: {
                save: {
                    label: "Сохранить",
                    callback: async (html) => {
                        const smallLimit = parseInt(html.find('#cache-small-limit').val()) || 900;
                        const mediumLimit = parseInt(html.find('#cache-medium-limit').val()) || 2500;
                        const largeLimit = html.find('#cache-large-limit').val();
                        
                        const newLimits = {
                            small: { maxValue: smallLimit },
                            medium: { maxValue: mediumLimit },
                            large: { maxValue: largeLimit ? parseInt(largeLimit) : null }
                        };

                        await DataHandler.update({ cacheLimits: newLimits });
                        ui.notifications.info("Лимиты тайников сохранены!");
                    }
                },
                cancel: { label: "Отмена" }
            },
            default: "save"
        }, {
            width: 550,
            height: 450
        }).render(true);
    }

    /**
     * Show maintenance phase settings dialog
     */
    async _onMaintenanceSettingsDialog() {
        const data = DataHandler.get();
        const maintenanceSettings = data.maintenanceSettings || {
            minTreasury: {
                rank1: 2, rank2: 3, rank3: 4, rank4: 5, rank5: 7,
                rank6: 9, rank7: 12, rank8: 15, rank9: 18, rank10: 22,
                rank11: 26, rank12: 29, rank13: 32, rank14: 35, rank15: 38,
                rank16: 40, rank17: 42, rank18: 43, rank19: 44, rank20: 45
            },
            teamRestoreCost: 10
        };

        const content = `
            <form style="max-width: 500px;">
                <p style="margin-bottom: 20px; color: #666;">Настройте параметры фазы содержания.</p>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f0f8ff;">
                    <h4 style="margin: 0 0 15px 0; color: #1976d2;">💰 Минимальная казна по рангам</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; max-height: 300px; overflow-y: auto;">
                        ${Array.from({length: 20}, (_, i) => {
                            const rank = i + 1;
                            // Default values from minTreasuryByRank table
                            const defaultValues = [2, 3, 4, 5, 7, 9, 12, 15, 18, 22, 26, 29, 32, 35, 38, 40, 42, 43, 44, 45];
                            const value = maintenanceSettings.minTreasury[`rank${rank}`] || defaultValues[rank - 1];
                            return `
                                <div>
                                    <label style="display: block; margin-bottom: 3px; font-weight: bold; font-size: 0.9em;">Ранг ${rank}:</label>
                                    <input type="number" id="min-treasury-${rank}" value="${value}" min="0" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9em;">
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #fff8f0;">
                    <h4 style="margin: 0 0 15px 0; color: #f57c00;">🔧 Восстановление команд</h4>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Стоимость восстановления недееспособной команды (зм):</label>
                        <input type="number" id="team-restore-cost" value="${maintenanceSettings.teamRestoreCost}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <small style="display: block; margin-top: 5px; color: #666; font-style: italic;">Сколько золота нужно потратить, чтобы восстановить недееспособную команду</small>
                    </div>
                </div>
            </form>
        `;

        new Dialog({
            title: "Настройки фазы содержания",
            content,
            resizable: true,
            buttons: {
                save: {
                    label: "Сохранить",
                    callback: async (html) => {
                        const minTreasury = {};
                        // Default values from minTreasuryByRank table
                        const defaultValues = [2, 3, 4, 5, 7, 9, 12, 15, 18, 22, 26, 29, 32, 35, 38, 40, 42, 43, 44, 45];
                        for (let rank = 1; rank <= 20; rank++) {
                            const value = parseInt(html.find(`#min-treasury-${rank}`).val()) || defaultValues[rank - 1];
                            minTreasury[`rank${rank}`] = value;
                        }
                        
                        const newSettings = {
                            minTreasury,
                            teamRestoreCost: parseInt(html.find('#team-restore-cost').val()) || 10
                        };

                        await DataHandler.update({ maintenanceSettings: newSettings });
                        ui.notifications.info("Настройки фазы содержания сохранены!");
                    }
                },
                cancel: { label: "Отмена" }
            },
            default: "save"
        }, {
            width: 550,
            height: 500
        }).render(true);
    }

    /**
     * Show teams and actions settings dialog
     */
    async _onTeamsSettingsDialog() {
        const data = DataHandler.get();
        const teamsSettings = data.teamsSettings || {
            teamUpgradeCosts: {},
            actions: {
                blackMarketActivation: 8,
                goldEarningModifier: 1.0,
                marketUpdate: 15,
                urbanInfluence: 15
            }
        };

        // Import TEAMS to get upgrade costs
        const { TEAMS } = await import("./teams.js");
        
        // Get all teams that can be upgraded (have upgradeCost) grouped by category
        const upgradeableTeams = Object.entries(TEAMS)
            .filter(([slug, def]) => def.upgradeCost !== undefined);

        // Group by category
        const teamsByCategory = {
            advisors: [],
            outlaws: [],
            rebels: [],
            traders: []
        };

        upgradeableTeams.forEach(([slug, def]) => {
            if (teamsByCategory[def.category]) {
                teamsByCategory[def.category].push([slug, def]);
            }
        });

        // Sort teams within each category by rank then by name
        Object.keys(teamsByCategory).forEach(category => {
            teamsByCategory[category].sort((a, b) => {
                if (a[1].rank !== b[1].rank) return a[1].rank - b[1].rank;
                return a[1].label.localeCompare(b[1].label);
            });
        });

        const categoryNames = {
            advisors: "Советники",
            outlaws: "Преступники", 
            rebels: "Повстанцы",
            traders: "Торговцы"
        };

        const categoryColors = {
            advisors: "#f5f5f5",
            outlaws: "#f5f5f5",
            rebels: "#f5f5f5", 
            traders: "#f5f5f5"
        };

        let upgradeTeamsHtml = '';
        Object.entries(teamsByCategory).forEach(([category, teams]) => {
            if (teams.length === 0) return;
            
            upgradeTeamsHtml += `
                <div style="margin-bottom: 20px;">
                    <h6 style="margin: 0 0 10px 0; color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">
                        ${categoryNames[category]}
                    </h6>
                    <div style="background: ${categoryColors[category]}; padding: 10px; border-radius: 4px;">
            `;
            
            teams.forEach(([slug, def]) => {
                const currentCost = teamsSettings.teamUpgradeCosts[slug] || def.upgradeCost;
                upgradeTeamsHtml += `
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; align-items: center; margin-bottom: 8px;">
                        <label style="font-weight: bold;">${def.label} (Ранг ${def.rank}):</label>
                        <input type="number" id="upgrade-cost-${slug}" value="${currentCost}" min="0" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; background: white;">
                    </div>
                `;
            });
            
            upgradeTeamsHtml += `
                    </div>
                </div>
            `;
        });

        const content = `
            <form style="max-width: 700px;">
                <p style="margin-bottom: 20px; color: #666;">Настройте параметры команд и их действий.</p>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f0f8ff;">
                    <h5 style="margin: 0 0 15px 0; color: #1976d2;">Стоимость улучшения команд (зм)</h5>
                    ${upgradeTeamsHtml}
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #fff8f0;">
                    <h5 style="margin: 0 0 15px 0; color: #f57c00;">Настройки действий команд</h5>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Активация черного рынка (зм):</label>
                            <input type="number" id="black-market-cost" value="${teamsSettings.actions.blackMarketActivation}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Заработок золота (модификатор):</label>
                            <input type="number" id="gold-earning-modifier" value="${teamsSettings.actions.goldEarningModifier}" min="0" max="10" step="0.1" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Обновление рынка (зм):</label>
                            <input type="number" id="market-update-cost" value="${teamsSettings.actions.marketUpdate}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>

                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Городское влияние (зм):</label>
                            <input type="number" id="urban-influence-cost" value="${teamsSettings.actions.urbanInfluence}" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        </div>
                    </div>
                    
                    <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                        <small style="color: #856404;">
                            <strong>Модификатор заработка золота:</strong> Множитель для базового заработка (1.0 = 100%, 0.5 = 50%, 1.5 = 150%)
                        </small>
                    </div>
                </div>
            </form>
        `;

        new Dialog({
            title: "Настройки команд и действий",
            content,
            resizable: true,
            buttons: {
                save: {
                    label: "Сохранить",
                    callback: async (html) => {
                        const goldModifier = parseFloat(html.find('#gold-earning-modifier').val()) || 1.0;
                        
                        // Валидация модификатора заработка золота
                        if (goldModifier < 0) {
                            ui.notifications.warn("Модификатор заработка золота не может быть отрицательным!");
                            return;
                        }
                        
                        // Collect upgrade costs for all teams
                        const teamUpgradeCosts = {};
                        const { TEAMS } = await import("./teams.js");
                        
                        Object.keys(TEAMS).forEach(slug => {
                            if (TEAMS[slug].upgradeCost !== undefined) {
                                const inputValue = html.find(`#upgrade-cost-${slug}`).val();
                                teamUpgradeCosts[slug] = parseInt(inputValue) || TEAMS[slug].upgradeCost;
                            }
                        });
                        
                        const newSettings = {
                            teamUpgradeCosts: teamUpgradeCosts,
                            actions: {
                                blackMarketActivation: parseInt(html.find('#black-market-cost').val()) || 8,
                                goldEarningModifier: goldModifier,
                                marketUpdate: parseInt(html.find('#market-update-cost').val()) || 15,
                                urbanInfluence: parseInt(html.find('#urban-influence-cost').val()) || 15
                            }
                        };

                        await DataHandler.update({ teamsSettings: newSettings });
                        ui.notifications.info("Настройки команд и действий сохранены!");
                    }
                },
                cancel: { label: "Отмена" }
            },
            default: "save"
        }, {
            width: 750,
            height: 750
        }).render(true);
    }

    /**
     * Show dialog to select cache size before rolling
     */
    async _showCacheSizeDialog(options) {
        return new Promise((resolve) => {
            const optionsHtml = options.map(opt => 
                `<option value="${opt.value}">${opt.label} (${opt.desc}) - КС ${opt.dc}</option>`
            ).join('');
            
            const content = `
                <form>
                    <div class="form-group">
                        <label>Выберите размер тайника:</label>
                        <select id="cache-size-select" style="width: 100%;">
                            ${optionsHtml}
                        </select>
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 5px; font-size: 0.9em;">
                        <strong>Малый тайник:</strong> до 5 фунтов, до 900 зм, КС 15<br>
                        <strong>Средний тайник:</strong> до 10 фунтов, до 2,500 зм, КС 20<br>
                        <strong>Крупный тайник:</strong> до 20 фунтов, без лимита стоимости, КС 30
                    </div>
                </form>
            `;
            
            new Dialog({
                title: "Создание тайника - выбор размера",
                content,
                buttons: {
                    confirm: {
                        label: "Продолжить",
                        callback: (html) => {
                            const selectedSize = html.find('#cache-size-select').val();
                            resolve(selectedSize);
                        }
                    },
                    cancel: {
                        label: "Отмена",
                        callback: () => resolve(null)
                    }
                },
                default: "confirm",
                close: () => resolve(null)
            }).render(true);
        });
    }

    /**
     * Show cache creation dialog after successful cache action
     */
    async _showCacheCreationDialog(team, roll, total, dc) {
        const def = getTeamDefinition(team.type);
        const teamName = def.label;
        
        // Use the cache size that was selected before the roll
        const selectedSize = team.selectedCacheSize || 'small';
        const sizeLabels = {
            small: "Малый (до 5 фунтов, до 900 зм)",
            medium: "Средний (до 10 фунтов, до 2,500 зм)",
            large: "Крупный (до 20 фунтов, без лимита)"
        };
        
        const content = `
            <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e9; border-radius: 5px;">
                <strong>Команда "${teamName}" успешно создала тайник!</strong><br>
                <small>Проверка: 1d20(${roll.total}) + модификаторы = ${total} против КС ${dc}</small>
            </div>
            <form style="max-width: 500px;">
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f9f9f9;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Размер тайника:</label>
                        <div style="padding: 8px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px; font-weight: bold; color: #2e7d32;">
                            ${sizeLabels[selectedSize]}
                            <input type="hidden" id="cache-size" value="${selectedSize}">
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Местоположение:</label>
                        <input type="text" id="cache-location" placeholder="Описание места" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Содержимое:</label>
                        <textarea id="cache-contents" placeholder="Описание содержимого" style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; resize: vertical;"></textarea>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Стоимость (зм):</label>
                        <input type="number" id="cache-value" value="0" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                </div>
            </form>
        `;

        new Dialog({
            title: `${teamName}: Создание тайника`,
            content,
            buttons: {
                create: {
                    label: "Создать",
                    callback: async (html) => {
                        const type = "cache"; // Всегда создаем обычный тайник
                        const size = html.find('#cache-size').val();
                        const location = html.find('#cache-location').val() || "Неизвестное место";
                        const contents = html.find('#cache-contents').val() || "Припасы";
                        const value = parseInt(html.find('#cache-value').val()) || 0;

                        // Validate cache limits
                        const limits = CACHE_LIMITS[size];
                        if (limits.maxValue && value > limits.maxValue) {
                            ui.notifications.warn(`Стоимость превышает лимит для ${size === 'small' ? 'малого' : size === 'medium' ? 'среднего' : 'большого'} тайника!`);
                            return;
                        }

                        const data = DataHandler.get();
                        const caches = [...(data.caches || [])];
                        
                        caches.push({
                            type: type,
                            size: size,
                            location: location,
                            contents: contents,
                            value: value,
                            active: true,
                            created: data.week,
                            createdBy: team.type
                        });

                        // Update teams to mark action as used
                        const teams = [...data.teams];
                        const teamIndex = teams.findIndex(t => t === team);
                        if (teamIndex >= 0) {
                            teams[teamIndex].hasActed = true;
                        }

                        await DataHandler.update({ 
                            caches, 
                            teams,
                            actionsUsedThisWeek: data.actionsUsedThisWeek + 1 
                        });

                        // Create success message
                        const sizeLabel = size === 'small' ? 'Малый' : size === 'medium' ? 'Средний' : 'Большой';
                        const typeLabel = type === 'safehouse' ? 'Убежище' : 'Тайник';
                        const typeIcon = type === 'safehouse' ? '🏠' : '📦';
                        
                        const message = this._createTeamActionMessage(
                            team, 'cache', 'success', roll, total, dc,
                            `${typeIcon} Создан ${sizeLabel.toLowerCase()} ${typeLabel.toLowerCase()}: "${location}"`
                        );

                        ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker() });
                        await this._logToJournal(message);
                        ui.notifications.info(`${teamName} создала ${sizeLabel.toLowerCase()} ${typeLabel.toLowerCase()}!`);
                    }
                },
                cancel: { label: "Отмена" }
            },
            default: "create"
        }, {
            width: 550,
            height: 450
        }).render(true);
    }

    async _onAllyDangerRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onAllyDangerRoll CLICKED ===");
        
        const button = ev.currentTarget;
        const allyIndex = parseInt(button.dataset.allyIndex);
        const dc = parseInt(button.dataset.dc);
        const allyName = button.dataset.allyName;
        
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.security || { total: 0, parts: [] };
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isAllyDangerRoll: true,
                    eventName: "Союзник в опасности",
                    allyIndex: allyIndex,
                    allyName: allyName,
                    dc: dc,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска Союзник в опасности:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Безопасность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false,
                        dc: { value: dc },
                        title: `Союзник в опасности: ${allyName}`,
                        notes: [`Проверка Безопасности для спасения союзника ${allyName}`],
                        context: {
                            type: "skill-check",
                            skill: "security",
                            action: "security",
                            isAllyDangerRoll: true,
                            eventName: "Союзник в опасности",
                            allyIndex: allyIndex,
                            allyName: allyName,
                            dc: dc
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для Союзник в опасности.");

            } catch (error) {
                console.error("Rebellion: PF2e Check.roll провалился:", error);
                // Fallback к простому броску
                await this._fallbackAllyDangerRoll(data, checkBonus, dc, allyIndex, allyName);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Союзник в опасности).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackAllyDangerRoll(data, checkBonus, dc, allyIndex, allyName);
        }
    }

    // Fallback функция для броска Союзник в опасности без PF2e API
    async _fallbackAllyDangerRoll(data, checkBonus, dc, allyIndex, allyName) {
        const securityRoll = new Roll("1d20");
        await securityRoll.evaluate();
        const total = securityRoll.total + checkBonus.total;
        
        const allies = JSON.parse(JSON.stringify(data.allies));
        const ally = allies[allyIndex];
        
        let message = `<h5>⚠️ Событие: Союзник в опасности</h5>`;
        message += `<p><strong>Союзник:</strong> ${allyName}</p>`;
        message += `<p><strong>Проверка Безопасности:</strong> ${securityRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= dc) {
            // Успех - союзник пропадает на неделю
            ally.missing = true;
            ally.missingWeek = data.week;
            message += `<p style="color:#d84315"><strong>✅ Успех!</strong> ${allyName} пропадает без вести на неделю, но не схвачен.</p>`;
            message += `<p>На следующей неделе будет проведена еще одна проверка Безопасности против того же КС для возвращения союзника.</p>`;
        } else {
            // Провал - союзник схвачен
            ally.captured = true;
            message += `<p style="color:red"><strong>❌ Провал!</strong> ${allyName} схвачен!</p>`;
            message += `<p>Союзник может быть спасен успешным действием "Спасение персонажа".</p>`;
        }
        
        await DataHandler.update({ allies });
        
        ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker({ alias: "Серебряные Вороны" })
        });
        
        // Обновляем интерфейс
        this.render();
    }

    // === ОБРАБОТЧИКИ ДЕЙСТВИЙ С ПРЕДАТЕЛЕМ ===

    async _onTraitorPersuade(ev) {
        ev.preventDefault();
        const eventIndex = parseInt(ev.currentTarget.dataset.eventIndex);
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>✨ Попытка переубеждения предателя</h5>`;
        message += `<p>Вы решили попытаться переубедить предателя из команды ${traitorTeamDef.label}.</p>`;
        message += `<p><strong>Требования для переубеждения:</strong></p>`;
        message += `<ul>
            <li>Предпримите <strong>Специальное действие</strong> во время фазы Деятельности</li>
            <li>Совершите успешную <strong>проверку Верности КС 20</strong></li>
        </ul>`;
        message += `<p><strong>При успехе:</strong></p>`;
        message += `<ul>
            <li>Предатель меняет верность</li>
            <li>Команда ${traitorTeamDef.label} больше не недееспособна</li>
            <li>Нет угрозы увеличения Известности от этого предателя в будущем</li>
            <li>Автоматически получаете 1d6 сторонников в начале следующей фазы Содержания</li>
        </ul>`;
        
        message += `<button class="traitor-persuade-attempt-btn" 
                            data-event-index="${eventIndex}"
                            data-team-type="${teamType}" 
                            style="background: #4caf50; color: white; margin: 5px; padding: 5px 10px; border: none; cursor: pointer;">
            🎲 Попытка переубеждения (КС 20)
        </button>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }

    async _onTraitorExecute(ev) {
        ev.preventDefault();
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>⚔️ Казнь предателя</h5>`;
        message += `<p>Предатель из команды ${traitorTeamDef.label} будет казнен. Это предотвратит любое увеличение Известности, но может нанести ущерб моральному духу.</p>`;
        message += `<p><strong>Проверка морального духа:</strong> Требуется проверка Верности КС 20, чтобы избежать постоянного "Низкого боевого духа".</p>`;
        
        message += `<button class="traitor-execute-loyalty-btn" data-team-type="${teamType}" style="background: #f44336; color: white; margin: 5px; padding: 5px 10px; border: none; cursor: pointer;">
            🎲 Проверка Верности (КС 20)
        </button>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }

    async _onTraitorExile(ev) {
        ev.preventDefault();
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>🚪 Изгнание предателя</h5>`;
        message += `<p>Предатель из команды ${traitorTeamDef.label} будет изгнан из города.</p>`;
        message += `<p><strong>Проверка Безопасности КС 25:</strong> Нужно убедить предателя никогда не возвращаться в Кинтарго.</p>`;
        message += `<p><strong>При провале:</strong> +2d6 Известность (предатель пробирается обратно и докладывает Барзиллаю Труну).</p>`;
        
        message += `<button class="traitor-exile-security-btn" data-team-type="${teamType}" style="background: #ff9800; color: white; margin: 5px; padding: 5px 10px; border: none; cursor: pointer;">
            🎲 Проверка Безопасности (КС 25)
        </button>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }

    async _onTraitorImprison(ev) {
        ev.preventDefault();
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const traitorTeamDef = getTeamDefinition(teamType);
        
        // Создаем событие "Предатель в тюрьме" (специальное событие без смягчения)
        const currentEvents = data.events || [];
        currentEvents.push({
            name: "Предатель в тюрьме",
            desc: `Предатель из команды ${traitorTeamDef.label} заключен в тюрьму. Вы можете переубедить, казнить или изгнать предателя. Каждую фазу содержания требуется проверка Секретности КС 20 - при провале предатель сбегает (+2d6 Известность).`,
            weekStarted: data.week,
            duration: 999,
            isPersistent: true,
            traitorTeam: teamType,
            needsSecrecyCheck: true,
            hasTraitorActions: true,
            positive: false
            // НЕ добавляем mitigate и dc - у этого эффекта свои кнопки действий
        });
        
        await DataHandler.update({ events: currentEvents });
        
        let message = `<h5>🔒 Предатель заключен в тюрьму</h5>`;
        message += `<p>Предатель из команды ${traitorTeamDef.label} заключен в тюрьму.</p>`;
        message += `<p><strong>Доступные действия:</strong> Переубедить, Казнить или Изгнать (см. эффект "Предатель в тюрьме").</p>`;
        message += `<p><strong>Внимание:</strong> Каждую фазу содержания потребуется проверка Секретности КС 20.</p>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }

    async _onTraitorExecuteLoyalty(ev) {
        ev.preventDefault();
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.loyalty || { total: 0, parts: [] };
        const dc = 20;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isTraitorExecuteLoyaltyRoll: true,
                    eventName: "Казнь предателя",
                    teamType: teamType,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска казни предателя:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Верность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "loyalty",
                            action: "loyalty",
                            isTraitorExecuteLoyaltyRoll: true,
                            eventName: "Казнь предателя",
                            teamType: teamType
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для казни предателя.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackTraitorExecuteLoyalty(data, checkBonus, dc, teamType);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Казнь предателя).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackTraitorExecuteLoyalty(data, checkBonus, dc, teamType);
        }
    }

    // Fallback функция для броска казни предателя без PF2e API
    async _fallbackTraitorExecuteLoyalty(data, checkBonus, dc, teamType) {
        const loyaltyRoll = new Roll("1d20");
        await loyaltyRoll.evaluate();
        const total = loyaltyRoll.total + checkBonus.total;
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>⚔️ Проверка морального духа после казни</h5>`;
        message += `<p><strong>Проверка Верности:</strong> ${loyaltyRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= dc) {
            message += `<p style="color:green"><strong>✅ Успех!</strong> Серебряные Вороны понимают необходимость казни. Моральный дух не пострадал.</p>`;
        } else {
            message += `<p style="color:red"><strong>❌ Провал!</strong> Казнь предателя нанесла ущерб моральному духу.</p>`;
            
            // Добавляем постоянный эффект "Низкий боевой дух" (как при вторжении)
            const currentEvents = data.events || [];
            const lowMoraleEvent = {
                name: "Низкий боевой дух",
                desc: "Постоянный низкий боевой дух после казни предателя. -4 Верность. Смягчение: Выступление КС 20 снижает до -2.",
                weekStarted: data.week,
                duration: 999, // Постоянное событие
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
            message += `<p><strong>Эффект:</strong> Постоянный "Низкий боевой дух" (-4 Верность). Можно смягчить проверкой Выступления КС 20.</p>`;
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isTraitorExecuteLoyaltyRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onTraitorExileSecurity(ev) {
        ev.preventDefault();
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.security || { total: 0, parts: [] };
        const dc = 25;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isTraitorExileSecurityRoll: true,
                    eventName: "Изгнание предателя",
                    teamType: teamType,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска изгнания предателя:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Безопасность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "security",
                            action: "security",
                            isTraitorExileSecurityRoll: true,
                            eventName: "Изгнание предателя",
                            teamType: teamType
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для изгнания предателя.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackTraitorExileSecurity(data, checkBonus, dc, teamType);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Изгнание предателя).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackTraitorExileSecurity(data, checkBonus, dc, teamType);
        }
    }

    // Fallback функция для броска изгнания предателя без PF2e API
    async _fallbackTraitorExileSecurity(data, checkBonus, dc, teamType) {
        const securityRoll = new Roll("1d20");
        await securityRoll.evaluate();
        const total = securityRoll.total + checkBonus.total;
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>🚪 Проверка изгнания предателя</h5>`;
        message += `<p><strong>Проверка Безопасности:</strong> ${securityRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= dc) {
            message += `<p style="color:green"><strong>✅ Успех!</strong> Предатель убежден никогда не возвращаться в Кинтарго. Угроза устранена.</p>`;
        } else {
            const notRoll = new Roll("2d6");
            await notRoll.evaluate();
            const notGain = notRoll.total;
            
            message += `<p style="color:red"><strong>❌ Провал!</strong> Предатель пробрался обратно в город и доложил Барзиллаю Труну.</p>`;
            message += `<p><strong>Последствия:</strong> +${notGain} Известность.</p>`;
            
            await DataHandler.update({
                notoriety: data.notoriety + notGain
            });
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isTraitorExileSecurityRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onTraitorPrisonSecrecy(ev) {
        ev.preventDefault();
        const eventIndex = parseInt(ev.currentTarget.dataset.eventIndex);
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.secrecy || { total: 0, parts: [] };
        const dc = 20;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isTraitorPrisonSecrecyRoll: true,
                    eventName: "Содержание предателя в тюрьме",
                    teamType: teamType,
                    eventIndex: eventIndex,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска содержания предателя:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Секретность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "secrecy",
                            action: "secrecy",
                            isTraitorPrisonSecrecyRoll: true,
                            eventName: "Содержание предателя в тюрьме",
                            teamType: teamType,
                            eventIndex: eventIndex
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для содержания предателя.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackTraitorPrisonSecrecy(data, checkBonus, dc, teamType, eventIndex);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Содержание предателя).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackTraitorPrisonSecrecy(data, checkBonus, dc, teamType, eventIndex);
        }
    }

    // Fallback функция для броска содержания предателя без PF2e API
    async _fallbackTraitorPrisonSecrecy(data, checkBonus, dc, teamType, eventIndex) {
        const secrecyRoll = new Roll("1d20");
        await secrecyRoll.evaluate();
        const total = secrecyRoll.total + checkBonus.total;
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>🔒 Проверка содержания предателя в тюрьме</h5>`;
        message += `<p><strong>Проверка Секретности:</strong> ${secrecyRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= dc) {
            message += `<p style="color:green"><strong>✅ Успех!</strong> Предатель из команды ${traitorTeamDef.label} остается в заключении.</p>`;
            message += `<p>Тюремное заключение продолжается. Проверка потребуется снова в следующую фазу содержания.</p>`;
            message += `<p>Вы по-прежнему можете переубедить, казнить или изгнать предателя.</p>`;
        } else {
            const notRoll = new Roll("2d6");
            await notRoll.evaluate();
            const notGain = notRoll.total;
            
            message += `<p style="color:red"><strong>❌ Провал!</strong> Предатель сбежал из заключения!</p>`;
            message += `<p><strong>Последствия:</strong> +${notGain} Известность.</p>`;
            
            // Удаляем событие "Предатель в тюрьме"
            const events = JSON.parse(JSON.stringify(data.events || []));
            events.splice(eventIndex, 1);
            
            await DataHandler.update({
                events: events,
                notoriety: data.notoriety + notGain
            });
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isTraitorPrisonSecrecyRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onTraitorPersuadeAttempt(ev) {
        ev.preventDefault();
        const eventIndex = parseInt(ev.currentTarget.dataset.eventIndex);
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const bonuses = DataHandler.getRollBonuses(data);
        const checkBonus = bonuses.loyalty || { total: 0, parts: [] };
        const dc = 20;
        
        // Используем PF2e API для показа интерфейса броска
        if (game.pf2e && game.pf2e.Check && game.pf2e.Modifier && game.pf2e.CheckModifier) {
            console.log("PF2e API найден. Показываем интерфейс броска...");
            
            const modifiers = checkBonus.parts.map(p => new game.pf2e.Modifier({
                label: p.label,
                modifier: p.value,
                type: "untyped"
            }));

            const actor = game.user.character || game.actors.find(a => a.hasPlayerOwner && a.type === "character") || game.actors.first();
            if (!actor) console.warn("Rebellion: Актор не найден. Диалог может не появиться.");

            try {
                // Устанавливаем состояние для обработки результата
                game.rebellionState = {
                    isTraitorPersuadeAttemptRoll: true,
                    eventName: "Переубеждение предателя",
                    teamType: teamType,
                    eventIndex: eventIndex,
                    timestamp: Date.now()
                };
                console.log("Rebellion: Состояние установлено для броска переубеждения предателя:", game.rebellionState);

                await game.pf2e.Check.roll(
                    new game.pf2e.CheckModifier("Верность", { modifiers }),
                    {
                        actor: actor,
                        type: 'check',
                        createMessage: true,
                        skipDialog: false, // Показываем диалог
                        dc: { value: dc },
                        context: {
                            type: "skill-check",
                            skill: "loyalty",
                            action: "loyalty",
                            isTraitorPersuadeAttemptRoll: true,
                            eventName: "Переубеждение предателя",
                            teamType: teamType,
                            eventIndex: eventIndex
                        }
                    },
                    ev
                );
                console.log("PF2e Check.roll выполнен для переубеждения предателя.");

            } catch (err) {
                console.error("Rebellion: PF2e Check.roll провалился:", err);
                // Fallback к простому броску
                await this._fallbackTraitorPersuadeAttempt(data, checkBonus, dc, teamType, eventIndex);
            } finally {
                // Очищаем состояние через таймаут
                setTimeout(() => {
                    game.rebellionState = null;
                    console.log("Rebellion: Состояние очищено (Переубеждение предателя).");
                }, 60000);
            }
        } else {
            // Fallback если PF2e API недоступен
            console.log("PF2e API недоступен. Используем fallback бросок.");
            await this._fallbackTraitorPersuadeAttempt(data, checkBonus, dc, teamType, eventIndex);
        }
    }

    // Fallback функция для броска переубеждения предателя без PF2e API
    async _fallbackTraitorPersuadeAttempt(data, checkBonus, dc, teamType, eventIndex) {
        const loyaltyRoll = new Roll("1d20");
        await loyaltyRoll.evaluate();
        const total = loyaltyRoll.total + checkBonus.total;
        const traitorTeamDef = getTeamDefinition(teamType);
        
        let message = `<h5>✨ Попытка переубеждения предателя</h5>`;
        message += `<p><strong>Проверка Верности:</strong> ${loyaltyRoll.total} + ${checkBonus.total} = ${total} vs КС ${dc}</p>`;
        
        if (total >= dc) {
            const supportersRoll = new Roll("1d6");
            await supportersRoll.evaluate();
            const supportersGain = supportersRoll.total;
            
            message += `<p style="color:green"><strong>✅ Успех!</strong> Предатель из команды ${traitorTeamDef.label} переубежден!</p>`;
            message += `<p><strong>Результаты:</strong></p>`;
            message += `<ul>
                <li>Предатель меняет верность</li>
                <li>Команда ${traitorTeamDef.label} восстановлена и больше не недееспособна</li>
                <li>+${supportersGain} сторонников в начале следующей фазы содержания</li>
                <li>Больше нет угрозы увеличения Известности от этого предателя</li>
            </ul>`;
            
            // Восстанавливаем команду
            const teams = JSON.parse(JSON.stringify(data.teams));
            const teamIndex = teams.findIndex(t => t.type === teamType);
            if (teamIndex !== -1) {
                teams[teamIndex].disabled = false;
            }
            
            // Удаляем событие "Предатель в тюрьме"
            const events = JSON.parse(JSON.stringify(data.events || []));
            events.splice(eventIndex, 1);
            
            // Добавляем событие бонусных сторонников (активируется в следующую фазу содержания)
            events.push({
                name: "Бонус от переубеждения",
                desc: `+${supportersGain} сторонников от успешного переубеждения предателя`,
                weekStarted: data.week + 1, // Активируется в следующую неделю
                duration: 1,
                supportersBonus: supportersGain,
                needsSupportersCollection: true
            });
            
            await DataHandler.update({
                teams: teams,
                events: events
            });
            
            // Force sheet update to refresh maintenance event count for next week
            setTimeout(() => {
                this.render(false); // Force refresh without closing
            }, 100);
        } else {
            message += `<p style="color:red"><strong>❌ Провал!</strong> Попытка переубеждения не удалась.</p>`;
            message += `<p>Предатель остается в заключении. Можете попробовать снова или выбрать другой вариант (казнь, изгнание).</p>`;
        }
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker(),
            flags: {
                "pf2e-ts-adv-pf1ehr": {
                    isTraitorPersuadeAttemptRoll: true
                }
            }
        });
        
        this.render();
    }

    async _onTraitorExecuteFromPrison(ev) {
        ev.preventDefault();
        const eventIndex = parseInt(ev.currentTarget.dataset.eventIndex);
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const traitorTeamDef = getTeamDefinition(teamType);
        
        // Удаляем событие "Предатель в тюрьме"
        const events = JSON.parse(JSON.stringify(data.events || []));
        events.splice(eventIndex, 1);
        await DataHandler.update({ events: events });
        
        let message = `<h5>⚔️ Казнь предателя из тюрьмы</h5>`;
        message += `<p>Предатель из команды ${traitorTeamDef.label} будет казнен. Это предотвратит любое увеличение Известности, но может нанести ущерб моральному духу.</p>`;
        message += `<p><strong>Проверка морального духа:</strong> Требуется проверка Верности КС 20, чтобы избежать постоянного "Низкого боевого духа".</p>`;
        
        message += `<button class="traitor-execute-loyalty-btn" data-team-type="${teamType}" style="background: #f44336; color: white; margin: 5px; padding: 5px 10px; border: none; cursor: pointer;">
            🎲 Проверка Верности (КС 20)
        </button>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }

    async _onTraitorExileFromPrison(ev) {
        ev.preventDefault();
        const eventIndex = parseInt(ev.currentTarget.dataset.eventIndex);
        const teamType = ev.currentTarget.dataset.teamType;
        const data = DataHandler.get();
        const traitorTeamDef = getTeamDefinition(teamType);
        
        // Удаляем событие "Предатель в тюрьме"
        const events = JSON.parse(JSON.stringify(data.events || []));
        events.splice(eventIndex, 1);
        await DataHandler.update({ events: events });
        
        let message = `<h5>🚪 Изгнание предателя из тюрьмы</h5>`;
        message += `<p>Предатель из команды ${traitorTeamDef.label} будет изгнан из города.</p>`;
        message += `<p><strong>Проверка Безопасности КС 25:</strong> Нужно убедить предателя никогда не возвращаться в Кинтарго.</p>`;
        message += `<p><strong>При провале:</strong> +2d6 Известность (предатель пробирается обратно и докладывает Барзиллаю Труну).</p>`;
        
        message += `<button class="traitor-exile-security-btn" data-team-type="${teamType}" style="background: #ff9800; color: white; margin: 5px; padding: 5px 10px; border: none; cursor: pointer;">
            🎲 Проверка Безопасности (КС 25)
        </button>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }

    async _onCollectSupportersBonus(ev) {
        ev.preventDefault();
        const eventIndex = parseInt(ev.currentTarget.dataset.eventIndex);
        const supportersBonus = parseInt(ev.currentTarget.dataset.supportersBonus);
        const data = DataHandler.get();
        
        // Удаляем событие бонуса
        const events = JSON.parse(JSON.stringify(data.events || []));
        events.splice(eventIndex, 1);
        
        // Добавляем сторонников
        const newSupporters = (data.supporters || 0) + supportersBonus;
        
        await DataHandler.update({
            events: events,
            supporters: newSupporters
        });
        
        let message = `<h5>🎁 Бонус от переубеждения получен</h5>`;
        message += `<p><strong>Получено:</strong> +${supportersBonus} сторонников</p>`;
        message += `<p><strong>Всего сторонников:</strong> ${newSupporters}</p>`;
        message += `<p><em>Переубежденный предатель привел новых союзников в ряды Серебряных Воронов!</em></p>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }

    // === ДЬЯВОЛЬСКОЕ ПРОНИКНОВЕНИЕ ===
    
    async _onDevilWeeksRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onDevilWeeksRoll CLICKED ===");
        
        const data = DataHandler.get();
        
        // Определяем количество недель проникновения (взрывающийся d6)
        let weeksRoll = new Roll("1d6");
        await weeksRoll.evaluate();
        let totalWeeks = weeksRoll.total;
        let rollHistory = [weeksRoll.total];
        
        // Перебрасываем на 6
        while (weeksRoll.total === 6) {
            weeksRoll = new Roll("1d6");
            await weeksRoll.evaluate();
            totalWeeks += weeksRoll.total;
            rollHistory.push(weeksRoll.total);
        }
        
        // Ограничиваем количество недель активности Серебряных Воронов
        const maxWeeks = data.week || 1;
        const finalWeeks = Math.min(totalWeeks, maxWeeks);
        
        let message = `<h5>🎲 Дьявольское проникновение - Определение недель</h5>`;
        message += `<p><strong>Броски d6:</strong> [${rollHistory.join(', ')}] = ${totalWeeks} недель</p>`;
        message += `<p><strong>Ограничено активностью:</strong> ${finalWeeks} недель (максимум ${maxWeeks})</p>`;
        message += `<p>Проникновение продолжалось <strong>${finalWeeks} недель</strong> незамеченным.</p>`;
        
        // Сохраняем данные для следующего этапа в game.rebellionState
        game.rebellionState = {
            isDevilInfiltration: true,
            eventName: "Дьявольское проникн.",
            devilWeeks: finalWeeks,
            devilRollHistory: rollHistory,
            timestamp: Date.now()
        };
        console.log("Данные сохранены в game.rebellionState:", game.rebellionState);
        
        message += `<p>Теперь офицер может попытаться обнаружить проникновение раньше.</p>`;
        message += `<button class="roll-devil-perception-btn" 
                            data-event="Дьявольское проникн.">
            🎲 Проверка Проницательности (КС 20)
        </button>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        this.render();
    }
    
    async _onDevilPerceptionRoll(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        console.log("=== _onDevilPerceptionRoll CLICKED ===");
        
        const data = DataHandler.get();
        
        // Проверяем данные в game.rebellionState
        console.log("game.rebellionState:", game.rebellionState);
        
        if (!game.rebellionState || !game.rebellionState.isDevilInfiltration || !game.rebellionState.devilWeeks) {
            console.error("Данные не найдены в game.rebellionState");
            ui.notifications.error("Сначала нужно определить недели проникновения!");
            return;
        }
        
        let totalWeeks = game.rebellionState.devilWeeks;
        const rollHistory = game.rebellionState.devilRollHistory || [];
        console.log("Загружены данные: недели =", totalWeeks, "история =", rollHistory);
        
        // Проверка Проницательности КС 20
        const perceptionRoll = new Roll("1d20");
        await perceptionRoll.evaluate();
        
        // Ищем офицера-Стража для проверки Восприятия
        let perceptionBonus = 0;
        let sentinelName = "Нет офицера-Стража";
        const sentinel = data.officers?.find(off => off.role === 'sentinel' && off.actorId);
        if (sentinel) {
            const actor = game.actors.get(sentinel.actorId);
            if (actor) {
                sentinelName = actor.name;
                // Получаем модификатор Восприятия из PF2e актера
                perceptionBonus = actor.system?.attributes?.perception?.totalModifier || 
                                actor.system?.perception?.totalModifier || 
                                actor.system?.skills?.perception?.totalModifier || 0;
            }
        }
        
        const perceptionTotal = perceptionRoll.total + perceptionBonus;
        const perceptionSuccess = perceptionTotal >= 20;
        
        let message = `<h5>🎲 Дьявольское проникновение - Проверка Проницательности</h5>`;
        message += `<p><strong>Офицер-Страж:</strong> ${sentinelName}</p>`;
        message += `<p><strong>Бросок:</strong> ${perceptionRoll.total} + ${perceptionBonus} = ${perceptionTotal} vs КС 20</p>`;
        
        if (perceptionSuccess) {
            totalWeeks = Math.ceil(totalWeeks / 2);
            message += `<p style="color:green"><strong>✓ УСПЕХ!</strong> Проникновение обнаружено раньше!</p>`;
            message += `<p>Недели проникновения уменьшены вдвое: <strong>${totalWeeks} недель</strong></p>`;
        } else {
            message += `<p style="color:red"><strong>✗ ПРОВАЛ!</strong> Проникновение не обнаружено вовремя.</p>`;
            message += `<p>Проникновение продолжалось полные <strong>${totalWeeks} недель</strong></p>`;
        }
        
        // Обновляем данные в game.rebellionState
        game.rebellionState.devilFinalWeeks = totalWeeks;
        game.rebellionState.perceptionRoll = perceptionTotal;
        game.rebellionState.perceptionSuccess = perceptionSuccess;
        console.log("Обновлены данные в game.rebellionState:", game.rebellionState);
        
        // Рассчитываем прирост Известности
        let notorietyGain = 0;
        let notorietyRolls = [];
        for (let i = 0; i < totalWeeks; i++) {
            const notRoll = new Roll("1d6");
            await notRoll.evaluate();
            notorietyGain += notRoll.total;
            notorietyRolls.push(notRoll.total);
        }
        
        message += `<p><strong>Прирост Известности:</strong> ${totalWeeks} недель × 1d6</p>`;
        message += `<p><strong>Броски:</strong> [${notorietyRolls.join(', ')}] = +${notorietyGain} Известность</p>`;
        
        // Проверка Верности КС 15 для уменьшения прироста
        const bonuses = DataHandler.getRollBonuses(data);
        const loyaltyRoll = new Roll("1d20");
        await loyaltyRoll.evaluate();
        const loyaltyBonus = bonuses.loyalty.total;
        const loyaltyTotal = loyaltyRoll.total + loyaltyBonus;
        const loyaltySuccess = loyaltyTotal >= 15;
        
        message += `<p><strong>Проверка Верности:</strong> ${loyaltyRoll.total} + ${loyaltyBonus} = ${loyaltyTotal} vs КС 15</p>`;
        
        if (loyaltySuccess) {
            notorietyGain = Math.ceil(notorietyGain / 2);
            message += `<p style="color:green"><strong>✓ УСПЕХ!</strong> Прирост Известности уменьшен вдвое до ${notorietyGain}</p>`;
        } else {
            message += `<p style="color:red"><strong>✗ ПРОВАЛ!</strong> Полный прирост Известности: ${notorietyGain}</p>`;
        }
        
        // Применяем изменения
        const newNotoriety = data.notoriety + notorietyGain;
        await DataHandler.update({ notoriety: newNotoriety });
        
        message += `<p><strong>Итого Известность:</strong> ${data.notoriety} -> ${newNotoriety} (+${notorietyGain})</p>`;
        message += `<p><em>Дьявольское проникновение раскрыто! Замаскированный дьявол изгнан из рядов Серебряных Воронов.</em></p>`;
        
        await ChatMessage.create({
            content: message,
            speaker: ChatMessage.getSpeaker()
        });
        
        // Очищаем состояние после завершения события
        game.rebellionState = null;
        console.log("Состояние очищено (Дьявольское проникновение завершено)");
        
        this.render();
    }
}