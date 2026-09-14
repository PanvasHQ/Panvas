import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import path from 'node:path';
import { createServer } from 'vite';

async function loadUiComponents() {
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': path.resolve('src') } },
  });
  try {
    const [dialog, boundary] = await Promise.all([
      server.ssrLoadModule('/src/components/ui/ConfirmDialog.tsx'),
      server.ssrLoadModule('/src/components/ui/ErrorBoundary.tsx'),
    ]);
    return { dialog, boundary };
  } finally {
    await server.close();
  }
}

test('NotebookRenderer owns engine cleanup without coupling it to ordinary renders', async () => {
  const renderer = await readFile('src/components/notebook/NotebookRenderer.tsx', 'utf8');
  assert.match(renderer, /useMemo\(\(\) => new NotebookEngine\(\), \[\]\)/);
  assert.match(renderer, /useEffect\(\(\) => \{\s*return \(\) => notebookEngine\.destroy\(\);\s*\}, \[notebookEngine\]\)/);
  assert.equal((renderer.match(/notebookEngine\.destroy\(\)/g) ?? []).length, 1);
});

test('active destructive paths use the shared async confirmation dialog', async () => {
  const paths = [
    'src/components/layout/TrashSection.tsx',
    'src/components/library/CloudSyncPanel.tsx',
    'src/components/library/LibraryWorkspace.tsx',
    'src/components/notebook/NotebookToolPropertiesPanel.tsx',
  ];
  const sources = await Promise.all(paths.map(path => readFile(path, 'utf8')));
  for (const source of sources) {
    assert.doesNotMatch(source, /window\.confirm/);
    assert.match(source, /ConfirmDialog/);
  }
  assert.match(sources[0], /Empty Trash permanently\?/);
  assert.match(sources[1], /Move workspace sync\?/);
  assert.match(sources[2], /Delete this item permanently\?/);
  assert.match(sources[3], /Apply changes to every page\?/);
});

test('ConfirmDialog exposes an accessible cancel/confirm surface and does not run actions while rendering', () => {
  return loadUiComponents().then(({ dialog }) => {
    const ConfirmDialog = dialog.ConfirmDialog as React.ComponentType<any>;
    let cancelled = 0;
    let confirmed = 0;
    const html = renderToStaticMarkup(React.createElement(ConfirmDialog, {
      open: true,
      title: 'Delete this item permanently?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete permanently',
      onCancel: () => { cancelled += 1; },
      onConfirm: () => { confirmed += 1; },
    }));
    assert.match(html, /role="alertdialog"/);
    assert.match(html, />Cancel</);
    assert.match(html, />Delete permanently</);
    assert.equal(cancelled, 0);
    assert.equal(confirmed, 0);
  });
});

test('viewport error fallback is isolated, retryable, and does not clear application data', () => {
  return loadUiComponents().then(({ boundary: boundaryModule }) => {
    const { ErrorBoundary, ViewportErrorFallback } = boundaryModule as any;
    const error = new Error('synthetic viewport failure');
    const state = ErrorBoundary.getDerivedStateFromError(error);
    assert.equal(state.hasError, true);
    assert.equal(state.error, error);

    const boundary = new ErrorBoundary({
      surface: 'Notebook viewport',
      fallback: (_caughtError: Error, retry: () => void) => React.createElement(ViewportErrorFallback, {
        surface: 'Notebook viewport',
        onRetry: retry,
      }),
    });
    boundary.state = state;
    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
    assert.match(html, /Notebook viewport is unavailable/);
    assert.match(html, /Your local data is unchanged/);
    assert.match(html, />Retry</);
    assert.doesNotMatch(html, /synthetic viewport failure/);
  });
});

test('major workspace viewports are wrapped by isolated error boundaries', async () => {
  const [workspace, app] = await Promise.all([
    readFile('src/components/workspace/WorkspaceContent.tsx', 'utf8'),
    readFile('src/app/App.tsx', 'utf8'),
  ]);
  for (const surface of ['PDF workspace', 'Notebook viewport', 'Canvas viewport', 'Reference pane']) {
    assert.match(workspace, new RegExp(`surface="${surface}"`));
  }
  assert.match(app, /surface="Library workspace"/);
  assert.match(workspace, /onNavigate=\{\(\) => setLocation\('\/app\/library'\)\}/);
});
