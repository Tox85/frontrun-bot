#!/usr/bin/env ts-node
/**
 * Mini "replayer" de preuve pour valider le patch T0 Robust
 * Lit tests/fixtures/replay_sample.json et simule le traitement des notices
 *
 * Sortie attendue :
 * - Sélection de source (JSON/HTML) pour au moins 1 notice
 * - Detected X/Y listings
 * - Liste des NEW_LISTING_CONFIRMED (bases)
 * - new_listings_since_start=<N>
 */
export {};
