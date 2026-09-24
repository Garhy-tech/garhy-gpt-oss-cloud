import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootIndex = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const gtBybitCompat = readFileSync(new URL('../gt-bybit/index.html', import.meta.url), 'utf8');
const gtBybitIndex = readFileSync(new URL('../gt-bybit-app/gt-bybit/index.html', import.meta.url), 'utf8');
const gtBybitApp = readFileSync(new URL('../gt-bybit-app/gt-bybit/app.js', import.meta.url), 'utf8');
const hanaIndex = readFileSync(new URL('../hana-ai-pro/index.html', import.meta.url), 'utf8');

test('repository root and compatibility route forward to the canonical GT.BYBIT app', () => {
  assert.match(rootIndex, /<title>GT\.BYBIT<\/title>/);
  assert.match(rootIndex, /noindex,nofollow,noarchive/);
  assert.match(rootIndex, /location\.replace\('\/gt-bybit\/'\)/);

  assert.match(gtBybitCompat, /<title>GT\.BYBIT<\/title>/);
  assert.match(gtBybitCompat, /noindex,nofollow,noarchive/);
  assert.match(gtBybitCompat, /location\.replace\('\/gt-bybit-app\/gt-bybit\/'\)/);
});

test('the canonical GT.BYBIT interface preserves secure control and confirmation surfaces', () => {
  assert.match(gtBybitIndex, /<title>GT\.BYBIT<\/title>/);
  assert.match(gtBybitIndex, /GARHY TECH/);
  assert.match(gtBybitIndex, /id="authGate"/);
  assert.match(gtBybitIndex, /id="controlToken"/);
  assert.match(gtBybitIndex, /id="secureApp"/);
  assert.match(gtBybitIndex, /id="sessionClock"/);
  assert.match(gtBybitIndex, /id="notificationBtn"/);
  assert.match(gtBybitIndex, /id="confirmDialog"/);
  assert.match(gtBybitIndex, /id="confirmationTyped"/);
  assert.match(gtBybitIndex, /id="confirmAccept"/);
  assert.match(gtBybitApp, /credentials:\s*['"]same-origin['"]/);
});

test('the canonical GT.BYBIT interface remains private from search indexing', () => {
  assert.match(gtBybitIndex, /noindex,nofollow,noarchive/);
  assert.match(gtBybitIndex, /rel="manifest"/);
  assert.match(gtBybitIndex, /dir="rtl"/);
});

test('Hana AI Pro preserves its current production identity and public metadata', () => {
  assert.match(hanaIndex, /<title>Hana AI Pro — Professional Engineering AI by GARHY TECH<\/title>/);
  assert.match(hanaIndex, /rel="canonical" href="https:\/\/garhy\.ai\/" \/>/);
  assert.match(hanaIndex, /property="og:title" content="Hana AI Pro — GARHY TECH"/);
  assert.match(hanaIndex, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(hanaIndex, /class="skip-link"/);
  assert.match(hanaIndex, /id="chatForm"/);
  assert.match(hanaIndex, /id="auditForm"/);
  assert.match(hanaIndex, /id="accountDialog"/);
});

test('Hana AI Pro public page remains indexable while auth/control routes use explicit app protections', () => {
  assert.match(hanaIndex, /name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/);
  assert.match(hanaIndex, /aria-live="polite"/);
  assert.match(hanaIndex, /aria-busy="false"/);
});
