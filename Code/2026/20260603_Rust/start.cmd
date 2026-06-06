@echo off
REM Rust-to-WASM Port (RUST)
setlocal
call kill.cmd
echo Starting server on port 7878...
start /min "Rust_WASM_Server" npm run serve
timeout /t 2 /nobreak > nul
start http://localhost:7878
