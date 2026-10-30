@echo off
rem Starts the local server and opens the player, leaderboard and admin pages in Edge.
rem Close the "Club Day server" window to stop the server.
cd /d "%~dp0"

start "Club Day server" python serve.py
timeout /t 2 /nobreak >nul
start "" msedge "http://localhost:8000/" "http://localhost:8000/leaderboard.html" "http://localhost:8000/admin.html"
