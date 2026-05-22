export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, params } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const NEON_CONN = process.env.NEON_CONNECTION_STRING;

  try {
    // Extrai host e credenciais da connection string
    const url = new URL(NEON_CONN);
    const host = url.hostname;
    const endpoint = `https://${host}/sql`;
    const auth = Buffer.from(`${url.username}:${decodeURIComponent(url.password)}`).toString('base64');

    const neonRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth,
        'Neon-Connection-String': NEON_CONN
      },
      body: JSON.stringify({ query, params: params || [] })
    });

    if (!neonRes.ok) {
      const err = await neonRes.text();
      return res.status(500).json({ error: err });
    }

    const data = await neonRes.json();
    return res.status(200).json({ rows: data.rows || [] });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
