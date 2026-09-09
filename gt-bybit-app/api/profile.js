const PROFILE_ORIGIN = 'https://bybit.garhy.tech';
const CHUNKS = Array.from({ length: 8 }, (_, index) => `${PROFILE_ORIGIN}/lib/profile/chunk${index + 1}.txt`);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  try {
    const responses = await Promise.all(CHUNKS.map((url) => fetch(url, { cache: 'no-store' })));
    if (responses.some((response) => !response.ok)) {
      return res.status(502).json({ ok: false, error: 'PROFILE_ASSET_UNAVAILABLE' });
    }

    const chunks = await Promise.all(responses.map((response) => response.text()));
    const image = Buffer.from(chunks.map((chunk) => chunk.trim()).join(''), 'base64');

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', String(image.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(image);
  } catch {
    return res.status(502).json({ ok: false, error: 'PROFILE_ASSET_UNAVAILABLE' });
  }
}
