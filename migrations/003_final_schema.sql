-- Migration 003: Schéma final corrigé et aligné
-- Appliquée le: 2025-01-15

-- Supprimer les anciennes tables si elles existent
DROP TABLE IF EXISTS baseline_kr;
DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS cooldowns;
DROP TABLE IF EXISTS scheduled_exits;
DROP TABLE IF EXISTS perp_catalog;
DROP TABLE IF EXISTS instance_lock;

-- Baseline KR (Bithumb) - construite au boot uniquement
CREATE TABLE IF NOT EXISTS baseline_kr (
  base TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'bithumb.rest',
  listed_at_utc TEXT NOT NULL,
  created_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Events traités (dédup cross-sources T0/T2) - eventId UNIQUE
CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  base TEXT NOT NULL,
  source TEXT NOT NULL,               -- 'bithumb.notice' | 'bithumb.ws'
  url TEXT,
  trade_time_utc TEXT,
  created_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cooldowns (éviter retrade < 24h)
CREATE TABLE IF NOT EXISTS cooldowns (
  base TEXT PRIMARY KEY,
  expires_at_utc TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exits planifiés (exit +180s persistant)
CREATE TABLE IF NOT EXISTS scheduled_exits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base TEXT NOT NULL,
  due_at_utc TEXT NOT NULL,
  payload TEXT NOT NULL,              -- JSON stringifié
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'EXECUTED' | 'FAILED'
  created_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catalogue de perps (refresh périodique + lookup on-demand)
CREATE TABLE IF NOT EXISTS perp_catalog (
  exchange TEXT NOT NULL,             -- 'BYBIT' | 'HYPERLIQUID' | 'BINANCE'
  base TEXT NOT NULL,
  symbol TEXT NOT NULL,
  leverage_max REAL DEFAULT 100,      -- Ajouté pour cohérence avec les migrations suivantes
  updated_at_utc TEXT NOT NULL,
  PRIMARY KEY (exchange, base)
);

-- Singleton (1 leader) - instance lock en DB
CREATE TABLE IF NOT EXISTS instance_lock (
  id INTEGER PRIMARY KEY,
  instance_id TEXT NOT NULL,
  locked_at_utc TEXT NOT NULL,
  heartbeat_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Curseur notices pour éviter re-traitement
CREATE TABLE IF NOT EXISTS notices_cursor (
  id INTEGER PRIMARY KEY,
  last_published_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_processed_events_base ON processed_events(base);
CREATE INDEX IF NOT EXISTS idx_processed_events_source ON processed_events(source);
CREATE INDEX IF NOT EXISTS idx_processed_events_event_id ON processed_events(event_id);
CREATE INDEX IF NOT EXISTS idx_cooldowns_expires ON cooldowns(expires_at_utc);
CREATE INDEX IF NOT EXISTS idx_scheduled_exits_status ON scheduled_exits(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_exits_due ON scheduled_exits(due_at_utc);
CREATE INDEX IF NOT EXISTS idx_perp_catalog_exchange ON perp_catalog(exchange);
CREATE INDEX IF NOT EXISTS idx_perp_catalog_base ON perp_catalog(base);
CREATE INDEX IF NOT EXISTS idx_instance_lock_heartbeat ON instance_lock(heartbeat_at_utc);

-- Contraintes UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS unq_processed_events_event_id ON processed_events(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS unq_baseline_kr_base ON baseline_kr(base);
CREATE UNIQUE INDEX IF NOT EXISTS unq_cooldowns_base ON cooldowns(base);
CREATE UNIQUE INDEX IF NOT EXISTS unq_perp_catalog_exchange_base ON perp_catalog(exchange, base);

-- Insérer le curseur initial
INSERT OR IGNORE INTO notices_cursor (id, last_published_at_utc) VALUES (1, '2025-01-01T00:00:00Z');

-- Insérer l'instance lock initial
INSERT OR IGNORE INTO instance_lock (id, instance_id, locked_at_utc) VALUES (1, 'none', '2025-01-01T00:00:00Z');
