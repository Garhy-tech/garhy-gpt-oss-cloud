import { validateAction, financialActions } from './validation.js?v=20260908-2';

const API='/api/bybit';
const VIEW_TITLES={overview:'الرئيسية',trade:'التداول',risk:'إدارة المخاطر',assets:'الأصول والتحويلات',settings:'الإعدادات والأمان'};
const $=(id)=>document.getElementById(id);
const $$=(selector)=>[...document.querySelectorAll(selector)];
const state={authenticated:false,csrf:'',generation:0,quote:null,quoteTimer:null,installPrompt:null,region:'—',mutationsEnabled:false,pending:new Set(),attempts:new Map(),ordersRequest:0,refreshing:false,accountSnapshot:null};
const NOTIFICATION_PREF='gt-bybit-notifications';
const sessionChannel='BroadcastChannel' in window ? new BroadcastChannel('gt-bybit-session') : null;
let toastTimer;
function toast(message,kind='info') {
  const el=$('toast'); el.textContent=message; el.dataset.kind=kind; el.dataset.show='true';
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{el.dataset.show='false';},6500);
}
function setStatus(status,message) { $('serviceStatus').dataset.state=status; $('serviceStatus').querySelector('span:last-child').textContent=message; }
function escapeHtml(value) { return String(value??'').replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function formatNumber(value,digits=4) {
  if(value === '' || value === undefined || value === null) return '—';
  const n=Number(value); return Number.isFinite(n) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(n) : '—';
}
function formObject(form) { return Object.fromEntries([...new FormData(form).entries()].map(([key,value])=>[key,String(value).trim()]).filter(([,value])=>value!=='')); }
function notificationsEnabled(){return 'Notification' in window && Notification.permission==='granted' && localStorage.getItem(NOTIFICATION_PREF)==='all';}
function updateNotificationState(){
  if(!('Notification' in window)){$('notificationState').textContent='غير مدعومة';$('notificationBtn').disabled=true;return;}
  const enabled=notificationsEnabled();$('notificationState').textContent=enabled?'جميع الإشعارات مفعّلة':Notification.permission==='denied'?'محظورة من إعدادات الهاتف':'غير مفعّلة';$('notificationBtn').textContent=enabled?'إيقاف الإشعارات':'تفعيل جميع الإشعارات';
}
async function notify(title,body,tag){
  if(!notificationsEnabled())return;
  const registration=await navigator.serviceWorker?.ready.catch(()=>null);
  if(registration)await registration.showNotification(title,{body,tag,icon:'/assets/gt-bybit/icon-192.png',badge:'/assets/gt-bybit/icon-192.png',dir:'rtl',lang:'ar',renotify:false,data:{url:'/'}});
}
async function toggleNotifications(){
  if(notificationsEnabled()){localStorage.removeItem(NOTIFICATION_PREF);updateNotificationState();return toast('تم إيقاف إشعارات GT.BYBIT.');}
  if(!('Notification' in window))return toast('الإشعارات غير مدعومة على هذا المتصفح.','error');
  const permission=await Notification.requestPermission();
  if(permission==='granted'){localStorage.setItem(NOTIFICATION_PREF,'all');updateNotificationState();await notify('GT.BYBIT','تم تفعيل جميع إشعارات الحساب والأمان.','gt-bybit-enabled');}
  else{updateNotificationState();toast('فعّل الإشعارات من إعدادات الموقع في الهاتف.','error');}
}

async function api(action,{params={},body,allowLocked=false}={}) {
  if(!navigator.onLine) throw new Error('أنت غير متصل. العمليات متوقفة حتى عودة الاتصال.');
  if(!allowLocked && !state.authenticated) throw new Error('افتح جلسة التحكم أولًا.');
  const headers={Accept:'application/json'};
  if(body) { headers['Content-Type']='application/json'; if(state.csrf) headers['X-CSRF-Token']=state.csrf; }
  const generation=state.generation;
  let response;
  try {
    response=await fetch(body ? API : `${API}?${new URLSearchParams({action,...params})}`,{
      method:body?'POST':'GET',headers,credentials:'same-origin',cache:'no-store',redirect:'error',
      signal:AbortSignal.timeout(28000),...(body ? {body:JSON.stringify({action,...body})} : {}),
    });
  } catch {
    throw new Error(body && financialActions.includes(action) ? 'تعذر تأكيد نتيجة الطلب. راجع سجل الحساب؛ لن يعاد إرسال العملية تلقائيًا.' : 'تعذر الاتصال بالخادم. حاول مجددًا عند استقرار الاتصال.');
  }
  const result=await response.json().catch(()=>null);
  if(generation!==state.generation && !allowLocked) throw new Error('تم تغيير حالة الجلسة.');
  if(!response.ok || result?.ok!==true) {
    if(response.status===401 && !allowLocked) lockLocal();
    const error=new Error(result?.message || (response.status===404 ? 'مسار الخدمة غير متاح. راجع إعداد نشر التطبيق.' : 'استجابة الخادم غير صالحة.'));
    error.status=response.status; error.code=result?.error; throw error;
  }
  return result;
}
const apiGet=(action,params={})=>api(action,{params});
function setUnlocked(unlocked) {
  state.authenticated=unlocked;
  for(const [id,visible] of [['authGate',!unlocked],['secureApp',unlocked]]) { $(id).hidden=!visible; $(id).classList.toggle('hidden',!visible); }
  $$('.session-action,.bottom-nav,.nav').forEach((el)=>{el.hidden=!unlocked;el.classList.toggle('hidden',!unlocked);});
  document.body.dataset.locked=String(!unlocked);
  updateConnectivity();
}
function clearQuote() { state.quote=null; clearTimeout(state.quoteTimer); $('confirmConvertBtn').hidden=true; $('confirmConvertBtn').classList.add('hidden'); $('convertQuote').textContent='اطلب عرض سعر جديدًا قبل التحويل.'; }
function lockLocal() {
  state.generation++;state.csrf='';state.attempts.clear();clearQuote();
  $('controlToken').value='';
  if($('confirmDialog').open) $('confirmDialog').close('cancel');
  for(const id of ['walletTable','positionsTable','ordersTable','availableAssets']) $(id).textContent='افتح الجلسة لعرض البيانات.';
  for(const id of ['mEquity','mWallet','mPositions','mOrders']) $(id).textContent='—';
  $$('form').forEach((form)=>form.reset());setUnlocked(false);setStatus('idle','مقفلة');$('pageTitle').textContent='GT.BYBIT';
}
function navigate(view) {
  const target=VIEW_TITLES[view]?view:'overview';
  $$('[data-view-panel]').forEach((panel)=>{const active=panel.dataset.viewPanel===target;panel.hidden=!active;panel.classList.toggle('active',active);});
  $$('[data-view]').forEach((button)=>{if(button.dataset.view===target)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  $('pageTitle').textContent=VIEW_TITLES[target];
  const url=new URL(location.href);url.search=target==='overview'?'':new URLSearchParams({view:target}).toString();history.replaceState(null,'',url.pathname+url.search);
  window.scrollTo({top:0,behavior:'instant'});
  if(state.authenticated && target==='trade') loadOrders().catch((e)=>toast(e.message,'error'));
  if(state.authenticated && target==='assets') loadAssets().catch((e)=>toast(e.message,'error'));
}
async function applySession(session) {
  state.csrf=session.csrfToken;setUnlocked(true);
  $('sessionClock').textContent='مفتوحة';
  $('sessionPolicy').textContent=`لا قفل بسبب الخمول. الصلاحية القصوى ${session.absoluteLifetimeDays} يومًا من تسجيل الدخول، أو حتى تسجيل الخروج أو إلغاء الجلسة.`;
  $('sessionExpiry').textContent=new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short'}).format(new Date(session.expiresAt));
  setStatus('ok','جلسة مفتوحة');navigate(new URL(location.href).searchParams.get('view') || 'overview');
  await refreshDashboard(false);
}
async function connect() {
  if(state.pending.has('connect'))return;
  const input=$('controlToken');
  if(!input.value.trim())return toast('أدخل رمز التحكم أولًا.','error');
  state.pending.add('connect');$('connectBtn').disabled=true;$('connectBtn').textContent='جارٍ التحقق…';
  try { const body={controlToken:input.value.trim()};input.value='';const session=await api('login',{body,allowLocked:true});body.controlToken='';await applySession(session);sessionChannel?.postMessage('changed');toast('تم فتح جلسة التحكم.','success');await notify('تنبيه أمان GT.BYBIT','تم فتح جلسة تحكم جديدة.','gt-bybit-login'); }
  catch(error) {toast(error.message,'error');}
  finally {input.value='';state.pending.delete('connect');$('connectBtn').disabled=false;$('connectBtn').textContent='فتح الجلسة';}
}
async function logout() {
  if(state.pending.size)return toast('انتظر انتهاء الطلب الجاري قبل تسجيل الخروج.');
  state.pending.add('logout');
  try {await api('logout',{body:{}});lockLocal();sessionChannel?.postMessage('logout');toast('تم تسجيل الخروج وإلغاء الجلسة على الخادم.','success');}
  catch(error){toast(`لم يكتمل تسجيل الخروج على الخادم: ${error.message}`,'error');}
  finally{state.pending.delete('logout');}
}

const SUMMARY_LABELS={action:'العملية',category:'السوق',symbol:'الرمز',side:'الجهة',qty:'الكمية',orderType:'نوع الأمر',price:'السعر',takeProfit:'جني الربح',stopLoss:'وقف الخسارة',trailingStop:'الوقف المتحرك',activePrice:'سعر التفعيل',buyLeverage:'رافعة الشراء',sellLeverage:'رافعة البيع',positionIdx:'جهة المركز',mode:'وضع المركز',tpslMode:'نطاق الحماية',fromAccountType:'حساب المصدر',toAccountType:'حساب الوجهة',amount:'المبلغ',coin:'العملة',fromCoin:'من عملة',toCoin:'إلى عملة',fromAmount:'المبلغ المباع',toAmount:'المبلغ المشترى',exchangeRate:'سعر التحويل',expiredTime:'ينتهي العرض',quoteTxId:'معرّف العرض',orderId:'معرّف الأمر',orderLinkId:'مرجع الأمر',settleCoin:'عملة التسوية',baseCoin:'العملة الأساسية',marketUnit:'وحدة الكمية',timeInForce:'مدة الأمر',reduceOnly:'تقليل المركز فقط',closeOnTrigger:'إغلاق عند التفعيل'};
const ACTION_LABELS={'place-order':'إرسال أمر حقيقي','cancel-order':'إلغاء أمر','cancel-all':'إلغاء جميع الأوامر المطابقة','set-leverage':'تغيير الرافعة المالية','set-trading-stop':'تعديل حماية المركز','set-position-mode':'تغيير وضع المركز',transfer:'تحويل داخلي','convert-confirm':'تنفيذ تحويل العملات'};
function confirmAction(data) {
  const dialog=$('confirmDialog');
  if(dialog.open)return Promise.resolve(false);
  const entries=Object.entries(data).filter(([key])=>!['confirm','requestId','confirmed'].includes(key));
  if(data.action==='convert-confirm' && state.quote) entries.push(...Object.entries(state.quote).filter(([key])=>['fromCoin','toCoin','fromAmount','toAmount','exchangeRate','expiredTime'].includes(key)));
  $('confirmationSummary').replaceChildren();
  for(const [key,value] of entries) {
    const row=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');
    term.textContent=SUMMARY_LABELS[key] || key;
    detail.textContent=key==='action' ? ACTION_LABELS[value] : key==='expiredTime' ? new Date(Number(value)).toLocaleTimeString('ar-EG') : String(value);
    row.append(term,detail);$('confirmationSummary').append(row);
  }
  $('confirmationTyped').value='';$('typedConfirmField').hidden=data.action!=='cancel-all';
  dialog.showModal();$('confirmCancel').focus();
  return new Promise((resolve)=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});});
}
$('confirmAccept').addEventListener('click',()=>{
  if(!$('typedConfirmField').hidden && $('confirmationTyped').value!=='CANCEL_ALL')return toast('اكتب CANCEL_ALL حرفيًا داخل التأكيد.','error');
  if(state.quote && state.quote.expiredTime && Number(state.quote.expiredTime)<=Date.now() && $('confirmationSummary').textContent.includes('تنفيذ تحويل العملات'))return toast('انتهى العرض. اطلب عرضًا جديدًا.','error');
  $('confirmDialog').close('confirm');
});
$('confirmCancel').addEventListener('click',()=>$('confirmDialog').close('cancel'));
async function runMutation(control,input,after=()=>{}) {
  if(state.pending.size || !state.authenticated)return;
  state.pending.add('mutation');updateConnectivity();control.setAttribute('aria-busy','true');
  try {
    const data=validateAction(input);
    if(!navigator.onLine)throw new Error('لا يمكن التنفيذ دون اتصال بالإنترنت.');
    if(!state.mutationsEnabled)throw new Error('العمليات المالية معطّلة من إعدادات الخادم.');
    if(!await confirmAction(data))return;
    if(!state.authenticated || !navigator.onLine)throw new Error('تغيرت حالة الاتصال أو الجلسة.');
    const fingerprint=JSON.stringify(data);
    const requestId=state.attempts.get(fingerprint) || crypto.randomUUID();state.attempts.set(fingerprint,requestId);
    await api(data.action,{body:{...data,confirmed:true,requestId}});
    state.attempts.delete(fingerprint);
    if(data.action==='convert-confirm')clearQuote();
    toast('استلمت Bybit الطلب. تحقّق من حالته النهائية في سجل الحساب.','success');await notify('GT.BYBIT','استلمت Bybit طلب العملية بعد تأكيدك. راجع سجل الحساب للحالة النهائية.',`gt-bybit-${data.action}`);
    try {await after();} catch {toast('قُبل الطلب، لكن تعذر تحديث البيانات. حدّثها يدويًا.');}
  } catch(error){toast(error.message,'error');}
  finally{state.pending.delete('mutation');control.removeAttribute('aria-busy');updateConnectivity();}
}
function pnlClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return n > 0 ? 'pnl-pos' : 'pnl-neg';
}

function renderWallet(payload) {
  const account = payload?.data?.list?.[0] || {};
  $('mEquity').textContent = `${formatNumber(account.totalEquity, 2)} USD`;
  $('mWallet').textContent = `${formatNumber(account.totalWalletBalance, 2)} USD`;
  const coins = (account.coin || []).filter((coin) => Number(coin.walletBalance || 0) !== 0 || Number(coin.usdValue || 0) !== 0);
  if (!coins.length) {
    $('walletTable').innerHTML = '<div class="empty">لا توجد أرصدة غير صفرية.</div>';
    return;
  }
  $('walletTable').innerHTML = `<table><thead><tr><th>العملة</th><th>الرصيد</th><th>القيمة بالدولار</th><th>الربح غير المحقق</th></tr></thead><tbody>${coins.map((coin) => `<tr><td class="coin">${escapeHtml(coin.coin)}</td><td>${escapeHtml(formatNumber(coin.walletBalance, 8))}</td><td>${escapeHtml(formatNumber(coin.usdValue, 2))}</td><td class="${pnlClass(coin.unrealisedPnl)}">${escapeHtml(formatNumber(coin.unrealisedPnl, 4))}</td></tr>`).join('')}</tbody></table>`;
}

function renderPositions(payload) {
  const list = (payload?.data?.list || []).filter((position) => Number(position.size || 0) !== 0);
  $('mPositions').textContent = `${list.length}${payload.hasMore ? '+' : ''}`;
  if (!list.length) {
    $('positionsTable').innerHTML = '<div class="empty">لا توجد مراكز مفتوحة.</div>';
    return;
  }
  $('positionsTable').innerHTML = `<table><thead><tr><th>السوق</th><th>الجهة</th><th>الكمية</th><th>المتوسط</th><th>السعر المرجعي</th><th>الرافعة</th><th>الربح</th><th>التصفية</th></tr></thead><tbody>${list.map((p) => `<tr><td class="coin">${escapeHtml(p.symbol)}</td><td class="${p.side === 'Buy' ? 'side-buy' : 'side-sell'}">${escapeHtml(p.side)}</td><td>${escapeHtml(p.size)}</td><td>${escapeHtml(p.avgPrice)}</td><td>${escapeHtml(p.markPrice)}</td><td>${escapeHtml(p.leverage)}x</td><td class="${pnlClass(p.unrealisedPnl)}">${escapeHtml(formatNumber(p.unrealisedPnl, 4))}</td><td>${escapeHtml(p.liqPrice || '—')}</td></tr>`).join('')}</tbody></table>`;
}

function renderOrders(payload, category) {
  const list = payload?.data?.list || [];
  $('mOrders').textContent = `${list.length}${payload.hasMore ? '+' : ''}`;
  if (!list.length) {
    $('ordersTable').innerHTML = '<div class="empty">لا توجد أوامر مفتوحة في هذا السوق.</div>';
    return;
  }
  $('ordersTable').innerHTML = `<table><thead><tr><th>السوق</th><th>الجهة</th><th>النوع</th><th>الكمية</th><th>السعر</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map((o) => `<tr><td class="coin">${escapeHtml(o.symbol)}</td><td class="${o.side === 'Buy' ? 'side-buy' : 'side-sell'}">${escapeHtml(o.side)}</td><td>${escapeHtml(o.orderType)}</td><td>${escapeHtml(o.qty)}</td><td>${escapeHtml(o.price || 'Market')}</td><td>${escapeHtml(o.orderStatus)}</td><td><button class="btn btn--danger btn--small js-cancel" data-category="${escapeHtml(category)}" data-symbol="${escapeHtml(o.symbol)}" data-order-id="${escapeHtml(o.orderId)}" type="button">إلغاء</button></td></tr>`).join('')}</tbody></table>`;
  $$('.js-cancel').forEach((button) => button.addEventListener('click', () => runMutation(button, {
    action: 'cancel-order', category: button.dataset.category, symbol: button.dataset.symbol, orderId: button.dataset.orderId
  }, loadOrders)));
}

async function loadOrders() {
  const category=$('ordersCategory').value,request=++state.ordersRequest;
  $('ordersTable').textContent='جارٍ تحميل الأوامر…';
  try {const payload=await apiGet('orders',{category});if(request===state.ordersRequest && state.authenticated)renderOrders(payload,category);}
  catch(error){if(state.authenticated){$('ordersTable').textContent=error.message;$('mOrders').textContent='—';}throw error;}
}
async function loadAssets() {
  $('availableAssets').textContent='جارٍ تحميل العملات المتاحة للتحويل…';
  const form=$('transferForm');
  try { const response=await apiGet('transfer-coins',{fromAccountType:form.elements.fromAccountType.value,toAccountType:form.elements.toAccountType.value});$('availableAssets').textContent=(response.data.list || []).join(' · ') || 'لا توجد عملات متاحة لهذا الاتجاه.'; }
  catch(error){$('availableAssets').textContent=error.message;}
}
async function refreshDashboard(showToast=true) {
  if(!state.authenticated || state.refreshing)return;
  state.refreshing=true;$('refreshBtn').disabled=true;
  const epoch=state.generation;
  try {
    const jobs=[['walletTable',()=>apiGet('wallet'),renderWallet],['positionsTable',()=>apiGet('positions',{category:'linear',settleCoin:'USDT'}),renderPositions],['ordersTable',loadOrders,null],['settingsAccount',()=>apiGet('account'),(result)=>{const mode=result.data.unifiedMarginStatus;$('settingsAccount').textContent=({1:'Classic',3:'UTA 1.0',4:'UTA 1.0 Pro',5:'UTA 2.0',6:'UTA 2.0 Pro'})[mode] || 'غير محدد';}]];
    const results=await Promise.allSettled(jobs.map(async([id,fetcher,render])=>{try {const result=await fetcher();if(epoch===state.generation && state.authenticated && render)render(result);}catch(error){if(epoch===state.generation && state.authenticated)$(id).textContent=error.message;throw error;}}));
    if(epoch!==state.generation || !state.authenticated)return;
    const rejected=results.filter((r)=>r.status==='rejected');
    if(rejected.length) {setStatus('error','بيانات غير مكتملة');toast(rejected[0].reason.message,'error');}
    else {const next={equity:$('mEquity').textContent,positions:$('mPositions').textContent,orders:$('mOrders').textContent};if(state.accountSnapshot && JSON.stringify(next)!==JSON.stringify(state.accountSnapshot))await notify('تحديث حساب GT.BYBIT','تم رصد تغيير في ملخص الحساب أو المراكز أو الأوامر. افتح التطبيق للمراجعة.','gt-bybit-account-change');state.accountSnapshot=next;setStatus('ok','متصل بـBybit');if(showToast)toast('تم تحديث بيانات الحساب.','success');}
  } finally {state.refreshing=false;updateConnectivity();}
}
$('connectBtn').addEventListener('click',connect);
$('controlToken').addEventListener('keydown',(e)=>{if(e.key==='Enter')connect();});
$('disconnectBtn').addEventListener('click',logout);$('lockSettingsBtn').addEventListener('click',logout);
$('refreshBtn').addEventListener('click',()=>refreshDashboard());$('overviewRefresh').addEventListener('click',()=>refreshDashboard());
$('reloadOrdersBtn').addEventListener('click',()=>loadOrders().catch((e)=>toast(e.message,'error')));
$('ordersCategory').addEventListener('change',()=>loadOrders().catch((e)=>toast(e.message,'error')));
$$('[data-view]').forEach((button)=>button.addEventListener('click',()=>{if(state.authenticated)navigate(button.dataset.view);}));
for(const [id,action] of Object.entries({orderForm:'place-order',leverageForm:'set-leverage',stopForm:'set-trading-stop',modeForm:'set-position-mode',transferForm:'transfer',cancelAllForm:'cancel-all'})) {
  $(id).addEventListener('submit',(event)=>{event.preventDefault();const data={action,...formObject(event.currentTarget)};if(data.orderType==='Market')delete data.price;runMutation(event.currentTarget.querySelector('[type="submit"]'),data,()=>refreshDashboard(false));});
}
function updateOrderFields() {
  const form=$('orderForm'),limit=form.elements.orderType.value==='Limit',derivative=['linear','inverse'].includes(form.elements.category.value);
  form.elements.price.disabled=!limit;form.elements.price.required=limit;
  form.elements.positionIdx.disabled=!derivative;
  const supportsProtection=derivative || (form.elements.category.value==='spot' && limit);
  for(const key of ['takeProfit','stopLoss'])form.elements[key].disabled=!supportsProtection;
  $('quantityHint').textContent=form.elements.category.value==='spot'?'كمية العملة الأساسية، بما في ذلك أوامر الشراء بسعر السوق.':'كمية العقد حسب وحدة السوق المختار.';
}
$('orderForm').addEventListener('change',updateOrderFields);
$('transferForm').addEventListener('change',()=>{if(state.authenticated)loadAssets();});
$('convertForm').addEventListener('input',clearQuote);
$('convertForm').addEventListener('submit',async(event)=>{
  event.preventDefault();if(state.pending.size)return;clearQuote();state.pending.add('quote');updateConnectivity();
  try {
    const data=validateAction({action:'convert-quote',...formObject(event.currentTarget)});
    const result=await api('convert-quote',{body:data});state.quote=result.data;
    const q=state.quote;
    if(!q.quoteTxId || Number(q.expiredTime)<=Date.now())throw new Error('عرض التحويل منتهي أو غير صالح.');
    $('convertQuote').textContent=`${q.fromAmount} ${q.fromCoin} ← ${q.toAmount} ${q.toCoin} · سعر التحويل ${q.exchangeRate} · ينتهي ${new Date(Number(q.expiredTime)).toLocaleTimeString('ar-EG')}`;
    $('confirmConvertBtn').hidden=false;$('confirmConvertBtn').classList.remove('hidden');
    state.quoteTimer=setTimeout(()=>{clearQuote();$('convertQuote').textContent='انتهت صلاحية العرض. اطلب عرضًا جديدًا.';},Math.max(0,Number(q.expiredTime)-Date.now()));
  }catch(error){clearQuote();toast(error.message,'error');}
  finally{state.pending.delete('quote');updateConnectivity();}
});
$('confirmConvertBtn').addEventListener('click',()=>{if(state.quote)runMutation($('confirmConvertBtn'),{action:'convert-confirm',quoteTxId:state.quote.quoteTxId,confirm:'CONVERT'},()=>refreshDashboard(false));});
function isStandalone(){return matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;}
async function installApp(){
  if(isStandalone())return toast('التطبيق يعمل بوضع مستقل.');
  if(state.installPrompt){await state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('installBtn').hidden=true;}
  else toast(/iphone|ipad|ipod/i.test(navigator.userAgent)?'من قائمة المشاركة اختر «إضافة إلى الشاشة الرئيسية».':'من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».');
}
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();state.installPrompt=e;$('installBtn').hidden=false;$('installBtn').classList.remove('hidden');});
window.addEventListener('appinstalled',()=>{state.installPrompt=null;$('installBtn').hidden=true;$('pwaState').textContent='مثبّت';});
$('installBtn').addEventListener('click',installApp);$('installSettingsBtn').addEventListener('click',installApp);
$('notificationBtn').addEventListener('click',toggleNotifications);
function updateConnectivity(){
  const offline=!navigator.onLine;$('offlineBanner').hidden=!offline;$('offlineBanner').classList.toggle('hidden',!offline);
  if(offline)setStatus('error','غير متصل');
  $$('#secureApp form button,.js-cancel,#confirmConvertBtn,#confirmAccept').forEach((button)=>{button.disabled=offline || state.pending.size>0 && button.id!=='confirmAccept';});
  $('confirmAccept').disabled=offline || !state.authenticated;
  $('refreshBtn').disabled=offline || state.refreshing;
  updateOrderFields();
}
window.addEventListener('offline',()=>{clearQuote();if($('confirmDialog').open)$('confirmDialog').close('cancel');updateConnectivity();});
window.addEventListener('online',()=>{updateConnectivity();setStatus('idle',state.authenticated?'متصل بالشبكة — حدّث البيانات':'جاهز');});
sessionChannel?.addEventListener('message',(event)=>{if(event.data==='logout')lockLocal();});
window.addEventListener('pageshow',async(event)=>{if(event.persisted){lockLocal();try{const session=await api('session',{allowLocked:true});if(session.authenticated)await applySession(session);}catch{}}});
async function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  try{
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
    for(const old of await navigator.serviceWorker.getRegistrations())if(new URL(old.scope).pathname==='/gt-bybit/' && old!==registration)await old.unregister();
    await registration.update();
    $('pwaState').textContent=isStandalone()?'تطبيق مستقل':'جاهز للتثبيت';
  }catch{$('pwaState').textContent='تعذر تهيئة العمل دون اتصال';}
}
async function boot(){
  setUnlocked(false);navigate(new URL(location.href).searchParams.get('view'));updateOrderFields();updateNotificationState();
  const results=await Promise.allSettled([api('health',{allowLocked:true}),api('session',{allowLocked:true}),registerServiceWorker()]);
  const health=results[0].status==='fulfilled'?results[0].value:null;
  if(health){state.region=health.region;state.mutationsEnabled=health.mutationsEnabled;$('regionLabel').textContent=state.region;$('settingsRegion').textContent=state.region;$('mutationsState').textContent=state.mutationsEnabled?'مفعّل بتأكيد يدوي':'معطّل';$('preAuthState').textContent=!health.sessionStoreReady?'خدمة الجلسات غير مهيأة':!health.controlReady?'رمز التحكم غير مهيأ':!health.bybitConfigured?'مفاتيح Bybit غير مهيأة':'جاهز لتسجيل الدخول';setStatus(health.controlReady?'idle':'error',health.controlReady?'مقفلة':'الإعداد غير مكتمل');}
  else{$('preAuthState').textContent=navigator.onLine?'تعذر الوصول إلى الخدمة':'غير متصل بالإنترنت';setStatus('error','غير متاح');}
  if(results[1].status==='fulfilled' && results[1].value.authenticated)await applySession(results[1].value);
  updateConnectivity();
}
boot().catch(()=>toast('تعذر تهيئة التطبيق. أعد تحميل الصفحة.','error'));
