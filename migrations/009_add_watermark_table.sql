-- Migration 009: Ajout de la table watermarks pour éviter la boucle infinie T0
-- Appliquée le: 2024-12-19

-- Table de watermark pour éviter de retraiter les anciennes notices
CREATE TABLE IF NOT EXISTS watermarks (
  source TEXT PRIMARY KEY,           -- ex: 'bithumb.notice'
  last_published_at INTEGER NOT NULL, -- Timestamp UTC en millisecondes
  last_notice_uid TEXT NOT NULL,     -- UID de la dernière notice traitée
  updated_at INTEGER NOT NULL        -- Timestamp de mise à jour du watermark
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_watermarks_source ON watermarks(source);
CREATE INDEX IF NOT EXISTS idx_watermarks_published ON watermarks(last_published_at);

-- Insérer le watermark initial pour bithumb.notice
-- Utilise un timestamp très ancien pour traiter toutes les notices au premier boot
INSERT OR IGNORE INTO watermarks (source, last_published_at, last_notice_uid, updated_at)
VALUES ('bithumb.notice', 0, '', strftime('%s', 'now') * 1000);
