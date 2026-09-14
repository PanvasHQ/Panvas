import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isPublicRoute } from '../src/lib/location.ts';

test('isPublicRoute identifies public marketing and trust routes on web', () => {
  assert.equal(isPublicRoute('/', false), true);
  assert.equal(isPublicRoute('/landing', false), true);
  assert.equal(isPublicRoute('/app/landing', false), true);
  assert.equal(isPublicRoute('/download', false), true);
  assert.equal(isPublicRoute('/privacy', false), true);
  assert.equal(isPublicRoute('/terms', false), true);
  assert.equal(isPublicRoute('/security', false), true);
  assert.equal(isPublicRoute('/roadmap', false), true);

  // App and workspace routes are NOT public
  assert.equal(isPublicRoute('/app', false), false);
  assert.equal(isPublicRoute('/app/library', false), false);
  assert.equal(isPublicRoute('/app/settings', false), false);
  assert.equal(isPublicRoute('/auth/login', false), false);
  assert.equal(isPublicRoute('/auth/callback', false), false);
});

test('isPublicRoute routes desktop bare launch origin directly into the workspace', () => {
  // On desktop Electron, '/' must NOT be treated as a public landing page
  assert.equal(isPublicRoute('/', true), false);
  assert.equal(isPublicRoute('', true), false);

  // Explicit landing route remains accessible if requested
  assert.equal(isPublicRoute('/landing', true), true);
  assert.equal(isPublicRoute('/app/landing', true), true);
});

test('App.tsx uses adaptive Panvas location and exposes the live workspace without beta gating', async () => {
  const app = await readFile(new URL('../src/app/App.tsx', import.meta.url), 'utf8');

  // Uses adaptive location
  assert.match(app, /import \{ usePanvasLocation, isDesktop \} from '@\/lib\/location'/);
  assert.match(app, /<Router hook=\{usePanvasLocation\}>/);

  // Gating must not block /app with ComingSoonPage
  assert.doesNotMatch(app, /VITE_MARKETING_ONLY === 'true' \? \([\s\S]*?<Route path="\/app" component=\{ComingSoonPage\}/);

  // Live workspace must be directly wired on /app
  assert.match(app, /<Route path="\/app">\s*<AuthGuard>\s*<AppShell>\s*<WorkspaceContent \/>/);
  assert.match(app, /<Route path="\/app\/library">\s*<AuthGuard>\s*<AppShell>\s*(?:<ViewportErrorBoundary[^>]*>\s*)?<LibraryWorkspace \/>/);
  assert.match(app, /<Route path="\/download" component=\{DownloadPage\} \/>/);
  assert.match(app, /<Route component=\{NotFoundPage\} \/>/);
});

test('bootstrap.tsx routes public routes directly to PublicSurface', async () => {
  const bootstrap = await readFile(new URL('../src/bootstrap.tsx', import.meta.url), 'utf8');

  assert.match(bootstrap, /import \{ usePanvasLocation, isPublicRoute, isDesktop, normalizeBrowserHash \} from '@\/lib\/location'/);
  assert.match(bootstrap, /function PublicSurface\(\)/);
  assert.match(bootstrap, /<Route path="\/download" component=\{DownloadPage\} \/>/);
  assert.match(bootstrap, /<Route path="\/privacy" component=\{PrivacyPolicyPage\} \/>/);
  assert.match(bootstrap, /<Route path="\/terms" component=\{TermsOfServicePage\} \/>/);
  assert.match(bootstrap, /<Route path="\/security" component=\{SecurityPage\} \/>/);
  assert.match(bootstrap, /<Route path="\/roadmap" component=\{RoadmapPage\} \/>/);
  assert.match(bootstrap, /<Route path="\/" component=\{LandingPage\} \/>/);
  assert.match(bootstrap, /<Route component=\{NotFoundPage\} \/>/);
});

