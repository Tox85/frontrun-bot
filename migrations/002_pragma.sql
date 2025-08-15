-- Migration 002: Configuration des paramètres PRAGMA
-- Appliquée le: 2024-01-01

-- Activer WAL pour de meilleures performances
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=10000;
PRAGMA temp_store=MEMORY;
