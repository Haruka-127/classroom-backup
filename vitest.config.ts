import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "ui",
          include: ["viewer/src/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
  },
});
