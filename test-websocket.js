const WebSocket = require('ws');

console.log('🧪 Test de connexion WebSocket Hyperliquid...');

const ws = new WebSocket('wss://api.hyperliquid.xyz/ws', {
  handshakeTimeout: 10000,
  perMessageDeflate: false,
});

let messageCount = 0;

ws.on('open', () => {
  console.log('✅ Connexion WebSocket établie');
  
  // Test d'abonnement selon la vraie API Hyperliquid
  const subscribeMessage = {
    id: 1,
    method: 'subscribe',
    params: {
      channels: ['trades']
    }
  };
  
  ws.send(JSON.stringify(subscribeMessage));
  console.log('📡 Message d\'abonnement envoyé');
  
  // Envoyer un heartbeat après 5 secondes
  setTimeout(() => {
    const heartbeatMessage = {
      id: 2,
      method: 'ping'
    };
    
    ws.send(JSON.stringify(heartbeatMessage));
    console.log('💓 Heartbeat envoyé');
  }, 5000);
});

ws.on('message', (data) => {
  messageCount++;
  try {
    const message = JSON.parse(data);
    console.log(`📨 Message ${messageCount}:`, JSON.stringify(message, null, 2));
    
    if (message.result === 'subscribed') {
      console.log('✅ Abonnement confirmé');
    }
    
    if (message.result === 'pong') {
      console.log('✅ Heartbeat validé');
    }
    
    // Arrêter après 10 messages ou 30 secondes
    if (messageCount >= 10) {
      console.log('✅ Test terminé avec succès');
      ws.close();
    }
  } catch (error) {
    console.error('❌ Erreur parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ Erreur WebSocket:', error);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket fermé (code: ${code}, raison: ${reason.toString()})`);
  console.log(`📊 Total messages reçus: ${messageCount}`);
});

// Timeout de sécurité
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('⏰ Timeout - fermeture de la connexion');
    ws.close();
  }
}, 30000); 