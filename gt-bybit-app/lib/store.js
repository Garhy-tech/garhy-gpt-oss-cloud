import { AppError } from './errors.js';

// Durable shared storage is mandatory. Never use per-function memory in production.
export function storeConfigured(env = process.env) {
  return Boolean((env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL) &&
    (env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN));
}

export function createRedisStore({ env = process.env, fetchImpl = fetch } = {}) {
  async function command(...args) {
    if (!storeConfigured(env)) throw new AppError('SESSION_STORE_UNAVAILABLE', 'لم يُهيأ مخزن الجلسات الآمن بعد.', 503);
    let endpoint;
    try { endpoint = new URL(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL); } catch { /* handled below */ }
    if (!endpoint || endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new AppError('SESSION_STORE_UNAVAILABLE', 'إعداد مخزن الجلسات غير صالح.', 503);
    }
    try {
      const response = await fetchImpl(endpoint.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN}` },
        body: JSON.stringify(args), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000),
      });
      const data = await response.json();
      if (!response.ok || data.error || !Object.hasOwn(data, 'result')) throw new Error('store');
      return data.result;
    } catch {
      throw new AppError('SESSION_STORE_UNAVAILABLE', 'مخزن الجلسات غير متاح. لم يُعد إرسال أي عملية تلقائيًا.', 503);
    }
  }
  return {
    async get(key) { const value = await command('GET', key); return value === null ? null : JSON.parse(value); },
    async set(key, value, ttl, onlyIfAbsent = false) {
      const args = ['SET', key, JSON.stringify(value), 'EX', Math.max(1, Math.ceil(ttl))];
      if (onlyIfAbsent) args.push('NX');
      return (await command(...args)) === 'OK';
    },
    async delete(key) { await command('DEL', key); },
    async increment(key, ttl) {
      return command('EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, ttl);
    },
  };
}
