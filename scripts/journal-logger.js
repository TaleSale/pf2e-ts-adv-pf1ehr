// Enhanced Journal Logging System for Rebellion Sheet
// Автоматическое красивое логирование всех событий восстания

import { REBELLION_PROGRESSION } from "./config.js";
import { DataHandler } from "./data-handler.js";

export class JournalLogger {
    
    /**
     * Создает красивый заголовок для новой недели
     */
    static createWeekHeader(weekNumber, rank, title) {
        return `
            <div style="
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
                padding: 25px;
                border-radius: 15px;
                margin: 20px 0;
                text-align: center;
                box-shadow: 0 8px 16px rgba(0,0,0,0.3);
                border: 3px solid #ecf0f1;
            ">
                <div style="
                    margin-top: 15px; 
                    font-size: 3em;
                    color: #ffffff;
                    font-weight: bold;
                ">
                    <i class="fas fa-crow header-logo"></i>
                </div>
                
                <div style="
                    margin-top: 15px; 
                    font-size: 1.4em;
                    color: #ffffff;
                    font-weight: bold;
                ">
                    Серебряные Вороны
                </div>
                
                <div style="
                    margin-top: 8px; 
                    font-size: 1.2em; 
                    color: #ffffff;
                    font-weight: 500;
                ">
                    ${title || `Ранг ${rank}`}
                </div>
            </div>
        `;
    }

    /**
     * Создает красивую статистическую панель
     */
    static createStatsPanel(data) {
        const rankInfo = REBELLION_PROGRESSION?.[data.rank] || {};
        
        return `
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 15px;
                margin: 20px 0;
            ">
                <div style="
                    background: #27ae60; 
                    color: white; 
                    padding: 20px; 
                    border-radius: 12px; 
                    text-align: center;
                    box-shadow: 0 4px 8px rgba(39, 174, 96, 0.3);
                    border: 2px solid #2ecc71;
                ">
                    <div style="font-size: 2.5em; margin-bottom: 8px;">👥</div>
                    <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 5px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${data.supporters || 0}</div>
                    <div style="font-size: 1em; color: #ffffff; font-weight: 600;">Сторонники</div>
                </div>
                
                <div style="
                    background: #e67e22; 
                    color: white; 
                    padding: 20px; 
                    border-radius: 12px; 
                    text-align: center;
                    box-shadow: 0 4px 8px rgba(230, 126, 34, 0.3);
                    border: 2px solid #f39c12;
                ">
                    <div style="font-size: 2.5em; margin-bottom: 8px;">⭐</div>
                    <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 5px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">Ранг ${data.rank || 1}</div>
                    <div style="font-size: 1em; color: #ffffff; font-weight: 600;">${rankInfo.title || 'Восстание'}</div>
                </div>
                
                <div style="
                    background: #3498db; 
                    color: white; 
                    padding: 20px; 
                    border-radius: 12px; 
                    text-align: center;
                    box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
                    border: 2px solid #5dade2;
                ">
                    <div style="font-size: 2.5em; margin-bottom: 8px;">💰</div>
                    <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 5px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${data.treasury || 0} зм</div>
                    <div style="font-size: 1em; color: #ffffff; font-weight: 600;">Казна</div>
                </div>
                
                <div style="
                    background: #e74c3c; 
                    color: white; 
                    padding: 20px; 
                    border-radius: 12px; 
                    text-align: center;
                    box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3);
                    border: 2px solid #ec7063;
                ">
                    <div style="font-size: 2.5em; margin-bottom: 8px;">⚠️</div>
                    <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 5px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${data.notoriety || 0}</div>
                    <div style="font-size: 1em; color: #ffffff; font-weight: 600;">Известность</div>
                </div>
                
                <div style="
                    background: #8e44ad; 
                    color: white; 
                    padding: 20px; 
                    border-radius: 12px; 
                    text-align: center;
                    box-shadow: 0 4px 8px rgba(142, 68, 173, 0.3);
                    border: 2px solid #a569bd;
                ">
                    <div style="font-size: 2.5em; margin-bottom: 8px;">🎯</div>
                    <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 5px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${DataHandler.getEffectiveDanger(data) || 0}%</div>
                    <div style="font-size: 1em; color: #ffffff; font-weight: 600;">Опасность</div>
                </div>
                
                <div style="
                    background: #34495e; 
                    color: white; 
                    padding: 20px; 
                    border-radius: 12px; 
                    text-align: center;
                    box-shadow: 0 4px 8px rgba(52, 73, 94, 0.3);
                    border: 2px solid #5d6d7e;
                ">
                    <div style="font-size: 2.5em; margin-bottom: 8px;">🏘️</div>
                    <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 5px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${data.population || 0}</div>
                    <div style="font-size: 1em; color: #ffffff; font-weight: 600;">Население</div>
                </div>
            </div>
        `;
    }

    /**
     * Создает красивую сводку событий
     */
    static createEventsSummary(events) {
        if (!events || events.length === 0) {
            return `
                <div style="
                    background: #e8f5e9;
                    border: 2px solid #4caf50;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: center;
                ">
                    <div style="font-size: 2em; margin-bottom: 10px;">🕊️</div>
                    <h4 style="margin: 0; color: #2e7d32;">Спокойная неделя</h4>
                    <div style="color: #388e3c; margin-top: 8px;">Никаких активных событий</div>
                </div>
            `;
        }

        const eventsList = events.map(event => `
            <div style="
                background: rgba(255, 193, 7, 0.1);
                border: 2px solid #ffc107;
                border-radius: 8px;
                padding: 12px;
                margin: 8px 0;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5em;">⚠️</span>
                    <div>
                        <strong style="color: #f57c00;">${event.name}</strong>
                        <div style="color: #333; font-size: 0.9em; margin-top: 4px;">
                            ${event.desc || 'Активное событие'}
                        </div>
                        ${event.mitigated ? '<div style="color: #4caf50; font-size: 0.8em; margin-top: 4px;">✅ Смягчено</div>' : ''}
                    </div>
                </div>
            </div>
        `).join('');

        return `
            <div style="
                background: #fff3e0;
                border: 2px solid #ff9800;
                border-radius: 10px;
                padding: 15px;
                margin: 20px 0;
            ">
                <h4 style="margin: 0 0 15px 0; color: #f57c00; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2em;">📅</span>
                    Активные события (${events.length})
                </h4>
                ${eventsList}
            </div>
        `;
    }

    /**
     * Создает красивый отчет о деятельности
     */
    static createActivityReport(phaseReport) {
        if (!phaseReport || phaseReport.trim() === '') {
            return `
                <div style="
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 10px;
                    padding: 40px;
                    text-align: center;
                    color: #6c757d;
                    font-style: italic;
                    margin: 20px 0;
                ">
                    <div style="font-size: 3em; margin-bottom: 15px; opacity: 0.5;">📋</div>
                    <div style="font-size: 1.2em;">Нет записей о деятельности на этой неделе</div>
                </div>
            `;
        }

        return `
            <div style="
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin: 20px 0;
            ">
                <h3 style="
                    color: #495057;
                    margin: 0 0 20px 0;
                    padding-bottom: 15px;
                    border-bottom: 3px solid #dee2e6;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 1.4em;
                ">
                    <span style="font-size: 1.2em;">📝</span>
                    Отчет о деятельности
                </h3>
                <div style="line-height: 1.6;">
                    ${phaseReport}
                </div>
            </div>
        `;
    }

    /**
     * Создает полный отчет о неделе
     */
    static createWeeklyReport(data, phaseReport) {
        const weekHeader = this.createWeekHeader(data.week, data.rank, REBELLION_PROGRESSION?.[data.rank]?.title);
        const statsPanel = this.createStatsPanel(data);
        const eventsSummary = this.createEventsSummary(data.events);
        const activityReport = this.createActivityReport(phaseReport);

        return `
            ${weekHeader}
            ${statsPanel}
            ${eventsSummary}
            ${activityReport}
            
            <div style="
                text-align: center;
                margin: 30px 0;
                padding: 20px;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                border-radius: 10px;
                color: #2c3e50;
                font-style: italic;
                font-weight: 600;
            ">
                📚 Отчет создан автоматически системой журналирования Серебряных Воронов
            </div>
        `;
    }

    /**
     * Создает красивое сообщение о завершении недели
     */
    static createWeekCompletionMessage(weekNumber) {
        return `
            <div style="
                border: 3px solid #2980b9; 
                padding: 25px; 
                background: linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%); 
                border-radius: 15px; 
                margin: 20px 0; 
                box-shadow: 0 8px 16px rgba(41, 128, 185, 0.4);
                text-align: center;
            ">
                <div style="
                    width: 100%;
                    height: 4px;
                    background: #2980b9;
                    border-radius: 2px;
                    margin-bottom: 20px;
                "></div>
                
                <h3 style="
                    color: #2c3e50; 
                    margin: 0 0 20px 0; 
                    font-size: 2em;
                    text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
                    font-weight: bold;
                ">
                    📚 Неделя ${weekNumber} завершена!
                </h3>
                
                <div style="
                    background: #ffffff; 
                    padding: 20px; 
                    border-radius: 12px; 
                    margin: 15px 0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    border: 2px solid #3498db;
                ">
                    <div style="font-size: 1.4em; color: #2980b9; margin-bottom: 12px; font-weight: bold;">
                        Архив успешно создан
                    </div>
                    <div style="color: #2c3e50; font-size: 1em; line-height: 1.4; font-weight: 500;">
                        Все события недели сохранены в журнале<br>
                        Статистика обновлена • Команды готовы к новым заданиям
                    </div>
                </div>
                
                <div style="
                    margin-top: 20px; 
                    font-size: 1.3em; 
                    color: #27ae60;
                    font-weight: bold;
                    text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
                ">
                    Добро пожаловать в Неделю ${weekNumber + 1}!
                </div>
                
                <div style="
                    margin-top: 15px;
                    font-size: 1em;
                    color: #34495e;
                    font-style: italic;
                    font-weight: 500;
                ">
                    Пусть удача сопутствует Серебряным Воронам! <i class="fas fa-crow header-logo"></i>
                </div>
            </div>
        `;
    }

    /**
     * Создает красивое сообщение об изменении статистики
     */
    static createStatChangeMessage(statType, operation, value, oldValue, newValue) {
        let statLabel = "";
        let icon = "";
        let color = "";
        
        if (statType === "supporters") {
            statLabel = "Сторонники";
            icon = "👥";
            color = operation === "add" ? "#27ae60" : "#e74c3c";
        } else if (statType === "notoriety") {
            statLabel = "Известность";
            icon = "⚠️";
            color = operation === "add" ? "#e74c3c" : "#27ae60";
        } else if (statType === "treasury") {
            statLabel = "Казна";
            icon = "💰";
            color = operation === "add" ? "#27ae60" : "#e74c3c";
        }
        
        const operationText = operation === "add" ? "увеличено" : "уменьшено";
        const changeText = operation === "add" ? `+${value}` : `-${value}`;
        const timestamp = new Date().toLocaleString('ru-RU');
        
        return `
            <div style="
                border: 2px solid ${color}; 
                padding: 15px; 
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); 
                border-radius: 10px; 
                margin: 10px 0; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <span style="font-size: 1.8em;">${icon}</span>
                    <div>
                        <h4 style="margin: 0; color: ${color}; font-size: 1.2em;">
                            ${statLabel} ${operationText}
                        </h4>
                        <div style="color: #6c757d; font-size: 0.9em; margin-top: 2px;">
                            ${timestamp}
                        </div>
                    </div>
                </div>
                
                <div style="
                    background: rgba(0,0,0,0.05); 
                    padding: 12px; 
                    border-radius: 6px; 
                    font-family: monospace;
                    border-left: 4px solid ${color};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #495057; font-weight: 500;">
                            Изменение: <strong style="color: ${color};">${changeText}</strong>
                        </span>
                        <span style="color: #6c757d;">
                            ${oldValue} → <strong style="color: ${color};">${newValue}</strong>
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Логирует изменение статистики в журнал восстания
     */
    static async logStatChange(statType, operation, value, oldValue, newValue) {
        const journalEntryId = game.settings.get("pf2e-ts-adv-pf1ehr", "journalEntry");
        if (!journalEntryId) {
            console.warn("Rebellion: Журнал восстания не найден");
            return;
        }

        const journal = game.journal.get(journalEntryId);
        if (!journal) {
            console.warn("Rebellion: Журнал восстания не найден по ID:", journalEntryId);
            return;
        }

        // Найдем страницу "Журнал событий" или создадим её
        let logPage = journal.pages.find(p => p.name === "Журнал событий");
        if (!logPage) {
            logPage = await journal.createEmbeddedDocuments("JournalEntryPage", [{
                name: "Журнал событий",
                type: "text",
                text: {
                    content: "<h1>Журнал событий Серебряных Воронов</h1>",
                    format: 1
                }
            }]);
            logPage = logPage[0];
        }

        // Создаем сообщение об изменении
        const changeMessage = this.createStatChangeMessage(statType, operation, value, oldValue, newValue);
        
        // Добавляем к существующему содержимому
        const currentContent = logPage.text.content || "";
        const newContent = currentContent + changeMessage;
        
        await logPage.update({
            "text.content": newContent
        });
        
        console.log(`Rebellion: Записано в журнал изменение ${statType}: ${operation} ${value}`);
    }


    // Methods merged from former AutoLogger
/**
     * Логирует начало новой недели
     */
    static async logWeekStart(data) {
        const weekStartMessage = `
            <div style="
                background: linear-gradient(135deg, #4a90e2 0%, #667eea 100%);
                color: white;
                padding: 20px;
                border-radius: 15px;
                margin: 15px 0;
                text-align: center;
                box-shadow: 0 6px 12px rgba(74, 144, 226, 0.4);
            ">
                <h3 style="margin: 0 0 15px 0; font-size: 1.8em;">
                    🌅 Неделя ${data.week} начинается!
                </h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 15px 0;">
                    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 1.5em;">👥</div>
                        <div style="font-size: 1.1em; font-weight: bold;">${data.supporters}</div>
                        <div style="font-size: 0.8em;">Сторонники</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 1.5em;">💰</div>
                        <div style="font-size: 1.1em; font-weight: bold;">${data.treasury} зм</div>
                        <div style="font-size: 0.8em;">Казна</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 1.5em;">⚠️</div>
                        <div style="font-size: 1.1em; font-weight: bold;">${data.notoriety}</div>
                        <div style="font-size: 0.8em;">Известность</div>
                    </div>
                </div>
                
                <div style="margin-top: 15px; font-size: 1em; opacity: 0.9;">
                    Серебряные Вороны готовы к новым свершениям! <i class="fas fa-crow header-logo"></i>
                </div>
            </div>
        `;
        
        return weekStartMessage;
    }

    /**
     * Логирует смену фокуса восстания
     */
    static async logFocusChange(oldFocus, newFocus, focusTypes) {
        const oldFocusName = focusTypes[oldFocus]?.label || oldFocus;
        const newFocusName = focusTypes[newFocus]?.label || newFocus;
        
        return `
            <div style="
                border: 3px solid #ff9800;
                padding: 15px;
                background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                border-radius: 12px;
                margin: 10px 0;
                box-shadow: 0 4px 8px rgba(255, 152, 0, 0.3);
            ">
                <h5 style="color: #f57c00; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 2em;">🎯</span>
                    Смена приоритета восстания
                </h5>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin: 15px 0;">
                    <div style="text-align: center;">
                        <div style="color: #666; font-size: 0.9em;">Было:</div>
                        <strong style="color: #757575; font-size: 1.1em;">${oldFocusName}</strong>
                    </div>
                    <div style="font-size: 2em; color: #ff9800;">➡️</div>
                    <div style="text-align: center;">
                        <div style="color: #f57c00; font-size: 0.9em;">Стало:</div>
                        <strong style="color: #f57c00; font-size: 1.2em;">${newFocusName}</strong>
                    </div>
                </div>
                
                <div style="background: rgba(255,255,255,0.8); padding: 10px; border-radius: 8px; text-align: center; margin-top: 15px;">
                    <span style="color: #f57c00; font-size: 0.9em;">
                        🔄 Восстание меняет свою стратегию
                    </span>
                </div>
            </div>
        `;
    }

    /**
     * Логирует повышение ранга
     */
    static async logRankUp(oldRank, newRank, rankInfo, customGift) {
        const giftText = customGift || rankInfo.gift;
        
        return `
            <div style="
                border: 4px solid #4caf50;
                padding: 20px;
                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
                border-radius: 15px;
                margin: 15px 0;
                box-shadow: 0 8px 16px rgba(76, 175, 80, 0.4);
                text-align: center;
                position: relative;
                overflow: hidden;
            ">
                <div style="
                    position: absolute;
                    top: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #4caf50;
                    color: white;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-size: 0.9em;
                    font-weight: bold;
                ">
                    🎉 ПОВЫШЕНИЕ РАНГА! 🎉
                </div>
                
                <h3 style="color: #2e7d32; margin: 20px 0 15px 0; font-size: 2em;">
                    Ранг ${oldRank} ➡️ Ранг ${newRank}
                </h3>
                
                <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <div style="color: #2e7d32; font-weight: bold; margin-bottom: 10px; font-size: 1.2em;">
                        👑 ${rankInfo.title || `Ранг ${newRank}`}
                    </div>
                    ${giftText ? `
                        <div style="margin-top: 15px; padding: 12px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border: 2px solid #4caf50;">
                            <strong style="color: #2e7d32;">🎁 Дар ПИ:</strong>
                            <div style="margin-top: 8px; color: #424242; font-style: italic;">
                                ${giftText}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div style="margin-top: 20px; font-size: 1.3em; color: #1b5e20;">
                    🚀 Восстание становится сильнее!
                </div>
            </div>
        `;
    }

    /**
     * Логирует изменения в казне
     */
    static async logTreasuryChange(amount, reason, newTotal) {
        const isPositive = amount > 0;
        const color = isPositive ? '#4caf50' : '#f44336';
        const icon = isPositive ? '💰' : '💸';
        const action = isPositive ? 'Пополнение' : 'Трата';
        
        return `
            <div style="
                border: 2px solid ${color};
                padding: 12px;
                background: linear-gradient(135deg, ${color}15 0%, ${color}25 100%);
                border-radius: 10px;
                margin: 8px 0;
                display: flex;
                align-items: center;
                gap: 15px;
            ">
                <div style="font-size: 2em;">${icon}</div>
                <div style="flex: 1;">
                    <strong style="color: ${color}; font-size: 1.1em;">${action} казны</strong>
                    <div style="color: #666; font-size: 0.9em; margin-top: 4px;">
                        ${reason} • ${isPositive ? '+' : ''}${amount} зм
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="color: #666; font-size: 0.8em;">Итого:</div>
                    <strong style="color: ${color}; font-size: 1.2em;">${newTotal} зм</strong>
                </div>
            </div>
        `;
    }

    /**
     * Логирует события восстания
     */
    static async logEvent(event, roll, danger) {
        const eventColor = event.name === "Все спокойно" ? '#4caf50' : '#ff9800';
        const eventIcon = event.name === "Все спокойно" ? '🕊️' : '⚠️';
        
        return `
            <div style="
                border: 3px solid ${eventColor};
                padding: 20px;
                background: linear-gradient(135deg, ${eventColor}15 0%, ${eventColor}25 100%);
                border-radius: 15px;
                margin: 15px 0;
                box-shadow: 0 6px 12px rgba(0,0,0,0.2);
            ">
                <h4 style="color: ${eventColor}; margin: 0 0 15px 0; font-size: 1.5em; display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.5em;">${eventIcon}</span>
                    СОБЫТИЕ: ${event.name}
                </h4>
                
                <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <div style="color: #666; font-size: 0.9em; margin-bottom: 8px;">
                        🎲 Бросок события: 1d100 + ${danger} опасности = ${roll}
                    </div>
                    <div style="color: #424242; line-height: 1.4;">
                        ${event.desc}
                    </div>
                </div>
                
                ${event.mitigate ? `
                    <div style="background: rgba(33, 150, 243, 0.1); padding: 12px; border-radius: 8px; border: 2px solid #2196f3; margin-top: 15px;">
                        <strong style="color: #1976d2;">🛡️ Возможность смягчения:</strong>
                        <div style="margin-top: 8px; color: #424242;">
                            ${event.mitigate} КС ${event.dc}
                        </div>
                    </div>
                ` : ''}
                
                ${event.persistent ? `
                    <div style="background: rgba(244, 67, 54, 0.1); padding: 12px; border-radius: 8px; border: 2px solid #f44336; margin-top: 15px;">
                        <strong style="color: #d32f2f;">⚠️ Внимание:</strong>
                        <div style="margin-top: 8px; color: #424242;">
                            Это событие может стать постоянным!
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Логирует смягчение события
     */
    static async logEventMitigation(eventName, skill, roll, total, dc, success) {
        const color = success ? '#4caf50' : '#f44336';
        const icon = success ? '✅' : '❌';
        const result = success ? 'Успех' : 'Провал';
        
        return `
            <div style="
                border: 3px solid ${color};
                padding: 15px;
                background: linear-gradient(135deg, ${color}15 0%, ${color}25 100%);
                border-radius: 12px;
                margin: 10px 0;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            ">
                <h5 style="color: ${color}; margin: 0 0 15px 0; font-size: 1.3em; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 2em;">🛡️</span>
                    Смягчение события: ${eventName}
                </h5>
                
                <div style="background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                    <strong>🎲 Проверка ${skill}:</strong>
                    <span style="color: ${color}; font-weight: bold; font-size: 1.1em;">
                        1d20(${roll}) + бонус = ${total} против КС ${dc}
                    </span>
                </div>
                
                <div style="background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; text-align: center; border-left: 4px solid ${color};">
                    <strong style="color: ${color}; font-size: 1.2em;">
                        ${icon} ${result}
                    </strong>
                    <div style="margin-top: 8px; color: #666; font-size: 0.9em;">
                        ${success ? 'Событие успешно смягчено!' : 'Смягчение не удалось'}
                    </div>
                </div>
            </div>
        `;
    }
}
