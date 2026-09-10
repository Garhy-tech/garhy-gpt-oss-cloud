// Shared browser/server input validation. This module contains no credentials.
export class ValidationError extends Error {
  constructor(message) { super(message); this.code = 'INVALID_INPUT'; this.status = 400; }
}
const invalid = (message) => { throw new ValidationError(message); };
const labels = { symbol:'رمز السوق', qty:'الكمية', price:'السعر', takeProfit:'جني الربح', stopLoss:'وقف الخسارة', trailingStop:'الوقف المتحرك', activePrice:'سعر التفعيل', buyLeverage:'رافعة الشراء', sellLeverage:'رافعة البيع', amount:'المبلغ', requestAmount:'المبلغ', coin:'العملة', fromCoin:'عملة المصدر', toCoin:'عملة الوجهة', orderId:'معرّف الأمر', quoteTxId:'معرّف عرض التحويل' };
export function text(value, name, max = 80) {
  if (typeof value !== 'string' && typeof value !== 'number') invalid(`أدخل ${labels[name] || name}.`);
  const result = String(value).trim();
  if (!result || result.length > max) invalid(`${labels[name] || name} غير صالح.`);
  return result;
}
export function decimal(value, name, zero = false) {
  const valueText = text(value, name, 48);
  if (!/^\d{1,24}(\.\d{1,18})?$/.test(valueText) || (!zero && Number(valueText) <= 0)) invalid(`${labels[name] || name} يجب أن يكون رقمًا ${zero ? 'غير سالب' : 'أكبر من صفر'} دون صيغة أسية.`);
  const [whole, fraction = ''] = valueText.split('.');
  const clean = fraction.replace(/0+$/, '');
  return whole.replace(/^0+(?=\d)/, '') + (clean ? `.${clean}` : '');
}
export function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) invalid(`قيمة ${name} غير مسموحة.`);
  return value;
}
export function symbol(value) {
  const result = text(value, 'symbol', 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(result)) invalid('رمز السوق غير صالح. مثال: BTCUSDT.');
  return result;
}
export function coin(value) {
  const result = text(value, 'coin', 20).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_]{0,19}$/.test(result)) invalid('رمز العملة غير صالح.');
  return result;
}
export const categories = ['spot','linear','inverse','option'];
export const accountTypes = ['UNIFIED','FUND'];
export const convertAccountTypes = ['eb_convert_uta','eb_convert_funding'];
const derivatives = ['linear','inverse'];
const fields = {
  'place-order':['category','symbol','side','orderType','qty','price','takeProfit','stopLoss','marketUnit','positionIdx','timeInForce','reduceOnly','closeOnTrigger'],
  'cancel-order':['category','symbol','orderId','orderLinkId'],
  'cancel-all':['category','symbol','baseCoin','settleCoin','confirm'],
  'set-leverage':['category','symbol','buyLeverage','sellLeverage'],
  'set-trading-stop':['category','symbol','takeProfit','stopLoss','trailingStop','activePrice','positionIdx','tpslMode'],
  'set-position-mode':['category','symbol','mode'],
  transfer:['coin','amount','fromAccountType','toAccountType'],
  'convert-quote':['accountType','fromCoin','toCoin','requestAmount'],
  'convert-confirm':['quoteTxId','confirm'],
};
export const financialActions = Object.keys(fields).filter((action) => action !== 'convert-quote');
export function validateAction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('بيانات الطلب غير صالحة.');
  const action = input.action;
  if (!Object.hasOwn(fields, action)) invalid('العملية غير مدعومة.');
  const allowed = ['action','requestId','confirmed',...fields[action]];
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid('يتضمن الطلب حقولًا غير مدعومة.');
  const data = { action };
  if (fields[action].includes('category')) data.category = enumValue(String(input.category || '').toLowerCase(), action.startsWith('set-') ? derivatives : categories, 'السوق');
  if (fields[action].includes('symbol') && (action !== 'cancel-all' || input.symbol)) data.symbol = symbol(input.symbol);
  if (action === 'place-order') {
    data.side = enumValue(input.side, ['Buy','Sell'], 'الجهة');
    data.orderType = enumValue(input.orderType, ['Market','Limit'], 'نوع الأمر');
    data.qty = decimal(input.qty, 'qty');
    if (data.orderType === 'Limit') data.price = decimal(input.price, 'price');
    if (input.timeInForce) data.timeInForce = enumValue(input.timeInForce, ['GTC','IOC','FOK','PostOnly'], 'مدة الأمر');
    if (data.orderType === 'Market' && data.timeInForce && data.timeInForce !== 'IOC') invalid('أوامر السوق تستخدم IOC فقط.');
    if (data.category === 'spot' && data.orderType === 'Market') data.marketUnit = enumValue(input.marketUnit || 'baseCoin', ['baseCoin'], 'وحدة كمية السوق');
    if (derivatives.includes(data.category)) {
      data.positionIdx = enumValue(Number(input.positionIdx ?? 0), [0,1,2], 'جهة المركز');
      for (const key of ['reduceOnly','closeOnTrigger']) {
        if (input[key] !== undefined) {
          if (typeof input[key] !== 'boolean') invalid(`قيمة ${key} يجب أن تكون منطقية.`);
          data[key] = input[key];
        }
      }
    }
    for (const key of ['takeProfit','stopLoss']) if (input[key] !== undefined && input[key] !== '') data[key] = decimal(input[key], key);
    if ((data.takeProfit || data.stopLoss) && (data.reduceOnly || data.category === 'option' || (data.category === 'spot' && data.orderType !== 'Limit'))) invalid('TP/SL غير مدعوم مع إعدادات هذا الأمر.');
    if (data.takeProfit && data.stopLoss) {
      if ((data.side === 'Buy' && Number(data.takeProfit) <= Number(data.stopLoss)) || (data.side === 'Sell' && Number(data.takeProfit) >= Number(data.stopLoss))) invalid('ترتيب أسعار TP/SL لا يطابق جهة الأمر.');
    }
  } else if (action === 'cancel-order') {
    for (const key of ['orderId','orderLinkId']) if (input[key]) data[key] = text(input[key], key, key === 'orderId' ? 100 : 36);
    if (!data.orderId && !data.orderLinkId) invalid('أدخل معرّف الأمر.');
  } else if (action === 'cancel-all') {
    if (input.confirm !== 'CANCEL_ALL') invalid('اكتب CANCEL_ALL حرفيًا لتأكيد الإلغاء الجماعي.');
    data.confirm = 'CANCEL_ALL';
    for (const key of ['baseCoin','settleCoin']) if (input[key]) data[key] = coin(input[key]);
    if (derivatives.includes(data.category) && !data.symbol && !data.baseCoin && !data.settleCoin) invalid('حدد السوق أو عملة التسوية للأوامر المراد إلغاؤها.');
  } else if (action === 'set-leverage') {
    for (const key of ['buyLeverage','sellLeverage']) {
      data[key] = decimal(input[key], key);
      if (Number(data[key]) < 1 || Number(data[key]) > 1000) invalid('الرافعة يجب أن تكون بين 1 و1000 وضمن حد السوق.');
    }
  } else if (action === 'set-trading-stop') {
    data.positionIdx = enumValue(Number(input.positionIdx ?? 0), [0,1,2], 'جهة المركز');
    data.tpslMode = enumValue(input.tpslMode || 'Full', ['Full'], 'حماية المركز الكامل');
    for (const key of ['takeProfit','stopLoss','trailingStop','activePrice']) if (input[key] !== undefined && input[key] !== '') data[key] = decimal(input[key], key, true);
    if (!['takeProfit','stopLoss','trailingStop'].some((key) => data[key] !== undefined)) invalid('حدد TP أو SL أو الوقف المتحرك. القيمة صفر تلغي الحماية المحددة.');
  } else if (action === 'set-position-mode') {
    data.mode = enumValue(Number(input.mode), [0,3], 'وضع المركز');
  } else if (action === 'transfer') {
    data.coin = coin(input.coin);
    data.amount = decimal(input.amount, 'amount');
    for (const key of ['fromAccountType','toAccountType']) data[key] = enumValue(input[key], accountTypes, 'الحساب');
    if (data.fromAccountType === data.toAccountType) invalid('حساب المصدر والوجهة يجب أن يكونا مختلفين.');
  } else if (action === 'convert-quote') {
    data.accountType = enumValue(input.accountType || 'eb_convert_uta', convertAccountTypes, 'حساب التحويل');
    data.fromCoin = coin(input.fromCoin); data.toCoin = coin(input.toCoin);
    if (data.fromCoin === data.toCoin) invalid('اختر عملتين مختلفتين.');
    data.requestAmount = decimal(input.requestAmount, 'requestAmount');
  } else if (action === 'convert-confirm') {
    data.quoteTxId = text(input.quoteTxId, 'quoteTxId', 120);
    if (input.confirm !== 'CONVERT') invalid('يلزم تأكيد عرض التحويل.');
    data.confirm = 'CONVERT';
  }
  return data;
}
