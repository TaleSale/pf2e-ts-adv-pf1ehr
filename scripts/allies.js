/**
 * Ally Definitions for the Silver Ravens Rebellion
 * Based on Hell's Rebels Adventure Path
 */

export const ALLY_DEFINITIONS = {
    // === ADVENTURE 1: IN HELL'S BRIGHT SHADOW ===
    laria: {
        name: "Лариа Лонгроуд",
        img: "modules/pf2e-ts-adv-pf1ehr/allbooks/allies/lariatr.webp",
        description: "+2 к проверкам Верности для действия Вербовать сторонников.",
        desc: "+2 Верность (Вербовка).",
        canBeOfficer: false,
        adventure: 1,
        level: 3,
        bonuses: {
            recruitmentLoyalty: 2
        }
    },
    rexus: {
        name: "Рексус Виктокора",
        img: "modules/pf2e-ts-adv-pf1ehr/allbooks/allies/rexustr.webp",
        description: "Снижает Известность на 1 в начале каждой Фазы Содержания.",
        desc: "-1 Известность (Содержание).",
        canBeOfficer: false,
        adventure: 1,
        level: 2,
        bonuses: {
            notorietyReduction: 1
        }
    },
    vendalfek: {
        name: "Вендалфек",
        img: "modules/pf2e-ts-adv-pf1ehr/allbooks/allies/Vendalfektr.webp",
        description: "Позволяет использовать действие Распространение дезинформации без специальной команды. Если команда есть, даёт +4 к проверкам Секретности для этого действия.",
        desc: "+4 Секретность (Дезинформация).",
        canBeOfficer: false,
        adventure: 1,
        level: 4,
        bonuses: {
            enablesDisinformation: true,
            disinformationSecrecy: 4
        }
    },
    blosodriette: {
        name: "Блосодриетта",
        img: "modules/pf2e-ts-adv-pf1ehr/allbooks/allies/Blosodriettetr.webp",
        description: "+1 ко всем проверкам Секретности. Однако присутствие дьявола вызывает -1 ко всем проверкам Верности.",
        desc: "+1 Секретность, -1 Верность.",
        canBeOfficer: false,
        adventure: 1,
        level: 6,
        bonuses: {
            secrecy: 1,
            loyalty: -1
        }
    },

    // === ADVENTURE 2: TURN OF THE TORRENT ===
    cassius: {
        name: "Капитан Кассий Саргаэта",
        img: "icons/svg/mystery-man.svg",
        description: "Обеспечивает иммунитет к событию 'Усиленные Патрули'. При выпадении этого события вместо штрафов восстание получает +3d6 сторонников.",
        desc: "Иммунитет к 'Усиленным Патрулям' (+3d6 сторонников).",
        canBeOfficer: false,
        adventure: 2,
        level: 7,
        bonuses: {
            immuneToIncreasedPatrols: true
        }
    },
    octavio: {
        name: "Ликтор Октавио Сабинус",
        img: "icons/svg/mystery-man.svg",
        description: "+4 к проверкам Безопасности для действия Спасение персонажа. Обеспечивает иммунитет к событию 'Низкий боевой дух'.",
        desc: "+4 Безопасность (Спасение). Иммунитет к 'Низкой Морали'.",
        canBeOfficer: false,
        adventure: 2,
        level: 8,
        bonuses: {
            rescueSecurity: 4,
            immuneToLowMorale: true
        }
    },
    hetamon: {
        name: "Хетамон Хаас",
        img: "icons/svg/mystery-man.svg",
        description: "Снижает Известность на 1d6 в начале Фазы Содержания. Иммунитет к событию 'Болезнь'. Один раз в месяц может бесплатно создать тайник с припасами.",
        desc: "-1d6 Известность (Содержание). Иммунитет к 'Болезни'.",
        canBeOfficer: false,
        adventure: 2,
        level: 6,
        bonuses: {
            notorietyReductionDice: "1d6",
            immuneToSickness: true,
            freeCacheMonthly: true
        }
    },

    // === ADVENTURE 3: DANCE OF THE DAMNED ===
    jilia: {
        name: "Джилия Байнилус",
        img: "icons/svg/mystery-man.svg",
        description: "+2 к проверкам Безопасности и Верности. Может служить офицером Серебряных Воронов.",
        desc: "+2 Безопасность и Верность.",
        canBeOfficer: true,
        adventure: 3,
        level: 9,
        bonuses: {
            security: 2,
            loyalty: 2
        }
    },
    mialari: {
        name: "Миалари Докур",
        img: "icons/svg/mystery-man.svg",
        description: "+1 к проверкам выбранного типа (Верность, Секретность или Безопасность). Выбор можно менять раз в неделю. Может служить офицером.",
        desc: "+1 к выбранной проверке.",
        canBeOfficer: true,
        hasChoice: true,
        adventure: 3,
        level: 10,
        bonuses: {
            selectedBonus: 1
        }
    },
    manticce: {
        name: "Королева Мантикке Калиикии",
        img: "icons/svg/mystery-man.svg",
        description: "Восстание не теряет сторонников из-за нехватки казны. Серебряные Вороны могут предпринять бонусное действие Заработок золота, если любимый ПИ королевы возглавляет команду.",
        desc: "Иммунитет к нехватке казны. Бонус Заработок золота.",
        canBeOfficer: false,
        adventure: 3,
        level: 12,
        bonuses: {
            immuneToTreasuryShortage: true,
            bonusEarnGold: true
        }
    },
    tayacet: {
        name: "Таясет Тиора",
        img: "icons/svg/mystery-man.svg",
        description: "Пока прикрытие не раскрыто: +2 к Секретности и Безопасности. После раскрытия: +2 к Верности.",
        desc: "Скрыта: +2 Секр/Безоп. Раскрыта: +2 Верн.",
        canBeOfficer: false,
        hasState: true,
        stateLabel: "Прикрытие раскрыто",
        adventure: 3,
        level: 8,
        bonuses: {
            // When state is true (cover blown): +2 loyalty
            // When state is false (cover intact): +2 secrecy and security
            conditionalBonuses: {
                true: { loyalty: 2 },
                false: { secrecy: 2, security: 2 }
            }
        }
    },

    // === ADVENTURE 4: A SONG OF SILVER ===
    chuko: {
        name: "Чуко",
        img: "icons/svg/mystery-man.svg",
        description: "Советы Чуко позволяют Серебряным Воронам перебрасывать одну проверку Безопасности в неделю.",
        desc: "Переброс 1 Безопасности в неделю.",
        canBeOfficer: true,
        adventure: 4,
        level: 11,
        bonuses: {
            rerollSecurity: 1
        }
    },
    jackdaw: {
        name: "Галка",
        img: "icons/svg/mystery-man.svg",
        description: "Возвращение Галки даёт бонус +1 ко всем проверкам организации.",
        desc: "+1 ко всем проверкам.",
        canBeOfficer: true,
        adventure: 4,
        level: 13,
        bonuses: {
            loyalty: 1,
            security: 1,
            secrecy: 1
        }
    },
    molly: {
        name: "Молли Майэппл",
        img: "icons/svg/mystery-man.svg",
        description: "Навык Молли в шпионаже позволяет любой команде, которую она возглавляет, получить действия Тайная операция и Саботаж.",
        desc: "Команда получает 'Тайную операцию' и 'Саботаж'.",
        canBeOfficer: true,
        adventure: 4,
        level: 10,
        bonuses: {
            teamGainsCovert: true,
            teamGainsSabotage: true
        }
    },
    shensen: {
        name: "Шенсен",
        img: "icons/svg/mystery-man.svg",
        description: "Советы Шенсен позволяют Серебряным Воронам перебрасывать одну проверку Верности в неделю.",
        desc: "Переброс 1 Верности в неделю.",
        canBeOfficer: true,
        adventure: 4,
        level: 12,
        bonuses: {
            rerollLoyalty: 1
        }
    },
    strea: {
        name: "Стреа Вестори",
        img: "icons/svg/mystery-man.svg",
        description: "Советы Стреа позволяют Серебряным Воронам перебрасывать одну проверку Секретности в неделю.",
        desc: "Переброс 1 Секретности в неделю.",
        canBeOfficer: true,
        adventure: 4,
        level: 11,
        bonuses: {
            rerollSecrecy: 1
        }
    }
};

/**
 * Find ally slug by actor name (partial match)
 */
export function findAllyByActorName(name) {
    const l = name.toLowerCase();
    for (const [k, v] of Object.entries(ALLY_DEFINITIONS)) {
        if (v.name.toLowerCase().split(" / ")[0].includes(l) || l.includes(v.name.toLowerCase().split(" ")[0])) return k;
    }
    return null;
}

/**
 * Get ally definition by slug
 */
export function getAllyData(slug) {
    return ALLY_DEFINITIONS[slug] || null;
}

/**
 * Get all ally definitions as array with slugs
 */
export function getAllAllies() {
    return Object.entries(ALLY_DEFINITIONS).map(([slug, data]) => ({
        slug,
        ...data
    }));
}

/**
 * Get allies grouped by adventure
 */
export function getAlliesByAdventure() {
    const grouped = {};
    for (const [slug, ally] of Object.entries(ALLY_DEFINITIONS)) {
        const adv = ally.adventure || 1;
        if (!grouped[adv]) grouped[adv] = [];
        grouped[adv].push({ slug, ...ally });
    }
    return grouped;
}