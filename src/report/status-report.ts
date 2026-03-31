import type { StatusRecord, SyncRunSummary } from "../domain/classroom-types.js";

export function buildStatusReport(args: {
  runId: string;
  records: StatusRecord[];
  pendingMaterializationCount: number;
  failuresCount: number;
}): SyncRunSummary {
  const { runId, records, pendingMaterializationCount, failuresCount } = args;
  const counts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    runId,
    counts,
    pendingMaterializationCount,
    failuresCount,
    representativeMessages: [...new Set(records.map((record) => record.message).filter((message) => message.length > 0))].slice(0, 5),
  };
}
