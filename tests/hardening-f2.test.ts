import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';

test('HARDEN-021 provides the Windows icon scaffold without signing or installer execution', async () => {
  const [manifest, main, icon, gitignore] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('electron/main.ts', 'utf8'),
    readFile('build/icon.ico'),
    readFile('.gitignore', 'utf8'),
  ]);
  const packageJson = JSON.parse(manifest);
  assert.equal(packageJson.build?.win?.icon, 'build/icon.ico');
  assert.match(gitignore, /!build\/icon\.ico/);
  for (const generatedPath of ['dist-electron/', 'dist/', 'tsconfig.tsbuildinfo', 'Landingpage.png']) {
    assert.match(gitignore, new RegExp(generatedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(packageJson.build?.appId, 'com.panvas.app');
  assert.match(main, /build', 'icon\.ico/);
  assert.match(main, /existsSync\(packagedIconPath\)/);
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const count = icon.readUInt16LE(4);
  assert.equal(count, 7);
  const expectedSizes = [16, 24, 32, 48, 64, 128, 256];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const width = icon[entry] === 0 ? 256 : icon[entry];
    const height = icon[entry + 1] === 0 ? 256 : icon[entry + 1];
    assert.deepEqual([width, height], [expectedSizes[index], expectedSizes[index]]);
    assert.equal(icon.readUInt16LE(entry + 4), 1);
    assert.equal(icon.readUInt16LE(entry + 6), 32);
    assert.equal(icon.readUInt32LE(entry + 8) > 0, true);
  }
  assert.doesNotMatch(manifest, /certificateFile|certificatePassword|signingHashAlgorithms/i);
});

test('HARDEN-022 keeps core typography offline with licensed local faces and safe fallbacks', async () => {
  const [html, bootstrap, fonts, fontStyles, manifestText] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('src/bootstrap.tsx', 'utf8'),
    readFile('src/components/notebook/textFonts.ts', 'utf8'),
    readFile('src/styles/editor-fonts.css', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);
  const dependencies = JSON.parse(manifestText).dependencies as Record<string, string>;
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com|data-panvas-editor-fonts/);
  assert.doesNotMatch(bootstrap, /fonts\.googleapis|data-panvas-editor-fonts|dataset\.href/);
  assert.match(bootstrap, /styles\/editor-fonts\.css/);
  assert.doesNotMatch(fontStyles, /https?:\/\//);
  assert.equal(dependencies['@fontsource/sacramento'], '5.3.0');
  assert.equal(dependencies['@fontsource/patrick-hand'], '5.3.0');
  assert.match(fonts, /document\.fonts\.load/);
  assert.match(fonts, /systemFaceAvailable\(face\)/);
  assert.match(fonts, /return 'unavailable' as const/);
  assert.doesNotMatch(fonts, /waitForEditorStyles|fonts\.googleapis|fetch\(/);
});

test('HARDEN-023 names active icon-only controls without changing keyboard handlers', async () => {
  const files = [
    'src/components/canvas/CanvasVoiceNote.tsx',
    'src/components/canvas/PdfBlock.tsx',
    'src/components/notebook/NotebookWorkspaceControls.tsx',
    'src/components/layout/TrashSection.tsx',
    'src/components/workspace/WorkspaceTree.tsx',
    'src/components/notebook/NotebookElementsControl.tsx',
    'src/components/workspace/ReferencePagePane.tsx',
  ];
  const sources = await Promise.all(files.map(file => readFile(file, 'utf8')));
  const source = sources.join('\n');
  for (const label of [
    'Play voice note', 'Voice note playback position', 'Previous PDF page',
    'Next PDF page', 'Zoom out PDF', 'Zoom in PDF', 'Delete PDF block',
    'More actions for', 'Zoom out reference', 'Zoom in reference',
  ]) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /onKeyDown=\{event => \{ if \(event\.key === 'Enter'/);
});

test('HARDEN-024 keeps active optimized assets and removes only unreferenced duplicate folders', async () => {
  await access('public/Application SS updated/optimized/HeroResearchWorkSpace-1280.webp');
  await assert.rejects(access('public/app-screenshots'));
  await assert.rejects(access('public/Application SS'));
  const [auth, landing, product] = await Promise.all([
    readFile('src/components/auth/AuthLayout.tsx', 'utf8'),
    readFile('src/components/marketing/LandingPage.tsx', 'utf8'),
    readFile('src/components/marketing/ProductDepth.tsx', 'utf8'),
  ]);
  assert.doesNotMatch(auth, /app-screenshots/);
  assert.match(auth, /Application SS updated\/optimized\/HeroResearchWorkSpace-1280\.webp/);
  assert.match(landing, /type="image\/webp"/);
  assert.match(product, /Application SS updated\/optimized/);
});

test('HARDEN-025 lazy-loads legacy auth forms while preserving callback and Google Drive paths', async () => {
  const [app, guard, cloud, packageText] = await Promise.all([
    readFile('src/app/App.tsx', 'utf8'),
    readFile('src/components/auth/AuthGuard.tsx', 'utf8'),
    readFile('src/components/library/CloudSyncPanel.tsx', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);
  for (const page of ['LoginPage', 'SignUpPage', 'ForgotPasswordPage', 'ResetPasswordPage']) {
    assert.match(app, new RegExp(`React\\.lazy\\(\\(\\) => import\\('[^']*${page}'\\)`));
  }
  assert.doesNotMatch(app, /import \{ (?:LoginPage|SignUpPage|ForgotPasswordPage|ResetPasswordPage) \} from/);
  assert.match(app, /\/auth\/login/);
  assert.match(app, /\/auth\/signup/);
  assert.match(app, /\/auth\/forgot-password/);
  assert.match(app, /\/auth\/reset-password/);
  assert.match(app, /AuthCallbackHandler/);
  assert.match(guard, /Connect Google Drive/);
  assert.match(cloud, /requestConnect\('googledrive'\)/);
  assert.match(packageText, /"@supabase\/supabase-js"/);
});
