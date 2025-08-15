#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { MigrationRunner } from '../store/Migrations';
import * as path from 'path';

async function runMigrations(): Promise<void> {
  console.log('🔄 Script de migration SQLite');
  
  try {
    // Chemin de la base de données
    const dbPath = process.env.SQLITE_PATH || './data/bot.db';
    const migrationsPath = path.join(process.cwd(), 'migrations');
    
    console.log(`🗄️ Base de données: ${dbPath}`);
    console.log(`📁 Dossier migrations: ${migrationsPath}`);
    
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(dbPath);
    await import('fs').then(fs => {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`📁 Dossier créé: ${dataDir}`);
      }
    });
    
    // Ouvrir la base de données
    const db = new Database(dbPath);
    
    // Créer le runner de migrations
    const migrationRunner = new MigrationRunner(db, migrationsPath);
    
    // Exécuter les migrations
    await migrationRunner.runMigrations();
    
    // Afficher le statut final
    const status = await migrationRunner.getMigrationStatus();
    console.log('\n📊 Statut final des migrations:');
    console.log(`  Total: ${status.total}`);
    console.log(`  Appliquées: ${status.applied}`);
    console.log(`  En attente: ${status.pending}`);
    if (status.lastApplied) {
      console.log(`  Dernière: ${status.lastApplied}`);
    }
    
    // Fermer la base de données
    db.close();
    
    console.log('\n✅ Migrations terminées avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors des migrations:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  runMigrations();
}
