import { randomUUID } from "node:crypto";

import { createAuthorizedClient } from "../auth/oauth.js";
import { createTokenStore } from "../auth/token-store.js";
import { ensureAppDirectories, resolveAppPaths } from "../config/app-paths.js";
import { resolveRegisteredOAuthClient } from "../config/oauth-client.js";
import { GOOGLE_OAUTH_SCOPES } from "../config/scopes.js";
import type { ClassroomService } from "../lib/google/classroom-client.js";
import { GoogleClassroomService } from "../lib/google/classroom-client.js";
import type { DriveService } from "../lib/google/drive-client.js";
import { GoogleDriveService } from "../lib/google/drive-client.js";
import { buildStatusReport, writeStatusReport } from "../report/status-report.js";
import { closeDatabase, openDatabase } from "../storage/db.js";
import { writeManifest } from "../storage/manifest.js";
import { createRepositories } from "../storage/repositories/index.js";
import { loadCommittedCheckpoint } from "./checkpoints.js";
import { runFullSync } from "./full-sync.js";

export interface IncrementalSyncOptions {
  out: string;
  services?: {
    classroom?: ClassroomService;
    drive?: DriveService;
  };
  logger?: Pick<typeof console, "log">;
  now?: () => string;
}

export async function runIncrementalSync(options: IncrementalSyncOptions) {
  const now = options.now ?? (() => new Date().toISOString());
  const logger = options.logger;
  const paths = resolveAppPaths(options.out);
  await ensureAppDirectories(paths);
  const db = openDatabase(paths.databasePath);
  const repositories = createRepositories(db);

  try {
    const clientConfig = await resolveRegisteredOAuthClient(paths.oauthClientPath);
    const accountKey = clientConfig.clientId;
    const checkpoint = loadCommittedCheckpoint(repositories, accountKey);

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

    logger?.log("Starting incremental sync");

    const existingCourseIds = new Set(repositories.courses.listIds());
    const bundles = await classroom.fetchCourseBundles();
    const visibleCourseIds = new Set(bundles.map((bundle) => bundle.course.id));

    for (const courseId of existingCourseIds) {
      if (!visibleCourseIds.has(courseId)) {
        repositories.courses.markMissing(courseId, "not_returned");
      }
    }

    const result = await runFullSync({
      out: options.out,
      services: { classroom, drive },
      logger,
      now,
    });

    const changedFileIds = checkpoint?.committedStartPageToken
      ? await drive.listChanges(checkpoint.committedStartPageToken).then((changes) => changes.filter((change) => !change.removed).map((change) => change.fileId))
      : [];
    logger?.log(`Re-fetched ${changedFileIds.length} changed Drive files since last committed checkpoint.`);

    const report = buildStatusReport(result.runId, [
      ...result.statusRecords,
      {
        runId: result.runId,
        scope: "drive_changes",
        entityType: "checkpoint",
        entityId: checkpoint?.committedStartPageToken ?? "none",
        status: "success",
        message: `Re-fetched ${changedFileIds.length} changed Drive files since last committed checkpoint.`,
      },
    ]);
    await writeStatusReport(paths.statusReportPath, report);
    await writeManifest(paths.manifestPath, {
      generatedAt: now(),
      runId: result.runId,
      artifacts: result.artifacts,
      pendingMaterializationCount: result.pendingMaterializationCount,
      failuresCount: result.failuresCount,
    });

    const pendingRun = repositories.syncRuns.findPendingRun(accountKey, "incremental");
    repositories.syncRuns.upsert({
      runId: pendingRun?.runId ?? `run_${randomUUID()}`,
      accountKey,
      mode: "incremental",
      phase: "completed",
      status: result.status,
      startedAt: pendingRun?.startedAt ?? now(),
      completedAt: now(),
      summaryJson: report,
    });

    return result;
  } finally {
    closeDatabase(db);
  }
}
