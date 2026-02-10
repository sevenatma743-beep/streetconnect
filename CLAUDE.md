# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Street Connect Pro (v3.0.0) — a social network for the street workout community with shop, challenges, and AI coach features. The UI language is French.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint
```

No test framework is configured.

## Tech Stack

- **Framework**: Next.js 14 (App Router), React 18
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage)
- **Styling**: Tailwind CSS with custom `street` theme (dark palette with gold accent `#ffd700`)
- **Fonts**: Teko (display), Inter (body)
- **Data fetching**: SWR (`hooks/useFeed.js`) + direct Supabase calls
- **Icons**: Lucide React
- **Maps**: Leaflet / React Leaflet
- **Charts**: Recharts

## Architecture

### Routing & Rendering

App Router with client-heavy pages. Most pages have a thin server wrapper (e.g., `app/page.js`) that renders a `*Client.js` component inside a `<Suspense>` boundary. Tab navigation within the home page uses query params (`?tab=...&u=...`) rather than separate routes.

Dynamic routes: `/p/[id]` (post detail), `/messages/[conversationId]` (conversation).

### State Management

- **Auth**: React Context (`contexts/AuthContext.js`) — provides `useAuth()` with `signIn`, `signUp`, `signOut`, user object, and loading state. Sign-up auto-creates a row in the `profiles` table.
- **Tab state**: `app/HomeClient.js` acts as the top-level state machine — manages active tab, unread badges, profile navigation with return-tab tracking, and deep links.
- **Data**: SWR for the feed; other components call `lib/supabase.js` functions directly. Messaging uses Supabase Realtime subscriptions. Likes, follows, and comments use optimistic updates.

### Key Files

| Path                      | Role                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/supabase.js`         | Supabase client init + **all** database helper functions (posts, likes, comments, follows, profiles, spots, products, messages, conversations) |
| `app/HomeClient.js`       | Main app state machine — tab routing, unread polling, profile navigation                                                                       |
| `components/Layout.js`    | Header + bottom nav + unread badge + safe-area padding                                                                                         |
| `contexts/AuthContext.js` | Auth provider wrapping the app                                                                                                                 |
| `hooks/useFeed.js`        | SWR-based feed fetching hook                                                                                                                   |
| `app/providers.js`        | Context provider composition                                                                                                                   |

### Component Map

`Layout` wraps everything and provides header/bottom-nav. The active tab in `HomeClient` renders one of: `Feed`, `Messages`, `Profile`, `Shop`, `Spots`, `Challenges`, `Tracker`, `Notifications`, `SearchUsers`. Each is a self-contained client component in `components/`.

### Database Tables (Supabase)

`profiles`, `posts`, `likes`, `comments`, `follows`, `spots`, `products`, `favorites`, `conversations`, `conversation_members`, `messages`

### Environment Variables

Defined in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only, used in API routes)

### Tailwind Theme

Custom colors defined in `tailwind.config.js`:

- `street-900` (#0a0a0a), `street-800` (#1a1a1a), `street-700` (#2a2a2a)
- `street-accent` (#ffd700), `street-accentHover` (#ffed4e)

### API Routes

- `/api/delete-account` — account deletion (uses service role key)

### Image Config

`next.config.js` whitelists `picsum.photos` and `images.unsplash.com` for `next/image`.

## Working Rules (Token-Safe + No-Surprises)

### Core principles

- **Do not rescan the whole repository** unless I explicitly ask (avoid broad “Explore/Analyze codebase”).
- Prefer **small, targeted changes** over large refactors.
- If information is missing, **ask me** or tell me exactly what command to run to fetch it.
- Keep answers **short, direct, action-oriented**.

### No code without GO

- **Never generate or apply code changes** unless I say **“GO”**.
- Default behavior: propose a **plan** + **what file(s)** + **what I should check/run** first.

### Scope control (very important)

- Work **one objective at a time**:
  1. define objective
  2. identify exact file(s)
  3. propose minimal plan
  4. I say **GO**
  5. implement minimal change
  6. I test
  7. commit message suggestion

### Context & token management

- Prefer **file-by-file** reasoning (only open the files I mention).
- If you need more context, ask for **1–3 specific files** max.
- Keep sessions **30–45 min max**, then suggest a summary + stop.
- At end of each session, write a **Session Summary**:
  - what changed
  - files touched
  - commands run
  - next 1–3 steps

### StreetConnect constraints (safety)

- **No breaking changes**: avoid refactors that can disrupt working features.
- Avoid “optimization” (memo/callback/cache) unless there is a proven perf issue.
- For backend/Supabase changes (RLS, policies, migrations): **do not modify** unless I explicitly ask.

### Allowed actions by default

- Explain code, architecture, bugs, and tradeoffs.
- Propose plans, checklists, and minimal diffs.
- Ask precise questions when needed.

### Model & tool usage constraints

- Prefer **reasoning in plain text** over tool calls.
- Avoid using tools unless strictly necessary.
- Do not use "Explore" or large context tools by default.
- If a tool is required, explain **why** before using it.
