import type Database from "better-sqlite3";

import { BaseRepository } from "./base.js";

export interface AccountRecord {
  accountKey: string;
  email?: string | null;
  displayName?: string | null;
}

export class AccountsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(record: AccountRecord): void {
    this.db
      .prepare(
        `INSERT INTO accounts (account_key, email, display_name, updated_at)
         VALUES (@accountKey, @email, @displayName, CURRENT_TIMESTAMP)
         ON CONFLICT(account_key) DO UPDATE SET
           email=excluded.email,
           display_name=excluded.display_name,
           updated_at=CURRENT_TIMESTAMP`,
      )
      .run(record);
  }
}
