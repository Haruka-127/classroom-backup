import type Database from "better-sqlite3";

import type { SyncableAnnouncement } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class AnnouncementsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, announcements: SyncableAnnouncement[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM announcements WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO announcements (course_id, announcement_id, text, state, alternate_link, creation_time, update_time, raw_json)
       VALUES (@courseId, @announcementId, @text, @state, @alternateLink, @creationTime, @updateTime, @rawJson)`,
    );
    const transaction = this.db.transaction((items: SyncableAnnouncement[]) => {
      deleteStmt.run(courseId);
      for (const announcement of items) {
        insertStmt.run({
          courseId: announcement.courseId,
          announcementId: announcement.announcementId,
          text: announcement.text ?? null,
          state: announcement.state ?? null,
          alternateLink: announcement.alternateLink ?? null,
          creationTime: announcement.creationTime ?? null,
          updateTime: announcement.updateTime ?? null,
          rawJson: this.stringifyRaw(announcement),
        });
      }
    });
    transaction(announcements);
  }
}
