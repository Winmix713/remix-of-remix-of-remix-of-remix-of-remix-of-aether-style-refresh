/**
 * use-css-history.ts — Editor-level undo/redo with draft state separation
 *
 * Architecture:
 * - `committed`: the last applied settings (synced to sliders)
 * - `draft`: the current editor text (may differ from committed)
 * - `history`: stack of previous committed states for undo
 * - `future`: stack of undone states for redo
 */

import { useState, useCallback, useRef } from 'react';

export interface HistoryEntry {
  cssText: string;
  timestamp: number;
}

export interface CSSHistoryState {
  /** Current editor text (draft, possibly unsaved) */
  draft: string;
  /** Last applied/committed CSS text */
  committed: string;
  /** Whether draft differs from committed */
  isDirty: boolean;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of undo steps available */
  undoDepth: number;
}

export interface CSSHistoryActions {
  /** Update draft text (does NOT commit) */
  setDraft: (text: string) => void;
  /** Commit the current draft as a new history entry */
  commit: (text?: string) => void;
  /** Undo: revert to previous committed state */
  undo: () => string | null;
  /** Redo: move forward in history */
  redo: () => string | null;
  /** Reset to a specific CSS text, clearing all history */
  resetTo: (text: string) => void;
  /** Revert draft to last committed state without undoing */
  revertDraft: () => string;
}

const MAX_HISTORY = 50;

export function useCSSHistory(initialCSS: string): [CSSHistoryState, CSSHistoryActions] {
  const [draft, setDraftState] = useState(initialCSS);
  const [committed, setCommitted] = useState(initialCSS);

  const historyRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const [, forceUpdate] = useState(0);

  const bump = useCallback(() => forceUpdate((n) => n + 1), []);

  const setDraft = useCallback((text: string) => {
    setDraftState(text);
  }, []);

  const commit = useCallback((text?: string) => {
    const toCommit = text ?? draft;
    // Push current committed to history
    historyRef.current.push({ cssText: committed, timestamp: Date.now() });
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    // Clear future on new commit
    futureRef.current = [];
    setCommitted(toCommit);
    setDraftState(toCommit);
    bump();
  }, [draft, committed, bump]);

  const undo = useCallback((): string | null => {
    if (historyRef.current.length === 0) return null;
    const prev = historyRef.current.pop()!;
    futureRef.current.push({ cssText: committed, timestamp: Date.now() });
    setCommitted(prev.cssText);
    setDraftState(prev.cssText);
    bump();
    return prev.cssText;
  }, [committed, bump]);

  const redo = useCallback((): string | null => {
    if (futureRef.current.length === 0) return null;
    const next = futureRef.current.pop()!;
    historyRef.current.push({ cssText: committed, timestamp: Date.now() });
    setCommitted(next.cssText);
    setDraftState(next.cssText);
    bump();
    return next.cssText;
  }, [committed, bump]);

  const resetTo = useCallback((text: string) => {
    historyRef.current = [];
    futureRef.current = [];
    setCommitted(text);
    setDraftState(text);
    bump();
  }, [bump]);

  const revertDraft = useCallback((): string => {
    setDraftState(committed);
    return committed;
  }, [committed]);

  const state: CSSHistoryState = {
    draft,
    committed,
    isDirty: draft !== committed,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    undoDepth: historyRef.current.length,
  };

  const actions: CSSHistoryActions = {
    setDraft,
    commit,
    undo,
    redo,
    resetTo,
    revertDraft,
  };

  return [state, actions];
}
