@echo off
set interval=1
:loop
title Python_JS_Server
timeout /t %interval% /nobreak >nul
set /a interval=%interval% * 2
if %interval% gtr 60 set interval=60
goto loop
