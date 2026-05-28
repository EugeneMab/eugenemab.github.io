@echo off
echo Starting local server...
echo Please open http://127.0.0.1:7957 in your browser.
@echo on
start http://127.0.0.1:7957
npm run serve
@exit
