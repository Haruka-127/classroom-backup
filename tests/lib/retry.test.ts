import { describe, expect, it, vi } from "vitest";

import { withRetry } from "../../src/lib/google/retry.js";

describe("withRetry", () => {
  it("retries retryable failures and succeeds", async () => {
    const sleep = vi.fn(async () => undefined);
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error("retry");
          Object.assign(error, { code: 503 });
          throw error;
        }

        return "ok";
      },
      { sleep },
    );

    expect(result).toBe("ok");
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
