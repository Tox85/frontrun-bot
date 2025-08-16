-- Migration 009: Ajout de la colonne leverage_max manquante
-- Appliquée le: 2025-01-15
-- Problème: La colonne leverage_max était présente dans 001_init.sql mais supprimée dans 003_final_schema.sql
-- Le code PerpCatalog.ts l'utilise encore, causant une erreur SQLITE_ERROR

-- Ajouter la colonne leverage_max à perp_catalog
ALTER TABLE perp_catalog ADD COLUMN leverage_max REAL DEFAULT 100;

-- Mettre à jour les enregistrements existants avec une valeur par défaut
UPDATE perp_catalog SET leverage_max = 100 WHERE leverage_max IS NULL;
