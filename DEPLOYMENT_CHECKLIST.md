# Vercel Deployment Checklist

Follow this checklist strictly before and during your deployment to ensure a pristine V1 marketing launch.

## 1. GitHub Push
- [ ] Verify `.gitignore` contains `node_modules`, `dist`, `.env*`, `.vercel`, and `coverage`.
- [ ] Verify no secrets (like your actual PostHog or Supabase keys) are hardcoded in the codebase or committed in `.env`.
- [ ] Push the latest `main` branch to your GitHub repository (`https://github.com/sumitahmed/Panvas`).

## 2. Vercel Import
- [ ] Log in to Vercel and click **Add New Project**.
- [ ] Import your `Panvas` repository from GitHub.
- [ ] Vercel will automatically detect `Vite`. Ensure the Framework Preset is set to **Vite**, Build Command is `npm run build`, and Output Directory is `dist`.

## 3. Environment Variables & Routing Configuration
Panvas features an adaptive routing architecture (`src/lib/location.ts`):
- `https://panvas.vercel.app/` serves the finished Panvas Landing Page.
- `https://panvas.vercel.app/privacy` directly serves the Privacy Policy (clean URL, no hash, required for Google OAuth verification).
- `https://panvas.vercel.app/terms` directly serves the Terms of Service.
- `https://panvas.vercel.app/security` directly serves the Security page.
- `https://panvas.vercel.app/roadmap` directly serves the Roadmap page.
- `https://panvas.vercel.app/app` directly opens the live Panvas browser workspace application (no "Workspace Private Beta" gate).

In Vercel deployment settings:
- `VITE_MARKETING_ONLY` is **not required** (the landing page and public routes are automatically handled by `EntrySurface` without locking down `/app`).
- `VITE_POSTHOG_KEY` = `[Your PostHog Project Key]` (optional)
- `VITE_POSTHOG_HOST` = `https://app.posthog.com` (optional)

For a browser/PWA Google Drive test deployment:
- [ ] Create a Google OAuth **Web application** client in the same Google Cloud project as the Electron/Desktop client and enable the Google Drive API.
- [ ] Add each exact deployed and local origin under Authorized JavaScript origins (for example, `https://panvas.vercel.app` and `http://localhost:5173`).
- [ ] Set `VITE_ENABLE_CLOUD_SYNC=true` and `VITE_PANVAS_GOOGLE_WEB_CLIENT_ID=<public-web-client-id>.apps.googleusercontent.com` at build time if testing browser cloud sync.
- [ ] Never set a Google client secret in a `VITE_*` variable. Confirm the built `dist/` contains no `client_secret`, desktop secret environment name, token, or refresh-token value.

## 4. Domain Setup
- [ ] Once deployed, go to the project's **Settings > Domains** in Vercel.
- [ ] Add your custom domain (e.g., `panvas.app`).
- [ ] Configure your DNS records (A Record or CNAME) in your domain registrar according to Vercel's instructions to verify ownership.

## 5. Analytics Verification
- [ ] Open the live production URL in an incognito window.
- [ ] Click "Sign In", "Create Account", and "Open Workspace".
- [ ] Scroll through the feature sections.
- [ ] Log in to your PostHog dashboard and verify that `pageview`, `cta_click`, and `view_features` events are registering correctly.

## 6. Mobile Testing
- [ ] Open the live site on an iOS and Android device.
- [ ] Verify the hero text is readable.
- [ ] Verify the feature cards and marquee ribbon scale properly without horizontal overflow.
- [ ] Verify the footer columns stack cleanly on small screens.

## 7. Lighthouse Testing
- [ ] Open Google Chrome in an incognito window.
- [ ] Navigate to your live production URL.
- [ ] Open Chrome DevTools > Lighthouse.
- [ ] Run a navigation audit for **Performance**, **Accessibility**, **Best Practices**, and **SEO** on Mobile and Desktop. Ensure all scores are green (>90).

---

## 8. Windows Electron Release

This section applies to the desktop application, independently of the Vercel marketing-site checklist above.

- [ ] Run `npm run package:win` from a clean, reviewed worktree and retain the generated installer and blockmap from `release/`.
- [ ] Install the generated NSIS installer on a clean Windows profile; confirm launch, uninstall, and absent-knowledge-vault behavior are graceful.
- [ ] Inspect the packaged app: the renderer must expose only the documented `window.panvas` bridge, and the knowledge subset must remain the five read-only operations.
- [ ] Set `PANVAS_KNOWLEDGE_VAULT` only in the Electron main-process launch environment when local knowledge access is intended. Do not put an Obsidian credential, MCP endpoint, or vault API key in `.env`, the renderer, or the release artifact.
- [ ] Provide a branded Windows `.ico`, legal publisher metadata, and an Authenticode signing certificate with RFC 3161 timestamping. Verify the final installer signature with Windows before publishing.
- [ ] Publish the SHA-256 checksum calculated from the final signed installer. Unsigned releases may trigger SmartScreen/Defender reputation warnings.
