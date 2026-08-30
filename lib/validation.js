export const ALLOWED_MODELS = new Set([
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
]);

export const ALLOWED_REASONING = new Set(['low', 'medium', 'high']);

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

export function validateChatInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid JSON body.' };
  }

  const model = body.model ?? 'openai/gpt-oss-20b';
  if (!ALLOWED_MODELS.has(model)) {
    return { ok: false, error: 'Unsupported model.' };
  }

  const reasoning = body.reasoning ?? 'medium';
  if (!ALLOWED_REASONING.has(reasoning)) {
    return { ok: false, error: 'Unsupported reasoning level.' };
  }

  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 20) {
    return { ok: false, error: 'messages must contain between 1 and 20 items.' };
  }

  let totalChars = 0;
  const messages = [];

  for (const message of body.messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return { ok: false, error: 'Invalid message object.' };
    }

    const { role, content } = message;
    if (!ALLOWED_ROLES.has(role)) {
      return { ok: false, error: 'Invalid message role.' };
    }

    if (typeof content !== 'string' || content.trim().length === 0 || content.length > 8000) {
      return { ok: false, error: 'Each message must contain 1-8000 characters.' };
    }

    totalChars += content.length;
    if (totalChars > 16000) {
      return { ok: false, error: 'Conversation is too large.' };
    }

    messages.push({ role, content });
  }

  return { ok: true, value: { model, reasoning, messages } };
}
