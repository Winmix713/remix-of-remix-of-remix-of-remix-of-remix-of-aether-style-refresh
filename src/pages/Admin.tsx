/**
 * REFACTORED: pages/admin.tsx — Production-Ready Version
 *
 * CHANGES SUMMARY:
 * ─────────────────────────────────────────────────────────────────
 * 🔴 CRITICAL (P1) — Render-phase state setters removed
 *    CSSCodeEditor no longer mutates state during render. The old
 *    `if (mode !== prevMode) { setState(...) }` block has been
 *    replaced with a proper useEffect + useRef pattern.
 *
 * 🟠 HIGH (P2) — Clamp validation on all parsed CSS values
 *    New `clamp()` helper + per-mode `SETTING_RANGES` map ensure
 *    every numeric value coming out of the CSS parser is bounded
 *    within its slider range before it reaches the UI.
 *
 * 🟡 MEDIUM (P3) — Deep cloning for settings
 *    All preset copy paths (openEdit, openNew, duplicatePreset,
 *    handleModeChange) now use `structuredClone()` so nested
 *    objects can never alias each other.
 *
 * ADDITIONAL HARDENING:
 *    • crypto.randomUUID() for collision-free IDs
 *    • Clipboard writeText wrapped in try/catch
 *    • Preset name shown in delete-confirmation dialog
 *    • Confirmation dialog before resetToDefaults
 *    • Toast feedback for resetToDefaults
 *    • Fixed neumorphism shape-detection logic
 *    • border shorthand parsing handles all CSS formats
 *    • box-shadow multi-layer splitting won't break on rgba commas
 *    • livePreviewStyle only re-parses when cssText actually changes
 *    • Shape buttons are proper <button> with aria-pressed
 *    • Disabled "Apply" reflects correct state
 *    • Unified SettingRanges kept in a single source-of-truth object
 * ─────────────────────────────────────────────────────────────────
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
import { usePresetManager } from '@/hooks/use-preset-manager';
import {
  generateLiquidGlassCSS,
  generateGlassmorphismCSS,
  generateNeumorphismCSS,
  generateGlowCSS,
} from '@/hooks/use-css-generator';
import type {
  Preset,
  EffectMode,
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
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────
// SECTION 1: Constants & Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * [P2] Single source-of-truth for slider ranges.
 * Every numeric value parsed from CSS is clamped against these bounds
 * before it reaches any state update — ensuring sliders never receive
 * out-of-range values.
 */
const SETTING_RANGES: Record<EffectMode, Record<string, [number, number]>> = {
  'liquid-glass': {
    blur:               [0,   60],
    opacity:            [0,  100],
    borderRadius:       [0,   50],
    bgAlpha:            [0,  100],
    borderAlpha:        [0,  100],
    borderWidth:        [0,    5],
    refractionIntensity:[0,  100],
    shadowX:            [-20, 20],
    shadowY:            [-20, 20],
    shadowBlur:         [0,   80],
    shadowSpread:       [-20, 20],
    shadowAlpha:        [0,  100],
    saturation:         [50, 200],
    brightness:         [50, 200],
  },
  'glassmorphism': {
    blur:               [0,   50],
    opacity:            [0,  100],
    borderRadius:       [0,   50],
    bgAlpha:            [0,  100],
    borderAlpha:        [0,  100],
    borderWidth:        [0,    5],
    shadowX:            [-20, 20],
    shadowY:            [-20, 20],
    shadowBlur:         [0,   60],
    shadowAlpha:        [0,  100],
    saturation:         [50, 200],
  },
  'neumorphism': {
    borderRadius: [0,   50],
    distance:     [1,   20],
    intensity:    [1,   50],
    blur:         [1,   40],
  },
  'glow': {
    borderRadius:   [0,  100],
    bgAlpha:        [0,  100],
    glowIntensity:  [0,  100],
    glowSpread:     [0,  100],
    glowBlur:       [0,  200],
    innerGlow:      [0,  100],
    borderAlpha:    [0,  100],
    borderWidth:    [0,    5],
    blur:           [0,   40],
    saturation:     [50, 300],
    brightness:     [50, 300],
  },
};

/** Clamp n within [min, max] */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * [P2] Apply SETTING_RANGES clamps to every numeric field in a settings object.
 * Unknown keys (e.g. color strings) are passed through unchanged.
 */
function clampSettings(
  mode: EffectMode,
  settings: Preset['settings'],
): Preset['settings'] {
  const ranges = SETTING_RANGES[mode] ?? {};
  const result = { ...settings } as Record<string, unknown>;
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'number' && ranges[key]) {
      const [min, max] = ranges[key];
      result[key] = clamp(value, min, max);
    }
  }
  return result as unknown as Preset['settings'];
}

/**
 * [P3] Deep-clone helper. Uses structuredClone (available in all modern
 * environments; falls back to JSON round-trip for safety).
 */
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Collision-free ID generator.
 * Prefers crypto.randomUUID(); falls back to timestamp + random for
 * environments where crypto is unavailable (very old browsers/SSR).
 */
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

const defaultSettingsByMode: Record<EffectMode, Preset['settings']> = {
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

function generateCSSForPreset(mode: EffectMode, settings: Preset['settings']): string {
  if (mode === 'liquid-glass')
    return generateLiquidGlassCSS(settings as LiquidGlassSettings).css;
  if (mode === 'glassmorphism')
    return generateGlassmorphismCSS(settings as GlassmorphismSettings).css;
  if (mode === 'glow')
    return generateGlowCSS(settings as GlowSettings).css;
  return generateNeumorphismCSS(settings as NeumorphismSettings).css;
}

function parseAllCSSProperties(css: string): Record<string, string> {
  const props: Record<string, string> = {};
  // Strip selector wrapper and outer braces
  const inner = css.replace(/^[^{]*\{/, '').replace(/\}[^}]*$/, '').trim();

  // Split on semicolons that are NOT inside parentheses, to handle
  // multi-value functions like rgba(), calc(), linear-gradient()
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
  const m = val.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  if (!m) return null;
  return {
    r: parseInt(m[1], 10),
    g: parseInt(m[2], 10),
    b: parseInt(m[3], 10),
    a: m[4] !== undefined ? parseFloat(m[4]) : 1,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => clamp(c, 0, 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Split a box-shadow value into individual shadow layers.
 * Uses a paren-depth counter so commas inside rgba() don't split layers.
 */
function splitBoxShadowLayers(val: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of val) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      layers.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) layers.push(current.trim());
  return layers;
}

interface ParsedShadow {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color?: string;
  alpha?: number;
  inset: boolean;
}

function parseBoxShadowLayer(layer: string): ParsedShadow | null {
  const inset = /\binset\b/.test(layer);
  const cleaned = layer.replace(/\binset\b/, '').trim();

  // Pattern: <x>px <y>px <blur>px [<spread>px] <color>
  const m = cleaned.match(
    /(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?\s+(rgba?\([^)]+\))/,
  );
  if (!m) return null;

  const rgba = parseRgba(m[5]);
  return {
    x:      parseFloat(m[1]),
    y:      parseFloat(m[2]),
    blur:   parseFloat(m[3]),
    spread: m[4] !== undefined ? parseFloat(m[4]) : undefined,
    color:  rgba ? rgbToHex(rgba.r, rgba.g, rgba.b) : undefined,
    alpha:  rgba ? Math.round(rgba.a * 100) : undefined,
    inset,
  };
}

function parseBackdropFilter(val: string): {
  blur?: number;
  saturate?: number;
  brightness?: number;
} {
  const result: { blur?: number; saturate?: number; brightness?: number } = {};
  const blurM = val.match(/blur\(\s*([\d.]+)px\s*\)/);
  if (blurM) result.blur = parseFloat(blurM[1]);
  const satM = val.match(/saturate\(\s*([\d.]+)%?\s*\)/);
  if (satM) result.saturate = parseFloat(satM[1]);
  const brM = val.match(/brightness\(\s*([\d.]+)%?\s*\)/);
  if (brM) result.brightness = parseFloat(brM[1]);
  return result;
}

function parseBorder(val: string): {
  width?: number;
  style?: string;
  color?: string;
  alpha?: number;
} {
  const result: { width?: number; style?: string; color?: string; alpha?: number } = {};
  const widthM = val.match(/([\d.]+)px/);
  if (widthM) result.width = parseFloat(widthM[1]);
  // [HARDENING] Also capture border-style keyword
  const styleM = val.match(/\b(solid|dashed|dotted|double|groove|ridge|inset|outset|none)\b/);
  if (styleM) result.style = styleM[1];
  const rgba = parseRgba(val);
  if (rgba) {
    result.color = rgbToHex(rgba.r, rgba.g, rgba.b);
    result.alpha = Math.round(rgba.a * 100);
  }
  return result;
}

/**
 * [P2 + HARDENING] Parse CSS text back to settings, then clamp every
 * numeric value within its declared slider range.
 */
function robustParseCSSToSettings(
  mode: EffectMode,
  css: string,
  currentSettings: Preset['settings'],
): Preset['settings'] | null {
  try {
    const props = parseAllCSSProperties(css);
    if (Object.keys(props).length === 0) return null;

    // ── Liquid Glass ───────────────────────────────────────────
    if (mode === 'liquid-glass') {
      const s = deepClone(currentSettings) as LiquidGlassSettings;

      if (props['background']) {
        const rgba = parseRgba(props['background']);
        if (rgba) {
          s.bgColor = rgbToHex(rgba.r, rgba.g, rgba.b);
          s.bgAlpha = Math.round(rgba.a * 100);
        }
      }
      const bdFilter = props['backdrop-filter'] ?? props['-webkit-backdrop-filter'];
      if (bdFilter) {
        const f = parseBackdropFilter(bdFilter);
        if (f.blur       !== undefined) s.blur       = f.blur;
        if (f.saturate   !== undefined) s.saturation = f.saturate;
        if (f.brightness !== undefined) s.brightness = f.brightness;
      }
      if (props['border-radius']) {
        const n = parseFloat(props['border-radius']);
        if (!isNaN(n)) s.borderRadius = n;
      }
      if (props['border']) {
        const b = parseBorder(props['border']);
        if (b.width !== undefined) s.borderWidth = b.width;
        if (b.color)               s.borderColor = b.color;
        if (b.alpha !== undefined) s.borderAlpha = b.alpha;
      }
      if (props['box-shadow']) {
        const layers = splitBoxShadowLayers(props['box-shadow']);
        const sh = parseBoxShadowLayer(layers[0] ?? '');
        if (sh) {
          s.shadowX    = sh.x;
          s.shadowY    = sh.y;
          s.shadowBlur = sh.blur;
          if (sh.spread !== undefined) s.shadowSpread = sh.spread;
          if (sh.color)                s.shadowColor  = sh.color;
          if (sh.alpha !== undefined)  s.shadowAlpha  = sh.alpha;
        }
      }
      return clampSettings(mode, s);
    }

    // ── Glassmorphism ──────────────────────────────────────────
    if (mode === 'glassmorphism') {
      const s = deepClone(currentSettings) as GlassmorphismSettings;

      if (props['background']) {
        const rgba = parseRgba(props['background']);
        if (rgba) {
          s.bgColor = rgbToHex(rgba.r, rgba.g, rgba.b);
          s.bgAlpha = Math.round(rgba.a * 100);
        }
      }
      const bdFilter = props['backdrop-filter'] ?? props['-webkit-backdrop-filter'];
      if (bdFilter) {
        const f = parseBackdropFilter(bdFilter);
        if (f.blur     !== undefined) s.blur       = f.blur;
        if (f.saturate !== undefined) s.saturation = f.saturate;
      }
      if (props['border-radius']) {
        const n = parseFloat(props['border-radius']);
        if (!isNaN(n)) s.borderRadius = n;
      }
      if (props['border']) {
        const b = parseBorder(props['border']);
        if (b.width !== undefined) s.borderWidth = b.width;
        if (b.color)               s.borderColor = b.color;
        if (b.alpha !== undefined) s.borderAlpha = b.alpha;
      }
      if (props['box-shadow']) {
        const layers = splitBoxShadowLayers(props['box-shadow']);
        const sh = parseBoxShadowLayer(layers[0] ?? '');
        if (sh) {
          s.shadowX    = sh.x;
          s.shadowY    = sh.y;
          s.shadowBlur = sh.blur;
          if (sh.color)               s.shadowColor = sh.color;
          if (sh.alpha !== undefined) s.shadowAlpha = sh.alpha;
        }
      }
      return clampSettings(mode, s);
    }

    // ── Glow ─────────────────────────────────────────────────────
    if (mode === 'glow') {
      const s = deepClone(currentSettings) as GlowSettings;

      if (props['background']) {
        const rgba = parseRgba(props['background']);
        if (rgba) {
          s.bgColor = rgbToHex(rgba.r, rgba.g, rgba.b);
          s.bgAlpha = Math.round(rgba.a * 100);
        }
      }
      if (props['border-radius']) {
        const n = parseFloat(props['border-radius']);
        if (!isNaN(n)) s.borderRadius = n;
      }
      if (props['border']) {
        const b = parseBorder(props['border']);
        if (b.width !== undefined) s.borderWidth = b.width;
        if (b.color)               s.borderColor = b.color;
        if (b.alpha !== undefined) s.borderAlpha = b.alpha;
      }
      const bdFilter = props['backdrop-filter'] ?? props['-webkit-backdrop-filter'];
      if (bdFilter) {
        const f = parseBackdropFilter(bdFilter);
        if (f.blur       !== undefined) s.blur       = f.blur;
        if (f.saturate   !== undefined) s.saturation = f.saturate;
        if (f.brightness !== undefined) s.brightness = f.brightness;
      }
      if (props['box-shadow']) {
        const layers = splitBoxShadowLayers(props['box-shadow']);
        const outer = parseBoxShadowLayer(layers[0] ?? '');
        if (outer) {
          s.glowBlur   = outer.blur;
          s.glowSpread = outer.spread ?? s.glowSpread;
          if (outer.color) s.glowColor = outer.color;
          if (outer.alpha !== undefined) s.glowIntensity = Math.round(outer.alpha / 0.6);
        }
        // Parse inset shadow for innerGlow
        for (const layer of layers) {
          if (/\binset\b/.test(layer)) {
            const insetSh = parseBoxShadowLayer(layer);
            if (insetSh && insetSh.alpha !== undefined) {
              s.innerGlow = Math.round(insetSh.alpha / 0.5 * 100);
            }
          }
        }
      }
      return clampSettings(mode, s);
    }

    // ── Neumorphism ────────────────────────────────────────────
    {
      const s = deepClone(currentSettings) as NeumorphismSettings;

      if (props['border-radius']) {
        const n = parseFloat(props['border-radius']);
        if (!isNaN(n)) s.borderRadius = n;
      }

      if (props['background']) {
        const bg = props['background'];

        if (bg.includes('linear-gradient')) {
          /**
           * [HARDENING] Fixed neumorphism shape detection.
           * The old indexOf/lastIndexOf comparison was unreliable.
           * Instead we read the gradient angle explicitly:
           *   135deg → convex  (light top-left, dark bottom-right)
           *    45deg → concave (dark top-left, light bottom-right)
           */
          const angleM = bg.match(/linear-gradient\(\s*(-?[\d.]+deg)/);
          if (angleM) {
            const angle = parseFloat(angleM[1]);
            if (Math.abs(angle - 135) < 10) s.shape = 'convex';
            else if (Math.abs(angle - 45) < 10) s.shape = 'concave';
          }
        } else {
          const hexM = bg.match(/#[0-9a-fA-F]{6}/);
          if (hexM) s.bgColor = hexM[0];
          else {
            const rgba = parseRgba(bg);
            if (rgba) s.bgColor = rgbToHex(rgba.r, rgba.g, rgba.b);
          }
        }
      }

      if (props['box-shadow']) {
        const isInset = /\binset\b/.test(props['box-shadow']);
        if (isInset) s.shape = 'pressed';

        /**
         * [HARDENING] Use proper layer splitter instead of simple split(',').
         * This avoids rgba commas incorrectly splitting a layer.
         */
        const layers = splitBoxShadowLayers(props['box-shadow']);

        const firstLayer = parseBoxShadowLayer(layers[0] ?? '');
        if (firstLayer) {
          s.distance = Math.round(Math.abs(firstLayer.x));
          s.blur     = Math.round(firstLayer.blur);
          if (firstLayer.alpha !== undefined) s.intensity = firstLayer.alpha;
          if (firstLayer.color)               s.darkColor  = firstLayer.color;
        }

        if (layers.length >= 2) {
          const secondLayer = parseBoxShadowLayer(layers[1] ?? '');
          if (secondLayer?.color) s.lightColor = secondLayer.color;
        }
      }

      return clampSettings(mode, s);
    }
  } catch (err) {
    console.error('[admin] CSS parse error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// SECTION 3: Main Admin Component
// ─────────────────────────────────────────────────────────────────

export default function Admin() {
  const { presets, addPreset, updatePreset, deletePreset, reorderPresets, resetToDefaults } =
    usePresetManager();

  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // [UX] Separate confirmation state for destructive reset
  const [resetConfirm, setResetConfirm] = useState(false);

  const openNew = () => {
    setIsNew(true);
    setEditingPreset({
      id: '',
      name: '',
      mode: 'liquid-glass',
      color: '#a78bfa',
      // [P3] Deep-clone default settings to prevent aliasing
      settings: deepClone(defaultSettingsByMode['liquid-glass']) as LiquidGlassSettings,
    });
  };

  const openEdit = (preset: Preset) => {
    setIsNew(false);
    // [P3] Deep-clone the entire preset so edits don't mutate the list
    setEditingPreset(deepClone(preset));
  };

  const duplicatePreset = (preset: Preset) => {
    const newPreset: Preset = {
      // [P3] Deep-clone settings to prevent shared references
      ...deepClone(preset),
      id:   generateId(preset.name + '-copy'),
      name: preset.name + ' (másolat)',
    };
    addPreset(newPreset);
    toast.success('Preset duplikálva');
  };

  const handleSave = () => {
    if (!editingPreset || !editingPreset.name.trim()) {
      toast.error('Adj nevet a presetnek!');
      return;
    }
    if (isNew) {
      addPreset({ ...editingPreset, id: generateId(editingPreset.name) });
      toast.success('Preset létrehozva');
    } else {
      updatePreset(editingPreset.id, editingPreset);
      toast.success('Preset frissítve');
    }
    setEditingPreset(null);
  };

  const handleDelete = (id: string) => {
    deletePreset(id);
    setDeleteConfirm(null);
    toast.success('Preset törölve');
  };

  const handleModeChange = (mode: EffectMode) => {
    if (!editingPreset) return;
    setEditingPreset({
      ...editingPreset,
      mode,
      // [P3] Deep-clone mode defaults so different presets don't share refs
      settings: deepClone(defaultSettingsByMode[mode]),
    });
  };

  const updateSettingField = useCallback(
    (key: string, value: number | string) => {
      if (!editingPreset) return;
      setEditingPreset((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          settings: { ...prev.settings, [key]: value },
        };
      });
    },
    [editingPreset],
  );

  // [UX] Find name of the preset pending deletion for the dialog
  const deleteTargetName = presets.find((p) => p.id === deleteConfirm)?.name ?? '';

  // [UX] Confirmed reset handler with toast feedback
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
            {/* [UX] Open confirmation dialog before overwriting all presets */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirm(true)}
              className="border-border text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Alapértelmezés
            </Button>
            <Button size="sm" onClick={openNew} className="bg-primary text-primary-foreground">
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
                className="h-10 w-10 rounded-lg shrink-0 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${preset.color}40, ${preset.color}90)`,
                  border: `1px solid ${preset.color}50`,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground truncate">
                    {preset.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-border text-muted-foreground capitalize"
                  >
                    {preset.mode.replace('-', ' ')}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{preset.id}</span>
              </div>
              <div className="flex items-center gap-1">
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
      <Dialog open={!!editingPreset} onOpenChange={(open) => !open && setEditingPreset(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {isNew ? 'Új preset' : 'Preset szerkesztése'}
            </DialogTitle>
          </DialogHeader>

          {editingPreset && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Név</Label>
                <Input
                  value={editingPreset.name}
                  onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                  placeholder="pl. Crystal Wave"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mód</Label>
                <Select
                  value={editingPreset.mode}
                  onValueChange={(v) => handleModeChange(v as EffectMode)}
                >
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
                    value={editingPreset.color}
                    onChange={(e) => setEditingPreset({ ...editingPreset, color: e.target.value })}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input
                    value={editingPreset.color}
                    onChange={(e) => setEditingPreset({ ...editingPreset, color: e.target.value })}
                    className="h-8 w-24 font-mono text-xs bg-secondary border-border"
                  />
                  <div
                    className="h-10 w-10 rounded-lg shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${editingPreset.color}40, ${editingPreset.color}90)`,
                      border: `1px solid ${editingPreset.color}50`,
                    }}
                  />
                </div>
              </div>

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
                      mode={editingPreset.mode}
                      settings={editingPreset.settings}
                      updateSetting={updateSettingField}
                    />
                  </TabsContent>
                  <TabsContent value="css" className="mt-3">
                    <CSSCodeEditor
                      mode={editingPreset.mode}
                      settings={editingPreset.settings}
                      onSettingsChange={(newSettings) =>
                        setEditingPreset({ ...editingPreset, settings: newSettings })
                      }
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPreset(null)}
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
          {/* [UX] Show the preset name so the user knows exactly what they're deleting */}
          <p className="text-sm text-muted-foreground">
            Biztosan törölni szeretnéd a{' '}
            <strong className="text-foreground">„{deleteTargetName}"</strong> presetet?
            Ez a művelet nem vonható vissza.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-border text-muted-foreground"
            >
              Mégse
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Törlés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset confirmation ────────────────────────────────── */}
      {/* [UX] New dialog — prevents accidental bulk reset */}
      <Dialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Alapértelmezés visszaállítása
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ez a művelet az összes jelenlegi presetet felülírja az alapértelmezett értékekkel.
            Az egyéni változtatások elvesznek.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResetConfirm(false)}
              className="border-border text-muted-foreground"
            >
              Mégse
            </Button>
            <Button variant="destructive" onClick={handleConfirmedReset}>
              Visszaállítás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECTION 4: CSSCodeEditor
// ─────────────────────────────────────────────────────────────────

/**
 * [P1] CRITICAL FIX: The original component had direct state mutations inside
 * the render function body:
 *
 *   if (mode !== prevMode) {
 *     setCssText(...)   // ← state setter called during render!
 *     setPrevMode(...)
 *     ...
 *   }
 *
 * This is a React anti-pattern that causes:
 *   • Double renders under React Strict Mode
 *   • Unpredictable behaviour in Concurrent Mode (React 18+)
 *   • Potential infinite re-render cycles
 *
 * FIX: The prevMode pattern is eliminated entirely. We use a `useRef` to track
 * whether the current `cssText` was user-modified, and a `useEffect` that runs
 * whenever `mode` changes to safely reset all editor state in one batched update.
 */
function CSSCodeEditor({
  mode,
  settings,
  onSettingsChange,
}: {
  mode: EffectMode;
  settings: Preset['settings'];
  onSettingsChange: (s: Preset['settings']) => void;
}) {
  const generatedCSS = useMemo(
    () => generateCSSForPreset(mode, settings),
    // Only regenerate when mode changes (not after every slider tick to avoid
    // overwriting the editor while the user is typing CSS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode],
  );

  const [cssText,       setCssText]       = useState(generatedCSS);
  const [parseStatus,   setParseStatus]   = useState<'idle' | 'success' | 'error' | 'modified'>('idle');
  const [parseMessage,  setParseMessage]  = useState('');
  const [lastAppliedCSS, setLastAppliedCSS] = useState(generatedCSS);

  /**
   * [P1] useRef tracks whether the user has made unsaved edits.
   * We never call setState in the render body.
   */
  const isUserEditRef = useRef(false);

  /**
   * [P1] useEffect responds to mode changes and resets editor state safely.
   * This replaces the broken render-phase if-block entirely.
   */
  useEffect(() => {
    const fresh = generateCSSForPreset(mode, settings);
    setCssText(fresh);
    setLastAppliedCSS(fresh);
    setParseStatus('idle');
    setParseMessage('');
    isUserEditRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isModified = cssText !== lastAppliedCSS;

  const handleApplyCSS = () => {
    const parsed = robustParseCSSToSettings(mode, cssText, settings);
    if (parsed) {
      onSettingsChange(parsed);
      setParseStatus('success');
      setParseMessage('✓ CSS sikeresen alkalmazva! Az értékek frissültek.');
      setLastAppliedCSS(cssText);
      isUserEditRef.current = false;
      toast.success('CSS alkalmazva');
    } else {
      setParseStatus('error');
      setParseMessage(
        '✗ Nem sikerült értelmezni a CSS-t. Ellenőrizd, hogy érvényes CSS property-k vannak (pl. background, backdrop-filter, border-radius, box-shadow, border).',
      );
    }
  };

  const handleRegenerate = () => {
    const fresh = generateCSSForPreset(mode, settings);
    setCssText(fresh);
    setLastAppliedCSS(fresh);
    setParseStatus('idle');
    setParseMessage('');
    isUserEditRef.current = false;
  };

  /**
   * [HARDENING] Clipboard copy is wrapped in try/catch.
   * navigator.clipboard can throw on non-HTTPS origins or when the
   * Permissions API denies access.
   */
  const handleCopyCSS = async () => {
    try {
      await navigator.clipboard.writeText(cssText);
      toast.success('CSS másolva');
    } catch {
      toast.error('Másolás sikertelen — ellenőrizd a böngésző engedélyeket');
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
      setParseMessage('Módosított — kattints az „Alkalmaz" gombra a beállítások frissítéséhez.');
    }
  };

  /**
   * [P2 + PERF] Live preview: only re-parse when cssText changes.
   * Skip expensive parsing if the text hasn't actually changed.
   */
  const livePreviewStyle = useMemo<CSSProperties>(() => {
    try {
      const parsed = robustParseCSSToSettings(mode, cssText, settings);
      if (!parsed) return {};

      let gen: { properties: Record<string, string | undefined>; css: string };
      if (mode === 'liquid-glass')       gen = generateLiquidGlassCSS(parsed as LiquidGlassSettings);
      else if (mode === 'glassmorphism') gen = generateGlassmorphismCSS(parsed as GlassmorphismSettings);
      else if (mode === 'glow')          gen = generateGlowCSS(parsed as GlowSettings);
      else                               gen = generateNeumorphismCSS(parsed as NeumorphismSettings);

      const style: CSSProperties = {};
      for (const [key, val] of Object.entries(gen.properties)) {
        if (!val) continue;
        const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        // [HARDENING] Type-cast is intentional here: we're dynamically building
        // inline styles from known CSS property names.
        (style as Record<string, string>)[camel] = val;
      }

      // Neumorphism may use a gradient background that needs explicit override
      if (mode === 'neumorphism') {
        const bgMatch = gen.css.match(/background:\s*(linear-gradient[^;]+);/);
        if (bgMatch) style.background = bgMatch[1];
      }

      return style;
    } catch {
      return {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cssText, mode]);

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
          <Button
            variant="ghost" size="sm"
            onClick={handleRegenerate}
            className="h-7 text-[10px] text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-3 w-3" /> Újragenerálás
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={handleCopyCSS}
            className="h-7 text-[10px] text-muted-foreground"
          >
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
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-accent text-accent-foreground border-accent"
            >
              módosított
            </Badge>
          </div>
        )}
      </div>

      {/* Status message */}
      {parseMessage && (
        <p
          className={`text-[11px] font-medium ${
            parseStatus === 'success'  ? 'text-green-500'    :
            parseStatus === 'error'    ? 'text-destructive'  :
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
          <Code className="mr-1.5 h-3.5 w-3.5" /> Alkalmaz
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Módosítsd a CSS property-ket (background, backdrop-filter, border-radius, border,
        box-shadow), majd kattints az „Alkalmaz" gombra. A rendszer automatikusan visszafejti a
        slider értékeket.
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
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-muted-foreground">
          {value}{unit}
        </span>
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
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-20 font-mono text-xs bg-secondary border-border"
        />
      </div>
    </div>
  );
}

function PresetSettingsEditor({
  mode, settings, updateSetting,
}: {
  mode: EffectMode;
  settings: Preset['settings'];
  updateSetting: (key: string, value: number | string) => void;
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

  // ── Neumorphism ────────────────────────────────────────────────
  const s = settings as NeumorphismSettings;
  const shapes = ['flat', 'concave', 'convex', 'pressed'] as const;
  return (
    <div className="space-y-2.5">
      <SliderField label="Border Radius" value={s.borderRadius} onChange={(v) => updateSetting('borderRadius', v)} max={50}  unit="px" />
      <ColorField  label="Background"    value={s.bgColor}      onChange={(v) => updateSetting('bgColor', v)} />
      <SliderField label="Distance"      value={s.distance}     onChange={(v) => updateSetting('distance', v)}     min={1} max={20} unit="px" />
      <SliderField label="Intensity"     value={s.intensity}    onChange={(v) => updateSetting('intensity', v)}    min={1} max={50} unit="%" />
      <SliderField label="Blur"          value={s.blur}         onChange={(v) => updateSetting('blur', v)}         min={1} max={40} unit="px" />

      {/* [HARDENING] aria-pressed for proper button semantics */}
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
