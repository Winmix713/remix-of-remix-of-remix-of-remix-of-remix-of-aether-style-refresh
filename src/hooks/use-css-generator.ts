import { useState, useMemo, useCallback } from 'react';
import type {
  EffectMode,
  LiquidGlassSettings,
  GlassmorphismSettings,
  NeumorphismSettings,
  GlowSettings,
  GeneratedCSS,
  Preset,
  PreviewTab,
} from '@/types/css-generator';

const defaultLiquidGlass: LiquidGlassSettings = {
  blur: 20, opacity: 80, borderRadius: 16,
  bgColor: '#ffffff', bgAlpha: 12,
  borderColor: '#ffffff', borderAlpha: 20, borderWidth: 1,
  refractionIntensity: 30,
  shadowX: 0, shadowY: 8, shadowBlur: 32, shadowSpread: 0,
  shadowColor: '#000000', shadowAlpha: 25,
  saturation: 120, brightness: 110,
};

const defaultGlassmorphism: GlassmorphismSettings = {
  blur: 16, opacity: 75, borderRadius: 12,
  bgColor: '#ffffff', bgAlpha: 10,
  borderColor: '#ffffff', borderAlpha: 18, borderWidth: 1,
  shadowX: 0, shadowY: 4, shadowBlur: 30,
  shadowColor: '#000000', shadowAlpha: 20, saturation: 100,
};

const defaultNeumorphism: NeumorphismSettings = {
  borderRadius: 16, bgColor: '#e0e5ec', distance: 6,
  intensity: 15, blur: 12, shape: 'flat',
  lightColor: '#ffffff', darkColor: '#a3b1c6',
};

const defaultGlow: GlowSettings = {
  borderRadius: 24, bgColor: '#1a1a2e', bgAlpha: 85,
  glowColor: '#facc15', glowIntensity: 60, glowSpread: 30, glowBlur: 60,
  innerGlow: 20,
  borderColor: '#facc15', borderAlpha: 40, borderWidth: 1,
  blur: 8, saturation: 150, brightness: 110,
};

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/** Convert hex to oklch-ish string for CSS output */
function hexToOklch(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Approximate oklch: convert to linear sRGB → oklab → oklch
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l3 = Math.cbrt(l_), m3 = Math.cbrt(m_), s3 = Math.cbrt(s_);
  const L = 0.2104542553 * l3 + 0.7936177850 * m3 - 0.0040720468 * s3;
  const a = 1.9779984951 * l3 - 2.4285922050 * m3 + 0.4505937099 * s3;
  const bOk = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.8086757660 * s3;
  const C = Math.sqrt(a * a + bOk * bOk);
  let H = Math.atan2(bOk, a) * 180 / Math.PI;
  if (H < 0) H += 360;
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}

export function generateGlowCSS(s: GlowSettings): GeneratedCSS {
  const bg = hexToRgb(s.bgColor);
  const border = hexToRgb(s.borderColor);
  const glowOklch = hexToOklch(s.glowColor);
  const glowRgb = hexToRgb(s.glowColor);
  const intensity = s.glowIntensity / 100;

  const outerShadow = `0 0 ${s.glowBlur}px ${s.glowSpread}px rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${(intensity * 0.6).toFixed(2)})`;
  const midShadow = `0 0 ${Math.round(s.glowBlur * 0.5)}px ${Math.round(s.glowSpread * 0.4)}px rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${(intensity * 0.3).toFixed(2)})`;
  const innerShadow = s.innerGlow > 0
    ? `, inset 0 0 ${Math.round(s.innerGlow * 0.8)}px rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, ${(s.innerGlow / 100 * 0.5).toFixed(2)})`
    : '';

  const properties: Record<string, string> = {
    'background': `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${s.bgAlpha / 100})`,
    'border-radius': `${s.borderRadius}px`,
    'border': `${s.borderWidth}px solid rgba(${border.r}, ${border.g}, ${border.b}, ${s.borderAlpha / 100})`,
    'box-shadow': `${outerShadow}, ${midShadow}${innerShadow}`,
    'backdrop-filter': `blur(${s.blur}px) saturate(${s.saturation}%) brightness(${s.brightness}%)`,
    '-webkit-backdrop-filter': `blur(${s.blur}px) saturate(${s.saturation}%) brightness(${s.brightness}%)`,
  };

  // Build CSS with oklch comment for reference
  let css = `.glow {\n`;
  css += `  /* Glow color in oklch: ${glowOklch} */\n`;
  for (const [k, v] of Object.entries(properties)) {
    css += `  ${k}: ${v};\n`;
  }
  css += `}`;

  return { css, properties };
}

export function generateLiquidGlassCSS(s: LiquidGlassSettings): GeneratedCSS {
  const bg = hexToRgb(s.bgColor);
  const border = hexToRgb(s.borderColor);
  const shadow = hexToRgb(s.shadowColor);

  const properties: Record<string, string> = {
    'background': `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${s.bgAlpha / 100})`,
    'backdrop-filter': `blur(${s.blur}px) saturate(${s.saturation}%) brightness(${s.brightness}%)`,
    '-webkit-backdrop-filter': `blur(${s.blur}px) saturate(${s.saturation}%) brightness(${s.brightness}%)`,
    'border-radius': `${s.borderRadius}px`,
    'border': `${s.borderWidth}px solid rgba(${border.r}, ${border.g}, ${border.b}, ${s.borderAlpha / 100})`,
    'box-shadow': `${s.shadowX}px ${s.shadowY}px ${s.shadowBlur}px ${s.shadowSpread}px rgba(${shadow.r}, ${shadow.g}, ${shadow.b}, ${s.shadowAlpha / 100})`,
  };

  const css = Object.entries(properties).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return { css: `.liquid-glass {\n${css}\n}`, properties };
}

export function generateGlassmorphismCSS(s: GlassmorphismSettings): GeneratedCSS {
  const bg = hexToRgb(s.bgColor);
  const border = hexToRgb(s.borderColor);
  const shadow = hexToRgb(s.shadowColor);

  const properties: Record<string, string> = {
    'background': `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${s.bgAlpha / 100})`,
    'backdrop-filter': `blur(${s.blur}px) saturate(${s.saturation}%)`,
    '-webkit-backdrop-filter': `blur(${s.blur}px) saturate(${s.saturation}%)`,
    'border-radius': `${s.borderRadius}px`,
    'border': `${s.borderWidth}px solid rgba(${border.r}, ${border.g}, ${border.b}, ${s.borderAlpha / 100})`,
    'box-shadow': `${s.shadowX}px ${s.shadowY}px ${s.shadowBlur}px rgba(${shadow.r}, ${shadow.g}, ${shadow.b}, ${s.shadowAlpha / 100})`,
  };

  const css = Object.entries(properties).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return { css: `.glassmorphism {\n${css}\n}`, properties };
}

export function generateNeumorphismCSS(s: NeumorphismSettings): GeneratedCSS {
  const light = hexToRgb(s.lightColor);
  const dark = hexToRgb(s.darkColor);
  const d = s.distance;
  const b = s.blur;
  const i = s.intensity / 100;

  let shadow: string;
  let gradient = '';

  switch (s.shape) {
    case 'concave':
      shadow = `${d}px ${d}px ${b}px rgba(${dark.r}, ${dark.g}, ${dark.b}, ${i}), -${d}px -${d}px ${b}px rgba(${light.r}, ${light.g}, ${light.b}, ${i})`;
      gradient = `background: linear-gradient(145deg, ${darken(s.bgColor, 5)}, ${lighten(s.bgColor, 5)});`;
      break;
    case 'convex':
      shadow = `${d}px ${d}px ${b}px rgba(${dark.r}, ${dark.g}, ${dark.b}, ${i}), -${d}px -${d}px ${b}px rgba(${light.r}, ${light.g}, ${light.b}, ${i})`;
      gradient = `background: linear-gradient(145deg, ${lighten(s.bgColor, 5)}, ${darken(s.bgColor, 5)});`;
      break;
    case 'pressed':
      shadow = `inset ${d}px ${d}px ${b}px rgba(${dark.r}, ${dark.g}, ${dark.b}, ${i}), inset -${d}px -${d}px ${b}px rgba(${light.r}, ${light.g}, ${light.b}, ${i})`;
      break;
    default:
      shadow = `${d}px ${d}px ${b}px rgba(${dark.r}, ${dark.g}, ${dark.b}, ${i}), -${d}px -${d}px ${b}px rgba(${light.r}, ${light.g}, ${light.b}, ${i})`;
  }

  const properties: Record<string, string> = {
    'border-radius': `${s.borderRadius}px`,
    'background': gradient ? '' : s.bgColor,
    'box-shadow': shadow,
  };

  if (gradient) {
    properties['background'] = '';
  }

  let css = `.neumorphism {\n  border-radius: ${s.borderRadius}px;\n`;
  if (gradient) {
    css += `  ${gradient}\n`;
  } else {
    css += `  background: ${s.bgColor};\n`;
  }
  css += `  box-shadow: ${shadow};\n}`;

  return { css, properties };
}

function lighten(hex: string, pct: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(2.55 * pct);
  return `rgb(${Math.min(255, r + amt)}, ${Math.min(255, g + amt)}, ${Math.min(255, b + amt)})`;
}

function darken(hex: string, pct: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(2.55 * pct);
  return `rgb(${Math.max(0, r - amt)}, ${Math.max(0, g - amt)}, ${Math.max(0, b - amt)})`;
}

export const presets: Preset[] = [
  { id: 'liquid-crystal', name: 'Liquid Crystal', mode: 'liquid-glass', color: '#a78bfa',
    settings: { ...defaultLiquidGlass, blur: 24, bgAlpha: 8, saturation: 140, brightness: 115 } },
  { id: 'fluid-amber', name: 'Fluid Amber', mode: 'liquid-glass', color: '#f59e0b',
    settings: { ...defaultLiquidGlass, bgColor: '#f59e0b', bgAlpha: 15, blur: 18 } },
  { id: 'ice-ripple', name: 'Ice Ripple', mode: 'glassmorphism', color: '#67e8f9',
    settings: { ...defaultGlassmorphism, bgColor: '#67e8f9', bgAlpha: 8, blur: 20 } },
  { id: 'mercury-drop', name: 'Mercury Drop', mode: 'liquid-glass', color: '#94a3b8',
    settings: { ...defaultLiquidGlass, bgColor: '#94a3b8', bgAlpha: 18, refractionIntensity: 50 } },
  { id: 'ocean-wave', name: 'Ocean Wave', mode: 'glassmorphism', color: '#3b82f6',
    settings: { ...defaultGlassmorphism, bgColor: '#3b82f6', bgAlpha: 12, blur: 22 } },
  { id: 'crystal-mist', name: 'Crystal Mist', mode: 'glassmorphism', color: '#e2e8f0',
    settings: { ...defaultGlassmorphism, bgColor: '#e2e8f0', bgAlpha: 6, blur: 28 } },
  { id: 'molten-glass', name: 'Molten Glass', mode: 'liquid-glass', color: '#ef4444',
    settings: { ...defaultLiquidGlass, bgColor: '#ef4444', bgAlpha: 14, brightness: 120 } },
  { id: 'silk-veil', name: 'Silk Veil', mode: 'glassmorphism', color: '#f0abfc',
    settings: { ...defaultGlassmorphism, bgColor: '#f0abfc', bgAlpha: 10, blur: 14 } },
  { id: 'plasma-flow', name: 'Plasma Flow', mode: 'liquid-glass', color: '#8b5cf6',
    settings: { ...defaultLiquidGlass, bgColor: '#8b5cf6', bgAlpha: 16, saturation: 150 } },
  { id: 'frost-lens', name: 'Frost Lens', mode: 'glassmorphism', color: '#bfdbfe',
    settings: { ...defaultGlassmorphism, bgColor: '#bfdbfe', bgAlpha: 8, blur: 30 } },
  { id: 'aurora-gel', name: 'Aurora Gel', mode: 'liquid-glass', color: '#34d399',
    settings: { ...defaultLiquidGlass, bgColor: '#34d399', bgAlpha: 12, saturation: 130 } },
  { id: 'nebula-prism', name: 'Nebula Prism', mode: 'liquid-glass', color: '#ec4899',
    settings: { ...defaultLiquidGlass, bgColor: '#ec4899', bgAlpha: 14, brightness: 115 } },
  // Glow presets
  { id: 'solar-flare', name: 'Solar Flare', mode: 'glow', color: '#facc15',
    settings: { ...defaultGlow } },
  { id: 'neon-pulse', name: 'Neon Pulse', mode: 'glow', color: '#22d3ee',
    settings: { ...defaultGlow, glowColor: '#22d3ee', borderColor: '#22d3ee', bgColor: '#0a192f' } },
  { id: 'ember-ring', name: 'Ember Ring', mode: 'glow', color: '#f97316',
    settings: { ...defaultGlow, glowColor: '#f97316', borderColor: '#f97316', glowIntensity: 70, innerGlow: 30 } },
  { id: 'toxic-haze', name: 'Toxic Haze', mode: 'glow', color: '#4ade80',
    settings: { ...defaultGlow, glowColor: '#4ade80', borderColor: '#4ade80', bgColor: '#0d1117', glowBlur: 80 } },
];

export function useCssGenerator() {
  const [mode, setMode] = useState<EffectMode>('liquid-glass');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [darkText, setDarkText] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('preview');

  const [liquidGlass, setLiquidGlass] = useState<LiquidGlassSettings>(defaultLiquidGlass);
  const [glassmorphism, setGlassmorphism] = useState<GlassmorphismSettings>(defaultGlassmorphism);
  const [neumorphism, setNeumorphism] = useState<NeumorphismSettings>(defaultNeumorphism);
  const [glow, setGlow] = useState<GlowSettings>(defaultGlow);

  const currentSettings = mode === 'liquid-glass' ? liquidGlass
    : mode === 'glassmorphism' ? glassmorphism
    : mode === 'neumorphism' ? neumorphism
    : glow;

  const updateSetting = useCallback((key: string, value: number | string) => {
    if (mode === 'liquid-glass') setLiquidGlass(s => ({ ...s, [key]: value }));
    else if (mode === 'glassmorphism') setGlassmorphism(s => ({ ...s, [key]: value }));
    else if (mode === 'neumorphism') setNeumorphism(s => ({ ...s, [key]: value }));
    else setGlow(s => ({ ...s, [key]: value }));
  }, [mode]);

  const generatedCSS = useMemo<GeneratedCSS>(() => {
    if (mode === 'liquid-glass') return generateLiquidGlassCSS(liquidGlass);
    if (mode === 'glassmorphism') return generateGlassmorphismCSS(glassmorphism);
    if (mode === 'neumorphism') return generateNeumorphismCSS(neumorphism);
    return generateGlowCSS(glow);
  }, [mode, liquidGlass, glassmorphism, neumorphism, glow]);

  const previewStyle = useMemo<React.CSSProperties>(() => {
    const props = generatedCSS.properties;
    const style: Record<string, string> = {};
    for (const [key, val] of Object.entries(props)) {
      if (!val) continue;
      const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      style[camel] = val;
    }
    // handle special neumorphism gradient
    if (mode === 'neumorphism' && (neumorphism.shape === 'concave' || neumorphism.shape === 'convex')) {
      const css = generatedCSS.css;
      const bgMatch = css.match(/background:\s*(linear-gradient[^;]+);/);
      if (bgMatch) style.background = bgMatch[1];
    }
    return style as React.CSSProperties;
  }, [generatedCSS, mode, neumorphism]);

  const applyPreset = useCallback((preset: Preset) => {
    setMode(preset.mode);
    if (preset.mode === 'liquid-glass') setLiquidGlass(preset.settings as LiquidGlassSettings);
    else if (preset.mode === 'glassmorphism') setGlassmorphism(preset.settings as GlassmorphismSettings);
    else if (preset.mode === 'neumorphism') setNeumorphism(preset.settings as NeumorphismSettings);
    else setGlow(preset.settings as GlowSettings);
  }, []);

  const reset = useCallback(() => {
    if (mode === 'liquid-glass') setLiquidGlass(defaultLiquidGlass);
    else if (mode === 'glassmorphism') setGlassmorphism(defaultGlassmorphism);
    else if (mode === 'neumorphism') setNeumorphism(defaultNeumorphism);
    else setGlow(defaultGlow);
  }, [mode]);

  const applySettings = useCallback((settings: LiquidGlassSettings | GlassmorphismSettings | NeumorphismSettings | GlowSettings) => {
    if (mode === 'liquid-glass') setLiquidGlass(settings as LiquidGlassSettings);
    else if (mode === 'glassmorphism') setGlassmorphism(settings as GlassmorphismSettings);
    else if (mode === 'neumorphism') setNeumorphism(settings as NeumorphismSettings);
    else setGlow(settings as GlowSettings);
  }, [mode]);

  const randomize = useCallback(() => {
    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    if (mode === 'liquid-glass') {
      setLiquidGlass({
        blur: rand(5, 40), opacity: rand(50, 100), borderRadius: rand(4, 30),
        bgColor: randColor(), bgAlpha: rand(5, 25), borderColor: randColor(),
        borderAlpha: rand(10, 40), borderWidth: rand(1, 3), refractionIntensity: rand(10, 60),
        shadowX: rand(-5, 5), shadowY: rand(2, 15), shadowBlur: rand(10, 50),
        shadowSpread: rand(-5, 10), shadowColor: '#000000', shadowAlpha: rand(10, 40),
        saturation: rand(100, 180), brightness: rand(100, 130),
      });
    } else if (mode === 'glassmorphism') {
      setGlassmorphism({
        blur: rand(5, 35), opacity: rand(50, 100), borderRadius: rand(4, 24),
        bgColor: randColor(), bgAlpha: rand(5, 20), borderColor: randColor(),
        borderAlpha: rand(10, 35), borderWidth: rand(1, 2),
        shadowX: rand(-3, 3), shadowY: rand(2, 12), shadowBlur: rand(10, 40),
        shadowColor: '#000000', shadowAlpha: rand(10, 35), saturation: rand(80, 150),
      });
    } else if (mode === 'neumorphism') {
      setNeumorphism({
        borderRadius: rand(8, 30), bgColor: randColor(), distance: rand(3, 12),
        intensity: rand(10, 30), blur: rand(8, 20),
        shape: (['flat', 'concave', 'convex', 'pressed'] as const)[rand(0, 3)],
        lightColor: '#ffffff', darkColor: '#a3b1c6',
      });
    } else {
      setGlow({
        borderRadius: rand(8, 60), bgColor: randColor(), bgAlpha: rand(60, 95),
        glowColor: randColor(), glowIntensity: rand(30, 90), glowSpread: rand(10, 60),
        glowBlur: rand(20, 120), innerGlow: rand(0, 50),
        borderColor: randColor(), borderAlpha: rand(20, 60), borderWidth: rand(1, 3),
        blur: rand(0, 20), saturation: rand(100, 250), brightness: rand(100, 200),
      });
    }
  }, [mode]);

  return {
    mode, setMode,
    showAdvanced, setShowAdvanced,
    darkText, setDarkText,
    previewTab, setPreviewTab,
    currentSettings, updateSetting,
    generatedCSS, previewStyle,
    applyPreset, reset, randomize, applySettings,
    liquidGlass, glassmorphism, neumorphism, glow,
  };
}
