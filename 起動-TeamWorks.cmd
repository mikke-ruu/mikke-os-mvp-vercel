@echo off
title Team Works dev server
cd /d "%~dp0"
echo Starting Team Works at http://localhost:3000/apps/team-works
echo Keep this window open while checking the app.
call "C:\Program Files\nodejs\npm.cmd" run dev
pause
