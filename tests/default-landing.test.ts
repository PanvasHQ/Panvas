import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { shouldFallBackToLibrary } from '../src/lib/defaultLanding.ts';

test('the /app → Library fallback never fires before the restore pass settles', () => {
  assert.equal(
    shouldFallBackToLibrary({ initialDocumentRestoreComplete: false, isLoading: false, activePageId: null, activeCanvasId: null }),
    false,
  );
});

test('an in-flight workspace load cannot trigger the Library fallback', () => {
  assert.equal(
    shouldFallBackToLibrary({ initialDocumentRestoreComplete: true, isLoading: true, activePageId: null, activeCanvasId: null }),
    false,
  );
});

test('an active document keeps /app on the document workspace', () => {
  const base = { initialDocumentRestoreComplete: true, isLoading: false };
  assert.equal(shouldFallBackToLibrary({ ...base, activePageId: 'page-1', activeCanvasId: null }), false);
  assert.equal(shouldFallBackToLibrary({ ...base, activePageId: null, activeCanvasId: 'canvas-1' }), false);
  assert.equal(shouldFallBackToLibrary({ ...base, activePageId: 'page-1', activeCanvasId: 'canvas-1' }), false);
});

test('after a settled restore pass with no valid document, /app falls through to the Library', () => {
  assert.equal(
    shouldFallBackToLibrary({ initialDocumentRestoreComplete: true, isLoading: false, activePageId: null, activeCanvasId: null }),
    true,
  );
});

test('startup restores through the canonical content path before the landing decision unlocks', async () => {
  const app = await readFile(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  const hydrateIndex = app.indexOf('loadWorkspaceContents(restoredWorkspaceId)');
  const unlockIndex = app.indexOf('markInitialDocumentRestoreComplete()');
  assert.ok(hydrateIndex > -1, 'App init must restore the persisted document via loadWorkspaceContents');
  assert.ok(unlockIndex > hydrateIndex, 'restore completion must be marked only after the canonical restore');

  const workspaceContent = await readFile(new URL('../src/components/workspace/WorkspaceContent.tsx', import.meta.url), 'utf8');
  assert.match(workspaceContent, /shouldFallBackToLibrary\(/);
  assert.match(workspaceContent, /initialDocumentRestoreComplete/);
  assert.match(workspaceContent, /location !== '\/app'/);
});

test('normal builds route the bare launch origin into the app while retaining an explicit landing route', async () => {
  const app = await readFile(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /import \{ Redirect, Route, Switch, Router, useLocation \} from 'wouter'/);
  assert.match(app, /VITE_MARKETING_ONLY === 'true' \? <LandingPage \/> : <Redirect to="\/app\/library" \/>/);
  assert.match(app, /<Route path="\/landing" component=\{LandingPage\} \/>/);
});
