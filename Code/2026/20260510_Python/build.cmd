@echo off
call node_modules\.bin\tsc -p tsconfig.json
del pub\js\*.js.map >nul 2>nul
del pub\js\*.test.js >nul 2>nul
del pub\js\vitest.config.js >nul 2>nul
