import type Database from "better-sqlite3";

import { AccountsRepository } from "./accounts.js";
import { AnnouncementsRepository } from "./announcements.js";
import { CourseWorkMaterialsRepository } from "./course-work-materials.js";
import { CourseWorkRepository } from "./course-work.js";
import { CoursesRepository } from "./courses.js";
import { DriveCommentsRepository } from "./drive-comments.js";
import { DriveFileArtifactsRepository } from "./drive-file-artifacts.js";
import { DriveFileRefsRepository } from "./drive-file-refs.js";
import { DriveFilesRepository } from "./drive-files.js";
import { FailuresRepository } from "./failures.js";
import { StudentSubmissionsRepository } from "./student-submissions.js";
import { SyncCheckpointsRepository } from "./sync-checkpoints.js";
import { SyncRunsRepository } from "./sync-runs.js";
import { TopicsRepository } from "./topics.js";

export interface Repositories {
  accounts: AccountsRepository;
  announcements: AnnouncementsRepository;
  courseWork: CourseWorkRepository;
  courseWorkMaterials: CourseWorkMaterialsRepository;
  courses: CoursesRepository;
  driveComments: DriveCommentsRepository;
  driveFileArtifacts: DriveFileArtifactsRepository;
  driveFileRefs: DriveFileRefsRepository;
  driveFiles: DriveFilesRepository;
  failures: FailuresRepository;
  studentSubmissions: StudentSubmissionsRepository;
  syncCheckpoints: SyncCheckpointsRepository;
  syncRuns: SyncRunsRepository;
  topics: TopicsRepository;
}

export function createRepositories(db: Database.Database): Repositories {
  return {
    accounts: new AccountsRepository(db),
    announcements: new AnnouncementsRepository(db),
    courseWork: new CourseWorkRepository(db),
    courseWorkMaterials: new CourseWorkMaterialsRepository(db),
    courses: new CoursesRepository(db),
    driveComments: new DriveCommentsRepository(db),
    driveFileArtifacts: new DriveFileArtifactsRepository(db),
    driveFileRefs: new DriveFileRefsRepository(db),
    driveFiles: new DriveFilesRepository(db),
    failures: new FailuresRepository(db),
    studentSubmissions: new StudentSubmissionsRepository(db),
    syncCheckpoints: new SyncCheckpointsRepository(db),
    syncRuns: new SyncRunsRepository(db),
    topics: new TopicsRepository(db),
  };
}
