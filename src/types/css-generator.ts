export type EffectMode = 'liquid-glass' | 'glassmorphism' | 'neumorphism' | 'glow';
export type NeuShape = 'flat' | 'concave' | 'convex' | 'pressed';
export type PreviewTab = 'preview' | 'code' | 'editor';

export interface LiquidGlassSettings {
  blur: number;
  opacity: number;
  borderRadius: number;
  bgColor: string;
  bgAlpha: number;
  borderColor: string;
  borderAlpha: number;
  borderWidth: number;
  refractionIntensity: number;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowColor: string;
  shadowAlpha: number;
  saturation: number;
  brightness: number;
}

export interface GlassmorphismSettings {
  blur: number;
  opacity: number;
  borderRadius: number;
  bgColor: string;
  bgAlpha: number;
  borderColor: string;
  borderAlpha: number;
  borderWidth: number;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  shadowAlpha: number;
  saturation: number;
}

export interface NeumorphismSettings {
  borderRadius: number;
  bgColor: string;
  distance: number;
  intensity: number;
  blur: number;
  shape: NeuShape;
  lightColor: string;
  darkColor: string;
}

export interface GlowSettings {
  borderRadius: number;
  bgColor: string;
  bgAlpha: number;
  glowColor: string;
  glowIntensity: number;
  glowSpread: number;
  glowBlur: number;
  innerGlow: number;
  borderColor: string;
  borderAlpha: number;
  borderWidth: number;
  blur: number;
  saturation: number;
  brightness: number;
}

export type PresetSettings =
  | LiquidGlassSettings
  | GlassmorphismSettings
  | NeumorphismSettings
  | GlowSettings;

export interface Preset {
  id: string;
  name: string;
  mode: EffectMode;
  color: string;
  settings: PresetSettings;
}

/** Enhanced preset with base/override/customCSS layers */
export interface EnhancedPreset {
  id: string;
  name: string;
  mode: EffectMode;
  color: string;
  baseSettings: PresetSettings;
  userOverrides?: Partial<PresetSettings>;
  customCSS?: string;
  isCustomized: boolean;
  lastModified?: number;
}

export interface GeneratedCSS {
  css: string;
  properties: Record<string, string>;
}
