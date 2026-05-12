import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["**/*.vitest.test.ts", "unit-tests.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lexer.ts",
        "parser.ts",
        "compiler.ts",
        "main.ts",
        "start_host.ts",
      ],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 60,
      },
    },
  },
});
