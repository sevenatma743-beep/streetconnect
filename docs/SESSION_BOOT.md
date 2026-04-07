# SESSION_BOOT.md — StreetConnect

> Fichier de démarrage de session. Lire en premier à chaque reprise.
> Dernière mise à jour : 07/04/2026

---

## 🔁 RÔLES

| Rôle | Activation |
|---|---|
| **Architecte** | Toujours actif au démarrage — analyse, plan, validation |
| **Frontend** | Uniquement si explicitement demandé |
| **Backend / Supabase** | Uniquement si explicitement demandé |
| **QA / Debug** | Uniquement si explicitement demandé |

Règle : ne jamais changer de rôle sans instruction explicite. Claude n'est pas décideur final.

---

## 🧠 MÉTHODE

1. **Analyser** — lire les fichiers concernés avant toute action
2. **Formuler une hypothèse** — expliquer ce qui va être modifié et pourquoi
3. **Valider** — attendre confirmation avant d'agir
4. **Agir** — une modification à la fois, testée et vérifiée

Interdits sans validation :
- Coder
- Modifier
- Optimiser
- Anticiper

---

## 📂 FICHIERS À LIRE AU DÉMARRAGE

Dans cet ordre :

1. `CLAUDE.md` — règles générales et principes produit
2. `AGENTS.md` — définition des rôles
3. `PROJECT_CONTEXT.md` — vision, stack, état, architecture validée
4. `SUPABASE_CONTEXT.md` — tables, RLS, triggers, risques
5. `ROADMAP.md` — phases et état d'avancement
6. `WORKLOG.md` — journal des interventions
7. `docs/REFERENCE_STACK.md` — bonnes pratiques techniques
8. `docs/SESSION_BOOT.md` — ce fichier

---

## ✅ SYSTÈMES STABLES (à ne pas modifier)

| Système | Implémentation | Date |
|---|---|---|
| Likes realtime | Listener `posts UPDATE` → `likes_count` dans `Feed.js` | 06/04/2026 |
| Unlike realtime | Même listener `posts UPDATE` | 06/04/2026 |
| Comments realtime | Listener `comments INSERT` filtré `post_id` + `comments_count` via `posts UPDATE` | 07/04/2026 |
| Follow/Unfollow | Optimistic UI + trigger unique (double comptage corrigé) | 04/04/2026 |
| RLS sécurité | Phase 1 et Phase 2 terminées | 04/04/2026 |

**Table `posts` publiée dans `supabase_realtime`** — ne pas retirer.

---

## 🚫 RÈGLES STRICTES

### Ne jamais toucher sans décision validée
- Architecture realtime dans `Feed.js`
- Triggers sur `comments`, `likes`, `follows` (1 seul par table, déjà nettoyés)
- Tables features suspendues : `workout_sessions`, `challenges`, `challenge_participants`, `products`, `favorites`
- Shop (`components/Shop.js`) — conservé intentionnellement

### Ne jamais faire
- Patch rapide qui crée une dette technique
- Appeler `safeRevalidate` si ça écrase un optimistic update
- Écouter `likes DELETE` en realtime (payload incomplet — limite Supabase/RLS)
- Modifier la base sans analyse d'impact complète
- Commiter, pousser ou modifier un système partagé sans confirmation explicite

### Realtime — règles
- Toute table écoutée doit être dans `supabase_realtime`
- Toujours cleanup : `supabase.removeChannel(channel)` dans `return` du `useEffect`
- Source of truth : `posts.likes_count` et `posts.comments_count` (dénormalisés, mis à jour par trigger)

---

## ▶️ DÉMARRAGE SESSION

Avant toute action :

1. Lire ce fichier
2. Lire `ROADMAP.md` — identifier la prochaine tâche non complétée
3. Lire `WORKLOG.md` — vérifier la dernière intervention
4. Lire les fichiers de code concernés
5. Formuler l'hypothèse → valider → agir

**Prochaine étape validée :** Phase 3 — Stabilisation core
- Auth : vérifier flux inscription → connexion → déconnexion
- Profil : vérifier upload avatar, édition, compteurs
- Messagerie : vérifier inbox, envoi/réception, non-lus
- Spots : vérifier affichage et ajout

**Avant toute nouvelle feature :** définir les priorités produit avec le développeur.
