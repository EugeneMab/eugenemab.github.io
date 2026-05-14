import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.vitest.test.ts", "src/unit-tests.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lexer.ts",
        "src/parser.ts",
        "src/compiler.ts",
        "src/main.ts",
        "src/start_host.ts",
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
