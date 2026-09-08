// ============================================
// Panvas — Engine state subscriptions for React
// ============================================
// The engine layer (see ./engine) is plain TypeScript with its own observer pattern.
// React components used to mirror it with `useState(() => manager.getState())` plus a
// `useEffect` that called `manager.subscribe(setState)`. That pattern has two holes:
//
//   1. The seed and the subscription are separate steps. Anything the engine emits between
//      them, or between an unsubscribe and the next subscribe (NotebookRenderer resubscribes
//      whenever the workspace/notebook/page changes), is lost — and nothing ever re-reads
//      the engine to notice, so a single missed notification is permanent.
//   2. Some components seeded the mirror with a hard-coded literal instead of the engine's
//      real state, so they started out wrong and stayed wrong until the first change event.
//
// `useSyncExternalStore` closes both: it re-reads the snapshot on every render *and* every
// time it (re)subscribes, and compares with Object.is. Any divergence self-heals on the next
// render instead of latching. This is not polling — it is React's designed contract for
// external stores, and it is why the managers now hand out frozen, referentially stable
// snapshots (see ToolManager.snapshot).

import { useCallback, useSyncExternalStore } from 'react';
import type { NotebookEngine } from './engine/NotebookEngine';
import type { ToolState } from './engine/drawingTypes';

/**
 * Subscribe to the engine's tool state. The toolbar highlight, pointer routing in
 * InputManager and the viewport pan predicate all resolve to this one value.
 */
export function useToolState(engine: NotebookEngine): Readonly<ToolState> {
  const tools = engine.tools;

  const subscribe = useCallback(
    (onStoreChange: () => void) => tools.subscribe(() => onStoreChange()),
    [tools]
  );
  const getSnapshot = useCallback(() => tools.getState(), [tools]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
