import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../gt-bybit/app.js',import.meta.url),'utf8');

test('notification preference is explicit, persistent and only disabled manually',()=>{
  assert.match(source,/NOTIFICATION_ON='enabled'/);
  assert.match(source,/NOTIFICATION_OFF='disabled'/);
  assert.match(source,/notificationPreference\(\)!==NOTIFICATION_OFF/);
  assert.match(source,/persistNotificationPreference\(NOTIFICATION_OFF\)/);
  assert.match(source,/persistNotificationPreference\(NOTIFICATION_ON\)/);
  assert.doesNotMatch(source,/localStorage\.removeItem\(NOTIFICATION_PREF\)/);
});

test('notification permission and cross-tab state changes refresh the UI',()=>{
  assert.match(source,/permissions\.query\(\{name:'notifications'\}\)/);
  assert.match(source,/addEventListener\('storage'/);
  assert.match(source,/addEventListener\('visibilitychange'/);
  assert.match(source,/addEventListener\('focus'/);
});
