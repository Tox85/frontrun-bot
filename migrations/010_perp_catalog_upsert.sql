-- Migration 008: PerpCatalog UPSERT + Anti-overlap + Dédup par base
-- Appliquée le: 2025-01-15
-- Objectif: Résoudre les erreurs SQLITE_CONSTRAINT et améliorer la robustesse

-- Sauvegarder les données existantes
CREATE TABLE IF NOT EXISTS perp_catalog_backup AS SELECT * FROM perp_catalog;

-- Supprimer la table actuelle
DROP TABLE perp_catalog;

-- Recréer avec le schéma optimisé pour UPSERT
CREATE TABLE perp_catalog (
  exchange TEXT NOT NULL,
  base TEXT NOT NULL,
  quote TEXT NOT NULL DEFAULT 'USDT',
  symbol TEXT NOT NULL,
  leverage_max REAL DEFAULT 100,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at_utc TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (exchange, base)
);

-- Index pour les performances
CREATE INDEX idx_perp_catalog_exchange ON perp_catalog(exchange);
CREATE INDEX idx_perp_catalog_base ON perp_catalog(base);
CREATE INDEX idx_perp_catalog_quote ON perp_catalog(quote);
CREATE INDEX idx_perp_catalog_last_seen ON perp_catalog(last_seen_at);

-- Index unique sur (exchange, base) - redondant avec PRIMARY KEY mais explicite
CREATE UNIQUE INDEX unq_perp_catalog_exchange_base ON perp_catalog(exchange, base);

-- Restaurer les données avec mapping des anciennes colonnes
INSERT INTO perp_catalog (exchange, base, quote, symbol, leverage_max, last_seen_at, updated_at_utc)
SELECT 
  exchange,
  base,
  CASE 
    WHEN symbol LIKE '%USDT%' THEN 'USDT'
    WHEN symbol LIKE '%USD%' THEN 'USD'
    WHEN symbol LIKE '%FDUSD%' THEN 'FDUSD'
    WHEN symbol LIKE '%BUSD%' THEN 'BUSD'
    ELSE 'USDT'
  END as quote,
  symbol,
  COALESCE(leverage_max, 100) as leverage_max,
  COALESCE(updated_at_utc, datetime('now')) as last_seen_at,
  datetime('now') as updated_at_utc
FROM perp_catalog_backup;

-- Supprimer la table de sauvegarde
DROP TABLE perp_catalog_backup;

-- Vérifier l'intégrité
PRAGMA integrity_check;

-- Vérifier le schéma final
PRAGMA table_info(perp_catalog);
