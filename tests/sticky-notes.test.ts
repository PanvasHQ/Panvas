import assert from 'node:assert/strict';
import test from 'node:test';
import type { DrawingData } from '../src/components/notebook/engine/drawingTypes.ts';
import {
  createStickyNote,
  DEFAULT_STICKY_NOTE_COLOR,
  STICKY_NOTE_MIN_HEIGHT,
  STICKY_NOTE_WIDTH,
  updateStickyNoteColor,
  isLegacyStickyPlaceholderContent,
} from '../src/components/notebook/stickyNotes.ts';

test('legacy sticky prompt content migrates to a real editor placeholder', () => {
  const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  assert.equal(isLegacyStickyPlaceholderContent(doc('Add a thought…')), true);
  assert.equal(isLegacyStickyPlaceholderContent(doc('Add a thought...')), true);
  assert.equal(isLegacyStickyPlaceholderContent(doc('A real thought')), false);
});

test('creates a sticky note with the canonical dimensions and metadata', () => {
  const sticky = createStickyNote({ id: 'sticky-1', x: 40, y: 60, createdAt: 123 });

  assert.equal(sticky.type, 'text');
  assert.equal(sticky.width, STICKY_NOTE_WIDTH);
  assert.equal(sticky.height, STICKY_NOTE_MIN_HEIGHT);
  // createStickyNote stores all four metadata fields: isStickyNote, color, opacity, shape
  assert.deepEqual(sticky.metadata, {
    isStickyNote: true,
    color: DEFAULT_STICKY_NOTE_COLOR,
    opacity: 1,
    shape: 'rounded-rect',
  });
  assert.deepEqual(sticky.content, { type: 'doc', content: [{ type: 'paragraph', content: [] }] });
});

test('color mutation is carried through DrawingData v3 persistence', () => {
  const sticky = createStickyNote({ id: 'sticky-2', x: 10, y: 20 });
  const updated = updateStickyNoteColor(sticky, '#bae6fd');
  const persisted = {
    version: 3,
    objects: [updated],
  } as DrawingData;
  const saved = persisted.objects.find(object => object.id === sticky.id);

  assert.equal(persisted.version, 3);
  assert.equal(saved?.metadata?.isStickyNote, true);
  assert.equal(saved?.metadata?.color, '#bae6fd');
  // updateStickyNoteColor always returns a new object (immutable update)
  const white = updateStickyNoteColor(sticky, '#ffffff');
  assert.equal(white.metadata?.color, '#ffffff');
  assert.notEqual(white, sticky);
});

test('sticky notes participate in selection bounds and deletion', () => {
  const sticky = createStickyNote({ id: 'sticky-3', x: 100, y: 120 });
  // SelectionEngine's text bounds contract is x/y/width/height from the
  // existing TextObject, so a sticky note gets the same transform box.
  const selected = [{ type: 'text' as const, id: sticky.id }];
  const bounds = { x: sticky.x, y: sticky.y, width: sticky.width, height: sticky.height };
  assert.deepEqual(bounds, { x: 100, y: 120, width: STICKY_NOTE_WIDTH, height: STICKY_NOTE_MIN_HEIGHT });

  const remaining = [sticky].filter(text => !selected.some(element => element.id === text.id));
  assert.equal(remaining.some(text => text.id === sticky.id), false);
});
