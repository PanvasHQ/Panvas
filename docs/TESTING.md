# Testing and verification

Panvas uses the Node test runner for most unit and integration coverage. A smaller set of scripts exercises browser or Electron behavior with Playwright or a launched app. Tests should protect user-visible behavior and the local-first data contract.

## Required checks

Run these before opening a pull request or publishing a release:

```bash
npm run typecheck
npm test
npm run build
npm run check:release
```

`typecheck` checks both the renderer and Electron TypeScript projects. `build` runs typecheck first and creates the renderer and Electron bundles. `check:release` inspects the generated bundles for required files, source maps, sensitive configuration, and size budgets.

## Test commands

The main `npm test` script runs the current regression, notebook, canvas, PDF, persistence, browser bootstrap, and sync-core suites. Focused suites are available when working on a subsystem:

```bash
npm run test:notebook-scroll
npm run test:electron
npm run test:integrity
npm run test:browser-integrity
npm run test:cloud-workspace-flow
npm run test:cloud-returning-browser
npm run test:editor-regressions
```

The package-specific `test:package-a`, `test:package-b`, and `test:package-c` scripts are also useful for migration/storage, Electron/PDF, and cloud-sync changes. Run the narrowest relevant suite during iteration, then run the full `npm test` gate before review.

## Browser and Electron checks

Browser harnesses expect a local Vite server and may use a real browser profile. Electron harnesses launch the built app or inspect the main/preload boundary. Do not use a production account, real OAuth token, or private workspace in automated tests. Test fixtures belong under `tests/fixtures/` and should not contain personal data.

## Writing tests

- Assert behavior and durable state, not implementation trivia.
- Keep tests deterministic; clean up temporary files, browser contexts, and listeners.
- Add a regression test for a bug before or alongside the fix.
- For storage changes, cover both Electron and browser adapters when the contract is shared.
- For UI changes, cover keyboard and narrow-window behavior where applicable and attach a screenshot or short recording to the pull request when visual review matters.

## Current verification record

On 2026-09-14, the working tree's release pass completed `npm test` with 588 tests discovered, 587 passing, 1 skipped, and no failures. A focused notebook-scroll run passed 6/6. Re-run the commands locally because counts and coverage change as tests evolve.
