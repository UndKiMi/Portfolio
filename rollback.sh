#!/bin/bash
# Script de rollback pour revenir à la version précédente
# Usage: ./rollback.sh [commit_hash]

echo "🔄 Script de rollback - Système SensCritique"
echo "=============================================="
echo ""

# Vérifier si un commit hash est fourni
if [ -z "$1" ]; then
    echo "📋 Recherche du commit précédent..."
    PREVIOUS_COMMIT=$(git log --oneline -2 | tail -1 | cut -d' ' -f1)
    echo "✅ Commit précédent trouvé: $PREVIOUS_COMMIT"
else
    PREVIOUS_COMMIT=$1
    echo "✅ Utilisation du commit fourni: $PREVIOUS_COMMIT"
fi

# Afficher les fichiers qui seront modifiés
echo ""
echo "📝 Fichiers qui seront restaurés:"
git diff --name-only HEAD $PREVIOUS_COMMIT

echo ""
read -p "⚠️  Êtes-vous sûr de vouloir revenir au commit $PREVIOUS_COMMIT ? (oui/non): " confirm

if [ "$confirm" != "oui" ]; then
    echo "❌ Rollback annulé"
    exit 1
fi

# Créer une branche de sauvegarde avant le rollback
BACKUP_BRANCH="backup-before-rollback-$(date +%Y%m%d-%H%M%S)"
echo ""
echo "💾 Création d'une branche de sauvegarde: $BACKUP_BRANCH"
git branch $BACKUP_BRANCH

# Restaurer les fichiers au commit précédent
echo ""
echo "🔄 Restauration des fichiers..."
git checkout $PREVIOUS_COMMIT -- senscritique-scraper.js assets/js/main.js monitoring.js assets/css/main.css server.js

# Afficher le statut
echo ""
echo "✅ Rollback effectué !"
echo ""
echo "📋 Statut actuel:"
git status

echo ""
echo "📝 Prochaines étapes:"
echo "1. Vérifier les modifications: git diff"
echo "2. Commit le rollback: git commit -m 'rollback: Retour à la version précédente'"
echo "3. Push vers Railway: git push"
echo ""
echo "💾 Branche de sauvegarde créée: $BACKUP_BRANCH"
echo "   Pour revenir: git checkout $BACKUP_BRANCH"

