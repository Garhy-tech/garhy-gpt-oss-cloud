import crypto from 'node:crypto';

const DEFAULT_BASE_URL = 'https://api.bybit.com';
const DEFAULT_RECV_WINDOW = 5000;
const REQUEST_TIMEOUT_MS = 10000;

export class BybitError extends Error {
  constructor(message, { status = 502, retCode = null, details = null } = {}) {
    super(message);
    this.name = 'BybitError';
    this.status = status;
    this.retCode = retCode;
    this.details = details;
  }
}

export function getBybitConfig() {
  const apiKey = process.env.BYBIT_API_KEY?.trim();
  const apiSecret = process.env.BYBIT_API_SECRET?.trim();
  const baseUrl = (process.env.BYBIT_API_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/$/, '');
  const recvWindowRaw = Number(process.env.BYBIT_RECV_WINDOW || DEFAULT_RECV_WINDOW);
  const recvWindow = Number.isFinite(recvWindowRaw) && recvWindowRaw >= 1000 && recvWindowRaw <= 60000
    ? Math.trunc(recvWindowRaw)
    : DEFAULT_RECV_WINDOW;

  if (!apiKey || !apiSecret) {
    throw new BybitError('Bybit credentials are not configured', { status: 503 });
  }

  if (!/^https:\/\//i.test(baseUrl)) {
    throw new BybitError('Invalid Bybit API base URL', { status: 500 });
  }

  return { apiKey, apiSecret, baseUrl, recvWindow };
}

function appendParam(searchParams, key, value) {
  if (value === undefined || value === null || value === '') return;
  if (Array.isArray(value)) {
    searchParams.set(key, value.join(','));
    return;
  }
  if (typeof value === 'boolean') {
    searchParams.set(key, value ? 'true' : 'false');
    return;
  }
  searchParams.set(key, String(value));
}

export function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) appendParam(searchParams, key, value);
  return searchParams.toString();
}

export function signHmac({ timestamp, apiKey, recvWindow, payload, apiSecret }) {
  const plainText = `${timestamp}${apiKey}${recvWindow}${payload}`;
  return crypto.createHmac('sha256', apiSecret).update(plainText).digest('hex');
}

export async function bybitRequest(method, path, payload = {}) {
  const config = getBybitConfig();
  const upperMethod = String(method || '').toUpperCase();
  if (!['GET', 'POST'].includes(upperMethod)) {
    throw new BybitError('Unsupported Bybit HTTP method', { status: 500 });
  }
  if (!/^\/v5\//.test(path)) {
    throw new BybitError('Invalid Bybit API path', { status: 500 });
  }

  const timestamp = Date.now().toString();
  const recvWindow = config.recvWindow.toString();
  const query = upperMethod === 'GET' ? buildQuery(payload) : '';
  const body = upperMethod === 'POST' ? JSON.stringify(payload) : '';
  const signingPayload = upperMethod === 'GET' ? query : body;
  const signature = signHmac({
    timestamp,
    apiKey: config.apiKey,
    recvWindow,
    payload: signingPayload,
    apiSecret: config.apiSecret,
  });

  const url = `${config.baseUrl}${path}${query ? `?${query}` : ''}`;
  const headers = {
    'Accept': 'application/json',
    'X-BAPI-API-KEY': config.apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN': signature,
  };
  if (upperMethod === 'POST') headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method: upperMethod,
      headers,
      body: upperMethod === 'POST' ? body : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'Bybit request timed out' : 'Unable to reach Bybit API';
    throw new BybitError(message, { status: 502 });
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new BybitError('Bybit returned a non-JSON response', { status: 502 });
  }

  if (!response.ok) {
    throw new BybitError(data?.retMsg || `Bybit HTTP ${response.status}`, {
      status: response.status === 403 ? 502 : response.status,
      retCode: data?.retCode ?? null,
    });
  }

  if (typeof data?.retCode === 'number' && data.retCode !== 0) {
    throw new BybitError(data.retMsg || 'Bybit API rejected the request', {
      status: 400,
      retCode: data.retCode,
    });
  }

  return data;
}

export async function verifyBybitConnection() {
  await bybitRequest('GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' });
  return true;
}
