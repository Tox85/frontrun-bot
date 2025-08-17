#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const StructuredLogger_1 = require("../core/StructuredLogger");
async function fixRailwayDeployment() {
    console.log('🔧 Correction du déploiement Railway...\n');
    const logger = new StructuredLogger_1.StructuredLogger(StructuredLogger_1.LogLevel.INFO);
    const dbPath = process.env.DATABASE_PATH || './data/bot.db';
    try {
        // 1. Ouvrir la base de données
        console.log('🗄️  Ouverture de la base de données...');
        const db = new sqlite3_1.Database(dbPath);
        // 2. Créer la table watermarks si elle n'existe pas
        console.log('📋 Création de la table watermarks...');
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
        // 3. Créer les index
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
        // 4. Insérer les watermarks par défaut
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
        // 5. Vérifier que la table existe
        console.log('✅ Vérification de la table watermarks...');
        await new Promise((resolve, reject) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='watermarks'", (err, row) => {
                if (err)
                    reject(err);
                else if (row) {
                    console.log('✅ Table watermarks créée avec succès');
                    resolve();
                }
                else {
                    reject(new Error('Table watermarks non trouvée'));
                }
            });
        });
        // 6. Vérifier le contenu
        console.log('📊 Vérification du contenu...');
        await new Promise((resolve, reject) => {
            db.all('SELECT * FROM watermarks', (err, rows) => {
                if (err)
                    reject(err);
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
    }
    catch (error) {
        console.error('❌ Erreur lors de la correction:', error);
        logger.error('Correction Railway échouée', error);
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
fixRailwayDeployment().catch(console.error);
//# sourceMappingURL=fix-railway-deployment.js.map