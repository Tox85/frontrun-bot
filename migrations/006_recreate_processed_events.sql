-- Migration 006: Recréation complète de processed_events
-- Appliquée le: 2024-01-01
-- Objectif: Recréer la table avec le schéma correct

-- Sauvegarder les données existantes
CREATE TABLE IF NOT EXISTS processed_events_backup AS SELECT * FROM processed_events;

-- Supprimer la table actuelle
DROP TABLE processed_events;

-- Recréer avec le schéma correct
CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  base TEXT,
  source TEXT CHECK (source IN ('T0','T2')),
  detected_at_utc INTEGER NOT NULL,
  raw TEXT
);

-- Index pour les performances
CREATE INDEX idx_processed_events_base ON processed_events(base);
CREATE INDEX idx_processed_events_source ON processed_events(source);
CREATE INDEX idx_processed_events_detected ON processed_events(detected_at_utc);

-- Index unique sur event_id
CREATE UNIQUE INDEX unq_processed_events_event_id ON processed_events(event_id);

-- Restaurer les données avec les nouvelles colonnes
INSERT INTO processed_events (event_id, base, source, detected_at_utc, raw)
SELECT 
  event_id, 
  base, 
  source, 
  strftime('%s', 'now') as detected_at_utc, 
  '{}' as raw
FROM processed_events_backup;

-- Supprimer la table de sauvegarde
DROP TABLE processed_events_backup;

-- Vérifier le schéma final
PRAGMA table_info(processed_events);
