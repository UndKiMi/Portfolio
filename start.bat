@echo off
title Portfolio KiMi - Serveur Discord
color 0B
mode con: cols=100 lines=40

echo.
echo ========================================================================
echo                    PORTFOLIO KIMI - SERVEUR DISCORD
echo ========================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [X] ERREUR: Node.js n'est pas installe!
    echo.
    echo Telechargez Node.js depuis: https://nodejs.org/
    echo Installez la version LTS recommandee
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detecte
node --version
echo.

if not exist "node_modules\jsdom\" (
    echo [INFO] Installation des dependances npm...
    echo Cela peut prendre 1-2 minutes, patientez...
    echo.
    call npm install
    if errorlevel 1 (
        color 0C
        echo.
        echo [X] ERREUR: Echec de l'installation npm
        echo.
        echo Verifiez:
        echo - Votre connexion internet
        echo - Que vous avez les droits administrateur
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependances installees avec succes
    echo.
) else (
    echo [OK] Dependances deja installees
    echo.
)

if not exist ".env" (
    color 0E
    echo [!] ATTENTION: Fichier .env manquant!
    echo.
    echo Creation du fichier .env...
    echo DISCORD_TOKEN=VOTRE_TOKEN_ICI> .env
    echo DISCORD_USER_ID=558793081663782913>> .env
    echo PORT=3000>> .env
    echo.
    echo [ACTION REQUISE] Editez le fichier .env et ajoutez votre token Discord
    echo.
    notepad .env
    echo.
    echo Relancez ce fichier apres avoir configure le token
    pause
    exit /b 1
)

findstr /C:"VOTRE_TOKEN_ICI" .env >nul
if not errorlevel 1 (
    color 0E
    echo [!] ATTENTION: Token Discord non configure!
    echo.
    echo Ouvrez .env et remplacez VOTRE_TOKEN_ICI par votre vrai token
    echo.
    notepad .env
    pause
    exit /b 1
)

echo [OK] Configuration detectee
echo.
echo ========================================================================
echo                         DEMARRAGE DU SERVEUR
echo ========================================================================
echo.
echo Le serveur Discord va demarrer...
echo Une fois lance, ouvrez index.html dans votre navigateur
echo.
echo IMPORTANT: NE FERMEZ PAS CETTE FENETRE tant que vous utilisez le site!
echo.
echo ========================================================================
echo.

node server.js

if errorlevel 1 (
    color 0C
    echo.
    echo ========================================================================
    echo                              ERREUR
    echo ========================================================================
    echo.
    echo Le serveur s'est arrete avec une erreur.
    echo.
    echo Problemes courants:
    echo.
    echo 1. Token Discord invalide
    echo    - Verifiez le token dans .env
    echo    - Regenerez le token sur Discord Developer Portal
    echo.
    echo 2. Privileged Gateway Intents non actives
    echo    - Allez sur https://discord.com/developers/applications
    echo    - Selectionnez votre bot
    echo    - Bot ^> Privileged Gateway Intents
    echo    - Activez PRESENCE INTENT et SERVER MEMBERS INTENT
    echo.
    echo 3. Bot non invite sur un serveur
    echo    - Le bot doit etre sur un serveur Discord
    echo    - Vous devez etre membre du meme serveur
    echo.
    echo ========================================================================
    echo.
    pause
    exit /b 1
)

pause
