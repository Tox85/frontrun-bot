import { createServer, IncomingMessage, ServerResponse } from 'http';
import { CONFIG, getConfigSummary, ENVZ_ENABLED } from './config/env';

const PORT = CONFIG.PORT;

// Fonction pour envoyer une réponse JSON
function sendJsonResponse(res: ServerResponse, statusCode: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.writeHead(statusCode);
  res.end(JSON.stringify(data, null, 2));
}

// Fonction pour vérifier l'état de l'application
function getHealthStatus() {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    memory: {
      rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memory.external / 1024 / 1024) + ' MB'
    },
    environment: CONFIG.NODE_ENV,
    isRailway: CONFIG.IS_RAILWAY,
    port: PORT
  };
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Gestion des requêtes OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = req.url || '/';
  const method = req.method || 'GET';

  try {
    if (method === 'GET') {
      switch (url) {
        case '/':
        case '/health':
    const healthData = getHealthStatus();
          sendJsonResponse(res, 200, healthData);
          break;
    
        case '/ready':
    const uptime = process.uptime();
          const readyStatus = uptime > 10 ? 'ready' : 'starting';
          sendJsonResponse(res, 200, {
            status: readyStatus,
            timestamp: new Date().toISOString(),
            uptime: uptime,
            environment: CONFIG.NODE_ENV,
            isRailway: CONFIG.IS_RAILWAY
          });
          break;

        case '/ping':
          sendJsonResponse(res, 200, {
            status: 'pong',
            timestamp: new Date().toISOString(),
            environment: CONFIG.NODE_ENV
          });
          break;

        case '/envz':
          if (!ENVZ_ENABLED) {
            sendJsonResponse(res, 403, {
              error: 'Endpoint /envz désactivé',
              message: 'Définissez ENVZ_ENABLED=true pour activer ce endpoint'
            });
            return;
          }

          try {
            const summary = getConfigSummary();
            sendJsonResponse(res, 200, {
              status: 'ok',
              timestamp: new Date().toISOString(),
              environment: CONFIG.NODE_ENV,
              isRailway: CONFIG.IS_RAILWAY,
              config: summary
            });
          } catch (error) {
            sendJsonResponse(res, 500, {
              error: 'Erreur lors de la récupération de la configuration',
              message: error instanceof Error ? error.message : 'Erreur inconnue'
            });
          }
          break;

        case '/status':
          sendJsonResponse(res, 200, {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
              hyperliquid: CONFIG.HL_ENABLED ? 'enabled' : 'disabled',
              upbit: CONFIG.UPBIT_ENABLED ? 'enabled' : 'disabled',
              bithumb: CONFIG.BITHUMB_ENABLED ? 'enabled' : 'disabled',
              binance: CONFIG.BINANCE_ENABLED ? 'enabled' : 'disabled',
              bybit: CONFIG.BYBIT_ENABLED ? 'enabled' : 'disabled',
              telegram: CONFIG.TELEGRAM_ENABLED ? 'enabled' : 'disabled'
            },
            environment: CONFIG.NODE_ENV,
            isRailway: CONFIG.IS_RAILWAY,
            port: CONFIG.PORT
          });
          break;

        default:
          sendJsonResponse(res, 404, {
            error: 'Endpoint non trouvé',
            availableEndpoints: ['/', '/health', '/ready', '/ping', '/envz', '/status']
          });
      }
    } else {
      sendJsonResponse(res, 405, {
        error: 'Méthode non autorisée',
        allowedMethods: ['GET']
      });
    }
  } catch (error) {
    console.error('❌ Erreur dans le serveur de santé:', error);
    sendJsonResponse(res, 500, {
      error: 'Erreur interne du serveur',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export function startHealthCheck() {
  try {
    // Écouter sur toutes les interfaces réseau (0.0.0.0) pour Railway
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🏥 Serveur de santé démarré sur le port ${PORT}`);
      console.log(`   📍 Endpoints disponibles:`);
      console.log(`      - GET /health - Statut de santé`);
      console.log(`      - GET /ready - Prêt à recevoir du trafic`);
      console.log(`      - GET /ping - Ping pour Railway`);
      console.log(`      - GET /envz - Configuration (si ENVZ_ENABLED=true)`);
      console.log(`      - GET /status - Statut des services`);
    });
    
    server.on('error', (error) => {
      console.error('❌ Erreur du serveur de santé:', error);
      // En cas d'erreur, essayer de redémarrer le serveur après 5 secondes
      setTimeout(() => {
        console.log('🔄 Tentative de redémarrage du serveur de santé...');
        startHealthCheck();
      }, 5000);
    });

    // Gestion propre de l'arrêt
    process.on('SIGTERM', () => {
      console.log('🛑 Arrêt du serveur de santé...');
      server.close(() => {
        console.log('✅ Serveur de santé fermé');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 Arrêt du serveur de santé...');
      server.close(() => {
        console.log('✅ Serveur de santé fermé');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Échec du démarrage du serveur de santé:', error);
    // En cas d'erreur fatale, redémarrer après 10 secondes
    setTimeout(() => {
      console.log('🔄 Tentative de redémarrage après erreur fatale...');
      startHealthCheck();
    }, 10000);
  }
} 