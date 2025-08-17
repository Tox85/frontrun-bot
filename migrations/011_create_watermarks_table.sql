-- Migration 011: Création de la table watermarks
-- Date: 2025-08-17
-- Description: Table pour gérer les watermarks de déduplication

CREATE TABLE IF NOT EXISTS watermarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    base TEXT NOT NULL,
    watermark TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, base)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_watermarks_source_base ON watermarks(source, base);
CREATE INDEX IF NOT EXISTS idx_watermarks_timestamp ON watermarks(timestamp);

-- Insertion des watermarks par défaut si la table est vide
INSERT OR IGNORE INTO watermarks (source, base, watermark, timestamp) VALUES
    ('bithumb.notice', 'KRW', '0', 0),
    ('bithumb.websocket', 'KRW', '0', 0);

-- Mise à jour du timestamp
UPDATE migrations SET applied_at = CURRENT_TIMESTAMP WHERE version = '011';
