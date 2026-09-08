import type { LocalSearchDocument } from './LocalSearchIndex';

export type LocalSearchMatchSource = 'title' | 'handwriting' | 'rich-text' | 'metadata';
export type LocalSearchResult = LocalSearchDocument & { excerpt: string; matchSource: LocalSearchMatchSource };

export function rankLocalSearchDocuments(documents: LocalSearchDocument[], query: string, limit = 20): LocalSearchResult[] {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return documents
    .map(document => {
      const title = document.title.toLocaleLowerCase();
      const tags = document.tags.join(' ').toLocaleLowerCase();
      const handwriting = document.handwritingText.toLocaleLowerCase();
      const richText = document.richText.toLocaleLowerCase();
      let score = 0;
      let matchedTerms = 0;
      let titleMatches = 0;
      let handwritingMatches = 0;
      let richTextMatches = 0;

      for (const term of terms) {
        let matched = false;
        if (title === term) { score += 20; titleMatches += 1; matched = true; }
        else if (title.includes(term)) { score += 10; titleMatches += 1; matched = true; }
        if (tags.includes(term)) { score += 4; matched = true; }
        if (handwriting.includes(term)) { score += 3; handwritingMatches += 1; matched = true; }
        if (richText.includes(term)) { score += 2; richTextMatches += 1; matched = true; }
        if (matched) matchedTerms += 1;
      }

      const matchSource: LocalSearchMatchSource = titleMatches > 0
        ? 'title'
        : handwritingMatches > 0
          ? 'handwriting'
          : richTextMatches > 0
            ? 'rich-text'
            : 'metadata';
      return { document, score: matchedTerms === terms.length ? score : 0, matchSource };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || b.document.updatedAt - a.document.updatedAt || a.document.id.localeCompare(b.document.id))
    .slice(0, limit)
    .map(({ document, matchSource }) => {
      const excerptSource = matchSource === 'handwriting'
        ? document.handwritingText
        : matchSource === 'rich-text'
          ? document.richText
          : document.snippet || document.content;
      const lower = excerptSource.toLocaleLowerCase();
      const firstMatch = terms.map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] ?? 0;
      const start = Math.max(0, firstMatch - 60);
      const excerpt = excerptSource.slice(start, start + 180);
      return {
        ...document,
        matchSource,
        excerpt: `${start > 0 ? '…' : ''}${excerpt}${start + 180 < excerptSource.length ? '…' : ''}`,
      };
    });
}
