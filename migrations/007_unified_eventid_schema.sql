-- Migration 007: Schéma unifié pour processed_events avec eventId centralisé
-- Appliquée le: 2024-01-01
-- Objectif: Support du nouveau schéma EventId unifié et gating timing

-- Sauvegarder les données existantes
CREATE TABLE IF NOT EXISTS processed_events_backup AS SELECT * FROM processed_events;

-- Supprimer la table actuelle
DROP TABLE processed_events;

-- Recréer avec le schéma unifié
CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('bithumb.notice', 'bithumb.ws')),
  base TEXT NOT NULL,
  url TEXT,
  markets TEXT, -- JSON stringifié
  trade_time_utc TEXT, -- ISO string
  raw_title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX idx_processed_events_base ON processed_events(base);
CREATE INDEX idx_processed_events_source ON processed_events(source);
CREATE INDEX idx_processed_events_created ON processed_events(created_at);

-- Table pour empêcher les doubles trades cross-source
CREATE TABLE IF NOT EXISTS processed_bases (
  base TEXT PRIMARY KEY,
  last_acted_at DATETIME NOT NULL,
  last_event_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur processed_bases
CREATE INDEX idx_processed_bases_last_acted ON processed_bases(last_acted_at);

-- Restaurer les données avec mapping des anciennes colonnes
INSERT INTO processed_events (event_id, source, base, url, markets, trade_time_utc, raw_title, created_at)
SELECT 
  event_id, 
  CASE 
    WHEN source = 'T0' THEN 'bithumb.notice'
    WHEN source = 'T2' THEN 'bithumb.ws'
    ELSE 'bithumb.notice'
  END as source,
  COALESCE(base, 'UNKNOWN') as base,
  COALESCE(json_extract(raw, '$.url'), '') as url,
  COALESCE(json_extract(raw, '$.markets'), '[]') as markets,
  COALESCE(json_extract(raw, '$.tradeTimeUtc'), '') as trade_time_utc,
  COALESCE(json_extract(raw, '$.title'), '') as raw_title,
  datetime(detected_at_utc, 'unixepoch') as created_at
FROM processed_events_backup;

-- Supprimer la table de sauvegarde
DROP TABLE processed_events_backup;

-- Vérifier le schéma final
PRAGMA table_info(processed_events);
PRAGMA table_info(processed_bases);
