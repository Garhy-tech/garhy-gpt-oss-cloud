const SPACE_LIKE = '[\\s\\u00a0\\u1680\\u2000-\\u200a\\u202f\\u205f\\u3000]+';

const GARHY_TECH_PATTERN = new RegExp(`\\bgarhy${SPACE_LIKE}tech\\b`, 'giu');
const ARABIC_GARHY_TECH_PATTERN = new RegExp(`جارهي${SPACE_LIKE}تك`, 'gu');

export function normalizeIdentityReply(value) {
  if (typeof value !== 'string') return value;

  let reply = value
    .normalize('NFC')
    .replace(GARHY_TECH_PATTERN, 'GARHY TECH')
    .replace(ARABIC_GARHY_TECH_PATTERN, 'GARHY TECH')
    .replace(/\bhana\b/giu, 'Hana')
    .replace(/هانا/gu, 'Hana');

  if (/(?:أنا|اسمي|أدعى|Hana)/u.test(reply)) {
    reply = reply
      .replace(/المساعد\s+الذكي/gu, 'المساعدة الذكية')
      .replace(/مساعد\s+ذكي/gu, 'مساعدة ذكية')
      .replace(/المساعد\s+الافتراضي/gu, 'المساعدة الافتراضية')
      .replace(/مساعد\s+افتراضي/gu, 'مساعدة افتراضية')
      .replace(/المساعد\s+الرقمي/gu, 'المساعدة الرقمية')
      .replace(/مساعد\s+رقمي/gu, 'مساعدة رقمية');
  }

  return reply;
}
