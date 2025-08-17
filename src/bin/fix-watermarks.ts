import { Database } from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

async function fixWatermarks() {
  console.log('🔧 Fixing watermarks table...');
  
  const db = new Database('./data/bot.db');
  
  try {
    // Lire et exécuter la migration watermarks
    const migrationPath = join(__dirname, '../../migrations/009_add_watermark_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📁 Executing watermark migration...');
    await db.exec(migrationSQL);
    
    console.log('✅ Watermarks table created successfully');
    
    // Vérifier que la table existe
    const result = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='watermarks'");
    if (result) {
      console.log('✅ Table watermarks verified');
    } else {
      console.log('❌ Table watermarks not found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing watermarks:', error);
  } finally {
    db.close();
  }
}

fixWatermarks().catch(console.error);
