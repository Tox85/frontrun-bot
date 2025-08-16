-- Migration 003: Correction du schéma processed_events
-- Appliquée le: 2024-01-01
-- Objectif: Schéma conforme pour la déduplication T0/T2

-- Supprimer l'ancienne table si elle existe
DROP TABLE IF EXISTS processed_events;

-- Créer la table avec le schéma correct
CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  base TEXT,
  source TEXT CHECK (source IN ('T0','T2')),
  detected_at_utc INTEGER NOT NULL,
  raw JSON
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_processed_events_base ON processed_events(base);
CREATE INDEX IF NOT EXISTS idx_processed_events_source ON processed_events(source);
CREATE INDEX IF NOT EXISTS idx_processed_events_detected ON processed_events(detected_at_utc);

-- Index unique sur event_id (redondant avec PRIMARY KEY mais explicite)
CREATE UNIQUE INDEX IF NOT EXISTS unq_processed_events_event_id ON processed_events(event_id);

-- Vérifier que la table est créée correctement
SELECT 'processed_events table created successfully' as status;
