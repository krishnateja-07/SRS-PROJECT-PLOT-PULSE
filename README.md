# 🌱 Community Garden Planner

**Grow Together. Track Better. Harvest Smarter.**

An AI-powered, 3D community garden planner. Volunteers map garden beds, log plants and sowing dates, track growth on a calendar, record harvests, and get help from an AI assistant, all on one shared, live database.

**Live demo:** https://community-garden-planner-delta.vercel.app

---

## ✨ Features

| Area | What it does |
|---|---|
| **Overview Dashboard** | Live stats, monthly harvest chart, upcoming tasks, activity feed, and a 360° rotatable 3D "Garden Core" model whose gold orbs are clickable live stats |
| **3D Garden** | A night-time 3D diorama built from your real beds: swaying grass, greenhouse, pond, lamp posts and string lights. Click a bed to highlight it and see what's growing |
| **Garden Beds** | Create, edit and delete beds with auto IDs (`BED-001`…), size, soil type and zone; assign plants; search and filter |
| **Plants** | Full plant records (bed, sowing date, expected harvest, growth stage, quantity). Picking a known crop fills in its category and harvest date |
| **AI Plant Recommendations** | Enter location, season, soil, space, sun and water to get plants matched to your free beds, then add one to the plan in a click |
| **AI Plant Health** | Upload a leaf photo for an AI estimate of visible stress signs and care steps. Clearly labelled as an estimate, not a diagnosis |
| **Garden AI Chat** | A chat assistant that knows your real beds, plants and open tasks |
| **Sowing Calendar** | Month view of sowings, expected harvests and tasks, reminders, a care-schedule generator and growth timelines |
| **Harvest Records** | Log every pick (kg, g, lb, pieces, bunches), with filters, totals and CSV export |
| **Analytics** | Six charts (plant mix, categories, bed usage, harvest by crop, monthly trends, growth tracking) plus CSV reports |
| **Settings** | Database and AI connection status, setup steps for the Gemini key, security notes, offline-copy controls |
| **Accounts & private gardens** | Email sign-in, several gardens per account, invite codes, and owner / editor / viewer roles enforced by row-level security |
| **Instant & offline** | Changes appear instantly (optimistic updates with rollback). Works offline: an app-shell service worker, a local copy of each garden, and an outbox that syncs when you reconnect |

| **Search everywhere** | Postgres full-text search (weighted, ranked, prefix matching) on every list, plus a **Ctrl/⌘ + K** command palette across plants, beds, harvests and tasks |
| **Monitoring** | Every AI call is logged with a request ID; Settings shows live health: error rate, p95 latency and rate-limited calls |

**Honest AI:** if no AI key is configured, every AI feature runs in a clearly labelled **demo mode**. It never pretends to analyse anything.

---

## 🧱 Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **3D:** Three.js, React Three Fiber, drei, postprocessing (bloom)
- **Charts and icons:** Recharts, lucide-react
- **Backend:** Supabase Postgres (row-level security, triggers, sequences)
- **AI:** Google Gemini, called only from a Supabase Edge Function (`garden-ai`), so the key never reaches the browser
- **Testing:** Vitest + Testing Library (unit and component), Playwright (end-to-end), GitHub Actions CI
- **Hosting:** Vercel

---

## 📁 Project structure (flat: one file per language)

```
community-garden-planner/
├── app.tsx                  # ALL frontend code: types, helpers, AI + search clients, state
│                            #   contexts, 3D scenes, UI components, forms, pages, routes, entry point
├── styles.css               # All CSS (Tailwind v4 theme tokens, glass cards, animations)
├── index.html               # HTML entry (fonts, favicon, meta)
├── schema.sql               # ALL database SQL: tables, seed data, search, accounts + RLS
├── garden-ai-function.ts    # Supabase Edge Function (Gemini proxy, Deno runtime)
├── sw.js                    # Service worker (offline app shell)
├── manifest.webmanifest, icon.svg   # PWA manifest and icon
├── tests.test.tsx           # All unit + component tests (Vitest)
├── e2e.spec.ts              # All end-to-end tests (Playwright, with an in-memory Supabase mock)
├── vite.config.ts           # Vite + React + Tailwind + Vitest config
├── playwright.config.ts, tsconfig.json, package.json, package-lock.json
├── vercel.json, .env.example, .gitignore, LICENSE
└── ci.yml                   # GitHub Actions workflow (move to .github/workflows/ci.yml to enable)
```

`app.tsx` is organised in clearly labelled sections, in dependency order. Search for the banner comments
(`// lib/...`, `// pages/...`, `// three/...`) to jump between the original modules.

---

## 🚀 Quick start

```bash
git clone https://github.com/<your-username>/community-garden-planner.git
cd community-garden-planner
npm install
cp .env.example .env.local     # add your Supabase URL and anon/publishable key
npm run dev                    # http://localhost:5173
```

You'll also need the database tables. See [Setup](#-setup) below: one SQL file and about five minutes.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; run `npx playwright install chromium` once) |
| `npm run test:all` | Both test suites |

---

## 🔐 Security

- The **Gemini API key never reaches the browser.** It is a Supabase Edge Function secret (`GEMINI_API_KEY`).
- The browser holds only the **public** Supabase URL and anon key. Row-level security limits that key to the `garden_` tables.
- **Accounts and roles:** private gardens are visible only to members. Owners manage members and invite codes, editors change data, viewers can only read. All of this is enforced by Postgres row-level security .
- The **Community Demo Garden** stays open so anyone can try the app without an account; don't store private data there.
- The AI function is **rate-limited** (20 calls a minute per client), size-checked and time-limited; every call is logged with a request ID .
- `.env.local` and `.env.production` are git-ignored. Never commit real keys.

---

---

## 🛠 Setup

1. **Requirements:** Node.js 20+, a free [Supabase](https://supabase.com) project, and optionally a [Google AI Studio](https://aistudio.google.com/app/apikey) key for live AI.
2. **Database:** in Supabase open **SQL Editor**, paste all of `schema.sql` and run it once. (It creates the tables, sample data, full-text search, AI call logs, accounts and row-level security.)
3. **Frontend keys:** copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API). Both are public by design.
4. **AI (optional):** the Edge Function must live at `supabase/functions/garden-ai/index.ts` for the Supabase CLI. Create that path, copy `garden-ai-function.ts` into it, then:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy garden-ai
   ```
   Or paste the file into **Edge Functions → Create function** in the Supabase dashboard. Add the secret `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-2.5-flash`). Without a key the app runs in clearly labelled demo mode.
5. **Run:** `npm install && npm run dev`, then open http://localhost:5173.

## 🌐 Deployment (GitHub → Vercel)

```bash
git init && git add . && git commit -m "Community Garden Planner"
git branch -M main
git remote add origin https://github.com/<your-username>/community-garden-planner.git
git push -u origin main
```

Import the repo at [vercel.com/new](https://vercel.com/new) (Vite is detected: build `npm run build`, output `dist`) and add the two `VITE_SUPABASE_*` environment variables. `vercel.json` rewrites every route to `index.html`. Keep `GEMINI_API_KEY` in Supabase only, never in Vercel or the code.
