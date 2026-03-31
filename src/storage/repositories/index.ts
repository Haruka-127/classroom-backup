import type Database from "better-sqlite3";

import { AccountsRepository } from "./accounts.js";
import { AnnouncementsRepository } from "./announcements.js";
import { ArtifactBlobsRepository } from "./artifact-blobs.js";
import { CourseAliasesRepository } from "./course-aliases.js";
import { CourseGradingPeriodSettingsRepository } from "./course-grading-period-settings.js";
import { CourseWorkMaterialsRepository } from "./course-work-materials.js";
import { CourseWorkRepository } from "./course-work.js";
import { CoursesRepository } from "./courses.js";
import { DriveCommentsRepository } from "./drive-comments.js";
import { DriveFileArtifactsRepository } from "./drive-file-artifacts.js";
import { DriveFileRefsRepository } from "./drive-file-refs.js";
import { DriveFilesRepository } from "./drive-files.js";
import { FailuresRepository } from "./failures.js";
import { GuardianInvitationsRepository } from "./guardian-invitations.js";
import { GuardiansRepository } from "./guardians.js";
import { InvitationsRepository } from "./invitations.js";
import { RubricsRepository } from "./rubrics.js";
import { StudentGroupMembersRepository } from "./student-group-members.js";
import { StudentGroupsRepository } from "./student-groups.js";
import { StudentsRepository } from "./students.js";
import { StudentSubmissionsRepository } from "./student-submissions.js";
import { SyncCheckpointsRepository } from "./sync-checkpoints.js";
import { SyncRunsRepository } from "./sync-runs.js";
import { SyncStatusRecordsRepository } from "./sync-status-records.js";
import { TeachersRepository } from "./teachers.js";
import { TopicsRepository } from "./topics.js";
import { UserProfilesRepository } from "./user-profiles.js";

export interface Repositories {
  accounts: AccountsRepository;
  announcements: AnnouncementsRepository;
  artifactBlobs: ArtifactBlobsRepository;
  courseAliases: CourseAliasesRepository;
  courseGradingPeriodSettings: CourseGradingPeriodSettingsRepository;
  courseWork: CourseWorkRepository;
  courseWorkMaterials: CourseWorkMaterialsRepository;
  courses: CoursesRepository;
  driveComments: DriveCommentsRepository;
  driveFileArtifacts: DriveFileArtifactsRepository;
  driveFileRefs: DriveFileRefsRepository;
  driveFiles: DriveFilesRepository;
  failures: FailuresRepository;
  guardianInvitations: GuardianInvitationsRepository;
  guardians: GuardiansRepository;
  invitations: InvitationsRepository;
  rubrics: RubricsRepository;
  studentGroupMembers: StudentGroupMembersRepository;
  studentGroups: StudentGroupsRepository;
  students: StudentsRepository;
  studentSubmissions: StudentSubmissionsRepository;
  syncCheckpoints: SyncCheckpointsRepository;
  syncRuns: SyncRunsRepository;
  syncStatusRecords: SyncStatusRecordsRepository;
  teachers: TeachersRepository;
  topics: TopicsRepository;
  userProfiles: UserProfilesRepository;
}

export function createRepositories(db: Database.Database): Repositories {
  return {
    accounts: new AccountsRepository(db),
    announcements: new AnnouncementsRepository(db),
    artifactBlobs: new ArtifactBlobsRepository(db),
    courseAliases: new CourseAliasesRepository(db),
    courseGradingPeriodSettings: new CourseGradingPeriodSettingsRepository(db),
    courseWork: new CourseWorkRepository(db),
    courseWorkMaterials: new CourseWorkMaterialsRepository(db),
    courses: new CoursesRepository(db),
    driveComments: new DriveCommentsRepository(db),
    driveFileArtifacts: new DriveFileArtifactsRepository(db),
    driveFileRefs: new DriveFileRefsRepository(db),
    driveFiles: new DriveFilesRepository(db),
    failures: new FailuresRepository(db),
    guardianInvitations: new GuardianInvitationsRepository(db),
    guardians: new GuardiansRepository(db),
    invitations: new InvitationsRepository(db),
    rubrics: new RubricsRepository(db),
    studentGroupMembers: new StudentGroupMembersRepository(db),
    studentGroups: new StudentGroupsRepository(db),
    students: new StudentsRepository(db),
    studentSubmissions: new StudentSubmissionsRepository(db),
    syncCheckpoints: new SyncCheckpointsRepository(db),
    syncRuns: new SyncRunsRepository(db),
    syncStatusRecords: new SyncStatusRecordsRepository(db),
    teachers: new TeachersRepository(db),
    topics: new TopicsRepository(db),
    userProfiles: new UserProfilesRepository(db),
  };
}
