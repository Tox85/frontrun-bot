import { Database } from 'sqlite3';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export interface Migration {
  id: string;
  name: string;
  sql: string;
}

export class MigrationRunner {
  private db: Database;
  private migrationsPath: string;

  constructor(db: Database, migrationsPath: string = './migrations') {
    this.db = db;
    this.migrationsPath = migrationsPath;
  }

  async runMigrations(): Promise<void> {
    console.log('🔄 Exécution des migrations...');
    
    try {
      // Créer la table des migrations si elle n'existe pas
      await this.createMigrationsTable();
      
      // Lire tous les fichiers de migration
      const migrationFiles = await this.getMigrationFiles();
      console.log(`📁 ${migrationFiles.length} fichiers de migration trouvés`);
      
      // Obtenir les migrations déjà appliquées
      const appliedMigrations = await this.getAppliedMigrations();
      console.log(`✅ ${appliedMigrations.length} migrations déjà appliquées`);
      
      // Filtrer les migrations à appliquer
      const pendingMigrations = migrationFiles.filter(
        file => !appliedMigrations.includes(file.id)
      );
      
      if (pendingMigrations.length === 0) {
        console.log('✅ Aucune migration en attente');
        return;
      }
      
      console.log(`🔄 ${pendingMigrations.length} migrations à appliquer`);
      
      // Appliquer chaque migration dans l'ordre
      for (const migration of pendingMigrations) {
        await this.applyMigration(migration);
      }
      
      console.log('✅ Toutes les migrations ont été appliquées avec succès');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution des migrations:', error);
      throw error;
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at_utc TEXT NOT NULL
      )
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async getMigrationFiles(): Promise<Migration[]> {
    try {
      const files = await fs.promises.readdir(this.migrationsPath);
      const sqlFiles = files.filter(file => file.endsWith('.sql'));
      
      const migrations: Migration[] = [];
      
      for (const file of sqlFiles) {
        const filePath = path.join(this.migrationsPath, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
        // Extraire l'ID et le nom depuis le contenu du fichier
        const idMatch = file.match(/^(\d+)_(.+)\.sql$/);
        if (idMatch && idMatch[1] && idMatch[2]) {
          const id = idMatch[1];
          const name = idMatch[2].replace(/_/g, ' ');
          
          migrations.push({
            id,
            name,
            sql: content
          });
        }
      }
      
      // Trier par ID numérique
      return migrations.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      
    } catch (error) {
      console.error('❌ Erreur lors de la lecture des fichiers de migration:', error);
      throw error;
    }
  }

  private async getAppliedMigrations(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id FROM _migrations ORDER BY id', (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map((row: any) => row.id));
      });
    });
  }

  private async applyMigration(migration: Migration): Promise<void> {
    console.log(`🔄 Application de la migration ${migration.id}: ${migration.name}`);
    
    return new Promise((resolve, reject) => {
      // Vérifier si la migration contient des PRAGMA
      const hasPragma = migration.sql.toLowerCase().includes('pragma');
      
      if (hasPragma) {
        // Pour les migrations avec PRAGMA, exécuter sans transaction
        this.db.exec(migration.sql, (err) => {
          if (err) {
            console.error(`❌ Erreur SQL dans la migration ${migration.id}:`, err);
            reject(err);
            return;
          }
          
          // Marquer la migration comme appliquée
          const now = new Date().toISOString();
          this.db.run(
            'INSERT INTO _migrations (id, name, applied_at_utc) VALUES (?, ?, ?)',
            [migration.id, migration.name, now],
            (err) => {
              if (err) {
                console.error(`❌ Erreur lors de l'enregistrement de la migration ${migration.id}:`, err);
                reject(err);
              } else {
                console.log(`✅ Migration ${migration.id} appliquée avec succès`);
                resolve();
              }
            }
          );
        });
      } else {
        // Pour les migrations normales, utiliser une transaction
        this.db.serialize(() => {
          this.db.run('BEGIN TRANSACTION');
          
          // Exécuter le SQL de la migration
          this.db.exec(migration.sql, (err) => {
            if (err) {
              console.error(`❌ Erreur SQL dans la migration ${migration.id}:`, err);
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            // Marquer la migration comme appliquée
            const now = new Date().toISOString();
            this.db.run(
              'INSERT INTO _migrations (id, name, applied_at_utc) VALUES (?, ?, ?)',
              [migration.id, migration.name, now],
              (err) => {
                if (err) {
                  console.error(`❌ Erreur lors de l'enregistrement de la migration ${migration.id}:`, err);
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                
                // Valider la transaction
                this.db.run('COMMIT', (err) => {
                  if (err) {
                    console.error(`❌ Erreur lors de la validation de la migration ${migration.id}:`, err);
                    reject(err);
                  } else {
                    console.log(`✅ Migration ${migration.id} appliquée avec succès`);
                    resolve();
                  }
                });
              }
            );
          });
        });
      }
    });
  }

  async getMigrationStatus(): Promise<{
    total: number;
    applied: number;
    pending: number;
    lastApplied?: string;
  }> {
    try {
      const migrationFiles = await this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      
      const lastApplied = appliedMigrations.length > 0 
        ? appliedMigrations[appliedMigrations.length - 1] 
        : undefined;
      
      return {
        total: migrationFiles.length,
        applied: appliedMigrations.length,
        pending: migrationFiles.length - appliedMigrations.length,
        ...(lastApplied && { lastApplied })
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du statut des migrations:', error);
      throw error;
    }
  }
}
