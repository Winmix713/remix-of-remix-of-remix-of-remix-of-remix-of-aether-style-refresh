import { useState, useCallback, useEffect } from 'react';
import { presets as defaultPresets } from '@/hooks/use-css-generator';
import type { Preset, EnhancedPreset, PresetSettings, EffectMode } from '@/types/css-generator';

const STORAGE_KEY = 'aether-css-presets-v2';

// ─────────────────────────────────────────────────────────────────
// Migration: Convert legacy Preset to EnhancedPreset
// ─────────────────────────────────────────────────────────────────

function migratePreset(p: Preset | EnhancedPreset): EnhancedPreset {
  if ('baseSettings' in p) return p;
  return {
    id: p.id,
    name: p.name,
    mode: p.mode,
    color: p.color,
    baseSettings: p.settings,
    isCustomized: false,
  };
}

function migrateDefaults(): EnhancedPreset[] {
  return defaultPresets.map(migratePreset);
}

// ─────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────

function loadPresets(): EnhancedPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return (parsed as (Preset | EnhancedPreset)[]).map(migratePreset);
    }
    // Try migrating from legacy key
    const legacy = localStorage.getItem('aether-css-presets');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = (parsed as Preset[]).map(migratePreset);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch { /* ignore */ }
  return migrateDefaults();
}

function savePresets(presets: EnhancedPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

// ─────────────────────────────────────────────────────────────────
// Merge strategy
// ─────────────────────────────────────────────────────────────────

export function mergeSettings(
  base: PresetSettings,
  overrides?: Partial<PresetSettings>,
): PresetSettings {
  if (!overrides || Object.keys(overrides).length === 0) return { ...base };
  return { ...base, ...overrides } as PresetSettings;
}

// ─────────────────────────────────────────────────────────────────
// ID generation
// ─────────────────────────────────────────────────────────────────

function generateId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const uid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${slug}-${uid}`;
}

// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────

export function useEnhancedPresetManager() {
  const [presets, setPresets] = useState<EnhancedPreset[]>(loadPresets);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  /** Get effective (merged) settings for a preset */
  const getEffectiveSettings = useCallback(
    (presetId: string): PresetSettings | null => {
      const p = presets.find((x) => x.id === presetId);
      if (!p) return null;
      return mergeSettings(p.baseSettings, p.userOverrides);
    },
    [presets],
  );

  /** Apply a single slider/field override */
  const applyUserOverride = useCallback(
    (presetId: string, key: string, value: number | string) => {
      setPresets((prev) =>
        prev.map((p) =>
          p.id === presetId
            ? {
                ...p,
                userOverrides: { ...p.userOverrides, [key]: value },
                isCustomized: true,
                lastModified: Date.now(),
              }
            : p,
        ),
      );
    },
    [],
  );

  /** Apply bulk overrides (e.g. from CSS parser) */
  const applyBulkOverrides = useCallback(
    (presetId: string, overrides: Partial<PresetSettings>) => {
      setPresets((prev) =>
        prev.map((p) =>
          p.id === presetId
            ? {
                ...p,
                userOverrides: { ...p.userOverrides, ...overrides },
                isCustomized: true,
                lastModified: Date.now(),
              }
            : p,
        ),
      );
    },
    [],
  );

  /** Store custom CSS string */
  const setCustomCSS = useCallback(
    (presetId: string, css: string) => {
      setPresets((prev) =>
        prev.map((p) =>
          p.id === presetId
            ? { ...p, customCSS: css, isCustomized: true, lastModified: Date.now() }
            : p,
        ),
      );
    },
    [],
  );

  /** Reset to base preset values (discard overrides + custom CSS) */
  const resetToBase = useCallback((presetId: string) => {
    setPresets((prev) =>
      prev.map((p) =>
        p.id === presetId
          ? {
              ...p,
              userOverrides: undefined,
              customCSS: undefined,
              isCustomized: false,
              lastModified: Date.now(),
            }
          : p,
      ),
    );
  }, []);

  /** Commit: merge overrides into baseSettings permanently */
  const commitCustomizations = useCallback((presetId: string) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        return {
          ...p,
          baseSettings: mergeSettings(p.baseSettings, p.userOverrides),
          userOverrides: undefined,
          customCSS: undefined,
          isCustomized: false,
          lastModified: Date.now(),
        };
      }),
    );
  }, []);

  /** Add new preset */
  const addPreset = useCallback(
    (preset: Omit<EnhancedPreset, 'id' | 'isCustomized' | 'lastModified'> & { id?: string }) => {
      const newPreset: EnhancedPreset = {
        ...preset,
        id: preset.id || generateId(preset.name),
        isCustomized: false,
        lastModified: Date.now(),
      };
      setPresets((prev) => [...prev, newPreset]);
    },
    [],
  );

  /** Update basic preset metadata (name, color, mode) */
  const updatePreset = useCallback(
    (id: string, updates: Partial<EnhancedPreset>) => {
      setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    },
    [],
  );

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reorderPresets = useCallback((fromIndex: number, toIndex: number) => {
    setPresets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setPresets(migrateDefaults());
  }, []);

  /** Check if a preset has unsaved changes */
  const hasUnsavedChanges = useCallback(
    (presetId: string): boolean => {
      return presets.find((p) => p.id === presetId)?.isCustomized ?? false;
    },
    [presets],
  );

  return {
    presets,
    getEffectiveSettings,
    applyUserOverride,
    applyBulkOverrides,
    setCustomCSS,
    resetToBase,
    commitCustomizations,
    addPreset,
    updatePreset,
    deletePreset,
    reorderPresets,
    resetToDefaults,
    hasUnsavedChanges,
  };
}
