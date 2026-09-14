# v0.1.0 release readiness

This is the canonical maintainer checklist for Panvas v0.1.0. It records release evidence without changing application behavior.

## Release profiles

| Profile | Current behavior |
| --- | --- |
| Windows Electron | x64 NSIS installer; workspace stored on the local filesystem under `Documents/Panvas/` by default |
| Web | Vite build served at the configured site; records stored in origin-scoped Dexie/IndexedDB |
| Cloud Sync | Optional Google Drive integration; disabled by default by build-time flags |

## Required gates

Run from the reviewed checkout:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:release
```

Every command must pass. Review the staged file list and diff separately; a passing build does not make local files or secrets publishable.

## Installer gate

The intended release assets are:

- `release/Panvas-0.1.0-Setup.exe`
- `release/SHA256SUMS.txt`

Recalculate the installer with `Get-FileHash ... -Algorithm SHA256` and confirm it matches the manifest for the exact binary selected for upload. Keep `release/` out of Git history; attach only the two files to the GitHub Release. The installer is unsigned and must be documented as such.

## Repository gate

Do not publish `.env` files, credentials, tokens, private keys, certificates, recordings, private notes, personal workspace data, `scratch/`, `strix_runs/`, `.agents/`, `skills-lock.json`, `dist/`, `dist-electron/`, or `release/win-unpacked/`. Use explicit staging paths in a dirty worktree.

## Publication sequence

1. Verify the remote is `https://github.com/sumitahmed/Panvas.git` and the intended branch is `main`.
2. Stage and review only public documentation/configuration changes.
3. Commit `chore(release): prepare Panvas v0.1.0`.
4. Create and inspect annotated tag `v0.1.0`.
5. Push the branch and tag without force-push.
6. Create the latest GitHub Release titled `Panvas v0.1.0`, attach the installer and checksum manifest, and use [RELEASE_NOTES_v0.1.0.md](RELEASE_NOTES_v0.1.0.md).
7. Verify the release page, download links, asset sizes, and checksum from a fresh session.

## Current pass note

Publication is intentionally paused when the independently calculated installer digest, the supplied manifest, or an owner-provided expected digest disagree. Resolve that discrepancy before creating a tag or release. GitHub CLI/API authentication must also be available to publish from automation; otherwise a maintainer should complete the final publication in an authenticated session.

## Dependency audit note

On 2026-09-14, `npm audit --omit=dev` reported 47 advisories in the installed dependency graph (42 moderate, 5 high, 0 critical). The report includes the direct `@huggingface/transformers` path and transitive TipTap advisories. `npm ci` reported 50 including development dependencies. This documentation-only pass did not change dependencies; an owner must review the audit and decide on upgrades or risk acceptance before calling the public binary fully cleared.
