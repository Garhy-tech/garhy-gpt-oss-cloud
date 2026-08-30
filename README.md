# GARHY GPT-OSS Cloud — Groq

Production-ready lightweight Vercel app for testing `openai/gpt-oss-20b` and `openai/gpt-oss-120b` through the Groq OpenAI-compatible API.

## Environment variable

Set `GROQ_API_KEY` in Vercel for Production, then redeploy.

## Security

- API key stays server-side.
- Same-origin POST protection.
- Model and reasoning allowlists.
- Payload/message size limits.
- Basic serverless-instance rate limiting.
- No-store API responses and security headers.

## Models

- `openai/gpt-oss-20b`
- `openai/gpt-oss-120b`

Reasoning: `low`, `medium`, `high`.
