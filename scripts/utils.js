import { ALLY_DEFINITIONS, TEAMS, EARN_INCOME_TABLE } from "./config.js";

export function findAllyByActorName(name) {
    const l = name.toLowerCase();
    for (const [k, v] of Object.entries(ALLY_DEFINITIONS)) {
        if (v.name.toLowerCase().split(" / ")[0].includes(l) || l.includes(v.name.toLowerCase().split(" ")[0])) return k;
    }
    return null;
}

export function getAllyData(slug) {
    return ALLY_DEFINITIONS[slug] || null;
}

export function getAllAllies() {
    return Object.entries(ALLY_DEFINITIONS).map(([slug, data]) => ({
        slug,
        ...data
    }));
}

export function getAlliesByAdventure() {
    const grouped = {};
    for (const [slug, ally] of Object.entries(ALLY_DEFINITIONS)) {
        const adv = ally.adventure || 1;
        if (!grouped[adv]) grouped[adv] = [];
        grouped[adv].push({ slug, ...ally });
    }
    return grouped;
}

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

export function getUpgradeOptions(teamSlug) {
    const def = TEAMS[teamSlug];
    if (!def || !def.next) return [];
    const nextArr = Array.isArray(def.next) ? def.next : [def.next];
    return nextArr.map(slug => ({
        slug,
        ...TEAMS[slug]
    }));
}

export function canUpgrade(teamSlug) {
    const def = TEAMS[teamSlug];
    return def && def.next && !def.unique;
}

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
