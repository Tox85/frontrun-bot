// Système de tests de charge et de stress

import { StructuredLogger, LogLevel } from '../../core/StructuredLogger';
import { HttpClient } from '../../lib/httpClient';

export interface LoadTestConfig {
  name: string;
  durationMs: number;
  requestsPerSecond: number;
  maxConcurrentUsers: number;
  rampUpMs: number;
  endpoints: LoadTestEndpoint[];
}

export interface LoadTestEndpoint {
  path: string;
  method: 'GET' | 'POST';
  weight: number; // Poids relatif pour la distribution des requêtes
  payload?: any;
  headers?: Record<string, string>;
}

export interface LoadTestResult {
  name: string;
  startTime: Date;
  endTime: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errors: LoadTestError[];
  performanceMetrics: PerformanceMetrics;
}

export interface LoadTestError {
  timestamp: Date;
  endpoint: string;
  error: string;
  responseTime: number;
}

export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  errorRate: number;
  throughput: number;
}

export class LoadTester {
  private logger: StructuredLogger;
  private httpClient: HttpClient;
  private isRunning = false;
  private startTime: number = 0;
  private results: LoadTestResult[] = [];
  private currentTest: LoadTestConfig | null = null;
  private activeUsers = 0;
  private requestCount = 0;
  private responseTimes: number[] = [];
  private errors: LoadTestError[] = [];

  constructor(logger: StructuredLogger, baseUrl: string = 'http://localhost:3001') {
    this.logger = logger;
    this.httpClient = new HttpClient(10000); // 10s timeout pour les tests
  }

  /**
   * Lancer un test de charge
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    if (this.isRunning) {
      throw new Error('Un test de charge est déjà en cours');
    }

    this.logger.info(`Démarrage du test de charge: ${config.name}`, {
      component: 'LoadTester',
      config: {
        duration: config.durationMs,
        rps: config.requestsPerSecond,
        maxUsers: config.maxConcurrentUsers
      }
    });

    this.currentTest = config;
    this.isRunning = true;
    this.startTime = Date.now();
    this.resetMetrics();

    try {
      // Phase de ramp-up
      await this.rampUp(config);
      
      // Phase de charge soutenue
      await this.sustainedLoad(config);
      
      // Phase de ramp-down
      await this.rampDown(config);

    } catch (error) {
      this.logger.error('Erreur lors du test de charge', error, {
        component: 'LoadTester',
        testName: config.name
      });
    } finally {
      this.isRunning = false;
    }

    const result = this.generateResult(config);
    this.results.push(result);

    this.logger.info(`Test de charge terminé: ${config.name}`, {
      component: 'LoadTester',
      result: {
        totalRequests: result.totalRequests,
        successRate: ((result.successfulRequests / result.totalRequests) * 100).toFixed(2) + '%',
        avgResponseTime: result.averageResponseTime + 'ms'
      }
    });

    return result;
  }

  /**
   * Phase de ramp-up (augmentation progressive de la charge)
   */
  private async rampUp(config: LoadTestConfig): Promise<void> {
    const rampUpSteps = Math.ceil(config.rampUpMs / 1000);
    const usersPerStep = config.maxConcurrentUsers / rampUpSteps;

    for (let step = 1; step <= rampUpSteps; step++) {
      const targetUsers = Math.floor(step * usersPerStep);
      const currentUsers = this.activeUsers;

      // Ajouter des utilisateurs
      for (let i = currentUsers; i < targetUsers; i++) {
        this.startUser(config);
      }

      this.logger.info(`Ramp-up étape ${step}/${rampUpSteps}`, {
        component: 'LoadTester',
        activeUsers: this.activeUsers,
        targetUsers
      });

      await this.sleep(1000);
    }
  }

  /**
   * Phase de charge soutenue
   */
  private async sustainedLoad(config: LoadTestConfig): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + config.durationMs;

    while (Date.now() < endTime && this.isRunning) {
      // Maintenir le nombre d'utilisateurs actifs
      while (this.activeUsers < config.maxConcurrentUsers) {
        this.startUser(config);
      }

      // Attendre la prochaine seconde
      await this.sleep(1000);

      // Log des métriques intermédiaires
      if (this.requestCount % 100 === 0) {
        this.logIntermediateMetrics();
      }
    }
  }

  /**
   * Phase de ramp-down (diminution progressive de la charge)
   */
  private async rampDown(config: LoadTestConfig): Promise<void> {
    const rampDownSteps = Math.ceil(config.rampUpMs / 1000);
    const usersPerStep = config.maxConcurrentUsers / rampDownSteps;

    for (let step = 1; step <= rampDownSteps; step++) {
      const targetUsers = Math.max(0, config.maxConcurrentUsers - (step * usersPerStep));
      
      // Réduire le nombre d'utilisateurs
      while (this.activeUsers > targetUsers) {
        this.stopUser();
      }

      this.logger.info(`Ramp-down étape ${step}/${rampDownSteps}`, {
        component: 'LoadTester',
        activeUsers: this.activeUsers,
        targetUsers
      });

      await this.sleep(1000);
    }
  }

  /**
   * Démarrer un utilisateur virtuel
   */
  private startUser(config: LoadTestConfig): void {
    this.activeUsers++;
    
    // Lancer l'utilisateur dans un processus séparé
    setImmediate(() => this.userLoop(config));
  }

  /**
   * Arrêter un utilisateur virtuel
   */
  private stopUser(): void {
    if (this.activeUsers > 0) {
      this.activeUsers--;
    }
  }

  /**
   * Boucle principale d'un utilisateur virtuel
   */
  private async userLoop(config: LoadTestConfig): Promise<void> {
    while (this.isRunning && this.activeUsers > 0) {
      try {
        // Sélectionner un endpoint selon les poids
        const endpoint = this.selectEndpoint(config.endpoints);
        
        // Effectuer la requête
        const startTime = Date.now();
        await this.makeRequest(endpoint);
        const responseTime = Date.now() - startTime;

        // Enregistrer les métriques
        this.recordMetrics(responseTime, true);

      } catch (error) {
        const responseTime = Date.now();
        this.recordMetrics(responseTime, false);
        
        this.errors.push({
          timestamp: new Date(),
          endpoint: 'unknown',
          error: error instanceof Error ? error.message : String(error),
          responseTime
        });
      }

      // Attendre selon le RPS cible
      const delay = 1000 / config.requestsPerSecond;
      await this.sleep(delay);
    }
  }

  /**
   * Sélectionner un endpoint selon les poids
   */
  private selectEndpoint(endpoints: LoadTestEndpoint[]): LoadTestEndpoint {
    const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }

    return endpoints[0];
  }

  /**
   * Effectuer une requête HTTP
   */
  private async makeRequest(endpoint: LoadTestEndpoint): Promise<void> {
    const url = `http://localhost:3001${endpoint.path}`;

    if (endpoint.method === 'GET') {
      await this.httpClient.getJSON(url);
    } else {
      await this.httpClient.postJSON(url, endpoint.payload, endpoint.headers);
    }
  }

  /**
   * Enregistrer les métriques de performance
   */
  private recordMetrics(responseTime: number, success: boolean): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);

    if (!success) {
      // Compter les erreurs
    }
  }

  /**
   * Log des métriques intermédiaires
   */
  private logIntermediateMetrics(): void {
    if (this.responseTimes.length === 0) return;

    const avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    const errorRate = (this.errors.length / this.requestCount) * 100;

    this.logger.info('Métriques intermédiaires du test de charge', {
      component: 'LoadTester',
      activeUsers: this.activeUsers,
      totalRequests: this.requestCount,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: errorRate.toFixed(2) + '%'
    });
  }

  /**
   * Générer le résultat final du test
   */
  private generateResult(config: LoadTestConfig): LoadTestResult {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    // Calculer les percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    const result: LoadTestResult = {
      name: config.name,
      startTime: new Date(this.startTime),
      endTime: new Date(endTime),
      totalRequests: this.requestCount,
      successfulRequests: this.requestCount - this.errors.length,
      failedRequests: this.errors.length,
      averageResponseTime: this.responseTimes.length > 0 
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
        : 0,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      requestsPerSecond: (this.requestCount / (duration / 1000)),
      errors: [...this.errors],
      performanceMetrics: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        activeConnections: this.activeUsers,
        errorRate: this.errors.length / this.requestCount,
        throughput: this.requestCount / (duration / 1000)
      }
    };

    return result;
  }

  /**
   * Réinitialiser les métriques
   */
  private resetMetrics(): void {
    this.requestCount = 0;
    this.responseTimes = [];
    this.errors = [];
    this.activeUsers = 0;
  }

  /**
   * Obtenir l'historique des tests
   */
  getTestHistory(): LoadTestResult[] {
    return [...this.results];
  }

  /**
   * Obtenir le dernier résultat
   */
  getLastResult(): LoadTestResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  /**
   * Arrêter le test en cours
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('Test de charge arrêté manuellement', {
      component: 'LoadTester'
    });
  }

  /**
   * Vérifier si un test est en cours
   */
  isTestRunning(): boolean {
    return this.isRunning;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
