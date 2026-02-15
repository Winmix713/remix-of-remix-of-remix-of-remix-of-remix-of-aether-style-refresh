import { useState, useCallback, useEffect } from 'react';
import { presets as defaultPresets } from '@/hooks/use-css-generator';
import type { Preset } from '@/types/css-generator';

const STORAGE_KEY = 'aether-css-presets';

function loadPresets(): Preset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...defaultPresets];
}

function savePresets(presets: Preset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function usePresetManager() {
  const [presets, setPresets] = useState<Preset[]>(loadPresets);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const addPreset = useCallback((preset: Preset) => {
    setPresets(prev => [...prev, preset]);
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<Preset>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  const reorderPresets = useCallback((fromIndex: number, toIndex: number) => {
    setPresets(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setPresets([...defaultPresets]);
  }, []);

  return { presets, addPreset, updatePreset, deletePreset, reorderPresets, resetToDefaults };
}
