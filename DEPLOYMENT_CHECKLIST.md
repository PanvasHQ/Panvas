# Deployment and release checklist

This checklist covers the public web site and the Windows v0.1.0 release. It is a maintainer runbook, not a product feature specification.

## Repository hygiene

- [ ] Confirm the intended branch and remote: `https://github.com/sumitahmed/Panvas.git`.
- [ ] Review `git status`, the staged diff, and the staged file list. Stage explicit paths; do not use `git add -A` in a dirty worktree.
- [ ] Scan tracked, staged, and publish-candidate files for `.env` files, credentials, tokens, private keys, certificates, recordings, private notes, personal paths, and build output.
- [ ] Keep `.agents/`, `skills-lock.json`, `scratch/`, `strix_runs/`, `dist/`, `dist-electron/`, and `release/win-unpacked/` out of the public launch commit unless an owner explicitly approves an exception.

## Verification gates

Run from the reviewed checkout:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:release
```

Stop if any gate fails. These checks do not replace a clean review of the staged diff.

## Windows release asset

- [ ] Confirm `release/Panvas-0.1.0-Setup.exe` exists and is non-empty.
- [ ] Recalculate its SHA-256 independently with PowerShell:

  ```powershell
  Get-FileHash release/Panvas-0.1.0-Setup.exe -Algorithm SHA256
  ```

- [ ] Confirm the result matches `release/SHA256SUMS.txt` and the final installer selected for publication. Resolve any disagreement before publishing.
- [ ] Attach only `Panvas-0.1.0-Setup.exe` and `SHA256SUMS.txt` to the GitHub Release. Do not commit the installer, `win-unpacked/`, `dist/`, `dist-electron/`, or `node_modules/`.
- [ ] The v0.1.0 installer is unsigned; document the SmartScreen warning and checksum verification in the release notes.

## Web deployment

The configured public site is [panvas.vercel.app](https://panvas.vercel.app/). Verify the landing page, `/app`, `/download`, `/privacy`, `/terms`, `/security`, and `/roadmap` routes after deployment. The `/app` web build uses browser-local storage.

If enabling an optional integration, configure it in the hosting provider rather than committing secrets. Cloud Sync requires explicit build-time flags and Google OAuth setup; keep it disabled for the ordinary v0.1.0 build.

## GitHub publication

- [ ] Verify the authenticated remote and repository metadata before pushing.
- [ ] Create the annotated tag `v0.1.0` only after all gates and the artifact checksum pass.
- [ ] Push the intended branch and tag without force-push.
- [ ] Create GitHub Release `Panvas v0.1.0`, mark it latest, paste `docs/RELEASE_NOTES_v0.1.0.md`, and attach the two release assets.
- [ ] Open the release page in a fresh session; verify asset names, sizes, downloads, and the checksum again.
- [ ] Verify the website's release/download links point to the published release.

If GitHub CLI/API authentication is unavailable, pause publication and have a maintainer complete the release from an authenticated session.
