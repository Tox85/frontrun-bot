#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const EventStore_1 = require("../core/EventStore");
const path_1 = __importDefault(require("path"));
async function main() {
    const dbPath = process.env.DATABASE_PATH || './data/bot.db';
    console.log(`🗄️ Database: ${path_1.default.resolve(dbPath)}`);
    const db = new sqlite3_1.Database(dbPath);
    const eventStore = new EventStore_1.EventStore(db);
    try {
        console.log('\n📊 === STATISTIQUES DÉDUPLICATION ===');
        // Statistiques générales
        const stats = await eventStore.getDedupStats();
        console.log(`Total events: ${stats.total}`);
        console.log('\n📈 Par source:');
        for (const source of stats.bySource) {
            console.log(`  ${source.source}: ${source.count}`);
        }
        console.log('\n🏷️ Par base (top 10):');
        const topBases = stats.byBase
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        for (const base of topBases) {
            console.log(`  ${base.base}: ${base.count}`);
        }
        console.log('\n🕒 === ÉVÉNEMENTS RÉCENTS ===');
        // Événements récents
        const recentEvents = await eventStore.getRecentEvents(10);
        console.log(`Derniers 10 événements:`);
        for (const event of recentEvents) {
            const time = new Date(event.detected_at_readable).toLocaleString();
            console.log(`  [${time}] ${event.source} | ${event.base || 'N/A'} | ${event.event_id.substring(0, 8)}...`);
        }
        console.log('\n🔍 === SCHÉMA BASE ===');
        // Schéma de la base
        const tables = await new Promise((resolve, reject) => {
            db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
        console.log('Tables:');
        for (const table of tables) {
            console.log(`  ${table.name}`);
        }
        const indexes = await new Promise((resolve, reject) => {
            db.all("SELECT name, sql FROM sqlite_master WHERE type='index'", (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
        console.log('\nIndexes:');
        for (const index of indexes) {
            console.log(`  ${index.name}`);
        }
        // PRAGMAs
        const pragmas = await Promise.all([
            new Promise((resolve, reject) => {
                db.get("PRAGMA journal_mode", (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.journal_mode || 'unknown');
                });
            }),
            new Promise((resolve, reject) => {
                db.get("PRAGMA synchronous", (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.synchronous || 'unknown');
                });
            }),
            new Promise((resolve, reject) => {
                db.get("PRAGMA cache_size", (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.cache_size || 'unknown');
                });
            })
        ]);
        console.log('\nPRAGMAs:');
        console.log(`  journal_mode: ${pragmas[0]}`);
        console.log(`  synchronous: ${pragmas[1]}`);
        console.log(`  cache_size: ${pragmas[2]}`);
    }
    catch (error) {
        console.error('❌ Erreur lors du dump:', error);
    }
    finally {
        db.close();
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=db-dump.js.map