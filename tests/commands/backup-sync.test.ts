import { describe, expect, it, vi } from "vitest";

import { runBackupSyncCommand } from "../../src/commands/backup-sync.js";

describe("runBackupSyncCommand", () => {
  it("parses and forwards drive concurrency", async () => {
    const runSync = vi.fn(async () => ({
      runId: "run-1",
      status: "success" as const,
      artifacts: [],
      statusRecords: [],
      pendingMaterializationCount: 0,
      failuresCount: 0,
    }));
    const logger = { log: vi.fn() };

    await runBackupSyncCommand({ out: "C:/backup", driveConcurrency: "3" }, { runSync, logger });

    expect(runSync).toHaveBeenCalledWith({
      out: "C:/backup",
      driveConcurrency: 3,
      logger,
    });
  });
});
