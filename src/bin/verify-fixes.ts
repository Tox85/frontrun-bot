#!/usr/bin/env ts-node

import { Database } from 'sqlite3';
import { join } from 'path';

async function verifyFixes(): Promise<void> {
  console.log('🔍 Vérification des corrections...');
  
  const dbPath = join(process.cwd(), 'data', 'bot.db');
  const db = new Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(perp_catalog)", (err, columns: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      
      const hasLeverageMax = columns.some((col: any) => col.name === 'leverage_max');
      console.log(hasLeverageMax ? '✅ leverage_max présent' : '❌ leverage_max manquant');
      
      resolve();
    });
  });
}

if (require.main === module) {
  verifyFixes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erreur:', error);
      process.exit(1);
    });
}

export { verifyFixes };
