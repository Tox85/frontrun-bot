-- Migration 009: Ajout de la colonne leverage_max manquante
-- Appliquée le: 2025-01-15
-- Problème: La colonne leverage_max était présente dans 001_init.sql mais supprimée dans 003_final_schema.sql
-- Le code PerpCatalog.ts l'utilise encore, causant une erreur SQLITE_ERROR

-- Vérifier si la colonne existe déjà avant de l'ajouter
-- Note: SQLite ne supporte pas IF NOT EXISTS pour ALTER TABLE, donc on utilise une approche différente

-- Créer une table temporaire avec le bon schéma
CREATE TABLE IF NOT EXISTS perp_catalog_temp (
  exchange TEXT NOT NULL,
  base TEXT NOT NULL,
  symbol TEXT NOT NULL,
  leverage_max REAL DEFAULT 100,
  updated_at_utc TEXT NOT NULL,
  PRIMARY KEY (exchange, base)
);

-- Copier les données existantes
INSERT INTO perp_catalog_temp (exchange, base, symbol, leverage_max, updated_at_utc)
SELECT exchange, base, symbol, 100 as leverage_max, updated_at_utc FROM perp_catalog;

-- Supprimer l'ancienne table
DROP TABLE perp_catalog;

-- Renommer la table temporaire
ALTER TABLE perp_catalog_temp RENAME TO perp_catalog;

-- Recréer les index
CREATE INDEX IF NOT EXISTS idx_perp_catalog_exchange ON perp_catalog(exchange);
CREATE INDEX IF NOT EXISTS idx_perp_catalog_base ON perp_catalog(base);
CREATE UNIQUE INDEX IF NOT EXISTS unq_perp_catalog_exchange_base ON perp_catalog(exchange, base);
