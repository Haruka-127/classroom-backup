import { runIncrementalSync } from "../sync/incremental-sync.js";

export interface BackupSyncCommandOptions {
  out: string;
}

export async function runBackupSyncCommand(options: BackupSyncCommandOptions): Promise<void> {
  const result = await runIncrementalSync({ out: options.out });
  console.log(`Incremental sync completed with status: ${result.status}`);
  console.log(`Run ID: ${result.runId}`);
  console.log(`Artifacts recorded: ${result.artifacts.length}`);
}
