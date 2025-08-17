-- Migration 011: Création de la table watermarks
-- Date: 2025-08-17
-- Description: Table pour gérer les watermarks de déduplication

CREATE TABLE IF NOT EXISTS watermarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    last_published_at INTEGER NOT NULL DEFAULT 0,
    last_notice_uid TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(source)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_watermarks_source ON watermarks(source);
CREATE INDEX IF NOT EXISTS idx_watermarks_last_published ON watermarks(last_published_at);

-- Insertion des watermarks par défaut si la table est vide
INSERT OR IGNORE INTO watermarks (source, last_published_at, last_notice_uid, updated_at) VALUES
    ('bithumb.notice', 0, NULL, strftime('%s', 'now')),
    ('bithumb.websocket', 0, NULL, strftime('%s', 'now'));
