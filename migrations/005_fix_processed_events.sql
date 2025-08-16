-- Migration 004: Correction du schéma processed_events
-- Appliquée le: 2024-01-01
-- Objectif: Ajouter les colonnes manquantes detected_at_utc et raw

-- Vérifier le schéma actuel
PRAGMA table_info(processed_events);

-- Ajouter la colonne detected_at_utc si elle n'existe pas
ALTER TABLE processed_events ADD COLUMN detected_at_utc INTEGER;

-- Ajouter la colonne raw si elle n'existe pas
ALTER TABLE processed_events ADD COLUMN raw TEXT;

-- Mettre à jour les colonnes existantes avec des valeurs par défaut
UPDATE processed_events SET detected_at_utc = strftime('%s', 'now') WHERE detected_at_utc IS NULL;
UPDATE processed_events SET raw = '{}' WHERE raw IS NULL;

-- Créer l'index sur detected_at_utc s'il n'existe pas
CREATE INDEX IF NOT EXISTS idx_processed_events_detected ON processed_events(detected_at_utc);

-- Vérifier le schéma final
PRAGMA table_info(processed_events);
