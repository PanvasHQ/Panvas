// ============================================
// Panvas — Shared TipTap Extensions & HTML Parser
// ============================================

import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { FontSize } from './FontSizeExtension';
import { generateJSON } from '@tiptap/core';

export const lowlight = createLowlight(common);

/** Accept only URLs that are safe to preserve in notebook link marks. */
export function getSafeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const url = value.trim();
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Shared, unified TipTap extensions used across FloatingTextEditor,
 * StaticTextPreview, and clipboard HTML parsing.
 */
export const notebookTipTapExtensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
    },
    // TipTap v3 StarterKit already bundles these. Disable the bundled copies because Panvas
    // registers configured Link and Underline instances below.
    link: false,
    underline: false,
    codeBlock: false, // Handled by CodeBlockLowlight
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext',
    HTMLAttributes: {
      class: 'rounded-lg bg-neutral-900 text-neutral-100 p-3.5 font-mono text-xs my-2.5 overflow-x-auto border border-neutral-700/60 shadow-inner',
    },
  }),
  Table.configure({
    resizable: true,
    HTMLAttributes: {
      class: 'panvas-table border-collapse my-3 w-full border border-neutral-700/50 rounded-md overflow-hidden',
    },
  }),
  TableRow,
  TableHeader.configure({
    HTMLAttributes: {
      class: 'bg-neutral-800/60 font-semibold p-2 border border-neutral-700/50 text-left text-xs',
    },
  }),
  TableCell.configure({
    HTMLAttributes: {
      class: 'p-2 border border-neutral-700/40 text-xs',
    },
  }),
  Link.configure({
    openOnClick: true,
    protocols: ['http', 'https'],
    isAllowedUri: (url) => getSafeHttpUrl(url) !== null,
    HTMLAttributes: {
      class: 'panvas-text-link',
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
  Underline,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
];

/**
 * Sanitize and normalize raw HTML string from OS clipboard (e.g. ChatGPT, Claude, GitHub, VS Code).
 * Preserves code blocks, syntax token language classes, tables, lists, and formatting.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (typeof DOMParser === 'undefined') return rawHtml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // 1. Remove dangerous or non-content tags
    doc.querySelectorAll('script, style, meta, link, iframe, object, embed, noscript, applet').forEach(el => el.remove());

    // 2. Normalize ChatGPT / AI code block containers
    // ChatGPT produces: <div class="..."><div class="..."><span>language</span><button>Copy code</button></div>...<pre><code class="...">...</code></pre></div>
    doc.querySelectorAll('button').forEach(btn => {
      const text = btn.textContent?.toLowerCase() || '';
      if (text.includes('copy') || text.includes('copied')) {
        btn.remove();
      }
    });

    // Preserve ordinary browser links while removing unsafe schemes before
    // TipTap parses the clipboard HTML into a Link mark.
    doc.querySelectorAll('a').forEach(anchor => {
      const safeHref = getSafeHttpUrl(anchor.getAttribute('href'));
      if (!safeHref) {
        anchor.replaceWith(...Array.from(anchor.childNodes));
        return;
      }
      anchor.setAttribute('href', safeHref);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    });

    // 3. Normalize all <pre> and code block structures
    const pres = doc.querySelectorAll('pre');
    pres.forEach(pre => {
      let codeElem = pre.querySelector('code');
      if (!codeElem) {
        // If <pre> doesn't have an inner <code>, wrap its content in <code>
        codeElem = doc.createElement('code');
        codeElem.innerHTML = pre.innerHTML;
        pre.innerHTML = '';
        pre.appendChild(codeElem);
      }

      // Detect language from class or parent elements (e.g. language-python, hljs-python, class="... python ...")
      let lang = '';
      const classes = `${pre.className} ${codeElem.className}`;
      const langMatch = classes.match(/(?:language|lang|hljs)-([a-zA-Z0-9_-]+)/i);
      if (langMatch) {
        lang = langMatch[1].toLowerCase();
      } else {
        // Check sibling or parent for language label
        const prevSibling = pre.previousElementSibling;
        if (prevSibling) {
          const siblingText = prevSibling.textContent?.trim().toLowerCase() || '';
          if (siblingText && siblingText.length < 20 && !siblingText.includes(' ')) {
            lang = siblingText;
          }
        }
      }

      if (lang) {
        codeElem.className = `language-${lang}`;
        pre.setAttribute('data-language', lang);
      }

      // Strip source-specific inline styles so universal syntax highlighting tokens take precedence
      pre.removeAttribute('style');
      codeElem.removeAttribute('style');
      pre.querySelectorAll('*').forEach(child => child.removeAttribute('style'));
    });

    // 4. Normalize inline formatting styles to semantic tags
    doc.querySelectorAll('span, p, div').forEach(el => {
      const style = el.getAttribute('style') || '';
      if (/font-weight:\s*(bold|[6-9]00)/i.test(style) && el.tagName === 'SPAN') {
        const strong = doc.createElement('strong');
        strong.innerHTML = el.innerHTML;
        el.replaceWith(strong);
      } else if (/font-style:\s*italic/i.test(style) && el.tagName === 'SPAN') {
        const em = doc.createElement('em');
        em.innerHTML = el.innerHTML;
        el.replaceWith(em);
      } else if (/text-decoration(?:-line)?:\s*underline/i.test(style) && el.tagName === 'SPAN') {
        const u = doc.createElement('u');
        u.innerHTML = el.innerHTML;
        el.replaceWith(u);
      } else if (/text-decoration(?:-line)?:\s*line-through/i.test(style) && el.tagName === 'SPAN') {
        const s = doc.createElement('s');
        s.innerHTML = el.innerHTML;
        el.replaceWith(s);
      }
    });

    // 5. Convert <b> and <i> to <strong> and <em>
    doc.querySelectorAll('b').forEach(b => {
      const strong = doc.createElement('strong');
      strong.innerHTML = b.innerHTML;
      b.replaceWith(strong);
    });
    doc.querySelectorAll('i').forEach(i => {
      const em = doc.createElement('em');
      em.innerHTML = i.innerHTML;
      i.replaceWith(em);
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Error during sanitizeHtml:', e);
    return rawHtml;
  }
}

/**
 * Converts clipboard rich HTML into a TipTap ProseMirror document JSON.
 * Preserves headings, bold, italic, underline, colors, code blocks, lists, links, tables, etc.
 */
export function htmlToTipTapJson(html: string): any {
  const cleanHtml = sanitizeHtml(html);
  try {
    const json = generateJSON(cleanHtml, notebookTipTapExtensions);
    return json;
  } catch (err) {
    console.warn('Failed to parse HTML to TipTap JSON, falling back to plain text:', err);
    return null;
  }
}
