const CACHE='gt-bybit-shell-20260910-4';
const VERSION='20260910-4';
const STATIC=[
  '/gt-bybit/index.html',
  `/gt-bybit/app.css?v=${VERSION}`,
  `/gt-bybit/app.js?v=${VERSION}`,
  `/gt-bybit/validation.js?v=${VERSION}`,
  '/gt-bybit/manifest.webmanifest',
  '/assets/gt-bybit/icon-180.png','/assets/gt-bybit/icon-192.png','/assets/gt-bybit/icon-512.png','/assets/gt-bybit/gt-profile.jpg',
];
const ALLOWED=new Set(STATIC.map((path)=>new URL(path,self.location.origin).pathname));
self.addEventListener('install',(event)=>{
  event.waitUntil(caches.open(CACHE).then(async(cache)=>{
    for(const path of STATIC){
      const request=new Request(path,{cache:'reload',credentials:'omit'});
      const response=await fetch(request);
      if(!response.ok)throw new Error('Shell asset unavailable');
      await cache.put(path,response);
    }
    await self.skipWaiting();
  }));
});
self.addEventListener('activate',(event)=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('gt-bybit-shell-') && key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',(event)=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET' || url.origin!==self.location.origin || /^\/api(?:\/|$)/.test(url.pathname) || request.headers.has('Authorization'))return;
  // Only the known public shell can enter CacheStorage. Never cache arbitrary paths or queries.
  const navigation=request.mode==='navigate' && ['/', '/gt-bybit/', '/gt-bybit/index.html'].includes(url.pathname);
  if(navigation){
    if([...url.searchParams.keys()].some((key)=>!['view','source'].includes(key)))return;
    event.respondWith(fetch(request,{cache:'no-store'}).catch(async()=>await caches.match('/gt-bybit/index.html',{cacheName:CACHE}) || Response.error()));
    return;
  }
  if(!ALLOWED.has(url.pathname) || [...url.searchParams.keys()].some((key)=>key!=='v'))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request,{cache:'no-cache'});
      const type=response.headers.get('Content-Type') || '';
      const valid=(!url.pathname.endsWith('.js') || /javascript/.test(type)) && (!url.pathname.endsWith('.css') || /text\/css/.test(type));
      if(response.ok && valid)await cache.put(request,response.clone());
      return response;
    }catch{return await cache.match(request) || Response.error();}
  })());
});
