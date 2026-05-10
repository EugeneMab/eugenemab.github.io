@echo off
echo Starting local server...
echo Please open http://127.0.0.1:8080 in your browser.
@echo on
start http://127.0.0.1:8080
npm run serve
@exit
