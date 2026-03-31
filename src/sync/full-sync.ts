import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

import pLimit from "p-limit";

import { createAuthorizedClient } from "../auth/oauth.js";
import { createTokenStore } from "../auth/token-store.js";
import { ensureAppDirectories, resolveAppPaths } from "../config/app-paths.js";
import { resolveRegisteredOAuthClient } from "../config/oauth-client.js";
import { GOOGLE_OAUTH_SCOPES } from "../config/scopes.js";
import { getExportTargets, isGoogleWorkspaceMimeType } from "../domain/export-strategy.js";
import {
  resolveCourseMaterialDriveReferences,
  resolveSubmissionDriveReferences,
} from "../domain/material-resolver.js";
import type {
  CourseVisibilityStatus,
  DriveFileRecord,
  ManifestArtifactEntry,
  StatusRecord,
  SyncFailureRecord,
  SyncableAnnouncement,
  SyncableCourseAlias,
  SyncableCourseGradingPeriodSettings,
  SyncableCourse,
  SyncableCourseWork,
  SyncableCourseWorkMaterial,
  SyncableGuardian,
  SyncableGuardianInvitation,
  SyncableInvitation,
  SyncableRubric,
  SyncableStudent,
  SyncableStudentGroup,
  SyncableStudentGroupMember,
  SyncableStudentSubmission,
  SyncableTeacher,
  SyncableTopic,
  SyncableUserProfile,
} from "../domain/classroom-types.js";
import type { ClassroomService } from "../lib/google/classroom-client.js";
import { GoogleClassroomService } from "../lib/google/classroom-client.js";
import type { DriveService } from "../lib/google/drive-client.js";
import { GoogleDriveService } from "../lib/google/drive-client.js";
import { buildStatusReport } from "../report/status-report.js";
import { closeDatabase, openDatabase } from "../storage/db.js";
import { createRepositories } from "../storage/repositories/index.js";
import { capturePendingStartPageToken, commitPendingCheckpoint } from "./checkpoints.js";

export interface FullSyncOptions {
  out: string;
  services?: {
    classroom?: ClassroomService;
    drive?: DriveService;
  };
  logger?: Pick<typeof console, "log">;
  now?: () => string;
}

export interface FullSyncResult {
  runId: string;
  status: "success" | "partial";
  artifacts: ManifestArtifactEntry[];
  statusRecords: StatusRecord[];
  pendingMaterializationCount: number;
  failuresCount: number;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function getBlobDownloadName(file: DriveFileRecord): string {
  return file.name?.trim() || `${file.driveFileId}.bin`;
}

function getExportDownloadName(file: DriveFileRecord, extension: string): string {
  const parsed = path.parse(file.name?.trim() || file.driveFileId);
  const baseName = parsed.name || parsed.base || file.driveFileId;
  return `${baseName}${extension}`;
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const withCode = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  if (typeof withCode.code === "number") {
    return withCode.code;
  }

  if (typeof withCode.status === "number") {
    return withCode.status;
  }

  return typeof withCode.response?.status === "number" ? withCode.response.status : null;
}

type CourseSyncBundle = {
  course: SyncableCourse;
  aliases: SyncableCourseAlias[];
  gradingPeriodSettings: SyncableCourseGradingPeriodSettings | null;
  topics: SyncableTopic[];
  announcements: SyncableAnnouncement[];
  courseWork: SyncableCourseWork[];
  rubricsByCourseWorkId: Record<string, SyncableRubric[]>;
  courseWorkMaterials: SyncableCourseWorkMaterial[];
  studentSubmissions: SyncableStudentSubmission[];
  students: SyncableStudent[];
  teachers: SyncableTeacher[];
  studentGroups: SyncableStudentGroup[];
  studentGroupMembersByGroupId: Record<string, SyncableStudentGroupMember[]>;
  visibilityStatus: CourseVisibilityStatus;
  hadResourceFailures: boolean;
};

function normalizeClassroomReasonCode(httpStatus: number | null): string {
  if (httpStatus === 403) {
    return "permission_denied";
  }

  if (httpStatus === 404) {
    return "not_returned";
  }

  if (httpStatus === 400) {
    return "domain_disabled";
  }

  return "classroom_resource_fetch_failed";
}

export async function runFullSync(options: FullSyncOptions): Promise<FullSyncResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const logger = options.logger;
  const paths = resolveAppPaths(options.out);
  await ensureAppDirectories(paths);

  const db = openDatabase(paths.databasePath);
  const repositories = createRepositories(db);
  const runId = `run_${randomUUID()}`;

  try {
    const clientConfig = await resolveRegisteredOAuthClient(paths.oauthClientPath);
    const accountKey = clientConfig.clientId;
    const authClient =
      options.services?.classroom || options.services?.drive
        ? null
        : await createAuthorizedClient({
            clientConfig,
            tokenStore: createTokenStore(),
            scopes: GOOGLE_OAUTH_SCOPES,
            accountKey,
          });

    const classroom = options.services?.classroom ?? new GoogleClassroomService(authClient);
    const drive = options.services?.drive ?? new GoogleDriveService(authClient);
    const driveAccount = await drive.getAbout();
    repositories.accounts.upsert({
      accountKey,
      email: driveAccount.email ?? null,
      displayName: driveAccount.displayName ?? null,
    });
    repositories.syncRuns.upsert({
      runId,
      accountKey,
      mode: "full",
      phase: "pending",
      status: "running",
      startedAt: now(),
    });

    const startPageToken = await drive.getStartPageToken();
    capturePendingStartPageToken(repositories, runId, startPageToken);

    repositories.syncRuns.upsert({
      runId,
      accountKey,
      mode: "full",
      phase: "classroom",
      status: "running",
      startedAt: repositories.syncRuns.get(runId)?.startedAt ?? now(),
      driveStartPageTokenCandidate: startPageToken,
    });

    logger?.log(`Starting full sync ${runId}`);
    logger?.log("Fetching Classroom data...");

    const statusRecords: StatusRecord[] = [];
    const persistStatusRecord = (status: StatusRecord) => {
      statusRecords.push(status);
      repositories.syncStatusRecords.insert(status);
    };
    const recordFailure = (failure: Omit<SyncFailureRecord, "runId">, status: Omit<StatusRecord, "runId">) => {
      repositories.failures.insert({ runId, ...failure });
      persistStatusRecord({ runId, ...status });
    };

    const fetchCourseResource = async <T>(args: {
      courseId: string;
      entityType:
        | "course"
        | "course_aliases"
        | "course_grading_period_settings"
        | "topics"
        | "announcements"
        | "course_work"
        | "rubrics"
        | "course_work_materials"
        | "student_submissions"
        | "students"
        | "teachers"
        | "student_groups"
        | "student_group_members";
      fetcher: () => Promise<T>;
    }): Promise<{ item: T; httpStatus: number | null }> => {
      try {
        return { item: await args.fetcher(), httpStatus: null };
      } catch (error) {
        const message = describeError(error);
        const httpStatus = getErrorStatus(error);
        const reasonCode = normalizeClassroomReasonCode(httpStatus);

        recordFailure(
          {
            scope: "classroom",
            entityType: args.entityType,
            entityId: args.courseId,
            status: "failed",
            reasonCode,
            message,
            detailsJson: httpStatus === null ? undefined : { httpStatus },
          },
          {
            scope: "classroom",
            entityType: args.entityType,
            entityId: args.courseId,
            status: "failed",
            message: `Failed to fetch ${args.entityType} for course ${args.courseId}: ${message}`,
          },
        );

        throw Object.assign(error instanceof Error ? error : new Error(message), { __openc__httpStatus: httpStatus });
      }
    };

    const fetchOptionalCourseResource = async <T>(args: {
      courseId: string;
      entityType: "course_aliases" | "course_grading_period_settings" | "rubrics" | "students" | "teachers" | "student_groups" | "student_group_members";
      emptyValue: T;
      fetcher: () => Promise<T>;
    }): Promise<{ item: T; httpStatus: number | null }> => {
      try {
        return await fetchCourseResource(args);
      } catch (error) {
        const httpStatus = (error as { __openc__httpStatus?: number | null }).__openc__httpStatus ?? getErrorStatus(error);
        return { item: args.emptyValue, httpStatus };
      }
    };

    const fetchCourseDetailResource = async <T>(args: {
      courseId: string;
      entityType:
        | "course"
        | "topics"
        | "announcements"
        | "course_work"
        | "course_work_materials"
        | "student_submissions"
        | "students"
        | "teachers"
        | "rubrics"
        | "invitations"
        | "guardians"
        | "guardian_invitations";
      itemId: string;
      fetcher: () => Promise<T>;
      fallback: T;
    }): Promise<T> => {
      try {
        return await args.fetcher();
      } catch (error) {
        const message = describeError(error);
        const httpStatus = getErrorStatus(error);
        recordFailure(
          {
            scope: "classroom",
            entityType: args.entityType,
            entityId: `${args.courseId}:${args.itemId}`,
            status: "failed",
            reasonCode: normalizeClassroomReasonCode(httpStatus),
            message,
            detailsJson: httpStatus === null ? undefined : { httpStatus },
          },
          {
            scope: "classroom",
            entityType: args.entityType,
            entityId: `${args.courseId}:${args.itemId}`,
            status: "failed",
            message: `Failed to fetch ${args.entityType} detail ${args.itemId}: ${message}`,
          },
        );
        return args.fallback;
      }
    };

    const fetchGlobalListResource = async <T>(args: {
      entityType: "invitations" | "user_profiles" | "guardians" | "guardian_invitations";
      fetcher: () => Promise<T[]>;
    }): Promise<T[]> => {
      try {
        return await args.fetcher();
      } catch (error) {
        const message = describeError(error);
        const httpStatus = getErrorStatus(error);
        recordFailure(
          {
            scope: "classroom",
            entityType: args.entityType,
            entityId: null,
            status: "failed",
            reasonCode: normalizeClassroomReasonCode(httpStatus),
            message,
            detailsJson: httpStatus === null ? undefined : { httpStatus },
          },
          {
            scope: "classroom",
            entityType: args.entityType,
            entityId: "global",
            status: "failed",
            message: `Failed to fetch ${args.entityType}: ${message}`,
          },
        );
        return [];
      }
    };

    const courses = await classroom.listCourses();
    const limit = pLimit(4);
    const detailLimit = pLimit(6);
    const courseBundles = await Promise.all(
      courses.map((course) =>
        limit(async (): Promise<CourseSyncBundle> => {
          const courseDetail = await fetchCourseDetailResource({
            courseId: course.id,
            entityType: "course",
            itemId: course.id,
            fetcher: () => classroom.getCourse(course.id),
            fallback: course,
          });
          const [aliases, gradingPeriodSettings, topics, announcements, courseWork, courseWorkMaterials, studentSubmissions, students, teachers, studentGroups] = await Promise.all([
            fetchOptionalCourseResource({ courseId: course.id, entityType: "course_aliases", emptyValue: [], fetcher: () => classroom.listCourseAliases(course.id) }),
            fetchOptionalCourseResource({
              courseId: course.id,
              entityType: "course_grading_period_settings",
              emptyValue: null,
              fetcher: () => classroom.getGradingPeriodSettings(course.id),
            }),
            fetchCourseResource({ courseId: course.id, entityType: "topics", fetcher: () => classroom.listTopics(course.id) }).catch((error) => ({ item: [], httpStatus: (error as { __openc__httpStatus?: number | null }).__openc__httpStatus ?? getErrorStatus(error) })),
            fetchCourseResource({ courseId: course.id, entityType: "announcements", fetcher: () => classroom.listAnnouncements(course.id) }).catch((error) => ({ item: [], httpStatus: (error as { __openc__httpStatus?: number | null }).__openc__httpStatus ?? getErrorStatus(error) })),
            fetchCourseResource({ courseId: course.id, entityType: "course_work", fetcher: () => classroom.listCourseWork(course.id) }).catch((error) => ({ item: [], httpStatus: (error as { __openc__httpStatus?: number | null }).__openc__httpStatus ?? getErrorStatus(error) })),
            fetchCourseResource({
              courseId: course.id,
              entityType: "course_work_materials",
              fetcher: () => classroom.listCourseWorkMaterials(course.id),
            }).catch((error) => ({ item: [], httpStatus: (error as { __openc__httpStatus?: number | null }).__openc__httpStatus ?? getErrorStatus(error) })),
            fetchCourseResource({
              courseId: course.id,
              entityType: "student_submissions",
              fetcher: () => classroom.listStudentSubmissions(course.id),
            }).catch((error) => ({ item: [], httpStatus: (error as { __openc__httpStatus?: number | null }).__openc__httpStatus ?? getErrorStatus(error) })),
            fetchOptionalCourseResource({ courseId: course.id, entityType: "students", emptyValue: [], fetcher: () => classroom.listStudents(course.id) }),
            fetchOptionalCourseResource({ courseId: course.id, entityType: "teachers", emptyValue: [], fetcher: () => classroom.listTeachers(course.id) }),
            fetchOptionalCourseResource({ courseId: course.id, entityType: "student_groups", emptyValue: [], fetcher: () => classroom.listStudentGroups(course.id) }),
          ]);

          const detailedTopics = await Promise.all(
            topics.item.map((item) =>
              detailLimit(() =>
                fetchCourseDetailResource({
                  courseId: course.id,
                  entityType: "topics",
                  itemId: item.topicId,
                  fetcher: () => classroom.getTopic(course.id, item.topicId),
                  fallback: item,
                }),
              ),
            ),
          );
          const detailedAnnouncements = await Promise.all(
            announcements.item.map((item) =>
              detailLimit(() =>
                fetchCourseDetailResource({
                  courseId: course.id,
                  entityType: "announcements",
                  itemId: item.announcementId,
                  fetcher: () => classroom.getAnnouncement(course.id, item.announcementId),
                  fallback: item,
                }),
              ),
            ),
          );
          const detailedCourseWork = await Promise.all(
            courseWork.item.map((item) =>
              detailLimit(() =>
                fetchCourseDetailResource({
                  courseId: course.id,
                  entityType: "course_work",
                  itemId: item.courseWorkId,
                  fetcher: () => classroom.getCourseWork(course.id, item.courseWorkId),
                  fallback: item,
                }),
              ),
            ),
          );
          const rubricsByCourseWorkIdEntries = await Promise.all(
            detailedCourseWork.map((item) =>
              detailLimit(async () => {
                const listed = await fetchOptionalCourseResource({
                  courseId: course.id,
                  entityType: "rubrics",
                  emptyValue: [],
                  fetcher: () => classroom.listRubrics(course.id, item.courseWorkId),
                });
                const rubrics = await Promise.all(
                  listed.item.map((rubric) =>
                    detailLimit(() =>
                      fetchCourseDetailResource({
                        courseId: course.id,
                        entityType: "rubrics",
                        itemId: `${item.courseWorkId}:${rubric.rubricId}`,
                        fetcher: () => classroom.getRubric(course.id, item.courseWorkId, rubric.rubricId),
                        fallback: rubric,
                      }),
                    ),
                  ),
                );
                return [item.courseWorkId, rubrics] as const;
              }),
            ),
          );
          const rubricsByCourseWorkId = Object.fromEntries(rubricsByCourseWorkIdEntries);
          const detailedCourseWorkMaterials = await Promise.all(
            courseWorkMaterials.item.map((item) =>
              detailLimit(() =>
                fetchCourseDetailResource({
                  courseId: course.id,
                  entityType: "course_work_materials",
                  itemId: item.courseWorkMaterialId,
                  fetcher: () => classroom.getCourseWorkMaterial(course.id, item.courseWorkMaterialId),
                  fallback: item,
                }),
              ),
            ),
          );
          const detailedStudentSubmissions = await Promise.all(
            studentSubmissions.item.map((item) =>
              detailLimit(() =>
                fetchCourseDetailResource({
                  courseId: course.id,
                  entityType: "student_submissions",
                  itemId: `${item.courseWorkId}:${item.submissionId}`,
                  fetcher: () => classroom.getStudentSubmission(course.id, item.courseWorkId, item.submissionId),
                  fallback: item,
                }),
              ),
            ),
          );
          const detailedStudents = await Promise.all(
            students.item.map((item) =>
              detailLimit(() =>
                fetchCourseDetailResource({
                  courseId: course.id,
                  entityType: "students",
                  itemId: item.userId,
                  fetcher: () => classroom.getStudent(course.id, item.userId),
                  fallback: item,
                }),
              ),
            ),
          );
          const detailedTeachers = await Promise.all(
            teachers.item.map((item) =>
              detailLimit(() =>
                fetchCourseDetailResource({
                  courseId: course.id,
                  entityType: "teachers",
                  itemId: item.userId,
                  fetcher: () => classroom.getTeacher(course.id, item.userId),
                  fallback: item,
                }),
              ),
            ),
          );
          const studentGroupMembersByGroupIdEntries = await Promise.all(
            studentGroups.item.map((group) =>
              detailLimit(async () => {
                const members = await fetchOptionalCourseResource({
                  courseId: course.id,
                  entityType: "student_group_members",
                  emptyValue: [],
                  fetcher: () => classroom.listStudentGroupMembers(course.id, group.studentGroupId),
                });
                return [group.studentGroupId, members.item] as const;
              }),
            ),
          );
          const studentGroupMembersByGroupId = Object.fromEntries(studentGroupMembersByGroupIdEntries);

          const httpStatuses = [
            topics.httpStatus,
            announcements.httpStatus,
            courseWork.httpStatus,
            courseWorkMaterials.httpStatus,
            studentSubmissions.httpStatus,
          ];

          const visibilityStatus = httpStatuses.includes(403)
            ? "permission_denied"
            : httpStatuses.includes(404)
              ? "not_returned"
              : "visible";

          return {
            course: courseDetail,
            aliases: aliases.item,
            gradingPeriodSettings: gradingPeriodSettings.item,
            topics: detailedTopics,
            announcements: detailedAnnouncements,
            courseWork: detailedCourseWork,
            rubricsByCourseWorkId,
            courseWorkMaterials: detailedCourseWorkMaterials,
            studentSubmissions: detailedStudentSubmissions,
            students: detailedStudents,
            teachers: detailedTeachers,
            studentGroups: studentGroups.item,
            studentGroupMembersByGroupId,
            visibilityStatus,
            hadResourceFailures: httpStatuses.some((status) => status !== null),
          };
        }),
      ),
    );

    logger?.log(`Fetched ${courseBundles.length} courses.`);

    const invitations = await fetchGlobalListResource({ entityType: "invitations", fetcher: () => classroom.listInvitations() });
    const detailedInvitations = await Promise.all(
      invitations.map((invitation) =>
        fetchCourseDetailResource({
          courseId: invitation.courseId ?? "global",
          entityType: "invitations",
          itemId: invitation.invitationId,
          fetcher: () => classroom.getInvitation(invitation.invitationId),
          fallback: invitation,
        }),
      ),
    );

    const userIds = new Set<string>();
    userIds.add("me");
    for (const bundle of courseBundles) {
      for (const student of bundle.students) {
        userIds.add(student.userId);
      }
      for (const teacher of bundle.teachers) {
        userIds.add(teacher.userId);
      }
    }
    for (const invitation of detailedInvitations) {
      if (invitation.userId) {
        userIds.add(invitation.userId);
      }
    }
    const userProfiles = (
      await Promise.all(
        [...userIds].map(async (userId) => {
          try {
            return await classroom.getUserProfile(userId);
          } catch (error) {
            const message = describeError(error);
            const httpStatus = getErrorStatus(error);
            recordFailure(
              {
                scope: "classroom",
                entityType: "user_profiles",
                entityId: userId,
                status: "failed",
                reasonCode: normalizeClassroomReasonCode(httpStatus),
                message,
                detailsJson: httpStatus === null ? undefined : { httpStatus },
              },
              {
                scope: "classroom",
                entityType: "user_profiles",
                entityId: userId,
                status: "failed",
                message: `Failed to fetch user profile ${userId}: ${message}`,
              },
            );
            return null;
          }
        }),
      )
    ).filter((item): item is SyncableUserProfile => item !== null);

    const guardians = await fetchGlobalListResource({ entityType: "guardians", fetcher: () => classroom.listGuardians("me") });
    const detailedGuardians = await Promise.all(
      guardians.map((guardian) =>
        fetchCourseDetailResource({
          courseId: guardian.studentId,
          entityType: "guardians",
          itemId: guardian.guardianId,
          fetcher: () => classroom.getGuardian(guardian.studentId, guardian.guardianId),
          fallback: guardian,
        }),
      ),
    );
    const guardianInvitations = await fetchGlobalListResource({
      entityType: "guardian_invitations",
      fetcher: () => classroom.listGuardianInvitations("me"),
    });
    const detailedGuardianInvitations = await Promise.all(
      guardianInvitations.map((invitation) =>
        fetchCourseDetailResource({
          courseId: invitation.studentId,
          entityType: "guardian_invitations",
          itemId: invitation.invitationId,
          fetcher: () => classroom.getGuardianInvitation(invitation.studentId, invitation.invitationId),
          fallback: invitation,
        }),
      ),
    );

    repositories.invitations.replaceAll(detailedInvitations);
    for (const profile of userProfiles) {
      repositories.userProfiles.upsert(profile);
    }
    repositories.guardians.replaceForStudent("me", detailedGuardians);
    repositories.guardianInvitations.replaceForStudent("me", detailedGuardianInvitations);
    for (const bundle of courseBundles) {
      repositories.courses.upsert(bundle.course, runId, bundle.visibilityStatus);
      repositories.courseAliases.replaceForCourse(bundle.course.id, bundle.aliases);
      repositories.courseGradingPeriodSettings.replaceForCourse(bundle.course.id, bundle.gradingPeriodSettings);
      repositories.topics.replaceForCourse(bundle.course.id, bundle.topics);
      repositories.announcements.replaceForCourse(bundle.course.id, bundle.announcements);
      repositories.courseWork.replaceForCourse(bundle.course.id, bundle.courseWork);
      for (const [courseWorkId, rubrics] of Object.entries(bundle.rubricsByCourseWorkId)) {
        repositories.rubrics.replaceForCourseWork(bundle.course.id, courseWorkId, rubrics);
      }
      repositories.courseWorkMaterials.replaceForCourse(bundle.course.id, bundle.courseWorkMaterials);
      repositories.studentSubmissions.replaceForCourse(bundle.course.id, bundle.studentSubmissions);
      repositories.students.replaceForCourse(bundle.course.id, bundle.students);
      repositories.teachers.replaceForCourse(bundle.course.id, bundle.teachers);
      repositories.studentGroups.replaceForCourse(bundle.course.id, bundle.studentGroups);
      for (const [groupId, members] of Object.entries(bundle.studentGroupMembersByGroupId)) {
        repositories.studentGroupMembers.replaceForGroup(bundle.course.id, groupId, members);
      }

      const courseMaterialRefs = [
        ...bundle.announcements.flatMap((item) =>
          resolveCourseMaterialDriveReferences({
            courseId: bundle.course.id,
            announcementId: item.announcementId,
            materials: item.materials ?? null,
          }),
        ),
        ...bundle.courseWork.flatMap((item) =>
          resolveCourseMaterialDriveReferences({ courseId: bundle.course.id, courseWorkId: item.courseWorkId, materials: item.materials ?? null }),
        ),
        ...bundle.courseWorkMaterials.flatMap((item) =>
          resolveCourseMaterialDriveReferences({
            courseId: bundle.course.id,
            courseWorkMaterialId: item.courseWorkMaterialId,
            materials: item.materials ?? null,
          }),
        ),
      ];
      const submissionRefs = bundle.studentSubmissions.flatMap((submission) =>
        resolveSubmissionDriveReferences({
          courseId: bundle.course.id,
          courseWorkId: submission.courseWorkId,
          submissionId: submission.submissionId,
          templateDriveFileIds: courseMaterialRefs
            .filter(
              (ref) =>
                ref.courseWorkId === submission.courseWorkId &&
                ref.materializationState === "pending_materialization" &&
                Boolean(ref.templateDriveFileId),
            )
            .map((ref) => ref.templateDriveFileId as string),
          attachments: submission.assignmentSubmission?.attachments ?? [],
        }),
      );

      repositories.driveFileRefs.replaceForCourse(bundle.course.id, [...courseMaterialRefs, ...submissionRefs]);
      persistStatusRecord({
        runId,
        scope: "classroom",
        entityType: "course",
        entityId: bundle.course.id,
        status: bundle.hadResourceFailures ? "partial" : "success",
        message: bundle.hadResourceFailures ? `Synced course ${bundle.course.id} with some missing resources` : `Synced course ${bundle.course.id}`,
      });
      persistStatusRecord({
        runId,
        scope: "classroom",
        entityType: "course_comments",
        entityId: bundle.course.id,
        status: "unsupported",
        message: "Classroom post comments and private comments are unsupported by the API.",
      });
      repositories.failures.insert({
        runId,
        scope: "classroom",
        entityType: "course_comments",
        entityId: bundle.course.id,
        status: "unsupported",
        reasonCode: "unsupported_by_api",
        message: "Classroom post comments and private comments are unsupported by the API.",
      });
    }

    repositories.syncRuns.upsert({
      runId,
      accountKey,
      mode: "full",
      phase: "drive",
      status: "running",
      startedAt: repositories.syncRuns.get(runId)?.startedAt ?? now(),
      driveStartPageTokenCandidate: startPageToken,
    });

    const artifacts: ManifestArtifactEntry[] = [];
    const driveFileIds = repositories.driveFileRefs.listReadyDriveFileIds();
    logger?.log(`Fetching ${driveFileIds.length} Drive files...`);
    for (const [index, driveFileId] of driveFileIds.entries()) {
      logger?.log(`[${index + 1}/${driveFileIds.length}] Fetching Drive file ${driveFileId}`);

      let fileHadFailures = false;
      let file: DriveFileRecord;
      try {
        file = await drive.getFile(driveFileId);
      } catch (error) {
        const message = describeError(error);
        recordFailure(
          {
            scope: "drive",
            entityType: "drive_file",
            entityId: driveFileId,
            status: "failed",
            reasonCode: "drive_file_fetch_failed",
            message,
          },
          {
            scope: "drive",
            entityType: "drive_file",
            entityId: driveFileId,
            status: "failed",
            message: `Failed to fetch Drive file ${driveFileId}: ${message}`,
          },
        );
        logger?.log(`[${index + 1}/${driveFileIds.length}] Failed to fetch Drive file ${driveFileId}; continuing.`);
        continue;
      }

      repositories.driveFiles.upsert(file);

      try {
        const comments = await drive.listComments(driveFileId);
        repositories.driveComments.replaceForFile(driveFileId, comments);
      } catch (error) {
        const message = describeError(error);
        fileHadFailures = true;
        recordFailure(
          {
            scope: "drive",
            entityType: "drive_comments",
            entityId: driveFileId,
            status: "failed",
            reasonCode: "drive_comments_fetch_failed",
            message,
          },
          {
            scope: "drive",
            entityType: "drive_comments",
            entityId: driveFileId,
            status: "failed",
            message: `Failed to fetch Drive comments for ${driveFileId}: ${message}`,
          },
        );
        logger?.log(`[${index + 1}/${driveFileIds.length}] Failed to fetch comments for ${driveFileId}; continuing.`);
      }

      if (file.mimeType && !isGoogleWorkspaceMimeType(file.mimeType)) {
        try {
          const blob = await drive.downloadBlob(driveFileId);
          const sizeBytes = blob.byteLength;
          const blobId = sha256Hex(blob);
          repositories.artifactBlobs.upsert(blob, blobId, sizeBytes);
          const entry = repositories.driveFileArtifacts.upsert({
            driveFileId,
            artifactKind: "blob",
            outputMimeType: file.mimeType,
            downloadName: getBlobDownloadName(file),
            status: "saved",
            blobId,
            sizeBytes,
            checksumType: "sha256",
            checksumValue: blobId,
            sourceModifiedTime: file.modifiedTime ?? null,
          });
          artifacts.push(entry);
        } catch (error) {
          const message = describeError(error);
          fileHadFailures = true;
          recordFailure(
            {
              scope: "drive",
              entityType: "blob",
              entityId: driveFileId,
              status: "failed",
              reasonCode: "blob_download_failed",
              message,
            },
            {
              scope: "drive",
              entityType: "blob",
              entityId: driveFileId,
              status: "failed",
              message: `Failed to download blob for ${driveFileId}: ${message}`,
            },
          );
          const fallbackEntry = repositories.driveFileArtifacts.upsert({
            driveFileId,
            artifactKind: "blob",
            outputMimeType: file.mimeType,
            downloadName: getBlobDownloadName(file),
            status: "failed",
            blobId: null,
            sizeBytes: null,
            checksumType: null,
            checksumValue: null,
            sourceModifiedTime: file.modifiedTime ?? null,
          });
          artifacts.push(fallbackEntry);
          logger?.log(`[${index + 1}/${driveFileIds.length}] Failed to download blob for ${driveFileId}; continuing.`);
        }
      }

      if (isGoogleWorkspaceMimeType(file.mimeType)) {
        const targets = getExportTargets(file.mimeType);
        let savedAny = false;
        for (const target of targets) {
          try {
            const content = await drive.exportFile(driveFileId, target.mimeType);
            const sizeBytes = content.byteLength;
            const blobId = sha256Hex(content);
            repositories.artifactBlobs.upsert(content, blobId, sizeBytes);
            const entry = repositories.driveFileArtifacts.upsert({
              driveFileId,
              artifactKind: "export",
              outputMimeType: target.mimeType,
              downloadName: getExportDownloadName(file, target.extension),
              status: "saved",
              blobId,
              sizeBytes,
              checksumType: "sha256",
              checksumValue: blobId,
              sourceModifiedTime: file.modifiedTime ?? null,
            });
            artifacts.push(entry);
            savedAny = true;
          } catch (error) {
            const message = describeError(error);
            fileHadFailures = true;
            recordFailure(
              {
                scope: "drive",
                entityType: "export",
                entityId: `${driveFileId}:${target.mimeType}`,
                status: "failed",
                reasonCode: "export_failed",
                message,
              },
              {
                scope: "drive",
                entityType: "export",
                entityId: `${driveFileId}:${target.mimeType}`,
                status: "failed",
                message: `Failed to export ${driveFileId} as ${target.mimeType}: ${message}`,
              },
            );
            logger?.log(`[${index + 1}/${driveFileIds.length}] Failed to export ${driveFileId} as ${target.mimeType}; continuing.`);
          }
        }

        if (!savedAny) {
          const fallbackEntry = repositories.driveFileArtifacts.upsert({
            driveFileId,
            artifactKind: "export",
            outputMimeType: targets[0]?.mimeType ?? null,
            downloadName: getExportDownloadName(file, targets[0]?.extension ?? ".bin"),
            status: "failed",
            blobId: null,
            sizeBytes: null,
            checksumType: null,
            checksumValue: null,
            sourceModifiedTime: file.modifiedTime ?? null,
          });
          artifacts.push(fallbackEntry);
        }
      }

      persistStatusRecord({
        runId,
        scope: "drive",
        entityType: "drive_file",
        entityId: driveFileId,
        status: fileHadFailures ? "partial" : "success",
        message: fileHadFailures ? `Backed up Drive file ${driveFileId} with some failures` : `Backed up Drive file ${driveFileId}`,
      });
    }

    const pendingMaterializationCount = repositories.driveFileRefs.listPendingMaterializationRefs().length;
    if (pendingMaterializationCount > 0) {
      persistStatusRecord({
        runId,
        scope: "drive",
        entityType: "pending_materialization",
        entityId: "pending_materialization",
        status: "skipped",
        message: `${pendingMaterializationCount} Drive references are waiting for materialization.`,
      });
    }

    const failures = repositories.failures.listByRun(runId);
    const failuresCount = failures.length;
    const report = buildStatusReport({
      runId,
      records: statusRecords,
      pendingMaterializationCount,
      failuresCount,
    });

    repositories.syncRuns.upsert({
      runId,
      accountKey,
      mode: "full",
      phase: "reporting",
      status: failures.some((failure) => failure.status === "failed") ? "partial" : "success",
      startedAt: repositories.syncRuns.get(runId)?.startedAt ?? now(),
      driveStartPageTokenCandidate: startPageToken,
    });

    commitPendingCheckpoint(repositories, accountKey, runId, now());

    const finalStatus = failures.some((failure) => failure.status === "failed") ? "partial" : "success";
    repositories.syncRuns.upsert({
      runId,
      accountKey,
      mode: "full",
      phase: "completed",
      status: finalStatus,
      startedAt: repositories.syncRuns.get(runId)?.startedAt ?? now(),
      driveStartPageTokenCandidate: startPageToken,
      completedAt: now(),
      summaryJson: report,
    });

    return {
      runId,
      status: finalStatus,
      artifacts,
      statusRecords,
      pendingMaterializationCount,
      failuresCount,
    };
  } catch (error) {
    const run = repositories.syncRuns.get(runId);
    if (run) {
      repositories.syncRuns.upsert({
        ...run,
        status: "failed",
        completedAt: now(),
      });
    }
    throw error;
  } finally {
    closeDatabase(db);
  }
}
