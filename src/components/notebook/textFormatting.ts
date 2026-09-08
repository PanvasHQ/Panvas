import type { Editor } from '@tiptap/react';
import type { NotebookEngine } from './engine/NotebookEngine';

export interface FormattingSelection {
  from: number;
  to: number;
}

export type FormattingCommand = (chain: any) => any;

export function isUsableFormattingEditor(editor: Editor | null | undefined): editor is Editor {
  return Boolean(editor && !editor.isDestroyed);
}

/**
 * Resolve one deterministic formatting target. Historical selections in unrelated editors
 * are deliberately ignored: ProseMirror retains them after blur, so they are not evidence
 * that an editor is still active.
 */
export function resolveFormattingEditor(
  activeEditor: Editor | null,
  engine: NotebookEngine,
): Editor | null {
  if (isUsableFormattingEditor(activeEditor)) return activeEditor;

  const selectedText = engine.selection
    .getSelectedElements()
    .find(element => element.type === 'text');
  if (!selectedText) return null;

  const selectedEditor = engine.texts.getEditor(selectedText.id) as Editor | undefined;
  return isUsableFormattingEditor(selectedEditor) ? selectedEditor : null;
}

export function captureFormattingSelection(editor: Editor): FormattingSelection {
  const { from, to } = editor.state.selection;
  return { from, to };
}

/** Restore the formatting-session range, run exactly one command, and retain the new range. */
export function runFormattingCommand(
  editor: Editor,
  selection: FormattingSelection | null,
  command: FormattingCommand,
): FormattingSelection | null {
  if (!isUsableFormattingEditor(editor)) return null;

  let chain = editor.chain();
  if (selection) {
    const maxPosition = editor.state.doc.content.size;
    const from = Math.max(0, Math.min(selection.from, maxPosition));
    const to = Math.max(from, Math.min(selection.to, maxPosition));
    chain = chain.setTextSelection({ from, to });
  }

  chain = chain.focus();
  command(chain).run();
  return captureFormattingSelection(editor);
}
