-- Migration 001: Initialisation du schéma de base
-- Appliquée le: 2024-01-01

-- Baseline KR (Bithumb)
CREATE TABLE IF NOT EXISTS baseline_kr (
  base TEXT PRIMARY KEY,
  sources TEXT NOT NULL,              -- JSON array
  first_seen_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

-- Events traités (dédup cross-sources T0/T2)
CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,               -- 'bithumb.notice' | 'bithumb.ws'
  base TEXT NOT NULL,
  url TEXT,
  trade_time_utc TEXT,
  created_at_utc TEXT NOT NULL
);

-- Cooldowns  (éviter retrade < 24h)
CREATE TABLE IF NOT EXISTS cooldowns (
  base TEXT PRIMARY KEY,
  expires_at_utc TEXT NOT NULL,
  reason TEXT NOT NULL
);

-- Exits planifiés (exit +180s persistant)
CREATE TABLE IF NOT EXISTS scheduled_exits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange TEXT NOT NULL,
  symbol TEXT NOT NULL,               -- perp normalisé
  qty REAL NOT NULL,
  due_at_utc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  opened_px REAL,
  opened_at_utc TEXT
);

-- Catalogue de perps (refresh périodique + lookup on-demand)
CREATE TABLE IF NOT EXISTS perp_catalog (
  exchange TEXT NOT NULL,             -- BYBIT|HL|BINANCE
  base TEXT NOT NULL,
  symbol TEXT NOT NULL,
  leverage_max REAL,
  updated_at_utc TEXT NOT NULL,
  PRIMARY KEY (exchange, base)
);

-- Singleton (1 leader)
CREATE TABLE IF NOT EXISTS instance_lock (
  lock_key TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  acquired_at_utc TEXT NOT NULL
);

-- Migrations
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at_utc TEXT NOT NULL
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_processed_events_base ON processed_events(base);
CREATE INDEX IF NOT EXISTS idx_processed_events_source ON processed_events(source);
CREATE INDEX IF NOT EXISTS idx_cooldowns_expires ON cooldowns(expires_at_utc);
CREATE INDEX IF NOT EXISTS idx_scheduled_exits_status ON scheduled_exits(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_exits_due ON scheduled_exits(due_at_utc);
CREATE INDEX IF NOT EXISTS idx_perp_catalog_exchange ON perp_catalog(exchange);
CREATE INDEX IF NOT EXISTS idx_perp_catalog_base ON perp_catalog(base);
