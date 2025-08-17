#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StructuredLogger_1 = require("../core/StructuredLogger");
const AdvancedTelegramService_1 = require("../notify/AdvancedTelegramService");
// Mock du TelegramService pour les tests
class MockTelegramService {
    sentMessages = [];
    async sendMessage(message) {
        this.sentMessages.push(message);
        console.log(`📱 [MOCK] Message Telegram envoyé: ${message}`);
    }
    getSentMessages() {
        return this.sentMessages;
    }
    clearMessages() {
        this.sentMessages = [];
    }
}
async function testTelegramAlerts() {
    console.log('🧪 Test des Alertes Telegram Avancées\n');
    // 1. Initialiser les composants
    const logger = new StructuredLogger_1.StructuredLogger(StructuredLogger_1.LogLevel.INFO);
    const mockTelegram = new MockTelegramService();
    const alertService = new AdvancedTelegramService_1.AdvancedTelegramService(mockTelegram, logger);
    console.log('✅ Composants initialisés');
    // 2. Tester les règles d'alerte par défaut
    console.log('\n📋 Regles d\'alerte par defaut:');
    const defaultRules = alertService.getAlertStats();
    console.log(JSON.stringify(defaultRules, null, 2));
    // 3. Ajouter des règles personnalisées
    alertService.addAlertRule({
        id: 'high_memory',
        name: 'Mémoire élevée',
        type: AdvancedTelegramService_1.AlertType.PERFORMANCE,
        priority: AdvancedTelegramService_1.AlertPriority.HIGH,
        condition: (data) => data.memoryUsage > 80,
        message: '⚠️ Utilisation mémoire élevée: {memoryUsage}%',
        cooldownMs: 300000, // 5 minutes
        enabled: true
    });
    alertService.addAlertRule({
        id: 'api_error_rate',
        name: 'Taux d\'erreur API élevé',
        type: AdvancedTelegramService_1.AlertType.ERROR,
        priority: AdvancedTelegramService_1.AlertPriority.CRITICAL,
        condition: (data) => data.errorRate > 10,
        message: '🚨 Taux d\'erreur API critique: {errorRate}%',
        cooldownMs: 60000, // 1 minute
        enabled: true
    });
    console.log('✅ Règles personnalisées ajoutées');
    // 4. Déclencher des alertes
    console.log('\n🚨 Déclenchement d\'alertes:');
    // Alerte mémoire (devrait se déclencher)
    alertService.triggerAlert('high_memory', { memoryUsage: 85 });
    console.log('✅ Alerte mémoire déclenchée');
    // Alerte API (devrait se déclencher)
    alertService.triggerAlert('api_error_rate', { errorRate: 15 });
    console.log('✅ Alerte API déclenchée');
    // Alerte mémoire encore (devrait être ignorée à cause du cooldown)
    alertService.triggerAlert('high_memory', { memoryUsage: 90 });
    console.log('✅ Alerte mémoire répétée (devrait être ignorée)');
    // 5. Attendre le traitement de la queue
    console.log('\n⏳ Attente du traitement de la queue...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    // 6. Vérifier les messages envoyés
    console.log('\n📱 Messages Telegram envoyés:');
    const sentMessages = mockTelegram.getSentMessages();
    console.log(`Total: ${sentMessages.length} messages`);
    sentMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg}`);
    });
    // 7. Tester l'acquittement d'alertes
    console.log('\n✅ Test d\'acquittement:');
    const alertStats = alertService.getAlertStats();
    console.log('Statistiques avant acquittement:', JSON.stringify(alertStats, null, 2));
    // Acquitter une alerte
    if (alertStats.totalAlerts > 0) {
        const firstAlertId = Object.keys(alertStats.alertsByPriority)[0];
        if (firstAlertId) {
            const acknowledged = alertService.acknowledgeAlert(firstAlertId, 'test-user');
            console.log(`Alerte ${firstAlertId} acquittee: ${acknowledged}`);
        }
    }
    // 8. Nettoyage des anciennes alertes
    console.log('\n🧹 Nettoyage des anciennes alertes:');
    alertService.cleanupOldAlerts(1); // 1 heure
    const finalStats = alertService.getAlertStats();
    console.log('Statistiques finales:', JSON.stringify(finalStats, null, 2));
    // 9. Nettoyage
    alertService.stop();
    logger.info('Test des alertes Telegram terminé avec succès');
    console.log('\n🎉 Test des alertes Telegram terminé !');
}
// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});
// Lancer le test
testTelegramAlerts().catch(console.error);
//# sourceMappingURL=test-telegram-alerts.js.map