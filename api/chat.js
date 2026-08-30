import { validateChatInput } from '../lib/validation.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 15;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const buckets = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || current.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return url.host === host;
  } catch {
    return false;
  }
}

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function safeProviderMessage(payload, fallback) {
  const message = payload?.error?.message;
  if (typeof message !== 'string' || !message.trim()) return fallback;
  const lower = message.toLowerCase();
  if (lower.includes('rate limit')) return 'Groq rate limit reached. Try again shortly.';
  if (lower.includes('invalid api key') || lower.includes('authentication')) return 'Groq authentication failed.';
  return fallback;
}

function identitySystemMessage(model) {
  return {
    role: 'system',
    content: [
      'You are Hana, the feminine AI assistant of GARHY TECH.',
      'Your public product identity and name are always Hana.',
      'You are an AI assistant, not a human, and you must not invent a human biography or claim to be a real woman.',
      'When speaking Arabic, always refer to yourself using feminine grammatical forms, such as أنا مساعدة ذكية, and never use masculine self-reference.',
      'In other languages, use natural feminine references for yourself where the language supports grammatical gender.',
      `You are currently powered by the ${model} open-weight model and served through Groq Cloud API.`,
      'Never claim to be GPT-4, ChatGPT, GToneBOT, or a different model or product identity.',
      'If asked who or what you are, identify yourself as Hana, the AI assistant of GARHY TECH, and when technically relevant state the current gpt-oss model accurately.',
      'Respond in the user\'s language unless they ask otherwise.',
    ].join(' '),
  };
}

export default async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > 32768) {
    return res.status(413).json({ error: 'Request too large.' });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  const parsed = validateChatInput(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GROQ_API_KEY is not configured.' });
  }

  const { model, reasoning, messages } = parsed.value;
  const brandedMessages = [identitySystemMessage(model), ...messages];

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: brandedMessages,
        reasoning_effort: reasoning,
        include_reasoning: false,
        temperature: 0.6,
        top_p: 0.95,
        max_completion_tokens: 1024,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const fallback = response.status === 429
        ? 'Groq rate limit reached. Try again shortly.'
        : response.status === 401 || response.status === 403
          ? 'Groq authentication failed.'
          : 'Groq request failed.';
      console.error('Groq API error', {
        status: response.status,
        message: String(payload?.error?.message || '').slice(0, 300),
      });
      return res.status(response.status === 429 ? 429 : 502).json({
        error: safeProviderMessage(payload, fallback),
      });
    }

    const reply = payload?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({ error: 'The model returned an empty response.' });
    }

    return res.status(200).json({
      reply,
      name: 'Hana',
      genderStyle: 'feminine',
      model: payload?.model || model,
      provider: 'groq',
      usage: payload?.usage || null,
    });
  } catch (error) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('Groq request error', {
      name: error?.name,
      message: String(error?.message || '').slice(0, 300),
    });
    return res.status(502).json({
      error: isTimeout ? 'The model request timed out.' : 'Groq request failed.',
    });
  }
}
