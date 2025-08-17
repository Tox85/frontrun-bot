#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const StructuredLogger_1 = require("../core/StructuredLogger");
async function emergencyRailwayFix() {
    console.log('🚨 Correction d\'urgence Railway...\n');
    const logger = new StructuredLogger_1.StructuredLogger(StructuredLogger_1.LogLevel.INFO);
    const dbPath = process.env.DATABASE_PATH || './data/bot.db';
    try {
        // 1. Ouvrir la base de données
        console.log('🗄️  Ouverture de la base de données...');
        const db = new sqlite3_1.Database(dbPath);
        // 2. Créer la table migrations si elle n'existe pas
        console.log('📋 Création de la table migrations...');
        await new Promise((resolve, reject) => {
            db.run(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at_utc TEXT NOT NULL
        )
      `, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        // 3. Créer la table watermarks
        console.log('💧 Création de la table watermarks...');
        await new Promise((resolve, reject) => {
            db.run(`
        CREATE TABLE IF NOT EXISTS watermarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          base TEXT NOT NULL,
          watermark TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(source, base)
        )
      `, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        // 4. Créer les index
        console.log('🔍 Création des index...');
        await new Promise((resolve, reject) => {
            db.run('CREATE INDEX IF NOT EXISTS idx_watermarks_source_base ON watermarks(source, base)', (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        await new Promise((resolve, reject) => {
            db.run('CREATE INDEX IF NOT EXISTS idx_watermarks_timestamp ON watermarks(timestamp)', (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        // 5. Insérer les watermarks par défaut
        console.log('💧 Insertion des watermarks par défaut...');
        await new Promise((resolve, reject) => {
            db.run(`
        INSERT OR IGNORE INTO watermarks (source, base, watermark, timestamp) VALUES
        ('bithumb.notice', 'KRW', '0', 0),
        ('bithumb.websocket', 'KRW', '0', 0)
      `, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        // 6. Nettoyer les migrations en conflit
        console.log('🧹 Nettoyage des migrations en conflit...');
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM _migrations WHERE version IN (?, ?)', ['003', '009'], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        // 7. Réinsérer les migrations dans l'ordre correct
        console.log('📝 Réinsertion des migrations...');
        const migrations = [
            ['001', 'Initial database schema', '001_initial_schema.sql'],
            ['002', 'Add baseline table', '002_add_baseline_table.sql'],
            ['003', 'Add events table', '003_add_events_table.sql'],
            ['004', 'Add perp catalog table', '004_add_perp_catalog_table.sql'],
            ['005', 'Add trades table', '005_add_trades_table.sql'],
            ['006', 'Add exits table', '006_add_exits_table.sql'],
            ['007', 'Add singleton guard table', '007_add_singleton_guard_table.sql'],
            ['008', 'Add processed events table', '008_add_processed_events_table.sql'],
            ['009', 'Add performance metrics table', '009_add_performance_metrics_table.sql'],
            ['010', 'Perp catalog upsert', '010_perp_catalog_upsert.sql'],
            ['011', 'Create watermarks table', '011_create_watermarks_table.sql'],
            ['012', 'Fix migration system', '012_fix_migration_system.sql']
        ];
        for (const [version, description, filename] of migrations) {
            await new Promise((resolve, reject) => {
                db.run(`
          INSERT OR IGNORE INTO _migrations (version, description, filename, applied_at) 
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [version, description, filename], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        // 8. Vérification finale
        console.log('✅ Vérification finale...');
        await new Promise((resolve, reject) => {
            db.all('SELECT id, name FROM _migrations ORDER BY id', (err, rows) => {
                if (err)
                    reject(err);
                else {
                    console.log(`✅ ${rows.length} migrations enregistrées:`, rows.map((r) => r.id));
                    resolve();
                }
            });
        });
        // 9. Fermer la base de données
        db.close();
        console.log('🔒 Base de données fermée');
        console.log('\n🎉 Correction d\'urgence terminée avec succès !');
        console.log('🔄 Redémarrez maintenant votre application sur Railway');
    }
    catch (error) {
        console.error('❌ Erreur lors de la correction d\'urgence:', error);
        logger.error('Correction d\'urgence Railway échouée', error);
        process.exit(1);
    }
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
// Lancer la correction
emergencyRailwayFix().catch(console.error);
//# sourceMappingURL=emergency-railway-fix.js.map