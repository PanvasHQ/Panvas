# Panvas V1 Documentation Reconciliation Report

**Date**: 2026-09-10  
**Scope**: Pre-Release Documentation Cleanliness, Cross-Document Consistency, and Baseline Lock  
**Target Audience**: Engineering Leads, Codex/Sol Hardening Agents, Security Reviewers, and Open-Source Contributors  
**Execution Boundary**: **DOCUMENTATION-ONLY** (Zero source code modifications, zero test changes, zero dependency mutations).

---

## 1. Executive Summary

Prior to initiating release hardening (execution of `RELEASE_HARDENING_BACKLOG.md` Packages A through F), a thorough documentation audit revealed severe merge-residue duplicates, stale work-package counts, conflicting scope definitions (interleaved V1 vs. V2 declarations), broken absolute personal filesystem URLs, and inconsistent test badges.

This reconciliation pass has completely unified the release documentation into a single, authoritative, non-contradictory baseline. All 30 hardening items, work packages, roadmap phases, and security runbooks now align exactly.

---

## 2. Document Authority Hierarchy

To prevent conflicting interpretations during multi-agent or autonomous execution, all project decisions and specifications must adhere strictly to the following precedence:

1. **Document #1 — Primary Backlog Authority**:  
   [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md)  
   *The definitive, immutable source of truth for all 30 HARDEN item IDs, priorities (BLOCKER, P0, P1, P2, FIXED), problem descriptions, file references, remediation steps, and verification commands.*
2. **Document #2 — Execution & Packaging Sequence**:  
   [`V1_HARDENING_EXECUTION_PLAN.md`](V1_HARDENING_EXECUTION_PLAN.md)  
   *Defines the authoritative execution sequence across Packages A through F, branch strategies, commit conventions, and step-by-step test gates.*
3. **Document #3 — Root-Cause Evidence & Pre-Hardening Audit**:  
   [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md)  
   *Provides the technical evidence, line-numbered audit findings, architectural diagrams, and memory/IPC root causes underpinning each backlog item.*
4. **Document #4 — Release Verification Tracker**:  
   [`V1_RELEASE_CHECKLIST.md`](V1_RELEASE_CHECKLIST.md)  
   *The live operational tracking checklist used by release managers to monitor sign-offs across all 30 items, manual QA passes, and deployment gates.*
5. **Document #5 — Release Lifecycle Master Plan**:  
   [`V1_RELEASE_MASTER_PLAN.md`](V1_RELEASE_MASTER_PLAN.md)  
   *High-level release roadmap detailing the 16 release phases from current state to public OSS launch.*

---

## 3. Authoritative Hardening Baseline (Exact 30 Items)

The release backlog is locked at exactly **30 items** across five distinct priority tiers:

| Tier | Count | Canonical Item IDs | Status |
|---|---|---|---|
| **BLOCKER** | 5 | `HARDEN-001`, `HARDEN-002`, `HARDEN-003`, `HARDEN-004`, `HARDEN-005` | Open (Must fix before build) |
| **P0** | 7 | `HARDEN-006`, `HARDEN-007`, `HARDEN-008`, `HARDEN-010`, `HARDEN-017`, `HARDEN-026`, `HARDEN-027` | Open (Must fix before release) |
| **P1** | 11 | `HARDEN-011`, `HARDEN-013`, `HARDEN-014`, `HARDEN-015`, `HARDEN-016`, `HARDEN-018`, `HARDEN-019`, `HARDEN-020`, `HARDEN-028` *(Needs Owner Verification)*, `HARDEN-029`, `HARDEN-030` | Open |
| **P2** | 5 | `HARDEN-021`, `HARDEN-022`, `HARDEN-023`, `HARDEN-024`, `HARDEN-025` | Open |
| **FIXED / PASSING** | 2 | `HARDEN-009` (CSP Connect-Src Allowance for Excalidraw Community Libraries), `HARDEN-012` (Remove Legacy Double-Header Mount in Canvas Mode) | Verified Passing in Tests |
| **TOTAL** | **30** | — | — |

*Note*: No items numbered `HARDEN-031` or higher exist. All legacy documentation referencing 25 items has been updated to reflect the full 30-item canonical list (28 open + 2 verified passing).

---

## 4. Reconciled Roadmap & Scope

### 4.1 V1 Scope Lock
- **Core Product**: Local-first Notebook (5-tier hierarchy, 2D vector ink, TipTap rich text, layouts), Freeform Infinite Canvas (Excalidraw 0.17.6 integration, custom blocks), PDF Workspace (PDF.js, in-place annotations, thumbnail sidebar), Audio notes, and Optional Google Drive Cloud Sync.
- **Production Readiness**: Resolution of all 5 BLOCKER and 7 P0 hardening items, automated test pass (505 passed / 1 skipped baseline), clean production builds, and manual release verification.

### 4.2 Explicit Scope Exclusions (Moved Post-V1)
The following subsystems are explicitly removed from the V1 release gate to guarantee security, stability, and on-time release:
- **Embedded Web Research Workspace / Browser** $\to$ Post-V1 (V2/V3)
- **Model Context Protocol (MCP) Foundation** $\to$ Post-V1 (V2/V3)
- **Panvas Extension / Plugin System** $\to$ Post-V1 (V2/V3)
- **Panvas Intelligence & AI Features** $\to$ Post-V1 (V2/V3)

### 4.3 Long-Term Product Vision
- **V1**: Local-first Foundation & Production Release.
- **V2 (Knowledge Canvas)**: Notion-style structured documentation blocks + Excalidraw spatial freedom + Local-first research/PDF workflow.
- **V3 (Platform & Intelligence)**: Extensibility, MCP tools, sandboxed extensions, and private LLM intelligence.

---

## 5. Absolute Path Scrub & Portability

- **Zero Absolute File URLs**: A comprehensive automated scan across the entire project documentation confirms that all personal absolute file URLs and machine-specific paths have been completely removed.
- **Relative Portability**: All internal document links, code links, and asset links now use clean relative markdown paths (e.g., `RELEASE_HARDENING_BACKLOG.md`, `../../src/...`, `../../electron/...`), allowing the repository to be cloned, read, and executed on any developer machine or CI environment.

---

## 6. Outstanding Owner Decisions (Human Action Required)

Before public release tagging, the repository owner must resolve the following 4 decisions:

1. **Discord RPC Application ID (`HARDEN-028`)**:
   - Inspect `electron/discord-rpc.ts:18`. The current fallback ID is `'1546879865997758576'` (passes 6/6 tests in `tests/discord-rpc.test.ts`). Verify against the Discord Developer Portal application credentials before replacing.
2. **Windows Authenticode Code-Signing (`HARDEN-021`)**:
   - Determine whether Panvas V1 desktop binaries will be signed with a hardware token / cloud HSM Authenticode certificate (to prevent Windows SmartScreen warnings) or released initially as unsigned open-source binaries with documented checksums.
3. **Security Vulnerability Disclosure Contact (`SECURITY.md`)**:
   - Verify that private vulnerability reports are submitted through GitHub Security Advisories (`https://github.com/sumitahmed/Panvas/security/advisories`) as defined in root `SECURITY.md`.
4. **V2/V3 Public Roadmap Disclosure**:
   - Confirm whether future roadmap documents (`docs/panvas-handover/V2_ROADMAP.md` and `docs/ROADMAP.md`) should be published in the public GitHub repo or retained as internal architecture reference.

---

## 7. Verification of Pass Boundaries

- **Runtime Source Code (`src/`, `electron/`)**: **0 files modified** during this pass.
- **Test Code (`tests/`)**: **0 files modified** during this pass.
- **Package Manifest & Lockfile (`package.json`, `package-lock.json`)**: **0 files modified** during this pass.
- **Test Suite Status**: Unchanged baseline of **505 tests passing, 1 platform-only test skipped**.
