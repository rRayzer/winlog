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
Win object: `{ id, raw, clean, category, impact, source, date, session_id }`
- `category`: one of `delivery | leadership | stakeholder | strategy | growth`
- `source`: `text` or `voice`
- Stored in Supabase `wins` table, scoped by `session_id` (UUID in localStorage)

## Roadmap phases (from Notion)
- ✅ V2 - Done
- 🔄 V3 - React + Infra (Supabase ✅, deploy pending)
- 🔜 V4 - Auth + Voice
- 🔜 Beta
- 🔜 V5 - Growth

## Notion
Roadmap DB: https://www.notion.so/31d8957fea8e40869503406304afbcc7

## Current stopping point (resume here)
Supabase is live and working locally. Next: deploy to Vercel production, then check what's next on the V3 roadmap.

## Supabase
- Project URL: https://swberpmhzcrwfpadbtsq.supabase.co
- `wins` table live with RLS (anon full access policy, will tighten in V4 with auth)
- `session_id` (UUID persisted in localStorage) scopes wins per device
- `api/config.js` exposes SUPABASE_URL + SUPABASE_ANON_KEY to frontend
- On first load, any existing localStorage wins are migrated automatically

## Env vars (all set in Vercel + .env.local)
- `ANTHROPIC_API_KEY` — Claude API
- `SUPABASE_URL` — https://swberpmhzcrwfpadbtsq.supabase.co
- `SUPABASE_ANON_KEY` — publishable key

## Key files
- `winlog.html` — dev version (keep in sync with index.html)
- `index.html` — prod/deployed version
- `api/claude.js` — proxies Anthropic API calls
- `api/config.js` — exposes Supabase config to frontend
