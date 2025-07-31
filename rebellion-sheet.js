// --- ЛИСТ ВОССТАНИЯ (HELL'S REBELS) ---
// Модуль: pf2e-ts-adv-pf1ehr
// Версия: 11.0 (Финальная, рабочая)

class RebellionSheet extends ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "rebellion-sheet",
            classes: ["pf2e", "sheet", "actor", "party", "rebellion-sheet-window"],
            template: `modules/pf2e-ts-adv-pf1ehr/templates/rebellion-sheet.html`,
            width: 900,
            height: 750,
            resizable: true,
        });
    }

    get title() {
        return `Лист Восстания: ${this.actor.name}`;
    }

    async getData(options) {
        const data = await super.getData(options);
        const party = game.actors.party;
        if (!party) {
            ui.notifications.warn("Для работы Листа Восстания необходим активный 'Отряд' (Party).");
            return { ...data, rebellion: {}, isGM: game.user.isGM };
        }

        const rebellionData = party.getFlag('world', 'rebellionSheet') || {};
        
        const defaults = {
            loyalty: 0,
            secrecy: 0,
            security: 0,
            authority: 100,
            assets: { loyalty: [], secrecy: [], security: [] }
        };
        const rebellion = foundry.utils.mergeObject(defaults, rebellionData);

        rebellion.liberation = rebellion.loyalty + rebellion.secrecy + rebellion.security;
        
        return { ...data, actor: this.actor, rebellion, isGM: game.user.isGM };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // --- Управление очками только для Мастера ---
        if (game.user.isGM) {
            html.find('[data-action="change-points"]').on('click', this._onChangePoints.bind(this));
        }

        // --- Управление активами для ВСЕХ игроков ---
        html.find('[data-action="add-asset"]').on('click', this._onAddAsset.bind(this));
        // Используем делегирование событий для динамически добавляемых элементов
        html.on('click', '[data-action="delete-asset"]', this._onDeleteAsset.bind(this));
        html.on('change', '.asset-row textarea, .asset-row input', this._onEditAsset.bind(this));
        
        // --- Общие слушатели ---
        html.find('[data-action="roll-bonus"]').on('click', this._onRollBonus.bind(this));
        html.find('.asset-row textarea').each((_, el) => this._adjustTextareaHeight(el));
        html.on('input', '.asset-row textarea', (event) => this._adjustTextareaHeight(event.currentTarget));
    }

    _adjustTextareaHeight(element) {
        element.style.height = 'auto';
        element.style.height = (element.scrollHeight) + 'px';
    }

    async _onChangePoints(event) {
        const button = event.currentTarget;
        const category = button.dataset.category;
        const amount = parseInt(button.dataset.amount, 10);
        const currentPoints = this.actor.getFlag('world', `rebellionSheet.${category}`) || (category === 'authority' ? 100 : 0);
        const newPoints = currentPoints + amount;
        await this.actor.setFlag('world', `rebellionSheet.${category}`, newPoints);
        this.render();
    }

    async _onRollBonus(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const category = button.dataset.category;
        const bonus = this.actor.getFlag('world', `rebellionSheet.${category}`) || 0;
        const label = button.dataset.label;

        const roll = new Roll(`1d20 + @bonus`, { bonus });
        await roll.evaluate({ async: true });

        roll.toMessage({
            speaker: { alias: "Восстание" },
            flavor: `<b>Бросок: ${label}</b>`
        });
    }

    async _onAddAsset(event) {
        const category = event.currentTarget.dataset.category;
        const assets = this.actor.getFlag('world', `rebellionSheet.assets.${category}`) || [];
        assets.push({ id: foundry.utils.randomID(), description: "", points: 0 });
        await this.actor.setFlag('world', `rebellionSheet.assets.${category}`, assets);
        this.render(false);
    }

    async _onEditAsset(event) {
        const input = event.currentTarget;
        const assetId = $(input).closest('.asset-row').data('assetId');
        const category = $(input).closest('.asset-column').data('category');
        const field = input.dataset.field;
        const assets = this.actor.getFlag('world', `rebellionSheet.assets.${category}`) || [];
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            asset[field] = field === 'points' ? parseInt(input.value, 10) || 0 : input.value;
            await this.actor.setFlag('world', `rebellionSheet.assets.${category}`, assets);
        }
    }

    async _onDeleteAsset(event) {
        const button = event.currentTarget;
        const assetId = $(button).closest('.asset-row').data('assetId');
        const category = $(button).closest('.asset-column').data('category');
        let assets = this.actor.getFlag('world', `rebellionSheet.assets.${category}`) || [];
        assets = assets.filter(a => a.id !== assetId);
        await this.actor.setFlag('world', `rebellionSheet.assets.${category}`, assets);
        this.render(false);
    }
}

Hooks.once('init', () => {
    game.settings.register('pf2e-ts-adv-pf1ehr', 'enableRebellionSheet', {
        name: "Включить Лист Восстания (Hell's Rebels)",
        hint: "Добавляет кнопку 'R' в список актеров для открытия Листа Восстания. Требует наличия Партии в мире.",
        scope: 'world', config: true, type: Boolean, default: false,
        onChange: () => ui.actors.render(true),
    });
});

Hooks.on('renderActorDirectory', (app, html, data) => {
    setTimeout(() => {
        try {
            if (!game.settings.get('pf2e-ts-adv-pf1ehr', 'enableRebellionSheet')) return;
            const party = game.actors.party;
            if (!party) return;
            const jqueryHtml = $(html);
            if (jqueryHtml.find('#rebellion-sheet-button').length) return;
            const partySheetButton = jqueryHtml.find('button[data-action="openPartySheet"]');
            if (partySheetButton.length > 0) {
                const buttonHtml = `<a id="rebellion-sheet-button" title="Лист Восстания">R</a>`;
                $(buttonHtml).insertAfter(partySheetButton).on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    new RebellionSheet(party).render(true);
                });
            }
        } catch (e) {
            console.error("ЛИСТ ВОССТАНИЯ | КРИТИЧЕСКАЯ ОШИБКА!", e);
        }
    }, 100);
});