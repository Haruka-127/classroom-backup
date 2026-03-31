import type Database from "better-sqlite3";

import type { SyncableTopic } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class TopicsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, topics: SyncableTopic[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM topics WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO topics (course_id, topic_id, name, update_time, raw_json)
       VALUES (@courseId, @topicId, @name, @updateTime, @rawJson)`,
    );
    const transaction = this.db.transaction((items: SyncableTopic[]) => {
      deleteStmt.run(courseId);
      for (const topic of items) {
        insertStmt.run({
          courseId: topic.courseId,
          topicId: topic.topicId,
          name: topic.name ?? null,
          updateTime: topic.updateTime ?? null,
          rawJson: this.stringifyRaw(topic),
        });
      }
    });
    transaction(topics);
  }
}
