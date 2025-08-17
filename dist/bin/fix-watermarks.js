"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const fs_1 = require("fs");
const path_1 = require("path");
async function fixWatermarks() {
    console.log('🔧 Fixing watermarks table...');
    const db = new sqlite3_1.Database('./data/bot.db');
    try {
        // Lire et exécuter la migration watermarks
        const migrationPath = (0, path_1.join)(__dirname, '../../migrations/009_add_watermark_table.sql');
        const migrationSQL = (0, fs_1.readFileSync)(migrationPath, 'utf8');
        console.log('📁 Executing watermark migration...');
        await db.exec(migrationSQL);
        console.log('✅ Watermarks table created successfully');
        // Vérifier que la table existe
        const result = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='watermarks'");
        if (result) {
            console.log('✅ Table watermarks verified');
        }
        else {
            console.log('❌ Table watermarks not found');
        }
    }
    catch (error) {
        console.error('❌ Error fixing watermarks:', error);
    }
    finally {
        db.close();
    }
}
fixWatermarks().catch(console.error);
//# sourceMappingURL=fix-watermarks.js.map