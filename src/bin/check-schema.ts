#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import path from 'path';

async function checkSchema(): Promise<void> {
  console.log('🔍 Vérification du schéma de la base de données');
  
  try {
    const dbPath = process.env.SQLITE_PATH || './data/bot.db';
    const db = new Database(dbPath);
    
    console.log(`🗄️ Base de données: ${path.resolve(dbPath)}`);
    
    // Vérifier si la table processed_events existe
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='processed_events'", (err, row) => {
      if (err) {
        console.error('❌ Erreur lors de la vérification:', err);
        return;
      }
      
      if (row) {
        console.log('✅ Table processed_events existe');
        
        // Vérifier le schéma
        db.all("PRAGMA table_info(processed_events)", (err, columns) => {
          if (err) {
            console.error('❌ Erreur lors de la vérification du schéma:', err);
            return;
          }
          
          console.log('\n📋 Schéma de processed_events:');
          columns?.forEach((col: any) => {
            console.log(`  ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
          });
          
          // Vérifier les index
          db.all("PRAGMA index_list(processed_events)", (err, indexes) => {
            if (err) {
              console.error('❌ Erreur lors de la vérification des index:', err);
              return;
            }
            
                      console.log('\n🔗 Index de processed_events:');
          indexes?.forEach((idx: any) => {
            console.log(`  ${idx.name} (${idx.unique ? 'UNIQUE' : 'NON-UNIQUE'})`);
          });
            
            db.close();
          });
        });
      } else {
        console.log('❌ Table processed_events n\'existe pas');
        
        // Lister toutes les tables
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
          if (err) {
            console.error('❌ Erreur lors de la liste des tables:', err);
            return;
          }
          
          console.log('\n📋 Tables existantes:');
          tables?.forEach((table: any) => {
            console.log(`  ${table.name}`);
          });
          
          db.close();
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

if (require.main === module) {
  checkSchema();
}
