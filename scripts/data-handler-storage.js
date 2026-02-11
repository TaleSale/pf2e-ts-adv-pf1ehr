import { OFFICER_ROLES, TEAMS } from "./config.js";

const COLLECTION_KEYS = ["officers", "allies", "events", "activeEvents", "caches"];

function isObjectLike(value) {
    return value !== null && typeof value === "object";
}

function cloneData(value) {
    if (value === undefined) return undefined;
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
    return JSON.parse(JSON.stringify(value));
}

function ensureTeamDefaults(team, fallbackType = "streetPerformers") {
    if (!team.type) team.type = fallbackType;
    if (!team.manager && team.manager !== "") team.manager = "";
    if (!team.bonus) team.bonus = 0;
    if (team.disabled === undefined || team.disabled === null) team.disabled = false;
    if (team.missing === undefined || team.missing === null) team.missing = false;
    if (team.canAutoRecover === undefined || team.canAutoRecover === null) team.canAutoRecover = false;
    if (!team.currentAction) team.currentAction = "";
}

function normalizeCollectionArrays(data) {
    COLLECTION_KEYS.forEach((key) => {
        if (data[key] && !Array.isArray(data[key])) {
            data[key] = Object.values(data[key]);
        }
    });
}

function normalizeTeams(data) {
    if (data.teams && !Array.isArray(data.teams)) {
        const teamsObject = data.teams;
        data.teams = [];
        Object.keys(teamsObject).forEach((key) => {
            const index = Number.parseInt(key, 10);
            if (!Number.isNaN(index)) {
                data.teams[index] = teamsObject[key];
            }
        });
    }
}

function mergeTeams(current, data) {
    if (!data.teams) return;

    if (!Array.isArray(current.teams)) current.teams = [];

    if (Array.isArray(data.teams) && data.teams.length < (current.teams?.length || 0)) {
        current.teams = data.teams;
        delete data.teams;
        return;
    }

    if (Array.isArray(data.teams) && data.teams.every((team) => team === undefined)) {
        delete data.teams;
        return;
    }

    if (Array.isArray(data.teams)) {
        const preservedTeams = data.teams.map((team, i) => {
            if (team === undefined) {
                return current.teams[i] ?? null;
            }

            const currentTeam = current.teams[i];
            if (currentTeam) {
                if (currentTeam.type && (!team.type || !TEAMS[team.type])) {
                    team.type = currentTeam.type;
                }

                if (team.manager === undefined && currentTeam.manager) {
                    team.manager = currentTeam.manager;
                }
            }

            ensureTeamDefaults(team, "streetPerformers");
            return team;
        });

        current.teams = preservedTeams;
        delete data.teams;
        return;
    }

    Object.entries(data.teams).forEach(([idx, updateData]) => {
        const i = Number(idx);
        const patch = isObjectLike(updateData) ? updateData : {};

        if (current.teams[i]) {
            if (patch.type === undefined || !TEAMS[patch.type]) {
                patch.type = current.teams[i].type;
            }

            if (patch.manager !== undefined) {
                current.teams[i].manager = patch.manager;
            }

            foundry.utils.mergeObject(current.teams[i], patch);
            ensureTeamDefaults(current.teams[i], current.teams[i].type || "streetPerformers");
        } else {
            if (!patch.type || !TEAMS[patch.type]) {
                patch.type = "unknown";
            }
            current.teams[i] = patch;
        }
    });

    delete data.teams;
}

function mergeIndexedCollections(current, data) {
    COLLECTION_KEYS.forEach((key) => {
        if (!data[key] || typeof data[key] !== "object") return;

        if (!Array.isArray(current[key])) current[key] = [];

        const updates = data[key];
        if (!Array.isArray(updates)) {
            Object.entries(updates).forEach(([idx, updateData]) => {
                const i = Number(idx);
                if (current[key][i]) {
                    foundry.utils.mergeObject(current[key][i], updateData);
                } else {
                    current[key][i] = updateData;
                }
            });
            delete data[key];
            return;
        }

        current[key] = updates;
        delete data[key];
    });
}

function mergeMonthlyActions(current, data) {
    if (!data.monthlyActions || typeof data.monthlyActions !== "object") return;

    if (!current.monthlyActions || typeof current.monthlyActions !== "object") {
        current.monthlyActions = {};
    }

    foundry.utils.mergeObject(current.monthlyActions, data.monthlyActions);
    delete data.monthlyActions;
}

export function defaultRebellionData() {
    return {
        week: 1,
        rank: 1,
        maxRank: 20,
        supporters: 0,
        population: 11900,
        treasury: 10,
        notoriety: 0,
        danger: 20,
        focus: "loyalty",
        phaseReport: "",
        weeksWithoutEvent: 0,
        actionsUsedThisWeek: 0,
        strategistUsed: false,
        recruitedThisPhase: false,
        silverRavensAction: "",
        tempBonuses: { loyalty: 0, security: 0, secrecy: 0 },
        activeEvents: [],
        officers: [],
        teams: [],
        allies: [],
        events: [],
        caches: [],
        customGifts: {},
        monthlyActions: {},
        eventsThisPhase: []
    };
}

export function normalizeRebellionData(rawData) {
    const data = cloneData(rawData) ?? {};

    normalizeTeams(data);
    normalizeCollectionArrays(data);

    if (!data.monthlyActions || typeof data.monthlyActions !== "object") {
        data.monthlyActions = {};
    }

    const normalized = foundry.utils.mergeObject(defaultRebellionData(), data);

    if (!Array.isArray(normalized.officers)) normalized.officers = [];
    normalized.officers = normalized.officers.filter((officer) => officer?.role && OFFICER_ROLES[officer.role]);

    if (!Array.isArray(normalized.teams)) normalized.teams = [];
    normalized.teams = normalized.teams.filter((team) => team !== null && team !== undefined);

    return normalized;
}

export function mergeRebellionData(currentData, incomingData) {
    const current = cloneData(currentData) ?? {};
    const data = cloneData(incomingData) ?? {};

    mergeTeams(current, data);
    mergeIndexedCollections(current, data);
    mergeMonthlyActions(current, data);

    return foundry.utils.mergeObject(current, data);
}
