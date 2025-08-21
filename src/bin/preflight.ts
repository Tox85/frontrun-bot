#!/usr/bin/env ts-node

/**
 * Script de préflight pour validation exhaustive au démarrage
 * Vérifie ENV/Config, DB, Leadership, Baseline, HTTP, Hyperliquid, Telegram
 * Exit(1) si critique manquant, sinon continue avec codes 0/1
 */

import { CONFIG, validateConfig } from '../config/env';
import { Database } from 'sqlite3';
import { PerpCatalog } from '../store/PerpCatalog';
import { BaselineManager } from '../core/BaselineManager';
import { SingletonGuard } from '../core/SingletonGuard';
import { TelegramService } from '../notify/TelegramService';
import { HyperliquidAdapter } from '../exchanges/HyperliquidAdapter';
import { HttpClient } from '../core/HttpClient';
import { StructuredLogger, LogLevel } from '../core/StructuredLogger';

interface PreflightResult {
  section: string;
  status: '✅' | '❌' | '⚠️';
  message: string;
  critical: boolean;
}

class PreflightChecker {
  private results: PreflightResult[] = [];
  private logger = new StructuredLogger(LogLevel.INFO);

  async run(): Promise<void> {
    console.log('🚀 Démarrage du préflight...\n');

    // 1. Validation ENV/Config
    await this.checkEnvConfig();
    
    // 2. Validation DB
    await this.checkDatabase();
    
    // 3. Validation Leadership
    await this.checkLeadership();
    
    // 4. Validation Baseline
    await this.checkBaseline();
    
    // 5. Validation HTTP Server
    await this.checkHttpServer();
    
    // 6. Validation Hyperliquid
    await this.checkHyperliquid();
    
    // 7. Validation Telegram
    await this.checkTelegram();

    // Affichage des résultats
    this.displayResults();
    
    // Décision finale
    const criticalErrors = this.results.filter(r => r.critical && r.status === '❌');
    if (criticalErrors.length > 0) {
      console.log(`\n❌ PRÉFLIGHT ÉCHOUÉ: ${criticalErrors.length} erreur(s) critique(s)`);
      process.exit(1);
    } else {
      const warnings = this.results.filter(r => r.status === '⚠️').length;
      const errors = this.results.filter(r => r.status === '❌').length;
      if (errors > 0) {
        console.log(`\n⚠️ PRÉFLIGHT PARTIEL: ${errors} erreur(s) non-critique(s), ${warnings} avertissement(s)`);
        process.exit(1);
      } else {
        console.log(`\n✅ PRÉFLIGHT RÉUSSI: Toutes les vérifications critiques passées`);
        process.exit(0);
      }
    }
  }

  private async checkEnvConfig(): Promise<void> {
    console.log('🔧 Vérification ENV/Config...');
    
    const configValidation = validateConfig();
    
    // Vérifications spécifiques selon les règles
    const errors: string[] = [];
    const warnings: string[] = [];

    // TELEGRAM_BOT_TOKEN (format)
    if (CONFIG.TELEGRAM_ENABLED && !CONFIG.TELEGRAM_BOT_TOKEN) {
      errors.push('TELEGRAM_BOT_TOKEN manquant');
    } else if (CONFIG.TELEGRAM_ENABLED && CONFIG.TELEGRAM_BOT_TOKEN && !CONFIG.TELEGRAM_BOT_TOKEN.startsWith('5')) {
      warnings.push('TELEGRAM_BOT_TOKEN format suspect (doit commencer par "5")');
    }

    // TELEGRAM_CHAT_ID (numérique)
    if (CONFIG.TELEGRAM_ENABLED && !CONFIG.TELEGRAM_CHAT_ID) {
      errors.push('TELEGRAM_CHAT_ID manquant');
    } else if (CONFIG.TELEGRAM_ENABLED && CONFIG.TELEGRAM_CHAT_ID && isNaN(Number(CONFIG.TELEGRAM_CHAT_ID))) {
      errors.push('TELEGRAM_CHAT_ID doit être numérique');
    }

    // TRADING_ENABLED (bool)
    if (CONFIG.HL_ENABLED && !CONFIG.HL_WALLET) {
      errors.push('TRADING_ENABLED=true mais HYPERLIQUID_WALLET_ADDRESS manquant');
    }

    // MAX_POSITION_SIZE_USD
    if (CONFIG.RISK_PER_TRADE_USD <= 0) {
      errors.push('RISK_PER_TRADE_USD doit être > 0');
    }

    // RISK_PERCENT
    if (CONFIG.RISK_PCT <= 0 || CONFIG.RISK_PCT > 1) {
      errors.push('RISK_PCT doit être entre 0 et 1');
    }

    // T0_POLL_INTERVAL_MS >= 1100
    if (CONFIG.UPBIT_POLL_MS < 1100) {
      errors.push('UPBIT_POLL_MS doit être >= 1100ms (actuel: ' + CONFIG.UPBIT_POLL_MS + 'ms)');
    }

    // T0_HTTP_TIMEOUT_MS
    if (CONFIG.UPBIT_TIMEOUT_MS <= 0) {
      errors.push('UPBIT_TIMEOUT_MS doit être > 0');
    }

    // T0_HTTP_RETRIES
    if (CONFIG.UPBIT_MAX_RETRIES < 0) {
      errors.push('UPBIT_MAX_RETRIES doit être >= 0');
    }

    // Ajouter les erreurs de validation de config
    errors.push(...configValidation.errors);
    warnings.push(...configValidation.warnings);

    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;
    
    this.results.push({
      section: 'ENV/Config',
      status: hasErrors ? '❌' : hasWarnings ? '⚠️' : '✅',
      message: hasErrors ? `${errors.length} erreur(s): ${errors.join(', ')}` : 
               hasWarnings ? `${warnings.length} avertissement(s): ${warnings.join(', ')}` : 'Configuration valide',
      critical: hasErrors
    });
  }

  private async checkDatabase(): Promise<void> {
    console.log('🗄️ Vérification Database...');
    
    try {
      // Ouvrir la DB
      const db = new Database('./data/bot.db');
      
      // Vérifier WAL
      const pragmaResult = await new Promise<{ journal_mode: string }>((resolve, reject) => {
        db.get("PRAGMA journal_mode", (err, row) => {
          if (err) reject(err);
          else resolve(row as any);
        });
      });
      
      const walActive = pragmaResult.journal_mode === 'wal';
      
      // Vérifier les migrations (table _migrations, pas migrations)
      const migrationsResult = await new Promise<{ count: number }>((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM _migrations", (err, row) => {
          if (err) reject(err);
          else resolve(row as any);
        });
      });
      
      db.close();
      
      this.results.push({
        section: 'Database',
        status: '✅',
        message: `DB ouverte, WAL: ${walActive ? 'actif' : 'inactif'}, Migrations: ${migrationsResult.count} fichier(s)`,
        critical: false
      });
      
    } catch (error) {
      this.results.push({
        section: 'Database',
        status: '❌',
        message: `Erreur DB: ${error instanceof Error ? error.message : 'Inconnue'}`,
        critical: true
      });
    }
  }

  private async checkLeadership(): Promise<void> {
    console.log('👑 Vérification Leadership...');
    
    try {
      const db = new Database('./data/bot.db');
      
      // Vérifier la table instance_lock
      const tableExists = await new Promise<boolean>((resolve, reject) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='instance_lock'", (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        });
      });
      
      if (!tableExists) {
        this.results.push({
          section: 'Leadership',
          status: '❌',
          message: 'Table instance_lock manquante',
          critical: true
        });
        db.close();
        return;
      }
      
      // Vérifier le schéma de la table instance_lock
      const schemaResult = await new Promise<{ sql: string } | null>((resolve, reject) => {
        db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='instance_lock'", (err, row) => {
          if (err) reject(err);
          else resolve(row as any);
        });
      });
      
      if (!schemaResult) {
        this.results.push({
          section: 'Leadership',
          status: '❌',
          message: 'Impossible de récupérer le schéma de instance_lock',
          critical: true
        });
        db.close();
        return;
      }
      
      // Vérifier le statut actuel (utiliser seulement instance_id qui existe)
      const lockStatus = await new Promise<{ instance_id: string } | null>((resolve, reject) => {
        db.get("SELECT instance_id FROM instance_lock LIMIT 1", (err, row) => {
          if (err) reject(err);
          else resolve(row as any);
        });
      });
      
      db.close();
      
      if (!lockStatus) {
        this.results.push({
          section: 'Leadership',
          status: '⚠️',
          message: 'Aucun verrou d\'instance trouvé (premier démarrage ?)',
          critical: false
        });
      } else {
        // Vérifier si cette instance est leader (basé sur instance_id)
        const isLeader = lockStatus.instance_id === process.env.INSTANCE_ID || 
                        lockStatus.instance_id === require('os').hostname();
        
        this.results.push({
          section: 'Leadership',
          status: '✅',
          message: `Instance: ${lockStatus.instance_id}, Leader: ${isLeader ? 'Oui' : 'Non'}`,
          critical: false
        });
      }
      
    } catch (error) {
      this.results.push({
        section: 'Leadership',
        status: '❌',
        message: `Erreur leadership: ${error instanceof Error ? error.message : 'Inconnue'}`,
        critical: true
      });
    }
  }

  private async checkBaseline(): Promise<void> {
    console.log('📚 Vérification Baseline...');
    
    try {
      const db = new Database('./data/bot.db');
      
      // Vérifier la table baseline_kr (pas baseline)
      const tableExists = await new Promise<boolean>((resolve, reject) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='baseline_kr'", (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        });
      });
      
      if (!tableExists) {
        this.results.push({
          section: 'Baseline',
          status: '❌',
          message: 'Table baseline_kr manquante',
          critical: true
        });
        db.close();
        return;
      }
      
      // Compter les tokens KRW (baseline_kr contient déjà que des KRW)
      const krwCount = await new Promise<number>((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM baseline_kr", (err, row) => {
          if (err) reject(err);
          else resolve((row as any).count);
        });
      });
      
      db.close();
      
      if (krwCount === 0) {
        this.results.push({
          section: 'Baseline',
          status: '⚠️',
          message: 'Baseline vide (KRW: 0) - sera construite au boot',
          critical: false
        });
      } else {
        this.results.push({
          section: 'Baseline',
          status: '✅',
          message: `Baseline KRW: ${krwCount} tokens`,
          critical: false
        });
      }
      
    } catch (error) {
      this.results.push({
        section: 'Baseline',
        status: '❌',
        message: `Erreur baseline: ${error instanceof Error ? error.message : 'Inconnue'}`,
        critical: true
      });
    }
  }

  private async checkHttpServer(): Promise<void> {
    console.log('🌐 Vérification HTTP Server...');
    
    try {
      // Vérifier si le port est disponible
      const testPort = CONFIG.PORT;
      const net = require('net');
      
      const server = net.createServer();
      const portAvailable = await new Promise<boolean>((resolve) => {
        server.listen(testPort, () => {
          server.close();
          resolve(true);
        });
        
        server.on('error', () => {
          resolve(false);
        });
      });
      
      if (!portAvailable) {
        this.results.push({
          section: 'HTTP Server',
          status: '❌',
          message: `Port ${testPort} non disponible`,
          critical: true
        });
        return;
      }
      
      this.results.push({
        section: 'HTTP Server',
        status: '✅',
        message: `Port ${testPort} disponible`,
        critical: false
      });
      
    } catch (error) {
      this.results.push({
        section: 'HTTP Server',
        status: '❌',
        message: `Erreur HTTP: ${error instanceof Error ? error.message : 'Inconnue'}`,
        critical: true
      });
    }
  }

  private async checkHyperliquid(): Promise<void> {
    console.log('💎 Vérification Hyperliquid...');
    
    if (!CONFIG.HL_ENABLED) {
      this.results.push({
        section: 'Hyperliquid',
        status: '⚠️',
        message: 'Hyperliquid désactivé',
        critical: false
      });
      return;
    }
    
    try {
      // Vérifier les clés si TRADING_ENABLED
      if (!CONFIG.HL_WALLET) {
        this.results.push({
          section: 'Hyperliquid',
          status: '❌',
          message: 'HYPERLIQUID_WALLET_ADDRESS manquant',
          critical: true
        });
        return;
      }
      
      // Test de ping testnet
      const httpClient = new HttpClient('preflight-hl', {
        timeoutMs: 5000,
        maxRetries: 1,
        baseRetryDelayMs: 1000,
        maxRetryDelayMs: 2000,
        jitterPercent: 0.1
      });
      const testnetUrl = CONFIG.HL_TESTNET ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
      
      try {
        const response = await httpClient.get(`${testnetUrl}/info`);
        if (response.status === 200) {
          this.results.push({
            section: 'Hyperliquid',
            status: '✅',
            message: `API ${CONFIG.HL_TESTNET ? 'testnet' : 'mainnet'} accessible`,
            critical: false
          });
        } else {
          this.results.push({
            section: 'Hyperliquid',
            status: '⚠️',
            message: `API répond avec status ${response.status}`,
            critical: false
          });
        }
      } catch (error) {
        this.results.push({
          section: 'Hyperliquid',
          status: '⚠️',
          message: `API non accessible: ${error instanceof Error ? error.message : 'Inconnue'}`,
          critical: false
        });
      }
      
    } catch (error) {
      this.results.push({
        section: 'Hyperliquid',
        status: '❌',
        message: `Erreur Hyperliquid: ${error instanceof Error ? error.message : 'Inconnue'}`,
        critical: true
      });
    }
  }

  private async checkTelegram(): Promise<void> {
    console.log('📱 Vérification Telegram...');
    
    if (!CONFIG.TELEGRAM_ENABLED) {
      this.results.push({
        section: 'Telegram',
        status: '⚠️',
        message: 'Telegram désactivé',
        critical: false
      });
      return;
    }
    
    try {
      // Vérifier les tokens
      if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
        this.results.push({
          section: 'Telegram',
          status: '❌',
          message: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant',
          critical: true
        });
        return;
      }
      
      // Test de ping dry-run si TELEGRAM_SMOKE=true
      if (process.env.TELEGRAM_SMOKE === 'true') {
        try {
          const telegramService = new TelegramService();
          await telegramService.sendMessage('🧪 Test de préflight - Bot opérationnel');
          
          this.results.push({
            section: 'Telegram',
            status: '✅',
            message: 'Test de ping réussi',
            critical: false
          });
        } catch (error) {
          this.results.push({
            section: 'Telegram',
            status: '⚠️',
            message: `Test de ping échoué: ${error instanceof Error ? error.message : 'Inconnue'}`,
            critical: false
          });
        }
      } else {
        this.results.push({
          section: 'Telegram',
          status: '✅',
          message: 'Configuration valide (TELEGRAM_SMOKE=false)',
          critical: false
        });
      }
      
    } catch (error) {
      this.results.push({
        section: 'Telegram',
        status: '❌',
        message: `Erreur Telegram: ${error instanceof Error ? error.message : 'Inconnue'}`,
        critical: true
      });
    }
  }

  private displayResults(): void {
    console.log('\n📊 RÉSULTATS DU PRÉFLIGHT:\n');
    
    this.results.forEach(result => {
      console.log(`${result.status} ${result.section}: ${result.message}`);
    });
  }
}

// Exécution du préflight
async function main() {
  try {
    const checker = new PreflightChecker();
    await checker.run();
  } catch (error) {
    console.error('❌ Erreur fatale du préflight:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
