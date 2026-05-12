@echo off
call src\node_modules\.bin\tsc -p src/tsconfig.json
del pub\js\*.test.js >nul 2>nul
del pub\js\*.test.js.map >nul 2>nul
del pub\js\vitest.config.js >nul 2>nul
del pub\js\vitest.config.js.map >nul 2>nul
