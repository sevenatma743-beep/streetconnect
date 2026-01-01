# 🔥 STREET CONNECT PRO - Version 3.0

**Réseau social professionnel pour la communauté street workout**

---

## ✨ FONCTIONNALITÉS

### ✅ Implémentées
- **Feed Social** : Posts avec likes, commentaires, stories
- **Shop E-Commerce** : Boutique équipement street workout
- **Navigation Mobile** : Bottom nav comme Instagram/TikTok
- **Design Noir + Or** : Interface moderne et pro
- **Supabase Ready** : Backend configuré

### 🚧 En Développement (Prochaines étapes)
- **Spots** : Carte interactive des spots
- **Challenges** : Défis et leaderboard
- **Tracker** : Enregistrement séances
- **Profile** : Stats, PR, skills portfolio
- **AI Coach** : Conseils personnalisés
- **Upload Vidéo** : Support vidéos courtes

---

## 📦 INSTALLATION

### 1️⃣ Extraire le projet
Décompresse `street-connect-pro.zip` dans ton dossier Downloads

### 2️⃣ Ouvrir le terminal
```bash
cd C:\Users\seven\Downloads\street-connect-pro
```

### 3️⃣ Installer les dépendances
```bash
npm install
```

### 4️⃣ Lancer l'application
```bash
npm run dev
```

### 5️⃣ Ouvrir dans le navigateur
Va sur : `http://localhost:3000`

---

## 🎨 DESIGN

### Couleurs
- **Noir Principal** : `#121212`
- **Noir Card** : `#1E1E1E`
- **Gris Foncé** : `#2C2C2C`
- **Or Accent** : `#FACC15`

### Fonts
- **Display** : Teko (titres, logo)
- **Sans** : Inter (texte)

---

## 🗂️ STRUCTURE DU PROJET

```
street-connect-pro/
├── app/
│   ├── globals.css          # Styles globaux
│   ├── layout.js            # Layout racine
│   └── page.js              # Page principale
├── components/
│   ├── Layout.js            # Navigation + Header
│   ├── Feed.js              # Feed social
│   ├── Shop.js              # Boutique
│   ├── Spots.js             # Carte spots (placeholder)
│   ├── Challenges.js        # Défis (placeholder)
│   ├── Tracker.js           # Tracker (placeholder)
│   └── Profile.js           # Profil (placeholder)
├── lib/
│   └── supabase.js          # Client Supabase + helpers
├── .env.local               # Variables d'environnement
├── package.json             # Dépendances
├── tailwind.config.js       # Config Tailwind
└── README.md                # Ce fichier
```

---

## 🚀 PROCHAINES ÉTAPES

### Phase 1 : Compléter les Components
1. **Profile** : Radar chart stats, PR cards, skill portfolio
2. **Challenges** : Liste défis + leaderboard
3. **Spots** : Carte interactive (Mapbox)
4. **Tracker** : Formulaire séances avec RPE

### Phase 2 : Backend Supabase
1. Authentification (Sign up / Login)
2. Upload images/vidéos
3. Likes / Comments en temps réel
4. Followers / Following

### Phase 3 : Features Avancées
1. **Reels** : Vidéos courtes verticales
2. **AI Coach** : Conseils IA (Gemini/Claude)
3. **Shop Amazon** : Affiliation produits
4. **Notifications** : Push notifications

### Phase 4 : Mobile App
1. Conversion avec Capacitor
2. Build iOS/Android
3. Publication stores

---

## 🔧 COMMANDES UTILES

```bash
# Développement
npm run dev

# Build production
npm run build

# Démarrer production
npm run start

# Nettoyer cache
rm -rf .next
npm run dev
```

---

## 📱 DÉPLOIEMENT

### Vercel (Recommandé - Gratuit)
```bash
npm install -g vercel
vercel
```

### Netlify
1. Connecte ton repo GitHub
2. Deploy automatique sur chaque push

---

## 🎯 NOTES IMPORTANTES

- ✅ Le fichier `.env.local` contient tes clés Supabase
- ✅ Design noir + or déjà appliqué
- ✅ Navigation mobile fonctionnelle
- ✅ Feed avec posts mockés fonctionnel
- ✅ Shop avec produits street workout

---

## 💡 TIPS

- **Hard Refresh** : Ctrl + Shift + R (si le CSS ne s'applique pas)
- **Clear Cache** : Supprime le dossier `.next` si problème
- **Supabase** : Vérifie que tes clés sont bonnes dans `.env.local`

---

## 🔥 CONTACT & SUPPORT

**Développé par Seven**
- Version : 3.0.0
- Date : Décembre 2024
- Stack : Next.js 14 + Supabase + Tailwind CSS

---

**Prêt à devenir le réseau social #1 du street workout ! 💪🔥**
