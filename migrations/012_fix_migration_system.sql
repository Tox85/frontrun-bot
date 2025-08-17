-- Migration 012: Correction du système de migrations
-- Date: 2025-08-17
-- Description: Correction des conflits de migration et création de la table migrations

-- 1. Créer la table migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    description TEXT,
    filename TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Créer la table watermarks si elle n'existe pas
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

-- 3. Créer les index pour watermarks
CREATE INDEX IF NOT EXISTS idx_watermarks_source_base ON watermarks(source, base);
CREATE INDEX IF NOT EXISTS idx_watermarks_timestamp ON watermarks(timestamp);

-- 4. Insérer les watermarks par défaut
INSERT OR IGNORE INTO watermarks (source, base, watermark, timestamp) VALUES
    ('bithumb.notice', 'KRW', '0', 0),
    ('bithumb.websocket', 'KRW', '0', 0);

-- 5. Nettoyer et réinsérer les migrations dans l'ordre correct
DELETE FROM _migrations WHERE version IN ('003', '009');

-- 6. Insérer les migrations dans l'ordre correct
INSERT OR IGNORE INTO _migrations (version, description, filename, applied_at) VALUES
    ('001', 'Initial database schema', '001_initial_schema.sql', CURRENT_TIMESTAMP),
    ('002', 'Add baseline table', '002_add_baseline_table.sql', CURRENT_TIMESTAMP),
    ('003', 'Add events table', '003_add_events_table.sql', CURRENT_TIMESTAMP),
    ('004', 'Add perp catalog table', '004_add_perp_catalog_table.sql', CURRENT_TIMESTAMP),
    ('005', 'Add trades table', '005_add_trades_table.sql', CURRENT_TIMESTAMP),
    ('006', 'Add exits table', '006_add_exits_table.sql', CURRENT_TIMESTAMP),
    ('007', 'Add singleton guard table', '007_add_singleton_guard_table.sql', CURRENT_TIMESTAMP),
    ('008', 'Add processed events table', '008_add_processed_events_table.sql', CURRENT_TIMESTAMP),
    ('009', 'Add performance metrics table', '009_add_performance_metrics_table.sql', CURRENT_TIMESTAMP),
    ('010', 'Perp catalog upsert', '010_perp_catalog_upsert.sql', CURRENT_TIMESTAMP),
    ('011', 'Create watermarks table', '011_create_watermarks_table.sql', CURRENT_TIMESTAMP),
    ('012', 'Fix migration system', '012_fix_migration_system.sql', CURRENT_TIMESTAMP);
