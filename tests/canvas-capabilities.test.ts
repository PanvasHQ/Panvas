import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  libraryDisplayName,
  parseExcalidrawLibrary,
  requireLibraryFileName,
  serializeExcalidrawLibrary,
} from '../src/services/canvas/canvasLibraryModel.ts';
import { CANVAS_BACKGROUND_PRESETS, normalizeCanvasColor, toColorInputValue } from '../src/components/canvas/canvasBackgrounds.ts';
import {
  captureCanvasSceneElementIds,
  createExcalidrawShapeSkeleton,
  findCurrentGestureFreedrawElement,
  recognizeCanvasGesture,
} from '../src/components/canvas/canvasGestureRecognition.ts';
import { getDeletedWorkspaceItems, setSectionDeletedAt } from '../electron/ipc/workspace-trash.ts';
import {
  createCanvasInitialAppState,
  resolveCanvasDocumentBackground,
  isSafeCanvasEmbedUrl,
  isTrustedExcalidrawLibraryUrl,
  mergeCanvasAppStateForPersistence,
  resolveCanvasEditorTheme,
} from '../src/services/canvas/canvasSceneState.ts';

const sampleItem = {
  id: 'library-item-1',
  status: 'published',
  created: 1,
  elements: [{ id: 'element-1', type: 'rectangle' }],
};

test('Excalidraw library model accepts current and legacy payloads and normalizes display names', () => {
  const serialized = serializeExcalidrawLibrary([sampleItem]);
  assert.deepEqual(parseExcalidrawLibrary(serialized), [sampleItem]);
  assert.deepEqual(parseExcalidrawLibrary(JSON.stringify([[sampleItem.elements[0]]])), [[sampleItem.elements[0]]]);
  assert.equal(libraryDisplayName('engineering-diagrams.excalidrawlib'), 'engineering diagrams');
});

test('Excalidraw library validation rejects path traversal and malformed payloads', () => {
  assert.throws(() => requireLibraryFileName('../escape.excalidrawlib'), /Invalid Excalidraw library file name/);
  assert.throws(() => requireLibraryFileName('notes.json'), /Invalid Excalidraw library file name/);
  assert.throws(() => parseExcalidrawLibrary('{broken'), /not valid JSON/);
  assert.throws(() => parseExcalidrawLibrary(JSON.stringify({ type: 'excalidrawlib' })), /not a valid Excalidraw library/);
});

test('canvas toolbar exposes supported tools and a coherent settings and file surface', async () => {
  const [toolbar, view, audio] = await Promise.all([
    readFile('src/components/canvas/CanvasToolbar.tsx', 'utf8'),
    readFile('src/components/canvas/CanvasView.tsx', 'utf8'),
    readFile('src/components/canvas/CanvasAudioControl.tsx', 'utf8'),
  ]);
  for (const tool of ["setTool('diamond')", "setTool('frame')", "setTool('embeddable')", "setTool('laser')"]) assert.match(toolbar, new RegExp(tool.replace(/[()']/g, '\\$&')));
  for (const state of ['gridSize', 'objectsSnapModeEnabled', 'activeTool.locked', 'isBindingEnabled', 'viewModeEnabled', 'zenModeEnabled', 'viewBackgroundColor']) assert.match(toolbar, new RegExp(state.replace('.', '\\.')));
  for (const control of ['Draw to shape', 'Grid and grid snap', 'Snap to objects', 'Save now', 'Export PNG', 'Fit content', 'Full screen']) assert.match(toolbar, new RegExp(control));
  for (const unsupported of ['Lasso selection', 'Bucket fill', 'Snap to midpoints']) assert.doesNotMatch(toolbar, new RegExp(unsupported));
  assert.match(toolbar, /onBackgroundColorChange/);
  assert.match(toolbar, /<CanvasAudioControl \/>/);
  assert.match(toolbar, /Show canvas toolbar/);
  assert.match(toolbar, /Hide canvas toolbar/);
  assert.doesNotMatch(view, /<CanvasAudioControl/);
  assert.doesNotMatch(audio, /absolute right-4 top-20/);
});

function pointsFromCoordinates(coordinates: Array<[number, number]>, stepMs = 30) {
  return coordinates.map(([x, y], index) => ({ x, y, pressure: 1, t: index * stepMs }));
}

test('canvas background palette is restrained and validates custom colors', () => {
  assert.equal(CANVAS_BACKGROUND_PRESETS.length, 8);
  assert.deepEqual(CANVAS_BACKGROUND_PRESETS.map((preset) => preset.label), ['Warm Paper', 'White', 'Soft Gray', 'Soft Blue', 'Subtle Green', 'Charcoal', 'Black', 'Transparent']);
  assert.equal(normalizeCanvasColor('#abc'), '#abc');
  assert.equal(normalizeCanvasColor('#ABCDEF'), '#abcdef');
  assert.equal(normalizeCanvasColor('#aabbccdd'), '#aabbccdd');
  assert.equal(normalizeCanvasColor('transparent'), 'transparent');
  assert.equal(normalizeCanvasColor('not-a-color'), null);
  assert.equal(toColorInputValue('#abc'), '#aabbcc');
  assert.equal(toColorInputValue('transparent'), '#ffffff');
});

test('canvas polish exposes authoritative selected-object actions while hiding duplicate chrome', async () => {
  const [styles, toolbar, view] = await Promise.all([
    readFile('src/styles/index.css', 'utf8'),
    readFile('src/components/canvas/CanvasToolbar.tsx', 'utf8'),
    readFile('src/components/canvas/CanvasView.tsx', 'utf8'),
  ]);
  for (const selector of ['.excalidraw .help-icon', '.excalidraw .help-menu-button', '.excalidraw .layer-ui__wrapper__footer-right', '.excalidraw .layer-ui__wrapper__footer-left']) {
    assert.match(styles, new RegExp(selector.replace(/[.]/g, '\\$&')));
  }
  assert.match(styles, /\.selected-shape-actions/);
  assert.match(styles, /\.App-menu_top \.shapes-section/);
  assert.match(toolbar, /Align edges and centers with nearby objects/);
  assert.match(view, /gestureRef\.current\.points\.push\(point\)/);
  assert.match(view, /activeBackgroundColor/);
});

test('canvas state defaults, persistence allowlist, embeds, and library callbacks are safe', () => {
  assert.equal(resolveCanvasEditorTheme('system', 'dark'), 'dark');
  assert.equal(resolveCanvasEditorTheme('system', 'ink'), 'light');
  assert.equal(createCanvasInitialAppState({}, 'light').viewBackgroundColor, '#f7f1e3');
  assert.equal(createCanvasInitialAppState({ viewBackgroundColor: '#123456' }, 'dark').viewBackgroundColor, '#123456');
  assert.equal(resolveCanvasDocumentBackground({ viewBackgroundColor: '#E8F5EC' }), '#e8f5ec');
  assert.equal(resolveCanvasDocumentBackground({ viewBackgroundColor: 'transparent' }), 'transparent');
  const merged = mergeCanvasAppStateForPersistence({ futureField: 1, gridSize: null }, { gridSize: 20, transientField: 2 });
  assert.deepEqual(merged, { futureField: 1, gridSize: 20 });
  assert.equal(isSafeCanvasEmbedUrl('https://example.com/diagram'), true);
  assert.equal(isSafeCanvasEmbedUrl('javascript:alert(1)'), false);
  assert.equal(isSafeCanvasEmbedUrl('http://example.com'), false);
  assert.equal(isTrustedExcalidrawLibraryUrl('https://libraries.excalidraw.com/libraries/test.excalidrawlib'), true);
  assert.equal(isTrustedExcalidrawLibraryUrl('https://evil.example/test.excalidrawlib'), false);
});

test('canvas draw-to-shape adapter recognizes conservative native geometry', () => {
  const ellipse = Array.from({ length: 25 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 24;
    return [100 + 100 * Math.cos(angle), 80 + 60 * Math.sin(angle)] as [number, number];
  });
  const rectangle: Array<[number, number]> = [];
  const corners: Array<[number, number]> = [[0, 0], [200, 0], [200, 120], [0, 120], [0, 0]];
  for (let segment = 0; segment < 4; segment += 1) {
    const [start, end] = [corners[segment], corners[segment + 1]];
    for (let step = 0; step < 6; step += 1) {
      rectangle.push([start[0] + ((end[0] - start[0]) * step) / 6, start[1] + ((end[1] - start[1]) * step) / 6]);
    }
  }
  rectangle.push([0, 0]);
  const line = pointsFromCoordinates(Array.from({ length: 10 }, (_, index) => [index * 20, index * 20 + Math.sin(index) * 0.2] as [number, number]), 50);

  assert.equal(recognizeCanvasGesture(pointsFromCoordinates(ellipse)).type, 'ellipse');
  assert.equal(recognizeCanvasGesture(pointsFromCoordinates(rectangle)).type, 'rectangle');
  assert.equal(recognizeCanvasGesture(line, { snapToAngles: true })?.type, 'line');
  assert.equal(recognizeCanvasGesture(line, { snapToAngles: true })?.snapped, true);
  const nativeLine = recognizeCanvasGesture(line, { snapToAngles: true });
  assert.equal(createExcalidrawShapeSkeleton(nativeLine!, { strokeColor: '#ef4444' }).type, 'line');
  assert.deepEqual(createExcalidrawShapeSkeleton(nativeLine!, { strokeColor: '#ef4444' }).points, [[0, 0], [nativeLine!.width, nativeLine!.height]]);
});

test('canvas draw-to-shape adapter recognizes a deliberate arrow and emits native arrow metadata', () => {
  const arrowCoordinates: Array<[number, number]> = [];
  for (let index = 0; index <= 8; index += 1) arrowCoordinates.push([index * 20, 0]);
  arrowCoordinates.push([150, -10], [140, -20], [125, -25], [140, -15], [155, -5], [160, 0]);
  arrowCoordinates.push([150, 10], [140, 20], [125, 25]);

  const recognition = recognizeCanvasGesture(pointsFromCoordinates(arrowCoordinates, 30));
  assert.equal(recognition?.type, 'arrow');
  const nativeArrow = createExcalidrawShapeSkeleton(recognition!, { strokeColor: '#ef4444' });
  assert.equal(nativeArrow.type, 'arrow');
  assert.equal(nativeArrow.endArrowhead, 'arrow');
});

test('canvas draw-to-shape adapter rejects ambiguous and open strokes', () => {
  const open = pointsFromCoordinates(Array.from({ length: 20 }, (_, index) => {
    const angle = Math.PI * (index / 19);
    return [100 + 90 * Math.cos(angle), 100 + 60 * Math.sin(angle)] as [number, number];
  }));
  const scribble = pointsFromCoordinates(Array.from({ length: 30 }, (_, index) => [100 + Math.sin(index * 1.7) * 45, 100 + Math.cos(index * 1.2) * 35] as [number, number]));
  assert.equal(recognizeCanvasGesture(open), null);
  assert.equal(recognizeCanvasGesture(scribble), null);
});

test('canvas draw-to-shape selects only the freedraw created by the current gesture', () => {
  const existingStroke = { id: 'existing-stroke', type: 'freedraw' };
  const existingShape = { id: 'existing-shape', type: 'rectangle' };
  const deletedOldStroke = { id: 'deleted-stroke', type: 'freedraw', isDeleted: true };
  const beforeGesture = captureCanvasSceneElementIds([existingStroke, existingShape, deletedOldStroke]);
  const currentStroke = { id: 'current-stroke', type: 'freedraw' };

  // 1. Exact current stroke is found when exactly one new freedraw appears
  assert.equal(
    findCurrentGestureFreedrawElement([existingStroke, existingShape, deletedOldStroke, currentStroke], beforeGesture),
    currentStroke,
  );
  // 2. Existing strokes are never selected if no new freedraw exists
  assert.equal(findCurrentGestureFreedrawElement([existingStroke, existingShape], beforeGesture), null);
  // 3. Deleted elements in scene are ignored when finding candidates
  const deletedNewStroke = { id: 'deleted-new-stroke', type: 'freedraw', isDeleted: true };
  assert.equal(
    findCurrentGestureFreedrawElement([existingStroke, deletedNewStroke, currentStroke], beforeGesture),
    currentStroke,
  );
  // 4. If multiple new freedraws appear, the latest created is targeted
  const secondNewStroke = { id: 'second-new-stroke', type: 'freedraw' };
  assert.equal(
    findCurrentGestureFreedrawElement([existingStroke, currentStroke, secondNewStroke], beforeGesture),
    secondNewStroke,
  );
});

test('canvas draw-to-shape replacement produces valid native element replacement', () => {
  const circlePoints = Array.from({ length: 25 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 24;
    return [150 + 80 * Math.cos(angle), 150 + 80 * Math.sin(angle)] as [number, number];
  });
  const recognition = recognizeCanvasGesture(pointsFromCoordinates(circlePoints), { snapEqualSides: true });
  assert.ok(recognition);
  assert.equal(recognition.type, 'ellipse');

  const skeleton = createExcalidrawShapeSkeleton(recognition, {
    strokeColor: '#3b82f6',
    backgroundColor: '#ffffff',
    strokeWidth: 3,
  });
  assert.equal(skeleton.type, 'ellipse');
  assert.equal(skeleton.strokeColor, '#3b82f6');
  assert.equal(skeleton.backgroundColor, '#ffffff');
  assert.equal(skeleton.strokeWidth, 3);
});

test('Electron section trash cascades canvases on delete and restore and lists canvas/folder trash', async () => {
  const workspace = {
    folders: [{ id: 'deleted-folder', deletedAt: 10 }, { id: 'active-folder', deletedAt: null }],
    canvasFiles: [
      { id: 'section-canvas', sectionId: 'section-a', deletedAt: null },
      { id: 'other-canvas', sectionId: 'section-b', deletedAt: 5 },
    ],
    notebooks: [],
    notebookSections: [{ id: 'section-a', deletedAt: null }],
    notebookPages: [{ id: 'section-page', sectionId: 'section-a', deletedAt: null }],
  };

  assert.equal(setSectionDeletedAt(workspace, 'section-a', 100, 100), true);
  assert.equal(workspace.canvasFiles[0].deletedAt, 100);
  assert.equal(workspace.notebookPages[0].deletedAt, 100);
  let trash = getDeletedWorkspaceItems(workspace);
  assert.deepEqual(trash.folders.map(item => item.id), ['deleted-folder']);
  assert.deepEqual(trash.canvasFiles.map(item => item.id), ['other-canvas']);

  assert.equal(setSectionDeletedAt(workspace, 'section-a', null, 200), true);
  assert.equal(workspace.canvasFiles[0].deletedAt, null);
  assert.equal(workspace.notebookPages[0].deletedAt, null);
  assert.equal(workspace.canvasFiles[1].deletedAt, 5, 'unrelated deleted canvas remains untouched');
  trash = getDeletedWorkspaceItems(workspace);
  assert.deepEqual(trash.canvasFiles.map(item => item.id), ['other-canvas']);

  const [handlers, store] = await Promise.all([
    readFile('electron/ipc/domain-handlers.ts', 'utf8'),
    readFile('src/stores/workspaceStore.ts', 'utf8'),
  ]);
  assert.match(handlers, /setSectionDeletedAt\(ws, sectionId, Date\.now\(\)\)/);
  assert.match(handlers, /getDeletedWorkspaceItems\(\{ \.\.\.ws, workspaces: \[ws\] \}\)/);
  assert.match(store, /getDeletedItems\(userId\)/);
  assert.match(store, /deletedCanvases: roots\.canvasFiles/);
  assert.match(store, /must not masquerade as an empty Trash/);
});

test('library IPC remains a narrow validated workspace-scoped bridge', async () => {
  const [handlers, preload, view] = await Promise.all([
    readFile('electron/ipc/domain-handlers.ts', 'utf8'),
    readFile('electron/preload.ts', 'utf8'),
    readFile('src/components/canvas/CanvasView.tsx', 'utf8'),
  ]);
  for (const channel of ['library:getAll', 'library:import', 'library:delete']) {
    assert.match(handlers, new RegExp(channel));
    assert.match(preload, new RegExp(channel));
  }
  assert.match(handlers, /\.panvas', 'Libraries'/);
  assert.match(handlers, /requireLibraryFileName/);
  assert.match(view, /updateLibrary\(\{ libraryItems: record\.libraryItems as LibraryItems, merge: true/);
  assert.match(view, /onPointerUpdate=\{handlePointerUpdate\}/);
  assert.match(view, /createExcalidrawShapeSkeleton/);
  assert.match(view, /<DefaultSidebar/);
  assert.match(view, /<CanvasLibraryDrawer/);
});
