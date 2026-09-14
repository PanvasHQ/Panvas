# Panvas documentation

This index identifies the canonical documentation for Panvas v0.1.0. Current source and these documents take precedence over older planning notes.

## Start here

- [README](../README.md) - product overview, installation, development commands, and project status.
- [CONTRIBUTING](../CONTRIBUTING.md) - setup, workflow, review expectations, and safe contribution boundaries.
- [CONTRIBUTOR_ROADMAP](CONTRIBUTOR_ROADMAP.md) - contribution-sized work grouped by risk.
- [KNOWN_LIMITATIONS](../KNOWN_LIMITATIONS.md) - current distribution and product constraints.

## Canonical system documentation

| Document | Use it for |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime profiles, layers, process boundary, and subsystem topology |
| [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) | Design principles and invariants contributors must preserve |
| [DATA_MODEL.md](DATA_MODEL.md) | Workspace hierarchy, payload ownership, IDs, and deletion semantics |
| [STORAGE_AND_PERSISTENCE.md](STORAGE_AND_PERSISTENCE.md) | Electron files, browser IndexedDB, queues, recovery, and migration |
| [TECH_STACK.md](TECH_STACK.md) | Runtime, framework, storage, rendering, and test dependencies |
| [TESTING.md](TESTING.md) | Required checks, focused suites, and test-writing guidance |

## Feature and release documentation

- [CLOUD_SYNC_V0_1_ARCHITECTURE.md](CLOUD_SYNC_V0_1_ARCHITECTURE.md) - current release-gated Google Drive design.
- [CLOUD_SYNC_DEVICE_RESET.md](CLOUD_SYNC_DEVICE_RESET.md) - local reset and recovery procedure when sync is explicitly enabled.
- [RELEASE_NOTES_v0.1.0.md](RELEASE_NOTES_v0.1.0.md) - concise release notes for the first public release.
- [RELEASE_READINESS.md](RELEASE_READINESS.md) - maintainer release gate and verification record.
- [IMPORT_EXPORT_SUPPORT.md](IMPORT_EXPORT_SUPPORT.md) - current import/export surface.

## Security and project operations

- [Security policy](../SECURITY.md) - private vulnerability reporting and security boundaries.
- [Deployment checklist](../DEPLOYMENT_CHECKLIST.md) - web deployment and GitHub Release runbook.
- [Third-party notices](../THIRD_PARTY_NOTICES.md) - direct dependency attribution and license pointers.
- [Code of Conduct](../CODE_OF_CONDUCT.md) - community standards and reporting.

## Historical material

`docs/panvas-handover/` is an archive of dated implementation notes, audits, and handoffs. Files there may describe an earlier state, proposed work, or an incident. They are labelled historical and must not override current source or the canonical documents above. `docs/01_PROJECT_OVERVIEW.md` through `docs/10_HANDOFF.md` are also historical planning snapshots.

Research notes and planning files such as `docs/features.md`, `docs/fixes.md`, and `docs/IMPLEMENTATION_PRIORITY.md` are not release contracts. Review them before sharing or staging them for a public contribution.
