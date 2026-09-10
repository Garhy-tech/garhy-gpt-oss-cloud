import crypto from 'node:crypto';
import { createHandler } from '../api/bybit.js';
export function memoryStore(now=Date.now) {
  const values=new Map();
  return {
    async get(key){const item=values.get(key);if(!item || item.expires<=now()){values.delete(key);return null;}return structuredClone(item.value);},
    async set(key,value,ttl,nx=false){const item=values.get(key);if(nx && item && item.expires>now())return false;values.set(key,{value:structuredClone(value),expires:now()+ttl*1000});return true;},
    async delete(key){values.delete(key);},
    async increment(key,ttl){const old=await this.get(key);const n=(old || 0)+1;await this.set(key,n,ttl);return n;},
  };
}
export function fixtureEnv() {return {BYBIT_CONTROL_TOKEN:crypto.randomBytes(32).toString('hex'),BYBIT_API_KEY:crypto.randomBytes(16).toString('hex'),BYBIT_API_SECRET:crypto.randomBytes(32).toString('hex'),BYBIT_ENABLE_MUTATIONS:'true',BYBIT_ALLOWED_ORIGINS:'https://bybit.garhy.tech'};}
export function mockRequest(calls=[],now=Date.now) {
  return async(method,path,payload)=>{
    calls.push({method,path,payload});
    let result={};
    if(path==='/v5/market/instruments-info')result={list:[{symbol:payload.symbol,status:'Trading',lotSizeFilter:{minOrderQty:'0.001',maxOrderQty:'100',qtyStep:'0.001'},priceFilter:{minPrice:'1',maxPrice:'1000000',tickSize:'0.1'},leverageFilter:{minLeverage:'1',maxLeverage:'100',leverageStep:'0.1'}}]};
    else if(path==='/v5/account/info')result={unifiedMarginStatus:5,marginMode:'REGULAR_MARGIN'};
    else if(path==='/v5/account/wallet-balance')result={list:[{accountType:'UNIFIED',totalEquity:'12345.67',totalWalletBalance:'12000.25',coin:[{coin:'USDT',walletBalance:'10000.125',usdValue:'10000.125',unrealisedPnl:'345.42'}]}]};
    else if(path==='/v5/position/list')result={list:[{symbol:'BTCUSDT',side:'Buy',size:'0.01',avgPrice:'65000',markPrice:'65500',leverage:'5',unrealisedPnl:'5',liqPrice:'52000'}]};
    else if(path==='/v5/order/realtime')result={list:[{symbol:'BTCUSDT',side:'Buy',orderType:'Limit',qty:'0.001',price:'60000',orderStatus:'New',orderId:'qa-order-001'}]};
    else if(path==='/v5/asset/transfer/query-transfer-coin-list')result={list:['USDT','BTC','ETH']};
    else if(path==='/v5/asset/exchange/quote-apply')result={quoteTxId:'qa-quote-'+crypto.randomUUID(),fromCoin:payload.fromCoin,toCoin:payload.toCoin,fromAmount:payload.requestAmount,toAmount:'9.99',exchangeRate:'0.999',expiredTime:String(now()+15000)};
    else if(method==='POST')result={orderId:'qa-order-accepted',transferId:payload.transferId,status:'SUCCESS'};
    else result={list:[]};
    return {retCode:0,result};
  };
}
export async function invoke(handler,{method='GET',query={},body,headers={},cookie,csrf}={}) {
  const req={method,query,body,headers:{...(body!==undefined?{'content-type':'application/json',origin:'https://bybit.garhy.tech'}:{}),...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...headers},socket:{remoteAddress:'test'}};
  const res={headers:{},setHeader(key,value){this.headers[key.toLowerCase()]=value;},status(status){this.statusCode=status;return this;},json(body){this.body=body;return this;}};
  await handler(req,res);return res;
}
export async function setup({env=fixtureEnv(),now=Date.now,request,store=memoryStore(now)}={}) {
  const calls=[];request ||= mockRequest(calls,now);
  const options={env,now,request,store,storageReady:()=>true};
  const handler=createHandler(options);
  const login=await invoke(handler,{method:'POST',body:{action:'login',controlToken:env.BYBIT_CONTROL_TOKEN}});
  const cookie=login.headers['set-cookie']?.split(';')[0],csrf=login.body.csrfToken;
  return {handler,env,store,options,calls,cookie,csrf,login};
}
