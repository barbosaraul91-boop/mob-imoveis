import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, params } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const sql = neon(process.env.NEON_CONNECTION_STRING);
    const rows = await sql(query, params || []);
    return res.status(200).json({ rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
