#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFixes = verifyFixes;
const sqlite3_1 = require("sqlite3");
const path_1 = require("path");
async function verifyFixes() {
    console.log('🔍 Vérification des corrections...');
    const dbPath = (0, path_1.join)(process.cwd(), 'data', 'bot.db');
    const db = new sqlite3_1.Database(dbPath);
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(perp_catalog)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            const hasLeverageMax = columns.some((col) => col.name === 'leverage_max');
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
//# sourceMappingURL=verify-fixes.js.map