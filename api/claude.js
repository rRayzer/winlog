export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  const userMessage = req.body?.messages?.find(m => m.role === 'user')?.content || '';
  if (typeof userMessage === 'string' && userMessage.length > 5000) {
    return res.status(400).json({ error: 'Input too long.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...req.body, max_tokens: Math.min(req.body.max_tokens || 500, 500) }),
    });

    const data = await response.json();

    // Anthropic sometimes returns 200 with an error body (e.g. billing issues)
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
