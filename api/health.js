export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    service: 'GToneBOT',
    brand: 'GARHY TECH',
    provider: 'groq',
    models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'],
    groqAuth: Boolean(process.env.GROQ_API_KEY),
    runtime: process.env.VERCEL ? 'vercel' : 'local',
  });
}
