import { describe, expect, it, vi } from "vitest";

import { runBackupFullCommand } from "../../src/commands/backup-full.js";

describe("runBackupFullCommand", () => {
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

    await runBackupFullCommand({ out: "C:/backup", driveConcurrency: "6" }, { runSync, logger });

    expect(runSync).toHaveBeenCalledWith({
      out: "C:/backup",
      driveConcurrency: 6,
      logger,
    });
  });

  it("rejects invalid drive concurrency", async () => {
    await expect(runBackupFullCommand({ out: "C:/backup", driveConcurrency: "0" })).rejects.toThrow(
      "Invalid drive concurrency: 0",
    );
  });
});
