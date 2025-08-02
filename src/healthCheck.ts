import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Fonction pour vérifier l'état de l'application
function getHealthStatus() {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Frontrun Bot',
    version: '1.0.0',
    uptime: uptime,
    memory: {
      rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memory.external / 1024 / 1024) + ' MB'
    },
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    pid: process.pid
  };

  // Vérifier si l'application fonctionne correctement
  if (uptime < 5) {
    healthStatus.status = 'STARTING';
  }

  return healthStatus;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/' || req.url === '/health') {
    const healthData = getHealthStatus();
    const statusCode = healthData.status === 'OK' ? 200 : 503;
    
    res.writeHead(statusCode);
    res.end(JSON.stringify(healthData, null, 2));
  } else if (req.url === '/ready') {
    // Endpoint pour vérifier si l'application est prête
    const uptime = process.uptime();
    if (uptime > 10) { // L'application est prête après 10 secondes
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'READY', uptime }));
    } else {
      res.writeHead(503);
      res.end(JSON.stringify({ status: 'STARTING', uptime }));
    }
  } else if (req.url === '/ping') {
    // Endpoint simple pour les tests rapides
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'PONG', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

export function startHealthCheck() {
  try {
    // Écouter sur toutes les interfaces réseau (0.0.0.0) pour Railway
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🏥 Health check server running on port ${PORT}`);
      console.log(`🌐 Health check available at: http://0.0.0.0:${PORT}/health`);
      console.log(`✅ Ready check available at: http://0.0.0.0:${PORT}/ready`);
      console.log(`🏓 Ping check available at: http://0.0.0.0:${PORT}/ping`);
    });
    
    server.on('error', (error) => {
      console.error('❌ Health check server error:', error);
      // En cas d'erreur, essayer de redémarrer le serveur après 5 secondes
      setTimeout(() => {
        console.log('🔄 Attempting to restart health check server...');
        startHealthCheck();
      }, 5000);
    });

    // Gestion propre de l'arrêt
    process.on('SIGTERM', () => {
      console.log('🛑 Shutting down health check server...');
      server.close(() => {
        console.log('✅ Health check server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 Shutting down health check server...');
      server.close(() => {
        console.log('✅ Health check server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start health check server:', error);
    // En cas d'erreur fatale, redémarrer après 10 secondes
    setTimeout(() => {
      console.log('🔄 Attempting to restart health check server after fatal error...');
      startHealthCheck();
    }, 10000);
  }
} 