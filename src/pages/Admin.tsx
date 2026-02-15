/**
 * REFACTORED: pages/Admin.tsx — Enhanced Preset Architecture
 *
 * Now uses EnhancedPreset with base/override merge strategy.
 * Features: reset-to-base, commit customizations, customization indicators.
 */

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useEnhancedPresetManager,
  mergeSettings,
} from '@/hooks/use-enhanced-preset-manager';
import {
  generateLiquidGlassCSS,
  generateGlassmorphismCSS,
  generateNeumorphismCSS,
  generateGlowCSS,
} from '@/hooks/use-css-generator';
import type {
  EnhancedPreset,
  EffectMode,
  PresetSettings,
  LiquidGlassSettings,
  GlassmorphismSettings,
  NeumorphismSettings,
  GlowSettings,
} from '@/types/css-generator';
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Copy,
  Code,
  SlidersHorizontal,
  AlertTriangle,
  Save,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────
// SECTION 1: Constants & Helpers
// ─────────────────────────────────────────────────────────────────

const SETTING_RANGES: Record<EffectMode, Record<string, [number, number]>> = {
  'liquid-glass': {
    blur: [0, 60], opacity: [0, 100], borderRadius: [0, 50],
    bgAlpha: [0, 100], borderAlpha: [0, 100], borderWidth: [0, 5],
    refractionIntensity: [0, 100],
    shadowX: [-20, 20], shadowY: [-20, 20], shadowBlur: [0, 80],
    shadowSpread: [-20, 20], shadowAlpha: [0, 100],
    saturation: [50, 200], brightness: [50, 200],
  },
  'glassmorphism': {
    blur: [0, 50], opacity: [0, 100], borderRadius: [0, 50],
    bgAlpha: [0, 100], borderAlpha: [0, 100], borderWidth: [0, 5],
    shadowX: [-20, 20], shadowY: [-20, 20], shadowBlur: [0, 60],
    shadowAlpha: [0, 100], saturation: [50, 200],
  },
  'neumorphism': {
    borderRadius: [0, 50], distance: [1, 20], intensity: [1, 50], blur: [1, 40],
  },
  'glow': {
    borderRadius: [0, 100], bgAlpha: [0, 100],
    glowIntensity: [0, 100], glowSpread: [0, 100], glowBlur: [0, 200],
    innerGlow: [0, 100], borderAlpha: [0, 100], borderWidth: [0, 5],
    blur: [0, 40], saturation: [50, 300], brightness: [50, 300],
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function clampSettings(mode: EffectMode, settings: PresetSettings): PresetSettings {
  const ranges = SETTING_RANGES[mode] ?? {};
  const result = { ...settings } as Record<string, unknown>;
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'number' && ranges[key]) {
      const [min, max] = ranges[key];
      result[key] = clamp(value, min, max);
    }
  }
  return result as unknown as PresetSettings;
}

function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function generateId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const uid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${slug}-${uid}`;
}

const defaultSettingsByMode: Record<EffectMode, PresetSettings> = {
  'liquid-glass': {
    blur: 20, opacity: 80, borderRadius: 16,
    bgColor: '#ffffff', bgAlpha: 12,
    borderColor: '#ffffff', borderAlpha: 20, borderWidth: 1,
    refractionIntensity: 30,
    shadowX: 0, shadowY: 8, shadowBlur: 32, shadowSpread: 0,
    shadowColor: '#000000', shadowAlpha: 25,
    saturation: 120, brightness: 110,
  },
  'glassmorphism': {
    blur: 16, opacity: 75, borderRadius: 12,
    bgColor: '#ffffff', bgAlpha: 10,
    borderColor: '#ffffff', borderAlpha: 18, borderWidth: 1,
    shadowX: 0, shadowY: 4, shadowBlur: 30,
    shadowColor: '#000000', shadowAlpha: 20, saturation: 100,
  },
  'neumorphism': {
    borderRadius: 16, bgColor: '#e0e5ec', distance: 6,
    intensity: 15, blur: 12, shape: 'flat' as const,
    lightColor: '#ffffff', darkColor: '#a3b1c6',
  },
  'glow': {
    borderRadius: 24, bgColor: '#1a1a2e', bgAlpha: 85,
    glowColor: '#facc15', glowIntensity: 60, glowSpread: 30, glowBlur: 60,
    innerGlow: 20,
    borderColor: '#facc15', borderAlpha: 40, borderWidth: 1,
    blur: 8, saturation: 150, brightness: 110,
  },
};

// ─────────────────────────────────────────────────────────────────
// SECTION 2: CSS Parsing Utilities
// ─────────────────────────────────────────────────────────────────

function generateCSSForPreset(mode: EffectMode, settings: PresetSettings): string {
  if (mode === 'liquid-glass')  return generateLiquidGlassCSS(settings as LiquidGlassSettings).css;
  if (mode === 'glassmorphism') return generateGlassmorphismCSS(settings as GlassmorphismSettings).css;
  if (mode === 'glow')          return generateGlowCSS(settings as GlowSettings).css;
  return generateNeumorphismCSS(settings as NeumorphismSettings).css;
}

function parseAllCSSProperties(css: string): Record<string, string> {
  const props: Record<string, string> = {};
  const inner = css.replace(/^[^{]*\{/, '').replace(/\}[^}]*$/, '').trim();
  const declarations: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      declarations.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) declarations.push(current.trim());
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.substring(0, colonIdx).trim().toLowerCase();
    const value = decl.substring(colonIdx + 1).trim();
    if (prop && value) props[prop] = value;
  }
  return props;
}

function parseRgba(val: string): { r: number; g: number; b: number; a: number } | null {
  const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10), a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => clamp(c, 0, 255).toString(16).padStart(2, '0')).join('');
}

function splitBoxShadowLayers(val: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of val) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { layers.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) layers.push(current.trim());
  return layers;
}

interface ParsedShadow { x: number; y: number; blur: number; spread?: number; color?: string; alpha?: number; inset: boolean; }

function parseBoxShadowLayer(layer: string): ParsedShadow | null {
  const inset = /\binset\b/.test(layer);
  const cleaned = layer.replace(/\binset\b/, '').trim();
  const m = cleaned.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?\s+(rgba?\([^)]+\))/);
  if (!m) return null;
  const rgba = parseRgba(m[5]);
  return {
    x: parseFloat(m[1]), y: parseFloat(m[2]), blur: parseFloat(m[3]),
    spread: m[4] !== undefined ? parseFloat(m[4]) : undefined,
    color: rgba ? rgbToHex(rgba.r, rgba.g, rgba.b) : undefined,
    alpha: rgba ? Math.round(rgba.a * 100) : undefined, inset,
  };
}

function parseBackdropFilter(val: string) {
  const result: { blur?: number; saturate?: number; brightness?: number } = {};
  const blurM = val.match(/blur\(\s*([\d.]+)px\s*\)/);
  if (blurM) result.blur = parseFloat(blurM[1]);
  const satM = val.match(/saturate\(\s*([\d.]+)%?\s*\)/);
  if (satM) result.saturate = parseFloat(satM[1]);
  const brM = val.match(/brightness\(\s*([\d.]+)%?\s*\)/);
  if (brM) result.brightness = parseFloat(brM[1]);
  return result;
}

function parseBorder(val: string) {
  const result: { width?: number; color?: string; alpha?: number } = {};
  const widthM = val.match(/([\d.]+)px/);
  if (widthM) result.width = parseFloat(widthM[1]);
  const rgba = parseRgba(val);
  if (rgba) { result.color = rgbToHex(rgba.r, rgba.g, rgba.b); result.alpha = Math.round(rgba.a * 100); }
  return result;
}

/**
 * Parse CSS text → SELECTIVE overrides only.
 * Returns a Partial<PresetSettings> containing ONLY properties found in the CSS.
 * This is the key difference from the old approach: missing properties stay undefined.
 */
function parseCSSToOverrides(
  mode: EffectMode,
  css: string,
): Partial<PresetSettings> | null {
  try {
    const props = parseAllCSSProperties(css);
    if (Object.keys(props).length === 0) return null;

    const overrides: Record<string, number | string> = {};

    // Background
    if (props['background']) {
      const rgba = parseRgba(props['background']);
      if (rgba) {
        overrides.bgColor = rgbToHex(rgba.r, rgba.g, rgba.b);
        overrides.bgAlpha = Math.round(rgba.a * 100);
      }
      // Neumorphism gradient
      if (mode === 'neumorphism' && props['background'].includes('linear-gradient')) {
        const angleM = props['background'].match(/linear-gradient\(\s*(-?[\d.]+deg)/);
        if (angleM) {
          const angle = parseFloat(angleM[1]);
          if (Math.abs(angle - 135) < 10) overrides.shape = 'convex';
          else if (Math.abs(angle - 45) < 10) overrides.shape = 'concave';
        }
      } else if (mode === 'neumorphism') {
        const hexM = props['background'].match(/#[0-9a-fA-F]{6}/);
        if (hexM) overrides.bgColor = hexM[0];
        else {
          const rgba2 = parseRgba(props['background']);
          if (rgba2) overrides.bgColor = rgbToHex(rgba2.r, rgba2.g, rgba2.b);
        }
      }
    }

    // Backdrop filter
    const bdFilter = props['backdrop-filter'] ?? props['-webkit-backdrop-filter'];
    if (bdFilter) {
      const f = parseBackdropFilter(bdFilter);
      if (f.blur !== undefined) overrides.blur = f.blur;
      if (f.saturate !== undefined) overrides.saturation = f.saturate;
      if (f.brightness !== undefined) overrides.brightness = f.brightness;
    }

    // Border radius
    if (props['border-radius']) {
      const n = parseFloat(props['border-radius']);
      if (!isNaN(n)) overrides.borderRadius = n;
    }

    // Border
    if (props['border']) {
      const b = parseBorder(props['border']);
      if (b.width !== undefined) overrides.borderWidth = b.width;
      if (b.color) overrides.borderColor = b.color;
      if (b.alpha !== undefined) overrides.borderAlpha = b.alpha;
    }

    // Box shadow
    if (props['box-shadow']) {
      const layers = splitBoxShadowLayers(props['box-shadow']);

      if (mode === 'glow') {
        const outer = parseBoxShadowLayer(layers[0] ?? '');
        if (outer) {
          overrides.glowBlur = outer.blur;
          if (outer.spread !== undefined) overrides.glowSpread = outer.spread;
          if (outer.color) overrides.glowColor = outer.color;
          if (outer.alpha !== undefined) overrides.glowIntensity = Math.round(outer.alpha / 0.6);
        }
        for (const layer of layers) {
          if (/\binset\b/.test(layer)) {
            const insetSh = parseBoxShadowLayer(layer);
            if (insetSh?.alpha !== undefined) overrides.innerGlow = Math.round(insetSh.alpha / 0.5 * 100);
          }
        }
      } else if (mode === 'neumorphism') {
        const isInset = /\binset\b/.test(props['box-shadow']);
        if (isInset) overrides.shape = 'pressed';
        const first = parseBoxShadowLayer(layers[0] ?? '');
        if (first) {
          overrides.distance = Math.round(Math.abs(first.x));
          overrides.blur = Math.round(first.blur);
          if (first.alpha !== undefined) overrides.intensity = first.alpha;
          if (first.color) overrides.darkColor = first.color;
        }
        if (layers.length >= 2) {
          const second = parseBoxShadowLayer(layers[1] ?? '');
          if (second?.color) overrides.lightColor = second.color;
        }
      } else {
        // liquid-glass / glassmorphism
        const sh = parseBoxShadowLayer(layers[0] ?? '');
        if (sh) {
          overrides.shadowX = sh.x;
          overrides.shadowY = sh.y;
          overrides.shadowBlur = sh.blur;
          if (sh.spread !== undefined) overrides.shadowSpread = sh.spread;
          if (sh.color) overrides.shadowColor = sh.color;
          if (sh.alpha !== undefined) overrides.shadowAlpha = sh.alpha;
        }
      }
    }

    // Clamp numeric values
    const ranges = SETTING_RANGES[mode] ?? {};
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'number' && ranges[key]) {
        const [min, max] = ranges[key];
        overrides[key] = clamp(value, min, max);
      }
    }

    return Object.keys(overrides).length > 0 ? overrides as Partial<PresetSettings> : null;
  } catch (err) {
    console.error('[admin] CSS parse error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// SECTION 3: Main Admin Component
// ─────────────────────────────────────────────────────────────────

export default function Admin() {
  const {
    presets,
    addPreset,
    updatePreset,
    deletePreset,
    reorderPresets,
    resetToDefaults,
    applyUserOverride,
    applyBulkOverrides,
    resetToBase,
    commitCustomizations,
    getEffectiveSettings,
    hasUnsavedChanges,
  } = useEnhancedPresetManager();

  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  // Temporary state for new/editing preset metadata
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#a78bfa');
  const [editMode, setEditMode] = useState<EffectMode>('liquid-glass');

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const editingPreset = presets.find((p) => p.id === editingPresetId) ?? null;

  const effectiveSettings = useMemo(() => {
    if (!editingPresetId) return null;
    return getEffectiveSettings(editingPresetId);
  }, [editingPresetId, getEffectiveSettings]);

  const openNew = () => {
    setIsNew(true);
    const id = generateId('new-preset');
    const mode: EffectMode = 'liquid-glass';
    addPreset({
      name: '',
      mode,
      color: '#a78bfa',
      baseSettings: deepClone(defaultSettingsByMode[mode]),
    });
    // Find the newly added preset (last one)
    setEditName('');
    setEditColor('#a78bfa');
    setEditMode(mode);
    // We need to use a timeout because addPreset is async via setState
    setTimeout(() => {
      // The preset was just added; we stored a random id
    }, 0);
    setEditingPresetId(id);
  };

  // Better approach: create preset inline
  const openNewPreset = useCallback(() => {
    setIsNew(true);
    const mode: EffectMode = 'liquid-glass';
    const id = generateId('new');
    setEditName('');
    setEditColor('#a78bfa');
    setEditMode(mode);
    addPreset({
      id,
      name: '',
      mode,
      color: '#a78bfa',
      baseSettings: deepClone(defaultSettingsByMode[mode]),
    });
    setEditingPresetId(id);
  }, [addPreset]);

  const openEdit = (preset: EnhancedPreset) => {
    setIsNew(false);
    setEditName(preset.name);
    setEditColor(preset.color);
    setEditMode(preset.mode);
    setEditingPresetId(preset.id);
  };

  const duplicatePreset = (preset: EnhancedPreset) => {
    const newId = generateId(preset.name + '-copy');
    addPreset({
      id: newId,
      name: preset.name + ' (másolat)',
      mode: preset.mode,
      color: preset.color,
      baseSettings: deepClone(preset.baseSettings),
      userOverrides: preset.userOverrides ? deepClone(preset.userOverrides) : undefined,
      customCSS: preset.customCSS,
    });
    toast.success('Preset duplikálva');
  };

  const handleSave = () => {
    if (!editName.trim()) {
      toast.error('Adj nevet a presetnek!');
      return;
    }
    if (editingPresetId) {
      updatePreset(editingPresetId, {
        name: editName,
        color: editColor,
        mode: editMode,
      });
      toast.success(isNew ? 'Preset létrehozva' : 'Preset frissítve');
    }
    setEditingPresetId(null);
  };

  const handleCancelEdit = () => {
    if (isNew && editingPresetId) {
      deletePreset(editingPresetId);
    }
    setEditingPresetId(null);
  };

  const handleDelete = (id: string) => {
    deletePreset(id);
    setDeleteConfirm(null);
    toast.success('Preset törölve');
  };

  const handleModeChange = (mode: EffectMode) => {
    if (!editingPresetId) return;
    setEditMode(mode);
    updatePreset(editingPresetId, {
      mode,
      baseSettings: deepClone(defaultSettingsByMode[mode]),
      userOverrides: undefined,
      customCSS: undefined,
      isCustomized: false,
    });
  };

  const updateSettingField = useCallback(
    (key: string, value: number | string) => {
      if (!editingPresetId) return;
      applyUserOverride(editingPresetId, key, value);
    },
    [editingPresetId, applyUserOverride],
  );

  const deleteTargetName = presets.find((p) => p.id === deleteConfirm)?.name ?? '';

  const handleConfirmedReset = () => {
    resetToDefaults();
    setResetConfirm(false);
    toast.success('Presetek visszaállítva az alapértelmezett értékekre');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1000px] p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Preset Admin</h1>
            <p className="text-xs text-muted-foreground">
              Presetek kezelése — hozzáadás, szerkesztés, törlés
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirm(true)}
              className="border-border text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Alapértelmezés
            </Button>
            <Button size="sm" onClick={openNewPreset} className="bg-primary text-primary-foreground">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Új preset
            </Button>
          </div>
        </div>

        {/* Preset list */}
        <div className="space-y-2">
          {presets.map((preset, idx) => (
            <div
              key={preset.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-card/80 transition-colors"
            >
              <div
                className="h-10 w-10 rounded-lg shrink-0 shadow-sm relative"
                style={{
                  background: `linear-gradient(135deg, ${preset.color}40, ${preset.color}90)`,
                  border: `1px solid ${preset.color}50`,
                }}
              >
                {/* Customization indicator dot */}
                {preset.isCustomized && (
                  <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground truncate">
                    {preset.name || '(névtelen)'}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-border text-muted-foreground capitalize"
                  >
                    {preset.mode.replace('-', ' ')}
                  </Badge>
                  {preset.isCustomized && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 border-accent text-accent-foreground bg-accent/10"
                    >
                      módosított
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{preset.id}</span>
              </div>
              <div className="flex items-center gap-1">
                {/* Reset to base button - only if customized */}
                {preset.isCustomized && (
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-accent-foreground hover:text-foreground"
                    onClick={() => { resetToBase(preset.id); toast.success('Visszaállítva az alap értékekre'); }}
                    aria-label="Visszaállítás"
                    title="Visszaállítás az alap értékekre"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {/* Commit customizations */}
                {preset.isCustomized && (
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-accent-foreground hover:text-foreground"
                    onClick={() => { commitCustomizations(preset.id); toast.success('Módosítások véglegesítve'); }}
                    aria-label="Véglegesítés"
                    title="Módosítások véglegesítése (új alap)"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => idx > 0 && reorderPresets(idx, idx - 1)}
                  disabled={idx === 0}
                  aria-label="Fel"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => idx < presets.length - 1 && reorderPresets(idx, idx + 1)}
                  disabled={idx === presets.length - 1}
                  aria-label="Le"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => duplicatePreset(preset)}
                  aria-label="Duplikálás"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(preset)}
                  aria-label="Szerkesztés"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteConfirm(preset.id)}
                  aria-label="Törlés"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {presets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nincsenek presetek. Kattints az „Új preset" gombra!
            </div>
          )}
        </div>
      </main>

      {/* ── Edit / Create dialog ──────────────────────────────── */}
      <Dialog open={!!editingPresetId} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {isNew ? 'Új preset' : 'Preset szerkesztése'}
            </DialogTitle>
          </DialogHeader>

          {editingPreset && effectiveSettings && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Név</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="pl. Crystal Wave"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mód</Label>
                <Select value={editMode} onValueChange={(v) => handleModeChange(v as EffectMode)}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liquid-glass">Liquid Glass</SelectItem>
                    <SelectItem value="glassmorphism">Glassmorphism</SelectItem>
                    <SelectItem value="neumorphism">Neumorphism</SelectItem>
                    <SelectItem value="glow">Glow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ikon szín</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-24 font-mono text-xs bg-secondary border-border"
                  />
                  <div
                    className="h-10 w-10 rounded-lg shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${editColor}40, ${editColor}90)`,
                      border: `1px solid ${editColor}50`,
                    }}
                  />
                </div>
              </div>

              {/* Customization status banner */}
              {editingPreset.isCustomized && (
                <div className="flex items-center gap-2 rounded-md bg-accent/10 border border-accent/30 p-2.5">
                  <AlertTriangle className="h-4 w-4 text-accent-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-accent-foreground font-medium">
                      Módosítások vannak az alap presethez képest
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => { resetToBase(editingPresetId!); toast.success('Visszaállítva'); }}
                    >
                      <Undo2 className="mr-1 h-3 w-3" /> Reset
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => { commitCustomizations(editingPresetId!); toast.success('Véglegesítve'); }}
                    >
                      <Save className="mr-1 h-3 w-3" /> Véglegesít
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-3 space-y-3">
                <Tabs defaultValue="sliders" className="w-full">
                  <TabsList className="w-full bg-secondary/50">
                    <TabsTrigger value="sliders" className="flex-1 text-xs gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Sliders
                    </TabsTrigger>
                    <TabsTrigger value="css" className="flex-1 text-xs gap-1.5">
                      <Code className="h-3.5 w-3.5" /> CSS Kód
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="sliders" className="mt-3">
                    <PresetSettingsEditor
                      mode={editMode}
                      settings={effectiveSettings}
                      updateSetting={updateSettingField}
                    />
                  </TabsContent>
                  <TabsContent value="css" className="mt-3">
                    <CSSCodeEditor
                      presetId={editingPresetId!}
                      mode={editMode}
                      effectiveSettings={effectiveSettings}
                      baseSettings={editingPreset.baseSettings}
                      onOverridesChange={(overrides) => {
                        if (editingPresetId) applyBulkOverrides(editingPresetId, overrides);
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              className="border-border text-muted-foreground"
            >
              Mégse
            </Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground">
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Törlés megerősítése</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Biztosan törlöd a(z) <strong className="text-foreground">{deleteTargetName}</strong> presetet?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-border text-muted-foreground">
              Mégse
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Törlés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset all confirmation ────────────────────────────── */}
      <Dialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Alapértelmezés visszaállítása
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ez <strong className="text-foreground">minden</strong> presetet visszaállít az eredeti
            értékekre. Az egyéni módosítások elvesznek.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetConfirm(false)} className="border-border text-muted-foreground">
              Mégse
            </Button>
            <Button variant="destructive" onClick={handleConfirmedReset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Visszaállítás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECTION 4: CSS Code Editor (Selective Merge)
// ─────────────────────────────────────────────────────────────────

function CSSCodeEditor({
  presetId,
  mode,
  effectiveSettings,
  baseSettings,
  onOverridesChange,
}: {
  presetId: string;
  mode: EffectMode;
  effectiveSettings: PresetSettings;
  baseSettings: PresetSettings;
  onOverridesChange: (overrides: Partial<PresetSettings>) => void;
}) {
  const generatedCSS = useMemo(
    () => generateCSSForPreset(mode, effectiveSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, effectiveSettings],
  );

  const [cssText, setCssText] = useState(generatedCSS);
  const [parseStatus, setParseStatus] = useState<'idle' | 'success' | 'error' | 'modified'>('idle');
  const [parseMessage, setParseMessage] = useState('');
  const [lastAppliedCSS, setLastAppliedCSS] = useState(generatedCSS);
  const isUserEditRef = useRef(false);

  useEffect(() => {
    if (!isUserEditRef.current) {
      const fresh = generateCSSForPreset(mode, effectiveSettings);
      setCssText(fresh);
      setLastAppliedCSS(fresh);
      setParseStatus('idle');
      setParseMessage('');
    }
  }, [mode, effectiveSettings]);

  const isModified = cssText !== lastAppliedCSS;

  /**
   * KEY CHANGE: Apply CSS uses parseCSSToOverrides for SELECTIVE merge.
   * Only properties found in the CSS will override base values.
   */
  const handleApplyCSS = () => {
    const overrides = parseCSSToOverrides(mode, cssText);
    if (overrides) {
      onOverridesChange(overrides);
      setParseStatus('success');
      setParseMessage('✓ CSS sikeresen alkalmazva! Csak a módosított property-k frissültek — az alap értékek megmaradtak.');
      setLastAppliedCSS(cssText);
      isUserEditRef.current = false;
      toast.success('CSS alkalmazva (szelektív merge)');
    } else {
      setParseStatus('error');
      setParseMessage(
        '✗ Nem sikerült értelmezni a CSS-t. Ellenőrizd, hogy érvényes CSS property-k vannak.',
      );
    }
  };

  const handleRegenerate = () => {
    const fresh = generateCSSForPreset(mode, effectiveSettings);
    setCssText(fresh);
    setLastAppliedCSS(fresh);
    setParseStatus('idle');
    setParseMessage('');
    isUserEditRef.current = false;
  };

  const handleCopyCSS = async () => {
    try {
      await navigator.clipboard.writeText(cssText);
      toast.success('CSS másolva');
    } catch {
      toast.error('Másolás sikertelen');
    }
  };

  const handleCSSChange = (val: string) => {
    setCssText(val);
    isUserEditRef.current = true;
    if (val === lastAppliedCSS) {
      setParseStatus('idle');
      setParseMessage('');
    } else {
      setParseStatus('modified');
      setParseMessage('Módosított — kattints az „Alkalmaz" gombra. Csak a CSS-ben definiált property-k íródnak felül.');
    }
  };

  const livePreviewStyle = useMemo<CSSProperties>(() => {
    try {
      const overrides = parseCSSToOverrides(mode, cssText);
      if (!overrides) return {};

      const merged = mergeSettings(baseSettings, overrides);
      let gen: { properties: Record<string, string | undefined>; css: string };
      if (mode === 'liquid-glass') gen = generateLiquidGlassCSS(merged as LiquidGlassSettings);
      else if (mode === 'glassmorphism') gen = generateGlassmorphismCSS(merged as GlassmorphismSettings);
      else if (mode === 'glow') gen = generateGlowCSS(merged as GlowSettings);
      else gen = generateNeumorphismCSS(merged as NeumorphismSettings);

      const style: CSSProperties = {};
      for (const [key, val] of Object.entries(gen.properties)) {
        if (!val) continue;
        const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        (style as Record<string, string>)[camel] = val;
      }
      if (mode === 'neumorphism') {
        const bgMatch = gen.css.match(/background:\s*(linear-gradient[^;]+);/);
        if (bgMatch) style.background = bgMatch[1];
      }
      return style;
    } catch {
      return {};
    }
  }, [cssText, mode, baseSettings]);

  return (
    <div className="space-y-3">
      {/* Live mini preview */}
      <div className="relative rounded-lg border border-border bg-gradient-to-br from-muted/50 to-muted p-4 flex items-center justify-center min-h-[80px]">
        <div
          className="w-24 h-16 flex items-center justify-center text-[10px] text-muted-foreground font-medium transition-all duration-200"
          style={livePreviewStyle}
        >
          Előnézet
        </div>
        <span className="absolute top-1.5 right-2 text-[9px] text-muted-foreground/60">
          Élő előnézet
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground font-medium">CSS kód</Label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleRegenerate} className="h-7 text-[10px] text-muted-foreground">
            <RotateCcw className="mr-1 h-3 w-3" /> Újragenerálás
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyCSS} className="h-7 text-[10px] text-muted-foreground">
            <Copy className="mr-1 h-3 w-3" /> Másolás
          </Button>
        </div>
      </div>

      {/* Code editor */}
      <div className="relative">
        <Textarea
          value={cssText}
          onChange={(e) => handleCSSChange(e.target.value)}
          className="font-mono text-[11px] leading-relaxed bg-secondary/80 border-border min-h-[220px] resize-y whitespace-pre"
          spellCheck={false}
          aria-label="CSS kód szerkesztő"
        />
        {isModified && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-accent text-accent-foreground border-accent">
              módosított
            </Badge>
          </div>
        )}
      </div>

      {/* Status message */}
      {parseMessage && (
        <p
          className={`text-[11px] font-medium ${
            parseStatus === 'success' ? 'text-green-500' :
            parseStatus === 'error' ? 'text-destructive' :
            'text-muted-foreground'
          }`}
          role={parseStatus === 'error' ? 'alert' : undefined}
        >
          {parseMessage}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleApplyCSS}
          disabled={!isModified}
          className="bg-primary text-primary-foreground text-xs flex-1"
        >
          <Code className="mr-1.5 h-3.5 w-3.5" /> Alkalmaz (szelektív merge)
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        💡 <strong>Szelektív merge</strong>: Csak a CSS-ben definiált property-k íródnak felül.
        A többi alap preset érték megmarad. Használd a „Reset" gombot a visszaállításhoz.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECTION 5: Settings Editor Sub-Components
// ─────────────────────────────────────────────────────────────────

function SliderField({
  label, value, onChange, min = 0, max = 100, step = 1, unit = '',
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

function ColorField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
        />
        <Input
          value={value} onChange={(e) => onChange(e.target.value)}
          className="h-7 w-20 font-mono text-xs bg-secondary border-border"
        />
      </div>
    </div>
  );
}

function PresetSettingsEditor({
  mode, settings, updateSetting,
}: {
  mode: EffectMode; settings: PresetSettings; updateSetting: (key: string, value: number | string) => void;
}) {
  if (mode === 'liquid-glass') {
    const s = settings as LiquidGlassSettings;
    return (
      <div className="space-y-2.5">
        <SliderField label="Blur"          value={s.blur}               onChange={(v) => updateSetting('blur', v)}               max={60}  unit="px" />
        <SliderField label="BG Alpha"      value={s.bgAlpha}            onChange={(v) => updateSetting('bgAlpha', v)}             unit="%" />
        <SliderField label="Border Radius" value={s.borderRadius}       onChange={(v) => updateSetting('borderRadius', v)}       max={50}  unit="px" />
        <ColorField  label="BG Color"      value={s.bgColor}            onChange={(v) => updateSetting('bgColor', v)} />
        <ColorField  label="Border Color"  value={s.borderColor}        onChange={(v) => updateSetting('borderColor', v)} />
        <SliderField label="Border Alpha"  value={s.borderAlpha}        onChange={(v) => updateSetting('borderAlpha', v)}        unit="%" />
        <SliderField label="Border Width"  value={s.borderWidth}        onChange={(v) => updateSetting('borderWidth', v)}        max={5}   unit="px" />
        <SliderField label="Refraction"    value={s.refractionIntensity} onChange={(v) => updateSetting('refractionIntensity', v)} unit="%" />
        <SliderField label="Shadow X"      value={s.shadowX}            onChange={(v) => updateSetting('shadowX', v)}            min={-20} max={20} unit="px" />
        <SliderField label="Shadow Y"      value={s.shadowY}            onChange={(v) => updateSetting('shadowY', v)}            min={-20} max={20} unit="px" />
        <SliderField label="Shadow Blur"   value={s.shadowBlur}         onChange={(v) => updateSetting('shadowBlur', v)}         max={80}  unit="px" />
        <SliderField label="Shadow Spread" value={s.shadowSpread}       onChange={(v) => updateSetting('shadowSpread', v)}       min={-20} max={20} unit="px" />
        <SliderField label="Shadow Alpha"  value={s.shadowAlpha}        onChange={(v) => updateSetting('shadowAlpha', v)}        unit="%" />
        <ColorField  label="Shadow Color"  value={s.shadowColor}        onChange={(v) => updateSetting('shadowColor', v)} />
        <SliderField label="Saturation"    value={s.saturation}         onChange={(v) => updateSetting('saturation', v)}         min={50}  max={200} unit="%" />
        <SliderField label="Brightness"    value={s.brightness}         onChange={(v) => updateSetting('brightness', v)}         min={50}  max={200} unit="%" />
      </div>
    );
  }

  if (mode === 'glassmorphism') {
    const s = settings as GlassmorphismSettings;
    return (
      <div className="space-y-2.5">
        <SliderField label="Blur"          value={s.blur}         onChange={(v) => updateSetting('blur', v)}         max={50}  unit="px" />
        <SliderField label="BG Alpha"      value={s.bgAlpha}      onChange={(v) => updateSetting('bgAlpha', v)}      unit="%" />
        <SliderField label="Border Radius" value={s.borderRadius} onChange={(v) => updateSetting('borderRadius', v)} max={50}  unit="px" />
        <ColorField  label="BG Color"      value={s.bgColor}      onChange={(v) => updateSetting('bgColor', v)} />
        <ColorField  label="Border Color"  value={s.borderColor}  onChange={(v) => updateSetting('borderColor', v)} />
        <SliderField label="Border Alpha"  value={s.borderAlpha}  onChange={(v) => updateSetting('borderAlpha', v)}  unit="%" />
        <SliderField label="Border Width"  value={s.borderWidth}  onChange={(v) => updateSetting('borderWidth', v)}  max={5}   unit="px" />
        <SliderField label="Shadow X"      value={s.shadowX}      onChange={(v) => updateSetting('shadowX', v)}      min={-20} max={20} unit="px" />
        <SliderField label="Shadow Y"      value={s.shadowY}      onChange={(v) => updateSetting('shadowY', v)}      min={-20} max={20} unit="px" />
        <SliderField label="Shadow Blur"   value={s.shadowBlur}   onChange={(v) => updateSetting('shadowBlur', v)}   max={60}  unit="px" />
        <SliderField label="Shadow Alpha"  value={s.shadowAlpha}  onChange={(v) => updateSetting('shadowAlpha', v)}  unit="%" />
        <ColorField  label="Shadow Color"  value={s.shadowColor}  onChange={(v) => updateSetting('shadowColor', v)} />
        <SliderField label="Saturation"    value={s.saturation}   onChange={(v) => updateSetting('saturation', v)}   min={50}  max={200} unit="%" />
      </div>
    );
  }

  if (mode === 'glow') {
    const s = settings as GlowSettings;
    return (
      <div className="space-y-2.5">
        <ColorField  label="Glow Color"    value={s.glowColor}     onChange={(v) => updateSetting('glowColor', v)} />
        <SliderField label="Glow Intensity" value={s.glowIntensity} onChange={(v) => updateSetting('glowIntensity', v)} unit="%" />
        <SliderField label="Glow Spread"   value={s.glowSpread}    onChange={(v) => updateSetting('glowSpread', v)}    max={100} unit="px" />
        <SliderField label="Glow Blur"     value={s.glowBlur}      onChange={(v) => updateSetting('glowBlur', v)}      max={200} unit="px" />
        <SliderField label="Inner Glow"    value={s.innerGlow}     onChange={(v) => updateSetting('innerGlow', v)}     unit="%" />
        <SliderField label="Border Radius" value={s.borderRadius}  onChange={(v) => updateSetting('borderRadius', v)}  max={100} unit="px" />
        <ColorField  label="BG Color"      value={s.bgColor}       onChange={(v) => updateSetting('bgColor', v)} />
        <SliderField label="BG Alpha"      value={s.bgAlpha}       onChange={(v) => updateSetting('bgAlpha', v)}       unit="%" />
        <ColorField  label="Border Color"  value={s.borderColor}   onChange={(v) => updateSetting('borderColor', v)} />
        <SliderField label="Border Alpha"  value={s.borderAlpha}   onChange={(v) => updateSetting('borderAlpha', v)}   unit="%" />
        <SliderField label="Border Width"  value={s.borderWidth}   onChange={(v) => updateSetting('borderWidth', v)}   max={5} unit="px" />
        <SliderField label="Backdrop Blur"  value={s.blur}          onChange={(v) => updateSetting('blur', v)}          max={40} unit="px" />
        <SliderField label="Saturation"    value={s.saturation}    onChange={(v) => updateSetting('saturation', v)}    min={50} max={300} unit="%" />
        <SliderField label="Brightness"    value={s.brightness}    onChange={(v) => updateSetting('brightness', v)}    min={50} max={300} unit="%" />
      </div>
    );
  }

  // Neumorphism
  const s = settings as NeumorphismSettings;
  const shapes = ['flat', 'concave', 'convex', 'pressed'] as const;
  return (
    <div className="space-y-2.5">
      <SliderField label="Border Radius" value={s.borderRadius} onChange={(v) => updateSetting('borderRadius', v)} max={50}  unit="px" />
      <ColorField  label="Background"    value={s.bgColor}      onChange={(v) => updateSetting('bgColor', v)} />
      <SliderField label="Distance"      value={s.distance}     onChange={(v) => updateSetting('distance', v)}     min={1} max={20} unit="px" />
      <SliderField label="Intensity"     value={s.intensity}    onChange={(v) => updateSetting('intensity', v)}    min={1} max={50} unit="%" />
      <SliderField label="Blur"          value={s.blur}         onChange={(v) => updateSetting('blur', v)}         min={1} max={40} unit="px" />

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Shape</Label>
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Neumorphism shape">
          {shapes.map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => updateSetting('shape', shape)}
              aria-pressed={s.shape === shape}
              className={`rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                s.shape === shape
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {shape}
            </button>
          ))}
        </div>
      </div>

      <ColorField label="Light Shadow" value={s.lightColor} onChange={(v) => updateSetting('lightColor', v)} />
      <ColorField label="Dark Shadow"  value={s.darkColor}  onChange={(v) => updateSetting('darkColor', v)} />
    </div>
  );
}
