#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { StructuredLogger, LogLevel } from '../core/StructuredLogger';
import { DataValidator } from '../core/DataValidator';

interface DeploymentConfig {
  environment: 'staging' | 'production';
  dockerEnabled: boolean;
  healthCheckUrl: string;
  healthCheckTimeout: number;
  maxRetries: number;
}

class ProductionDeployer {
  private logger: StructuredLogger;
  private validator: DataValidator;
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.logger = new StructuredLogger(LogLevel.INFO);
    this.validator = new DataValidator();
    this.config = config;
    
    this.setupValidationSchemas();
  }

  private setupValidationSchemas(): void {
    // Schéma de validation pour la configuration de déploiement
    this.validator.registerSchema('deployment', {
      environment: {
        type: 'string',
        enum: ['staging', 'production'],
        required: true
      },
      dockerEnabled: {
        type: 'boolean',
        required: true
      },
      healthCheckUrl: {
        type: 'string',
        pattern: /^https?:\/\/.+/,
        required: true
      }
    });
  }

  async deploy(): Promise<void> {
    console.log('🚀 Déploiement Production Démarré\n');
    
    try {
      // 1. Validation de la configuration
      await this.validateConfiguration();
      
      // 2. Vérifications pré-déploiement
      await this.preDeploymentChecks();
      
      // 3. Build et tests
      await this.buildAndTest();
      
      // 4. Déploiement
      await this.executeDeployment();
      
      // 5. Vérifications post-déploiement
      await this.postDeploymentChecks();
      
      // 6. Validation finale
      await this.finalValidation();
      
      console.log('\n🎉 Déploiement Production Réussi !');
      
    } catch (error) {
      console.error('\n❌ Échec du déploiement:', error);
      this.logger.error('Déploiement échoué', error as Error);
      process.exit(1);
    }
  }

  private async validateConfiguration(): Promise<void> {
    console.log('🔍 Validation de la configuration...');
    
    const validation = this.validator.validate('deployment', this.config);
    if (!validation.isValid) {
      throw new Error(`Configuration invalide: ${validation.errors.join(', ')}`);
    }
    
    console.log('✅ Configuration validée');
  }

  private async preDeploymentChecks(): Promise<void> {
    console.log('\n🔍 Vérifications pré-déploiement...');
    
    // Vérifier Git
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (gitStatus.trim()) {
        console.log('⚠️  Changements Git non commités détectés');
        console.log(gitStatus);
      } else {
        console.log('✅ Git clean');
      }
    } catch (error) {
      console.log('⚠️  Impossible de vérifier Git');
    }

    // Vérifier les variables d'environnement
    const requiredEnvVars = [
      'NODE_ENV',
      'DATABASE_PATH',
      'TELEGRAM_BOT_TOKEN',
      'BITHUMB_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Variables d'environnement manquantes: ${missingVars.join(', ')}`);
    }

    console.log('✅ Variables d\'environnement vérifiées');
    console.log('✅ Vérifications pré-déploiement terminées');
  }

  private async buildAndTest(): Promise<void> {
    console.log('\n🔨 Build et tests...');
    
    // Nettoyer
    console.log('🧹 Nettoyage...');
    execSync('npm run clean', { stdio: 'inherit' });
    
    // Type check
    console.log('🔍 Vérification des types...');
    execSync('npm run typecheck', { stdio: 'inherit' });
    
    // Tests
    console.log('🧪 Exécution des tests...');
    execSync('npm test', { stdio: 'inherit' });
    
    // Build
    console.log('🏗️  Build...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('✅ Build et tests terminés');
  }

  private async executeDeployment(): Promise<void> {
    console.log('\n🚀 Exécution du déploiement...');
    
    if (this.config.dockerEnabled) {
      await this.deployWithDocker();
    } else {
      await this.deployDirect();
    }
    
    console.log('✅ Déploiement exécuté');
  }

  private async deployWithDocker(): Promise<void> {
    console.log('🐳 Déploiement Docker...');
    
    // Build Docker image
    execSync('docker build -t frontrun-bot:latest .', { stdio: 'inherit' });
    
    // Stop existing container
    try {
      execSync('docker stop frontrun-bot || true', { stdio: 'inherit' });
      execSync('docker rm frontrun-bot || true', { stdio: 'inherit' });
    } catch (error) {
      // Ignore errors if container doesn't exist
    }
    
    // Start new container
    execSync('docker run -d --name frontrun-bot --restart unless-stopped -p 3001:3001 frontrun-bot:latest', { stdio: 'inherit' });
  }

  private async deployDirect(): Promise<void> {
    console.log('📁 Déploiement direct...');
    
    // Migrations
    console.log('🗄️  Exécution des migrations...');
    execSync('npm run migrate', { stdio: 'inherit' });
    
    // PM2 restart (si configuré)
    try {
      execSync('pm2 restart frontrun-bot || pm2 start dist/main.js --name frontrun-bot', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  PM2 non disponible, démarrage direct...');
      execSync('npm start', { stdio: 'inherit' });
    }
  }

  private async postDeploymentChecks(): Promise<void> {
    console.log('\n🔍 Vérifications post-déploiement...');
    
    let retries = 0;
    const maxRetries = this.config.maxRetries;
    
    while (retries < maxRetries) {
      try {
        console.log(`🔄 Tentative ${retries + 1}/${maxRetries}...`);
        
        const response = await fetch(this.config.healthCheckUrl, {
          signal: AbortSignal.timeout(this.config.healthCheckTimeout)
        });
        
        if (response.ok) {
          const health = await response.json();
          console.log('✅ Health check réussi:', health.status);
          break;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`Health check échoué après ${maxRetries} tentatives`);
        }
        
        console.log(`⏳ Attente avant nouvelle tentative... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('✅ Vérifications post-déploiement terminées');
  }

  private async finalValidation(): Promise<void> {
    console.log('\n🎯 Validation finale...');
    
    // Test des endpoints critiques
    const endpoints = [
      '/health',
      '/metrics',
      '/dashboard',
      '/simulate/notice'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const url = `${this.config.healthCheckUrl}${endpoint}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        
        if (response.ok) {
          console.log(`✅ ${endpoint} - OK`);
        } else {
          console.log(`⚠️  ${endpoint} - HTTP ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint} - Erreur: ${error}`);
      }
    }
    
    console.log('✅ Validation finale terminée');
  }
}

// Configuration du déploiement
const deploymentConfig: DeploymentConfig = {
  environment: 'production',
  dockerEnabled: false, // Mettre à true si Docker est utilisé
  healthCheckUrl: 'http://localhost:3001',
  healthCheckTimeout: 30000,
  maxRetries: 5
};

// Lancer le déploiement
async function main() {
  const deployer = new ProductionDeployer(deploymentConfig);
  await deployer.deploy();
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Lancer le déploiement
main().catch(console.error);
