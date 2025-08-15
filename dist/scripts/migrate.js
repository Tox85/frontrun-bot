#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const Migrations_1 = require("../store/Migrations");
const path = __importStar(require("path"));
async function runMigrations() {
    console.log('🔄 Script de migration SQLite');
    try {
        // Chemin de la base de données
        const dbPath = process.env.SQLITE_PATH || './data/bot.db';
        const migrationsPath = path.join(process.cwd(), 'migrations');
        console.log(`🗄️ Base de données: ${dbPath}`);
        console.log(`📁 Dossier migrations: ${migrationsPath}`);
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.dirname(dbPath);
        await import('fs').then(fs => {
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log(`📁 Dossier créé: ${dataDir}`);
            }
        });
        // Ouvrir la base de données
        const db = new sqlite3_1.Database(dbPath);
        // Créer le runner de migrations
        const migrationRunner = new Migrations_1.MigrationRunner(db, migrationsPath);
        // Exécuter les migrations
        await migrationRunner.runMigrations();
        // Afficher le statut final
        const status = await migrationRunner.getMigrationStatus();
        console.log('\n📊 Statut final des migrations:');
        console.log(`  Total: ${status.total}`);
        console.log(`  Appliquées: ${status.applied}`);
        console.log(`  En attente: ${status.pending}`);
        if (status.lastApplied) {
            console.log(`  Dernière: ${status.lastApplied}`);
        }
        // Fermer la base de données
        db.close();
        console.log('\n✅ Migrations terminées avec succès');
    }
    catch (error) {
        console.error('❌ Erreur lors des migrations:', error);
        process.exit(1);
    }
}
// Exécuter si appelé directement
if (require.main === module) {
    runMigrations();
}
//# sourceMappingURL=migrate.js.map