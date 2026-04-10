# WinLog — Project Context

## What it is
A personal win-tracking web app for PMs. Users log raw wins (text or voice), Claude cleans them into resume-ready bullets, and the app tracks streaks/stats.

Live: https://winlog-sage.vercel.app

## Stack
- **Frontend:** Single-page HTML (`winlog.html` = dev, `index.html` = prod/deployed)
- **Backend:** Vercel serverless functions (`api/`)
- **AI:** Anthropic Claude API (proxied via `api/claude.js`)
- **DB:** Supabase (live — replaced localStorage)
- **Hosting:** Vercel

## Data model
Win object: `{ id, raw, clean, category, impact, source, date, user_id }`
- `category`: one of `delivery | leadership | stakeholder | strategy | growth`
- `source`: `text` or `voice`
- Stored in Supabase `wins` table, scoped by `user_id` (auth.users FK)
- Guest wins (pre-auth) stored in localStorage `winlog_v2`, count in `winlog_guest_count`

## Roadmap phases (from Notion)
- ✅ V2 - Done
- ✅ V3 - Supabase persistence, deployed
- 🔄 V4 - Auth + Voice (auth done, voice pending)
- 🔜 Beta
- 🔜 V5 - Growth

## Notion
Roadmap DB: https://www.notion.so/31d8957fea8e40869503406304afbcc7

## Current stopping point (resume here)
V4 auth is fully built, deployed, and live. Supabase SQL has been run.

**Auth UX (shipped):**
- Guest users get 5 free trial wins (localStorage only, ephemeral — not portable to account)
- After 5 wins, input locks with signup prompt
- Sign up / Sign in → guest localStorage wiped, real account wins load from Supabase
- Sign out → returns to home page in guest mode
- All wins scoped by `user_id` with RLS enforced

**Test account:** test@winlog.dev / WinLog#Test1

**Next actions:**
1. Disable Supabase email confirmation (currently ON — blocks sign-up flow until email clicked)
2. Add per-user rate limiting on the Claude API proxy
3. Edit wins (quick feature, already on roadmap)
4. Voice input (V4 remaining)
5. Beta prep

## Supabase
- Project URL: https://swberpmhzcrwfpadbtsq.supabase.co
- `wins` table live with RLS — policy: `auth.uid() = user_id` (user-scoped)
- `api/config.js` exposes SUPABASE_URL + SUPABASE_ANON_KEY to frontend
- Email confirmation is currently ON — needs disabling for smooth sign-up flow

## Env vars (all set in Vercel + .env.local)
- `ANTHROPIC_API_KEY` — Claude API
- `SUPABASE_URL` — https://swberpmhzcrwfpadbtsq.supabase.co
- `SUPABASE_ANON_KEY` — publishable key

## Key files
- `winlog.html` — dev version (keep in sync with index.html)
- `index.html` — prod/deployed version
- `api/claude.js` — proxies Anthropic API calls
- `api/config.js` — exposes Supabase config to frontend
