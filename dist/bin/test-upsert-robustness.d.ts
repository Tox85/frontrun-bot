#!/usr/bin/env ts-node
/**
 * Script de test pour valider la robustesse de l'UPSERT du PerpCatalog
 *
 * Tests à effectuer :
 * 1. Double UPSERT sur la même (exchange, base) → zéro contrainte
 * 2. Vérification { inserted: true } puis { updated: true }
 * 3. Validation de l'index UNIQUE(exchange, base)
 */
declare function testUpsertRobustness(): Promise<void>;
export { testUpsertRobustness };
