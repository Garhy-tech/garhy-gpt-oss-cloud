import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('the public interface preserves Hana as the product identity', () => {
  assert.match(index, /<title>Hana · GARHY TECH<\/title>/);
  assert.match(index, /مرحبًا، أنا Hana، مساعدة GARHY TECH الذكية/);
  assert.doesNotMatch(index, /GROQ_API_KEY|Groq Cloud API|Environment Variable/i);
});

test('the interface exposes branded metadata and PWA assets', () => {
  assert.match(index, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(index, /property="og:image" content="https:\/\/garhy-gpt-oss-cloud\.vercel\.app\/assets\/og-hana\.jpg"/);
  assert.equal(existsSync(new URL('../assets/og-hana.jpg', import.meta.url)), true);
  assert.equal(existsSync(new URL('../assets/icon-512.webp', import.meta.url)), true);
  assert.equal(existsSync(new URL('../manifest.webmanifest', import.meta.url)), true);
});

test('the media rail includes all ten optimized editorial assets', () => {
  for (const file of ['01-6713', '02-6754', '03-6743', '04-6750', '05-6756', '06-6761', '07-6762', '08-6763', '09-6733', '10-6732']) {
    assert.equal(index.includes('/assets/media/' + file + '-640.webp'), true);
    assert.equal(existsSync(new URL('../assets/media/' + file + '-640.webp', import.meta.url)), true);
    assert.equal(existsSync(new URL('../assets/media/' + file + '-960.webp', import.meta.url)), true);
  }
  assert.equal(app.includes('cloneNode(true)'), true);
  assert.equal(app.includes('translate3d'), true);
  assert.equal(app.includes('prefers-reduced-motion'), true);
});

test('the advanced controls preserve the backend model and reasoning contract', () => {
  assert.match(index, /value="openai\/gpt-oss-20b"/);
  assert.match(index, /value="openai\/gpt-oss-120b"/);
  assert.match(index, /value="low"/);
  assert.match(index, /value="medium"/);
  assert.match(index, /value="high"/);
  assert.match(app, /credentials: 'same-origin'/);
});
