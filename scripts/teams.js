// Map Actions to Checks for Base Bonus calculation
export const ACTION_CHECKS = {
    blackMarket: "secrecy", safehouse: null, changeOfficer: null, covert: "secrecy",
    dismiss: "loyalty", earnGold: "security", gatherInfo: "secrecy", guarantee: null,
    knowledge: "secrecy", lieLow: null, manipulate: null, recruitSupporters: "loyalty",
    recruitTeam: null, reduceDanger: "security", refreshMarket: null, rescue: "security",
    restore: null, sabotage: "secrecy", cache: "secrecy", special: null, specialOrder: null,
    disinformation: "secrecy", urbanInfluence: null, upgrade: null
};

// DC for actions (null = no check, "rank" = 10 + rank, number = fixed DC, "earnIncome" = use PF2e Earn Income table)
export const ACTION_DC = {
    blackMarket: 20,
    safehouse: null,
    changeOfficer: null,
    covert: null,
    dismiss: 10,
    earnGold: "earnIncome", // Uses PF2e Earn Income DC by rebellion rank
    gatherInfo: 15,
    guarantee: null,
    knowledge: null,
    lieLow: null,
    manipulate: null,
    recruitSupporters: "rank",
    recruitTeam: null,
    reduceDanger: 15,
    refreshMarket: null,
    rescue: "level",
    restore: null,
    sabotage: 20,
    cache: { small: 15, medium: 20, large: 30 },
    special: null,
    specialOrder: null,
    disinformation: 20,
    urbanInfluence: null
};

// PF2e Earn Income table - DC and income by level (for 7 days of work)
// Income is in copper pieces for precision, convert to gold when displaying
// Based on official PF2e Earn Income table (daily rate × 7)
// failure column is used for failed checks (not critical failure)
export const EARN_INCOME_TABLE = {
    //        DC    failure   trained   expert    master    legendary
    0:  { dc: 14, failure: 7,     trained: 35,     expert: 35,     master: 35,     legendary: 35 },     // 1мм/5мм
    1:  { dc: 15, failure: 14,    trained: 140,    expert: 140,    master: 140,    legendary: 140 },    // 2мм/2см
    2:  { dc: 16, failure: 28,    trained: 210,    expert: 210,    master: 210,    legendary: 210 },    // 4мм/3см
    3:  { dc: 18, failure: 56,    trained: 350,    expert: 350,    master: 350,    legendary: 350 },    // 8мм/5см
    4:  { dc: 19, failure: 70,    trained: 490,    expert: 560,    master: 560,    legendary: 560 },    // 1см/7см/8см
    5:  { dc: 20, failure: 140,   trained: 630,    expert: 700,    master: 700,    legendary: 700 },    // 2см/9см/1зм
    6:  { dc: 22, failure: 210,   trained: 1050,   expert: 1400,   master: 1400,   legendary: 1400 },   // 3см/1.5зм/2зм
    7:  { dc: 23, failure: 280,   trained: 1400,   expert: 1750,   master: 1750,   legendary: 1750 },   // 4см/2зм/2.5зм
    8:  { dc: 24, failure: 350,   trained: 1750,   expert: 2100,   master: 2100,   legendary: 2100 },   // 5см/2.5зм/3зм
    9:  { dc: 26, failure: 420,   trained: 2100,   expert: 2800,   master: 2800,   legendary: 2800 },   // 6см/3зм/4зм
    10: { dc: 27, failure: 490,   trained: 2800,   expert: 3500,   master: 4200,   legendary: 4200 },   // 7см/4зм/5зм/6зм
    11: { dc: 28, failure: 560,   trained: 3500,   expert: 4200,   master: 5600,   legendary: 5600 },   // 8см/5зм/6зм/8зм
    12: { dc: 30, failure: 630,   trained: 4200,   expert: 5600,   master: 7000,   legendary: 7000 },   // 9см/6зм/8зм/10зм
    13: { dc: 31, failure: 700,   trained: 4900,   expert: 7000,   master: 10500,  legendary: 10500 },  // 1зм/7зм/10зм/15зм
    14: { dc: 32, failure: 1050,  trained: 5600,   expert: 10500,  master: 14000,  legendary: 14000 },  // 1.5зм/8зм/15зм/20зм
    15: { dc: 34, failure: 1400,  trained: 7000,   expert: 14000,  master: 19600,  legendary: 19600 },  // 2зм/10зм/20зм/28зм
    16: { dc: 35, failure: 1750,  trained: 9100,   expert: 17500,  master: 25200,  legendary: 28000 },  // 2.5зм/13зм/25зм/36зм/40зм
    17: { dc: 36, failure: 2100,  trained: 10500,  expert: 21000,  master: 31500,  legendary: 38500 },  // 3зм/15зм/30зм/45зм/55зм
    18: { dc: 38, failure: 2800,  trained: 14000,  expert: 31500,  master: 49000,  legendary: 63000 },  // 4зм/20зм/45зм/70зм/90зм
    19: { dc: 39, failure: 4200,  trained: 21000,  expert: 42000,  master: 70000,  legendary: 91000 },  // 6зм/30зм/60зм/100зм/130зм
    20: { dc: 40, failure: 5600,  trained: 28000,  expert: 52500,  master: 105000, legendary: 140000 }, // 8зм/40зм/75зм/150зм/200зм
    21: { dc: 40, failure: 5600,  trained: 35000,  expert: 63000,  master: 122500, legendary: 210000 }  // crit20: 50зм/90зм/175зм/300зм
};

// Get proficiency level based on team rank
export function getTeamProficiency(teamRank) {
    switch (teamRank) {
        case 1: return 'trained';
        case 2: return 'expert';
        case 3: return 'master';
        default: return 'trained';
    }
}

// Get proficiency bonus based on team rank (like PF2e proficiency bonus)
// Trained = 2, Expert = 4, Master = 6, Legendary = 8
export function getTeamProficiencyBonus(teamRank) {
    switch (teamRank) {
        case 1: return 2;  // Trained
        case 2: return 4;  // Expert
        case 3: return 6;  // Master
        default: return 2;
    }
}

// Get half rebellion rank bonus (rounded up)
export function getHalfRankBonus(rebellionRank) {
    return Math.ceil(rebellionRank / 2);
}

// Get total Earn Income modifier: half rank (rounded up) + proficiency bonus
export function getEarnIncomeModifier(rebellionRank, teamRank) {
    const halfRank = getHalfRankBonus(rebellionRank);
    const profBonus = getTeamProficiencyBonus(teamRank);
    return halfRank + profBonus;
}

// Get Earn Income DC for a given level
export function getEarnIncomeDC(level) {
    const clampedLevel = Math.max(0, Math.min(20, level));
    return EARN_INCOME_TABLE[clampedLevel]?.dc || 14;
}

// Get Earn Income result for 7 days based on level, proficiency, and roll result
export function calculateEarnIncome(level, teamRank, rollTotal, dc) {
    const clampedLevel = Math.max(0, Math.min(20, level));
    const proficiency = getTeamProficiency(teamRank);
    const tableEntry = EARN_INCOME_TABLE[clampedLevel];
    
    if (!tableEntry) return { result: 'failure', income: 0, proficiency };
    
    const difference = rollTotal - dc;
    
    // Critical failure (fail by 10+): no income
    if (difference <= -10) {
        return { result: 'criticalFailure', income: 0, proficiency };
    }
    // Failure: use failure column from table
    if (difference < 0) {
        return { result: 'failure', income: tableEntry.failure, proficiency };
    }
    // Critical success (succeed by 10+): use level + 1 income
    if (difference >= 10) {
        const higherLevel = Math.min(21, clampedLevel + 1); // 21 is crit success for level 20
        const higherEntry = EARN_INCOME_TABLE[higherLevel];
        return { result: 'criticalSuccess', income: higherEntry[proficiency], proficiency };
    }
    // Success: normal income
    return { result: 'success', income: tableEntry[proficiency], proficiency };
}

// Format copper pieces as gold/silver/copper string
export function formatIncome(copperPieces) {
    const gp = Math.floor(copperPieces / 100);
    const sp = Math.floor((copperPieces % 100) / 10);
    const cp = copperPieces % 10;
    
    const parts = [];
    if (gp > 0) parts.push(`${gp} зм`);
    if (sp > 0) parts.push(`${sp} см`);
    if (cp > 0) parts.push(`${cp} мм`);
    
    return parts.length > 0 ? parts.join(' ') : '0 мм';
}

export const UNIVERSAL_ACTIONS = {
    changeOfficer: "Смена роли офицера", dismiss: "Роспуск команды",
    guarantee: "Гарантирование события", lieLow: "Залечь на дно", recruitSupporters: "Вербовать сторонников",
    recruitTeam: "Нанять команду", special: "Специальное", upgrade: "Улучшить команду"
};

export const SPECIFIC_ACTIONS = {
    blackMarket: "Активация черного рынка", safehouse: "Активация убежища", covert: "Тайная операция",
    earnGold: "Заработок Денег", gatherInfo: "Сбор информации", knowledge: "Проверка Знания",
    manipulate: "Манипулирование событиями", reduceDanger: "Снижение опасности", refreshMarket: "Обновление рынка",
    rescue: "Спасение персонажа", restore: "Восстановление персонажа", sabotage: "Саботаж",
    cache: "Создание тайника", specialOrder: "Специальный заказ", disinformation: "Распр. дезинформации",
    urbanInfluence: "Городское влияние"
};

export const TEAMS = {
    // === СЕРЕБРЯНЫЕ ВОРОНЫ (Основная команда) ===
    silverRavens: {
        label: "Серебряные Вороны", rank: 0, category: "core", size: 0,
        icon: "modules/pf2e-ts-adv-pf1ehr/Ring_Raven.webp",
        caps: ["recruitSupporters", "lieLow", "guarantee", "changeOfficer", "special"],
        isCore: true,
        desc: "Основная команда восстания. Выполняет универсальные действия, не требующие специальных команд."
    },

    // === ADVISORS (Советники) ===
    streetPerformers: {
        label: "Уличные артисты", rank: 1, category: "advisors", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_PERFORMERStr.webp",
        hireDC: 10, hireCheck: "secrecy",
        caps: ["gatherInfo"],
        next: "rumormongers"
    },
    rumormongers: {
        label: "Сплетники", rank: 2, category: "advisors", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_RUMORMONGERStr.webp",
        upgradeCost: 8,
        caps: ["gatherInfo", "disinformation"],
        next: ["agitators", "cognoscenti"]
    },
    agitators: {
        label: "Агитаторы", rank: 3, category: "advisors", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_AGITATORStr.webp",
        upgradeCost: 19,
        caps: ["gatherInfo", "disinformation", "urbanInfluence"]
    },
    cognoscenti: {
        label: "Знатоки", rank: 3, category: "advisors", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_COGNOSCENTItr.webp",
        upgradeCost: 19,
        caps: ["gatherInfo", "disinformation", "knowledge"]
    },

    // === OUTLAWS (Преступники) ===
    sneaks: {
        label: "Проныры", rank: 1, category: "outlaws", size: 3,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/Teams_SNEAKStr.webp",
        hireDC: 15, hireCheck: "secrecy",
        caps: ["cache"], cacheSize: "small",
        next: "thieves"
    },
    thieves: {
        label: "Воры", rank: 2, category: "outlaws", size: 3,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_THIEVEStr.webp",
        upgradeCost: 21,
        caps: ["cache", "safehouse"], cacheSize: "medium",
        next: ["saboteurs", "smugglers"]
    },
    saboteurs: {
        label: "Саботажники", rank: 3, category: "outlaws", size: 3,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_SABOTEURStr.webp",
        upgradeCost: 67,
        caps: ["cache", "safehouse", "sabotage"], cacheSize: "large"
    },
    smugglers: {
        label: "Контрабандисты", rank: 3, category: "outlaws", size: 3,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_SMUGGLERStr.webp",
        upgradeCost: 67,
        caps: ["cache", "safehouse", "covert"], cacheSize: "large"
    },

    // === REBELS (Повстанцы) ===
    freedomFighters: {
        label: "Борцы за свободу", rank: 1, category: "rebels", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_FREEDOMtr.webp",
        hireDC: 15, hireCheck: "security",
        caps: ["reduceDanger"],
        next: "infiltrators"
    },
    infiltrators: {
        label: "Лазутчики", rank: 2, category: "rebels", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_INFILTRATORStr.webp",
        upgradeCost: 21,
        caps: ["reduceDanger", "rescue"],
        next: ["cabalists", "spellcasters"]
    },
    cabalists: {
        label: "Каббалисты", rank: 3, category: "rebels", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_CABALISTStr.webp",
        upgradeCost: 67,
        caps: ["reduceDanger", "rescue", "manipulate"]
    },
    spellcasters: {
        label: "Заклинатели", rank: 3, category: "rebels", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_SPELLCASTERStr.webp",
        upgradeCost: 67,
        caps: ["reduceDanger", "rescue", "restore"]
    },

    // === TRADERS (Торговцы) ===
    peddlers: {
        label: "Коробейники", rank: 1, category: "traders", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_PEDDLERStr.webp",
        hireDC: 10, hireCheck: "security",
        caps: ["earnGold"],
        next: "merchants"
    },
    merchants: {
        label: "Купцы", rank: 2, category: "traders", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_MERCHANTStr.webp",
        upgradeCost: 8,
        caps: ["earnGold", "refreshMarket"],
        next: ["blackMarketers", "merchantLords"]
    },
    blackMarketers: {
        label: "Торговцы ЧР", rank: 3, category: "traders", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_BLACKtr.webp",
        upgradeCost: 19,
        caps: ["earnGold", "refreshMarket", "blackMarket"]
    },
    merchantLords: {
        label: "Торговые лорды", rank: 3, category: "traders", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/teams_LORDStr.webp",
        upgradeCost: 19,
        caps: ["earnGold", "refreshMarket", "specialOrder"]
    },

    // === UNIQUE TEAMS ===
    fushiSisters: {
        label: "Сестры Фуши", rank: 2, category: "unique", size: 6,
        icon: "modules/pf2e-ts-adv-pf1ehr/allbooks/teams/fushisisters_troopstr.webp",
        caps: ["earnGold", "gatherInfo"], unique: true,
        desc: "Спец. группа для Заработка золота и Сбора информации."
    },
    torrentArmigers: {
        label: "Оруженосцы Потока", rank: 2, category: "unique", size: 6,
        icon: "icons/environment/people/group-guards.webp",
        caps: ["reduceDanger", "rescue"], unique: true,
        desc: "Лазутчики. Спасают до 4. Провал не повышает Известность."
    },
    acisaziScouts: {
        label: "Разведчики Акисази", rank: 3, category: "unique", size: 3,
        icon: "icons/creatures/reptiles/serpent-sea.webp",
        caps: ["cache", "safehouse", "covert"], unique: true, cacheSize: "large",
        desc: "Контрабандисты. +1 Секретность (постоянно)."
    },
    bellflower: {
        label: "Сеть Колокольчиков", rank: 3, category: "unique", size: 6,
        icon: "icons/environment/people/commoner.webp",
        caps: ["covert", "rescue", "sabotage"], unique: true,
        desc: "+2 Секретность при Саботаже."
    },
    lacunafex: {
        label: "Лакунафекс", rank: 3, category: "unique", size: 6,
        icon: "icons/equipment/head/mask-domino-purple.webp",
        caps: ["covert", "gatherInfo", "disinformation", "sabotage"], unique: true,
        desc: "+2 Секретность при Тайной операции."
    },
    orderTorrent: {
        label: "Орден Потока", rank: 3, category: "unique", size: 12,
        icon: "icons/equipment/shield/heater-wooden-blue.webp",
        caps: ["reduceDanger", "rescue", "sabotage"], unique: true,
        desc: "+4 Безопасность при Спасении."
    },
    unknown: {
        label: "Неизвестная команда", rank: 1, category: "unknown",
        icon: "icons/svg/mystery-man.svg", caps: []
    }
};

export function getTeamDefinition(slug) {
    if (!slug) return TEAMS.unknown;
    const def = TEAMS[slug];
    if (!def) {
        console.warn(`Rebellion Teams | Unknown team type: ${slug}`);
        return TEAMS.unknown;
    }
    return def;
}

export function findTeamByActorName(name) {
    const l = name.toLowerCase();
    if (l.includes("серебряные") || l.includes("вороны") || l.includes("silver") || l.includes("ravens")) return "silverRavens";
    if (l.includes("фуши") || l.includes("fushi")) return "fushiSisters";
    if (l.includes("оруженосц") || l.includes("armigers")) return "torrentArmigers";
    if (l.includes("акисази") || l.includes("acisazi")) return "acisaziScouts";
    if (l.includes("колокольч") || l.includes("bellflower")) return "bellflower";
    if (l.includes("лакуна") || l.includes("lacunafex")) return "lacunafex";
    if (l.includes("орден") || l.includes("torrent")) return "orderTorrent";
    if (l.includes("артист") || l.includes("perform")) return "streetPerformers";
    if (l.includes("сплетн") || l.includes("rumor")) return "rumormongers";
    if (l.includes("агитат") || l.includes("agitat")) return "agitators";
    if (l.includes("знаток") || l.includes("cognos")) return "cognoscenti";
    if (l.includes("проныр") || l.includes("sneak")) return "sneaks";
    if (l.includes("вор") || l.includes("thie")) return "thieves";
    if (l.includes("саботаж") || l.includes("sabot")) return "saboteurs";
    if (l.includes("контрабанд") || l.includes("smuggl")) return "smugglers";
    if (l.includes("борцы") || l.includes("freedom")) return "freedomFighters";
    if (l.includes("лазут") || l.includes("infilt")) return "infiltrators";
    if (l.includes("каббал") || l.includes("cabal")) return "cabalists";
    if (l.includes("заклин") || l.includes("spell")) return "spellcasters";
    if (l.includes("коробей") || l.includes("peddl")) return "peddlers";
    if (l.includes("купц") || l.includes("купец") || l.includes("merchant")) {
        if (l.includes("лорд") || l.includes("lord")) return "merchantLords";
        return "merchants";
    }
    if (l.includes("черн") || l.includes("black")) return "blackMarketers";
    return "freedomFighters";
}

// Get all available upgrade options for a team
export function getUpgradeOptions(teamSlug) {
    const def = TEAMS[teamSlug];
    if (!def || !def.next) return [];
    const nextArr = Array.isArray(def.next) ? def.next : [def.next];
    return nextArr.map(slug => ({
        slug,
        ...TEAMS[slug]
    }));
}

// Check if a team can be upgraded
export function canUpgrade(teamSlug) {
    const def = TEAMS[teamSlug];
    return def && def.next && !def.unique;
}