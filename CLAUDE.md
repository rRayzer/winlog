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
V4 auth is built and ready to deploy. Supabase SQL must be run before deploying.

**Supabase SQL to run (if not done yet):**
```sql
ALTER TABLE wins ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS wins_user_id_idx ON wins(user_id);
DROP POLICY IF EXISTS "anon full access" ON wins;
CREATE POLICY "Users can manage own wins" ON wins
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Auth UX:**
- Guest users get 5 free wins (localStorage), then input locks with signup prompt
- Sign up → guest wins migrated to their account
- Sign in (existing user) → loads their Supabase wins, guest wins stay in localStorage

**Next actions:**
1. Run the Supabase SQL above and deploy
2. Add per-user rate limiting
3. Edit wins (quick feature, already on roadmap)
4. Voice input (V4 remaining)

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
