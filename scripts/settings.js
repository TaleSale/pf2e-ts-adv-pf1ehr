export const MODULE_ID = "pf2e-ts-adv-pf1ehr";

export function registerSettings() {
    game.settings.register(MODULE_ID, "rebellionData", {
        name: "Данные Восстания",
        scope: "world",
        config: false,
        type: Object,
        default: {
            rank: 1,
            supporters: 0,
            population: 11900,
            treasury: 10,
            notoriety: 0,
            focus: "loyalty", // loyalty, security, secrecy
            focusLocked: false,
            officers: {
                demagogue: null,
                partisan: null,
                recruiter: null,
                sentinel: null,
                spymaster: null,
                strategist: null
            },
            teams: [],
            allies: []
        },
        onChange: () => {
            // Перерисовка открытых окон
            Object.values(ui.windows).forEach(app => {
                if (app.id === "rebellion-sheet-app") app.render(false);
            });
        }
    });
}