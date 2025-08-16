#!/usr/bin/env ts-node
/**
 * Script de test pour valider le comportement anti-overlap du PerpCatalog
 *
 * Tests à effectuer :
 * 1. Deux refreshs parallèles → un seul vrai refresh + coalescing
 * 2. Gestion des erreurs sans rester coincé actif
 * 3. Métriques correctes (guard_runs, guard_coalesced)
 */
declare function testAntiOverlap(): Promise<void>;
export { testAntiOverlap };
