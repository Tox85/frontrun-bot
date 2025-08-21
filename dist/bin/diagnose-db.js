#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
async function diagnoseDatabase() {
    console.log('🔍 Diagnostic de la base de données...');
    try {
        const dbPath = './data/bot.db';
        const db = new sqlite3_1.Database(dbPath);
        // Vérifier les tables existantes
        console.log('\n📋 Tables existantes:');
        await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                if (err)
                    reject(err);
                else {
                    rows.forEach(row => console.log(`  - ${row.name}`));
                    resolve();
                }
            });
        });
        // Vérifier la table _migrations
        console.log('\n📊 État des migrations:');
        await new Promise((resolve, reject) => {
            db.all("SELECT id, name, applied_at_utc FROM _migrations ORDER BY id", (err, rows) => {
                if (err) {
                    console.log('  ❌ Table _migrations non accessible:', err.message);
                    resolve();
                }
                else {
                    rows.forEach(row => console.log(`  - ${row.id}: ${row.name} (${row.applied_at_utc})`));
                    resolve();
                }
            });
        });
        // Vérifier la structure de perp_catalog
        console.log('\n🏗️ Structure de perp_catalog:');
        await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(perp_catalog)", (err, rows) => {
                if (err) {
                    console.log('  ❌ Table perp_catalog non accessible:', err.message);
                    resolve();
                }
                else {
                    rows.forEach(row => console.log(`  - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : 'NULL'}`));
                    resolve();
                }
            });
        });
        db.close();
        console.log('\n✅ Diagnostic terminé');
    }
    catch (error) {
        console.error('❌ Erreur lors du diagnostic:', error);
    }
}
// Exécuter le diagnostic
diagnoseDatabase().catch(console.error);
//# sourceMappingURL=diagnose-db.js.map