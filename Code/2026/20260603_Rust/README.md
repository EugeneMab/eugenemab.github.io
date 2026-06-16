# Rust to WASM Compiler Playground

## Introduction
This repository implements a focused Rust-subset compiler that emits WebAssembly
(WASM) and runs in the browser. The toolchain is written in TypeScript and is
intended for learning language design, compiler internals, and WASM runtime
integration.

## What changed (current state)
- Rebuilt browser bundles in `pub/js/` (emitter, lexer, parser, ui).
- Updated TypeScript sources in `src/` (lexer, parser, emitter, ui, worker).
- Added convenience scripts: `check.cmd`, `start.cmd`, `scripts/print_wat.mjs`.
- Expanded runnable samples in `pub/samples/` and `samples/` for tutorial book.
- Tests and CI hints: `vitest.config.ts`, `src/*.test.ts`, `src/ui.ui.test.ts`.

## Architecture (brief)
1. Lexer (`src/lexer.ts`) -> tokens
2. Parser (`src/parser.ts`) -> AST
3. Emitter (`src/emitter.ts`) -> WAT/WASM
4. Worker/Runtime (`src/worker.ts`) -> instantiates and runs wasm
5. UI (`src/ui.ts`, `pub/index.html`) -> editor, sample browser, diagnostics

## Project layout
- src/        — TypeScript compiler, runtime, UI, and tests
- pub/        — built JS + static browser assets
- pub/js/     — emitted JS bundles used by `pub/index.html`
- pub/samples — runnable Rust examples used by the UI
- samples/    — source samples used for book extraction
- scripts/    — helper scripts (e.g., `print_wat.mjs`)
- vitest.config.ts, tsconfig.json, package.json (project configs)

## Developer commands (quick)
- npm install           # install dependencies
- npm run lint          # lint TypeScript
- npm run build         # build TS -> JS into `pub/js/`
- npm test              # run unit tests (Vitest)
- npm run test:ui       # run UI tests (Playwright/Vitest integration)
- npm run serve         # local static server (default port in script)
- start.cmd             # Windows helper to run dev server / build
- check.cmd             # quick health checks and build+test wrapper

## Notes for future AI sessions (explicit, actionable)
- Entry points to inspect when asked to modify behavior:
  - lexer: `src/lexer.ts` (token rules, regexes)
  - parser: `src/parser.ts` (AST nodes, precedence)
  - emitter: `src/emitter.ts` (WAT emission, function signatures)
  - worker/runtime: `src/worker.ts` (wasm instantiation, imports)
  - UI: `src/ui.ts` and `pub/index.html` (sample loading, diagnostics)
- To reproduce builds/tests for any change, run: `npm ci && npm run build && npm test`.
- When asked to regenerate browser bundles, run `npm run build` and verify
  `pub/js/*.js` timestamp and sizes changed.
- For failing tests, run the specific test file with Vitest via `npx vitest run <file>`.
- To inspect WAT output quickly, use `node scripts/print_wat.mjs pub/js/<bundle>.js`.
- Use `git diff -- <path>` to limit diffs for PR-sized reviews.

## How to add a new sample
1. Add Rust source in `samples/` or `pub/samples/` following naming convention.
2. Add a corresponding entry in the UI sample list (`src/ui.ts` sample registry).
3. Run `npm run build` and open `pub/index.html` to validate execution.

## Troubleshooting
- Node: use Node 18+ for stable ESM/worker support.
- If WASM instantiation fails, check console for import names `env.print` etc.
- UI tests may require a headless browser env; run `npm run test:ui` in CI or
  locally with Playwright installed.

## Links and tracking
- Roadmap: `rust_step.md` (implementation steps)
- Book extraction: `book_progress.md`
- Samples: `pub/samples/` maps to tutorial/book sections

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

