# Panvas landing page current state (2026-09-07)

This is the current landing-specific source-of-truth note. It supplements the engineering handover and supersedes older landing, web/PWA, or cloud-readiness statements when they conflict with the current source or release gates. It records an audit only; no landing implementation was changed.

## Current route and architecture

- `src/lib/location.ts` implements adaptive location handling (`usePanvasLocation`): HTML5 History API on the web (`useBrowserLocation`), and hash-based routing in desktop Electron (`useHashLocation`).
- `src/bootstrap.tsx` (`EntrySurface`) handles public routes (`/`, `/privacy`, `/terms`, `/security`, `/roadmap`, `/landing`) directly with `PublicSurface`, serving the finished marketing site and legal pages without loading the heavier editor workspace bundle.
- Clean path URLs are enforced for web: `https://panvas.vercel.app/` serves the landing page, and `/privacy`, `/terms`, `/security`, `/roadmap` resolve directly on clean URLs without `#` for Google OAuth branding verification. Legacy hash routes (`/#/privacy`, `/#/app`) automatically normalize to clean paths.
- `https://panvas.vercel.app/app` opens the real Panvas browser workspace application. The obsolete `ComingSoonPage` ("Workspace Private Beta") gate has been removed.
- In desktop Electron (`file:` protocol or `window.panvas`), launch origin `/` redirects to the workspace library (`/app/library`).
- The mounted landing page is `src/components/marketing/LandingPage.tsx`, styled by `src/components/marketing/landing.css`. Section order is hero, transition, notebooks, ink, PDF, canvas, local-first, distribution, FAQ, footer.
- `LandingAtmosphere.tsx` dynamically loads Vanta Clouds/Three for WebGL-capable desktop viewports and has a CSS fallback. It skips enhancement for reduced motion, Save-Data, narrow viewports, or missing WebGL, and pauses when hidden/offscreen.
- Framer Motion drives entrance, parallax, path-draw, and FAQ effects. The page uses independent `whileInView` thresholds and section-specific `useScroll` ranges.

## Release-safe current claims

- Panvas is a local-first visual workspace. Desktop storage is local filesystem; browser storage is origin-scoped Dexie/IndexedDB.
- Windows Electron is the target x64 profile (Windows 10/11), but installer signing, clean-machine verification, and the production release gate remain open. Current metadata is `v0.1.0-pre`.
- A browser route exists in source and is Chromium-first for evaluation. Hosted stability, PWA manifest/installability, offline-shell certification, and cross-browser certification remain pending. Do not imply a universally supported public web release.
- Handwriting recognition is available through the Windows/native bridge. Browser recognition is only available when the detected native browser API exists; otherwise raw vector ink is the safe claim.
- Google Drive sync is optional, feature-flagged, and still behind production/cross-device verification. OneDrive is not implemented.

## Media inventory and evidence

- Primary captures: `public/Application SS updated/` and mirrored `public/app-screenshots/` contain hero, notebook, ink, PDF, canvas, toolbar, voice-note, cloud-sync, and export captures. `public/marketing-assets/` contains cleaned WebP derivatives (`hero-workspace-clean.webp`, `cloud-sync-clean.webp`, `handwriting-ocr-clean.webp`, `ink-gestures-clean.webp`, `ink-stationery-ruler-clean.webp`, `notebook-customize-clean.webp`, `notebooks-templates-clean.webp`, `pdf-workbench-clean.webp`, `spatial-canvas-clean.webp`, `voice-notes-clean.webp`).
- The supplied QA screenshot `C:\Users\sksum\Downloads\curr update.png` (2026-09-07) shows the cloud hero and first three product sections, then a long blank lower page and a clipped Panvas footer wordmark.
- The supplied motion recording `C:\Users\sksum\Videos\Screen Recordings\curr update.mp4` is inventoried for Astra. Frame-level decoding was unavailable in this audit environment, so timing findings are based on source inspection plus the screenshot rather than invented video observations.
- `Landingpage.png`, `public/hero-bg.jpg`, `CyberBackground.tsx`, and the simulated hero prototype represent older or illustrative directions and are not current product evidence.

## Verified problems

- `landing.css` is a large, layered file with repeated override blocks and dead marketing styles. It includes perpetual atmosphere/iridescence loops, fixed full-screen effects, backdrop/filter layers, `transition: all`, and `content-visibility:auto` on major sections.
- The screenshot's blank lower sections are consistent with the blanket `content-visibility:auto`/intrinsic-size treatment during full-page capture; this must be reproduced and fixed or explicitly ruled out before redesign.
- Hero and most section copy repeat a 0.62s, 18px `TextReveal`; other assets use separate delays, `whileInView` amounts, parallax, SVG path drawing, and a 145vh sticky ink story. These independent timelines explain late, slow, and out-of-sync lower transitions.
- The hero prototype is a fake interface with hardcoded status/controls and an invented handwriting-conversion specimen. It should not be presented as the real Panvas application.
- Below-fold images are often eager-loaded and lack explicit dimensions; the prototype uses uncapped device-pixel-ratio canvas sizing. Combined with Vanta, filters, and many large PNGs, this can cause decode contention, jank, and layout shift on ordinary devices.
- The footer wordmark's filtered/masked SVG is visibly cropped or unfinished in the supplied screenshot, likely from bounds, sizing, and overflow interaction.
- CSS defines scrap/ink texture animation but `LandingAtmosphere` does not render a scrap layer. The current halftone treatment is uniform rather than sparse/editorial.

## Governance

Before changing copy or claiming readiness, re-check `docs/RELEASE_READINESS.md`, `release.md`, `docs/BROWSER_CAPABILITY_MATRIX.md`, and `docs/09_FRONTEND_UIUX_GUIDE.md` against source. UI presence is not proof of release readiness.
