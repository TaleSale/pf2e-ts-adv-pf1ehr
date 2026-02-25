const ENRICHER_HOTBAR_SLOT = 11;
const ENRICHER_MACRO_NAME = "Конструктор @Rebellion";
const ENRICHER_MACRO_COMMAND = "Rebellion.api.openRebellionEnricherBuilder();";
const ENRICHER_MACRO_IMG = "icons/svg/hanging-sign.svg";
const ENRICHER_MACRO_NAME_ALIASES = [ENRICHER_MACRO_NAME, "Enricher", "@Rebellion Enricher"];
const ENRICHER_EXTRA_SLOT_CLASS = "rebellion-extra-hotbar-slot-11";
const ENRICHER_EXTRA_SLOT_ID = "rebellion-extra-hotbar-slot-11";
const ENRICHER_EXTRA_SLOT_STYLE_ID = "rebellion-extra-hotbar-slot-11-style";
const ENRICHER_LOG_PREFIX = "[Rebellion Hotbar11]";
let ENRICHER_RESIZE_BOUND = false;
let ENRICHER_RESIZE_RAF = null;
let ENRICHER_LAST_SLOT_POSITION = null;
let ENRICHER_LAYOUT_OBSERVER = null;
let ENRICHER_LAYOUT_TRANSITION_TARGET = null;
let ENRICHER_LAYOUT_PENDING_RAF = null;

function logHotbar11(...args) {
    console.log(ENRICHER_LOG_PREFIX, ...args);
}

logHotbar11("Module script loaded");

function findRebellionEnricherMacro() {
    if (!game.user || !game.macros) return null;

    const slotMacroId = game.user.hotbar?.[String(ENRICHER_HOTBAR_SLOT)] ?? null;
    const slotMacro = slotMacroId ? game.macros.get(slotMacroId) : null;
    if (slotMacro) return slotMacro;

    const normalize = (value) => String(value ?? "").trim();
    const targetCommand = normalize(ENRICHER_MACRO_COMMAND);
    const byCommand = (game.macros.find?.((candidate) => normalize(candidate?.command) === targetCommand))
        || game.macros.contents?.find((candidate) => normalize(candidate?.command) === targetCommand);
    if (byCommand) return byCommand;

    const aliases = ENRICHER_MACRO_NAME_ALIASES.map((name) => name.toLowerCase());
    const byName = (game.macros.find?.((candidate) => aliases.includes(String(candidate?.name ?? "").toLowerCase())))
        || game.macros.contents?.find((candidate) => aliases.includes(String(candidate?.name ?? "").toLowerCase()));
    if (byName) return byName;

    return null;
}

async function ensureRebellionEnricherHotbarMacro() {
    if (!game.user || !game.macros) {
        logHotbar11("Skipped macro ensure: game.user or game.macros is missing", {
            hasUser: !!game.user,
            hasMacros: !!game.macros,
        });
        return;
    }
    if (!game.user.isGM) {
        logHotbar11("Skipped macro ensure for non-GM user", { userId: game.user.id });
        return;
    }

    let macro = findRebellionEnricherMacro();
    logHotbar11("Macro lookup", {
        found: !!macro,
        macroId: macro?.id ?? null,
        macroName: macro?.name ?? null,
    });
    if (!macro) {
        macro = await Macro.create(
            {
                name: ENRICHER_MACRO_NAME,
                type: "script",
                img: ENRICHER_MACRO_IMG,
                command: ENRICHER_MACRO_COMMAND,
            },
            { displaySheet: false }
        );
        logHotbar11("Macro created", {
            macroId: macro?.id ?? null,
            macroName: macro?.name ?? null,
        });
    }
    if (!macro) return;

    const currentMacroId = game.user.hotbar?.[String(ENRICHER_HOTBAR_SLOT)] ?? null;
    logHotbar11("Current hotbar slot state", {
        slot: ENRICHER_HOTBAR_SLOT,
        currentMacroId,
        targetMacroId: macro.id,
    });
    if (currentMacroId !== macro.id) {
        await game.user.assignHotbarMacro(macro, ENRICHER_HOTBAR_SLOT);
        logHotbar11("Assigned macro to slot", {
            slot: ENRICHER_HOTBAR_SLOT,
            macroId: macro.id,
        });
    } else {
        logHotbar11("Slot already assigned", {
            slot: ENRICHER_HOTBAR_SLOT,
            macroId: macro.id,
        });
    }
}

function ensureExtraSlotStyles() {
    if (document.getElementById(ENRICHER_EXTRA_SLOT_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = ENRICHER_EXTRA_SLOT_STYLE_ID;
    style.textContent = `
        #hotbar li.${ENRICHER_EXTRA_SLOT_CLASS} {
            cursor: pointer;
            position: absolute;
            z-index: 6;
        }
    `;
    document.head.appendChild(style);
    logHotbar11("Extra slot styles injected");
}

function resolveHotbarRoot(app, html) {
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
    return document.getElementById("hotbar");
}

function findHotbarMacroList(root) {
    const slots = [...root.querySelectorAll("li[data-slot]")].filter(
        (el) => el instanceof HTMLLIElement && !el.classList.contains(ENRICHER_EXTRA_SLOT_CLASS)
    );
    if (!slots.length) return null;

    const list = slots[0].parentElement;
    if (!(list instanceof HTMLElement)) return null;

    const numericSlot = (el) => Number.parseInt(String(el.dataset.slot ?? ""), 10) || 0;
    const template = slots.reduce((best, current) => (numericSlot(current) > numericSlot(best) ? current : best), slots[0]);

    return { list, slots, template };
}

function findHotbarActionBar(root, list) {
    const actionBar = root.querySelector("#action-bar");
    if (actionBar instanceof HTMLElement) return actionBar;
    if (list.parentElement instanceof HTMLElement) return list.parentElement;
    return root;
}

function getAnchorHotbarSlot(slots, template) {
    const numericSlot = (el) => Number.parseInt(String(el.dataset.slot ?? ""), 10) || 0;
    return slots.find((el) => numericSlot(el) === 10)
        ?? slots.reduce((best, current) => (numericSlot(current) > numericSlot(best) ? current : best), slots[0] ?? template)
        ?? template;
}

function applyMacroVisuals(slot, macro) {
    const iconUrl = macro?.img ?? ENRICHER_MACRO_IMG;
    const tooltipText = macro?.name ?? ENRICHER_MACRO_NAME;
    slot.title = tooltipText;
    slot.setAttribute("aria-label", tooltipText);
    slot.removeAttribute("data-tooltip");

    const icon = slot.querySelector(".macro-icon");
    if (icon instanceof HTMLElement) {
        icon.setAttribute("title", tooltipText);
        icon.setAttribute("aria-label", tooltipText);
        icon.removeAttribute("data-tooltip");
        if (icon instanceof HTMLImageElement) {
            icon.src = iconUrl;
            icon.alt = tooltipText;
        } else {
            icon.style.backgroundImage = `url('${iconUrl}')`;
        }
    }

    const img = slot.querySelector("img");
    if (img instanceof HTMLImageElement) {
        img.src = iconUrl;
        img.alt = tooltipText;
        img.title = tooltipText;
        img.removeAttribute("data-tooltip");
    }

    const keyEl = slot.querySelector(".macro-key");
    if (keyEl instanceof HTMLElement) {
        keyEl.textContent = "11";
    }

    const tooltipEl = slot.querySelector(".tooltip, .macro-label, h4");
    if (tooltipEl instanceof HTMLElement) {
        tooltipEl.textContent = tooltipText;
    }

    slot.querySelectorAll("[data-tooltip]").forEach((el) => {
        if (el instanceof HTMLElement) el.removeAttribute("data-tooltip");
    });
}

function getElementLocalBox(element, ancestor) {
    if (!(element instanceof HTMLElement) || !(ancestor instanceof HTMLElement)) {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    let left = 0;
    let top = 0;
    let current = element;

    while (current && current !== ancestor) {
        left += current.offsetLeft;
        top += current.offsetTop;
        current = current.offsetParent;
    }

    if (current === ancestor) {
        return {
            left,
            top,
            width: element.offsetWidth || 0,
            height: element.offsetHeight || 0,
        };
    }

    // Fallback for cases when offsetParent chain doesn't reach ancestor.
    const elementRect = element.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();
    const scaleX = ancestorRect.width > 0 && ancestor.offsetWidth > 0 ? ancestorRect.width / ancestor.offsetWidth : 1;
    const scaleY = ancestorRect.height > 0 && ancestor.offsetHeight > 0 ? ancestorRect.height / ancestor.offsetHeight : 1;

    return {
        left: (elementRect.left - ancestorRect.left) / (scaleX || 1),
        top: (elementRect.top - ancestorRect.top) / (scaleY || 1),
        width: elementRect.width / (scaleX || 1),
        height: elementRect.height / (scaleY || 1),
    };
}

function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function avoidPageControlsOverlap(slot, root, actionBar) {
    const controls = root.querySelector("#hotbar-page-controls, .hotbar-page-controls");
    if (!(controls instanceof HTMLElement)) return;

    const slotRect = slot.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    if (!rectsOverlap(slotRect, controlsRect)) return;

    const actionBarRect = actionBar.getBoundingClientRect();
    const scaleX = actionBarRect.width > 0 && actionBar.offsetWidth > 0 ? actionBarRect.width / actionBar.offsetWidth : 1;
    const shiftPx = (controlsRect.right - slotRect.left) + 6;
    const shiftLocal = shiftPx / (scaleX || 1);
    const currentLeft = Number.parseFloat(slot.style.left || "0") || 0;
    const nextLeft = Math.round(currentLeft + shiftLocal);
    slot.style.left = `${nextLeft}px`;

    logHotbar11("Extra slot shifted after real overlap check", {
        shiftPx: Math.round(shiftPx),
        shiftLocal: Math.round(shiftLocal),
        left: nextLeft,
    });
}

function positionExtraSlot(slot, root, actionBar, anchorSlot) {
    const anchorBox = getElementLocalBox(anchorSlot, actionBar);
    if (!Number.isFinite(anchorBox.left) || !Number.isFinite(anchorBox.top) || anchorBox.width < 1) {
        if (ENRICHER_LAST_SLOT_POSITION) {
            const { left, top, width, height } = ENRICHER_LAST_SLOT_POSITION;
            actionBar.style.position = actionBar.style.position || "relative";
            actionBar.style.overflow = "visible";
            slot.style.left = `${left}px`;
            slot.style.top = `${top}px`;
            slot.style.width = `${width}px`;
            slot.style.height = `${height}px`;
            logHotbar11("Extra slot used last known position", ENRICHER_LAST_SLOT_POSITION);
        }
        return;
    }

    const width = Math.max(32, Math.round(anchorBox.width) || anchorSlot.offsetWidth || 50);
    const height = Math.max(32, Math.round(anchorBox.height) || anchorSlot.offsetHeight || 50);
    const left = Math.round(anchorBox.left + width + 4);
    const top = Math.round(anchorBox.top);

    actionBar.style.position = actionBar.style.position || "relative";
    actionBar.style.overflow = "visible";
    slot.style.left = `${left}px`;
    slot.style.top = `${top}px`;
    slot.style.width = `${width}px`;
    slot.style.height = `${height}px`;
    avoidPageControlsOverlap(slot, root, actionBar);

    const finalLeft = Number.parseFloat(slot.style.left || "0") || left;
    ENRICHER_LAST_SLOT_POSITION = { left: finalLeft, top, width, height };

    logHotbar11("Extra slot positioned", { left: finalLeft, top, width, height });
}

function scheduleExtraSlotPosition(slot, root, actionBar, anchorSlot) {
    let frame = 0;
    const tick = () => {
        if (!slot.isConnected) return;
        positionExtraSlot(slot, root, actionBar, anchorSlot);
        frame += 1;
        if (frame < 5) requestAnimationFrame(tick);
    };
    tick();
    for (const delay of [80, 180, 350, 700, 1200]) {
        setTimeout(() => {
            if (slot.isConnected) positionExtraSlot(slot, root, actionBar, anchorSlot);
        }, delay);
    }
}

function bindHotbarResizePositioning() {
    if (ENRICHER_RESIZE_BOUND) return;
    ENRICHER_RESIZE_BOUND = true;

    window.addEventListener("resize", () => {
        if (ENRICHER_RESIZE_RAF !== null) return;
        ENRICHER_RESIZE_RAF = requestAnimationFrame(() => {
            ENRICHER_RESIZE_RAF = null;
            const app = ui.hotbar;
            if (app?.rendered) renderExtraHotbarSlot(app, app.element);
        });
    });
    logHotbar11("Resize positioning bound");
}

function queueHotbarRefresh(reason = "layout-change") {
    if (ENRICHER_LAYOUT_PENDING_RAF !== null) return;
    ENRICHER_LAYOUT_PENDING_RAF = requestAnimationFrame(() => {
        ENRICHER_LAYOUT_PENDING_RAF = null;
        const app = ui.hotbar;
        if (!app?.rendered) return;
        logHotbar11("Refreshing extra slot after", reason);
        renderExtraHotbarSlot(app, app.element);
    });
}

function bindHotbarLayoutObserver() {
    const hotbar = document.getElementById("hotbar");
    if (!(hotbar instanceof HTMLElement)) return;

    const actionBar = hotbar.querySelector("#action-bar");
    const observeTargets = [hotbar, hotbar.parentElement, actionBar, actionBar?.parentElement]
        .filter((el) => el instanceof HTMLElement)
        .filter((el, idx, arr) => arr.indexOf(el) === idx);

    if (ENRICHER_LAYOUT_OBSERVER) {
        ENRICHER_LAYOUT_OBSERVER.disconnect();
    }
    ENRICHER_LAYOUT_OBSERVER = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === "attributes") {
                queueHotbarRefresh("mutation-observer");
                return;
            }
        }
    });
    for (const target of observeTargets) {
        ENRICHER_LAYOUT_OBSERVER.observe(target, {
            attributes: true,
            attributeFilter: ["style", "class"],
        });
    }

    if (ENRICHER_LAYOUT_TRANSITION_TARGET instanceof HTMLElement) {
        ENRICHER_LAYOUT_TRANSITION_TARGET.removeEventListener("transitionend", onHotbarTransitionEnd);
    }
    ENRICHER_LAYOUT_TRANSITION_TARGET = hotbar;
    ENRICHER_LAYOUT_TRANSITION_TARGET.addEventListener("transitionend", onHotbarTransitionEnd);

    logHotbar11("Layout observer bound", {
        targets: observeTargets.length,
    });
}

function onHotbarTransitionEnd() {
    queueHotbarRefresh("transitionend");
}

function renderExtraHotbarSlot(app, html) {
    const root = resolveHotbarRoot(app, html);
    if (!(root instanceof HTMLElement)) {
        logHotbar11("renderHotbar: unable to resolve hotbar root", { app: !!app, hasHtml: !!html });
        return;
    }
    if (!game.user?.isGM) {
        root.querySelectorAll(`#${ENRICHER_EXTRA_SLOT_ID}`).forEach((el) => el.remove());
        root.querySelectorAll(`.${ENRICHER_EXTRA_SLOT_CLASS}`).forEach((el) => el.remove());
        logHotbar11("renderHotbar: skip extra slot for non-GM");
        return;
    }

    ensureExtraSlotStyles();
    const rect = root.getBoundingClientRect();
    logHotbar11("renderHotbar fired", {
        rootId: root.id,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    });

    const hotbar = findHotbarMacroList(root);
    if (!hotbar) {
        logHotbar11("renderHotbar: could not find macro list/slots");
        return;
    }

    const { list, slots, template } = hotbar;
    const actionBar = findHotbarActionBar(root, list);
    const anchorSlot = getAnchorHotbarSlot(slots, template);

    root.querySelectorAll(`#${ENRICHER_EXTRA_SLOT_ID}`).forEach((el) => el.remove());
    root.querySelectorAll(`.${ENRICHER_EXTRA_SLOT_CLASS}`).forEach((el) => el.remove());

    const macro = findRebellionEnricherMacro();
    if (!macro) {
        void ensureRebellionEnricherHotbarMacro()
            .then(() => ui.hotbar?.render(false))
            .catch((error) => console.error(`${ENRICHER_LOG_PREFIX} ensure macro during render failed`, error));
    }
    const slot = document.createElement("li");

    slot.id = ENRICHER_EXTRA_SLOT_ID;
    slot.className = `${template.className} ${ENRICHER_EXTRA_SLOT_CLASS}`.trim();
    slot.classList.remove("inactive");
    slot.classList.add("macro", "active");
    slot.dataset.slot = String(ENRICHER_HOTBAR_SLOT);
    slot.dataset.macroId = macro?.id ?? "";
    slot.setAttribute("draggable", "false");
    slot.innerHTML = `
        <img class="macro-icon" src="${ENRICHER_MACRO_IMG}" alt="${ENRICHER_MACRO_NAME}">
        <span class="macro-key">11</span>
    `;
    applyMacroVisuals(slot, macro);

    actionBar.appendChild(slot);
    scheduleExtraSlotPosition(slot, root, actionBar, anchorSlot);
    logHotbar11("Extra slot embedded into hotbar list", {
        listTag: list.tagName,
        baseSlots: slots.length,
        hasMacro: !!macro,
        macroId: macro?.id ?? null,
    });

    const onClick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        logHotbar11("Extra slot clicked");

        let targetMacro = findRebellionEnricherMacro();
        if (!targetMacro) {
            logHotbar11("Click: macro missing, trying to create/assign");
            await ensureRebellionEnricherHotbarMacro();
            targetMacro = findRebellionEnricherMacro();
        }
        if (!targetMacro) {
            logHotbar11("Click: macro still missing after ensure");
            ui.notifications.error("Не удалось создать макрос конструктора @Rebellion.");
            return;
        }
        logHotbar11("Executing macro", {
            macroId: targetMacro.id,
            macroName: targetMacro.name,
        });
        await targetMacro.execute();
    };

    slot.onclick = (event) => {
        void onClick(event);
    };
}

Hooks.on("renderHotbar", renderExtraHotbarSlot);

Hooks.on("renderHotbar", () => {
    bindHotbarLayoutObserver();
    for (const delay of [250, 600, 1200, 2500, 4000]) {
        setTimeout(() => queueHotbarRefresh(`delayed-${delay}ms`), delay);
    }
});

Hooks.once("ready", () => {
    logHotbar11("ready hook fired", {
        userId: game.user?.id ?? null,
        userName: game.user?.name ?? null,
        hasHotbarUi: !!ui.hotbar,
    });
    void ensureRebellionEnricherHotbarMacro().catch((error) => {
        console.error(`${ENRICHER_LOG_PREFIX} Failed to assign enricher macro to slot 11`, error);
    });
    bindHotbarResizePositioning();
    bindHotbarLayoutObserver();
    for (const delay of [300, 900, 1800, 3200, 5000]) {
        setTimeout(() => queueHotbarRefresh(`ready-delayed-${delay}ms`), delay);
    }
});

export async function openRebellionEnricherBuilder() {
    if (!game.user?.isGM) {
        ui.notifications.warn("Конструктор @Rebellion доступен только мастеру.");
        return;
    }
    const D20_TYPES = [
        { value: "loyalty", label: "Верность" },
        { value: "security", label: "Безопасность" },
        { value: "secrecy", label: "Секретность" },
    ];

    const D100_TYPES = [
        { value: "notoriety", label: "Известность" },
        { value: "notoriety/2", label: "Известность ÷2" },
        { value: "notoriety*2", label: "Известность ×2" },
        { value: "notoriety+dangers", label: "Известность + Опасность" },
        { value: "(notoriety+dangers)/2", label: "(Известность + Опасность) ÷2" },
        { value: "(notoriety+dangers)*2", label: "(Известность + Опасность) ×2" },
        { value: "dangers", label: "Опасность" },
    ];

    const DICE_STATS = [
        { value: "supporters", label: "Сторонники" },
        { value: "notoriety", label: "Известность" },
        { value: "treasury", label: "Казна" },
    ];

    const toInt = (raw) => {
        const value = Number.parseInt(String(raw ?? "").trim(), 10);
        return Number.isFinite(value) ? value : null;
    };

    const copyTextToClipboard = async (text) => {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();

        let ok = false;
        try {
            ok = document.execCommand("copy");
        } catch (_error) {
            ok = false;
        } finally {
            textarea.remove();
        }
        return ok;
    };

    const modeOptionsHtml = `
        <option value="d20">Характеристики восстания (type:...)</option>
        <option value="d100type">Проверка состояния (type:...)</option>
        <option value="percent">Процентный энричер (%)</option>
        <option value="dice">Бросок кубов ((XdY)[stat])</option>
    `;

    const d20CheckboxesHtml = D20_TYPES.map(
        (type) => `
            <label style="display:flex; align-items:center; gap:6px;">
                <input type="checkbox" name="d20-type" value="${type.value}">
                <span>${type.label}</span>
            </label>
        `
    ).join("");

    const d100OptionsHtml = D100_TYPES.map(
        (type) => `<option value="${type.value}">${type.label}</option>`
    ).join("");

    const diceOptionsHtml = DICE_STATS.map(
        (stat) => `<option value="${stat.value}">${stat.label}</option>`
    ).join("");

    const content = `
        <form id="rebellion-enricher-builder" style="display:grid; gap:10px;">
            <div>
                <label style="display:block; margin-bottom:4px;"><strong>Тип энричера</strong></label>
                <select name="mode" style="width:100%;">
                    ${modeOptionsHtml}
                </select>
            </div>

            <section class="mode-section" data-mode="d20" style="display:grid; gap:8px;">
                <label style="display:block;"><strong>Какие характеристики включить</strong></label>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    ${d20CheckboxesHtml}
                </div>
                <label style="display:block;">
                    КС (опционально):
                    <input type="number" min="1" step="1" name="d20-dc" style="width:100%;" placeholder="Например, 20">
                </label>
            </section>

            <section class="mode-section" data-mode="d100type" style="display:none; gap:8px;">
                <label style="display:block;">
                    Формула проверки:
                    <select name="d100-type" style="width:100%;">
                        ${d100OptionsHtml}
                    </select>
                </label>
            </section>

            <section class="mode-section" data-mode="percent" style="display:none; gap:8px;">
                <label style="display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" name="percent-danger">
                    <span>Добавить модификатор опасности (<code>%+danger</code>)</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" name="percent-reverse">
                    <span>Успех при ≤ КС (<code>|r</code>)</span>
                </label>
                <label style="display:block;">
                    КС (опционально, но обязательно для <code>|r</code>):
                    <input type="number" min="1" step="1" name="percent-dc" style="width:100%;" placeholder="Например, 75">
                </label>
            </section>

            <section class="mode-section" data-mode="dice" style="display:none; gap:8px;">
                <label style="display:block;">
                    Формула кубов:
                    <input type="text" name="dice-formula" style="width:100%;" value="1d6" placeholder="Например, 2d6+1">
                </label>
                <label style="display:block;">
                    Куда применить:
                    <select name="dice-stat" style="width:100%;">
                        ${diceOptionsHtml}
                    </select>
                </label>
            </section>

            <div>
                <label style="display:block; margin-bottom:4px;"><strong>Превью</strong></label>
                <pre class="rebellion-enricher-preview" style="margin:0; min-height:48px; padding:8px; border:1px solid #888; border-radius:4px; background:#f4f4f4; white-space:pre-wrap;"></pre>
            </div>
                    <div style="display:flex; justify-content:flex-end;">
                <button type="button" class="rebellion-copy-btn" style="padding:6px 10px; border:1px solid #666; border-radius:4px; cursor:pointer;">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>        </form>
    `;

    const updateModeVisibility = (form) => {
        const mode = form.querySelector('[name="mode"]')?.value;
        for (const section of form.querySelectorAll(".mode-section")) {
            section.style.display = section.dataset.mode === mode ? "grid" : "none";
        }
    };

    const getEnrichers = (form, { notify = false } = {}) => {
        const mode = form.querySelector('[name="mode"]')?.value;
        const fail = (message) => {
            if (notify) ui.notifications.warn(message);
            return [];
        };

        if (mode === "d20") {
            const selected = [...form.querySelectorAll('input[name="d20-type"]:checked')].map((el) => el.value);
            if (selected.length === 0) return fail("Выберите хотя бы одну характеристику восстания.");

            const dcRaw = form.querySelector('[name="d20-dc"]')?.value ?? "";
            const dc = toInt(dcRaw);
            if (dcRaw.trim() !== "" && (!dc || dc < 1)) return fail("КС должно быть целым числом от 1.");

            const suffix = dc ? `|dc:${dc}` : "";
            return selected.map((type) => `@Rebellion[type:${type}${suffix}]`);
        }

        if (mode === "d100type") {
            const type = form.querySelector('[name="d100-type"]')?.value;
            if (!type) return fail("Выберите формулу проверки.");
            return [`@Rebellion[type:${type}]`];
        }

        if (mode === "percent") {
            const hasDanger = form.querySelector('[name="percent-danger"]')?.checked;
            const reverse = form.querySelector('[name="percent-reverse"]')?.checked;
            const dcRaw = form.querySelector('[name="percent-dc"]')?.value ?? "";
            const dc = toInt(dcRaw);

            if (dcRaw.trim() !== "" && (!dc || dc < 1)) return fail("КС должно быть целым числом от 1.");
            if (reverse && !dc) return fail("Для режима `|r` обязательно укажите КС.");

            const dangerPart = hasDanger ? "+danger" : "";
            if (reverse) return [`@Rebellion[%${dangerPart}|dc:${dc}|r]`];

            const dcPart = dc ? `|dc:${dc}` : "";
            return [`@Rebellion[%${dangerPart}${dcPart}]`];
        }

        if (mode === "dice") {
            const formula = (form.querySelector('[name="dice-formula"]')?.value ?? "").trim();
            const stat = form.querySelector('[name="dice-stat"]')?.value;

            if (!formula) return fail("Введите формулу кубов.");
            if (/[[\]|]/.test(formula)) return fail("Формула кубов не должна содержать `[`, `]` или `|`.");
            if (typeof Roll?.validate === "function" && !Roll.validate(formula)) {
                return fail("Некорректная формула кубов.");
            }
            if (!stat) return fail("Выберите характеристику для изменения.");

            return [`@Rebellion[(${formula})[${stat}]]`];
        }

        return fail("Не выбран режим конструктора.");
    };

    const updatePreview = (form) => {
        const preview = form.querySelector(".rebellion-enricher-preview");
        if (!preview) return;

        const lines = getEnrichers(form, { notify: false });
        preview.textContent = lines.length ? lines.join("\n") : "Выберите параметры энричера.";
    };

    return new Dialog(
        {
            title: "Конструктор @Rebellion",
            content,
            buttons: {
                post: {
                    label: "Запостить в чат",
                    icon: '<i class="fas fa-comment"></i>',
                    callback: async (html) => {
                        const form = html[0]?.querySelector("#rebellion-enricher-builder");
                        if (!form) return;

                        const lines = getEnrichers(form, { notify: true });
                        if (!lines.length) return;

                        const rawContent = lines.join("\n");
                        const enriched = await TextEditor.enrichHTML(rawContent, {
                            async: true,
                            secrets: game.user.isGM,
                        });

                        await ChatMessage.create({
                            content: enriched,
                            speaker: ChatMessage.getSpeaker(),
                        });
                    },
                },
                cancel: {
                    label: "Закрыть",
                },
            },
            default: "post",
            render: (html) => {
                const form = html[0]?.querySelector("#rebellion-enricher-builder");
                if (!form) return;

                const refresh = () => {
                    updateModeVisibility(form);
                    updatePreview(form);
                };

                for (const el of form.querySelectorAll("input, select")) {
                    el.addEventListener("change", refresh);
                    el.addEventListener("input", refresh);
                }
                const copyBtn = form.querySelector(".rebellion-copy-btn");
                if (copyBtn instanceof HTMLButtonElement) {
                    copyBtn.addEventListener("click", () => {
                        void (async () => {
                            const lines = getEnrichers(form, { notify: true });
                            if (!lines.length) return;

                            const rawContent = lines.join("\n");
                            const copied = await copyTextToClipboard(rawContent);
                            if (copied) ui.notifications.info("Скопировано в буфер обмена.");
                            else ui.notifications.error("Не удалось скопировать в буфер обмена.");
                        })();
                    });
                }
                refresh();
            },
        },
        {
            width: 560,
        }
    ).render(true);
}
