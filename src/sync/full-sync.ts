import path from "node:path";
import { randomUUID } from "node:crypto";

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
import type { ManifestArtifactEntry, StatusRecord } from "../domain/classroom-types.js";
import type { ClassroomService } from "../lib/google/classroom-client.js";
import { GoogleClassroomService } from "../lib/google/classroom-client.js";
import type { DriveService } from "../lib/google/drive-client.js";
import { GoogleDriveService } from "../lib/google/drive-client.js";
import { buildStatusReport, writeStatusReport } from "../report/status-report.js";
import { closeDatabase, openDatabase } from "../storage/db.js";
import { FileStore } from "../storage/file-store.js";
import { JsonStore } from "../storage/json-store.js";
import { writeManifest } from "../storage/manifest.js";
import { createRepositories } from "../storage/repositories/index.js";
import { capturePendingStartPageToken, commitPendingCheckpoint } from "./checkpoints.js";

export interface FullSyncOptions {
  out: string;
  services?: {
    classroom?: ClassroomService;
    drive?: DriveService;
  };
  now?: () => string;
}

export interface FullSyncResult {
  runId: string;
  status: "success" | "partial";
  artifacts: ManifestArtifactEntry[];
  statusRecords: StatusRecord[];
  pendingMaterializationCount: number;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export async function runFullSync(options: FullSyncOptions): Promise<FullSyncResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const paths = resolveAppPaths(options.out);
  await ensureAppDirectories(paths);

  const db = openDatabase(paths.databasePath);
  const repositories = createRepositories(db);
  const jsonStore = new JsonStore(paths.jsonRoot);
  const fileStore = new FileStore(paths.filesRoot);
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

    const courseBundles = await classroom.fetchCourseBundles();
    await jsonStore.write(path.join("runs", runId, "courses.json"), courseBundles);

    const statusRecords: StatusRecord[] = [];

    for (const bundle of courseBundles) {
      repositories.courses.upsert(bundle.course, runId, "visible");
      repositories.topics.replaceForCourse(bundle.course.id, bundle.topics);
      repositories.announcements.replaceForCourse(bundle.course.id, bundle.announcements);
      repositories.courseWork.replaceForCourse(bundle.course.id, bundle.courseWork);
      repositories.courseWorkMaterials.replaceForCourse(bundle.course.id, bundle.courseWorkMaterials);
      repositories.studentSubmissions.replaceForCourse(bundle.course.id, bundle.studentSubmissions);

      const courseMaterialRefs = [
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
      const templateIds = courseMaterialRefs
        .filter((ref) => ref.materializationState === "pending_materialization" && ref.templateDriveFileId)
        .map((ref) => ref.templateDriveFileId as string);

      const submissionRefs = bundle.studentSubmissions.flatMap((submission) =>
        resolveSubmissionDriveReferences({
          courseId: bundle.course.id,
          courseWorkId: submission.courseWorkId,
          submissionId: submission.submissionId,
          templateDriveFileIds: templateIds,
          attachments: submission.assignmentSubmission?.attachments ?? [],
        }),
      );

      repositories.driveFileRefs.replaceForCourse(bundle.course.id, [...courseMaterialRefs, ...submissionRefs]);
      statusRecords.push({
        runId,
        scope: "classroom",
        entityType: "course",
        entityId: bundle.course.id,
        status: "success",
        message: `Synced course ${bundle.course.id}`,
      });
      statusRecords.push({
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
    for (const driveFileId of driveFileIds) {
      const file = await drive.getFile(driveFileId);
      repositories.driveFiles.upsert(file);
      await jsonStore.write(path.join("runs", runId, "drive", `${sanitizePathSegment(driveFileId)}.json`), file);

      const comments = await drive.listComments(driveFileId);
      repositories.driveComments.replaceForFile(driveFileId, comments);
      await jsonStore.write(path.join("runs", runId, "drive-comments", `${sanitizePathSegment(driveFileId)}.comments.json`), comments);

      if (file.mimeType && !isGoogleWorkspaceMimeType(file.mimeType)) {
        const blob = await drive.downloadBlob(driveFileId);
        const extension = path.extname(file.name ?? "") || ".bin";
        const saved = await fileStore.saveBuffer(path.join(driveFileId, `blob${extension}`), blob, file.md5Checksum ? "md5" : "sha256");
        const entry: ManifestArtifactEntry = {
          driveFileId,
          artifactKind: "blob",
          outputMimeType: file.mimeType,
          relativePath: saved.relativePath,
          status: "saved",
          sizeBytes: saved.sizeBytes,
          checksumType: file.md5Checksum ? "md5" : saved.checksumType,
          checksumValue: file.md5Checksum ?? saved.checksumValue,
          sourceModifiedTime: file.modifiedTime ?? null,
        };
        repositories.driveFileArtifacts.upsert(entry);
        artifacts.push(entry);
      }

      if (isGoogleWorkspaceMimeType(file.mimeType)) {
        const targets = getExportTargets(file.mimeType);
        let savedAny = false;
        for (const target of targets) {
          try {
            const content = await drive.exportFile(driveFileId, target.mimeType);
            const saved = await fileStore.saveBuffer(path.join(driveFileId, `export${target.extension}`), content);
            const entry: ManifestArtifactEntry = {
              driveFileId,
              artifactKind: "export",
              outputMimeType: target.mimeType,
              relativePath: saved.relativePath,
              status: "saved",
              sizeBytes: saved.sizeBytes,
              checksumType: saved.checksumType,
              checksumValue: saved.checksumValue,
              sourceModifiedTime: file.modifiedTime ?? null,
            };
            repositories.driveFileArtifacts.upsert(entry);
            artifacts.push(entry);
            savedAny = true;
          } catch (error) {
            repositories.failures.insert({
              runId,
              scope: "drive",
              entityType: "export",
              entityId: `${driveFileId}:${target.mimeType}`,
              status: "failed",
              reasonCode: "export_failed",
              message: String(error),
            });
          }
        }

        if (!savedAny) {
          const fallbackEntry: ManifestArtifactEntry = {
            driveFileId,
            artifactKind: "export",
            outputMimeType: targets[0]?.mimeType ?? null,
            relativePath: path.join(driveFileId, "export.unavailable"),
            status: "failed",
            sizeBytes: null,
            checksumType: null,
            checksumValue: null,
            sourceModifiedTime: file.modifiedTime ?? null,
          };
          repositories.driveFileArtifacts.upsert(fallbackEntry);
          artifacts.push(fallbackEntry);
        }
      }

      statusRecords.push({
        runId,
        scope: "drive",
        entityType: "drive_file",
        entityId: driveFileId,
        status: "success",
        message: `Backed up Drive file ${driveFileId}`,
      });
    }

    const pendingMaterializationCount = repositories.driveFileRefs.listPendingMaterializationRefs().length;
    if (pendingMaterializationCount > 0) {
      statusRecords.push({
        runId,
        scope: "drive",
        entityType: "pending_materialization",
        entityId: "pending_materialization",
        status: "skipped",
        message: `${pendingMaterializationCount} Drive references are waiting for materialization.`,
      });
    }

    repositories.syncRuns.upsert({
      runId,
      accountKey,
      mode: "full",
      phase: "reporting",
      status: repositories.failures.listByRun(runId).some((failure) => failure.status === "failed") ? "partial" : "success",
      startedAt: repositories.syncRuns.get(runId)?.startedAt ?? now(),
      driveStartPageTokenCandidate: startPageToken,
    });

    const report = buildStatusReport(runId, statusRecords);
    await writeStatusReport(paths.statusReportPath, report);
    await writeManifest(paths.manifestPath, {
      generatedAt: now(),
      runId,
      artifacts,
      pendingMaterializationCount,
      failuresCount: repositories.failures.listByRun(runId).length,
    });

    commitPendingCheckpoint(repositories, accountKey, runId, now());

    const finalStatus = repositories.failures.listByRun(runId).some((failure) => failure.status === "failed") ? "partial" : "success";
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
