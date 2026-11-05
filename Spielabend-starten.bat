@echo off
rem EVO: Living World - Game night server: double-click to start. Friends can open the displayed Tailscale address.
cd /d "%~dp0"
echo Installing and building EVO: Living World ...
call npm install || goto fehler
call npm run build || goto fehler
call npm start
goto ende
:fehler
echo.
echo Something went wrong - see above. Is Node.js 22 installed? (https://nodejs.org)
:ende
pause
