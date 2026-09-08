import { BybitError, bybitRequest } from '../lib/bybit.js';
import { requireBybitControl } from '../lib/bybit-control.js';

const SAFE_AD_PAYLOAD_KEYS = new Set([
  'tokenId', 'currencyId', 'side', 'priceType', 'premium', 'price', 'minAmount', 'maxAmount',
  'remark', 'tradingPreferenceSet', 'paymentIds', 'quantity', 'paymentPeriod', 'itemId', 'actionType',
]);

function send(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
}

function fail(status, code, message) {
  const error = new Error(message);
  error.httpStatus = status;
  error.code = code;
  throw error;
}

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      fail(400, 'INVALID_JSON', 'Request body must be valid JSON');
    }
  }
  return {};
}

function text(value, name, max = 200, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(400, 'INVALID_INPUT', `${name} is required`);
    return undefined;
  }
  const result = String(value).trim();
  if (!result || result.length > max) fail(400, 'INVALID_INPUT', `${name} is invalid`);
  return result;
}

function integer(value, name, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, 'INVALID_INPUT', `${name} is invalid`);
  return n;
}

function auth(req, res) {
  const result = requireBybitControl(req);
  if (!result.ok) {
    send(res, result.status, { ok: false, error: result.code });
    return false;
  }
  return true;
}

function pagePayload(body, defaultSize = 20) {
  return {
    page: integer(body.page, 'page', 1, 100000, 1),
    size: integer(body.size, 'size', 1, 50, defaultSize),
  };
}

function optionalFilters(body, keys) {
  const result = {};
  for (const key of keys) {
    const value = text(body[key], key, 120, { required: false });
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function safeAdPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(400, 'INVALID_INPUT', 'payload must be an object');
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!SAFE_AD_PAYLOAD_KEYS.has(key)) continue;
    if (entry === undefined || entry === null || entry === '') continue;
    result[key] = entry;
  }
  if (!Object.keys(result).length) fail(400, 'INVALID_INPUT', 'payload has no supported fields');
  return result;
}

async function p2p(path, params = {}) {
  return bybitRequest('POST', path, params);
}

async function handle(req, res) {
  if (!auth(req, res)) return;
  const body = bodyOf(req);
  const action = text(body.action, 'action', 80).toLowerCase();

  if (action === 'status' || action === 'user-info') {
    const data = await p2p('/v5/p2p/user/personal/info', {});
    return send(res, 200, {
      ok: true,
      available: true,
      service: 'bybit-p2p-v5',
      data: data.result,
      timestamp: Date.now(),
    });
  }

  if (action === 'payment-methods') {
    const data = await p2p('/v5/p2p/user/payment/list', {});
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'orders') {
    const payload = {
      ...pagePayload(body),
      ...optionalFilters(body, ['status', 'side', 'beginTime', 'endTime', 'tokenId', 'currencyId']),
    };
    const data = await p2p('/v5/p2p/order/simplifyList', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'pending-orders') {
    const data = await p2p('/v5/p2p/order/pending/simplifyList', pagePayload(body));
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'order-detail') {
    const data = await p2p('/v5/p2p/order/info', { orderId: text(body.orderId, 'orderId', 100) });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'counterparty-info') {
    const data = await p2p('/v5/p2p/user/order/personal/info', { orderId: text(body.orderId, 'orderId', 100) });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'my-ads') {
    const payload = {
      ...pagePayload(body),
      ...optionalFilters(body, ['status', 'side', 'tokenId', 'currencyId']),
    };
    const data = await p2p('/v5/p2p/item/personal/list', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'online-ads') {
    const payload = {
      ...pagePayload(body),
      ...optionalFilters(body, ['side', 'tokenId', 'currencyId', 'payment']),
    };
    const data = await p2p('/v5/p2p/item/online', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'ad-detail') {
    const data = await p2p('/v5/p2p/item/info', { itemId: text(body.itemId, 'itemId', 100) });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'create-ad') {
    if (body.confirm !== 'CREATE_P2P_AD') fail(400, 'CONFIRMATION_REQUIRED', 'create-ad requires confirm=CREATE_P2P_AD');
    const data = await p2p('/v5/p2p/item/create', safeAdPayload(body.payload));
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'update-ad') {
    if (body.confirm !== 'UPDATE_P2P_AD') fail(400, 'CONFIRMATION_REQUIRED', 'update-ad requires confirm=UPDATE_P2P_AD');
    const payload = safeAdPayload(body.payload);
    payload.itemId = payload.itemId || text(body.itemId, 'itemId', 100);
    const data = await p2p('/v5/p2p/item/update', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'remove-ad') {
    if (body.confirm !== 'CANCEL_P2P_AD') fail(400, 'CONFIRMATION_REQUIRED', 'remove-ad requires confirm=CANCEL_P2P_AD');
    const data = await p2p('/v5/p2p/item/cancel', { itemId: text(body.itemId, 'itemId', 100) });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'mark-paid') {
    if (body.confirm !== 'P2P_PAID') fail(400, 'CONFIRMATION_REQUIRED', 'mark-paid requires confirm=P2P_PAID');
    const data = await p2p('/v5/p2p/order/pay', {
      orderId: text(body.orderId, 'orderId', 100),
      paymentType: text(body.paymentType, 'paymentType', 100),
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'release') {
    if (body.confirm !== 'RELEASE_P2P') fail(400, 'CONFIRMATION_REQUIRED', 'release requires confirm=RELEASE_P2P');
    const data = await p2p('/v5/p2p/order/finish', { orderId: text(body.orderId, 'orderId', 100) });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'send-message') {
    const data = await p2p('/v5/p2p/order/message/send', {
      orderId: text(body.orderId, 'orderId', 100),
      message: text(body.message, 'message', 1000),
      contentType: text(body.contentType, 'contentType', 20, { required: false }) || 'str',
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'messages') {
    const data = await p2p('/v5/p2p/order/message/listpage', {
      orderId: text(body.orderId, 'orderId', 100),
      size: integer(body.size, 'size', 1, 50, 30),
      lastId: integer(body.lastId, 'lastId', 0, Number.MAX_SAFE_INTEGER, 0),
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'chat-sessions') {
    const data = await p2p('/v5/p2p/chat/session/list', pagePayload(body, 30));
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'chat-message-list') {
    const data = await p2p('/v5/p2p/chat/message/listpage', {
      orderId: text(body.orderId, 'orderId', 100),
      size: integer(body.size, 'size', 1, 50, 30),
      lastId: integer(body.lastId, 'lastId', 0, Number.MAX_SAFE_INTEGER, 0),
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'chat-send') {
    const data = await p2p('/v5/p2p/chat/message/send', {
      orderId: text(body.orderId, 'orderId', 100),
      message: text(body.message, 'message', 1000),
      contentType: text(body.contentType, 'contentType', 20, { required: false }) || 'str',
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  fail(404, 'UNKNOWN_ACTION', 'Unknown P2P action');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }
    return await handle(req, res);
  } catch (error) {
    if (error instanceof BybitError) {
      return send(res, error.status || 502, {
        ok: false,
        error: 'BYBIT_P2P_ERROR',
        retCode: error.retCode,
        message: error.message,
      });
    }
    return send(res, error.httpStatus || 500, {
      ok: false,
      error: error.code || 'INTERNAL_ERROR',
      message: error.httpStatus ? error.message : 'Internal server error',
    });
  }
}
