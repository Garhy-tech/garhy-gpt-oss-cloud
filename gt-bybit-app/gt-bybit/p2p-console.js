const API = '/api/p2p';
const POLL_MS = 30000;

let controlToken = '';
let pollTimer = null;
let knownPendingIds = new Set();
let initializedPendingSnapshot = false;

const $ = (id) => document.getElementById(id);

function toast(message, kind = 'info') {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast show ${kind === 'error' ? 'error' : kind === 'success' ? 'success' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = 'toast'; }, 4200);
}

function setState(state, text) {
  $('serviceState').dataset.state = state;
  $('serviceState').querySelector('b').textContent = text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formObject(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value).trim()]));
}

async function request(payload) {
  if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت.');
  if (!controlToken) throw new Error('جلسة P2P مقفلة.');
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${controlToken}`,
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function extractList(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

function firstValue(object, keys, fallback = '—') {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function formatTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return String(value || '—');
  const ms = n < 1e12 ? n * 1000 : n;
  try { return new Date(ms).toLocaleString('ar-EG'); } catch { return String(value); }
}

function renderPending(payload) {
  const list = extractList(payload);
  $('mPending').textContent = String(list.length);
  if (!list.length) {
    $('pendingTable').innerHTML = '<div class="empty">لا توجد Pending Orders حاليًا.</div>';
    handlePendingNotifications([]);
    return;
  }

  $('pendingTable').innerHTML = `<table><thead><tr><th>Order</th><th>Side</th><th>Token</th><th>Fiat</th><th>Amount</th><th>Price</th><th>Status</th></tr></thead><tbody>${list.map((order) => {
    const id = firstValue(order, ['orderId', 'id']);
    const side = firstValue(order, ['side', 'orderType']);
    const token = firstValue(order, ['tokenId', 'tokenName', 'coin']);
    const fiat = firstValue(order, ['currencyId', 'currencyName', 'fiat']);
    const amount = firstValue(order, ['amount', 'quantity', 'notifyTokenQuantity']);
    const price = firstValue(order, ['price', 'notifyUnitPrice']);
    const status = firstValue(order, ['status', 'orderStatus']);
    return `<tr><td>${escapeHtml(id)}</td><td>${escapeHtml(side)}</td><td>${escapeHtml(token)}</td><td>${escapeHtml(fiat)}</td><td>${escapeHtml(amount)}</td><td>${escapeHtml(price)}</td><td>${escapeHtml(status)}</td></tr>`;
  }).join('')}</tbody></table>`;

  handlePendingNotifications(list);
}

function renderAds(payload) {
  const list = extractList(payload);
  $('mAds').textContent = String(list.length);
  if (!list.length) {
    $('adsTable').innerHTML = '<div class="empty">لا توجد إعلانات قابلة للعرض أو الصلاحية لم تُفتح بعد.</div>';
    return;
  }
  $('adsTable').innerHTML = `<table><thead><tr><th>Ad ID</th><th>Side</th><th>Token</th><th>Fiat</th><th>Price</th><th>Min</th><th>Max</th><th>Status</th></tr></thead><tbody>${list.map((ad) => `<tr>
    <td>${escapeHtml(firstValue(ad, ['itemId', 'id']))}</td>
    <td>${escapeHtml(firstValue(ad, ['side']))}</td>
    <td>${escapeHtml(firstValue(ad, ['tokenId', 'tokenName']))}</td>
    <td>${escapeHtml(firstValue(ad, ['currencyId', 'currencyName']))}</td>
    <td>${escapeHtml(firstValue(ad, ['price']))}</td>
    <td>${escapeHtml(firstValue(ad, ['minAmount', 'minQuote']))}</td>
    <td>${escapeHtml(firstValue(ad, ['maxAmount', 'maxQuote']))}</td>
    <td>${escapeHtml(firstValue(ad, ['status']))}</td>
  </tr>`).join('')}</tbody></table>`;
}

function handlePendingNotifications(list) {
  const ids = new Set(list.map((order) => String(firstValue(order, ['orderId', 'id'], ''))).filter(Boolean));
  if (!initializedPendingSnapshot) {
    knownPendingIds = ids;
    initializedPendingSnapshot = true;
    return;
  }
  const newIds = [...ids].filter((id) => !knownPendingIds.has(id));
  knownPendingIds = ids;
  if (!newIds.length || !('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification('GT.BYBIT · طلب P2P جديد', {
    body: `${newIds.length} طلب Pending جديد يحتاج متابعة.`,
    icon: '/assets/gt-bybit/icon-192.png',
    tag: 'gt-bybit-p2p-pending',
  });
}

function renderObjectDetail(data) {
  if (!data || typeof data !== 'object') return '<div class="empty">لا توجد تفاصيل.</div>';
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== undefined && value !== '' && typeof value !== 'object').slice(0, 30);
  if (!entries.length) return '<div class="empty">لا توجد تفاصيل قابلة للعرض.</div>';
  return `<dl>${entries.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(/time|date/i.test(key) ? formatTime(value) : value)}</dd></div>`).join('')}</dl>`;
}

function renderMessages(payload) {
  const list = extractList(payload);
  if (!list.length) {
    $('chatMessages').innerHTML = '<div class="empty">لا توجد رسائل أو لم يتم السماح بقراءة المحادثة بعد.</div>';
    return;
  }
  $('chatMessages').innerHTML = list.map((message) => {
    const author = firstValue(message, ['nickName', 'senderNickName', 'senderName', 'fromUserId'], 'P2P');
    const text = firstValue(message, ['message', 'content', 'msg'], '');
    const time = firstValue(message, ['createDate', 'createTime', 'timestamp'], '');
    return `<div class="message"><strong>${escapeHtml(author)} · ${escapeHtml(formatTime(time))}</strong><span>${escapeHtml(text)}</span></div>`;
  }).join('');
}

async function checkStatus() {
  try {
    const result = await request({ action: 'status' });
    $('mApi').textContent = 'متاح';
    $('mApiSub').textContent = 'P2P Open API active';
    $('capabilityText').textContent = 'P2P Open API متاح للحساب. المراقبة الآلية تعمل، والعمليات الحساسة ما زالت يدوية.';
    $('permissionAlert').classList.add('hidden');
    setState('ok', 'P2P متصل');
    return result;
  } catch (error) {
    $('mApi').textContent = 'مغلق';
    $('mApiSub').textContent = error.data?.retCode ? `Bybit retCode ${error.data.retCode}` : 'Awaiting permissions';
    $('capabilityText').textContent = 'التطبيق جاهز، لكن Bybit لم تفتح صلاحيات P2P Open API للمفتاح بعد.';
    $('permissionAlert').classList.remove('hidden');
    setState('error', 'P2P غير متاح');
    throw error;
  }
}

async function refreshPending(showToast = false) {
  const result = await request({ action: 'pending-orders', page: 1, size: 50 });
  renderPending(result);
  if (showToast) toast('تم تحديث Pending Orders.', 'success');
  return result;
}

async function refreshAds(showToast = false) {
  const result = await request({ action: 'my-ads', page: 1, size: 50 });
  renderAds(result);
  if (showToast) toast('تم تحديث إعلانات P2P.', 'success');
  return result;
}

async function refreshAll(showToast = false) {
  if (!controlToken) return;
  try {
    await checkStatus();
    await Promise.all([refreshPending(false), refreshAds(false)]);
    $('mSync').textContent = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    if (showToast) toast('تمت مزامنة P2P بنجاح.', 'success');
  } catch (error) {
    $('mPending').textContent = '—';
    $('mAds').textContent = '—';
    $('pendingTable').innerHTML = '<div class="empty">بانتظار تفعيل صلاحيات P2P من Bybit.</div>';
    $('adsTable').innerHTML = '<div class="empty">بانتظار تفعيل صلاحية Advertising من Bybit.</div>';
    if (showToast) toast(error.message, 'error');
  }
}

function startPolling() {
  stopPolling();
  if (!$('autoRefresh').checked || !controlToken) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) refreshAll(false);
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function unlock() {
  $('authGate').classList.add('hidden');
  $('console').classList.remove('hidden');
  startPolling();
}

function logout(message = 'تم تسجيل الخروج ومسح Control Token من ذاكرة الصفحة.') {
  controlToken = '';
  knownPendingIds = new Set();
  initializedPendingSnapshot = false;
  stopPolling();
  $('controlToken').value = '';
  $('console').classList.add('hidden');
  $('authGate').classList.remove('hidden');
  setState('idle', 'مقفلة');
  toast(message);
}

async function connect() {
  const token = $('controlToken').value.trim();
  if (!token) return toast('أدخل Control Token أولًا.', 'error');
  controlToken = token;
  $('connectBtn').disabled = true;
  $('connectBtn').textContent = 'جارٍ التحقق…';
  try {
    await checkStatus();
    $('controlToken').value = '';
    unlock();
    await refreshAll(false);
    toast('تم فتح جلسة P2P بنجاح.', 'success');
  } catch (error) {
    if (error.status === 401) {
      controlToken = '';
      setState('error', 'Token غير صحيح');
      toast('Control Token غير صحيح.', 'error');
    } else {
      $('controlToken').value = '';
      unlock();
      toast('تم فتح الواجهة، لكن صلاحيات P2P ما زالت مغلقة من Bybit.', 'error');
    }
  } finally {
    $('connectBtn').disabled = false;
    $('connectBtn').textContent = 'فتح جلسة P2P';
  }
}

$('connectBtn').addEventListener('click', connect);
$('controlToken').addEventListener('keydown', (event) => { if (event.key === 'Enter') connect(); });
$('logoutBtn').addEventListener('click', () => logout());
$('refreshBtn').addEventListener('click', () => refreshAll(true));
$('pendingRefresh').addEventListener('click', async () => {
  try { await refreshPending(true); } catch (error) { toast(error.message, 'error'); }
});
$('adsRefresh').addEventListener('click', async () => {
  try { await refreshAds(true); } catch (error) { toast(error.message, 'error'); }
});
$('autoRefresh').addEventListener('change', () => {
  startPolling();
  toast($('autoRefresh').checked ? 'تم تشغيل المراقبة كل 30 ثانية.' : 'تم إيقاف المراقبة الآلية.');
});

$('notifyBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return toast('المتصفح لا يدعم الإشعارات.', 'error');
  const permission = await Notification.requestPermission();
  toast(permission === 'granted' ? 'تم تفعيل إشعارات الطلبات الجديدة.' : 'لم يتم السماح بالإشعارات.', permission === 'granted' ? 'success' : 'error');
});

$('orderLookupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { orderId } = formObject(event.currentTarget);
  try {
    const [detail, counterparty, messages] = await Promise.all([
      request({ action: 'order-detail', orderId }),
      request({ action: 'counterparty-info', orderId }).catch(() => ({ data: null })),
      request({ action: 'messages', orderId, size: 30, lastId: 0 }).catch(() => ({ data: [] })),
    ]);
    const combined = {
      ...(detail.data && typeof detail.data === 'object' ? detail.data : {}),
      counterparty: counterparty.data && typeof counterparty.data === 'object' ? JSON.stringify(counterparty.data) : undefined,
    };
    $('orderDetail').innerHTML = renderObjectDetail(combined);
    renderMessages(messages);
    $('messageForm').elements.orderId.value = orderId;
    $('paidForm').elements.orderId.value = orderId;
    $('releaseForm').elements.orderId.value = orderId;
    toast('تم تحميل تفاصيل الطلب.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('messageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formObject(event.currentTarget);
  if (!body.orderId || !body.message) return;
  try {
    await request({ action: 'send-message', orderId: body.orderId, message: body.message, contentType: 'str' });
    event.currentTarget.elements.message.value = '';
    const messages = await request({ action: 'messages', orderId: body.orderId, size: 30, lastId: 0 });
    renderMessages(messages);
    toast('تم إرسال الرسالة عبر Bybit P2P.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('paidForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formObject(event.currentTarget);
  if (body.confirm !== 'P2P_PAID') return toast('اكتب P2P_PAID حرفيًا للتأكيد.', 'error');
  if (!confirm(`تأكيد Mark as Paid للطلب ${body.orderId}؟\nنفّذ فقط إذا كنت قد أرسلت الدفع بالفعل.`)) return;
  try {
    await request({ action: 'mark-paid', orderId: body.orderId, paymentType: body.paymentType, confirm: 'P2P_PAID' });
    toast('تم إرسال Mark as Paid إلى Bybit.', 'success');
    event.currentTarget.elements.confirm.value = '';
    await refreshAll(false);
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('releaseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formObject(event.currentTarget);
  if (body.confirm !== 'RELEASE_P2P') return toast('اكتب RELEASE_P2P حرفيًا للتأكيد.', 'error');
  if (!confirm(`تحذير: سيتم Release للأصول في الطلب ${body.orderId}.\n\nلا تؤكد إلا بعد التحقق الفعلي من وصول الأموال خارج Bybit عند الحاجة.`)) return;
  try {
    await request({ action: 'release', orderId: body.orderId, confirm: 'RELEASE_P2P' });
    toast('تم إرسال Release Assets إلى Bybit.', 'success');
    event.currentTarget.elements.confirm.value = '';
    await refreshAll(false);
  } catch (error) {
    toast(error.message, 'error');
  }
});

function updateConnectivity() {
  $('offlineBanner').classList.toggle('hidden', navigator.onLine);
  if (!navigator.onLine) setState('error', 'Offline');
  else if (controlToken) setState('ok', 'جلسة مفتوحة');
}

window.addEventListener('online', () => { updateConnectivity(); if (controlToken) refreshAll(false); });
window.addEventListener('offline', updateConnectivity);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && controlToken && $('autoRefresh').checked) refreshAll(false);
});

updateConnectivity();
