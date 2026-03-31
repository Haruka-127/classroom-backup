import { runIncrementalSync } from "../sync/incremental-sync.js";
import { parseDriveConcurrency } from "./drive-concurrency.js";

export interface BackupSyncCommandOptions {
  out: string;
  driveConcurrency?: number | string;
}

interface BackupSyncCommandDependencies {
  runSync?: typeof runIncrementalSync;
  logger?: Pick<typeof console, "log">;
}

export async function runBackupSyncCommand(
  options: BackupSyncCommandOptions,
  dependencies: BackupSyncCommandDependencies = {},
): Promise<void> {
  const runSync = dependencies.runSync ?? runIncrementalSync;
  const logger = dependencies.logger ?? console;
  const result = await runSync({
    out: options.out,
    driveConcurrency: parseDriveConcurrency(options.driveConcurrency),
    logger,
  });
  logger.log(`Incremental sync completed with status: ${result.status}`);
  logger.log(`Run ID: ${result.runId}`);
  logger.log(`Artifacts recorded: ${result.artifacts.length}`);
}
