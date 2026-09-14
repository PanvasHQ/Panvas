# Panvas Open-Source Readiness Audit (OSS Launch Gap Analysis)

*Document Authority: Authoritative Open-Source Governance Audit*  
*Purpose: Pre-release gap analysis across repository hygiene, licensing, contributor collateral, and community standards*  
*Last Updated: September 10, 2026*  
*Target Release: Public GitHub Open-Source Release (v1.0.0)*

---

## 1. OSS Readiness Scorecard

| Domain / Requirement | Target Standard | Current Status | Blocker? | Remediation Package |
|---|---|---|:---:|---|
| **Root LICENSE** | MIT License file in repository root | **COMPLETE** (`LICENSE`) | No | Package E (`HARDEN-004`) |
| **Package License Manifest** | `"license": "MIT"` in `package.json` | **COMPLETE** (`private: true` preserved) | No | Package E (`HARDEN-004`) |
| **Third-Party Notices** | Root `THIRD_PARTY_NOTICES.md` with upstream licenses | **COMPLETE** for verified direct dependencies; copied asset/vendor terms flagged for owner/legal verification | No | Package E (`HARDEN-004`) |
| **Legal Attribution Boundary** | Acknowledge Excalidraw dependency; distinguish inspirations | **DOCUMENTED** in root notice; no bundled-code claim for Joplin/Xournal++/FreeNotes | No | Package E (`HARDEN-004`) |
| **Public README.md** | Comprehensive OSS README with quickstart & architecture | **COMPLETE** (Root `README.md` authored) | No | Maintained |
| **CONTRIBUTING.md** | Contribution guide, dev commands, commit style | **COMPLETE** (Root `CONTRIBUTING.md` authored) | No | Maintained |
| **SECURITY.md** | Vulnerability disclosure policy & reporting SLA | **COMPLETE** (Root `SECURITY.md` authored) | No | Maintained |
| **CODE_OF_CONDUCT.md** | Contributor Covenant v2.1 | **MISSING** | `P2` | Package E |
| **GitHub CI Automation** | `.github/workflows/ci.yml` (Lint, Typecheck, Test) | **MISSING** | `P1` | Package E |
| **Release CI Automation** | `.github/workflows/release.yml` (NSIS packaging, SHA-256) | **MISSING** | `P1` | Package E |
| **Issue & PR Templates** | `.github/ISSUE_TEMPLATE/` and PR template | **MISSING** | `P2` | Package E |
| **Git Hygiene & Clean Working Tree**| No tracked build outputs or credentials in Git index | **PARTIAL** (`dist-electron` and `Landingpage.png` tracked) | `P1` | Package D (`HARDEN-016`) |
| **Secret & Credential Scan** | 0 hardcoded API keys, private keys, or tokens | **VERIFIED CLEAN** | No | Maintained |

---

## 2. Licensing & Legal Requirements

### 2.1 Primary License (completed)
- **Current State**: Root `LICENSE` contains the standard MIT License text with `Copyright (c) 2026 Panvas Contributors`. `package.json` declares `"license": "MIT"` and retains `"private": true`, preventing accidental npm publication while allowing public GitHub source distribution.
- **Requirement satisfied**: Root `LICENSE` contains the standard MIT License text:
  ```text
  MIT License

  Copyright (c) 2026 Panvas Contributors

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software...
  ```
- **Manifest metadata**:
  ```json
  "private": true,
  "license": "MIT"
  ```

---

### 2.2 Third-Party Notices & Attribution Boundary

> [!IMPORTANT]
> **Strict Legal Distinction: Dependencies vs. Inspirations**

1. **Direct Codebase Dependencies**:
   Bundled upstream open-source code must have copyright notices and licenses included in `THIRD_PARTY_NOTICES.md`. Package versions and attribution lines are sourced from the current lockfile and installed package metadata; unresolved copied asset/vendor terms are explicitly marked there for owner/legal verification:
   - **Excalidraw** (`@excalidraw/excalidraw` 0.17.6) — MIT License (package metadata does not publish a separate copyright line)
   - **TipTap** (`@tiptap/*` 3.30.2) — MIT License (Copyright © Überdosis)
   - **PDF.js** (`pdfjs-dist` 4.10.38) — Apache-2.0 License (package metadata identifies the Mozilla PDF.js project but does not include a separate copyright line)
   - **pdf-lib** (`pdf-lib` 1.17.1) — MIT License (Copyright © Andrew Dillon)
   - **Dexie.js** (`dexie` 4.4.3) — Apache-2.0 License (Copyright © David Fahlander)
   - **KaTeX** (`katex` 0.16.47) — MIT License (Copyright © Khan Academy)
   - **Lucide Icons** (`lucide-react` 0.469.0) — ISC License (copyright lines preserved from the installed package license)
   - **Transformers.js** (`@huggingface/transformers` 4.2.0) — Apache-2.0 License (Copyright © Hugging Face)

2. **Conceptual & Product Design Inspirations (NO CODE DERIVATION)**:
   - **Joplin**: Inspiration for local-first markdown note organization and folder hierarchy.
   - **Xournal++**: Inspiration for digital pen stroke smoothing, paper templates, and PDF annotation workflows.
   - **FreeNotes**: Inspiration for multi-modal visual note cards.
   - **Attribution Policy**: Mentioned respectfully in README under *"Inspirations & Acknowledgements"*, explicitly clarifying:
     > *"Panvas is an independent codebase and is not a fork, derivative work, or affiliated project of Joplin, Xournal++, or FreeNotes."*

---

### 2.3 Package E execution record (2026-09-10)

- `LICENSE` exists and contains the standard MIT terms with 2026 Panvas Contributors attribution.
- `package.json` parses with `"license": "MIT"`; `"private": true` remains present. The lockfile dependency/version graph was not changed.
- `THIRD_PARTY_NOTICES.md` inventories the resolved direct runtime dependencies and preserves the installed Excalidraw vendor attribution lines. It includes full standard MIT, Apache-2.0, BSD-3-Clause, ISC, and Unlicense texts.
- The copied Excalidraw font assets and selected vendor license details remain explicitly flagged for owner/legal verification before a public binary release; no unverified holder or security contact was invented.

### 2.4 Package F2 execution record (2026-09-10)

- `build/icon.ico` now provides the Windows packaging scaffold with seven tested resolutions; signing and installer generation remain outside this pass.
- Core typography no longer depends on Google Fonts at runtime. Optional custom handwriting faces fall back to locally available system fonts; the existing copied Excalidraw font assets retain the owner/legal verification requirement above.
- Active icon-only controls are named for assistive technology, active marketing routes use the existing optimized WebP assets, and the unreferenced duplicate screenshot directories were removed.
- Legacy Supabase auth forms remain available as lazy routes; the Supabase session/callback code and Google Drive cloud path were not removed.

## 3. Public README & Community Collateral Status

The core community documents are now authored and located in the repository root:

1. **Root `README.md` (COMPLETE)**:
   - Includes Panvas tagline, vision, architecture, and technology stack.
   - Highlights local-first storage, TipTap notebook, Excalidraw canvas, PDF workspace, and audio notes.
   - Clarifies V1 vs. V2 scope boundaries.
   - Provides clear instructions for building and testing from source.
2. **Root `CONTRIBUTING.md` (COMPLETE)**:
   - Full guide on development prerequisites, branching model, commit conventions, and verification steps.
   - Emphasizes critical architectural invariants (persistence integrity, theme isolation).
3. **Root `SECURITY.md` (COMPLETE)**:
   - Details process sandboxing, IPC validation, CSP configuration, and threat model exclusions.
   - Directs security disclosures privately to GitHub Security Advisories.

---

## 4. Repository Hygiene & Secret Sanitization

### 4.1 Tracked Artifacts in Git Index (`HARDEN-016`)
The following files are currently tracked in Git and must be untracked (`git rm --cached`):
- `dist-electron/main.js` (Compiled output, 173 KB)
- `dist-electron/preload.mjs` (Compiled output, 5.6 KB)
- `tsconfig.tsbuildinfo` (TypeScript compiler cache, 5.7 KB)
- `Landingpage.png` (High-res screenshot, 2.43 MB)

### 4.2 Verified Clean State
- **Secrets**: Zero hardcoded API keys, OAuth client secrets, or private keys in source.
- **GitIgnore**: `.env*`, `node_modules/`, `dist/`, `release/`, and local user vaults are properly ignored.
- **Console Spam**: Zero unfiltered `console.log` in production renderer paths (`console.log` in `migration.ts` will be replaced with structured logs in Hardening Package A).

---

## 5. GitHub CI/CD Automation Requirements

Two core GitHub Actions workflows must be committed to `.github/workflows/`:

### 5.1 Main CI Workflow (`.github/workflows/ci.yml`)
- Trigger: Push to `main`, `develop`, and all Pull Requests.
- Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with Node 20 and npm cache.
  3. `npm ci`
  4. `npm run typecheck` (`tsc --noEmit` and `tsc -p tsconfig.electron.json --noEmit`)
  5. `npm test` (506 unit & integration tests)
  6. `npm run build` (Production Vite and Electron compilation)

### 5.2 Release Packaging Workflow (`.github/workflows/release.yml`)
- Trigger: Tag push matching `v*.*.*`.
- Steps:
  1. Full build and test.
  2. `npm run package:win` generating `Panvas-Setup-1.0.0.exe` and `Panvas-1.0.0-win.zip`.
  3. Generate `SHA256SUMS.txt` cryptographic manifest.
  4. Upload assets to GitHub Release via `softprops/action-gh-release`.

---

## 6. OSS Readiness Checklist

- [x] Add root `LICENSE` (MIT) — Package E (`HARDEN-004`); standard text validated
- [x] Add root `THIRD_PARTY_NOTICES.md` — Package E (`HARDEN-004`); verified dependency inventory plus explicit asset/vendor legal-review flags
- [x] Update `package.json` (`"license": "MIT"`, retain `"private": true`) — Package E (`HARDEN-004`)
- [x] Add `README.md` (Completed in root)
- [x] Add `CONTRIBUTING.md` (Completed in root)
- [x] Add `SECURITY.md` (Completed in root)
- [ ] Add `CODE_OF_CONDUCT.md` — Package E
- [ ] Add `.github/ISSUE_TEMPLATE/` (bug_report.md, feature_request.md)
- [ ] Add `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Add `.github/workflows/ci.yml`
- [ ] Add `.github/workflows/release.yml`
- [ ] Untrack `dist-electron/` and `Landingpage.png` from git index — Package D (`HARDEN-016`)
