function idOf(ad={}) {
  return String(ad.itemId ?? ad.id ?? ad.adId ?? '');
}
function truthy(value) {
  if(value===true || value===1) return true;
  if(typeof value==='string') return /^(?:1|true|yes|promoted|promotion)$/i.test(value.trim());
  return false;
}
export function isExplicitPromotion(ad={}) {
  for(const key of ['isPromoted','promoted','isPromotion','promotion','promotionFlag','isTop']) {
    if(truthy(ad?.[key])) return true;
  }
  for(const key of ['promotionType','adType','rankType','tagType','trafficType']) {
    const value=ad?.[key];
    if(typeof value==='string' && /promot|sponsor/i.test(value)) return true;
  }
  return false;
}
function parseDecimal(value) {
  const text=String(value ?? '').trim();
  if(!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const [whole,fraction='']=text.split('.');
  return {whole,fraction,scale:fraction.length};
}
export function subtractDecimal(value,decrement='0.01') {
  const left=parseDecimal(value),right=parseDecimal(decrement);
  if(!left || !right) return null;
  const scale=Math.max(left.scale,right.scale);
  const toInt=(part)=>BigInt(part.whole+part.fraction.padEnd(scale,'0'));
  const result=toInt(left)-toInt(right);
  if(result<=0n) return null;
  const raw=result.toString().padStart(scale+1,'0');
  return scale===0 ? raw : `${raw.slice(0,-scale)}.${raw.slice(-scale)}`;
}
export function selectFirstNonPromotedCompetitor(list=[],ownItemId='') {
  const own=String(ownItemId || '');
  for(const ad of Array.isArray(list) ? list : []) {
    if(idOf(ad)===own || isExplicitPromotion(ad)) continue;
    const price=ad?.price ?? ad?.premiumPrice ?? ad?.unitPrice;
    if(parseDecimal(price)) return ad;
  }
  return null;
}
export function summarizeAd(ad={}) {
  return {
    itemId:idOf(ad) || null,
    side:ad.side ?? null,
    tokenId:ad.tokenId ?? ad.tokenName ?? null,
    currencyId:ad.currencyId ?? ad.currencyName ?? null,
    price:ad.price ?? ad.premiumPrice ?? ad.unitPrice ?? null,
    nickName:ad.nickName ?? ad.nickname ?? ad.userName ?? ad.user?.nickName ?? null,
  };
}
