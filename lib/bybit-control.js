import crypto from 'node:crypto';

export function isControlConfigured() {
  return Boolean(process.env.BYBIT_CONTROL_TOKEN?.trim());
}

function safeEqualText(left, right) {
  const a = Buffer.from(left || '', 'utf8');
  const b = Buffer.from(right || '', 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireBybitControl(req) {
  const expected = process.env.BYBIT_CONTROL_TOKEN?.trim();
  if (!expected) {
    return { ok: false, status: 503, code: 'CONTROL_TOKEN_NOT_CONFIGURED' };
  }

  const authHeader = Array.isArray(req.headers?.authorization)
    ? req.headers.authorization[0]
    : req.headers?.authorization;
  const match = typeof authHeader === 'string' && authHeader.match(/^Bearer\s+(.+)$/i);
  const supplied = match?.[1]?.trim() || '';

  if (!safeEqualText(supplied, expected)) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED' };
  }

  return { ok: true };
}
