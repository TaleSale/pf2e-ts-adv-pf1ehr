// Тестовый файл для проверки системы логирования
// Можно использовать в консоли браузера для тестирования

// Тест создания красивого сообщения о действии команды
function testTeamActionMessage() {
    const sheet = game.modules.get("pf2e-ts-adv-pf1ehr")?.api?.sheet;
    if (!sheet) {
        console.error("Лист восстания не найден!");
        return;
    }

    const testTeam = {
        type: 'streetPerformers',
        manager: 'Тестовый командир',
        currentAction: 'earnGold'
    };

    const testRoll = { total: 15 };
    const testTotal = 18;
    const testDC = 12;

    const message = sheet._createTeamActionMessage(
        testTeam, 
        'earnGold', 
        'success', 
        testRoll, 
        testTotal, 
        testDC,
        '💰 Заработано: <strong>45 зм</strong>'
    );

    console.log("Тестовое сообщение о действии команды:", message);
    
    // Отправить в чат для визуальной проверки
    ChatMessage.create({ 
        content: message, 
        speaker: ChatMessage.getSpeaker() 
    });
}

// Тест создания еженедельного отчета
function testWeeklyReport() {
    const testData = {
        week: 5,
        rank: 3,
        supporters: 150,
        treasury: 250,
        notoriety: 25,
        danger: 30,
        population: 11500,
        events: [
            {
                name: "Усиленные патрули",
                desc: "Трунау усилил патрулирование города",
                mitigated: false
            }
        ]
    };

    const testReport = "Тестовый отчет о деятельности недели...";

    import("./journal-logger.js").then(({ JournalLogger }) => {
        const report = JournalLogger.createWeeklyReport(testData, testReport);
        console.log("Тестовый еженедельный отчет:", report);
        
        // Создать тестовую страницу журнала
        JournalEntry.create({
            name: "Тест - Неделя 5",
            pages: [{
                name: "Тестовая неделя",
                text: {
                    content: report,
                    format: 1
                }
            }]
        });
    });
}

// Тест логирования смены фокуса
function testFocusChange() {
    import("./auto-logger.js").then(({ AutoLogger }) => {
        const focusTypes = {
            loyalty: { label: "Верность" },
            security: { label: "Безопасность" }
        };

        const message = AutoLogger.logFocusChange('loyalty', 'security', focusTypes);
        console.log("Тестовое сообщение о смене фокуса:", message);
        
        ChatMessage.create({ 
            content: message, 
            speaker: ChatMessage.getSpeaker() 
        });
    });
}

// Тест логирования повышения ранга
function testRankUp() {
    import("./auto-logger.js").then(({ AutoLogger }) => {
        const rankInfo = {
            title: "Признанные повстанцы",
            gift: "Тестовый дар ПИ для ранга 3"
        };

        const message = AutoLogger.logRankUp(2, 3, rankInfo, null);
        console.log("Тестовое сообщение о повышении ранга:", message);
        
        ChatMessage.create({ 
            content: message, 
            speaker: ChatMessage.getSpeaker() 
        });
    });
}

// Экспорт функций для использования в консоли
window.testRebellionLogger = {
    testTeamActionMessage,
    testWeeklyReport,
    testFocusChange,
    testRankUp
};

console.log("🧪 Тестовые функции логирования загружены!");
console.log("Используйте: testRebellionLogger.testTeamActionMessage() и другие функции для тестирования");