# REFERENCE_STACK.md — Bonnes pratiques techniques StreetConnect

## 1. Supabase RLS

**Principes**
- Toute table exposée au client doit avoir RLS activé
- Les policies doivent couvrir : SELECT, INSERT, UPDATE, DELETE séparément
- `auth.uid()` = identifiant de l'utilisateur connecté côté RLS

**Bonnes pratiques**
- Ne jamais bypasser RLS depuis le frontend — utiliser uniquement le client public
- Le service role (secret) bypasse RLS — ne jamais l'exposer côté client
- Tester les policies avec un utilisateur réel, pas en mode service
- Les `postgres_changes` realtime sont soumis aux policies SELECT — si SELECT est bloqué, l'event n'arrive pas

---

## 2. Auth SSR — Next.js + Supabase

**Règle principale**
- Côté serveur : utiliser `createServerClient` avec cookies (package `@supabase/ssr`)
- Côté client : utiliser `createBrowserClient`
- Ne jamais utiliser le client serveur dans un composant client, ni l'inverse

**Session SSR**
- Lire la session dans `layout.tsx` ou `page.tsx` (Server Components) via `getUser()`
- Passer la session en props ou via context au besoin — ne pas re-fetcher côté client si déjà disponible
- Le middleware doit rafraîchir le token (`supabase.auth.getUser()` dans `middleware.ts`)

---

## 3. Realtime — Postgres Changes vs Broadcast

| | Postgres Changes | Broadcast |
|---|---|---|
| Source | Mutations DB (INSERT/UPDATE/DELETE) | Messages manuels via channel |
| Fiabilité DELETE payload | Non fiable (RLS limite `old_record`) | N/A |
| Usage recommandé | UPDATE sur tables dénormalisées | Présence, typing indicators |
| Filtrage | `filter: 'id=eq.xxx'` | Topic custom |

**Règles StreetConnect**
- Écouter `UPDATE` sur `posts` pour likes_count / comments_count (jamais `likes DELETE`)
- Toujours cleanup : `supabase.removeChannel(channel)` dans `return` du `useEffect`
- Vérifier que la table est dans `supabase_realtime` publication et que `REPLICA IDENTITY = FULL`

---

## 4. Storage — Contrôle d'accès

**Buckets**
- `public` : accessible sans auth (avatars, posts publics)
- `private` : accès via signed URLs uniquement

**Policies Storage**
- Définies comme RLS sur `storage.objects`
- Toujours restreindre par `auth.uid()` sur INSERT/DELETE
- Ne jamais autoriser DELETE global sur un bucket public

**Upload**
- Utiliser des paths prévisibles : `{user_id}/{filename}` pour éviter les collisions
- Nettoyer les anciens fichiers avant remplacement si le nom change

---

## 5. PostgreSQL — Index utiles

| Cas | Index recommandé |
|---|---|
| Requêtes filtrées par `user_id` | `CREATE INDEX ON table(user_id)` |
| Tri par date décroissante | `CREATE INDEX ON table(created_at DESC)` |
| Lookup `post_id` + `user_id` (likes) | `CREATE UNIQUE INDEX ON likes(post_id, user_id)` |
| Full-text search | `CREATE INDEX ON table USING gin(to_tsvector('french', col))` |

- Ne pas indexer des colonnes rarement filtrées
- Un index composite `(a, b)` couvre les requêtes sur `a` seul, pas `b` seul

---

## 6. Server vs Client Components — Next.js App Router

| | Server Component | Client Component |
|---|---|---|
| Directive | aucune (défaut) | `'use client'` en tête de fichier |
| Accès DB / auth | Oui (direct) | Non (via API ou hooks) |
| useState / useEffect | Non | Oui |
| Realtime / listeners | Non | Oui |

**Règle de découpe**
- Garder les composants Server le plus haut possible dans l'arbre
- Descendre `'use client'` uniquement là où l'interactivité est nécessaire
- Ne pas transformer un layout entier en client juste pour un petit état

---

## 7. Images — Optimisation

- Toujours utiliser `next/image` (`<Image />`) — jamais `<img>` brut
- Définir `width` + `height` ou `fill` + `sizes` pour éviter le layout shift
- Pour les avatars Supabase : utiliser une URL signée ou publique stable, passer dans `<Image>`
- `priority` uniquement pour les images above the fold (hero, avatar header)
- Configurer `remotePatterns` dans `next.config.js` pour les domaines Supabase

---

## 8. Observabilité — Logs & Debug

**Frontend**
- Ne pas laisser de `console.log` en production — utiliser un flag `DEBUG` ou supprimer
- Les erreurs Supabase sont dans `{ data, error }` — toujours lire `error.message` + `error.code`
- Vérifier Network tab (XHR/Fetch) pour les requêtes Supabase REST

**Backend / Supabase**
- Logs disponibles dans Dashboard → Logs → API / Auth / Storage / Postgres
- Pour débugger un trigger : ajouter un `RAISE NOTICE` temporaire et lire dans Postgres logs
- Vérifier `pg_stat_user_tables` pour détecter les tables sans index sur des colonnes filtrées

**Realtime**
- Vérifier dans Dashboard → Realtime → Inspector si les events arrivent bien
- Un event qui n'arrive pas = vérifier : publication `supabase_realtime`, policy SELECT, `REPLICA IDENTITY`
