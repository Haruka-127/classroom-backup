import type Database from "better-sqlite3";

export abstract class BaseRepository {
  constructor(protected readonly db: Database.Database) {}

  protected stringify(value: unknown): string {
    return JSON.stringify(value);
  }
}
