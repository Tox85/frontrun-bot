const WebSocket = require('ws');

console.log('🧪 Test simple WebSocket Hyperliquid...');

const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

ws.on('open', () => {
  console.log('✅ Connexion établie');
  
  // Test simple d'abonnement
  const msg = {
    id: 1,
    method: 'subscribe',
    params: {
      channels: ['trades']
    }
  };
  
  console.log('📡 Envoi:', JSON.stringify(msg));
  ws.send(JSON.stringify(msg));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    console.log('📨 Reçu:', JSON.stringify(msg, null, 2));
  } catch (error) {
    console.log('📨 Reçu (raw):', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ Erreur:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Fermé: ${code} - ${reason.toString()}`);
});

setTimeout(() => {
  console.log('⏰ Timeout');
  ws.close();
}, 10000); 