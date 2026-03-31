import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type DatabaseConnection = Database.Database;

interface MigrationFile {
  version: number;
  name: string;
  sql: string;
}

function resolveMigrationsDirectory(): string {
  const candidates = [
    fileURLToPath(new URL("./migrations", import.meta.url)),
    fileURLToPath(new URL("../../../src/storage/migrations", import.meta.url)),
  ];
  const migrationDirectory = candidates.find((candidate) => existsSync(candidate));

  if (!migrationDirectory) {
    throw new Error("Unable to resolve the SQLite migrations directory.");
  }

  return migrationDirectory;
}

function loadMigrationFiles(): MigrationFile[] {
  const migrationsDirectory = resolveMigrationsDirectory();
  return readdirSync(migrationsDirectory)
    .filter((entry) => /^\d+_.+\.sql$/i.test(entry))
    .map((entry) => {
      const match = entry.match(/^(\d+)_/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${entry}`);
      }

      return {
        version: Number(match[1]),
        name: entry,
        sql: readFileSync(path.join(migrationsDirectory, entry), "utf8"),
      };
    })
    .sort((left, right) => left.version - right.version);
}

function ensureSchemaMigrationsTable(db: DatabaseConnection): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function applyPendingMigrations(db: DatabaseConnection): void {
  ensureSchemaMigrationsTable(db);
  const appliedVersions = new Set(
    (db.prepare(`SELECT version FROM schema_migrations ORDER BY version ASC`).all() as Array<{ version: number }>).map((row) => row.version),
  );

  for (const migration of loadMigrationFiles()) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    const transaction = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`).run(migration.version, migration.name);
    });
    transaction();
  }
}

export function openDatabase(databasePath: string): DatabaseConnection {
  const db = new Database(path.resolve(databasePath));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyPendingMigrations(db);
  return db;
}

export function openReadOnlyDatabase(databasePath: string): DatabaseConnection {
  return new Database(path.resolve(databasePath), {
    readonly: true,
    fileMustExist: true,
  });
}

export function closeDatabase(db: DatabaseConnection): void {
  db.close();
}
