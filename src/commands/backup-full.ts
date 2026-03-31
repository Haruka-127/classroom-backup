import { runFullSync } from "../sync/full-sync.js";
import { parseDriveConcurrency } from "./drive-concurrency.js";

export interface BackupFullCommandOptions {
  out: string;
  driveConcurrency?: number | string;
}

interface BackupFullCommandDependencies {
  runSync?: typeof runFullSync;
  logger?: Pick<typeof console, "log">;
}

export async function runBackupFullCommand(
  options: BackupFullCommandOptions,
  dependencies: BackupFullCommandDependencies = {},
): Promise<void> {
  const runSync = dependencies.runSync ?? runFullSync;
  const logger = dependencies.logger ?? console;
  const result = await runSync({
    out: options.out,
    driveConcurrency: parseDriveConcurrency(options.driveConcurrency),
    logger,
  });
  logger.log(`Full sync completed with status: ${result.status}`);
  logger.log(`Run ID: ${result.runId}`);
  logger.log(`Artifacts recorded: ${result.artifacts.length}`);
  logger.log(`Pending materialization references: ${result.pendingMaterializationCount}`);
}
