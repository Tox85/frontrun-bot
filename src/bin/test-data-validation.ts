#!/usr/bin/env ts-node

import { StructuredLogger, LogLevel } from '../core/StructuredLogger';
import { DataValidator } from '../core/DataValidator';

async function testDataValidation() {
  console.log('🧪 Test de la Validation des Données\n');

  // 1. Initialiser les composants
  const logger = new StructuredLogger(LogLevel.INFO);
  const validator = new DataValidator();

  console.log('✅ Composants initialisés');

  // 2. Définir des schémas de validation
  validator.registerSchema('user', {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 20,
      pattern: /^[a-zA-Z0-9_]+$/,
      sanitize: DataValidator.sanitizeString
    },
    email: {
      type: 'string',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      sanitize: DataValidator.sanitizeString
    },
    age: {
      type: 'number',
      min: 18,
      max: 120
    },
    isActive: {
      type: 'boolean'
    },
    tags: {
      type: 'array',
      minLength: 0,
      maxLength: 10,
      min: 0,
      max: 10
    }
  });

  validator.registerSchema('api_request', {
    endpoint: {
      type: 'string',
      required: true,
      pattern: /^\/[a-zA-Z0-9\/_-]+$/,
      sanitize: DataValidator.sanitizeUrl
    },
    method: {
      type: 'string',
      enum: ['GET', 'POST', 'PUT', 'DELETE'],
      sanitize: DataValidator.sanitizeString
    },
    headers: {
      type: 'object',
      properties: {
        'Content-Type': { type: 'string', enum: ['application/json', 'text/plain'] },
        'Authorization': { type: 'string', pattern: /^Bearer\s+.+$/ }
      }
    },
    body: {
      type: 'object'
    }
  });

  console.log('✅ Schémas de validation définis');

  // 3. Tester la validation des utilisateurs
  console.log('\n👤 Test validation utilisateurs:');

  const validUser = {
    username: 'john_doe',
    email: 'john@example.com',
    age: 25,
    isActive: true,
    tags: ['developer', 'admin']
  };

  const invalidUser = {
    username: 'jo', // Trop court
    email: 'invalid-email',
    age: 15, // Trop jeune
    isActive: 'yes', // Mauvais type
    tags: 'single-tag' // Mauvais type
  };

  const userValidation = validator.validate('user', validUser);
  console.log('✅ Utilisateur valide:', userValidation.isValid);
  if (!userValidation.isValid) {
    console.log('❌ Erreurs:', userValidation.errors);
  }

  const invalidUserValidation = validator.validate('user', invalidUser);
  console.log('❌ Utilisateur invalide:', !invalidUserValidation.isValid);
  if (!invalidUserValidation.isValid) {
    console.log('❌ Erreurs:', invalidUserValidation.errors);
  }

  // 4. Tester la validation des requêtes API
  console.log('\n🌐 Test validation requêtes API:');

  const validRequest = {
    endpoint: '/api/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123'
    },
    body: { name: 'John' }
  };

  const invalidRequest = {
    endpoint: 'invalid-endpoint', // Pas de slash
    method: 'PATCH', // Méthode non autorisée
    headers: {
      'Content-Type': 'text/html', // Type non autorisé
      'Authorization': 'Basic auth' // Format incorrect
    }
  };

  const requestValidation = validator.validate('api_request', validRequest);
  console.log('✅ Requête valide:', requestValidation.isValid);

  const invalidRequestValidation = validator.validate('api_request', invalidRequest);
  console.log('❌ Requête invalide:', !invalidRequestValidation.isValid);
  if (!invalidRequestValidation.isValid) {
    console.log('❌ Erreurs:', invalidRequestValidation.errors);
  }

  // 5. Tester la sanitisation
  console.log('\n🧹 Test de la sanitisation:');

  const dirtyData = {
    username: '  john_doe  ',
    email: '  JOHN@EXAMPLE.COM  ',
    endpoint: '  /api/users  ',
    html: '<script>alert("xss")</script>Hello World',
    object: {
      key: '  value  ',
      nested: { data: '  nested_value  ' }
    }
  };

  console.log('Données sales:', JSON.stringify(dirtyData, null, 2));

  const sanitizedData = DataValidator.sanitizeObject(dirtyData);
  console.log('Données nettoyées:', JSON.stringify(sanitizedData, null, 2));

  // 6. Tester la validation avec des données malveillantes
  console.log('\n🛡️ Test protection contre les attaques:');

  const maliciousData = {
    username: 'admin\' OR 1=1--',
    email: 'user@example.com<script>alert("xss")</script>',
    endpoint: '/api/users; DROP TABLE users;--',
    age: 'NaN',
    tags: new Array(1000).fill('spam') // Array trop long
  };

  const maliciousValidation = validator.validate('user', maliciousData);
  console.log('❌ Données malveillantes rejetées:', !maliciousValidation.isValid);
  if (!maliciousValidation.isValid) {
    console.log('❌ Erreurs:', maliciousValidation.errors);
  }

  // 7. Tester les performances
  console.log('\n⚡ Test des performances:');

  const startTime = Date.now();
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    validator.validate('user', validUser);
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  const avgTime = duration / iterations;

  console.log(`✅ ${iterations} validations en ${duration}ms (moyenne: ${avgTime.toFixed(3)}ms)`);

  // 8. Nettoyage
  logger.info('Test de validation des données terminé avec succès');

  console.log('\n🎉 Test de validation des données terminé !');
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

// Lancer le test
testDataValidation().catch(console.error);
