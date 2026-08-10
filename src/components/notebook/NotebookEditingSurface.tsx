import React, { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';

interface NotebookEditingSurfaceProps {
  editor: Editor | null;
  wide?: boolean;
}

export const NotebookEditingSurface: React.FC<NotebookEditingSurfaceProps> = ({ editor, wide }) => {
  return (
    <div className={`mt-10 min-h-[500px] w-full outline-none prose prose-neutral max-w-none ${wide ? 'prose-lg' : ''}`}>
      <EditorContent editor={editor} className="outline-none" />
    </div>
  );
};
