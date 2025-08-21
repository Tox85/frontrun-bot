#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { StructuredLogger, LogLevel } from '../core/StructuredLogger';

async function fixRailwayDeployment() {
  console.log('🔧 Correction du déploiement Railway...\n');

  const logger = new StructuredLogger(LogLevel.INFO);
  const dbPath = process.env.DATABASE_PATH || './data/bot.db';

  try {
    // 1. Ouvrir la base de données
    console.log('🗄️  Ouverture de la base de données...');
    const db = new Database(dbPath);

    // 2. Créer la table watermarks si elle n'existe pas (schéma corrigé)
    console.log('📋 Création de la table watermarks...');
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS watermarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          last_published_at INTEGER NOT NULL DEFAULT 0,
          last_notice_uid TEXT,
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          UNIQUE(source)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 3. Créer les index (schéma corrigé)
    console.log('🔍 Création des index...');
    await new Promise<void>((resolve, reject) => {
      db.run('CREATE INDEX IF NOT EXISTS idx_watermarks_source ON watermarks(source)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      db.run('CREATE INDEX IF NOT EXISTS idx_watermarks_last_published ON watermarks(last_published_at)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 4. Insérer les watermarks par défaut (schéma corrigé)
    console.log('💧 Insertion des watermarks par défaut...');
    await new Promise<void>((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO watermarks (source, last_published_at, last_notice_uid, updated_at) VALUES
        ('bithumb.notice', 0, NULL, strftime('%s', 'now')),
        ('bithumb.websocket', 0, NULL, strftime('%s', 'now'))
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 5. Vérifier que la table existe
    console.log('✅ Vérification de la table watermarks...');
    await new Promise<void>((resolve, reject) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='watermarks'", (err, row) => {
        if (err) reject(err);
        else if (row) {
          console.log('✅ Table watermarks créée avec succès');
          resolve();
        } else {
          reject(new Error('Table watermarks non trouvée'));
        }
      });
    });

    // 6. Vérifier le contenu
    console.log('📊 Vérification du contenu...');
    await new Promise<void>((resolve, reject) => {
      db.all('SELECT * FROM watermarks', (err, rows) => {
        if (err) reject(err);
        else {
          console.log(`✅ ${rows.length} watermarks trouvés:`, rows);
          resolve();
        }
      });
    });

    // 7. Fermer la base de données
    db.close();
    console.log('🔒 Base de données fermée');

    console.log('\n🎉 Correction Railway terminée avec succès !');
    console.log('🔄 Redémarrez maintenant votre application sur Railway');

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    process.exit(1);
  }
}

// Lancer la correction
fixRailwayDeployment().catch(console.error);
