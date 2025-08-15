#!/usr/bin/env ts-node

import { TokenRegistry } from '../store/TokenRegistry';
import { TelegramService } from '../notify/TelegramService';
import { BithumbNoticePoller } from '../watchers/BithumbNoticePoller';
import { Database } from 'sqlite3';

async function simulateNotice() {
  console.log('🚀 Simulation du NoticePoller...');
  
  try {
    // Créer une base de données temporaire
    const db = new Database(':memory:');
    
    // Initialiser le TokenRegistry
    const tokenRegistry = new TokenRegistry(db);
    await tokenRegistry.initialize();
    
    // Créer un TelegramService mock
    const telegramService = new TelegramService({
      botToken: 'mock-token',
      chatId: 'mock-chat'
    });
    
    // Créer le poller avec la nouvelle signature
    const poller = new BithumbNoticePoller(
      tokenRegistry, 
      telegramService,
      {
        pollIntervalMs: 5000,
        maxNoticesPerPoll: 5,
        enableTelegram: true,
        enableLogging: true
      }
    );
    
    console.log('✅ NoticePoller créé avec succès');
    
    // Simuler une notice
    const mockNotice = {
      eventId: 'mock-event-123',
      base: 'TEST',
      title: 'Test Notice',
      url: 'https://test.com',
      publishedAtUtc: new Date().toISOString(),
      priority: 'high' as const,
      status: 'live' as const,
      source: 'bithumb.api' as const
    };
    
    // Tester le traitement de la notice
    await poller['processNotice'](mockNotice);
    
    console.log('✅ Simulation terminée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la simulation:', error);
  }
}

// Lancer la simulation
simulateNotice().catch(console.error);
