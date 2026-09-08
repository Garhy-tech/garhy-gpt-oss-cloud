const API = '/api/bybit';
const VIEW_TITLES = {
  overview: 'الرئيسية',
  trade: 'التداول',
  risk: 'إدارة المخاطر',
  assets: 'الأصول والتحويلات',
  settings: 'الإعدادات والأمان'
};

let controlToken = '';
let lastQuoteTxId = '';
let installPrompt = null;
let currentRegion = '—';

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const statusEl = $('serviceStatus');
const toastEl = $('toast');
const bottomNav = document.querySelector('.bottom-nav');
const sideNav = document.querySelector('.nav');

function toast(message, kind = 'info') {
  toastEl.textContent = message;
  toastEl.dataset.kind = kind;
  toastEl.dataset.show = 'true';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.dataset.show = 'false'; }, 4200);
}

function setStatus(state, text) {
  statusEl.dataset.state = state;
  statusEl.querySelector('span:last-child').textContent = text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formatNumber(value, digits = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(number);
}

function formObject(form) {
  const raw = Object.fromEntries(new FormData(form).entries());
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => String(value).trim() !== ''));
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`${API}?${query}`, {
    method: 'GET',
    headers: controlToken ? { Authorization: `Bearer ${controlToken}` } : {},
    cache: 'no-store',
    credentials: 'same-origin'
  });
  return parseResponse(response);
}

async function apiPost(payload) {
  if (!navigator.onLine) throw new Error('لا يمكن تنفيذ عملية مالية بدون اتصال بالإنترنت.');
  if (!controlToken) throw new Error('جلسة التحكم مقفلة.');
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${controlToken}`
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(payload)
  });
  return parseResponse(response);
}

function setUnlocked(unlocked) {
  $('authGate').classList.toggle('hidden', unlocked);
  $('secureApp').classList.toggle('hidden', !unlocked);
  $$('.session-action').forEach((el) => el.classList.toggle('hidden', !unlocked));
  if (bottomNav) bottomNav.classList.toggle('hidden', !unlocked);
  if (sideNav) sideNav.classList.toggle('hidden', !unlocked);
  document.body.dataset.locked = unlocked ? 'false' : 'true';
}

function navigate(view) {
  const target = VIEW_TITLES[view] ? view : 'overview';
  $$('[data-view-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === target));
  $$('[data-view]').forEach((button) => {
    if (button.dataset.view === target) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('pageTitle').textContent = VIEW_TITLES[target];
  const url = new URL(location.href);
  if (target === 'overview') url.searchParams.delete('view');
  else url.searchParams.set('view', target);
  history.replaceState(null, '', `${url.pathname}${url.search}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (target === 'trade' && controlToken) loadOrders().catch((error) => toast(error.message, 'error'));
}

function resetIdleTimer() {
  if (controlToken && $('sessionClock')) $('sessionClock').textContent = 'مفتوحة';
}

function startIdleTimer() {
  if ($('sessionClock')) $('sessionClock').textContent = 'مفتوحة';
}

function lockSession(message = 'تم تسجيل الخروج ومسح Control Token من ذاكرة الصفحة.') {
  controlToken = '';
  lastQuoteTxId = '';
  $('controlToken').value = '';
  $('confirmConvertBtn').classList.add('hidden');
  $('convertQuote').textContent = 'سيظهر سعر التحويل هنا قبل التنفيذ.';
  setUnlocked(false);
  setStatus('idle', 'مقفلة');
  $('pageTitle').textContent = 'GT.BYBIT';
  toast(message, 'info');
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
  $('walletTable').innerHTML = `<table><thead><tr><th>Coin</th><th>Wallet</th><th>USD Value</th><th>Unrealised PNL</th></tr></thead><tbody>${coins.map((coin) => `<tr><td class="coin">${escapeHtml(coin.coin)}</td><td>${escapeHtml(formatNumber(coin.walletBalance, 8))}</td><td>${escapeHtml(formatNumber(coin.usdValue, 2))}</td><td class="${pnlClass(coin.unrealisedPnl)}">${escapeHtml(formatNumber(coin.unrealisedPnl, 4))}</td></tr>`).join('')}</tbody></table>`;
}

function renderPositions(payload) {
  const list = (payload?.data?.list || []).filter((position) => Number(position.size || 0) !== 0);
  $('mPositions').textContent = String(list.length);
  if (!list.length) {
    $('positionsTable').innerHTML = '<div class="empty">لا توجد مراكز مفتوحة.</div>';
    return;
  }
  $('positionsTable').innerHTML = `<table><thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Avg</th><th>Mark</th><th>Lev.</th><th>PNL</th><th>Liq.</th></tr></thead><tbody>${list.map((p) => `<tr><td class="coin">${escapeHtml(p.symbol)}</td><td class="${p.side === 'Buy' ? 'side-buy' : 'side-sell'}">${escapeHtml(p.side)}</td><td>${escapeHtml(p.size)}</td><td>${escapeHtml(p.avgPrice)}</td><td>${escapeHtml(p.markPrice)}</td><td>${escapeHtml(p.leverage)}x</td><td class="${pnlClass(p.unrealisedPnl)}">${escapeHtml(formatNumber(p.unrealisedPnl, 4))}</td><td>${escapeHtml(p.liqPrice || '—')}</td></tr>`).join('')}</tbody></table>`;
}

function renderOrders(payload, category) {
  const list = payload?.data?.list || [];
  $('mOrders').textContent = String(list.length);
  if (!list.length) {
    $('ordersTable').innerHTML = '<div class="empty">لا توجد أوامر مفتوحة في هذا السوق.</div>';
    return;
  }
  $('ordersTable').innerHTML = `<table><thead><tr><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>${list.map((o) => `<tr><td class="coin">${escapeHtml(o.symbol)}</td><td class="${o.side === 'Buy' ? 'side-buy' : 'side-sell'}">${escapeHtml(o.side)}</td><td>${escapeHtml(o.orderType)}</td><td>${escapeHtml(o.qty)}</td><td>${escapeHtml(o.price || 'Market')}</td><td>${escapeHtml(o.orderStatus)}</td><td><button class="btn btn--danger btn--small js-cancel" data-category="${escapeHtml(category)}" data-symbol="${escapeHtml(o.symbol)}" data-order-id="${escapeHtml(o.orderId)}" type="button">إلغاء</button></td></tr>`).join('')}</tbody></table>`;
  $$('.js-cancel').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm(`إلغاء الأمر ${button.dataset.orderId} على ${button.dataset.symbol}؟`)) return;
    try {
      await apiPost({ action: 'cancel-order', category: button.dataset.category, symbol: button.dataset.symbol, orderId: button.dataset.orderId });
      toast('تم إرسال طلب إلغاء الأمر إلى Bybit.', 'success');
      await loadOrders();
    } catch (error) { toast(error.message, 'error'); }
  }));
}

async function loadOrders() {
  const category = $('ordersCategory').value;
  const payload = await apiGet('orders', { category });
  renderOrders(payload, category);
}

async function loadDashboard() {
  const [wallet, positions] = await Promise.all([
    apiGet('wallet'),
    apiGet('positions', { category: 'linear', settleCoin: 'USDT' })
  ]);
  renderWallet(wallet);
  renderPositions(positions);
  await loadOrders();
}

async function refreshDashboard(showToast = true) {
  if (!controlToken) return;
  try {
    await loadDashboard();
    if (showToast) toast('تم تحديث بيانات الحساب.', 'success');
  } catch (error) {
    if (error.status === 401) return lockSession('انتهت أو فشلت جلسة التحكم من جهة الخادم.');
    toast(error.message, 'error');
  }
}

async function connect() {
  const token = $('controlToken').value.trim();
  if (!token) return toast('أدخل Control Token أولًا.', 'error');
  controlToken = token;
  $('connectBtn').disabled = true;
  $('connectBtn').textContent = 'جارٍ التحقق...';
  try {
    const health = await apiGet('health');
    if (!health.authenticated || !health.controlReady) throw new Error('Bybit control is not ready');
    await apiGet('wallet');
    currentRegion = health.region || 'Vercel';
    $('regionLabel').textContent = currentRegion;
    $('settingsRegion').textContent = currentRegion;
    $('controlToken').value = '';
    setUnlocked(true);
    setStatus('ok', `متصل · ${currentRegion}`);
    startIdleTimer();
    const requested = new URL(location.href).searchParams.get('view') || 'overview';
    navigate(requested);
    await loadDashboard();
    toast('GT.BYBIT متصل بالحساب بنجاح.', 'success');
  } catch (error) {
    controlToken = '';
    setStatus('error', 'فشل الاتصال');
    toast(error.status === 401 ? 'Control Token غير صحيح.' : error.message, 'error');
  } finally {
    $('connectBtn').disabled = false;
    $('connectBtn').textContent = 'فتح الجلسة';
  }
}

$('connectBtn').addEventListener('click', connect);
$('controlToken').addEventListener('keydown', (event) => { if (event.key === 'Enter') connect(); });
$('disconnectBtn').addEventListener('click', () => lockSession());
$('lockSettingsBtn').addEventListener('click', () => lockSession());
$('refreshBtn').addEventListener('click', () => refreshDashboard());
$('overviewRefresh').addEventListener('click', () => refreshDashboard());
$('reloadOrdersBtn').addEventListener('click', async () => {
  try { await loadOrders(); toast('تم تحديث الأوامر.', 'success'); } catch (error) { toast(error.message, 'error'); }
});

$$('[data-view]').forEach((button) => button.addEventListener('click', () => {
  if (!controlToken) return;
  navigate(button.dataset.view);
}));

$('orderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formObject(event.currentTarget);
  body.action = 'place-order';
  if (body.orderType === 'Market') delete body.price;
  const summary = `${body.side} ${body.qty} ${body.symbol} · ${body.orderType}${body.price ? ` @ ${body.price}` : ''}`;
  if (!confirm(`تأكيد إرسال أمر حقيقي إلى Bybit؟\n\n${summary}`)) return;
  try {
    const result = await apiPost(body);
    toast(`تم إرسال الأمر · ${result.data?.orderId || 'accepted'}`, 'success');
    await loadOrders();
  } catch (error) { toast(error.message, 'error'); }
});

$('leverageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'set-leverage', ...formObject(event.currentTarget) };
  if (!confirm(`تحديث Leverage على ${body.symbol} إلى Buy ${body.buyLeverage}x / Sell ${body.sellLeverage}x؟`)) return;
  try { await apiPost(body); toast('تم تحديث Leverage.', 'success'); await refreshDashboard(false); } catch (error) { toast(error.message, 'error'); }
});

$('stopForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'set-trading-stop', ...formObject(event.currentTarget) };
  if (!body.takeProfit && !body.stopLoss && !body.trailingStop) return toast('حدد TP أو SL أو Trailing Stop.', 'error');
  if (!confirm(`تحديث حماية المركز على ${body.symbol}؟`)) return;
  try { await apiPost(body); toast('تم تحديث حماية المركز.', 'success'); await refreshDashboard(false); } catch (error) { toast(error.message, 'error'); }
});

$('transferForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'transfer', ...formObject(event.currentTarget) };
  if (body.fromAccountType === body.toAccountType) return toast('حساب المصدر والوجهة يجب أن يكونا مختلفين.', 'error');
  if (!confirm(`تحويل ${body.amount} ${body.coin} من ${body.fromAccountType} إلى ${body.toAccountType}؟`)) return;
  try { await apiPost(body); toast('تم إرسال التحويل الداخلي.', 'success'); await refreshDashboard(false); } catch (error) { toast(error.message, 'error'); }
});

$('convertForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  lastQuoteTxId = '';
  $('confirmConvertBtn').classList.add('hidden');
  const body = { action: 'convert-quote', ...formObject(event.currentTarget) };
  try {
    const result = await apiPost(body);
    const quote = result.data || {};
    lastQuoteTxId = quote.quoteTxId || '';
    $('convertQuote').textContent = lastQuoteTxId
      ? `${quote.fromCoin || body.fromCoin} ${quote.fromAmount || body.requestAmount} → ${quote.toCoin || body.toCoin} ${quote.toAmount || ''} · Rate ${quote.exchangeRate || '—'}`
      : 'تم استلام Quote ولكن بدون quoteTxId.';
    $('confirmConvertBtn').classList.toggle('hidden', !lastQuoteTxId);
  } catch (error) { toast(error.message, 'error'); }
});

$('confirmConvertBtn').addEventListener('click', async () => {
  if (!lastQuoteTxId) return;
  if (!confirm('تأكيد تنفيذ Convert الحقيقي بهذا السعر؟')) return;
  try {
    await apiPost({ action: 'convert-confirm', quoteTxId: lastQuoteTxId, confirm: 'CONVERT' });
    lastQuoteTxId = '';
    $('confirmConvertBtn').classList.add('hidden');
    $('convertQuote').textContent = 'تم تنفيذ Convert بنجاح.';
    toast('تم تنفيذ Convert.', 'success');
    await refreshDashboard(false);
  } catch (error) { toast(error.message, 'error'); }
});

$('cancelAllForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'cancel-all', ...formObject(event.currentTarget) };
  if (body.confirm !== 'CANCEL_ALL') return toast('اكتب CANCEL_ALL حرفيًا.', 'error');
  if (!confirm(`تأكيد إلغاء كل الأوامر المطابقة في ${body.category}؟`)) return;
  try { await apiPost(body); toast('تم إرسال Cancel All.', 'success'); await loadOrders(); } catch (error) { toast(error.message, 'error'); }
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function installApp() {
  if (isStandalone()) return toast('GT.BYBIT مثبت بالفعل كتطبيق.', 'success');
  if (installPrompt) {
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') toast('تم بدء تثبيت GT.BYBIT.', 'success');
    installPrompt = null;
    $('installBtn').classList.add('hidden');
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(ios ? 'على iPhone/iPad: Share ثم Add to Home Screen.' : 'افتح قائمة المتصفح واختر Install app / إضافة إلى الشاشة الرئيسية.');
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  $('installBtn').classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  $('installBtn').classList.add('hidden');
  $('pwaState').textContent = 'Installed';
  toast('تم تثبيت GT.BYBIT.', 'success');
});
$('installBtn').addEventListener('click', installApp);
$('installSettingsBtn').addEventListener('click', installApp);

function updateConnectivity() {
  $('offlineBanner').classList.toggle('hidden', navigator.onLine);
  if (!navigator.onLine) setStatus('error', 'Offline');
  else if (controlToken) setStatus('ok', `متصل · ${currentRegion}`);
}
window.addEventListener('online', updateConnectivity);
window.addEventListener('offline', updateConnectivity);

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/gt-bybit/sw.js', { scope: '/gt-bybit/' });
  } catch (error) {
    console.warn('GT.BYBIT service worker registration failed', error);
  }
}

(async function boot() {
  setUnlocked(false);
  updateConnectivity();
  $('pwaState').textContent = isStandalone() ? 'Standalone' : 'Browser';
  if (isStandalone()) $('installBtn').classList.add('hidden');
  await registerServiceWorker();
  try {
    const health = await apiGet('health');
    currentRegion = health.region || 'Vercel';
    $('preAuthState').textContent = health.authenticated && health.controlReady ? `جاهز · ${currentRegion}` : 'الإعداد غير مكتمل';
    $('settingsRegion').textContent = currentRegion;
    setStatus(health.authenticated && health.controlReady ? 'idle' : 'error', health.controlReady ? 'جاهز للقفل' : 'غير مهيأ');
  } catch {
    $('preAuthState').textContent = 'Bybit غير متاح';
    setStatus('error', 'Bybit غير متاح');
  }
})();
