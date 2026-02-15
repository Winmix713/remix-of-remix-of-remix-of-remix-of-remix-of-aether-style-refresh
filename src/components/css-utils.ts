/**
 * css-utils.ts — Advanced CSS Design Engine
 *
 * Architecture overview:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  walkCSS()          PostCSS AST → CSSDeclaration[]             │
 * │  Color              Multi-format color engine (hex/rgb/hsl/     │
 * │                     oklch) + WCAG contrast + shadow generation   │
 * │  parseWithUnit()    rem / em / pt / cm / mm → px normalization  │
 * │  *_RULES            Per-mode semantic validation arrays         │
 * │  parseAndValidateCSS()  Main entry point → ParseResult          │
 * └─────────────────────────────────────────────────────────────────┘
 */

import postcss from 'postcss';
import type {
  Preset,
  EffectMode,
  LiquidGlassSettings,
  GlassmorphismSettings,
  NeumorphismSettings,
  GlowSettings,
} from '@/types/css-generator';

// ══════════════════════════════════════════════════════════════════
// SECTION 1: Types
// ══════════════════════════════════════════════════════════════════

export type Severity = 'error' | 'warning' | 'info';

/** A diagnostic message attached to a specific line / property. */
export interface Diagnostic {
  message: string;
  severity: Severity;
  /** 1-based line number from PostCSS source map */
  line?: number;
  column?: number;
  property?: string;
}

/** A CSS property that exists in the input but is not consumed by the active mode. */
export interface GhostProperty {
  property: string;
  value: string;
  line?: number;
  reason: string;
}

/** WCAG 2.1 accessibility snapshot for the generated surface. */
export interface AccessibilityInfo {
  /** Ratio following WCAG 2.1 formula (1:1 – 21:1) */
  contrastRatio: number;
  /** Whether text placed on this surface passes WCAG AA (≥ 4.5:1) */
  passesAA: boolean;
  /** Whether it passes WCAG AAA (≥ 7:1) */
  passesAAA: boolean;
  /** Recommended text color (#000000 or #ffffff) for this surface */
  recommendedTextColor: string;
  recommendation: string;
}

export interface ParseResult {
  /** Extracted & validated settings, or null if parsing failed entirely */
  settings: Preset['settings'] | null;
  /** All diagnostics: syntax errors, clamping notices, semantic warnings */
  diagnostics: Diagnostic[];
  /** Properties present in the CSS that the current mode ignores */
  ghostProperties: GhostProperty[];
  /** Accessibility analysis for the generated surface */
  accessibility?: AccessibilityInfo;
  /** Names of numeric fields that were clamped to their valid range */
  clampedFields: string[];
}

/** Raw declaration extracted from the PostCSS AST. */
export interface CSSDeclaration {
  property: string;
  value: string;
  line: number;
  column: number;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 2: Utility — clamp
// ══════════════════════════════════════════════════════════════════

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ══════════════════════════════════════════════════════════════════
// SECTION 3: Color Engine
// ══════════════════════════════════════════════════════════════════

/**
 * Immutable color value object.
 *
 * Parses: hex (#rgb #rgba #rrggbb #rrggbbaa), rgb/rgba, hsl/hsla, oklch.
 * All operations return new Color instances (immutable pipeline).
 */
export class Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  private constructor(r: number, g: number, b: number, a = 1) {
    this.r = Math.round(clamp(r, 0, 255));
    this.g = Math.round(clamp(g, 0, 255));
    this.b = Math.round(clamp(b, 0, 255));
    this.a = clamp(a, 0, 1);
  }

  static fromRgba(r: number, g: number, b: number, a = 1): Color {
    return new Color(r, g, b, a);
  }

  static fromHex(hex: string): Color | null {
    const clean = hex.replace(/^#/, '');
    if (![3, 4, 6, 8].includes(clean.length)) return null;
    let r: number, g: number, b: number, a = 255;

    if (clean.length <= 4) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
      if (clean.length === 4) a = parseInt(clean[3] + clean[3], 16);
    } else {
      r = parseInt(clean.slice(0, 2), 16);
      g = parseInt(clean.slice(2, 4), 16);
      b = parseInt(clean.slice(4, 6), 16);
      if (clean.length === 8) a = parseInt(clean.slice(6, 8), 16);
    }

    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return new Color(r, g, b, a / 255);
  }

  static fromHsl(h: number, s: number, l: number, a = 1): Color {
    const sn = s / 100;
    const ln = l / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ln - c / 2;
    let r = 0, g = 0, b = 0;

    if      (h < 60)  { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }

    return new Color((r + m) * 255, (g + m) * 255, (b + m) * 255, a);
  }

  static fromOklch(L: number, C: number, H: number, a = 1): Color {
    const hRad = (H * Math.PI) / 180;
    const okA  = C * Math.cos(hRad);
    const okB  = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * okA + 0.2158037573 * okB;
    const m_ = L - 0.1055613458 * okA - 0.0638541728 * okB;
    const s_ = L - 0.0894841775 * okA - 1.2914855480 * okB;

    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;

    const rLin =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const gamma = (x: number) =>
      x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055;

    return new Color(gamma(rLin) * 255, gamma(gLin) * 255, gamma(bLin) * 255, a);
  }

  static parse(value: string): Color | null {
    const v = value.trim();

    if (v.startsWith('#')) return Color.fromHex(v);

    const oklchM = v.match(
      /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)$/i,
    );
    if (oklchM) {
      const L = oklchM[1].endsWith('%') ? parseFloat(oklchM[1]) / 100 : parseFloat(oklchM[1]);
      const C = parseFloat(oklchM[2]);
      const H = parseFloat(oklchM[3]);
      const a = oklchM[4]
        ? oklchM[4].endsWith('%') ? parseFloat(oklchM[4]) / 100 : parseFloat(oklchM[4])
        : 1;
      return Color.fromOklch(L, C, H, a);
    }

    const hslM = v.match(
      /^hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i,
    );
    if (hslM) {
      const a = hslM[4]
        ? hslM[4].endsWith('%') ? parseFloat(hslM[4]) / 100 : parseFloat(hslM[4])
        : 1;
      return Color.fromHsl(parseFloat(hslM[1]), parseFloat(hslM[2]), parseFloat(hslM[3]), a);
    }

    const rgbM = v.match(
      /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i,
    );
    if (rgbM) {
      const a = rgbM[4]
        ? rgbM[4].endsWith('%') ? parseFloat(rgbM[4]) / 100 : parseFloat(rgbM[4])
        : 1;
      return new Color(parseFloat(rgbM[1]), parseFloat(rgbM[2]), parseFloat(rgbM[3]), a);
    }

    const NAMED: Record<string, string> = {
      white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
      blue: '#0000ff', transparent: '#00000000', silver: '#c0c0c0',
      gray: '#808080', grey: '#808080', navy: '#000080', teal: '#008080',
    };
    if (NAMED[v.toLowerCase()]) return Color.fromHex(NAMED[v.toLowerCase()]);

    return null;
  }

  toHex(): string {
    return '#' + [this.r, this.g, this.b]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('');
  }

  toRgbaString(): string {
    return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
  }

  toRgbaStringWithAlpha(overrideAlpha: number): string {
    return `rgba(${this.r}, ${this.g}, ${this.b}, ${clamp(overrideAlpha, 0, 1).toFixed(2)})`;
  }

  private toHsl(): { h: number; s: number; l: number } {
    const r = this.r / 255, g = this.g / 255, b = this.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };

    const s = d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  lighten(amount: number): Color {
    const { h, s, l } = this.toHsl();
    return Color.fromHsl(h, s, clamp(l + amount * 100, 0, 100), this.a);
  }

  darken(amount: number): Color {
    const { h, s, l } = this.toHsl();
    return Color.fromHsl(h, s, clamp(l - amount * 100, 0, 100), this.a);
  }

  withAlpha(a: number): Color {
    return Color.fromRgba(this.r, this.g, this.b, clamp(a, 0, 1));
  }

  relativeLuminance(): number {
    const linearize = (c: number) => {
      const val = c / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linearize(this.r) + 0.7152 * linearize(this.g) + 0.0722 * linearize(this.b);
  }

  contrastWith(other: Color): number {
    const l1 = this.relativeLuminance();
    const l2 = other.relativeLuminance();
    const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (lighter + 0.05) / (darker + 0.05);
  }

  generateNeumorphismShadows(intensity: number): { light: Color; dark: Color } {
    const { h, s, l } = this.toHsl();
    const delta = (intensity / 100) * 32;

    const light = Color.fromHsl(h, Math.max(0, s - 5), clamp(l + delta, 0, 100));
    const dark  = Color.fromHsl(h, Math.min(100, s + 8), clamp(l - delta, 0, 100));

    return { light, dark };
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTION 4: PostCSS AST Walker
// ══════════════════════════════════════════════════════════════════

export interface WalkResult {
  declarations: CSSDeclaration[];
  syntaxError?: Diagnostic;
}

export function walkCSS(css: string): WalkResult {
  try {
    const root = postcss.parse(css);
    const declarations: CSSDeclaration[] = [];

    root.walkDecls((decl) => {
      declarations.push({
        property: decl.prop.toLowerCase().trim(),
        value:    decl.value.trim(),
        line:     decl.source?.start?.line    ?? 0,
        column:   decl.source?.start?.column  ?? 0,
      });
    });

    return { declarations };
  } catch (err: unknown) {
    const cssErr = err as { line?: number; column?: number; reason?: string; message?: string };
    const syntaxError: Diagnostic = {
      message:  cssErr.reason ?? cssErr.message ?? 'CSS syntax error',
      severity: 'error',
      line:     cssErr.line,
      column:   cssErr.column,
    };

    return { declarations: regexFallbackWalk(css), syntaxError };
  }
}

function regexFallbackWalk(css: string): CSSDeclaration[] {
  const declarations: CSSDeclaration[] = [];
  const inner = css.replace(/^[^{]*\{/, '').replace(/}[^}]*$/, '');

  let depth = 0;
  let buffer = '';
  let lineNum = 1;
  let tokenStartLine = 1;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '\n') lineNum++;
    if (ch === '(') { depth++; buffer += ch; continue; }
    if (ch === ')') { depth--; buffer += ch; continue; }

    if (ch === ';' && depth === 0) {
      const colonIdx = buffer.indexOf(':');
      if (colonIdx > 0) {
        const prop  = buffer.substring(0, colonIdx).trim().toLowerCase();
        const value = buffer.substring(colonIdx + 1).trim();
        if (prop && value) {
          declarations.push({ property: prop, value, line: tokenStartLine, column: 1 });
        }
      }
      buffer = '';
      tokenStartLine = lineNum;
    } else {
      buffer += ch;
    }
  }

  return declarations;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 5: Property Registry
// ══════════════════════════════════════════════════════════════════

export const PROPERTIES_BY_MODE: Record<EffectMode, Record<string, string>> = {
  'liquid-glass': {
    'background':              'Background color and opacity',
    'backdrop-filter':         'Blur, saturation, and brightness filters',
    '-webkit-backdrop-filter': 'WebKit prefix for backdrop-filter',
    'border-radius':           'Corner rounding (px)',
    'border':                  'Border shorthand (width style color)',
    'box-shadow':              'Drop shadow layers',
    'opacity':                 'Element-level opacity',
  },
  'glassmorphism': {
    'background':              'Background color and opacity',
    'backdrop-filter':         'Blur and saturation filters',
    '-webkit-backdrop-filter': 'WebKit prefix for backdrop-filter',
    'border-radius':           'Corner rounding (px)',
    'border':                  'Border shorthand',
    'box-shadow':              'Drop shadow',
    'opacity':                 'Element-level opacity',
  },
  'neumorphism': {
    'background':    'Background color or shape gradient',
    'border-radius': 'Corner rounding (px)',
    'box-shadow':    'Dual-shadow for 3-D depth',
  },
  'glow': {
    'background':              'Background color and opacity',
    'backdrop-filter':         'Blur, saturation, and brightness filters',
    '-webkit-backdrop-filter': 'WebKit prefix for backdrop-filter',
    'border-radius':           'Corner rounding (px)',
    'border':                  'Border shorthand (width style color)',
    'box-shadow':              'Glow shadow layers (outer + inner)',
    'opacity':                 'Element-level opacity',
  },
};

// ══════════════════════════════════════════════════════════════════
// SECTION 6: Unit Normalization
// ══════════════════════════════════════════════════════════════════

const BASE_FONT_PX = 16;

export interface ParsedUnit {
  raw: number;
  unit: string;
  px: number;
  wasConverted: boolean;
}

export function parseWithUnit(raw: string): ParsedUnit | null {
  const m = raw.match(/^(-?[\d.]+)\s*(px|rem|em|%|vh|vw|pt|cm|mm)?$/);
  if (!m) return null;

  const value = parseFloat(m[1]);
  if (isNaN(value)) return null;

  const unit = m[2] ?? 'px';
  let px: number;
  let wasConverted = false;

  switch (unit) {
    case 'px':  px = value;                        break;
    case 'rem': px = value * BASE_FONT_PX;         wasConverted = true; break;
    case 'em':  px = value * BASE_FONT_PX;         wasConverted = true; break;
    case 'pt':  px = value * (4 / 3);              wasConverted = true; break;
    case 'cm':  px = value * 37.7953;              wasConverted = true; break;
    case 'mm':  px = value * 3.77953;              wasConverted = true; break;
    default:    px = value;                        break;
  }

  return { raw: value, unit, px: Math.round(px * 10) / 10, wasConverted };
}

// ══════════════════════════════════════════════════════════════════
// SECTION 7: Setting Ranges
// ══════════════════════════════════════════════════════════════════

export const SETTING_RANGES: Record<EffectMode, Record<string, [number, number]>> = {
  'liquid-glass': {
    blur:                [0,   60],
    opacity:             [0,  100],
    borderRadius:        [0,   50],
    bgAlpha:             [0,  100],
    borderAlpha:         [0,  100],
    borderWidth:         [0,    5],
    refractionIntensity: [0,  100],
    shadowX:             [-20, 20],
    shadowY:             [-20, 20],
    shadowBlur:          [0,   80],
    shadowSpread:        [-20, 20],
    shadowAlpha:         [0,  100],
    saturation:          [50, 200],
    brightness:          [50, 200],
  },
  'glassmorphism': {
    blur:         [0,   50],
    opacity:      [0,  100],
    borderRadius: [0,   50],
    bgAlpha:      [0,  100],
    borderAlpha:  [0,  100],
    borderWidth:  [0,    5],
    shadowX:      [-20, 20],
    shadowY:      [-20, 20],
    shadowBlur:   [0,   60],
    shadowAlpha:  [0,  100],
    saturation:   [50, 200],
  },
  'neumorphism': {
    borderRadius: [0,  50],
    distance:     [1,  20],
    intensity:    [1,  50],
    blur:         [1,  40],
  },
  'glow': {
    borderRadius:  [0,   100],
    bgAlpha:       [0,   100],
    glowIntensity: [0,   100],
    glowSpread:    [0,   100],
    glowBlur:      [0,   200],
    innerGlow:     [0,   100],
    borderAlpha:   [0,   100],
    borderWidth:   [0,     5],
    blur:          [0,    40],
    saturation:    [50,  300],
    brightness:    [50,  300],
  },
};

// ══════════════════════════════════════════════════════════════════
// SECTION 8: Semantic Validation Rules
// ══════════════════════════════════════════════════════════════════

interface SemanticRule<T extends Preset['settings']> {
  id: string;
  severity: Severity;
  message: string;
  property?: string;
  check: (s: T) => boolean;
}

const LIQUID_GLASS_RULES: SemanticRule<LiquidGlassSettings>[] = [
  {
    id: 'blur-performance', severity: 'warning', property: 'blur',
    check: (s) => s.blur > 40,
    message: 'blur > 40px is GPU-intensive and can cause jank on mobile. Values ≤ 30px are recommended.',
  },
  {
    id: 'opacity-blur-imbalance', severity: 'info', property: 'bgAlpha',
    check: (s) => s.bgAlpha > 60 && s.blur < 8,
    message: 'High background opacity with low blur diminishes the liquid-glass refraction effect.',
  },
  {
    id: 'border-invisible', severity: 'info', property: 'borderAlpha',
    check: (s) => s.borderAlpha < 3,
    message: 'borderAlpha is nearly 0 — the border will be invisible.',
  },
  {
    id: 'refraction-saturation-conflict', severity: 'info',
    check: (s) => s.refractionIntensity > 70 && s.saturation < 80,
    message: 'High refractionIntensity with low saturation produces grey, washed-out refraction highlights.',
  },
  {
    id: 'shadow-invisible', severity: 'info', property: 'shadowAlpha',
    check: (s) => s.shadowAlpha < 3,
    message: 'shadowAlpha is nearly 0 — the shadow will be invisible.',
  },
];

const GLASSMORPHISM_RULES: SemanticRule<GlassmorphismSettings>[] = [
  {
    id: 'blur-performance', severity: 'warning', property: 'blur',
    check: (s) => s.blur > 30,
    message: 'blur > 30px is GPU-intensive. Typical glassmorphism uses 10–20px.',
  },
  {
    id: 'opacity-blur-imbalance', severity: 'info', property: 'bgAlpha',
    check: (s) => s.bgAlpha > 60 && s.blur < 8,
    message: 'High background opacity with low blur eliminates the glass transparency effect.',
  },
  {
    id: 'saturation-extreme', severity: 'warning', property: 'saturation',
    check: (s) => s.saturation > 180,
    message: 'saturation > 180% produces unnatural oversaturated color fringing through the glass.',
  },
  {
    id: 'border-too-wide', severity: 'info', property: 'borderWidth',
    check: (s) => s.borderWidth > 3,
    message: 'Borders > 3px are unusual for glassmorphism.',
  },
];

const NEUMORPHISM_RULES: SemanticRule<NeumorphismSettings>[] = [
  {
    id: 'distance-blur-ratio', severity: 'info', property: 'blur',
    check: (s) => s.blur < s.distance,
    message: 'blur should be ≥ distance for natural-looking neumorphism.',
  },
  {
    id: 'intensity-extreme', severity: 'warning', property: 'intensity',
    check: (s) => s.intensity > 35,
    message: 'intensity > 35% makes shadows harsh and unrealistic.',
  },
  {
    id: 'distance-flat', severity: 'info', property: 'distance',
    check: (s) => s.distance <= 1,
    message: 'Very small distance produces a flat look with no 3-D depth.',
  },
  {
    id: 'radius-mismatch', severity: 'info', property: 'borderRadius',
    check: (s) => s.shape !== 'flat' && s.borderRadius < 4,
    message: 'Shaped neumorphism normally uses a rounded border-radius (≥ 8px).',
  },
];

const GLOW_RULES: SemanticRule<GlowSettings>[] = [
  {
    id: 'glow-blur-extreme', severity: 'warning', property: 'glowBlur',
    check: (s) => s.glowBlur > 150,
    message: 'glowBlur > 150px is very GPU-intensive and may cause performance issues.',
  },
  {
    id: 'glow-invisible', severity: 'info', property: 'glowIntensity',
    check: (s) => s.glowIntensity < 5,
    message: 'glowIntensity is nearly 0 — the glow effect will be invisible.',
  },
  {
    id: 'inner-glow-no-outer', severity: 'info',
    check: (s) => s.innerGlow > 40 && s.glowIntensity < 10,
    message: 'Strong inner glow without outer glow looks like an inset shadow rather than a glow effect.',
  },
];

// ══════════════════════════════════════════════════════════════════
// SECTION 9: CSS Value Parsers
// ══════════════════════════════════════════════════════════════════

function splitShadowLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let buf = '';

  for (const ch of value) {
    if      (ch === '(') { depth++; buf += ch; }
    else if (ch === ')') { depth--; buf += ch; }
    else if (ch === ',' && depth === 0) {
      const trimmed = buf.trim();
      if (trimmed) layers.push(trimmed);
      buf = '';
    } else {
      buf += ch;
    }
  }

  const trimmed = buf.trim();
  if (trimmed) layers.push(trimmed);
  return layers;
}

interface ParsedShadow {
  x: number; y: number; blur: number; spread?: number;
  color?: string; alpha?: number; inset: boolean;
}

function parseShadowLayer(layer: string): ParsedShadow | null {
  const inset   = /\binset\b/.test(layer);
  const cleaned = layer.replace(/\binset\b/, '').trim();

  const m = cleaned.match(
    /(-?[\d.]+px)\s+(-?[\d.]+px)\s+([\d.]+px)(?:\s+(-?[\d.]+px))?\s+(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/,
  );
  if (!m) return null;

  const pxVal = (s: string) => parseFloat(s);
  const color = Color.parse(m[5]);

  return {
    x:       pxVal(m[1]),
    y:       pxVal(m[2]),
    blur:    pxVal(m[3]),
    spread:  m[4] ? pxVal(m[4]) : undefined,
    color:   color?.toHex(),
    alpha:   color ? Math.round(color.a * 100) : undefined,
    inset,
  };
}

function parseBackdropFilter(value: string): {
  blur?: number; saturate?: number; brightness?: number;
} {
  const result: { blur?: number; saturate?: number; brightness?: number } = {};
  const blurM = value.match(/blur\(\s*([\d.]+)px\s*\)/);
  if (blurM) result.blur = parseFloat(blurM[1]);
  const satM = value.match(/saturate\(\s*([\d.]+)%?\s*\)/);
  if (satM) result.saturate = parseFloat(satM[1]);
  const brM = value.match(/brightness\(\s*([\d.]+)%?\s*\)/);
  if (brM) result.brightness = parseFloat(brM[1]);
  return result;
}

function parseBorder(value: string): {
  width?: number; style?: string; color?: string; alpha?: number;
} {
  const result: { width?: number; style?: string; color?: string; alpha?: number } = {};

  const widthM = value.match(/([\d.]+(?:px|rem|em|pt))/);
  if (widthM) {
    const parsed = parseWithUnit(widthM[1]);
    if (parsed) result.width = parsed.px;
  }

  const styleM = value.match(/\b(solid|dashed|dotted|double|groove|ridge|none|hidden)\b/);
  if (styleM) result.style = styleM[1];

  const colorPart = value.replace(/[\d.]+(?:px|rem|em|pt)/, '').replace(styleM?.[0] ?? '', '');
  const color = Color.parse(colorPart.trim());
  if (color) {
    result.color = color.toHex();
    result.alpha = Math.round(color.a * 100);
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 10: Mode-Specific Extractors
// ══════════════════════════════════════════════════════════════════

type PropLookup = (prop: string) => CSSDeclaration | undefined;

function extractLiquidGlass(
  get: PropLookup,
  current: LiquidGlassSettings,
  diagnostics: Diagnostic[],
  clampedFields: string[],
): LiquidGlassSettings {
  const s: LiquidGlassSettings = { ...current };

  const bg = get('background');
  if (bg) {
    const color = Color.parse(bg.value);
    if (color) {
      s.bgColor = color.toHex();
      s.bgAlpha = Math.round(color.a * 100);
    } else {
      diagnostics.push({
        severity: 'warning', line: bg.line,
        message: `Could not parse 'background' color value: "${bg.value}"`,
        property: 'background',
      });
    }
  }

  const bdVal = (get('backdrop-filter') ?? get('-webkit-backdrop-filter'))?.value;
  if (bdVal) {
    const f = parseBackdropFilter(bdVal);
    if (f.blur       !== undefined) s.blur       = f.blur;
    if (f.saturate   !== undefined) s.saturation = f.saturate;
    if (f.brightness !== undefined) s.brightness = f.brightness;
  }

  const br = get('border-radius');
  if (br) {
    const parsed = parseWithUnit(br.value.split(' ')[0]);
    if (parsed) {
      if (parsed.wasConverted) {
        diagnostics.push({
          severity: 'info', line: br.line,
          message: `border-radius: converted ${parsed.raw}${parsed.unit} → ${parsed.px}px`,
          property: 'border-radius',
        });
      }
      s.borderRadius = parsed.px;
    }
  }

  const border = get('border');
  if (border) {
    const b = parseBorder(border.value);
    if (b.width !== undefined) s.borderWidth = b.width;
    if (b.color)               s.borderColor = b.color;
    if (b.alpha !== undefined) s.borderAlpha = b.alpha;
  }

  const shadow = get('box-shadow');
  if (shadow) {
    const layers = splitShadowLayers(shadow.value);
    const sh = layers.map(parseShadowLayer).find((l) => l && !l.inset);
    if (sh) {
      s.shadowX    = sh.x;
      s.shadowY    = sh.y;
      s.shadowBlur = sh.blur;
      if (sh.spread !== undefined) s.shadowSpread = sh.spread;
      if (sh.color)                s.shadowColor  = sh.color;
      if (sh.alpha !== undefined)  s.shadowAlpha  = sh.alpha;
    }
  }

  void clampedFields;
  return s;
}

function extractGlassmorphism(
  get: PropLookup,
  current: GlassmorphismSettings,
  diagnostics: Diagnostic[],
  clampedFields: string[],
): GlassmorphismSettings {
  const s: GlassmorphismSettings = { ...current };

  const bg = get('background');
  if (bg) {
    const color = Color.parse(bg.value);
    if (color) { s.bgColor = color.toHex(); s.bgAlpha = Math.round(color.a * 100); }
    else diagnostics.push({ severity: 'warning', line: bg.line,
      message: `Could not parse 'background': "${bg.value}"`, property: 'background' });
  }

  const bdVal = (get('backdrop-filter') ?? get('-webkit-backdrop-filter'))?.value;
  if (bdVal) {
    const f = parseBackdropFilter(bdVal);
    if (f.blur     !== undefined) s.blur       = f.blur;
    if (f.saturate !== undefined) s.saturation = f.saturate;
  }

  const br = get('border-radius');
  if (br) {
    const parsed = parseWithUnit(br.value.split(' ')[0]);
    if (parsed) {
      if (parsed.wasConverted) diagnostics.push({ severity: 'info', line: br.line,
        message: `border-radius: converted ${parsed.raw}${parsed.unit} → ${parsed.px}px`,
        property: 'border-radius' });
      s.borderRadius = parsed.px;
    }
  }

  const border = get('border');
  if (border) {
    const b = parseBorder(border.value);
    if (b.width !== undefined) s.borderWidth = b.width;
    if (b.color)               s.borderColor = b.color;
    if (b.alpha !== undefined) s.borderAlpha = b.alpha;
  }

  const shadow = get('box-shadow');
  if (shadow) {
    const layers = splitShadowLayers(shadow.value);
    const sh = layers.map(parseShadowLayer).find((l) => l && !l.inset);
    if (sh) {
      s.shadowX    = sh.x;
      s.shadowY    = sh.y;
      s.shadowBlur = sh.blur;
      if (sh.color)               s.shadowColor = sh.color;
      if (sh.alpha !== undefined) s.shadowAlpha = sh.alpha;
    }
  }

  void clampedFields;
  return s;
}

function extractNeumorphism(
  get: PropLookup,
  current: NeumorphismSettings,
  diagnostics: Diagnostic[],
  clampedFields: string[],
): NeumorphismSettings {
  const s: NeumorphismSettings = { ...current };

  const br = get('border-radius');
  if (br) {
    const parsed = parseWithUnit(br.value.split(' ')[0]);
    if (parsed) s.borderRadius = parsed.px;
  }

  const bg = get('background');
  if (bg) {
    const bgVal = bg.value;

    if (bgVal.includes('linear-gradient')) {
      const angleM = bgVal.match(/linear-gradient\(\s*(-?[\d.]+)deg/);
      if (angleM) {
        const angle = parseFloat(angleM[1]);
        const normalized = ((angle % 360) + 360) % 360;
        if (Math.abs(normalized - 145) < 15 || Math.abs(normalized - 135) < 15) {
          s.shape = 'convex';
        } else if (Math.abs(normalized - 315) < 15 || Math.abs(normalized - 45) < 15) {
          s.shape = 'concave';
        }
      }
      const firstColor = bgVal.match(/,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/);
      if (firstColor) {
        const c = Color.parse(firstColor[1]);
        if (c) s.bgColor = c.toHex();
      }
    } else {
      const c = Color.parse(bgVal);
      if (c) s.bgColor = c.toHex();
    }
  }

  const shadow = get('box-shadow');
  if (shadow) {
    const isPressed = /\binset\b/.test(shadow.value);
    if (isPressed) s.shape = 'pressed';

    const layers = splitShadowLayers(shadow.value);
    const parsed = layers.map(parseShadowLayer).filter(Boolean) as ParsedShadow[];

    const bgColor = Color.fromHex(s.bgColor);
    const darkLayer = parsed.find((l) => {
      if (l.inset) return false;
      const c = l.color ? Color.fromHex(l.color) : null;
      return c && bgColor ? c.relativeLuminance() < bgColor.relativeLuminance() : false;
    }) ?? parsed.find((l) => !l.inset);

    const lightLayer = parsed.find((l) => {
      if (l.inset) return false;
      const c = l.color ? Color.fromHex(l.color) : null;
      return c && bgColor ? c.relativeLuminance() > bgColor.relativeLuminance() : false;
    }) ?? parsed.filter((l) => !l.inset)[1];

    if (darkLayer) {
      s.distance = Math.round(Math.abs(darkLayer.x || darkLayer.y || 0));
      s.blur     = Math.round(darkLayer.blur);
      if (darkLayer.alpha !== undefined) s.intensity = darkLayer.alpha;
      if (darkLayer.color)               s.darkColor  = darkLayer.color;
    }
    if (lightLayer?.color) s.lightColor = lightLayer.color;

    if (s.bgColor && !lightLayer) {
      const bgC = Color.fromHex(s.bgColor);
      if (bgC) {
        const { light, dark } = bgC.generateNeumorphismShadows(s.intensity ?? 15);
        diagnostics.push({
          severity: 'info',
          message: `Only one shadow layer found. Auto-suggesting: light=${light.toHex()}, dark=${dark.toHex()} based on bgColor.`,
          property: 'box-shadow',
        });
      }
    }
  }

  void clampedFields;
  return s;
}

function extractGlow(
  get: PropLookup,
  current: GlowSettings,
  diagnostics: Diagnostic[],
  clampedFields: string[],
): GlowSettings {
  const s: GlowSettings = { ...current };

  const bg = get('background');
  if (bg) {
    const color = Color.parse(bg.value);
    if (color) {
      s.bgColor = color.toHex();
      s.bgAlpha = Math.round(color.a * 100);
    } else {
      diagnostics.push({
        severity: 'warning', line: bg.line,
        message: `Could not parse 'background' color value: "${bg.value}"`,
        property: 'background',
      });
    }
  }

  const bdVal = (get('backdrop-filter') ?? get('-webkit-backdrop-filter'))?.value;
  if (bdVal) {
    const f = parseBackdropFilter(bdVal);
    if (f.blur       !== undefined) s.blur       = f.blur;
    if (f.saturate   !== undefined) s.saturation = f.saturate;
    if (f.brightness !== undefined) s.brightness = f.brightness;
  }

  const br = get('border-radius');
  if (br) {
    const parsed = parseWithUnit(br.value.split(' ')[0]);
    if (parsed) {
      if (parsed.wasConverted) {
        diagnostics.push({
          severity: 'info', line: br.line,
          message: `border-radius: converted ${parsed.raw}${parsed.unit} → ${parsed.px}px`,
          property: 'border-radius',
        });
      }
      s.borderRadius = parsed.px;
    }
  }

  const border = get('border');
  if (border) {
    const b = parseBorder(border.value);
    if (b.width !== undefined) s.borderWidth = b.width;
    if (b.color)               s.borderColor = b.color;
    if (b.alpha !== undefined) s.borderAlpha = b.alpha;
  }

  const shadow = get('box-shadow');
  if (shadow) {
    const layers = splitShadowLayers(shadow.value);
    const parsedLayers = layers.map(parseShadowLayer).filter(Boolean) as ParsedShadow[];

    // Outer glow: largest blur non-inset layer
    const outerGlow = parsedLayers
      .filter((l) => !l.inset)
      .sort((a, b) => b.blur - a.blur)[0];

    if (outerGlow) {
      if (outerGlow.color) s.glowColor = outerGlow.color;
      s.glowBlur = Math.round(outerGlow.blur);
      if (outerGlow.spread !== undefined) s.glowSpread = Math.round(outerGlow.spread);
      if (outerGlow.alpha !== undefined) s.glowIntensity = Math.round(outerGlow.alpha / 0.6);
    }

    // Inner glow: inset layer
    const innerLayer = parsedLayers.find((l) => l.inset);
    if (innerLayer) {
      s.innerGlow = Math.round(innerLayer.blur);
    }
  }

  void clampedFields;
  return s;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 11: Clamping & Semantic Rule Runner
// ══════════════════════════════════════════════════════════════════

function clampWithTracking(
  mode: EffectMode,
  settings: Preset['settings'],
  diagnostics: Diagnostic[],
  clampedFields: string[],
): Preset['settings'] {
  const ranges = SETTING_RANGES[mode] ?? {};
  const out = { ...settings } as Record<string, unknown>;

  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'number' && ranges[key]) {
      const [min, max] = ranges[key];
      const clamped = clamp(value, min, max);
      if (clamped !== value) {
        out[key] = clamped;
        clampedFields.push(key);
        diagnostics.push({
          severity: 'info',
          message: `'${key}' value ${value} clamped to ${clamped} (valid range: ${min}–${max})`,
          property: key,
        });
      }
    }
  }

  return out as unknown as Preset['settings'];
}

function runSemanticRules(
  mode: EffectMode,
  settings: Preset['settings'],
  diagnostics: Diagnostic[],
): void {
  const rules =
    mode === 'liquid-glass'   ? LIQUID_GLASS_RULES   :
    mode === 'glassmorphism'  ? GLASSMORPHISM_RULES  :
    mode === 'glow'           ? GLOW_RULES           :
                                NEUMORPHISM_RULES;

  for (const rule of rules as SemanticRule<Preset['settings']>[]) {
    if (rule.check(settings)) {
      diagnostics.push({
        severity: rule.severity,
        message:  rule.message,
        property: rule.property,
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTION 12: Accessibility Analysis
// ══════════════════════════════════════════════════════════════════

function calculateAccessibility(
  mode: EffectMode,
  settings: Preset['settings'],
): AccessibilityInfo | undefined {
  try {
    let bgHex: string | undefined;
    let bgAlpha = 100;

    if (mode === 'liquid-glass') {
      const s = settings as LiquidGlassSettings;
      bgHex = s.bgColor; bgAlpha = s.bgAlpha;
    } else if (mode === 'glassmorphism') {
      const s = settings as GlassmorphismSettings;
      bgHex = s.bgColor; bgAlpha = s.bgAlpha;
    } else if (mode === 'glow') {
      const s = settings as GlowSettings;
      bgHex = s.bgColor; bgAlpha = s.bgAlpha;
    } else {
      const s = settings as NeumorphismSettings;
      bgHex = s.bgColor; bgAlpha = 100;
    }

    if (!bgHex) return undefined;
    const bgColor = Color.fromHex(bgHex);
    if (!bgColor) return undefined;

    const blendFactor = bgAlpha / 100;
    const MID_GRAY = 0.5;
    const effectiveLum =
      bgColor.relativeLuminance() * blendFactor + MID_GRAY * (1 - blendFactor);

    const blackContrast = (effectiveLum + 0.05) / (0 + 0.05);
    const whiteContrast = (1 + 0.05) / (effectiveLum + 0.05);
    const recommendedTextColor = whiteContrast > blackContrast ? '#ffffff' : '#000000';
    const contrastRatio = Math.max(blackContrast, whiteContrast);

    const passesAA  = contrastRatio >= 4.5;
    const passesAAA = contrastRatio >= 7.0;

    const recommendation = passesAAA
      ? `Excellent contrast (${contrastRatio.toFixed(1)}:1) — passes WCAG AAA.`
      : passesAA
      ? `Good contrast (${contrastRatio.toFixed(1)}:1) — passes WCAG AA. Consider increasing bgAlpha for AAA.`
      : `Low contrast (${contrastRatio.toFixed(1)}:1) — fails WCAG AA. Text readability on this surface may be poor.`;

    return { contrastRatio, passesAA, passesAAA, recommendedTextColor, recommendation };
  } catch {
    return undefined;
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTION 13: Main Entry Point
// ══════════════════════════════════════════════════════════════════

export function parseAndValidateCSS(
  mode: EffectMode,
  css: string,
  currentSettings: Preset['settings'],
): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const ghostProperties: GhostProperty[] = [];
  const clampedFields: string[] = [];

  const { declarations, syntaxError } = walkCSS(css);
  if (syntaxError) diagnostics.push(syntaxError);

  if (declarations.length === 0 && syntaxError) {
    return { settings: null, diagnostics, ghostProperties, clampedFields };
  }

  const propMap = new Map<string, CSSDeclaration>();
  const knownForMode = PROPERTIES_BY_MODE[mode];

  for (const decl of declarations) {
    propMap.set(decl.property, decl);

    if (!(decl.property in knownForMode)) {
      ghostProperties.push({
        property: decl.property,
        value:    decl.value,
        line:     decl.line,
        reason:   `'${decl.property}' is not used by ${mode} — it will be ignored.`,
      });
    }
  }

  const get: PropLookup = (prop) => propMap.get(prop);

  let rawSettings: Preset['settings'];
  if (mode === 'liquid-glass') {
    rawSettings = extractLiquidGlass(get, currentSettings as LiquidGlassSettings, diagnostics, clampedFields);
  } else if (mode === 'glassmorphism') {
    rawSettings = extractGlassmorphism(get, currentSettings as GlassmorphismSettings, diagnostics, clampedFields);
  } else if (mode === 'glow') {
    rawSettings = extractGlow(get, currentSettings as GlowSettings, diagnostics, clampedFields);
  } else {
    rawSettings = extractNeumorphism(get, currentSettings as NeumorphismSettings, diagnostics, clampedFields);
  }

  const settings = clampWithTracking(mode, rawSettings, diagnostics, clampedFields);
  runSemanticRules(mode, settings, diagnostics);
  const accessibility = calculateAccessibility(mode, settings);

  return { settings, diagnostics, ghostProperties, clampedFields, accessibility };
}
