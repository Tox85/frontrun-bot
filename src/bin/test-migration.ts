#!/usr/bin/env ts-node

import sqlite3 from 'sqlite3';
import path from 'path';

interface ColumnInfo {
  name: string;
  type: string;
}

interface PerpCatalogRow {
  exchange: string;
  base: string;
  symbol: string;
  leverage_max?: number;
  updated_at_utc: string;
}

async function testMigration(): Promise<void> {
  console.log('🧪 Testing migration 009: add_leverage_max...');
  
  // Créer une base de test temporaire
  const dbPath = path.join(__dirname, '../../data/test-migration.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('📋 Applying final schema...');
      
      // Appliquer le schéma final (sans leverage_max)
      db.run(`
        CREATE TABLE IF NOT EXISTS perp_catalog (
          exchange TEXT NOT NULL,
          base TEXT NOT NULL,
          symbol TEXT NOT NULL,
          updated_at_utc TEXT NOT NULL,
          PRIMARY KEY (exchange, base)
        );
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('📝 Inserting test data...');
        
        // Insérer quelques données de test
        db.run(`
          INSERT INTO perp_catalog (exchange, base, symbol, updated_at_utc) VALUES 
          ('BYBIT', 'BTC', 'BTCUSDT', '2025-01-15T00:00:00Z'),
          ('HYPERLIQUID', 'ETH', 'ETH-USD', '2025-01-15T00:00:00Z');
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          console.log('🔍 Schema before migration:');
          
          // Vérifier le schéma avant migration
          db.all("PRAGMA table_info(perp_catalog)", (err, beforeColumns: ColumnInfo[]) => {
            if (err) {
              reject(err);
              return;
            }
            
            beforeColumns.forEach((col: ColumnInfo) => {
              console.log(`  - ${col.name}: ${col.type}`);
            });
            
            console.log('\n🔄 Applying migration 009...');
            
            // Appliquer la migration 009
            db.run(`
              ALTER TABLE perp_catalog ADD COLUMN leverage_max REAL DEFAULT 100;
              UPDATE perp_catalog SET leverage_max = 100 WHERE leverage_max IS NULL;
            `, (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              console.log('\n🔍 Schema after migration:');
              
              // Vérifier le schéma après migration
              db.all("PRAGMA table_info(perp_catalog)", (err, afterColumns: ColumnInfo[]) => {
                if (err) {
                  reject(err);
                  return;
                }
                
                afterColumns.forEach((col: ColumnInfo) => {
                  console.log(`  - ${col.name}: ${col.type}`);
                });
                
                console.log('\n📊 Data after migration:');
                
                // Vérifier les données
                db.all("SELECT * FROM perp_catalog", (err, data: PerpCatalogRow[]) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  data.forEach((row: PerpCatalogRow) => {
                    console.log(`  - ${row.exchange}/${row.base}: leverage_max = ${row.leverage_max}`);
                  });
                  
                  console.log('\n🧪 Testing INSERT with leverage_max...');
                  
                  // Test d'insertion avec leverage_max
                  db.run(`
                    INSERT OR REPLACE INTO perp_catalog (exchange, base, symbol, leverage_max, updated_at_utc) 
                    VALUES ('BINANCE', 'SOL', 'SOLUSDT', 50, '2025-01-15T00:00:00Z');
                  `, (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    
                    db.get("SELECT * FROM perp_catalog WHERE exchange = 'BINANCE'", (err, newData: PerpCatalogRow) => {
                      if (err) {
                        reject(err);
                        return;
                      }
                      
                      console.log(`  ✅ New record: ${newData.exchange}/${newData.base}, leverage_max = ${newData.leverage_max}`);
                      console.log('\n✅ Migration 009 test completed successfully!');
                      
                      db.close((err) => {
                        if (err) {
                          console.warn('Warning: could not close database:', err);
                        }
                        
                        // Nettoyer le fichier de test
                        try {
                          require('fs').unlinkSync(dbPath);
                        } catch (e) {
                          // Ignore si le fichier n'existe pas
                        }
                        
                        resolve();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

if (require.main === module) {
  testMigration().catch(console.error);
}
