# Panvas Security Testing & Strix Pentest Execution Plan

> **Document Type**: Security Runbook & Penetration Testing Execution Plan  
> **Tool Target**: Strix (Autonomous Penetration Testing Agent) & Static/Dynamic Security Tooling  
> **Audited Repository**: `Panvas` (Local-First Note-Taking & Research Canvas)  
> **Classification**: Internal Security Operations  
> **Last Updated**: 2026-09-09  

---

## 1. Executive Brief & Objectives

Panvas is a hybrid local-first architecture running both as a client-side Web/PWA application (IndexedDB via Dexie) and a native desktop client (Electron with Node.js integration and custom IPC bridges).

This plan establishes a rigorous, structured methodology for deploying **Strix** against the Panvas codebase and deployed environments. The objective is to discover, validate, and remediate:
1. **Renderer-to-Main IPC breakout vectors** in the Electron desktop wrapper.
2. **Local file inclusion (LFI) and path traversal** across custom workspace storage adapters.
3. **Stored Cross-Site Scripting (XSS)** through malformed Excalidraw scene JSON, TipTap rich text, or embedded PDF annotations.
4. **OAuth token interception or leakage** in Google Drive authentication and loopback callback servers.
5. **Content Security Policy (CSP) bypasses** and unauthorized external network exfiltration.

---

## 2. Safety Rules & Isolation Boundaries

Before executing any automated security tooling or Strix agent runs, the following five operational rules **MUST** be strictly observed:

### Rule 1: Zero Production Credentials
- **NEVER** pass real developer or personal Google Drive API credentials, client secrets, or OAuth refresh tokens to Strix.
- Use dedicated **synthetic Google test accounts** created specifically for pentesting.
- Ensure Supabase credentials in local development are set to inert dummy strings (`http://localhost:54321` or synthetic local mock).

### Rule 2: Ephemeral Sandbox & Clean Browser Profiles
- Dynamic tests must execute against a dedicated, isolated browser instance.
- Point Strix browser automation to a clean temporary user data directory (e.g., `--user-data-dir=/tmp/strix-panvas-profile`).
- Prevent access to existing Chrome/Edge cookies, saved passwords, or local history.

### Rule 3: Git Exclusion for Strix Artifacts
- Add the following rule to `.gitignore` before executing any runs:
  ```gitignore
  # Strix Penetration Testing Artifacts
  strix_runs/
  strix_reports/
  .strix/
  *.strix.json
  ```
- Strix generates extensive logs, network traces, payload captures, and proof-of-concept exploits. These must **never** be committed to the repository.

### Rule 4: Synthetic Test Data Only
- Never run Strix against workspaces containing personal notes, research papers, or private documents.
- Initialize the target application with standard synthetic fixtures:
  - 1 Blank Notebook
  - 1 Notebook with 5 TipTap text pages and 3 drawing layers
  - 1 Canvas with 20 basic Excalidraw shapes
  - 1 Sample Open-Access PDF (e.g., standard W3C test PDF)

### Rule 5: Human-in-the-Loop Verification Gate
- Automated security tools produce false positives. **No code modifications or architectural changes may be made based on raw tool output.**
- Every vulnerability flagged by Strix must be manually reproduced and verified following the [Manual Verification Runbook](#6-manual-verification-runbook) before a Jira/GitHub ticket is logged.

---

## 3. High-Priority Target Areas for Strix

```
                                 [ Attacker Payload Vectors ]
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             │                                 │                                 │
             ▼                                 ▼                                 ▼
   [ Vector 1: Desktop IPC ]       [ Vector 2: Canvas / Notes ]       [ Vector 3: PDF Engine ]
   - Path Traversal in IPC         - Malicious Excalidraw JSON        - Malformed PDF Streams
   - Sender Frame Spoofing         - TipTap HTML Injection            - Worker Sandbox Escape
   - shell.openExternal Abuse      - Unescaped KaTeX LaTeX            - Binary Buffer Overflows
             │                                 │                                 │
             └─────────────────────────────────┼─────────────────────────────────┘
                                               │
                                               ▼
                                 [ Vector 4: Google OAuth ]
                                 - Local Callback Port Snooping
                                 - State Parameter Fixation
                                 - Insecure Token Disk Storage
```

### Area 1: Electron IPC Surface & File System Bridges
- **Target Files**:
  - `electron/ipc/domain-handlers.ts`
  - `electron/ipc/knowledge-handlers.ts`
  - `electron/ipc/cloudsync-handlers.ts`
  - `electron/ipc/security.ts`
- **Specific Strix Test Objectives**:
  1. **Sender Validation Bypass**: Probe if an `iframe` with origin `null` (e.g., `data:text/html,...` or `blob:`) can invoke `ipcRenderer.invoke('workspace:delete', ...)` or `ipcRenderer.invoke('cloudsync:connect', ...)`.
  2. **Path Traversal via IDs**: Inject relative traversal sequences (`../../`, `..\..\Windows\System32`) into `workspaceId`, `notebookId`, `pageId`, or `filename` arguments. Verify that `resolveSafePath` or path-joining logic strictly confines writes to the user's `Documents/Panvas/` folder.
  3. **Arbitrary Protocol Execution in `knowledge:openExternal`**: Attempt to pass non-HTTP(S) URIs (e.g., `file:///`, `smb://`, `powershell:`, `cmd:`, `javascript:`) to `shell.openExternal`. Verify that `isAllowedUrl()` strictly permits only `http:` and `https:`.

### Area 2: Google OAuth 2.0 & Token Storage Security
- **Target Files**:
  - `electron/ipc/google-auth-service.ts`
  - `src/services/cloudsync/googleDriveProvider.ts`
- **Specific Strix Test Objectives**:
  1. **Loopback Server Interception**: Test whether a rogue local process running on the host machine can connect to or bind to the ephemeral HTTP server opened by `GoogleAuthService` during desktop OAuth login.
  2. **Encrypted Token Permissiveness**: Check file system permissions on `google_auth_tokens.enc` on Windows (`icacls`), macOS (`ls -la`), and Linux (`chmod`). Ensure permissions restrict access to the executing user account only (`0600`).
  3. **State Parameter Validation**: Test whether the OAuth initiation and callback handlers validate a cryptographically secure random `state` parameter to prevent CSRF authentication hijack.

### Area 3: PDF Parser & Web Worker Isolation
- **Target Files**:
  - `src/services/pdf/`
  - `src/components/pdf/`
  - `public/pdf.worker.min.mjs`
- **Specific Strix Test Objectives**:
  1. **PDF Embedded JavaScript Execution**: Feed PDF test files containing `/JavaScript` and `/Launch` action dictionary entries. Verify that PDF.js disables script execution (`isEvalSupported = false`).
  2. **Worker Sandbox Escape**: Verify that the PDF web worker cannot access `window`, `document`, or DOM objects, and cannot initiate arbitrary network requests outside authorized CSP origins.
  3. **DoS via Polyglot / Zip Bomb PDFs**: Test memory consumption when importing deeply nested, circular, or malformed PDF streams.

### Area 4: Excalidraw Element Sanitization & Canvas Storage
- **Target Files**:
  - `src/components/canvas/CanvasView.tsx`
  - `src/repositories/CanvasRepository.ts`
- **Specific Strix Test Objectives**:
  1. **Stored XSS via Element Link**: Inject `javascript:alert(document.domain)` or `data:text/html;base64,...` into the `link` property of Excalidraw shape elements. Verify clicking the link safely triggers sanitization or refuses navigation.
  2. **Malformed Scene Import**: Import canvas scene JSON containing prototype pollution payloads (`"__proto__": { "polluted": true }`). Confirm object prototypes remain unpolluted.
  3. **Image Element Data URIs**: Paste or import vector/bitmap elements containing embedded SVG with malicious `<script>` tags. Verify SVG sanitization via DOMPurify or equivalent.

### Area 5: Content Security Policy & Storage Boundary Isolation
- **Target Files**:
  - `index.html`
  - `src/config/browserCsp.ts`
  - `src/database/schema.ts`
- **Specific Strix Test Objectives**:
  1. **CSP Injection & Bypass**: Audit `default-src 'self'`, `script-src`, and `connect-src` directives. Verify that no untrusted third-party CDNs (such as unpinned script delivery hosts) can inject arbitrary code.
  2. **IndexedDB Cross-Origin Access**: Verify that if Panvas is hosted on a shared subdomain, IndexedDB databases cannot be accessed or manipulated by adjacent subdomains.

---

## 4. Strix Execution Phases & Recommended Commands

### Phase 1: White-Box Static Analysis (Repository Scan)

Run Strix in code-audit mode over the repository source tree to identify insecure patterns, missing validation, and hardcoded secrets.

```bash
# 1. Ensure working tree is clean and strix_runs is gitignored
echo "strix_runs/" >> .gitignore

# 2. Run Strix Static Code Analysis
strix scan repo \
  --path="./" \
  --exclude="node_modules,dist,dist-electron,build,.git,coverage" \
  --rules="owasp-top-10,cwe-electron,prototype-pollution,path-traversal,hardcoded-secrets" \
  --output="strix_runs/static-analysis-report.json" \
  --format="json,sarif" \
  --severity="medium,high,critical"
```

### Phase 2: Local Dynamic Scan (Web / PWA Target)

Start the local Vite development server and point Strix's dynamic scanning agent at the live interface.

```bash
# Terminal 1: Start local application
npm run dev

# Terminal 2: Run Strix Dynamic Agent against local web instance
strix scan dynamic \
  --url="http://localhost:5173" \
  --browser-headless \
  --browser-user-data-dir="./strix_runs/tmp_browser_profile" \
  --crawl-depth=4 \
  --fuzz-storage \
  --fuzz-inputs \
  --csp-audit \
  --output="strix_runs/dynamic-web-report.json" \
  --exclude-endpoints="/api/auth/logout"
```

### Phase 3: Electron Surface Scan (Desktop IPC & Boundaries)

Test the packaged or staged Electron application for IPC message fuzzing and sender validation.

```bash
# Build desktop assets
npm run build:electron

# Run Strix Electron IPC Fuzzer
strix scan electron \
  --app-dir="./" \
  --preload="./dist-electron/preload.mjs" \
  --main="./dist-electron/main.js" \
  --fuzz-ipc \
  --test-privilege-escalation \
  --output="strix_runs/electron-ipc-report.json"
```

### Phase 4: Staging / Deployed Web Scan

Before public DNS cutover, point Strix at the deployed staging URL to test production headers, TLS, and CSP enforcement.

```bash
strix scan web \
  --url="https://staging.panvas.org" \
  --audit-headers \
  --audit-tls \
  --audit-csp \
  --rate-limit=10 \
  --output="strix_runs/staging-web-report.json"
```

---

## 5. Required `.gitignore` Configuration

Ensure the following block is present in `.gitignore` before triggering any scan:

```gitignore
# ==========================================
# Security Testing & Penetration Test Dumps
# ==========================================
strix_runs/
strix_reports/
.strix/
*.strix.json
*.sarif
*.pcap
*.har
strix-debug.log
```

---

## 6. Manual Verification Runbook

Every finding reported by Strix **must** pass through the following 4-step manual triage pipeline before code is written:

```
[ Strix Finding Reported ]
           │
           ▼
[ Step 1: Isolate & Reproduce ] ──▶ Did finding reproduce with curl / devtools?
           │ (NO) ──▶ Close as Scanner Noise / False Positive
           ▼ (YES)
[ Step 2: Exploitability Check ] ──▶ Can attacker leverage this without local admin?
           │ (NO) ──▶ Downgrade to Informational / P2
           ▼ (YES)
[ Step 3: CVSS 3.1 Scoring ] ──▶ Assign Severity (Critical, High, Medium, Low)
           │
           ▼
[ Step 4: Add to RELEASE_HARDENING_BACKLOG.md ] ──▶ Assign HARDEN-XXX ID
```

### Step 1: Isolate & Reproduce
1. Extract the exact HTTP request, IPC message, or input string from the Strix report.
2. Open an incognito browser window or a standalone Electron session with DevTools enabled.
3. Manually execute the payload. Record whether the application:
   - Throws an unhandled exception or crashes.
   - Executes arbitrary JavaScript in the context of the origin.
   - Reads or writes files outside the designated workspace directory.

### Step 2: Exploitability Assessment
- **False Positive Indicator**: The tool flags that a secret exists, but inspection reveals it is a public OAuth Client ID (which is designed to be public) or a synthetic test mock.
- **True Positive Indicator**: Passing `../../etc/passwd` or `..\..\Windows\win.ini` to a file-read IPC handler causes the host to read data outside `Documents/Panvas/`.

### Step 3: CVSS 3.1 Scoring Matrix
- **Critical (9.0 - 10.0)**: Remote code execution (RCE), unauthenticated renderer-to-main Electron breakout, or arbitrary remote file deletion.
- **High (7.0 - 8.9)**: Stored XSS via Excalidraw element link, unvalidated IPC sender allowing token exfiltration, or silent workspace data loss.
- **Medium (4.0 - 6.9)**: Missing CSP directive, clickjacking on landing page, denial of service via memory-heavy PDF parsing.
- **Low (0.1 - 3.9)**: Verbose error stack traces in console logs, lack of Subresource Integrity (SRI) on static assets with strong CSP.

---

## 7. CI / Nightly Scan Strategy

To prevent security regressions after release, integrate Strix into the GitHub Actions automated workflow:

### Recommended Workflow: `.github/workflows/security-nightly.yml`

```yaml
name: Security Nightly Scan

on:
  schedule:
    # Run every night at 02:00 UTC
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  strix-security-audit:
    name: Strix Static & Boundary Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Application
        run: npm run build

      - name: Run Strix Security Action
        uses: strix-agent/strix-action@v1
        with:
          scan-type: 'repo'
          path: './'
          fail-on: 'critical'
          sarif-output: 'strix_runs/results.sarif'
        env:
          STRIX_API_KEY: ${{ secrets.STRIX_API_KEY }}

      - name: Upload SARIF to GitHub Security Tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'strix_runs/results.sarif'
```

---

## 8. Summary of Pre-Release Checklist for Strix

| Task | Priority | Status | Verification Check |
|---|:---:|:---:|---|
| Ensure `.gitignore` contains `strix_runs/` | High | Required | Verify `git status` ignores run folder |
| Setup isolated browser profile | High | Required | Clean cache and history directory |
| Validate zero live credentials in configs | Critical | Required | Grep for private keys, production tokens |
| Run Phase 1 (Static Codebase Scan) | High | Ready | SARIF report output generated |
| Run Phase 3 (Electron IPC Scan) | High | Ready | Test `requireTrustedSender` validation |
| Triage all findings through manual runbook | Critical | Required | Human sign-off on every reported CVE |

