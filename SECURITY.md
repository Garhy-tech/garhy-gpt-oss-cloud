# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, credential exposure, authentication weakness, or financial-control defect.

Report security findings privately to **security@garhy.tech**. Include the affected component, reproducible steps, impact, and any relevant request or deployment identifier. Do not include production credentials, API keys, session cookies, OTP codes, or customer data.

GARHY TECH will validate the report, contain any active exposure, and coordinate remediation before public disclosure.

## Scope

This policy covers the code and deployment configuration in this repository, including GT CRYPTO APIs server-side API routes, session controls, Bybit V5 integration, web assets, and the Android wrapper.

## Safe testing

Use non-destructive tests. Do not execute real financial operations, exfiltrate data, degrade availability, or bypass account controls during validation.
