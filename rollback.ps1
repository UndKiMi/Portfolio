# Script de rollback PowerShell pour revenir à la version précédente
# Usage: .\rollback.ps1 [commit_hash]

param(
    [string]$CommitHash = ""
)

Write-Host "🔄 Script de rollback - Système SensCritique" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si Git est disponible
try {
    $gitVersion = git --version
    Write-Host "✅ Git trouvé: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git n'est pas disponible dans le PATH" -ForegroundColor Red
    Write-Host "⚠️  Veuillez utiliser Git Bash ou votre IDE pour effectuer le rollback" -ForegroundColor Yellow
    exit 1
}

# Vérifier si on est dans un dépôt Git
if (-not (Test-Path ".git")) {
    Write-Host "❌ Ce répertoire n'est pas un dépôt Git" -ForegroundColor Red
    exit 1
}

# Récupérer le commit précédent si non fourni
if ([string]::IsNullOrEmpty($CommitHash)) {
    Write-Host "📋 Recherche du commit précédent..." -ForegroundColor Yellow
    $commits = git log --oneline -2
    if ($commits.Count -lt 2) {
        Write-Host "❌ Pas assez de commits pour effectuer un rollback" -ForegroundColor Red
        exit 1
    }
    $previousCommitLine = $commits[1]
    $CommitHash = ($previousCommitLine -split ' ')[0]
    Write-Host "✅ Commit précédent trouvé: $CommitHash" -ForegroundColor Green
} else {
    Write-Host "✅ Utilisation du commit fourni: $CommitHash" -ForegroundColor Green
}

# Afficher les informations du commit
Write-Host ""
Write-Host "📝 Informations du commit:" -ForegroundColor Yellow
git log -1 --format="%h - %s (%an, %ar)" $CommitHash

# Afficher les fichiers qui seront modifiés
Write-Host ""
Write-Host "📝 Fichiers qui seront restaurés:" -ForegroundColor Yellow
$changedFiles = git diff --name-only HEAD $CommitHash
foreach ($file in $changedFiles) {
    Write-Host "   - $file" -ForegroundColor Gray
}

Write-Host ""
$confirm = Read-Host "⚠️  Êtes-vous sûr de vouloir revenir au commit $CommitHash ? (oui/non)"

if ($confirm -ne "oui") {
    Write-Host "❌ Rollback annulé" -ForegroundColor Red
    exit 1
}

# Créer une branche de sauvegarde avant le rollback
$backupBranch = "backup-before-rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host ""
Write-Host "💾 Création d'une branche de sauvegarde: $backupBranch" -ForegroundColor Yellow
git branch $backupBranch
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Branche de sauvegarde créée" -ForegroundColor Green
} else {
    Write-Host "⚠️  Impossible de créer la branche de sauvegarde (peut-être déjà existante)" -ForegroundColor Yellow
}

# Restaurer les fichiers au commit précédent
Write-Host ""
Write-Host "🔄 Restauration des fichiers..." -ForegroundColor Yellow
$filesToRestore = @(
    "senscritique-scraper.js",
    "assets/js/main.js",
    "monitoring.js",
    "assets/css/main.css",
    "server.js"
)

foreach ($file in $filesToRestore) {
    if (Test-Path $file) {
        Write-Host "   - Restauration de $file..." -ForegroundColor Gray
        git checkout $CommitHash -- $file
    }
}

# Afficher le statut
Write-Host ""
Write-Host "✅ Rollback effectué !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Statut actuel:" -ForegroundColor Yellow
git status

Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "1. Vérifier les modifications: git diff" -ForegroundColor White
Write-Host "2. Commit le rollback: git commit -m 'rollback: Retour à la version précédente'" -ForegroundColor White
Write-Host "3. Push vers Railway: git push" -ForegroundColor White
Write-Host ""
Write-Host "💾 Branche de sauvegarde créée: $backupBranch" -ForegroundColor Green
Write-Host "   Pour revenir: git checkout $backupBranch" -ForegroundColor Gray

