import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type DatabaseConnection = Database.Database;

function loadInitialMigration(): string {
  const migrationPath = path.resolve(process.cwd(), "src", "storage", "migrations", "001_initial.sql");
  return readFileSync(migrationPath, "utf8");
}

export function openDatabase(databasePath: string): DatabaseConnection {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(loadInitialMigration());
  return db;
}

export function closeDatabase(db: DatabaseConnection): void {
  db.close();
}
