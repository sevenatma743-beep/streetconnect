# SESSION_BOOT.md — StreetConnect

> Fichier de démarrage de session. Lire en premier à chaque reprise.
> Dernière mise à jour : 13/04/2026 — Pivot vers production readiness + scalabilité.

---

## RÔLES

| Rôle | Activation |
|---|---|
| **Architecte** | Toujours actif au démarrage — analyse, plan, validation |
| **Frontend** | Uniquement si explicitement demandé |
| **Backend / Supabase** | Uniquement si explicitement demandé |
| **QA / Debug** | Uniquement si explicitement demandé |

Règle : ne jamais changer de rôle sans instruction explicite. Claude n'est pas décideur final.

---

## MÉTHODE

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

## FICHIERS À LIRE AU DÉMARRAGE

Dans cet ordre :

> Tous les fichiers ci-dessous sont à la **racine du projet** (`street-connect V1/`), sauf indication contraire.

1. `CLAUDE.md` — règles générales, filtre décisionnel scalabilité/lancement
2. `AGENTS.md` — définition des rôles
3. `PROJECT_CONTEXT.md` — vision, stack, état, fonctionnalités stables, objectif lancement
4. `ROADMAP.md` — phases, statuts, critères de validation
5. `SUPABASE_CONTEXT.md` — tables, RLS, triggers, indexes, limites plan
6. `VERCEL_CONTEXT.md` — déploiement, requis lancement
7. `WORKLOG.md` — journal des interventions (dernières entrées)
8. `street-connect-pro/docs/REFERENCE_STACK.md` — bonnes pratiques techniques
9. `street-connect-pro/docs/SESSION_BOOT.md` — ce fichier

**Fichiers de pilotage spécialisés (selon le contexte) :**
- `SCALABILITY_PLAN.md` — pagination, indexes, connection pooling, limites realtime
- `LAUNCH_PLAN.md` — critères go/no-go, checklist beta, go-live
- `OBSERVABILITY.md` — Sentry, analytics, monitoring infra

---

## SYSTÈMES STABLES — à ne pas modifier sans décision validée

| Système | Implémentation | Stable depuis |
|---|---|---|
| Likes realtime | Listener `posts UPDATE` → `likes_count` dans `Feed.js` | 06/04/2026 |
| Unlike realtime | Même listener `posts UPDATE` | 06/04/2026 |
| Comments realtime | Listener `comments INSERT` filtré `post_id` + `comments_count` via `posts UPDATE` | 07/04/2026 |
| Follow/Unfollow | Optimistic UI + trigger unique (double comptage corrigé) | 04/04/2026 |
| Notifications | Triggers PG (`fn_notify_*`), realtime INSERT filtré `user_id`, badge + `is_read`, unlike supprime notif like (`trg_delete_like_notification`) | 13/04/2026 |
| Messagerie | Inbox, realtime, badge non-lus, RPC `mark_conversation_read` | 07/04/2026 |
| Auth | Inscription, connexion, déconnexion, reset, suppression compte | 09/04/2026 |
| Profil | Upload avatar, édition, compteurs realtime | 09/04/2026 |
| Spots | Lecture seule, carte, recherche, MapController | 10/04/2026 |
| Marketplace P2P | Dépôt, consultation, contact, favoris, signalements | 11/04/2026 |
| Feed | Rendu continu, composer 2 étapes, menu suppression inline, pagination cursor-based + infinite scroll (`useSWRInfinite`), spinners visuels seuls | 13/04/2026 |
| RLS | Phases 1 & 2 terminées — policies propres sur toutes les tables actives | 04/04/2026 |

**Table `posts` publiée dans `supabase_realtime`** — ne pas retirer.
**Triggers `fn_notify_*` en `SECURITY DEFINER`, `OWNER TO postgres`** — ne pas modifier.

---

## RÈGLES STRICTES

### Ne jamais toucher sans décision validée
- Architecture realtime dans `Feed.js` (listener `posts UPDATE`)
- Triggers sur `comments`, `likes`, `follows`, `favorites` (1 seul trigger de comptage par table)
- Triggers de notification (`trg_notify_*`) — SECURITY DEFINER
- Tables features suspendues : `workout_sessions`, `challenges`, `challenge_participants`

### Ne jamais faire
- Patch rapide qui crée une dette technique
- Liste non paginée dans le code (feed, notifications, shop, messages) — c'est une dette critique
- Channel realtime sans filtre actif — channel global ouvert = dette critique
- Appeler `safeRevalidate` si ça écrase un optimistic update
- Écouter `likes DELETE` en realtime (payload incomplet — limite Supabase/RLS)
- Modifier la base sans analyse d'impact complète
- Commiter, pousser ou modifier un système partagé sans confirmation explicite
- Démarrer des fixes dispersés hors phase validée — tout va dans le backlog

### Filtre décisionnel pour chaque intervention
Évaluer sur 3 axes avant toute modification :
1. **Stabilité** — est-ce que ça peut casser quelque chose d'existant ?
2. **Scalabilité** — est-ce que ce comportement tient à 5 000–10 000 utilisateurs ?
3. **Utilité lancement** — est-ce que ça bloque ou accélère le go-live ?

---

## DÉMARRAGE SESSION

Avant toute action :

1. Lire ce fichier
2. Lire `ROADMAP.md` — identifier la phase active et la prochaine tâche
3. Lire `WORKLOG.md` — vérifier la dernière intervention
4. Lire les fichiers de code concernés
5. Formuler l'hypothèse → valider → agir

---

## ÉTAT ACTUEL DU PROJET (13/04/2026)

**Phases 1, 2, 3 :** ✅ Terminées

**Ordre restructuré — travaux sans budget en premier :**

| Phase | Statut | Budget requis |
|---|---|---|
| Phase 4A — Infra config (Node 22, indexes, PgBouncer…) | ✅ COUVERTE (13/04/2026) | Aucun |
| Phase 5 — Scalabilité / Pagination | EN COURS — feed ✅, reste notifications + shop + bundle | Aucun |
| Phase 6 — Observabilité free tier | À FAIRE ← active | Aucun |
| Phase 4B — Supabase Pro + Vercel Pro + domaine | Avant beta | ~$45/mois |
| Phase 7 — Lancement progressif | Après 4A+5+6+4B | — |

**Prochaine action immédiate :**
- Phase 4A : vérifier Node.js dans Vercel + confirmer clés Supabase (non démarré)
- Phase 5 : feed paginé ✅ — **implémenter pagination notifications** (prochain item)

**Avant toute nouvelle feature :** valider que les Phases 4A, 5, 6 sont complètes et que Phase 4B est planifiée.
