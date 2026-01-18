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
}

