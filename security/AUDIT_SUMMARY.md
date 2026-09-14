# Panvas security audit summary

Date: 2026-09-07  
Basis: repository inspection plus the [vibe-check AI checklist](https://github.com/benavlabs/vibe-check/blob/main/AI-CHECKLIST.MD). This is a source audit, not penetration testing or certification.

| # | Category | Result | Evidence / action |
|---|---|---|---|
| 1 | Secrets exposure | PASS | `.env*` is ignored; no environment file is tracked; pattern scan found no embedded private key or common production-key signature. History still needs a dedicated gitleaks scan. |
| 2 | Database access | PASS (source) | Supabase schema enables RLS for every declared table and storage object policy scopes access to `auth.uid()`. Production policy deployment needs manual verification. |
| 3 | Auth middleware | N/A | Panvas has no first-party HTTP API routes. Optional authentication is handled by Supabase SDK. |
| 4 | Access control | PASS (source) | Supabase user-data policies bind reads/writes to `auth.uid()`; local Electron data is device-local. Production RLS needs a live negative test. |
| 5 | Frontend secrets | PASS | Renderer variables are public Supabase anon configuration, PostHog project key, feature flags and a public Google Web client ID. Desktop OAuth secret stays in the main process. |
| 6 | SSRF | ISSUE — MEDIUM | Canvas library import accepts a URL from hash/postMessage before `fetch`; CSP limits reachable origins, but sender/origin and URL validation should be made explicit without breaking the Excalidraw library flow. |
| 7 | CSRF | N/A | No first-party cookie-authenticated HTTP mutation endpoints. Supabase/GIS provider flows are external. |
| 8 | Security headers | FIXED | Added global CSP, HSTS, clickjacking, MIME-sniffing, referrer and permissions headers in `vercel.json`; the document already carries a CSP meta fallback. |
| 9 | CORS | N/A | No first-party API server or CORS middleware exists. External provider CORS is provider-controlled. |
| 10 | Rate limiting | N/A / provider | No first-party auth endpoints. Supabase’s deployed rate-limit configuration must be checked in its dashboard before enabling public accounts. |
| 11 | SQL injection | PASS | Repository database access uses Supabase client methods/Dexie; schema migrations contain static SQL and no user-string interpolation. |
| 12 | XSS | PASS with watch item | Rich-text imports are sanitized before insertion. The marketing ticker injects only a static code-authored style string. Keep sanitizer tests when upgrading TipTap. |
| 13 | Payment webhooks | N/A | No payment provider or webhook implementation found. |
| 14 | File uploads/imports | PASS with limits | Local PDF import validates parseability and enforces 200 MB; backup import validates type, version, structure and relationships; Electron IPC enforces payload bounds. These are local imports, not server uploads. |
| 15 | Error handling | PASS with watch item | Cloud diagnostics and OAuth failures use bounded public messages. Continue avoiding raw provider/file errors in UI surfaces. |
| 16 | Password hashing | N/A | Password handling is delegated to Supabase Auth; Panvas must not claim a specific hashing algorithm. |
| 17 | Dependencies | ISSUE — HIGH | `npm audit --omit=dev` reports 4 high and 43 moderate findings: high transitive `adm-zip`/`sharp` findings under Transformers have no current fix; TipTap and `fflate` have upgrade paths. Upgrade requires focused compatibility testing rather than a forced audit fix. |

## Required follow-up

1. Design and test an allowlist/origin contract for Excalidraw library imports.
2. Upgrade the TipTap package family together and rerun rich-text/XSS tests; assess whether local Transformers can be isolated or replaced until its native transitive advisories are resolved.
3. Run gitleaks against full Git history and manually verify deployed Supabase RLS, auth rate limits, Vercel headers and Google OAuth settings.
