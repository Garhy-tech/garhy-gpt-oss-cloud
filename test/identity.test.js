import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeIdentityReply } from '../lib/identity.js';

test('normalizes brand spacing and feminine Arabic identity', () => {
  const response = 'أنا Hana، المساعد الذكي لـ GARHY TECH.';
  const normalized = normalizeIdentityReply(response);

  assert.match(normalized, /أنا Hana/);
  assert.match(normalized, /المساعدة الذكية/);
  assert.match(normalized, /GARHY TECH/);
  assert.doesNotMatch(normalized, /المساعد الذكي|GARHY TECH/);
});

test('replaces Arabic transliterations with the official names', () => {
  const normalized = normalizeIdentityReply('أنا هانا مساعدة جارهي تك الذكية');

  assert.equal(normalized, 'أنا Hana مساعدة GARHY TECH الذكية');
  assert.doesNotMatch(normalized, /هانا|جارهي\s+تك/);
});

test('preserves non identity content', () => {
  const response = 'استخدم المساعد الذكي داخل مشروعك';

  assert.equal(normalizeIdentityReply(response), response);
});
