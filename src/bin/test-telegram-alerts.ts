#!/usr/bin/env ts-node

import { StructuredLogger, LogLevel } from '../core/StructuredLogger';
import { AdvancedTelegramService, AlertPriority, AlertType } from '../notify/AdvancedTelegramService';

// Mock du TelegramService pour les tests
class MockTelegramService {
  private sentMessages: string[] = [];

  async sendMessage(message: string): Promise<void> {
    this.sentMessages.push(message);
    console.log(`📱 [MOCK] Message Telegram envoyé: ${message}`);
  }

  getSentMessages(): string[] {
    return this.sentMessages;
  }

  clearMessages(): void {
    this.sentMessages = [];
  }
}

async function testTelegramAlerts() {
  console.log('🧪 Test des Alertes Telegram Avancées\n');

  // 1. Initialiser les composants
  const logger = new StructuredLogger(LogLevel.INFO);
  const mockTelegram = new MockTelegramService();
  const alertService = new AdvancedTelegramService(mockTelegram as any, logger);

  console.log('✅ Composants initialisés');

  // 2. Tester les règles d'alerte par défaut
  console.log('\n📋 Regles d\'alerte par defaut:');
  const defaultRules = alertService.getAlertStats();
  console.log(JSON.stringify(defaultRules, null, 2));

  // 3. Ajouter des règles personnalisées
  alertService.addAlertRule({
    id: 'high_memory',
    name: 'Mémoire élevée',
    type: AlertType.PERFORMANCE,
    priority: AlertPriority.HIGH,
    condition: (data: any) => data.memoryUsage > 80,
    message: '⚠️ Utilisation mémoire élevée: {memoryUsage}%',
    cooldownMs: 300000, // 5 minutes
    enabled: true
  });

  alertService.addAlertRule({
    id: 'api_error_rate',
    name: 'Taux d\'erreur API élevé',
    type: AlertType.ERROR,
    priority: AlertPriority.CRITICAL,
    condition: (data: any) => data.errorRate > 10,
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
