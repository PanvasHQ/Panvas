import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import type { LocalSearchDocument } from '../src/services/search/LocalSearchIndex.ts';
import { rankLocalSearchDocuments } from '../src/services/search/rankLocalSearchDocuments.ts';
import { extractPageSearchContent } from '../src/services/search/pageSearchContent.ts';
import { queuePageSearchSave, subscribeToPageSearchSaves } from '../src/services/search/searchIndexEvents.ts';
import { applyPageSearchSave, isSearchIndexValid, type SearchIndexMutationState } from '../src/services/search/localSearchIndexState.ts';
import { createLocalSearchScopeKey } from '../src/services/search/searchIndexScope.ts';
import { renderPdfAnnotations } from '../src/services/pdf/renderPdfAnnotations.ts';
import { validatePdfImport } from '../src/services/pdf/validatePdfImport.ts';

const documents: LocalSearchDocument[] = [
  { id: 'title', kind: 'page', workspaceId: 'ws', title: 'Release checklist', content: 'ordinary content', handwritingText: '', richText: 'ordinary content', snippet: 'ordinary content', tags: ['page'], updatedAt: 1 },
  { id: 'content', kind: 'page', workspaceId: 'ws', title: 'Notes', content: `Before shipping, review the release checklist and recovery notes. ${'padding '.repeat(30)}`, handwritingText: '', richText: `Before shipping, review the release checklist and recovery notes. ${'padding '.repeat(30)}`, snippet: 'Before shipping, review the release checklist and recovery notes.', tags: ['page'], updatedAt: 3 },
  { id: 'partial', kind: 'page', workspaceId: 'ws', title: 'Release notes', content: 'nothing about the other word', handwritingText: '', richText: 'nothing about the other word', snippet: 'nothing about the other word', tags: ['page'], updatedAt: 4 },
];

test('local search is deterministic, ranks titles first, and requires every query term', () => {
  const results = rankLocalSearchDocuments(documents, 'release checklist');
  assert.deepEqual(results.map(result => result.id), ['title', 'content']);
  assert.match(results[1].excerpt, /release checklist/);
});

test('a populated search scope is reusable while an empty or changed scope rebuilds', () => {
  const source = {
    workspaceId: 'ws', folders: [], canvasFiles: [], notebooks: [], sections: [], pages: [],
  };
  const scopeKey = createLocalSearchScopeKey(source);
  assert.equal(isSearchIndexValid([{ id: 'record' }], scopeKey, scopeKey), true);
  assert.equal(isSearchIndexValid([], scopeKey, scopeKey), false);
  assert.equal(isSearchIndexValid([{ id: 'record' }], scopeKey, `${scopeKey}-changed`), false);
});

const tipTapText = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function mutationState(documents: LocalSearchDocument[]): SearchIndexMutationState {
  return {
    documents,
    pagePayloads: new Map(),
    pdfAnnotationPayloads: new Map(),
  };
}

test('incremental notebook saves replace searchable rich text without rebuilding', () => {
  const state = mutationState([{
    id: 'page-1', kind: 'page', workspaceId: 'ws', notebookId: 'book', pageId: 'page-1',
    title: 'Duplicate title', content: 'old text', handwritingText: '', richText: 'old text',
    snippet: 'old text', tags: ['page'], updatedAt: 1,
  }]);
  applyPageSearchSave(state, {
    workspaceId: 'ws', notebookId: 'book', pageId: 'page-1', kind: 'content', data: tipTapText('new C++ parser notes'),
  });
  assert.equal(state.documents.length, 1);
  assert.match(state.documents[0].richText, /new C\+\+ parser notes/);
  assert.equal(rankLocalSearchDocuments(state.documents, 'C++ parser')[0].id, 'page-1');
});

test('incremental PDF annotation saves update only the matching source page', () => {
  const state = mutationState([
    {
      id: 'pdf-owner:1', kind: 'pdf', workspaceId: 'ws', notebookId: 'book', pageId: 'pdf-owner',
      pageNumber: 1, pdfPageNumber: 1, title: 'Duplicate title', pdfEmbeddedText: 'source one',
      content: 'source one', handwritingText: '', richText: 'source one', snippet: 'source one', tags: ['pdf'], updatedAt: 1,
    },
    {
      id: 'pdf-owner:2', kind: 'pdf', workspaceId: 'ws', notebookId: 'book', pageId: 'pdf-owner',
      pageNumber: 2, pdfPageNumber: 2, title: 'Duplicate title', pdfEmbeddedText: 'source two',
      content: 'source two', handwritingText: '', richText: 'source two', snippet: 'source two', tags: ['pdf'], updatedAt: 1,
    },
  ]);
  applyPageSearchSave(state, {
    workspaceId: 'ws', notebookId: 'book', pageId: 'pdf-owner_pdf_2', kind: 'drawing',
    pdfOwnerPageId: 'pdf-owner', pdfSourcePage: 2,
    data: { objects: [{ id: 'ink-2', type: 'text', x: 0, y: 0, width: 100, createdAt: 2, metadata: { generatedFrom: 'handwriting-recognition' }, content: tipTapText('review diagram') }] },
  });
  assert.equal(state.documents.length, 2);
  assert.equal(state.documents[0].content, 'source one');
  assert.match(state.documents[1].content, /source two/);
  assert.match(state.documents[1].content, /review diagram/);
  assert.equal(rankLocalSearchDocuments(state.documents, 'review diagram')[0].id, 'pdf-owner:2');
  assert.equal(state.pdfAnnotationPayloads.size, 1);
});

test('repeated annotation updates do not duplicate documents or retain stale text', () => {
  const state = mutationState([{
    id: 'pdf-owner:2', kind: 'pdf', workspaceId: 'ws', notebookId: 'book', pageId: 'pdf-owner',
    pageNumber: 2, pdfPageNumber: 2, title: 'Page 2', pdfEmbeddedText: 'embedded',
    content: 'embedded', handwritingText: '', richText: 'embedded', snippet: 'embedded', tags: ['pdf'], updatedAt: 1,
  }]);
  const event = {
    workspaceId: 'ws', notebookId: 'book', pageId: 'pdf-owner_pdf_2', kind: 'drawing' as const,
    pdfOwnerPageId: 'pdf-owner', pdfSourcePage: 2,
    data: { objects: [{ id: 'ink-2', type: 'text', x: 0, y: 0, width: 100, createdAt: 2, metadata: { generatedFrom: 'handwriting-recognition' }, content: tipTapText('first annotation') }] },
  };
  applyPageSearchSave(state, event);
  applyPageSearchSave(state, { ...event, data: { objects: [{ id: 'ink-2', type: 'text', x: 0, y: 0, width: 100, createdAt: 3, metadata: { generatedFrom: 'handwriting-recognition' }, content: tipTapText('latest annotation') }] } });
  assert.equal(state.documents.length, 1);
  assert.match(state.documents[0].content, /latest annotation/);
  assert.doesNotMatch(state.documents[0].content, /first annotation/);
});

test('page search extraction separates recognized handwriting from ordinary TipTap text', () => {
  const extracted = extractPageSearchContent(
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Typed project notes' }] }] },
    {
      version: 3,
      properties: {},
      objects: [
        {
          id: 'recognized', type: 'text', x: 0, y: 0, width: 220, createdAt: 1,
          metadata: { generatedFrom: 'handwriting-recognition' },
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Offline ink result' }] }] },
        },
        {
          id: 'typed', type: 'text', x: 0, y: 80, width: 220, createdAt: 2,
          content: { type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'Architecture heading' }] }] },
        },
      ],
    },
  );

  assert.equal(extracted.handwritingText, 'Offline ink result');
  assert.equal(extracted.richText, 'Typed project notes Architecture heading');
  assert.match(extracted.content, /Offline ink result Typed project notes/);
  const result = rankLocalSearchDocuments([{ ...documents[0], ...extracted }], 'offline ink')[0];
  assert.equal(result.matchSource, 'handwriting');
  assert.match(result.excerpt, /Offline ink result/);
});

test('page save search updates are queued instead of blocking the persistence caller', async () => {
  let received = false;
  const unsubscribe = subscribeToPageSearchSaves(() => { received = true; });
  queuePageSearchSave({ workspaceId: 'ws', notebookId: 'book', pageId: 'page', kind: 'drawing', data: {} });
  assert.equal(received, false);
  await Promise.resolve();
  assert.equal(received, true);
  unsubscribe();
});

test('PDF import validation accepts readable documents and rejects corrupt bytes', async () => {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  const bytes = await document.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  assert.equal((await validatePdfImport(buffer)).pageCount, 1);
  await assert.rejects(validatePdfImport(new Uint8Array([1, 2, 3, 4]).buffer), /corrupt, encrypted, or unsupported/);
});

test('annotated PDF export includes triangles while still reporting unsupported audio', async () => {
  const source = await PDFDocument.create();
  source.addPage([300, 400]);
  const original = await source.save();
  const rendered = await renderPdfAnnotations(original, [{
    version: 2,
    properties: {
      paperColor: '#ffffff', template: 'blank', lineColor: '#d9dde5',
      orientation: 'portrait', pageSize: 'A4', margins: 'normal',
    },
    objects: [
      {
        id: 'stroke-1', type: 'stroke', tool: 'pen', createdAt: 1,
        points: [{ x: 20, y: 20, pressure: 0.5, t: 0 }, { x: 80, y: 80, pressure: 0.5, t: 1 }],
        color: '#101010', thickness: 2, opacity: 1,
      },
      {
        id: 'triangle-1', type: 'shape', shapeType: 'triangle', createdAt: 2,
        x: 100, y: 100, width: 40, height: 40, color: '#101010', strokeWidth: 2, fill: null, rotation: 0,
      },
    ],
    audioNotes: [{ id: 'audio-1', fileId: 'asset-1', fileName: 'voice.webm', mimeType: 'audio/webm', createdAt: 1 }],
  }]);

  // Triangle support is intentional: verify the exported vector path, not just counts.
  const { decodePDFRawStream } = await import('pdf-lib');
  const output = await PDFDocument.load(rendered.bytes);
  const outputPage = output.getPage(0);
  const content = outputPage.node.Contents()!.asArray().map(ref => Buffer.from(decodePDFRawStream(output.context.lookup(ref) as any).decode()).toString()).join('\n');
  assert.match(content, /120 100 m\s+140 140 l\s+100 140 l\s+h/);
  assert.equal(outputPage.getWidth(), 300);
  assert.equal(outputPage.getHeight(), 400);
  assert.equal(rendered.exportedObjects, 2);
  assert.equal(rendered.unsupportedObjects, 1);
  assert.match(rendered.warnings[0], /unsupported attachment/);
  assert.equal((await PDFDocument.load(rendered.bytes)).getPageCount(), 1);
  assert.ok(rendered.bytes.byteLength > original.byteLength);
});
