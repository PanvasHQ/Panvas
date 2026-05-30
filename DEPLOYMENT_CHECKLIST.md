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

## 3. Environment Variables
In the Vercel deployment settings, add the following Environment Variables before hitting deploy:
- [ ] `VITE_MARKETING_ONLY` = `true` *(CRITICAL: This locks down the unfinished workspace)*
- [ ] `VITE_POSTHOG_KEY` = `[Your Posthog Project Key]`
- [ ] `VITE_POSTHOG_HOST` = `https://app.posthog.com` (or EU equivalent if applicable)

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
