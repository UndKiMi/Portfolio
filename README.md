# Portfolio KiMi

Portfolio moderne avec intégrations Discord, GitHub et Sens Critique, construit avec React et Vite.

## 📋 Description

Ce projet est un portfolio personnel qui affiche en temps réel :
- **Présence Discord** : Statut et activité actuelle
- **Profil GitHub** : Statistiques et projets
- **Critiques SensCritique** : Dernières critiques de films/séries

## 🏗️ Structure du projet

```
My_page/
├── Back/                    # Backend (API Express)
│   ├── server.js           # Serveur Express principal
│   └── server/
│       ├── routes/         # Routes API modulaires
│       │   ├── discord.js
│       │   ├── github.js
│       │   └── senscritique.js
│       └── services/       # Services backend
│           ├── discord.js
│           ├── senscritique-scraper.js
│           └── monitoring.js
│
├── Front/                   # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # Composants React
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── DiscordPresence.jsx
│   │   │   ├── SensCritique.jsx
│   │   │   └── GitHubSection.jsx
│   │   ├── hooks/          # Hooks personnalisés
│   │   │   ├── useDiscord.js
│   │   │   ├── useGitHub.js
│   │   │   └── useSensCritique.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── vite.config.js
│
└── package.json            # Configuration racine
```

## 🚀 Démarrage rapide

### Prérequis

- **Node.js** 18+ 
- **pnpm** (gestionnaire de paquets)

### Installation

1. **Cloner le dépôt** (si applicable) ou naviguer dans le dossier du projet

2. **Installer les dépendances du backend** :
```bash
cd Back
pnpm install
```

3. **Installer les dépendances du frontend** :
```bash
cd ../Front
pnpm install
```

### Configuration

Créez un fichier `.env` dans le dossier `Back/` avec les variables suivantes :

```env
DISCORD_TOKEN=votre_token_discord
DISCORD_USER_ID=votre_user_id
GITHUB_USERNAME=VotreUsername
PORT=3000
VITE_BACKEND_URL=http://localhost:3000
```

**Note** : Pour obtenir un token Discord, consultez la [documentation Discord Developer Portal](https://discord.com/developers/docs/intro).

### Développement

Ouvrez deux terminaux :

**Terminal 1 - Backend** :
```bash
cd Back
pnpm start
# ou pour le mode développement avec auto-reload
pnpm run dev
```

**Terminal 2 - Frontend** :
```bash
cd Front
pnpm run dev
```

L'application sera accessible sur `http://localhost:5173` (frontend) et l'API sur `http://localhost:3000` (backend).

### Production

**Backend** :
```bash
cd Back
pnpm start
```

**Frontend** :
```bash
cd Front
pnpm run build
pnpm run preview
```

## 🛠️ Technologies

### Frontend
- **React** 18.2.0
- **Vite** 5.0.8
- **ESLint** (configuration moderne)

### Backend
- **Express.js** 4.18.2
- **Node.js**
- **Discord.js** 14.14.1 (intégration Discord)
- **Puppeteer** 24.29.1 (scraping SensCritique)
- **jsdom** 23.0.1 (parsing HTML)
- **CORS** & **Compression** (optimisations)

## 📝 Scripts disponibles

### Backend (`Back/`)
- `pnpm start` - Démarrer le serveur backend
- `pnpm run dev` - Démarrer en mode développement

### Frontend (`Front/`)
- `pnpm run dev` - Démarrer le serveur de développement Vite
- `pnpm run build` - Construire pour la production
- `pnpm run preview` - Prévisualiser la build de production
- `pnpm run lint` - Linter le code

## 🔧 Fonctionnalités

### Intégration Discord
- Affichage du statut en temps réel (en ligne, absent, ne pas déranger, hors ligne)
- Activité actuelle (jeu, streaming, etc.)
- Cache optimisé pour réduire les appels API

### Intégration GitHub
- Statistiques du profil (followers, repositories, etc.)
- Liste des projets récents
- Cache de 10 minutes pour les données GitHub

### Intégration SensCritique
- Affichage des dernières critiques
- Pagination des critiques
- Scraping avec Puppeteer
- Cache de 1 heure pour optimiser les performances

## 📄 Licence

MIT

## 👤 Auteur

**KiMi**

---

Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue ou une pull request.

