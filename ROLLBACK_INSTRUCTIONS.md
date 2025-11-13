# 🔄 Instructions de Rollback

## Quand effectuer un rollback ?

Un rollback est nécessaire si :
- ❌ Le scraping retourne 0 critiques après déploiement
- ❌ Le frontend ne s'affiche plus correctement
- ❌ Des erreurs critiques apparaissent dans les logs Railway
- ❌ Le système fonctionnait mieux avant les modifications

## Méthodes de rollback

### Méthode 1 : Script PowerShell (Windows)

```powershell
# Rollback vers le commit précédent
.\rollback.ps1

# Rollback vers un commit spécifique
.\rollback.ps1 -CommitHash "abc1234"
```

### Méthode 2 : Script Bash (Linux/Mac/Git Bash)

```bash
# Rollback vers le commit précédent
chmod +x rollback.sh
./rollback.sh

# Rollback vers un commit spécifique
./rollback.sh abc1234
```

### Méthode 3 : Commandes Git manuelles

```bash
# 1. Voir l'historique des commits
git log --oneline -10

# 2. Créer une branche de sauvegarde
git branch backup-before-rollback-$(date +%Y%m%d)

# 3. Restaurer les fichiers au commit précédent
git checkout <commit_hash> -- senscritique-scraper.js assets/js/main.js monitoring.js assets/css/main.css server.js

# 4. Vérifier les modifications
git status
git diff

# 5. Commit le rollback
git commit -m "rollback: Retour à la version précédente"

# 6. Push vers Railway
git push
```

## Fichiers concernés par le rollback

Les fichiers suivants seront restaurés à leur version précédente :
- `senscritique-scraper.js`
- `assets/js/main.js`
- `monitoring.js`
- `assets/css/main.css`
- `server.js`

## Vérification après rollback

Après avoir effectué le rollback :

1. **Attendre 2-3 minutes** que Railway redéploie
2. **Tester l'endpoint** :
   ```
   https://mypage-production-4e09.up.railway.app/senscritique?force=true
   ```
3. **Vérifier le frontend** :
   ```
   https://undkimi.github.io/My_page/
   ```
4. **Vérifier les logs Railway** pour confirmer que tout fonctionne

## Revenir en arrière après un rollback

Si vous voulez revenir à la version avec les nouvelles modifications :

```bash
# Voir les branches de sauvegarde
git branch | grep backup

# Revenir à la branche de sauvegarde
git checkout backup-before-rollback-YYYYMMDD-HHMMSS

# Ou revenir au commit le plus récent
git checkout main
git reset --hard HEAD~1  # Attention : supprime le commit de rollback
```

## Annuler un rollback non commité

Si vous avez fait un rollback mais n'avez pas encore commité :

```bash
# Annuler toutes les modifications
git checkout -- senscritique-scraper.js assets/js/main.js monitoring.js assets/css/main.css server.js

# Ou restaurer tous les fichiers
git restore .
```

## Points d'attention

⚠️ **Important** :
- Le rollback crée automatiquement une branche de sauvegarde
- Ne supprimez pas la branche de sauvegarde avant d'être sûr que le rollback fonctionne
- Testez toujours après un rollback avant de continuer
- Les modifications non commitées seront perdues lors du rollback

## Support

Si le rollback ne fonctionne pas ou si vous rencontrez des problèmes :
1. Vérifier les logs Railway
2. Vérifier que Git est correctement configuré
3. Vérifier que vous êtes sur la bonne branche (généralement `main` ou `master`)

