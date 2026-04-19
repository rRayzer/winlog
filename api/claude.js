export const config = { api: { bodyParser: true } };

const DAILY_WIN_LIMIT = 25;

async function verifyUserAndCount(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return { ok: true, count: 0, guest: true };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return { ok: true, count: 0 };
  }
  const jwt = authHeader.slice(7);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = `${process.env.SUPABASE_URL}/rest/v1/wins?select=id&date=gte.${encodeURIComponent(since)}`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      Prefer: 'count=exact',
    },
  });
  if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: 'Session expired — sign in again' };
  if (!res.ok) return { ok: true, count: 0 };
  const range = res.headers.get('content-range') || '';
  const count = parseInt(range.split('/')[1] || '0', 10);
  return { ok: true, count: isNaN(count) ? 0 : count };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  const userMessage = req.body?.messages?.find(m => m.role === 'user')?.content || '';
  if (typeof userMessage === 'string' && userMessage.length > 5000) {
    return res.status(400).json({ error: 'Input too long.' });
  }

  const gate = await verifyUserAndCount(req.headers.authorization);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
  if (gate.count >= DAILY_WIN_LIMIT) {
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
      body: JSON.stringify({ ...req.body, max_tokens: Math.min(req.body.max_tokens || 500, 600) }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || data.error || 'Claude API error';
      console.error('Anthropic error:', response.status, msg);
      return res.status(response.ok ? 400 : response.status).json({ error: msg });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Failed to reach Claude API' });
  }
}
