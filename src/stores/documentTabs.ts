export type DocumentTabType = 'notebook' | 'canvas' | 'pdf';

export interface DocumentTab {
  id: string;
  type: DocumentTabType;
  title: string;
  pageId?: string;
}

export function openDocumentTab(tabs: DocumentTab[], tab: DocumentTab): { tabs: DocumentTab[]; activeTabId: string } {
  const existingIndex = tabs.findIndex(item => item.id === tab.id);
  if (existingIndex >= 0) {
    const next = [...tabs];
    next[existingIndex] = { ...next[existingIndex], ...tab };
    return { tabs: next, activeTabId: tab.id };
  }
  return { tabs: [...tabs, tab], activeTabId: tab.id };
}

export function closeDocumentTab(tabs: DocumentTab[], activeTabId: string | null, tabId: string): { tabs: DocumentTab[]; activeTabId: string | null; closed?: DocumentTab } {
  const index = tabs.findIndex(item => item.id === tabId);
  if (index < 0) return { tabs, activeTabId };
  const next = tabs.filter(item => item.id !== tabId);
  const closed = tabs[index];
  if (activeTabId !== tabId) return { tabs: next, activeTabId, closed };
  return { tabs: next, activeTabId: next[index]?.id ?? next[index - 1]?.id ?? null, closed };
}

export function reorderDocumentTabs(tabs: DocumentTab[], from: number, to: number): DocumentTab[] {
  if (from < 0 || from >= tabs.length || to < 0 || to >= tabs.length || from === to) return tabs;
  const next = [...tabs];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function cycleDocumentTab(tabs: DocumentTab[], activeTabId: string | null, direction: 1 | -1): string | null {
  if (tabs.length === 0) return null;
  const index = Math.max(0, tabs.findIndex(item => item.id === activeTabId));
  return tabs[(index + direction + tabs.length) % tabs.length].id;
}

export function splitDocumentTab(tabs: DocumentTab[], tabId: string): { pageId: string } | null {
  const tab = tabs.find(item => item.id === tabId);
  return tab?.pageId ? { pageId: tab.pageId } : null;
}
