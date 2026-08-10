import React, { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { FontSize } from './FontSizeExtension';
import { SlashMenuExtension } from './SlashMenuExtension';
import slashSuggestion from './slashSuggestion';
import type { TextObject } from './engine/drawingTypes';
import type { NotebookEngine } from './engine/NotebookEngine';

interface FloatingTextEditorProps {
  object: TextObject;
  engine: NotebookEngine;
  scale: number;
  toolMode: string;
  onFocus: (editor: Editor) => void;
  onBlur: () => void;
}

export const FloatingTextEditor: React.FC<FloatingTextEditorProps> = ({ object, engine, scale, toolMode, onFocus, onBlur }) => {
  const isSelected = engine.selection.getSelectedElements().some(el => el.id === object.id);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Type something...' }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      SlashMenuExtension.configure({ suggestion: slashSuggestion }),
    ],
    content: object.content,
    onUpdate: ({ editor }) => {
      engine.texts.updateTextContent(object.id, editor.getJSON());
      engine.history.pushExecuted({ description: 'Text change', execute: () => {}, undo: () => {} });
    },
    onFocus: ({ editor }) => {
      onFocus(editor);
    },
    onBlur: ({ editor }) => {
      onBlur();
      // Remove empty text boxes automatically to prevent ghost placeholders
      if (editor.getText().trim() === '') {
        // Run outside of current render cycle to avoid React update conflicts
        setTimeout(() => {
          engine.history.push({
            description: 'Remove empty text box',
            execute: () => {
              engine.texts.removeText(object.id);
              engine.selection.clearSelection();
            },
            undo: () => {}
          });
        }, 0);
      }
    },
  });

  useEffect(() => {
    if (editor) {
      engine.texts.registerEditor(object.id, editor);
      return () => engine.texts.unregisterEditor(object.id);
    }
  }, [editor, engine, object.id]);

  // Listen for the custom event to focus this editor
  useEffect(() => {
    const handleFocus = (e: CustomEvent) => {
      if (e.detail.id === object.id && editor) {
        editor.commands.focus('end');
      }
    };
    document.addEventListener('panvas:focus-text' as any, handleFocus);
    return () => document.removeEventListener('panvas:focus-text' as any, handleFocus);
  }, [object.id, editor]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync actual height back to the engine so selection engine draws correct bounds
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const height = entries[0].contentRect.height;
        // Divide by scale because the element has transform: scale() which affects getBoundingClientRect,
        // but contentRect is pre-transform size.
        engine.texts.updateTextBounds(object.id, object.width, height);
        // Force redraw so selection box updates
        engine.drawing.redraw();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [object.id, object.width, engine]);

  if (!editor) return null;

  const isInteractive = editor.isFocused;

  return (
    <div
      ref={containerRef}
      className={`absolute ${isSelected ? 'ring-2 ring-blue-500 rounded-sm' : ''} ${isInteractive ? 'pointer-events-auto z-20' : 'pointer-events-none z-0'}`}
      style={{
        left: `${object.x * scale}px`,
        top: `${object.y * scale}px`,
        width: `${object.width}px`,
        // Note: minHeight can be added if needed
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
      onPointerDown={(e) => {
        if (editor.isFocused) {
          e.stopPropagation();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          editor.commands.blur();
          engine.tools.setMode('select');
        }
      }}
    >
      <EditorContent 
        editor={editor} 
        className="outline-none prose prose-neutral max-w-none prose-sm p-1" 
        style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
      />
    </div>
  );
};
