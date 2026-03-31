import open from "open";

import { startViewerServer, type ViewerServerHandle } from "../viewer/server.js";

export interface ViewerCommandOptions {
  out: string;
  port?: number | string;
  open?: boolean;
}

interface ViewerCommandDependencies {
  startServer?: typeof startViewerServer;
  openBrowser?: typeof open;
  waitForShutdown?: (server: ViewerServerHandle) => Promise<void>;
  logger?: Pick<typeof console, "log">;
}

function parsePort(value: number | string | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "4173", 10);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid viewer port: ${String(value)}`);
  }

  return parsed;
}

async function waitForShutdown(server: ViewerServerHandle): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let closed = false;

    const cleanup = () => {
      process.off("SIGINT", handleSignal);
      process.off("SIGTERM", handleSignal);
    };

    const handleSignal = () => {
      if (closed) {
        return;
      }

      closed = true;
      cleanup();
      void server.close().then(resolve, reject);
    };

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
  });
}

export async function runViewerCommand(
  options: ViewerCommandOptions,
  dependencies: ViewerCommandDependencies = {},
): Promise<void> {
  const startServer = dependencies.startServer ?? startViewerServer;
  const openBrowser = dependencies.openBrowser ?? open;
  const logger = dependencies.logger ?? console;
  const server = await startServer({
    outDir: options.out,
    port: parsePort(options.port),
  });

  logger.log(`Viewer running at ${server.origin}`);
  logger.log(`Reading backup from ${server.outDir}`);
  logger.log("Press Ctrl+C to stop the viewer.");

  if (options.open) {
    await openBrowser(server.origin);
  }

  await (dependencies.waitForShutdown ?? waitForShutdown)(server);
}
