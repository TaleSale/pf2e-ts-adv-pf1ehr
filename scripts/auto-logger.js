// Автоматическое логирование для системы восстания
// Создает красивые записи для всех событий

import { JournalLogger } from "./journal-logger.js";

export class AutoLogger {
    
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