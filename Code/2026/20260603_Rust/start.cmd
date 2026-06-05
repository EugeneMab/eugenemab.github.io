@echo off
REM Rust-to-WASM Port (RUST)
echo Starting server on port 7878...
start http://localhost:7878
call npm run serve
