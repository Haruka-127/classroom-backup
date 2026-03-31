import { writeFile } from "node:fs/promises";

import type { StatusRecord } from "../domain/classroom-types.js";

export interface StatusReport {
  generatedAt: string;
  runId: string;
  counts: Record<string, number>;
  records: StatusRecord[];
}

export function buildStatusReport(runId: string, records: StatusRecord[]): StatusReport {
  const counts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    runId,
    counts,
    records,
  };
}

export async function writeStatusReport(filePath: string, report: StatusReport): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
