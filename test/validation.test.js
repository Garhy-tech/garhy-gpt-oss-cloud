import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChatInput } from '../lib/validation.js';

test('accepts a valid 20b request', () => {
  const result = validateChatInput({
    model: 'openai/gpt-oss-20b',
    reasoning: 'medium',
    messages: [{ role: 'user', content: 'Hello' }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.model, 'openai/gpt-oss-20b');
});

test('accepts a valid 120b request', () => {
  const result = validateChatInput({
    model: 'openai/gpt-oss-120b',
    reasoning: 'high',
    messages: [{ role: 'user', content: 'Solve this.' }],
  });
  assert.equal(result.ok, true);
});

test('rejects an unsupported model', () => {
  const result = validateChatInput({
    model: 'other/model',
    messages: [{ role: 'user', content: 'Hello' }],
  });
  assert.equal(result.ok, false);
});

test('rejects an oversized conversation', () => {
  const result = validateChatInput({
    messages: [
      { role: 'user', content: 'a'.repeat(8000) },
      { role: 'assistant', content: 'b'.repeat(8000) },
      { role: 'user', content: 'c' },
    ],
  });
  assert.equal(result.ok, false);
});
