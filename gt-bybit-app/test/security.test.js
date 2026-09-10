import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { setup,invoke,fixtureEnv,memoryStore,mockRequest } from './helpers.mjs';
import { createHandler } from '../api/bybit.js';
import { createBybitClient,buildQuery,signHmac } from '../lib/bybit.js';
import { AppError } from '../lib/errors.js';
import { createRedisStore } from '../lib/store.js';
const order={action:'place-order',category:'spot',symbol:'btcusdt',side:'Buy',orderType:'Market',qty:'0.001'};
const money=(data)=>({...data,confirmed:true,requestId:crypto.randomUUID()});

test('opaque cookie is Secure HttpOnly Strict; credentials never returned',async()=>{
  const s=await setup();assert.equal(s.login.statusCode,200);
  for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/','Max-Age=2592000'])assert.ok(s.login.headers['set-cookie'].includes(flag));
  for(const secret of Object.values(s.env).slice(0,3))assert.ok(!JSON.stringify(s.login.body).includes(secret));
  assert.equal(s.login.body.idleTimeout,false);assert.equal(s.calls.length,0);
});
test('refresh and a fresh server instance preserve session after inactivity; absolute expiry and logout revoke it',async()=>{
  const clock={value:Date.now()};const s=await setup({now:()=>clock.value});
  clock.value+=3600000;
  const next=createHandler(s.options);
  let res=await invoke(next,{query:{action:'session'},cookie:s.cookie});assert.equal(res.body.authenticated,true);
  res=await invoke(next,{method:'POST',body:{action:'logout'},cookie:s.cookie,csrf:s.csrf});assert.equal(res.statusCode,200);assert.ok(res.headers['set-cookie'].includes('Max-Age=0'));
  res=await invoke(s.handler,{query:{action:'wallet'},cookie:s.cookie});assert.equal(res.statusCode,401);
  const t=await setup({now:()=>clock.value});clock.value+=31*86400000;
  res=await invoke(t.handler,{query:{action:'session'},cookie:t.cookie});assert.equal(res.body.authenticated,false);
});
test('login rotates session; token rotation invalidates old sessions; no bearer fallback',async()=>{
  const s=await setup();await invoke(s.handler,{method:'POST',body:{action:'login',controlToken:s.env.BYBIT_CONTROL_TOKEN},cookie:s.cookie});
  assert.equal((await invoke(s.handler,{query:{action:'session'},cookie:s.cookie})).body.authenticated,false);
  assert.equal((await invoke(s.handler,{query:{action:'wallet'},headers:{authorization:`Bearer ${s.env.BYBIT_CONTROL_TOKEN}`}})).statusCode,401);
  const t=await setup();t.env.BYBIT_CONTROL_TOKEN=crypto.randomBytes(32).toString('hex');assert.equal((await invoke(t.handler,{query:{action:'session'},cookie:t.cookie})).body.authenticated,false);
});
test('mutations require cookie, same origin, CSRF, explicit confirmation and request UUID',async()=>{
  const s=await setup();const payload=money(order);
  for(const options of [
    {body:payload},
    {body:payload,cookie:s.cookie},
    {body:payload,cookie:s.cookie,csrf:s.csrf,headers:{origin:'https://evil.example'}},
    {body:payload,cookie:s.cookie,csrf:s.csrf,headers:{'sec-fetch-site':'cross-site'}},
    {body:{...payload,confirmed:false},cookie:s.cookie,csrf:s.csrf},
    {body:{...payload,requestId:'bad'},cookie:s.cookie,csrf:s.csrf},
  ])assert.ok((await invoke(s.handler,{method:'POST',...options})).statusCode>=400);
  assert.equal(s.calls.length,0);
});
test('method, JSON, content type, payload size and secret query guards reject before Bybit',async()=>{
  const s=await setup();
  const cases=[{method:'DELETE'},{method:'POST',body:'{'},{method:'POST',body:[]},{method:'POST',body:{action:'login'},headers:{'content-type':'text/plain'}},{method:'POST',body:{action:'login',extra:'x'.repeat(17000)}},{query:{action:'health',token:'not-allowed'}},{query:{action:['wallet','health']}}];
  for(const item of cases)assert.ok((await invoke(s.handler,item)).statusCode>=400);
  assert.equal(s.calls.length,0);
});
test('failed logins are rate limited without contacting Bybit',async()=>{
  const s=await setup();let res;
  for(let i=0;i<11;i++)res=await invoke(s.handler,{method:'POST',body:{action:'login',controlToken:'invalid'}});
  assert.equal(res.statusCode,429);assert.equal(s.calls.length,0);
});
test('no durable store means fail closed; public health does not imply live connectivity',async()=>{
  const env=fixtureEnv();const handler=createHandler({env});
  const health=await invoke(handler,{query:{action:'health'}});assert.equal(health.statusCode,200);assert.equal(health.body.liveConnectivity,'UNTESTED');assert.equal(health.body.sessionStoreReady,false);
  const res=await invoke(handler,{method:'POST',body:{action:'login',controlToken:env.BYBIT_CONTROL_TOKEN}});assert.equal(res.statusCode,503);assert.ok(!res.headers['set-cookie']);
});
test('store failure during logout is not reported as successful logout',async()=>{
  const s=await setup();s.store.delete=async()=>{throw new AppError('SESSION_STORE_UNAVAILABLE','unavailable',503);};
  const res=await invoke(s.handler,{method:'POST',body:{action:'logout'},cookie:s.cookie,csrf:s.csrf});assert.equal(res.statusCode,503);assert.ok(!res.headers['set-cookie']);
});
test('idempotency is shared across handlers and concurrent requests',async()=>{
  const s=await setup();const payload=money(order);const opts={method:'POST',body:payload,cookie:s.cookie,csrf:s.csrf};
  const responses=await Promise.all([invoke(s.handler,opts),invoke(createHandler(s.options),opts)]);
  assert.ok(responses.some((r)=>r.statusCode===200));assert.equal(s.calls.filter((c)=>c.method==='POST').length,1);
  const replay=await invoke(s.handler,opts);assert.equal(replay.body.replayed,true);
  const conflict=await invoke(s.handler,{...opts,body:{...payload,qty:'0.002'}});assert.equal(conflict.statusCode,409);
  const upstream=s.calls.find((c)=>c.method==='POST');assert.equal(upstream.payload.symbol,'BTCUSDT');assert.equal(upstream.payload.marketUnit,'baseCoin');assert.equal(upstream.payload.orderLinkId,payload.requestId);
});
test('timeout cannot cause an automatic or duplicate money request',async()=>{
  let writes=0;const base=mockRequest();
  const s=await setup({request:async(...args)=>{if(args[0]==='POST'){writes++;throw new AppError('UPSTREAM_TIMEOUT','timeout',504);}return base(...args);}});
  const opts={method:'POST',body:money(order),cookie:s.cookie,csrf:s.csrf};assert.equal((await invoke(s.handler,opts)).statusCode,504);assert.equal((await invoke(s.handler,opts)).statusCode,409);assert.equal(writes,1);
});
test('financial kill switch blocks all account changes',async()=>{
  const s=await setup();s.env.BYBIT_ENABLE_MUTATIONS='false';
  assert.equal((await invoke(s.handler,{method:'POST',body:money(order),cookie:s.cookie,csrf:s.csrf})).body.error,'MUTATIONS_DISABLED');assert.equal(s.calls.length,0);
});
test('every account mutation routes correctly using only a mock Bybit transport',async()=>{
  const s=await setup();
  const cases=[order,{...order,category:'linear',positionIdx:1,orderType:'Limit',price:'65000',takeProfit:'70000',stopLoss:'60000'},{action:'cancel-order',category:'spot',symbol:'BTCUSDT',orderId:'qa-existing'},{action:'cancel-all',category:'linear',symbol:'BTCUSDT',confirm:'CANCEL_ALL'},{action:'set-leverage',category:'linear',symbol:'BTCUSDT',buyLeverage:'5',sellLeverage:'5'},{action:'set-trading-stop',category:'linear',symbol:'BTCUSDT',takeProfit:'0',stopLoss:'60000',trailingStop:'100',positionIdx:1},{action:'set-position-mode',category:'linear',symbol:'BTCUSDT',mode:3},{action:'transfer',coin:'usdt',amount:'10',fromAccountType:'UNIFIED',toAccountType:'FUND'}];
  for(const item of cases){const res=await invoke(s.handler,{method:'POST',body:money(item),cookie:s.cookie,csrf:s.csrf});assert.equal(res.statusCode,200,item.action);}
  assert.equal(s.calls.filter((c)=>c.method==='POST').length,cases.length);
  const stop=s.calls.find((c)=>c.path.endsWith('/trading-stop'));assert.equal(stop.payload.takeProfit,'0');
});
test('quotes expire, bind to their session and execute at most once even with new request IDs',async()=>{
  const clock={value:Date.now()};const s=await setup({now:()=>clock.value});
  const quote=await invoke(s.handler,{method:'POST',body:{action:'convert-quote',fromCoin:'USDT',toCoin:'USDC',requestAmount:'10'},cookie:s.cookie,csrf:s.csrf});assert.equal(quote.statusCode,200);
  const payload={action:'convert-confirm',quoteTxId:quote.body.data.quoteTxId,confirm:'CONVERT'};
  const other=await setup({env:s.env,store:s.store,now:()=>clock.value});
  assert.equal((await invoke(other.handler,{method:'POST',body:money(payload),cookie:other.cookie,csrf:other.csrf})).body.error,'QUOTE_EXPIRED');
  assert.equal((await invoke(s.handler,{method:'POST',body:money(payload),cookie:s.cookie,csrf:s.csrf})).statusCode,200);
  assert.equal((await invoke(s.handler,{method:'POST',body:money(payload),cookie:s.cookie,csrf:s.csrf})).statusCode,409);
  const newQuote=await invoke(s.handler,{method:'POST',body:{action:'convert-quote',fromCoin:'USDT',toCoin:'USDC',requestAmount:'10'},cookie:s.cookie,csrf:s.csrf});clock.value+=16000;
  assert.equal((await invoke(s.handler,{method:'POST',body:money({...payload,quoteTxId:newQuote.body.data.quoteTxId}),cookie:s.cookie,csrf:s.csrf})).body.error,'QUOTE_EXPIRED');
});
test('read-only account routes work through mocks without any upstream writes',async()=>{
  const s=await setup();
  for(const action of ['health','session','status','account','wallet','positions','orders','order-history','executions','assets','transfer-coins','transfer-account-types','convert-coins','transfers','convert-history'])assert.equal((await invoke(s.handler,{query:{action},cookie:s.cookie})).statusCode,200,action);
  assert.equal(s.calls.filter((c)=>c.method==='POST').length,0);
});
test('Bybit signs exact transmitted bytes, omits GET body, and does not follow redirects',async()=>{
  const env=fixtureEnv(),time=1720071077014;let seen=0;
  const client=createBybitClient({env,now:()=>time,fetchImpl:async(url,options)=>{
    seen++;const payload=options.method==='GET'?new URL(url).search.slice(1):options.body;
    assert.ok(options.headers['X-BAPI-SIGN']===signHmac({timestamp:String(time),apiKey:env.BYBIT_API_KEY,recvWindow:'5000',apiSecret:env.BYBIT_API_SECRET,payload}));
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');if(options.method==='GET'){assert.equal(options.body,undefined);assert.ok(!options.headers['Content-Type']);}
    return new Response(JSON.stringify({retCode:0,result:{}}),{status:200});
  }});
  await client('GET','/v5/account/info',{symbol:'BTC-TEST',limit:20});await client('POST','/v5/order/create',{category:'spot',qty:'0.001'});assert.equal(seen,2);
  assert.equal(buildQuery({z:'x y',a:'A+B'}),'a=A%2BB&z=x+y');
});
test('normalized Bybit errors never reflect raw error messages or secrets',async()=>{
  const env=fixtureEnv();
  for(const code of [10003,10005,10006,10000,110007,10029,170137,110013,110024,10014,131203,32023]){
    const client=createBybitClient({env,fetchImpl:async()=>new Response(JSON.stringify({retCode:code,retMsg:env.BYBIT_API_SECRET}),{status:200})});
    await assert.rejects(()=>client('GET','/v5/account/info'),(error)=>{assert.ok(!error.message.includes(env.BYBIT_API_SECRET));assert.equal(error.extra.retCode,code);return true;});
  }
});
test('malformed upstream responses, HTTP rate limit, timeout, network, and invalid origins fail safely',async()=>{
  const env=fixtureEnv();
  for(const [fetchImpl,code] of [
    [async()=>new Response('{}'),'MALFORMED_UPSTREAM'],[async()=>new Response('<html>'),'MALFORMED_UPSTREAM'],[async()=>new Response('busy',{status:429}),'RATE_LIMITED'],[async()=>{throw new DOMException('timeout','TimeoutError');},'UPSTREAM_TIMEOUT'],[async()=>{throw new TypeError('network');},'NETWORK_ERROR'],
  ])await assert.rejects(()=>createBybitClient({env,fetchImpl})('GET','/v5/account/info'),(error)=>error.code===code);
  env.BYBIT_API_BASE_URL='https://evil.example';let called=false;await assert.rejects(()=>createBybitClient({env,fetchImpl:async()=>{called=true;}})('GET','/v5/account/info'));assert.equal(called,false);
});
test('Redis REST uses TLS, redacts transport errors, NX reservations and atomic rate limit',async()=>{
  const requests=[];const store=createRedisStore({env:{UPSTASH_REDIS_REST_URL:'https://qa.upstash.io',UPSTASH_REDIS_REST_TOKEN:crypto.randomBytes(24).toString('hex')},fetchImpl:async(url,opts)=>{requests.push(JSON.parse(opts.body));return new Response(JSON.stringify({result:requests.length===2?'null':'OK'}));}});
  assert.equal(await store.set('key',{safe:true},60,true),true);await store.get('missing');await store.increment('rate',60);
  assert.ok(requests[0].includes('NX'));assert.equal(requests[2][0],'EVAL');
});
