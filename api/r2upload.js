export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileName, contentType, data } = req.body || {};
  if (!fileName || !contentType || !data) return res.status(400).json({ error: 'Missing fields' });

  const R2_S3_ENDPOINT = process.env.R2_S3_ENDPOINT;
  const R2_BUCKET      = process.env.R2_BUCKET;
  const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY;
  const R2_SECRET_KEY  = process.env.R2_SECRET_KEY;
  const R2_PUBLIC_URL  = process.env.R2_PUBLIC_URL;

  // base64 → Buffer
  const buffer = Buffer.from(data, 'base64');

  // AWS Signature v4
  const crypto = await import('crypto');
  const now = new Date();
  const date = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
  const dateShort = date.substring(0, 8);
  const host = R2_S3_ENDPOINT.replace('https://', '');
  const path = '/' + R2_BUCKET + '/' + fileName;

  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalHeaders = 'host:' + host + '\nx-amz-content-sha256:' + payloadHash + '\nx-amz-date:' + date + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = 'PUT\n' + path + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

  const scope = dateShort + '/auto/s3/aws4_request';
  const crHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const strToSign = 'AWS4-HMAC-SHA256\n' + date + '\n' + scope + '\n' + crHash;

  function hmac(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest();
  }
  const k1 = hmac('AWS4' + R2_SECRET_KEY, dateShort);
  const k2 = hmac(k1, 'auto');
  const k3 = hmac(k2, 's3');
  const k4 = hmac(k3, 'aws4_request');
  const sig = hmac(k4, strToSign).toString('hex');

  const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${scope},SignedHeaders=${signedHeaders},Signature=${sig}`;

  try {
    const r2Res = await fetch(R2_S3_ENDPOINT + '/' + R2_BUCKET + '/' + fileName, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'x-amz-date': date,
        'x-amz-content-sha256': payloadHash,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      },
      body: buffer
    });

    if (!r2Res.ok) {
      const err = await r2Res.text();
      return res.status(500).json({ error: 'R2 error: ' + err });
    }

    return res.status(200).json({ url: R2_PUBLIC_URL + '/' + fileName });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
