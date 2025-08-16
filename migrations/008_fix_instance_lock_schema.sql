-- Migration 008: Correction du schéma instance_lock pour correspondre au code
-- Appliquée le: 2024-12-19

-- Supprimer l'ancienne table instance_lock
DROP TABLE IF EXISTS instance_lock;

-- Recréer la table avec le bon schéma
CREATE TABLE IF NOT EXISTS instance_lock (
  lock_key TEXT PRIMARY KEY,           -- Clé de verrouillage (ex: 'leader')
  instance_id TEXT NOT NULL,           -- ID de l'instance qui détient le lock
  acquired_at_utc TEXT NOT NULL        -- Timestamp d'acquisition du lock
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_instance_lock_instance_id ON instance_lock(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_lock_acquired ON instance_lock(acquired_at_utc);

-- Insérer l'instance lock initial
INSERT OR IGNORE INTO instance_lock (lock_key, instance_id, acquired_at_utc) 
VALUES ('leader', 'none', '2025-01-01T00:00:00Z');
