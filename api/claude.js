export const config = { api: { bodyParser: true } };

// The client never chooses the model, the prompt, or the token budget — it names an
// action and supplies data. Anything else is rejected. This endpoint is public, so
// treat every field in req.body as hostile input.
const MODEL = 'claude-haiku-4-5-20251001';

const DAILY_WIN_LIMIT = 25;
const GUEST_WINDOW_MS = 15 * 60 * 1000; // 15 min
const GUEST_MAX_PER_WINDOW = 10;        // ~2x the 5-win trial, leaves room for retries
const GUEST_MAX_IPS = 5000;             // cap map size per warm container

const MAX_RAW_CHARS = 5000;   // reject above this
const MODEL_RAW_CHARS = 2000; // truncate to this before sending to the model
const MAX_DIGEST_WINS = 20;

const ALLOWED_CATEGORIES = ['delivery', 'leadership', 'stakeholder', 'strategy', 'growth'];

const PROMPTS = {
  clean: {
    max_tokens: 300,
    system: `You are a PM career coach. Transform raw win descriptions into powerful resume-ready bullets.
Return ONLY a valid JSON object with these exact keys:
- "clean": Single bullet point. Past tense. Starts with a strong action verb. Impact-driven. Max 20 words. No "I" pronoun.
- "category": Exactly one of: delivery, leadership, stakeholder, strategy, growth
- "impact": One short phrase quantifying or qualifying impact if inferable, else empty string
Output raw JSON only. No markdown, no code fences, no explanation.`,
  },
  digest: {
    max_tokens: 600,
    system: `You are a PM career coach writing a manager-ready performance summary.
Given a list of wins, produce exactly:
1. A short intro paragraph (2-3 sentences, confident first person) summarizing the overall impact and themes.
2. Categorized bullet points grouped by theme (use ▸ prefix). Only include categories that have wins.
3. One closing sentence on what this body of work signals about them as a PM.
Tone: direct, confident, no filler. Paste-ready for a performance review or 1:1.`,
  },
};

// In-memory rate limit for unverified callers. Resets on cold start; per-container.
// Good enough for beta-scale abuse prevention; swap for Upstash/KV at scale.
const guestBuckets = new Map();

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkGuestRate(ip) {
  const now = Date.now();
  const entry = guestBuckets.get(ip);
  if (!entry || now - entry.windowStart > GUEST_WINDOW_MS) {
    if (guestBuckets.size >= GUEST_MAX_IPS) {
      // Drop oldest entry to keep memory bounded
      const firstKey = guestBuckets.keys().next().value;
      if (firstKey) guestBuckets.delete(firstKey);
    }
    guestBuckets.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }
  entry.count++;
  if (entry.count > GUEST_MAX_PER_WINDOW) {
    return { ok: false, error: 'Too many requests. Sign up to keep logging wins.' };
  }
  return { ok: true };
}

// Returns { verified } so callers can rate-limit anything we could not attribute to a
// real user — including a request that carries a Bearer token we were unable to check.
async function verifyUserAndCount(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return { ok: true, count: 0, verified: false };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return { ok: true, count: 0, verified: false };
  }
  const jwt = authHeader.slice(7);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = `${process.env.SUPABASE_URL}/rest/v1/wins?select=id&date=gte.${encodeURIComponent(since)}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwt}`,
        Prefer: 'count=exact',
      },
    });
  } catch {
    return { ok: true, count: 0, verified: false };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: 'Session expired — sign in again' };
  if (!res.ok) return { ok: true, count: 0, verified: false };
  const range = res.headers.get('content-range') || '';
  const count = parseInt(range.split('/')[1] || '0', 10);
  return { ok: true, count: isNaN(count) ? 0 : count, verified: true };
}

// Builds the Anthropic request from validated inputs. Returns { error } on bad input.
function buildRequest(body) {
  const action = body?.action;
  if (action !== 'clean' && action !== 'digest') {
    return { error: 'Unknown action.' };
  }

  if (action === 'clean') {
    const raw = body?.raw;
    if (typeof raw !== 'string' || !raw.trim()) return { error: 'Nothing to clean up.' };
    if (raw.length > MAX_RAW_CHARS) return { error: 'Input too long.' };
    return {
      action,
      payload: {
        model: MODEL,
        max_tokens: PROMPTS.clean.max_tokens,
        system: PROMPTS.clean.system,
        messages: [{ role: 'user', content: raw.slice(0, MODEL_RAW_CHARS) }],
      },
    };
  }

  const wins = body?.wins;
  if (!Array.isArray(wins) || !wins.length) return { error: 'Log some wins first.' };
  const list = wins
    .slice(0, MAX_DIGEST_WINS)
    .map(w => {
      const cat = ALLOWED_CATEGORIES.includes(String(w?.category || '').toLowerCase())
        ? String(w.category).toLowerCase()
        : 'delivery';
      const clean = String(w?.clean || '').slice(0, 300);
      return clean ? `[${cat}] ${clean}` : '';
    })
    .filter(Boolean)
    .join('\n');
  if (!list) return { error: 'Log some wins first.' };

  return {
    action,
    payload: {
      model: MODEL,
      max_tokens: PROMPTS.digest.max_tokens,
      system: PROMPTS.digest.system,
      messages: [{ role: 'user', content: `My wins this period:\n${list}` }],
    },
  };
}

function textFrom(data) {
  return data?.content?.find(b => b.type === 'text')?.text || '';
}

function wordCap(s, n) {
  const parts = String(s || '').trim().split(/\s+/);
  return parts.length <= n ? parts.join(' ') : parts.slice(0, n).join(' ') + '…';
}

// Claude is instructed to return bare JSON, but never trust that — strip fences,
// tolerate parse failure, and coerce every field into the shape the UI expects.
function shapeCleanResult(text) {
  let parsed = {};
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    parsed = {};
  }
  const cat = String(parsed?.category || '').toLowerCase().trim();
  return {
    clean: wordCap(parsed?.clean || '', 24),
    category: ALLOWED_CATEGORIES.includes(cat) ? cat : 'delivery',
    impact: typeof parsed?.impact === 'string' ? parsed.impact.slice(0, 140) : '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  const built = buildRequest(req.body);
  if (built.error) return res.status(400).json({ error: built.error });

  const gate = await verifyUserAndCount(req.headers.authorization);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

  // Anything we could not tie to a signed-in user gets the per-IP limit.
  if (!gate.verified) {
    const rl = checkGuestRate(getClientIp(req));
    if (!rl.ok) return res.status(429).json({ error: rl.error });
  } else if (gate.count >= DAILY_WIN_LIMIT) {
    return res.status(429).json({ error: `Daily limit reached (${DAILY_WIN_LIMIT} wins). Try again tomorrow.` });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(built.payload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || data.error || 'Claude API error';
      console.error('Anthropic error:', response.status, msg);
      return res.status(response.ok ? 400 : response.status).json({ error: msg });
    }

    if (built.action === 'clean') return res.status(200).json(shapeCleanResult(textFrom(data)));
    return res.status(200).json({ digest: textFrom(data) || 'Could not generate digest.' });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Failed to reach Claude API' });
  }
}
