#!/usr/bin/env ts-node

import { StructuredLogger, LogLevel } from '../core/StructuredLogger';
import { AdvancedMetrics } from '../core/AdvancedMetrics';
import { DashboardController } from '../api/DashboardController';

async function testDashboard() {
  console.log('🧪 Test du Dashboard et Métriques Avancées\n');

  // 1. Initialiser les composants
  const logger = new StructuredLogger(LogLevel.INFO);
  const metrics = new AdvancedMetrics(logger);
  const dashboard = new DashboardController(metrics, logger);

  console.log('✅ Composants initialisés');

  // 2. Définir quelques métriques de test
  metrics.defineMetric({
    name: 'test_counter',
    type: 'counter',
    description: 'Compteur de test',
    labels: ['component', 'status']
  });

  metrics.defineMetric({
    name: 'test_gauge',
    type: 'gauge',
    description: 'Jauge de test',
    labels: ['component']
  });

  metrics.defineMetric({
    name: 'test_histogram',
    type: 'histogram',
    description: 'Histogramme de test',
    labels: ['operation']
  });

  console.log('✅ Métriques définies');

  // 3. Enregistrer des valeurs de test
  metrics.incrementCounter('test_counter', 1, { component: 'dashboard', status: 'ok' });
  metrics.incrementCounter('test_counter', 2, { component: 'api', status: 'ok' });
  metrics.setGauge('test_gauge', 42.5, { component: 'system' });
  metrics.observeHistogram('test_histogram', 150, { operation: 'request' });
  metrics.observeHistogram('test_histogram', 200, { operation: 'request' });
  metrics.observeHistogram('test_histogram', 100, { operation: 'request' });

  console.log('✅ Valeurs de test enregistrées');

  // 4. Tester le dashboard
  try {
    const dashboardData = dashboard.getDashboardData();
    console.log('\n📊 Dashboard Data:');
    console.log(JSON.stringify(dashboardData, null, 2));

    console.log('\n📊 Dashboard HTML:');
    const html = dashboard.getDashboardHTML();
    console.log(`HTML généré (${html.length} caractères)`);
    
    // Vérifier que l'HTML contient des éléments clés
    if (html.includes('Dashboard') && html.includes('Métriques')) {
      console.log('✅ HTML du dashboard valide');
    } else {
      console.log('❌ HTML du dashboard invalide');
    }

  } catch (error) {
    console.error('❌ Erreur dashboard:', error);
  }

  // 5. Tester les métriques
  try {
    console.log('\n📈 Métriques enregistrées:');
    const allMetrics = metrics.getAllMetrics();
    console.log(JSON.stringify(allMetrics, null, 2));

    console.log('\n📊 Export Prometheus:');
    const prometheus = metrics.exportPrometheus();
    console.log(prometheus);

    console.log('\n📊 Statistiques:');
    const stats = metrics.getStats();
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('❌ Erreur métriques:', error);
  }

  // 6. Test des agrégations
  try {
    console.log('\n📊 Agrégations:');
    const counterAgg = metrics.getMetricAggregation('test_counter');
    const gaugeAgg = metrics.getMetricAggregation('test_gauge');
    const histAgg = metrics.getMetricAggregation('test_histogram');

    console.log('Counter:', counterAgg);
    console.log('Gauge:', gaugeAgg);
    console.log('Histogram:', histAgg);

  } catch (error) {
    console.error('❌ Erreur agrégations:', error);
  }

  // 7. Nettoyage
  metrics.stop();
  logger.info('Test terminé avec succès');

  console.log('\n🎉 Test du dashboard terminé !');
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
testDashboard().catch(console.error);
