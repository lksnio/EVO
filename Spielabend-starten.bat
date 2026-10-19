@echo off
rem EVO-Server für einen Spieleabend: einmal doppelklicken. Freunde öffnen die angezeigte Tailscale-Adresse.
cd /d "%~dp0"
echo Installiere und baue EVO ...
call npm install || goto fehler
call npm run build || goto fehler
call npm start
goto ende
:fehler
echo.
echo Etwas ist schiefgegangen - siehe oben. Ist Node.js 22 installiert? (https://nodejs.org)
:ende
pause
