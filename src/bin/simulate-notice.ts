#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { NoticeClient } from '../watchers/NoticeClient';
import { TelegramService } from '../notify/TelegramService';
import { BaselineManager } from '../core/BaselineManager';
import { MigrationRunner } from '../store/Migrations';

async function simulateNotice() {
  console.log('🚀 Simulation du NoticeClient...');
  
  try {
    // Créer une base de données temporaire
    const db = new Database(':memory:');
    
    // Exécuter les migrations
    const migrationRunner = new MigrationRunner(db);
    await migrationRunner.runMigrations();
    console.log('✅ Migrations exécutées');
    
    // Initialiser le BaselineManager
    const baselineManager = new BaselineManager(db);
    await baselineManager.initialize();
    console.log('✅ BaselineManager initialisé');
    
    // Créer un TelegramService mock
    const telegramService = new TelegramService({
      botToken: 'mock-token',
      chatId: 'mock-chat'
    });
    
    // Créer le NoticeClient
    const noticeClient = new NoticeClient();
    console.log('✅ NoticeClient créé avec succès');
    
    // Simuler une notice
    const mockNotice = {
      id: Date.now(),
      title: '원화 마켓 신규 상장: TEST',
      categories: ['공지', '마켓'],
      pc_url: 'https://test.com',
      published_at: new Date().toISOString()
    };
    
    // Tester le traitement de la notice
    const processed = noticeClient.processNotice(mockNotice);
    
    if (processed) {
      console.log('✅ Notice traitée avec succès:', {
        base: processed.base,
        eventId: processed.eventId,
        priority: processed.priority,
        source: processed.source
      });
      
      // Vérifier si c'est un nouveau token
      const isNew = await baselineManager.isTokenNew(processed.base);
      console.log(`🔍 Token ${processed.base} est nouveau: ${isNew}`);
      
      if (isNew) {
        // Enregistrer l'événement
        await db.run(
          'INSERT OR IGNORE INTO processed_events (event_id, base, source, url, created_at_utc) VALUES (?, ?, ?, ?, datetime("now"))',
          [processed.eventId, processed.base, processed.source, processed.url]
        );
        console.log('✅ Événement enregistré en DB');
        
        // Notification Telegram
        await telegramService.sendMessage(
          `🧪 **SIMULATION NOTICE** 🧪\n\n**Token:** \`${processed.base}\`\n**Title:** ${processed.title}\n**Source:** ${processed.source}`
        );
        console.log('✅ Notification Telegram envoyée');
      }
    } else {
      console.log('⚠️ Notice non traitée (pas un listing)');
    }
    
    console.log('✅ Simulation terminée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la simulation:', error);
  }
}

// Lancer la simulation
simulateNotice().catch(console.error);
