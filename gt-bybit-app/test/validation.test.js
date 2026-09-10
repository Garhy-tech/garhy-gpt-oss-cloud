import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {validateAction} from '../gt-bybit/validation.js';
import {setup,invoke} from './helpers.mjs';
const order={action:'place-order',category:'spot',symbol:'BTCUSDT',side:'Buy',orderType:'Market',qty:'0.001'};
test('malformed symbols, enums, decimals, leverage, account types and protection fail validation',()=>{
  const inputs=[
    {...order,symbol:'BTC/USDT'}, {...order,category:'futures'}, {...order,side:'buy'}, {...order,qty:'-1'}, {...order,qty:'0'}, {...order,qty:'1e5'}, {...order,qty:'Infinity'}, {...order,qty:{}}, {...order,orderType:'Limit'}, {...order,category:'linear',reduceOnly:'false'}, {...order,category:'linear',reduceOnly:true,takeProfit:'70000'}, {...order,marketUnit:'quoteCoin'}, {...order,hiddenAction:'withdraw'},
    {action:'transfer',coin:'US DT',amount:'1',fromAccountType:'UNIFIED',toAccountType:'FUND'}, {action:'transfer',coin:'USDT',amount:'1',fromAccountType:'FUND',toAccountType:'FUND'}, {action:'transfer',coin:'USDT',amount:'0',fromAccountType:'UNIFIED',toAccountType:'FUND'},
    {action:'set-leverage',category:'linear',symbol:'BTCUSDT',buyLeverage:'0',sellLeverage:'5'}, {action:'set-leverage',category:'linear',symbol:'BTCUSDT',buyLeverage:'1001',sellLeverage:'5'},
    {action:'set-trading-stop',category:'linear',symbol:'BTCUSDT'}, {action:'set-trading-stop',category:'linear',symbol:'BTCUSDT',trailingStop:'-1'}, {action:'set-position-mode',category:'spot',symbol:'BTCUSDT',mode:3},
    {action:'cancel-all',category:'spot',confirm:'cancel_all'}, {action:'cancel-all',category:'linear',confirm:'CANCEL_ALL'}, {action:'convert-quote',fromCoin:'USDT',toCoin:'USDT',requestAmount:'1'}, {action:'convert-confirm',quoteTxId:'id'},
  ];
  for(const input of inputs)assert.throws(()=>validateAction(input),undefined,input.action);
});
test('instrument filters reject quantity, price and leverage without an upstream write',async()=>{
  const s=await setup();
  for(const data of [{...order,qty:'0.0001'},{...order,orderType:'Limit',price:'60000.01'},{action:'set-leverage',category:'linear',symbol:'BTCUSDT',buyLeverage:'101',sellLeverage:'5'}]){
    const result=await invoke(s.handler,{method:'POST',body:{...data,confirmed:true,requestId:crypto.randomUUID()},cookie:s.cookie,csrf:s.csrf});assert.equal(result.statusCode,400);
  }
  assert.equal(s.calls.filter((call)=>call.method==='POST').length,0);
});
test('decimal normalization preserves precision and explicit removal of TP/SL',()=>{
  assert.equal(validateAction({...order,symbol:' btcusdt ',qty:'0001.230000'}).qty,'1.23');
  const result=validateAction({action:'set-trading-stop',category:'linear',symbol:'BTCUSDT',stopLoss:'0',trailingStop:'0'});assert.equal(result.stopLoss,'0');assert.equal(result.trailingStop,'0');
});
