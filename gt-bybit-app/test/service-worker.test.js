import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../gt-bybit/sw.js',import.meta.url),'utf8');
function worker(){
  const handlers={},deleted=[],puts=[];let fetched=0,claimed=false;
  const cache={put:async(...args)=>puts.push(args),match:async()=>undefined};
  const context={URL,Request,Response,Set,console,fetch:async()=>{fetched++;return new Response('asset',{headers:{'Content-Type':'application/javascript'}});},caches:{open:async()=>cache,keys:async()=>['gt-bybit-shell-v3','gt-bybit-shell-20260908-2','gt-bybit-shell-20260910-3','gt-bybit-shell-20260910-4','gt-bybit-shell-20260910-5','gt-bybit-shell-20260910-6','other-app'],delete:async(key)=>deleted.push(key),match:async()=>undefined},self:{location:{origin:'https://bybit.garhy.tech'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}}};
  vm.runInNewContext(source,context);
  return {handlers,deleted,puts,get fetched(){return fetched;},get claimed(){return claimed;}};
}
test('service worker ignores every API, money, cross-origin, authorization and unknown query request',()=>{
  const w=worker();
  for(const [url,method,headers] of [
    ['https://bybit.garhy.tech/api/bybit?action=wallet','GET',{}],['https://bybit.garhy.tech/api/bybit','POST',{}],['https://bybit.garhy.tech/api','GET',{}],['https://evil.example/gt-bybit/app.js','GET',{}],['https://bybit.garhy.tech/gt-bybit/app.js','GET',{Authorization:'Bearer qa'}],['https://bybit.garhy.tech/gt-bybit/app.js?token=qa','GET',{}],['https://bybit.garhy.tech/private/account','GET',{}],
  ]){let intercepted=false;w.handlers.fetch({request:new Request(url,{method,headers}),respondWith(){intercepted=true;}});assert.equal(intercepted,false);}
  assert.equal(w.fetched,0);assert.equal(w.puts.length,0);
});
test('service worker purges only old GT.BYBIT caches and claims clients',async()=>{
  const w=worker();let pending;w.handlers.activate({waitUntil(promise){pending=promise;}});await pending;assert.deepEqual(w.deleted,['gt-bybit-shell-v3','gt-bybit-shell-20260908-2','gt-bybit-shell-20260910-3','gt-bybit-shell-20260910-4','gt-bybit-shell-20260910-5','gt-bybit-shell-20260910-6']);assert.equal(w.claimed,true);
});
