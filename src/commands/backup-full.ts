import { runFullSync } from "../sync/full-sync.js";

export interface BackupFullCommandOptions {
  out: string;
}

export async function runBackupFullCommand(options: BackupFullCommandOptions): Promise<void> {
  const result = await runFullSync({ out: options.out, logger: console });
  console.log(`Full sync completed with status: ${result.status}`);
  console.log(`Run ID: ${result.runId}`);
  console.log(`Artifacts recorded: ${result.artifacts.length}`);
  console.log(`Pending materialization references: ${result.pendingMaterializationCount}`);
}
