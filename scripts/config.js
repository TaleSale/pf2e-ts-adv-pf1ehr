// === REBELLION PROGRESSION TABLE (Table 1 from source) ===
export const REBELLION_PROGRESSION = {
    1: { minSupporters: 0, focusBonus: 2, secondaryBonus: 0, actions: 1, maxTeams: 2, gift: null },
    2: { minSupporters: 10, focusBonus: 3, secondaryBonus: 0, actions: 2, maxTeams: 2, gift: "Тренировка +1 ранг навыка" },
    3: { minSupporters: 15, focusBonus: 3, secondaryBonus: 1, actions: 2, maxTeams: 3, gift: "Зелье (до 25 зм)" },
    4: { minSupporters: 20, focusBonus: 4, secondaryBonus: 1, actions: 2, maxTeams: 3, gift: "Титул Защитник"},
    5: { minSupporters: 30, focusBonus: 4, secondaryBonus: 1, actions: 2, maxTeams: 4, gift: "40 зм" },
    6: { minSupporters: 40, focusBonus: 5, secondaryBonus: 2, actions: 2, maxTeams: 4, gift: "55 зм" },
    7: { minSupporters: 55, focusBonus: 5, secondaryBonus: 2, actions: 3, maxTeams: 4, gift: "Тренировка +2 ранг навыка" },
    8: { minSupporters: 75, focusBonus: 6, secondaryBonus: 2, actions: 3, maxTeams: 5, gift: "Доспех или палочка (до 75 зм)" },
    9: { minSupporters: 105, focusBonus: 6, secondaryBonus: 3, actions: 3, maxTeams: 5, gift: "Титул Страж"},
    10: { minSupporters: 160, focusBonus: 7, secondaryBonus: 3, actions: 3, maxTeams: 5, gift: "95 зм" },
    11: { minSupporters: 235, focusBonus: 7, secondaryBonus: 3, actions: 4, maxTeams: 6, gift: "170 зм" },
    12: { minSupporters: 330, focusBonus: 8, secondaryBonus: 4, actions: 4, maxTeams: 6, gift: "Тренировка +3 ранг навыка" },
    13: { minSupporters: 475, focusBonus: 8, secondaryBonus: 4, actions: 4, maxTeams: 6, gift: "Палочка или оружие (до 290 зм)" },
    14: { minSupporters: 665, focusBonus: 9, secondaryBonus: 4, actions: 4, maxTeams: 6, gift: "Титул Смотритель"},
    15: { minSupporters: 955, focusBonus: 9, secondaryBonus: 5, actions: 5, maxTeams: 7, gift: "185 зм" },
    16: { minSupporters: 1350, focusBonus: 10, secondaryBonus: 5, actions: 5, maxTeams: 7, gift: "460 зм" },
    17: { minSupporters: 1900, focusBonus: 10, secondaryBonus: 5, actions: 5, maxTeams: 7, gift: "Тренировка +4 ранг навыка" },
    18: { minSupporters: 2700, focusBonus: 11, secondaryBonus: 6, actions: 5, maxTeams: 7, gift: "Магический предмет (до 570 зм)" },
    19: { minSupporters: 3850, focusBonus: 11, secondaryBonus: 6, actions: 6, maxTeams: 7, gift: "Титул Спаситель"},
    20: { minSupporters: 5350, focusBonus: 12, secondaryBonus: 6, actions: 6, maxTeams: 8, gift: "750 зм" }
};

export const MIN_TREASURY_BY_RANK = {
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

// === OFFICER ROLES ===
export const OFFICER_ROLES = {
    demagogue: {
        label: "Демагог",
        desc: "Добавляет модификатор Выносливости или Харизмы к проверке Верности.",
        abilities: ["con", "cha"],
        target: "loyalty"
    },
    partisan: {
        label: "Партизан",
        desc: "Добавляет модификатор Силы или Мудрости к проверке Безопасности.",
        abilities: ["str", "wis"],
        target: "security"
    },
    recruiter: {
        label: "Вербовщик",
        desc: "Увеличивает кол-во завербованных сторонников на уровень персонажа (суммируется).",
        abilities: ["level"],
        target: "recruitment"
    },
    sentinel: {
        label: "Страж",
        desc: "Дает бонус +1 к двум вторичным проверкам. Помогает при разрешении события.",
        abilities: [],
        target: "secondary",
        hasCheckSelector: true
    },
    spymaster: {
        label: "Шпион",
        desc: "Добавляет модификатор Ловкости или Интеллекта к проверке Секретности.",
        abilities: ["dex", "int"],
        target: "secrecy"
    },
    strategist: {
        label: "Стратег",
        desc: "Предоставляет 1 бонусное действие. Выбранная команда получает +2 к проверке.",
        abilities: [],
        target: "action"
    }
};

// === FOCUS TYPES ===
export const FOCUS_TYPES = {
    loyalty: { label: "Верность", primary: "loyalty", bonuses: { loyalty: "focus", security: "secondary", secrecy: "secondary" } },
    security: { label: "Безопасность", primary: "security", bonuses: { loyalty: "secondary", security: "focus", secrecy: "secondary" } },
    secrecy: { label: "Скрытность", primary: "secrecy", bonuses: { loyalty: "secondary", security: "secondary", secrecy: "focus" } }
};

// === LABELS ===
export const CHECK_LABELS = { loyalty: "Верность", security: "Безопасность", secrecy: "Секретность" };
export const ABILITY_LABELS = { str: "Сила", dex: "Ловкость", con: "Выносливость", int: "Интеллект", wis: "Мудрость", cha: "Харизма" };
export const CATEGORY_LABELS = { 
    advisors: "Советники", 
    outlaws: "Преступники", 
    rebels: "Повстанцы", 
    traders: "Торговцы", 
    unique: "Уникальная",
    core: "Основная",
    unknown: "Неизвестная"
};

// Pathfinder 2E skill translations for mitigation
export const PF2E_SKILL_LABELS = {
    "diplomacy": "Дипломатия",
    "intimidation": "Запугивание",
    "survival": "Выживание",
    "performance": "Выступление",
    "medicine": "Медицина",
    "perception": "Проницательность",
    "acrobatics": "Акробатика",
    "arcana": "Тайная магия",
    "athletics": "Атлетика",
    "crafting": "Ремесло",
    "deception": "Обман",
    "lore": "Знания",
    "nature": "Природа",
    "occultism": "Эзотерика",
    "religion": "Религия",
    "society": "Общество",
    "stealth": "Скрытность",
    "thievery": "Воровство"
};

// === EVENT TABLE (d100 + Danger) ===
export const EVENT_TABLE = [
    { min: 1, max: 4, name: "Неделя Секретности", desc: "+6 к проверкам на след. неделю. Удвоенная вербовка.", positive: true },
    { min: 5, max: 8, name: "Успешный протест", desc: "+2d6 сторонников. +4 к модификатору поселения (случ.).", positive: true },
    { min: 9, max: 14, name: "Уменьшенная угроза", desc: "-10 Опасность на след. неделю.", positive: true },
    { min: 15, max: 20, name: "Пожертвование", desc: "Казна + (бросок Верности × 20) зм.", positive: true },
    { min: 21, max: 28, name: "Рост поддержки", desc: "+2d6 сторонников.", positive: true },
    { min: 29, max: 38, name: "Рыночный бум", desc: "Новые магические предметы доступны на рынке.", positive: true },
    { min: 39, max: 48, name: "Все спокойно", desc: "+1 Безопасность на след. неделю. Нет события след. неделю.", positive: true, persistent: true },
    { min: 49, max: 51, name: "Бросьте дважды", desc: "Произошли два события (бросьте дважды).", positive: false },
    { min: 52, max: 59, name: "Стукач", desc: "Верность КС 15. Провал: потеря сторонника, +1d6 Известность.", positive: false },
    { min: 60, max: 63, name: "Соперничество", desc: "Две команды блокированы на неделю. Дипломатия КС 20.", positive: false, mitigate: "diplomacy", dc: 20, persistent: true },
    { min: 64, max: 67, name: "Опасные времена", desc: "+10 Опасность. Запугивание КС 20 снижает до +5.", positive: false, mitigate: "intimidation", dc: 20, persistent: true },
    { min: 68, max: 71, name: "Пропавшие без вести", desc: "Команда, задействованная в действии, пропала. Спасение только в фазе содержания.", positive: false },
    { min: 72, max: 75, name: "Тайник обнаружен", desc: "Потеря тайника или -1d6 сторонников/население.", positive: false },
    { min: 76, max: 79, name: "Усиленные патрули", desc: "-4 Секретность. Выживание КС 20 снижает до -2.", positive: false, mitigate: "survival", dc: 20, persistent: true },
    { min: 80, max: 83, name: "Низкий боевой дух", desc: "-4 Верность. Выступление КС 20 снижает до -2.", positive: false, mitigate: "performance", dc: 20, persistent: true },
    { min: 84, max: 87, name: "Болезнь", desc: "-4 Безопасность. Медицина КС 20 снижает до -2.", positive: false, mitigate: "medicine", dc: 20, persistent: true },
    { min: 88, max: 91, name: "Недееспособная команда", desc: "Случайная команда выведена из строя.", positive: false },
    { min: 92, max: 95, name: "Разлад в рядах", desc: "-4 ко всем проверкам. Дипломатия КС 20 снижает до -2.", positive: false, mitigate: "diplomacy", dc: 20, persistent: true },
    { min: 96, max: 99, name: "Вторжение", desc: "Опасное существо вторглось! ГМ бросает или выбирает бродячего монстра из таблиц столкновений. Место вторжения выбирается ГМ. Если ПИ не вмешаются, 1d4 команды теряются, 1d4 команды становятся недееспособными, и восстание получает постоянное событие 'Низкий боевой дух'.", positive: false },
    { min: 100, max: 103, name: "Провальный протест", desc: "Безопасность КС 25. Провал: -2d6 сторонников и населения. Случайный модификатор поселения -4 на неделю.", positive: false },
    { min: 104, max: 107, name: "Союзник в опасности", desc: "Проверка Безопасности (КС = 20 - уровень союзника, мин. КС 10). Успех: пропал на неделю. Провал: схвачен.", positive: false, mitigate: "security", dynamicDC: true },
    { min: 108, max: 111, name: "Катастроф. миссия", desc: "Команда, задействованная в действии, достигла цели, но получила урон. Безопасность КС 20: успех - недееспособна, провал - уничтожена. В любом случае +1d6 известность. Без активных команд - 'Опасные времена'.", positive: false, mitigate: "security", dc: 20 },
    { min: 112, max: 115, name: "Предатель", desc: "Один из Серебряных Воронов - предатель! Команда недееспособна. Верность КС 20 для поимки. При успехе: выбор действий (казнь, изгнание, тюрьма). При провале: +2d6 Известность.", positive: false, mitigate: "loyalty", dc: 20 },
    { min: 116, max: 119, name: "Дьявольское проникн.", desc: "Один из Серебряных Воронов - замаскированный дьявол. Бросок 1d6 (перебрасывать 6) определяет недели проникновения. +1d6 Известность за каждую неделю. Верность КС 15 уменьшает прирост вдвое. Проницательность КС 20 уменьшает недели вдвое.", positive: false, mitigate: "perception", dc: 20 },
    { min: 120, max: 999, name: "Инквизиция", desc: "×2 потеря сторонников на неделю. ×2 модификаторы военного положения. Секретность КС 20 при 'Залечь на дно' завершает постоянную Инквизицию.", positive: false, mitigate: "secrecy", dc: 20, persistent: true }
];

// === TITLE FEATS ===
export const TITLE_FEATS = {
    "Защитник": ["Бдительность", "Лживость", "Убедительность", "Скрытный"],
    "Страж": ["Великая Стойкость", "Железная Воля", "Молниеносные Рефлексы"],
    "Смотритель": ["Быстроногий", "Улучшенная Инициатива", "Живучесть"],
    "Спаситель": ["Любая способность по требованиям"]
};

// === CACHE SIZES ===
export const CACHE_LIMITS = {
    small: { weight: 5, maxValue: 62, dc: 15 },
    medium: { weight: 10, maxValue: 143, dc: 20 },
    large: { weight: 20, maxValue: null, dc: 30 }
};

// === ALLIES AND TEAMS DEFINITIONS ===

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
