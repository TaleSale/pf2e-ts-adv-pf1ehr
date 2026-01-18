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
