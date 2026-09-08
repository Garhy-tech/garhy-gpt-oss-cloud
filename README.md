# GARHY AI / HANA

Canonical GARHY AI source repository for the GARHY ecosystem.

## Production mapping

- Product: GARHY AI / HANA
- Vercel project: `garhy-gpt-oss-cloud`
- Canonical domains: `garhy.ai`, `www.garhy.ai`
- GT BYBIT is being separated to its own standalone Vercel project and canonical domain `bybit.garhy.tech`.

## Deployment

The repository is connected to the existing Vercel project. Pushes to `main` are expected to create Production deployments.

## Security

- API keys remain server-side.
- Same-origin POST protection.
- Model and reasoning allowlists.
- Payload/message size limits.
- Basic serverless-instance rate limiting.
- No-store API responses and security headers.

## Models

- `openai/gpt-oss-20b`
- `openai/gpt-oss-120b`

Reasoning: `low`, `medium`, `high`.
