import type Database from "better-sqlite3";

import type { SyncableUserProfile } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class UserProfilesRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(profile: SyncableUserProfile): void {
    this.db
      .prepare(
        `INSERT INTO user_profiles (user_id, full_name, email, photo_url, raw_json)
         VALUES (@userId, @fullName, @email, @photoUrl, @rawJson)
         ON CONFLICT(user_id) DO UPDATE SET
           full_name=excluded.full_name,
           email=excluded.email,
           photo_url=excluded.photo_url,
           raw_json=excluded.raw_json`,
      )
      .run({
        userId: profile.userId,
        fullName: profile.fullName ?? null,
        email: profile.email ?? null,
        photoUrl: profile.photoUrl ?? null,
        rawJson: this.stringifyRaw(profile),
      });
  }
}
