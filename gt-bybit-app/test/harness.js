const iframe=document.querySelector('#app'),results=document.querySelector('#results');
const report={responsive:[],functional:[],errors:[],realFinancialActions:0};
const pause=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
async function waitFor(check,message){for(let i=0;i<100;i++){if(check())return;await pause(100);}throw new Error(message);}
function check(condition,name){report.functional.push({name,pass:Boolean(condition)});if(!condition)throw new Error(name);}
function doc(){return iframe.contentDocument;}
function el(id){return doc().getElementById(id);}
function activePanels(){return [...doc().querySelectorAll('[data-view-panel]')].filter((p)=>p.getClientRects().length>0);}
async function login(){el('controlToken').value='QA_ONLY';el('connectBtn').click();await waitFor(()=>!el('secureApp').hidden,'Mock login failed');await waitFor(()=>el('mEquity').textContent.includes('12,345'),'Mock dashboard failed');}
async function reload(){iframe.contentWindow.location.reload();await waitFor(()=>el('secureApp') && !el('secureApp').hidden,'Refresh lost session');await waitFor(()=>el('mEquity').textContent.includes('12,345'),'Refresh lost dashboard');}
function measure(width,view,locked){
  const d=doc(),win=iframe.contentWindow;
  const overflow=d.documentElement.scrollWidth>win.innerWidth;
  const badControls=[...d.querySelectorAll('input,select,button')].filter((node)=>node.getClientRects().length && !node.closest('.table-wrap')).filter((node)=>{const b=node.getBoundingClientRect();return b.left < -1 || b.right > win.innerWidth+1 || b.width<1;}).map((node)=>node.id || node.name || node.textContent.trim().slice(0,30));
  const hugeIcons=[...d.querySelectorAll('svg')].filter((node)=>{const b=node.getBoundingClientRect();return b.width>32 || b.height>32;}).length;
  const brokenImages=[...d.images].filter((img)=>!img.complete || img.naturalWidth===0).length;
  const panels=activePanels().length;
  const pass=!overflow && badControls.length===0 && hugeIcons===0 && brokenImages===0 && panels===(locked?0:1);
  report.responsive.push({width,view,locked,pass,overflow,badControls,hugeIcons,brokenImages,visiblePanels:panels});
}
async function resize(width){iframe.width=String(width);await pause(80);}
async function nav(view){const candidates=[...doc().querySelectorAll(`[data-view="${view}"]`)];candidates.find((n)=>n.getClientRects().length)?.click();await pause(150);}
document.querySelector('#resize').onclick=()=>resize(document.querySelector('#width').value);
document.querySelector('#run').onclick=async()=>{
  document.querySelector('#run').disabled=true;
  try{
    await waitFor(()=>el('preAuthState') && el('preAuthState').textContent.includes('جاهز'),'App boot failed');
    if(!el('secureApp').hidden){el('lockSettingsBtn').click();await waitFor(()=>el('secureApp').hidden,'Initial logout failed');}
    for(const width of [320,360,390,430,768,1024,1440]){await resize(width);measure(width,'locked',true);}
    await login();check(!el('secureApp').hidden,'UI login with synthetic fixture');
    check(doc().documentElement.dir==='rtl','Arabic RTL');
    check(doc().styleSheets.length>0 && iframe.contentWindow.getComputedStyle(doc().body).backgroundColor!=='rgb(255, 255, 255)','Styles loaded');
    await reload();check(!el('secureApp').hidden,'Refresh preserves secure session');
    for(const width of [320,360,390,430,768,1024,1440]){await resize(width);for(const view of ['overview','trade','risk','assets','settings']){await nav(view);measure(width,view,false);}}
    await resize(390);await nav('trade');
    const form=el('orderForm');form.elements.symbol.value='BTCUSDT';form.elements.qty.value='0.001';
    const before=await fetch('/__qa/counters').then((r)=>r.json());
    form.requestSubmit();await waitFor(()=>el('confirmDialog').open,'Confirmation missing');
    check(el('confirmationSummary').textContent.includes('BTCUSDT') && el('confirmationSummary').textContent.includes('0.001'),'Order confirmation includes symbol and quantity');
    check((await fetch('/__qa/counters').then((r)=>r.json())).mockWrites===before.mockWrites,'Opening confirmation sends no order');
    el('confirmCancel').click();await pause(50);
    check(!el('confirmDialog').open,'Confirmation cancellation works');
    await nav('risk');const cancel=el('cancelAllForm');cancel.elements.confirm.value='CANCEL_ALL';cancel.requestSubmit();await waitFor(()=>el('confirmDialog').open,'Cancel-all confirmation missing');
    el('confirmAccept').click();check(el('confirmDialog').open,'Cancel-all requires typed confirmation in dialog');el('confirmCancel').click();await pause(50);
    Object.defineProperty(iframe.contentWindow.navigator,'onLine',{configurable:true,get:()=>false});iframe.contentWindow.dispatchEvent(new Event('offline'));
    check(!el('offlineBanner').hidden && [...doc().querySelectorAll('#secureApp form button')].every((button)=>button.disabled),'Offline disables account actions');
    Object.defineProperty(iframe.contentWindow.navigator,'onLine',{configurable:true,get:()=>true});iframe.contentWindow.dispatchEvent(new Event('online'));await pause(100);
    check((await fetch('/__qa/counters').then((r)=>r.json())).mockWrites===before.mockWrites,'Navigation, cancellation and reconnect send no mutation');
    await nav('settings');el('installSettingsBtn').click();await pause(50);check(el('toast').textContent.includes('قائمة'),'Install guidance appears');
    check(doc().querySelector('#controlToken').value==='','Control input is cleared');
    check(!doc().cookie.includes('__Host-gt_bybit_sid'),'Session cookie cannot be read by JavaScript');
    const sw=await iframe.contentWindow.navigator.serviceWorker.ready;check(new URL(sw.scope).pathname==='/','Service worker has root scope');
    const cacheNames=await iframe.contentWindow.caches.keys();check(cacheNames.includes('gt-bybit-shell-20260908-2'),'Versioned PWA shell installed');
    let apiCached=false;for(const name of cacheNames)for(const request of await (await iframe.contentWindow.caches.open(name)).keys())if(new URL(request.url).pathname.startsWith('/api/'))apiCached=true;
    check(!apiCached,'No API responses in CacheStorage');
    el('lockSettingsBtn').click();await waitFor(()=>el('secureApp').hidden,'Logout failed');check(el('walletTable').textContent==='افتح الجلسة لعرض البيانات.','Logout removes account data');
    const session=await fetch('/api/bybit?action=session').then((r)=>r.json());check(session.authenticated===false,'Logout invalidates server session');
    await login();await nav('overview');
    check(report.responsive.every((row)=>row.pass),'All responsive viewport/view checks');
  }catch(error){report.errors.push(error.message);}
  report.pass=report.errors.length===0 && report.functional.every((row)=>row.pass) && report.responsive.every((row)=>row.pass);
  results.textContent=JSON.stringify(report,null,2);document.querySelector('#run').disabled=false;
};
