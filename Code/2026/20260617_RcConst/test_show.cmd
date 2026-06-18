@echo off
cd /d %~dp0
cargo test --workspace -- --nocapture --test-threads=1
