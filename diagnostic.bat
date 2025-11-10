@echo off
title Diagnostic Portfolio KiMi
color 0E
mode con: cols=100 lines=50

echo.
echo ========================================================================
echo                      DIAGNOSTIC PORTFOLIO KIMI
echo ========================================================================
echo.
echo Ce script va verifier que tout est correctement configure.
echo.
echo ========================================================================
echo.

echo [1/6] Verification de Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js NON installe
    echo     Telechargez depuis: https://nodejs.org/
    set /a errors+=1
) else (
    echo [OK] Node.js installe
    node --version
)
echo.

echo [2/6] Verification de npm...
where npm >nul 2>nul
if errorlevel 1 (
    echo [X] npm NON installe
    set /a errors+=1
) else (
    echo [OK] npm installe
    npm --version
)
echo.

echo [3/6] Verification du fichier .env...
if exist ".env" (
    echo [OK] Fichier .env existe
    
    findstr /C:"VOTRE_TOKEN_ICI" .env >nul
    if not errorlevel 1 (
        echo [!] Token Discord non configure (placeholder detecte)
        echo     Editez .env et ajoutez votre vrai token
        set /a warnings+=1
    ) else (
        findstr /C:"DISCORD_TOKEN=" .env >nul
        if not errorlevel 1 (
            echo [OK] Token Discord semble configure
        ) else (
            echo [X] Variable DISCORD_TOKEN manquante dans .env
            set /a errors+=1
        )
    )
) else (
    echo [X] Fichier .env manquant
    echo     Lancez start.bat pour le creer
    set /a errors+=1
)
echo.

echo [4/6] Verification des dependances npm...
if exist "node_modules\" (
    echo [OK] Dossier node_modules existe
    
    if exist "node_modules\discord.js\" (
        echo [OK] discord.js installe
    ) else (
        echo [X] discord.js manquant
        echo     Lancez: npm install
        set /a errors+=1
    )
    
    if exist "node_modules\express\" (
        echo [OK] express installe
    ) else (
        echo [X] express manquant
        echo     Lancez: npm install
        set /a errors+=1
    )
) else (
    echo [X] node_modules manquant
    echo     Lancez: npm install
    set /a errors+=1
)
echo.

echo [5/6] Verification des fichiers du projet...
if exist "index.html" (
    echo [OK] index.html present
) else (
    echo [X] index.html manquant
    set /a errors+=1
)

if exist "server.js" (
    echo [OK] server.js present
) else (
    echo [X] server.js manquant
    set /a errors+=1
)

if exist "package.json" (
    echo [OK] package.json present
) else (
    echo [X] package.json manquant
    set /a errors+=1
)
echo.

echo [6/6] Test de connexion au serveur...
echo Tentative de connexion a http://localhost:3000...
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo [!] Serveur non accessible
    echo     Le serveur n'est probablement pas lance
    echo     Lancez start.bat pour demarrer le serveur
) else (
    echo [OK] Serveur accessible sur http://localhost:3000
)
echo.

echo ========================================================================
echo                           RESUME
echo ========================================================================
echo.

if defined errors (
    color 0C
    echo [X] %errors% ERREUR(S) DETECTEE(S)
    echo.
    echo Corrigez les erreurs ci-dessus avant de lancer le portfolio.
) else (
    if defined warnings (
        color 0E
        echo [!] %warnings% AVERTISSEMENT(S)
        echo.
        echo Le portfolio peut fonctionner mais certaines fonctionnalites
        echo peuvent ne pas etre disponibles.
    ) else (
        color 0A
        echo [OK] TOUT EST CORRECT!
        echo.
        echo Vous pouvez lancer start.bat pour demarrer le serveur.
    )
)

echo.
echo ========================================================================
echo.
echo CHECKLIST DISCORD BOT:
echo.
echo [ ] Bot cree sur https://discord.com/developers/applications
echo [ ] PRESENCE INTENT active
echo [ ] SERVER MEMBERS INTENT active
echo [ ] Token copie dans .env
echo [ ] Bot invite sur un serveur Discord
echo [ ] Vous etes membre du meme serveur que le bot
echo.
echo ========================================================================
echo.

pause
