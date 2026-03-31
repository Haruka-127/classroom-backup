import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type DatabaseConnection = Database.Database;

function loadInitialMigration(): string {
  const candidates = [
    fileURLToPath(new URL("./migrations/001_initial.sql", import.meta.url)),
    fileURLToPath(new URL("../../../src/storage/migrations/001_initial.sql", import.meta.url)),
  ];
  const migrationPath = candidates.find((candidate) => existsSync(candidate));

  if (!migrationPath) {
    throw new Error("Unable to resolve the initial SQLite migration file.");
  }

  return readFileSync(migrationPath, "utf8");
}

export function openDatabase(databasePath: string): DatabaseConnection {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(loadInitialMigration());
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
