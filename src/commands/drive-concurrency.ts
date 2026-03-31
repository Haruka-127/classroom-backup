export function parseDriveConcurrency(value: number | string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid drive concurrency: ${String(value)}`);
  }

  return parsed;
}
