import { AppError, assert, publicError } from '../lib/errors.js';
import { createBybitClient, getBybitConfig } from '../lib/bybit.js';
import { createSessionService, hash, isControlConfigured, sessionLifetime, verifyOrigin } from '../lib/bybit-control.js';
import { createRedisStore, storeConfigured } from '../lib/store.js';
import { validateAction, ValidationError, symbol, coin, text, enumValue, categories, accountTypes, convertAccountTypes, financialActions } from '../gt-bybit/validation.js';

const MAX_BODY = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POST_PATHS = {
  'place-order':'/v5/order/create', 'cancel-order':'/v5/order/cancel', 'cancel-all':'/v5/order/cancel-all',
  'set-leverage':'/v5/position/set-leverage', 'set-trading-stop':'/v5/position/trading-stop',
  'set-position-mode':'/v5/position/switch-mode', transfer:'/v5/asset/transfer/inter-transfer',
  'convert-quote':'/v5/asset/exchange/quote-apply', 'convert-confirm':'/v5/asset/exchange/convert-execute',
};

export function send(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Cookie, Origin');
  if (status === 429) res.setHeader('Retry-After', '60');
  return res.status(status).json(payload);
}

function readBody(req) {
  assert(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''), 'UNSUPPORTED_MEDIA_TYPE', 'أرسل البيانات بصيغة JSON.', 415);
  assert(Number(req.headers['content-length'] || 0) <= MAX_BODY, 'PAYLOAD_TOO_LARGE', 'حجم الطلب أكبر من المسموح.', 413);
  let body = req.body;
  assert(Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body || {})) <= MAX_BODY, 'PAYLOAD_TOO_LARGE', 'حجم الطلب أكبر من المسموح.', 413);
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { throw new AppError('INVALID_JSON', 'صيغة JSON غير صالحة.'); }
  }
  assert(body && typeof body === 'object' && !Array.isArray(body) && Object.getPrototypeOf(body) === Object.prototype, 'INVALID_JSON', 'بيانات الطلب غير صالحة.');
  return body;
}
function limit(value, max = 50) {
  const result = Number(value || max);
  assert(Number.isInteger(result) && result >= 1 && result <= max, 'INVALID_INPUT', 'حد النتائج غير صالح.');
  return result;
}
function withoutMeta(data) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !['action','confirm'].includes(key)));
}
function compareDecimal(left, right) {
  const parts = (value) => String(value).split('.');
  const a = parts(left), b = parts(right), size = Math.max(a[1]?.length || 0,b[1]?.length || 0);
  const n = (x) => BigInt(x[0] + (x[1] || '').padEnd(size,'0'));
  return [n(a),n(b)];
}
function withinStep(value, step) {
  if (!step || Number(step) === 0) return true;
  const [a,b] = compareDecimal(value,step); return a % b === 0n;
}
async function checkInstrument(request, action, data) {
  if (!['place-order','set-leverage'].includes(action)) return;
  const result = await request('GET','/v5/market/instruments-info',{category:data.category,symbol:data.symbol});
  const instrument = result.result.list?.find((item) => item.symbol === data.symbol);
  assert(instrument && instrument.status === 'Trading', 'INVALID_SYMBOL', 'السوق غير موجود أو غير متاح للتداول.');
  if (action === 'set-leverage') {
    const filter = instrument.leverageFilter;
    assert(filter, 'INVALID_LEVERAGE', 'لم تتوفر حدود الرافعة لهذا السوق.');
    for (const key of ['buyLeverage','sellLeverage']) assert(Number(data[key]) >= Number(filter.minLeverage) && Number(data[key]) <= Number(filter.maxLeverage) && withinStep(data[key],filter.leverageStep), 'INVALID_LEVERAGE', 'الرافعة لا تطابق حدود السوق.');
    return;
  }
  const lot = instrument.lotSizeFilter || {};
  const max = data.orderType === 'Market' ? (lot.maxMarketOrderQty || lot.maxMktOrderQty || lot.maxOrderQty) : (lot.maxLimitOrderQty || lot.maxOrderQty);
  assert((!lot.minOrderQty || Number(data.qty) >= Number(lot.minOrderQty)) && (!max || Number(data.qty) <= Number(max)) && withinStep(data.qty, lot.qtyStep || lot.basePrecision), 'INVALID_QUANTITY', 'الكمية لا تطابق حدود السوق أو دقتها.');
  if (data.price) assert(withinStep(data.price,instrument.priceFilter?.tickSize) && (!instrument.priceFilter?.minPrice || Number(data.price) >= Number(instrument.priceFilter.minPrice)) && (!instrument.priceFilter?.maxPrice || Number(data.price) <= Number(instrument.priceFilter.maxPrice)), 'INVALID_PRICE', 'السعر لا يطابق حدود السوق أو دقته.');
}

export function createHandler({ env = process.env, store = createRedisStore({env}), request = createBybitClient({env}), now = Date.now, storageReady = () => storeConfigured(env) } = {}) {
  const sessions = createSessionService({store,env,now});
  async function get(req, res) {
    const q = req.query || {};
    for (const value of Object.values(q)) assert(typeof value === 'string', 'INVALID_INPUT', 'معاملات الطلب غير صالحة.');
    assert(!Object.keys(q).some((key) => /token|secret|api.?key|authorization/i.test(key)), 'INVALID_INPUT', 'لا ترسل بيانات اعتماد ضمن عنوان الطلب.');
    const action = q.action || 'health';
    if (action === 'health') {
      let bybitConfigured = false;
      try { getBybitConfig(env); bybitConfigured = true; } catch { /* report only readiness */ }
      return send(res,200,{ok:true,service:'gt-bybit-v5',version:'2.0.0',region:env.VERCEL_REGION || 'local',controlReady:isControlConfigured(env) && storageReady(),bybitConfigured,sessionStoreReady:storageReady(),liveConnectivity:'UNTESTED',mutationsEnabled:env.BYBIT_ENABLE_MUTATIONS === 'true',absoluteLifetimeDays:sessionLifetime(env)/86400,idleTimeout:false});
    }
    assert(!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin', 'ORIGIN_DENIED', 'مصدر الطلب غير مصرح به.', 403);
    const session = await sessions.authenticate(req,action !== 'session');
    if (action === 'session') return send(res,200,session ? {ok:true,authenticated:true,csrfToken:session.csrf,expiresAt:session.expiresAt,absoluteLifetimeDays:sessionLifetime(env)/86400,idleTimeout:false} : {ok:true,authenticated:false});
    await sessions.rateLimit(`read:${session.owner}`,120);
    let path, params = {};
    if (action === 'account' || action === 'status') path = '/v5/account/info';
    else if (action === 'wallet') { path='/v5/account/wallet-balance'; params.accountType=enumValue(q.accountType || 'UNIFIED',['UNIFIED','CONTRACT','SPOT'],'الحساب'); if(q.coin) params.coin=coin(q.coin); }
    else if (['positions','orders','order-history','executions'].includes(action)) {
      params.category=enumValue(q.category || (action === 'positions' ? 'linear' : 'spot'),action === 'positions' ? ['linear','inverse'] : categories,'السوق');
      params.limit=limit(q.limit);
      if(q.symbol) params.symbol=symbol(q.symbol);
      else if (params.category === 'linear' && ['positions','orders'].includes(action)) params.settleCoin=coin(q.settleCoin || 'USDT');
      if(q.cursor) params.cursor=text(q.cursor,'cursor',512);
      path={'positions':'/v5/position/list',orders:'/v5/order/realtime','order-history':'/v5/order/history',executions:'/v5/execution/list'}[action];
      if(action === 'orders') params.openOnly=0;
    } else if(action === 'assets') {
      path='/v5/asset/transfer/query-account-coins-balance'; params.accountType=enumValue(q.accountType || 'FUND',accountTypes,'الحساب');
      if(q.coin) params.coin=coin(q.coin);
    } else if(action === 'transfer-coins') {
      path='/v5/asset/transfer/query-transfer-coin-list';
      params.fromAccountType=enumValue(q.fromAccountType || 'UNIFIED',accountTypes,'الحساب'); params.toAccountType=enumValue(q.toAccountType || 'FUND',accountTypes,'الحساب');
      assert(params.fromAccountType !== params.toAccountType,'INVALID_INPUT','اختر حسابين مختلفين.');
    } else if(action === 'transfer-account-types') return send(res,200,{ok:true,data:{accountTypes}});
    else if(action === 'convert-coins') { path='/v5/asset/exchange/query-coin-list'; params.accountType=enumValue(q.accountType || 'eb_convert_uta',convertAccountTypes,'الحساب'); }
    else if(action === 'transfers') { path='/v5/asset/transfer/query-inter-transfer-list'; params.limit=limit(q.limit); if(q.coin) params.coin=coin(q.coin); if(q.cursor) params.cursor=text(q.cursor,'cursor',512); }
    else if(action === 'convert-history') { path='/v5/asset/exchange/query-convert-history'; params.limit=limit(q.limit); params.index=limit(q.index || 1,100000); }
    else if(action === 'convert-status') { path='/v5/asset/exchange/convert-result-query'; params.quoteTxId=text(q.quoteTxId,'quoteTxId',120); }
    else throw new AppError('UNKNOWN_ACTION','العملية غير مدعومة.',404);
    const result = await request('GET',path,params);
    return send(res,200,{ok:true,data:result.result,hasMore:Boolean(result.result.nextPageCursor)});
  }
  async function post(req,res) {
    const body=readBody(req);
    verifyOrigin(req,env);
    if(body.action === 'login') return send(res,200,{ok:true,...await sessions.login(req,res,body.controlToken)});
    const session=await sessions.authenticate(req);
    sessions.verifyCsrf(req,session);
    if(body.action === 'logout') { await sessions.logout(req,res,session); return send(res,200,{ok:true,authenticated:false}); }
    await sessions.rateLimit(`post:${session.owner}`,30);
    const data=validateAction(body);
    const payload=withoutMeta(data);
    const action=data.action;
    if(action === 'convert-quote') {
      const result=await request('POST',POST_PATHS[action],{...payload,requestCoin:data.fromCoin});
      const quote=result.result;
      const expiresAt=Math.min(Number(quote.expiredTime),now()+15000);
      assert(typeof quote.quoteTxId === 'string' && Number.isFinite(expiresAt) && expiresAt>now(), 'QUOTE_EXPIRED','انتهى عرض التحويل أو لم يتضمن مدة صلاحية واضحة.',409);
      const key=`${session.namespace}:quote:${session.owner}:${hash(quote.quoteTxId)}`;
      await store.set(key,{quote,expiresAt},Math.ceil((expiresAt-now())/1000));
      return send(res,200,{ok:true,data:{...quote,expiredTime:String(expiresAt)}});
    }
    assert(financialActions.includes(action),'UNKNOWN_ACTION','العملية غير مدعومة.',404);
    assert(env.BYBIT_ENABLE_MUTATIONS === 'true','MUTATIONS_DISABLED','تنفيذ العمليات المالية معطّل في إعدادات الخادم.',403);
    assert(body.confirmed === true,'CONFIRMATION_REQUIRED','يجب مراجعة تفاصيل العملية وتأكيدها صراحةً.');
    assert(typeof body.requestId === 'string' && UUID.test(body.requestId),'INVALID_REQUEST_ID','معرّف العملية غير صالح.');
    const key=`${session.namespace}:operation:${body.requestId}`;
    const fingerprint=hash(JSON.stringify(data));
    const reserved=await store.set(key,{fingerprint,owner:session.owner,state:'pending'},172800,true);
    if(!reserved) {
      const old=await store.get(key);
      assert(old?.owner === session.owner && old.fingerprint === fingerprint,'IDEMPOTENCY_CONFLICT','معرّف العملية مستخدم لطلب آخر.',409);
      if(old.state === 'accepted') return send(res,200,{ok:true,data:old.result,requestId:body.requestId,replayed:true,accepted:true});
      throw new AppError('DUPLICATE_REQUEST','الطلب سبق إرساله أو حالته غير مؤكدة. راجع سجل الحساب قبل إنشاء عملية جديدة.',409);
    }
    try {
      await checkInstrument(request,action,data);
      if(action === 'place-order') payload.orderLinkId=body.requestId;
      if(action === 'transfer') payload.transferId=body.requestId;
      if(action === 'convert-confirm') {
        const quoteKey=`${session.namespace}:quote:${session.owner}:${hash(data.quoteTxId)}`;
        const stored=await store.get(quoteKey);
        assert(stored && stored.expiresAt>now()+500,'QUOTE_EXPIRED','انتهى عرض التحويل. اطلب عرضًا جديدًا.',409);
        assert(await store.set(`${quoteKey}:used`,true,172800,true),'DUPLICATE_REQUEST','تم استخدام عرض التحويل بالفعل.',409);
      }
      // Recheck durable authorization immediately before an account-changing request.
      await sessions.authenticate(req);
      const result=await request('POST',POST_PATHS[action],payload);
      await store.set(key,{fingerprint,owner:session.owner,state:'accepted',result:result.result},172800);
      return send(res,200,{ok:true,data:result.result,requestId:body.requestId,accepted:true});
    } catch(error) {
      // Preserve reservation after any error, including timeouts: never retry a money action.
      throw error;
    }
  }
  return async function handler(req,res) {
    try {
      if(req.method === 'GET') return await get(req,res);
      if(req.method === 'POST') return await post(req,res);
      res.setHeader('Allow','GET, POST');
      return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED',message:'طريقة الطلب غير مسموحة.'});
    } catch(error) {
      if(error instanceof ValidationError) error=new AppError(error.code,error.message,400);
      return send(res,error instanceof AppError ? error.status : 500,publicError(error));
    }
  };
}
export default createHandler();
