import WebSocket from 'ws';
import { HYPERLIQUID_CONFIG } from './hyperliquidConfig';

// Test simple de connexion WebSocket Hyperliquid
export async function testHyperliquidWebSocket(): Promise<void> {
  console.log('🧪 Test de connexion WebSocket Hyperliquid...');
  
  const ws = new WebSocket(HYPERLIQUID_CONFIG.wsUrl, {
    handshakeTimeout: 10000,
    perMessageDeflate: false,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout de connexion'));
    }, 10000);

    ws.on('open', () => {
      console.log('✅ Connexion WebSocket établie');
      
      // Test d'abonnement
      const subscribeMessage = {
        method: 'subscribe',
        params: {
          channels: ['allMids']
        }
      };
      
      ws.send(JSON.stringify(subscribeMessage));
      console.log('📡 Message d\'abonnement envoyé');
    });

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        console.log('📨 Message reçu:', message.type || 'unknown');
        
        if (message.type === 'subscribed') {
          console.log('✅ Abonnement confirmé');
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      } catch (error) {
        console.error('❌ Erreur parsing message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Erreur WebSocket:', error);
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket fermé (code: ${code}, raison: ${reason.toString()})`);
      clearTimeout(timeout);
      resolve();
    });
  });
}

// Test de heartbeat
export async function testHeartbeat(): Promise<void> {
  console.log('💓 Test de heartbeat...');
  
  const ws = new WebSocket(HYPERLIQUID_CONFIG.wsUrl);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout heartbeat'));
    }, 15000);

    ws.on('open', () => {
      console.log('✅ Connexion établie pour test heartbeat');
      
      // Envoyer un heartbeat
      const heartbeatMessage = {
        method: 'ping',
        params: {
          timestamp: Date.now()
        }
      };
      
      ws.send(JSON.stringify(heartbeatMessage));
      console.log('💓 Heartbeat envoyé');
    });

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        console.log('📨 Réponse heartbeat:', message.type || 'unknown');
        
        if (message.type === 'pong') {
          console.log('✅ Heartbeat validé');
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      } catch (error) {
        console.error('❌ Erreur parsing réponse heartbeat:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Erreur test heartbeat:', error);
      clearTimeout(timeout);
      reject(error);
    });
  });
} 