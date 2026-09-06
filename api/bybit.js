import crypto from 'node:crypto';
import { BybitError, bybitRequest, verifyBybitConnection } from '../lib/bybit.js';
import { isControlConfigured, requireBybitControl } from '../lib/bybit-control.js';

const CATEGORIES = new Set(['spot', 'linear', 'inverse', 'option']);
const DERIVATIVE_CATEGORIES = new Set(['linear', 'inverse']);
const SIDES = new Set(['Buy', 'Sell']);
const ORDER_TYPES = new Set(['Market', 'Limit']);
const TIME_IN_FORCE = new Set(['GTC', 'IOC', 'FOK', 'PostOnly']);
const ACCOUNT_TYPES = new Set(['UNIFIED', 'FUND']);

let healthCache = { checkedAt: 0, ok: false };

function send(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
}

function fail(status, code, message, extra = {}) {
  const error = new Error(message);
  error.httpStatus = status;
  error.code = code;
  error.extra = extra;
  throw error;
}

function readBody(req) {
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

function stringValue(value, name, { required = true, upper = false, max = 100 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(400, 'INVALID_INPUT', `${name} is required`);
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    fail(400, 'INVALID_INPUT', `${name} must be a string`);
  }
  let result = String(value).trim();
  if (!result || result.length > max) fail(400, 'INVALID_INPUT', `${name} is invalid`);
  if (upper) result = result.toUpperCase();
  return result;
}

function decimal(value, name, { required = true, allowZero = false } = {}) {
  const result = stringValue(value, name, { required, max: 64 });
  if (result === undefined) return undefined;
  if (!/^\d+(?:\.\d+)?$/.test(result)) {
    fail(400, 'INVALID_INPUT', `${name} must be a positive decimal`);
  }
  const number = Number(result);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
    fail(400, 'INVALID_INPUT', `${name} must be a positive decimal`);
  }
  return result;
}

function category(value, { derivativeOnly = false } = {}) {
  const result = stringValue(value, 'category').toLowerCase();
  const allowed = derivativeOnly ? DERIVATIVE_CATEGORIES : CATEGORIES;
  if (!allowed.has(result)) fail(400, 'INVALID_INPUT', 'Unsupported category');
  return result;
}

function symbol(value) {
  const result = stringValue(value, 'symbol', { upper: true, max: 40 });
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(result)) fail(400, 'INVALID_INPUT', 'symbol is invalid');
  return result;
}

function optionalInteger(value, name, min, max) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(400, 'INVALID_INPUT', `${name} is invalid`);
  }
  return number;
}

function protectedRequest(req, res) {
  const auth = requireBybitControl(req);
  if (!auth.ok) {
    send(res, auth.status, { ok: false, error: auth.code });
    return false;
  }
  return true;
}

async function handleGet(req, res) {
  const action = String(req.query?.action || 'health').toLowerCase();

  if (action === 'health') {
    const now = Date.now();
    if (!healthCache.ok || now - healthCache.checkedAt > 60000) {
      await verifyBybitConnection();
      healthCache = { checkedAt: now, ok: true };
    }
    return send(res, 200, {
      ok: true,
      service: 'bybit-v5',
      authenticated: true,
      controlReady: isControlConfigured(),
      region: process.env.VERCEL_REGION || 'local',
      accountMode: 'UNIFIED',
      timestamp: Date.now(),
    });
  }

  if (!protectedRequest(req, res)) return;

  if (action === 'wallet') {
    const coin = req.query?.coin
      ? stringValue(req.query.coin, 'coin', { upper: true, required: false, max: 120 })
      : undefined;
    const data = await bybitRequest('GET', '/v5/account/wallet-balance', {
      accountType: 'UNIFIED',
      coin,
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'positions') {
    const cat = category(req.query?.category || 'linear', { derivativeOnly: true });
    const params = { category: cat };
    if (req.query?.symbol) params.symbol = symbol(req.query.symbol);
    else params.settleCoin = stringValue(req.query?.settleCoin || 'USDT', 'settleCoin', { upper: true });
    const data = await bybitRequest('GET', '/v5/position/list', params);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'orders') {
    const cat = category(req.query?.category || 'spot');
    const params = {
      category: cat,
      limit: optionalInteger(req.query?.limit, 'limit', 1, 50) || 20,
    };
    if (req.query?.symbol) params.symbol = symbol(req.query.symbol);
    else if (cat === 'linear' || cat === 'inverse') {
      params.settleCoin = stringValue(req.query?.settleCoin || 'USDT', 'settleCoin', { upper: true });
    }
    const data = await bybitRequest('GET', '/v5/order/realtime', params);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'order-history') {
    const cat = category(req.query?.category || 'spot');
    const params = {
      category: cat,
      limit: optionalInteger(req.query?.limit, 'limit', 1, 50) || 20,
    };
    if (req.query?.symbol) params.symbol = symbol(req.query.symbol);
    const data = await bybitRequest('GET', '/v5/order/history', params);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'executions') {
    const cat = category(req.query?.category || 'spot');
    const params = {
      category: cat,
      limit: optionalInteger(req.query?.limit, 'limit', 1, 100) || 50,
    };
    if (req.query?.symbol) params.symbol = symbol(req.query.symbol);
    const data = await bybitRequest('GET', '/v5/execution/list', params);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'transfers') {
    const params = { limit: optionalInteger(req.query?.limit, 'limit', 1, 50) || 20 };
    if (req.query?.coin) params.coin = stringValue(req.query.coin, 'coin', { upper: true });
    const data = await bybitRequest('GET', '/v5/asset/transfer/query-inter-transfer-list', params);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'convert-history') {
    const data = await bybitRequest('GET', '/v5/asset/exchange/query-convert-history', {
      limit: optionalInteger(req.query?.limit, 'limit', 1, 100) || 20,
      index: optionalInteger(req.query?.index, 'index', 1, 100000) || 1,
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  fail(404, 'UNKNOWN_ACTION', 'Unknown Bybit action');
}

async function handlePost(req, res) {
  if (!protectedRequest(req, res)) return;
  const body = readBody(req);
  const action = stringValue(body.action, 'action').toLowerCase();

  if (action === 'place-order') {
    const cat = category(body.category);
    const orderType = stringValue(body.orderType, 'orderType');
    const side = stringValue(body.side, 'side');
    if (!ORDER_TYPES.has(orderType) || !SIDES.has(side)) {
      fail(400, 'INVALID_INPUT', 'Invalid side or orderType');
    }

    const payload = {
      category: cat,
      symbol: symbol(body.symbol),
      side,
      orderType,
      qty: decimal(body.qty, 'qty'),
    };
    if (orderType === 'Limit') payload.price = decimal(body.price, 'price');
    if (body.timeInForce) {
      const tif = stringValue(body.timeInForce, 'timeInForce');
      if (!TIME_IN_FORCE.has(tif)) fail(400, 'INVALID_INPUT', 'Invalid timeInForce');
      payload.timeInForce = tif;
    }
    if (body.orderLinkId) payload.orderLinkId = stringValue(body.orderLinkId, 'orderLinkId', { max: 36 });
    if (body.reduceOnly !== undefined) payload.reduceOnly = Boolean(body.reduceOnly);
    if (body.closeOnTrigger !== undefined) payload.closeOnTrigger = Boolean(body.closeOnTrigger);
    if (body.marketUnit) payload.marketUnit = stringValue(body.marketUnit, 'marketUnit', { max: 20 });
    if (body.takeProfit) payload.takeProfit = decimal(body.takeProfit, 'takeProfit');
    if (body.stopLoss) payload.stopLoss = decimal(body.stopLoss, 'stopLoss');

    const data = await bybitRequest('POST', '/v5/order/create', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'cancel-order') {
    const payload = {
      category: category(body.category),
      symbol: symbol(body.symbol),
    };
    if (body.orderId) payload.orderId = stringValue(body.orderId, 'orderId', { max: 100 });
    if (body.orderLinkId) payload.orderLinkId = stringValue(body.orderLinkId, 'orderLinkId', { max: 36 });
    if (!payload.orderId && !payload.orderLinkId) {
      fail(400, 'INVALID_INPUT', 'orderId or orderLinkId is required');
    }
    const data = await bybitRequest('POST', '/v5/order/cancel', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'cancel-all') {
    if (body.confirm !== 'CANCEL_ALL') {
      fail(400, 'CONFIRMATION_REQUIRED', 'cancel-all requires confirm=CANCEL_ALL');
    }
    const cat = category(body.category);
    const payload = { category: cat };
    if (body.symbol) payload.symbol = symbol(body.symbol);
    if (body.baseCoin) payload.baseCoin = stringValue(body.baseCoin, 'baseCoin', { upper: true });
    if (body.settleCoin) payload.settleCoin = stringValue(body.settleCoin, 'settleCoin', { upper: true });
    if ((cat === 'linear' || cat === 'inverse') && !payload.symbol && !payload.baseCoin && !payload.settleCoin) {
      fail(400, 'INVALID_INPUT', 'symbol, baseCoin, or settleCoin is required for derivatives');
    }
    const data = await bybitRequest('POST', '/v5/order/cancel-all', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'set-leverage') {
    const payload = {
      category: category(body.category, { derivativeOnly: true }),
      symbol: symbol(body.symbol),
      buyLeverage: decimal(body.buyLeverage, 'buyLeverage'),
      sellLeverage: decimal(body.sellLeverage, 'sellLeverage'),
    };
    const data = await bybitRequest('POST', '/v5/position/set-leverage', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'set-trading-stop') {
    const payload = {
      category: category(body.category, { derivativeOnly: true }),
      symbol: symbol(body.symbol),
      tpslMode: stringValue(body.tpslMode || 'Full', 'tpslMode', { max: 20 }),
      positionIdx: optionalInteger(body.positionIdx, 'positionIdx', 0, 2) ?? 0,
    };
    if (body.takeProfit !== undefined) {
      payload.takeProfit = decimal(body.takeProfit, 'takeProfit', { allowZero: true });
    }
    if (body.stopLoss !== undefined) {
      payload.stopLoss = decimal(body.stopLoss, 'stopLoss', { allowZero: true });
    }
    if (body.trailingStop !== undefined) {
      payload.trailingStop = decimal(body.trailingStop, 'trailingStop', { allowZero: true });
    }
    if (body.activePrice !== undefined) {
      payload.activePrice = decimal(body.activePrice, 'activePrice', { allowZero: true });
    }
    if (payload.takeProfit === undefined && payload.stopLoss === undefined && payload.trailingStop === undefined) {
      fail(400, 'INVALID_INPUT', 'takeProfit, stopLoss, or trailingStop is required');
    }
    const data = await bybitRequest('POST', '/v5/position/trading-stop', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'transfer') {
    const fromAccountType = stringValue(body.fromAccountType, 'fromAccountType', { upper: true, max: 20 });
    const toAccountType = stringValue(body.toAccountType, 'toAccountType', { upper: true, max: 20 });
    if (!ACCOUNT_TYPES.has(fromAccountType) || !ACCOUNT_TYPES.has(toAccountType) || fromAccountType === toAccountType) {
      fail(400, 'INVALID_INPUT', 'Invalid account transfer direction');
    }
    const payload = {
      transferId: crypto.randomUUID(),
      coin: stringValue(body.coin, 'coin', { upper: true, max: 20 }),
      amount: decimal(body.amount, 'amount'),
      fromAccountType,
      toAccountType,
    };
    const data = await bybitRequest('POST', '/v5/asset/transfer/inter-transfer', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'convert-quote') {
    const fromCoin = stringValue(body.fromCoin, 'fromCoin', { upper: true, max: 20 });
    const payload = {
      accountType: stringValue(body.accountType || 'eb_convert_uta', 'accountType', { max: 30 }),
      fromCoin,
      toCoin: stringValue(body.toCoin, 'toCoin', { upper: true, max: 20 }),
      requestCoin: fromCoin,
      requestAmount: decimal(body.requestAmount, 'requestAmount'),
      requestId: crypto.randomUUID(),
    };
    const data = await bybitRequest('POST', '/v5/asset/exchange/quote-apply', payload);
    return send(res, 200, { ok: true, data: data.result });
  }

  if (action === 'convert-confirm') {
    if (body.confirm !== 'CONVERT') {
      fail(400, 'CONFIRMATION_REQUIRED', 'convert-confirm requires confirm=CONVERT');
    }
    const data = await bybitRequest('POST', '/v5/asset/exchange/convert-execute', {
      quoteTxId: stringValue(body.quoteTxId, 'quoteTxId', { max: 120 }),
    });
    return send(res, 200, { ok: true, data: data.result });
  }

  fail(404, 'UNKNOWN_ACTION', 'Unknown Bybit action');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    if (error instanceof BybitError) {
      return send(res, error.status || 502, {
        ok: false,
        error: 'BYBIT_ERROR',
        retCode: error.retCode,
        message: error.message,
      });
    }
    return send(res, error.httpStatus || 500, {
      ok: false,
      error: error.code || 'INTERNAL_ERROR',
      message: error.httpStatus ? error.message : 'Internal server error',
      ...(error.extra || {}),
    });
  }
}
