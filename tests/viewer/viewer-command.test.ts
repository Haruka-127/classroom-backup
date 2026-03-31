import { describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";

import { runViewerCommand } from "../../src/commands/viewer.js";

describe("runViewerCommand", () => {
  it("starts the viewer, prints details, and opens the browser when requested", async () => {
    const close = vi.fn(async () => {});
    const startServer = vi.fn(async () => ({
      origin: "http://127.0.0.1:4173",
      outDir: "C:/backup",
      port: 4173,
      close,
    }));
    const openBrowser = vi.fn(async () => ({}) as ChildProcess);
    const waitForShutdown = vi.fn(async () => {});
    const logger = { log: vi.fn() };

    await runViewerCommand(
      { out: "C:/backup", port: "4173", open: true },
      { startServer, openBrowser, waitForShutdown, logger },
    );

    expect(startServer).toHaveBeenCalledWith({ outDir: "C:/backup", port: 4173 });
    expect(openBrowser).toHaveBeenCalledWith("http://127.0.0.1:4173");
    expect(logger.log).toHaveBeenCalled();
  });
});
