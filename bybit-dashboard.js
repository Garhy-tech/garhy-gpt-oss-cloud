const API = '/api/bybit';
let controlToken = '';
let lastQuoteTxId = '';

const $ = (id) => document.getElementById(id);
const protectedBlocks = [...document.querySelectorAll('.protected')];
const statusEl = $('serviceStatus');
const toastEl = $('toast');

function toast(message, kind = 'info') {
  toastEl.textContent = message;
  toastEl.dataset.kind = kind;
  toastEl.dataset.show = 'true';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.dataset.show = 'false'; }, 4500);
}

function setStatus(ok, text) {
  statusEl.dataset.state = ok ? 'ok' : 'idle';
  statusEl.querySelector('span:last-child').textContent = text;
}

function showDashboard(show) {
  $('dashboardCard').classList.toggle('hidden', !show);
  $('authCard').classList.toggle('hidden', show);
  protectedBlocks.forEach((el) => el.classList.toggle('hidden', !show));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formatNumber(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const detail = data.message || data.error || `HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`${API}?${query}`, {
    headers: controlToken ? { Authorization: `Bearer ${controlToken}` } : {},
    cache: 'no-store'
  });
  return parseResponse(response);
}

async function apiPost(payload) {
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${controlToken}`
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response);
}

function formObject(form) {
  const raw = Object.fromEntries(new FormData(form).entries());
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => String(value).trim() !== ''));
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
  $('walletTable').innerHTML = `<table><thead><tr><th>Coin</th><th>Wallet</th><th>USD Value</th><th>Unrealised PNL</th></tr></thead><tbody>${coins.map((coin) => `<tr><td>${escapeHtml(coin.coin)}</td><td>${escapeHtml(formatNumber(coin.walletBalance, 8))}</td><td>${escapeHtml(formatNumber(coin.usdValue, 2))}</td><td>${escapeHtml(formatNumber(coin.unrealisedPnl, 4))}</td></tr>`).join('')}</tbody></table>`;
}

function renderPositions(payload) {
  const list = (payload?.data?.list || []).filter((p) => Number(p.size || 0) !== 0);
  $('mPositions').textContent = String(list.length);
  if (!list.length) {
    $('positionsTable').innerHTML = '<div class="empty">لا توجد مراكز مفتوحة.</div>';
    return;
  }
  $('positionsTable').innerHTML = `<table><thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Avg</th><th>Mark</th><th>Leverage</th><th>PNL</th><th>Liq.</th></tr></thead><tbody>${list.map((p) => `<tr><td>${escapeHtml(p.symbol)}</td><td>${escapeHtml(p.side)}</td><td>${escapeHtml(p.size)}</td><td>${escapeHtml(p.avgPrice)}</td><td>${escapeHtml(p.markPrice)}</td><td>${escapeHtml(p.leverage)}</td><td>${escapeHtml(formatNumber(p.unrealisedPnl, 4))}</td><td>${escapeHtml(p.liqPrice || '—')}</td></tr>`).join('')}</tbody></table>`;
}

function renderOrders(payload, category) {
  const list = payload?.data?.list || [];
  $('mOrders').textContent = String(list.length);
  if (!list.length) {
    $('ordersTable').innerHTML = '<div class="empty">لا توجد أوامر مفتوحة في هذا السوق.</div>';
    return;
  }
  $('ordersTable').innerHTML = `<table><thead><tr><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>${list.map((o) => `<tr><td>${escapeHtml(o.symbol)}</td><td>${escapeHtml(o.side)}</td><td>${escapeHtml(o.orderType)}</td><td>${escapeHtml(o.qty)}</td><td>${escapeHtml(o.price || 'Market')}</td><td>${escapeHtml(o.orderStatus)}</td><td><button class="btn btn--danger js-cancel" data-category="${escapeHtml(category)}" data-symbol="${escapeHtml(o.symbol)}" data-order-id="${escapeHtml(o.orderId)}" type="button">إلغاء</button></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('.js-cancel').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm(`إلغاء الأمر ${button.dataset.orderId} على ${button.dataset.symbol}؟`)) return;
    try {
      await apiPost({ action: 'cancel-order', category: button.dataset.category, symbol: button.dataset.symbol, orderId: button.dataset.orderId });
      toast('تم إرسال طلب إلغاء الأمر إلى Bybit.');
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

$('connectBtn').addEventListener('click', async () => {
  const token = $('controlToken').value.trim();
  if (!token) return toast('أدخل Control Token أولًا.', 'error');
  controlToken = token;
  try {
    const health = await apiGet('health');
    if (!health.controlReady || !health.authenticated) throw new Error('Bybit control is not ready');
    await apiGet('wallet');
    $('controlToken').value = '';
    showDashboard(true);
    setStatus(true, `متصل · ${health.region || 'Vercel'}`);
    await loadDashboard();
    toast('تم فتح جلسة التحكم بنجاح.');
  } catch (error) {
    controlToken = '';
    setStatus(false, 'فشل الاتصال');
    toast(error.status === 401 ? 'Control Token غير صحيح.' : error.message, 'error');
  }
});

$('disconnectBtn').addEventListener('click', () => {
  controlToken = '';
  lastQuoteTxId = '';
  showDashboard(false);
  setStatus(false, 'غير متصل');
  toast('تم مسح جلسة التحكم من ذاكرة الصفحة.');
});

$('refreshBtn').addEventListener('click', async () => {
  try { await loadDashboard(); toast('تم تحديث بيانات الحساب.'); } catch (error) { toast(error.message, 'error'); }
});
$('reloadOrdersBtn').addEventListener('click', async () => {
  try { await loadOrders(); } catch (error) { toast(error.message, 'error'); }
});

$('orderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formObject(event.currentTarget);
  body.action = 'place-order';
  if (body.orderType === 'Market') delete body.price;
  const summary = `${body.side} ${body.qty} ${body.symbol} · ${body.orderType}${body.price ? ` @ ${body.price}` : ''}`;
  if (!confirm(`تأكيد إرسال الأمر الحقيقي إلى Bybit؟\n\n${summary}`)) return;
  try {
    const result = await apiPost(body);
    toast(`تم إرسال الأمر. ID: ${result.data?.orderId || 'accepted'}`);
    await loadOrders();
  } catch (error) { toast(error.message, 'error'); }
});

$('leverageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'set-leverage', ...formObject(event.currentTarget) };
  if (!confirm(`تحديث Leverage على ${body.symbol} إلى Buy ${body.buyLeverage}x / Sell ${body.sellLeverage}x؟`)) return;
  try { await apiPost(body); toast('تم تحديث Leverage.'); await loadDashboard(); } catch (error) { toast(error.message, 'error'); }
});

$('stopForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'set-trading-stop', ...formObject(event.currentTarget) };
  if (!body.takeProfit && !body.stopLoss && !body.trailingStop) return toast('حدد TP أو SL أو Trailing Stop.', 'error');
  if (!confirm(`تحديث حماية المركز على ${body.symbol}؟`)) return;
  try { await apiPost(body); toast('تم تحديث TP/SL/Trailing Stop.'); await loadDashboard(); } catch (error) { toast(error.message, 'error'); }
});

$('transferForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'transfer', ...formObject(event.currentTarget) };
  if (body.fromAccountType === body.toAccountType) return toast('حساب المصدر والوجهة يجب أن يكونا مختلفين.', 'error');
  if (!confirm(`تحويل ${body.amount} ${body.coin} من ${body.fromAccountType} إلى ${body.toAccountType}؟`)) return;
  try { await apiPost(body); toast('تم إرسال التحويل الداخلي.'); await loadDashboard(); } catch (error) { toast(error.message, 'error'); }
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
      ? `Quote: ${quote.fromCoin || body.fromCoin} ${quote.fromAmount || body.requestAmount} → ${quote.toCoin || body.toCoin} ${quote.toAmount || ''} · Rate ${quote.exchangeRate || '—'}`
      : 'تم استلام Quote ولكن لم يتم العثور على quoteTxId.';
    $('confirmConvertBtn').classList.toggle('hidden', !lastQuoteTxId);
  } catch (error) { toast(error.message, 'error'); }
});

$('confirmConvertBtn').addEventListener('click', async () => {
  if (!lastQuoteTxId) return;
  if (!confirm('تأكيد تنفيذ عملية Convert الحقيقية بهذا الـQuote؟')) return;
  try {
    await apiPost({ action: 'convert-confirm', quoteTxId: lastQuoteTxId, confirm: 'CONVERT' });
    lastQuoteTxId = '';
    $('confirmConvertBtn').classList.add('hidden');
    $('convertQuote').textContent = 'تم تنفيذ Convert.';
    toast('تم تنفيذ Convert.');
    await loadDashboard();
  } catch (error) { toast(error.message, 'error'); }
});

$('cancelAllForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { action: 'cancel-all', ...formObject(event.currentTarget) };
  if (body.confirm !== 'CANCEL_ALL') return toast('اكتب CANCEL_ALL حرفيًا.', 'error');
  if (!confirm(`تأكيد إلغاء كل الأوامر المطابقة في ${body.category}؟`)) return;
  try { await apiPost(body); toast('تم إرسال Cancel All.'); await loadOrders(); } catch (error) { toast(error.message, 'error'); }
});

(async () => {
  try {
    const health = await apiGet('health');
    setStatus(Boolean(health.authenticated && health.controlReady), health.controlReady ? `جاهز · ${health.region || 'Vercel'}` : 'Control Token غير مهيأ');
  } catch { setStatus(false, 'Bybit غير متاح'); }
})();
