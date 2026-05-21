import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.vitest.test.ts", "src/unit-tests.test.ts"],
    setupFiles: ["src/vitest.setup.ts"],
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
        lines: 30,
        statements: 30,
        functions: 30,
        branches: 20,
      },
    },
  },
});
