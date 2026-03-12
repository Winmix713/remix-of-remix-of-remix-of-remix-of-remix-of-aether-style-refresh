import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCSSHistory } from '@/hooks/use-css-history';

describe('useCSSHistory', () => {
  it('initializes with the given CSS', () => {
    const { result } = renderHook(() => useCSSHistory('initial'));
    const [state] = result.current;
    expect(state.draft).toBe('initial');
    expect(state.committed).toBe('initial');
    expect(state.isDirty).toBe(false);
  });

  it('setDraft marks as dirty', () => {
    const { result } = renderHook(() => useCSSHistory('initial'));
    act(() => result.current[1].setDraft('changed'));
    expect(result.current[0].isDirty).toBe(true);
    expect(result.current[0].draft).toBe('changed');
  });

  it('commit moves draft to committed', () => {
    const { result } = renderHook(() => useCSSHistory('initial'));
    act(() => result.current[1].setDraft('v2'));
    act(() => result.current[1].commit());
    expect(result.current[0].committed).toBe('v2');
    expect(result.current[0].isDirty).toBe(false);
    expect(result.current[0].canUndo).toBe(true);
  });

  it('undo restores previous state', () => {
    const { result } = renderHook(() => useCSSHistory('v1'));
    act(() => result.current[1].commit('v2'));
    act(() => result.current[1].commit('v3'));
    
    const undone = act(() => result.current[1].undo());
    expect(result.current[0].committed).toBe('v2');
    expect(result.current[0].canRedo).toBe(true);
  });

  it('redo restores undone state', () => {
    const { result } = renderHook(() => useCSSHistory('v1'));
    act(() => result.current[1].commit('v2'));
    act(() => result.current[1].undo());
    act(() => result.current[1].redo());
    expect(result.current[0].committed).toBe('v2');
  });

  it('resetTo clears all history', () => {
    const { result } = renderHook(() => useCSSHistory('v1'));
    act(() => result.current[1].commit('v2'));
    act(() => result.current[1].commit('v3'));
    act(() => result.current[1].resetTo('fresh'));
    expect(result.current[0].committed).toBe('fresh');
    expect(result.current[0].canUndo).toBe(false);
    expect(result.current[0].canRedo).toBe(false);
  });

  it('revertDraft restores committed state', () => {
    const { result } = renderHook(() => useCSSHistory('v1'));
    act(() => result.current[1].setDraft('dirty'));
    act(() => result.current[1].revertDraft());
    expect(result.current[0].draft).toBe('v1');
    expect(result.current[0].isDirty).toBe(false);
  });
});
