#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixPerpCatalog = fixPerpCatalog;
const sqlite3_1 = require("sqlite3");
const path_1 = require("path");
async function fixPerpCatalog() {
    console.log('🔧 Correction du schéma perp_catalog...');
    const dbPath = (0, path_1.join)(process.cwd(), 'data', 'bot.db');
    const db = new sqlite3_1.Database(dbPath);
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Vérifier le schéma actuel
            db.all("PRAGMA table_info(perp_catalog)", (err, columns) => {
                if (err) {
                    console.error('❌ Erreur lors de la vérification du schéma:', err);
                    reject(err);
                    return;
                }
                console.log('📋 Schéma actuel de perp_catalog:');
                columns.forEach((col) => {
                    console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
                });
                const hasLeverageMax = columns.some((col) => col.name === 'leverage_max');
                if (hasLeverageMax) {
                    console.log('✅ Colonne leverage_max déjà présente!');
                    resolve();
                    return;
                }
                console.log('❌ Colonne leverage_max manquante - ajout en cours...');
                // Ajouter la colonne leverage_max
                db.run('ALTER TABLE perp_catalog ADD COLUMN leverage_max REAL DEFAULT 100', (err) => {
                    if (err) {
                        console.error('❌ Erreur lors de l\'ajout de la colonne leverage_max:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ Colonne leverage_max ajoutée!');
                    // Mettre à jour les enregistrements existants
                    db.run('UPDATE perp_catalog SET leverage_max = 100 WHERE leverage_max IS NULL', (err) => {
                        if (err) {
                            console.error('❌ Erreur lors de la mise à jour des enregistrements:', err);
                            reject(err);
                            return;
                        }
                        console.log('✅ Enregistrements existants mis à jour avec leverage_max = 100');
                        // Vérifier le nouveau schéma
                        db.all("PRAGMA table_info(perp_catalog)", (err, newColumns) => {
                            if (err) {
                                console.error('❌ Erreur lors de la vérification du nouveau schéma:', err);
                                reject(err);
                                return;
                            }
                            console.log('\n📋 Nouveau schéma de perp_catalog:');
                            newColumns.forEach((col) => {
                                console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
                            });
                            // Test d'insertion
                            const testData = {
                                exchange: 'TEST',
                                base: 'TEST',
                                symbol: 'TESTUSDT',
                                leverageMax: 50,
                                updatedAt: new Date().toISOString()
                            };
                            db.run('INSERT OR REPLACE INTO perp_catalog (exchange, base, symbol, leverage_max, updated_at_utc) VALUES (?, ?, ?, ?, ?)', [testData.exchange, testData.base, testData.symbol, testData.leverageMax, testData.updatedAt], function (err) {
                                if (err) {
                                    console.error('❌ Test d\'insertion échoué:', err);
                                    reject(err);
                                    return;
                                }
                                console.log('✅ Test d\'insertion réussi!');
                                // Nettoyer le test
                                db.run('DELETE FROM perp_catalog WHERE exchange = ?', ['TEST'], (err) => {
                                    if (err) {
                                        console.error('⚠️ Erreur lors du nettoyage du test:', err);
                                    }
                                    else {
                                        console.log('🧹 Données de test nettoyées');
                                    }
                                    console.log('\n🎉 Schéma perp_catalog corrigé avec succès!');
                                    resolve();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}
// Exécuter si appelé directement
if (require.main === module) {
    fixPerpCatalog()
        .then(() => {
        console.log('✅ Script terminé avec succès');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Script échoué:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=fix-perp-catalog.js.map