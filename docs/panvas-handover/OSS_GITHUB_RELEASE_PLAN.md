# Panvas Open Source & GitHub Release Plan

*Document Version: 1.0.0 — Authoritative Open-Source Distribution Plan*  
*Date: September 10, 2026*  
*Status: READY FOR EXECUTION*  
*Target Release: Panvas v1.0.0 (Open Source Public Launch)*

---

## 1. Executive Summary & OSS Philosophy

Panvas is an open-source, local-first research workspace and visual note-taking application licensed under the **MIT License**.

This plan outlines the complete operational procedure for preparing the repository for public GitHub visibility, establishing community contribution standards, verifying license compliance, automating continuous integration, and releasing signed production assets.

---

## 2. Legal Hygiene & Third-Party Attribution

### 2.1 Primary License (MIT)
Panvas source code is licensed under the permissive MIT License.
- Root repository file: `LICENSE` (MIT License text with copyright 2026 Panvas contributors).
- `package.json`: `"license": "MIT"`.

### 2.2 Attribution Boundary: Direct Dependencies vs. Conceptual Inspirations

> [!IMPORTANT]
> **Strict Legal & Conceptual Boundary Guidelines**:
>
> 1. **Direct Codebase Dependencies**:
>    - **Excalidraw** (`@excalidraw/excalidraw`): Direct open-source dependency (MIT License). Must be included in `THIRD_PARTY_NOTICES.md` with copyright notice and license text.
>    - **TipTap** (`@tiptap/*`): Direct rich text engine dependency (MIT License).
>    - **PDF.js** (`pdfjs-dist`): Direct PDF parsing/rendering dependency (Apache-2.0 License).
>    - **Dexie.js** (`dexie`): Direct IndexedDB wrapper dependency (Apache-2.0 License).
>    - **Lucide Icons** (`lucide-react`): Direct icon dependency (ISC License).
>
> 2. **Conceptual / Product Design Inspirations (NO CODE SHARED)**:
>    - **Joplin**: Conceptual inspiration for local-first markdown note organization and multi-folder library hierarchy.
>    - **Xournal++**: Conceptual inspiration for digital pen stroke smoothing, paper templates, and PDF annotation workflows.
>    - **FreeNotes**: Conceptual inspiration for visual note cards and freeform multi-modal note-taking.
>
> **Public Attribution Policy**: Panvas respectfully acknowledges Joplin, Xournal++, and FreeNotes in documentation and README under *"Inspirations & Acknowledgements"*. However, documentation must explicitly clarify that **Panvas is an independent codebase and is NOT a fork, derivative work, or affiliated project of Joplin, Xournal++, or FreeNotes.**

### 2.3 `THIRD_PARTY_NOTICES.md` Structure
A dedicated `THIRD_PARTY_NOTICES.md` file must be placed in the repository root documenting all bundled open-source software:
- Package Name & Version
- Upstream Author / Organization
- SPDX License Identifier
- Full License Text

---

## 3. Repository Hygiene & Secret Sanitization

Before transitioning the GitHub repository to public status, execute the following sanitization protocol:

### 3.1 Credential & Token Audit
- [ ] Verify zero API keys or service secrets are hardcoded in source files.
- [ ] Scan history for Supabase JWT tokens, Discord bot tokens, Google OAuth client secrets, or private keys.
- [ ] Ensure `.env`, `.env.local`, `.env.production` are strictly ignored by `.gitignore`.

### 3.2 Scratch Scripts & Temporary Files Purge
- [ ] Delete all exploratory test scripts from working tree (`scratch/test_*.mjs`, `audit_*.mjs`).
- [ ] Ensure local workspace vaults (`Documents/Panvas/`, `.panvas/`) are excluded from Git.
- [ ] Ensure build artifacts (`dist/`, `release/`, `build/`) are excluded from Git.

### 3.3 Verified `.gitignore` Configuration
```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Production Build Outputs
dist/
dist-electron/
release/
build/
*.asar

# Local User Data & Notes Vaults
.panvas/
*.panvas
Documents/Panvas/
test-vault/

# Environment Variables & Secrets
.env
.env.local
.env.*.local
*.pem
*.key

# Logs & Debug
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS & Editor Metadata
.DS_Store
Thumbs.db
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/
```

---

## 4. Community Governance & Contribution Standards

The following documentation files must exist in the root repository before public release:

### 4.1 Public `README.md`
- **Header**: Official logo, project tagline, build status badge, license badge (MIT).
- **Core Features**:
  - Multi-Workspace & Hierarchical Library
  - Hybrid Notebook Engine (TipTap Rich Text + Catmull-Rom Vector Inking)
  - Dedicated PDF Workspace & In-Document Annotations
  - Infinite Visual Canvas (Excalidraw 0.17.6 + LaTeX + UI Mockups)
  - Media Handling (Universal Drag & Drop, Audio Voice Notes)
  - Local-First Persistence (`.panvas/` JSON files) & Optional Google Drive Sync
- **Quickstart**: Installation steps, development commands (`npm install`, `npm start`, `npx tsc -b`).
- **Architecture Overview**: Brief breakdown of Electron Main vs. Renderer process, IPC bridge, and Repository layer.
- **Roadmap & Scope**: Clear indication of V1 (Foundation + Reliability) vs. V2 (Knowledge Canvas) vs. V3 (Extensibility + Intelligence).
- **Acknowledgements**: Respectful shout-out to Excalidraw, Joplin, Xournal++, and FreeNotes.
- **License**: MIT License summary.

### 4.2 `CONTRIBUTING.md`
- Code of Conduct reference.
- Setting up the local development environment.
- Branching conventions: `main` (stable), `develop` (in-flight), `feature/*`, `fix/*`.
- Commit message standards (Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Quality checks before PR submission: `npx tsc -b`, `npm run build`, `npm test`.

### 4.3 `SECURITY.md`
- Security policy and supported versions (v1.x).
- Reporting a vulnerability: Private reporting via GitHub Security Advisories (https://github.com/sumitahmed/Panvas/security/advisories).
- Response handling: Reports will be reviewed and triaged as promptly as practical.

### 4.4 `CODE_OF_CONDUCT.md`
- Standard Contributor Covenant v2.1 text.

### 4.5 GitHub Issue & PR Templates
- `.github/ISSUE_TEMPLATE/bug_report.md`: Structured form requesting OS, app version, reproduction steps, expected vs actual behavior, and DevTools console logs.
- `.github/ISSUE_TEMPLATE/feature_request.md`: Structured form requesting problem statement, proposed solution, and alternative considerations.
- `.github/PULL_REQUEST_TEMPLATE.md`: Standard checklist including typecheck pass, test pass, manual verification, and scope alignment with V1.

---

## 5. GitHub Actions CI/CD Automation

### 5.1 Main CI Workflow (`.github/workflows/ci.yml`)
Runs on every push to `main` and all Pull Requests:
```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  validate:
    name: Lint, Typecheck & Test
    runs-on: windows-latest
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

      - name: TypeScript Check
        run: npx tsc -b

      - name: Production Vite Build
        run: npm run build

      - name: Run Test Suite
        run: npm test --if-present
```

### 5.2 Release Packaging Workflow (`.github/workflows/release.yml`)
Triggers automatically on tag push (`v*`):
```yaml
name: Release Build & Publish

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  build-release:
    name: Build & Package Windows Binaries
    runs-on: windows-latest
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

      - name: Package Windows Installer & Portable Zip
        run: npm run package

      - name: Generate SHA-256 Checksums
        shell: pwsh
        run: |
          Get-FileHash -Algorithm SHA256 release\*.exe, release\*.zip | 
          ForEach-Object { "$($_.Hash.ToLower())  $([System.IO.Path]::GetFileName($_.Path))" } | 
          Out-File -FilePath release\SHA256SUMS.txt -Encoding ascii

      - name: Publish GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            release/*.exe
            release/*.zip
            release/SHA256SUMS.txt
          draft: false
          prerelease: false
          generate_release_notes: true
```

---

## 6. GitHub Release Strategy (v1.0.0)

### 6.1 Release Artifacts Checklist
Every public GitHub release must include:
1. `Panvas-Setup-1.0.0.exe`: Standard Windows NSIS Installer (Desktop + Start Menu shortcuts).
2. `Panvas-1.0.0-win.zip`: Portable standalone Windows archive (zero installation required).
3. `SHA256SUMS.txt`: Cryptographic checksum manifest.

### 6.2 Official Release Notes Template
```markdown
# Panvas v1.0.0 — Official Public Release 🎉

We are thrilled to introduce **Panvas v1.0.0**, an open-source, local-first digital research and note-taking workspace designed for students, researchers, engineers, and creators.

### 🌟 Key Highlights
- **Local-First Architecture**: Your notes live on your disk in standard, human-readable formats under `.panvas/`.
- **Hybrid Notebooks**: Write rich text with Markdown shortcuts (TipTap) and sketch smooth vector ink handwriting side-by-side.
- **Dedicated PDF Workspace**: Annotate research papers and lecture slides with vector inking, thumbnail navigation, and high-res export.
- **Infinite Visual Canvas**: Free-form ideation powered by Excalidraw 0.17.6, custom LaTeX formula blocks, and UI mockup components.
- **Media & Voice Notes**: Universal drag-and-drop image placement and integrated voice memo recording.
- **Optional Cloud Backup**: Connect your own Google Drive for private snapshot backups without vendor lock-in.

### 📦 Downloads & Verification
| Package | Description | SHA-256 Checksum |
|---|---|---|
| `Panvas-Setup-1.0.0.exe` | Windows 10/11 Installer | `[SHA-256 HASH]` |
| `Panvas-1.0.0-win.zip` | Windows Portable Zip | `[SHA-256 HASH]` |
| `SHA256SUMS.txt` | Checksum Manifest | `[SHA-256 HASH]` |

### 🙏 Acknowledgements
Panvas is built on the shoulders of the open-source community:
- [Excalidraw](https://github.com/excalidraw/excalidraw) for the infinite canvas engine.
- [TipTap](https://tiptap.dev/) for the extensible rich text editor.
- [PDF.js](https://mozilla.github.io/pdf.js/) for high-performance PDF rendering.
- [Lucide Icons](https://lucide.dev/) for UI iconography.
- Conceptual and design inspiration from [Joplin](https://joplinapp.org/), [Xournal++](https://xournalpp.github.io/), and [FreeNotes](https://freenotes.org/).

### 📜 License
Panvas is free, open-source software licensed under the **MIT License**.
```

---

## 7. Execution Sign-Off

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OSS & GITHUB READINESS CERTIFICATION                     │
│                                                                             │
│   Legal & License Audit (MIT + Third Party Notices):  [ ] APPROVED          │
│   Conceptual Attribution Boundary (Joplin/Xournal):  [ ] APPROVED          │
│   Secret & Repository Sanitization:                  [ ] APPROVED          │
│   Community Documentation (README, CONTRIBUTING):    [ ] APPROVED          │
│   GitHub Actions CI/CD Pipeline Configured:          [ ] APPROVED          │
│                                                                             │
│   Release Officer: __________________________ Date: ____________________    │
└─────────────────────────────────────────────────────────────────────────────┘
```

