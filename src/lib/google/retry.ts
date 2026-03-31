export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_HTTP_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function getStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const status = Reflect.get(error, "code") ?? Reflect.get(error, "status");
  return typeof status === "number" ? status : null;
}

export function isRetryableGoogleApiError(error: unknown): boolean {
  const status = getStatusCode(error);
  if (status !== null) {
    return RETRYABLE_HTTP_STATUS.has(status);
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const message = String(Reflect.get(error, "message") ?? "");
  return ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND"].some((token) => message.includes(token));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const shouldRetry = options.shouldRetry ?? isRetryableGoogleApiError;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= attempts || !shouldRetry(error)) {
        throw error;
      }

      const jitter = Math.floor(Math.random() * 100);
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
