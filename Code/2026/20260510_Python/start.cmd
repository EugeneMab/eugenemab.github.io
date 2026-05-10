@echo off
echo Starting local server...
echo Please open http://127.0.0.1:8080 in your browser.
start http://127.0.0.1:8080
cd src
npm run serve
