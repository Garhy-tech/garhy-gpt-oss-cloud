import { BybitError, bybitRequest } from '../lib/bybit.js';
import { requireBybitControl } from '../lib/bybit-control.js';

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
    try { return JSON.parse(req.body); } catch { fail(400, 'INVALID_JSON', 'Request body must be valid JSON'); }
  }
  return {};
}

function text(value, name, max = 200) {
  if (value === undefined || value === null || value === '') fail(400, 'INVALID_INPUT', `${name} is required`);
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

async function p2p(path, params = {}) {
  return bybitRequest('POST', path, params);
}

async function handle(req, res) {
  if (!auth(req, res)) return;
  const body = bodyOf(req);
  const action = text(body.action, 'action', 80).toLowerCase();

  if (action === 'user-info') {
    const data = await p2p('/v5/p2p/user/personal/info', {});
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'payment-methods') {
    const data = await p2p('/v5/p2p/user/payment/list', {});
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'orders') {
    const payload = {
      page: integer(body.page, 'page', 1, 100000, 1),
      size: integer(body.size, 'size', 1, 50, 20),
    };
    if (body.status !== undefined && body.status !== '') payload.status = String(body.status).trim();
    if (body.side !== undefined && body.side !== '') payload.side = String(body.side).trim();
    if (body.beginTime !== undefined && body.beginTime !== '') payload.beginTime = String(body.beginTime).trim();
    if (body.endTime !== undefined && body.endTime !== '') payload.endTime = String(body.endTime).trim();
    const data = await p2p('/v5/p2p/order/simplifyList', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'pending-orders') {
    const payload = {
      page: integer(body.page, 'page', 1, 100000, 1),
      size: integer(body.size, 'size', 1, 50, 20),
    };
    const data = await p2p('/v5/p2p/order/pending/simplifyList', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'order-detail') {
    const data = await p2p('/v5/p2p/order/info', { orderId: text(body.orderId, 'orderId', 100) });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'my-ads') {
    const payload = {
      page: integer(body.page, 'page', 1, 100000, 1),
      size: integer(body.size, 'size', 1, 50, 20),
    };
    if (body.status !== undefined && body.status !== '') payload.status = String(body.status).trim();
    const data = await p2p('/v5/p2p/item/personal/list', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'ad-detail') {
    const data = await p2p('/v5/p2p/item/info', { itemId: text(body.itemId, 'itemId', 100) });
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
    const message = text(body.message, 'message', 1000);
    const data = await p2p('/v5/p2p/order/message/send', {
      orderId: text(body.orderId, 'orderId', 100),
      message,
      contentType: body.contentType ? text(body.contentType, 'contentType', 20) : 'str',
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
