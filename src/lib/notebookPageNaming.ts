/**
 * Pick the next generated page title without changing titles the user chose.
 *
 * Generated numbers are monotonic within the section: deleting Page 3 does
 * not cause a later page to be renamed Page 3. This keeps titles stable when
 * pages are reordered or restored from trash.
 */
export function getNextGeneratedPageTitle(
  pages: ReadonlyArray<{ title?: string | null }>,
): string {
  const used = new Set(
    pages
      .map(page => String(page.title ?? '').trim().toLocaleLowerCase())
      .filter(Boolean),
  );

  let highest = 0;
  for (const title of used) {
    const match = /^page\s+(\d+)$/i.exec(title);
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isSafeInteger(number) && number > highest) highest = number;
  }

  let next = Math.max(1, highest + 1);
  while (used.has(`page ${next}`)) next += 1;
  return `Page ${next}`;
}

/** Whether a requested title is the old automatic placeholder. */
export function isGeneratedPagePlaceholder(title: string | null | undefined): boolean {
  return !String(title ?? '').trim() || /^new\s+page$/i.test(String(title).trim());
}
