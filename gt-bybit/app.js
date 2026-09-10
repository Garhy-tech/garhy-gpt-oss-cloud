const nativeFetch = window.fetch.bind(window);
let compatControlToken = '';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function requestUrl(input) {
  try { return new URL(input instanceof Request ? input.url : String(input), location.href); }
  catch { return null; }
}

function mergedHeaders(input, init = {}) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

window.fetch = async function compatFetch(input, init = {}) {
  const url = requestUrl(input);
  if (!url || url.origin !== location.origin || url.pathname !== '/api/bybit') {
    return nativeFetch(input, init);
  }

  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const action = method === 'GET' ? (url.searchParams.get('action') || 'health') : '';

  if (method === 'GET' && action === 'session') {
    return jsonResponse(compatControlToken ? {
      ok: true,
      authenticated: true,
      csrfToken: 'bearer-compat',
      expiresAt: Date.now() + SESSION_MS,
      absoluteLifetimeDays: 7,
      idleTimeout: false
    } : { ok: true, authenticated: false });
  }

  if (method === 'GET' && action === 'health') {
    const response = await nativeFetch(input, init);
    const data = await response.clone().json().catch(() => null);
    if (!response.ok || !data) return response;
    return jsonResponse({
      ...data,
      service: 'gt-bybit-v5',
      version: 'compat-1.0.0',
      bybitConfigured: data.authenticated === true,
      sessionStoreReady: true,
      mutationsEnabled: false,
      absoluteLifetimeDays: 7,
      idleTimeout: false
    }, response.status);
  }

  if (method === 'POST') {
    let body = null;
    try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch {}

    if (body?.action === 'login') {
      const candidate = String(body.controlToken || '').trim();
      if (!candidate) return jsonResponse({ ok: false, error: 'CONTROL_REQUIRED', message: 'أدخل رمز التحكم أولًا.' }, 400);

      const verify = await nativeFetch('/api/bybit?action=wallet', {
        method: 'GET',
        headers: { Authorization: `Bearer ${candidate}`, Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await verify.clone().json().catch(() => null);
      if (!verify.ok || result?.ok !== true) {
        return jsonResponse({
          ok: false,
          error: result?.error || 'UNAUTHORIZED',
          message: verify.status === 401 ? 'Control Token غير صحيح.' : (result?.message || 'تعذر التحقق من رمز التحكم.')
        }, verify.status || 401);
      }

      compatControlToken = candidate;
      return jsonResponse({
        ok: true,
        authenticated: true,
        csrfToken: 'bearer-compat',
        expiresAt: Date.now() + SESSION_MS,
        absoluteLifetimeDays: 7,
        idleTimeout: false
      });
    }

    if (body?.action === 'logout') {
      compatControlToken = '';
      return jsonResponse({ ok: true, authenticated: false });
    }
  }

  const headers = mergedHeaders(input, init);
  if (compatControlToken) headers.set('Authorization', `Bearer ${compatControlToken}`);
  return nativeFetch(input, { ...init, headers });
};

await import('/gt-bybit-app/gt-bybit/app.js?v=20260910-bearer-compat');
