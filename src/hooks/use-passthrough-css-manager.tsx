/**
 * PASSTHROUGH CSS PROPERTIES - PRODUCTION IMPLEMENTATION
 * 
 * This extends the Enhanced Preset Manager to support custom CSS properties
 * that are not controlled by effect sliders (e.g., position, transform, color).
 */

import { useState, useCallback, useMemo } from 'react';
import type { EffectMode, PresetSettings } from '@/types/css-generator';

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extended preset with passthrough CSS support
 */
export interface PresetWithPassthrough {
  id: string;
  name: string;
  mode: EffectMode;
  color: string;
  
  // Effect settings (slider-controlled)
  baseSettings: PresetSettings;
  userOverrides?: Partial<PresetSettings>;
  
  // Passthrough CSS (not slider-controlled)
  passthroughCSS?: Record<string, string>;
  
  // Metadata
  customCSS?: string;
  isCustomized: boolean;
  lastModified?: number;
}

/**
 * CSS parsing diagnostic
 */
export interface CSSParsingDiagnostic {
  type: 'info' | 'warning' | 'error';
  property: string;
  value?: string;
  message: string;
  line?: number;
}

/**
 * Parsing result
 */
export interface CSSParsingResult {
  effectOverrides: Partial<PresetSettings>;
  passthroughProperties: Record<string, string>;
  diagnostics: CSSParsingDiagnostic[];
}

// ═══════════════════════════════════════════════════════════════════
// EFFECT PROPERTY DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * CSS properties that are controlled by effect sliders
 * These will be extracted and mapped to settings
 */
const EFFECT_CSS_PROPERTIES = new Set([
  'backdrop-filter',
  'background',
  'background-color',
  'border',
  'border-width',
  'border-color',
  'border-radius',
  'box-shadow',
  'opacity',
  'filter' // Only for some modes
]);

/**
 * Check if a CSS property is effect-controlled
 */
export function isEffectProperty(cssProperty: string): boolean {
  const normalized = cssProperty.toLowerCase().trim();
  return EFFECT_CSS_PROPERTIES.has(normalized);
}

// ═══════════════════════════════════════════════════════════════════
// CSS PARSING WITH PASSTHROUGH
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse CSS declarations from string
 */
function parseAllCSSDeclarations(css: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  
  try {
    // Remove comments
    let cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove class selectors and braces (keep only declarations)
    cleaned = cleaned.replace(/[^{}]*\{([^}]*)\}/g, '$1');
    
    // Extract declarations (property: value;)
    const lines = cleaned.split(';').filter(line => line.trim());
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const property = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      
      if (property && value) {
        declarations[property] = value;
      }
    }
  } catch (error) {
    console.error('CSS parsing error:', error);
  }
  
  return declarations;
}

/**
 * Extract effect setting value from CSS property
 * Returns null if cannot extract
 */
function extractEffectValue(
  property: string,
  value: string,
  mode: EffectMode
): { key: string; value: number | string } | null {
  try {
    switch (property) {
      case 'backdrop-filter': {
        // Extract blur(Npx)
        const blurMatch = value.match(/blur\((\d+(?:\.\d+)?)px\)/);
        if (blurMatch) {
          return { key: 'blur', value: parseFloat(blurMatch[1]) };
        }
        break;
      }
      
      case 'border-radius': {
        const match = value.match(/(\d+(?:\.\d+)?)(px|rem|em)/);
        if (match) {
          let pixels = parseFloat(match[1]);
          if (match[2] === 'rem') pixels *= 16;
          if (match[2] === 'em') pixels *= 16;
          return { key: 'borderRadius', value: Math.round(pixels) };
        }
        break;
      }
      
      case 'background':
      case 'background-color': {
        // Extract rgba() or hex
        const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch) {
          const [, r, g, b, a] = rgbaMatch;
          const hex = rgbToHex(+r, +g, +b);
          const result: any = { bgColor: `#${hex}` };
          if (a) result.bgAlpha = Math.round(parseFloat(a) * 100);
          return result;
        }
        break;
      }
      
      // Add more extractors as needed...
    }
  } catch (error) {
    console.error(`Failed to extract ${property}:`, error);
  }
  
  return null;
}

/**
 * Helper: RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b]
    .map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    })
    .join('');
}

/**
 * Main parser: separate effect properties from passthrough
 */
export function parseCustomCSSWithPassthrough(
  css: string,
  mode: EffectMode
): CSSParsingResult {
  const effectOverrides: Partial<any> = {};
  const passthroughProperties: Record<string, string> = {};
  const diagnostics: CSSParsingDiagnostic[] = [];
  
  try {
    const declarations = parseAllCSSDeclarations(css);
    
    for (const [property, value] of Object.entries(declarations)) {
      if (isEffectProperty(property)) {
        // Try to extract to effect setting
        const extracted = extractEffectValue(property, value, mode);
        
        if (extracted) {
          // Successfully extracted
          if (typeof extracted === 'object' && 'key' in extracted) {
            effectOverrides[extracted.key] = extracted.value;
          } else {
            Object.assign(effectOverrides, extracted);
          }
          
          diagnostics.push({
            type: 'info',
            property,
            value,
            message: `Mapped to effect setting`
          });
        } else {
          // Failed to extract → use as passthrough
          passthroughProperties[property] = value;
          diagnostics.push({
            type: 'warning',
            property,
            value,
            message: `Effect property but could not parse — using as custom CSS`
          });
        }
      } else {
        // Not an effect property → passthrough
        passthroughProperties[property] = value;
        diagnostics.push({
          type: 'info',
          property,
          value,
          message: `Applied as custom CSS (not controlled by sliders)`
        });
      }
    }
    
  } catch (error) {
    diagnostics.push({
      type: 'error',
      property: 'parser',
      message: `CSS parsing failed: ${(error as Error).message}`
    });
  }
  
  return {
    effectOverrides,
    passthroughProperties,
    diagnostics
  };
}

// ═══════════════════════════════════════════════════════════════════
// STYLE MERGING
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert CSS properties to React CSSProperties
 */
export function cssToReactStyle(cssProps: Record<string, string>): React.CSSProperties {
  const style: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(cssProps)) {
    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    style[camelKey] = value;
  }
  
  return style;
}

/**
 * Merge all layers into final style
 */
export function mergeAllLayers(
  preset: PresetWithPassthrough,
  generateCSSFn: (settings: PresetSettings, mode: EffectMode) => { properties: Record<string, string> }
): React.CSSProperties {
  // Step 1: Merge effect settings
  const effectSettings = {
    ...preset.baseSettings,
    ...preset.userOverrides
  };
  
  // Step 2: Generate effect CSS
  const generated = generateCSSFn(effectSettings, preset.mode);
  
  // Step 3: Convert to React style
  const effectStyle = cssToReactStyle(generated.properties);
  
  // Step 4: Add passthrough (passthrough overrides effect)
  const passthroughStyle = cssToReactStyle(preset.passthroughCSS || {});
  
  // Step 5: Merge
  return {
    ...effectStyle,
    ...passthroughStyle
  };
}

// ═══════════════════════════════════════════════════════════════════
// ENHANCED HOOK
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'enhanced-presets-passthrough-v1';

export function usePresetManagerWithPassthrough(
  generateCSSFn: (settings: PresetSettings, mode: EffectMode) => { properties: Record<string, string> }
) {
  const [presets, setPresets] = useState<PresetWithPassthrough[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const saveToStorage = useCallback((updated: PresetWithPassthrough[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save presets:', error);
    }
  }, []);
  
  /**
   * Apply custom CSS with passthrough separation
   */
  const applyCustomCSSWithPassthrough = useCallback((
    presetId: string,
    css: string
  ): CSSParsingDiagnostic[] => {
    let diagnostics: CSSParsingDiagnostic[] = [];
    
    setPresets(prev => {
      const updated = prev.map(preset => {
        if (preset.id !== presetId) return preset;
        
        // Parse and separate
        const result = parseCustomCSSWithPassthrough(css, preset.mode);
        diagnostics = result.diagnostics;
        
        return {
          ...preset,
          customCSS: css,
          userOverrides: {
            ...preset.userOverrides,
            ...result.effectOverrides
          },
          passthroughCSS: {
            ...preset.passthroughCSS,
            ...result.passthroughProperties
          },
          isCustomized: true,
          lastModified: Date.now()
        };
      });
      
      saveToStorage(updated);
      return updated;
    });
    
    return diagnostics;
  }, [saveToStorage]);
  
  /**
   * Remove passthrough property
   */
  const removePassthroughProperty = useCallback((
    presetId: string,
    propertyKey: string
  ) => {
    setPresets(prev => {
      const updated = prev.map(preset => {
        if (preset.id !== presetId) return preset;
        
        const newPassthrough = { ...preset.passthroughCSS };
        delete newPassthrough[propertyKey];
        
        return {
          ...preset,
          passthroughCSS: newPassthrough,
          lastModified: Date.now()
        };
      });
      
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);
  
  /**
   * Clear all passthrough properties
   */
  const clearAllPassthrough = useCallback((presetId: string) => {
    setPresets(prev => {
      const updated = prev.map(preset =>
        preset.id === presetId
          ? { ...preset, passthroughCSS: {}, lastModified: Date.now() }
          : preset
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);
  
  /**
   * Get final merged style
   */
  const getFinalStyle = useCallback((
    presetId: string
  ): React.CSSProperties => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return {};
    
    return mergeAllLayers(preset, generateCSSFn);
  }, [presets, generateCSSFn]);
  
  /**
   * Get passthrough count
   */
  const getPassthroughCount = useCallback((presetId: string): number => {
    const preset = presets.find(p => p.id === presetId);
    return Object.keys(preset?.passthroughCSS || {}).length;
  }, [presets]);
  
  return {
    presets,
    applyCustomCSSWithPassthrough,
    removePassthroughProperty,
    clearAllPassthrough,
    getFinalStyle,
    getPassthroughCount
  };
}

// ═══════════════════════════════════════════════════════════════════
// USAGE EXAMPLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Example: How to use in Admin.tsx
 */
export function ExampleUsageWithPassthrough() {
  // Your CSS generator function
  const generateCSS = (settings: PresetSettings, mode: EffectMode) => {
    // Use your existing generator
    // if (mode === 'glow') return generateGlowCSS(settings as any);
    // ... etc
    return { properties: {} };
  };
  
  const {
    presets,
    applyCustomCSSWithPassthrough,
    removePassthroughProperty,
    getFinalStyle,
    getPassthroughCount
  } = usePresetManagerWithPassthrough(generateCSS);
  
  const currentPreset = presets[0];
  
  if (!currentPreset) return null;
  
  const finalStyle = getFinalStyle(currentPreset.id);
  const passthroughCount = getPassthroughCount(currentPreset.id);
  
  return (
    <div>
      {/* Passthrough Properties */}
      {passthroughCount > 0 && (
        <div>
          <h3>Custom CSS Properties ({passthroughCount})</h3>
          {Object.entries(currentPreset.passthroughCSS || {}).map(([key, value]) => (
            <div key={key}>
              <code>{key}: {value}</code>
              <button onClick={() => removePassthroughProperty(currentPreset.id, key)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Preview */}
      <div style={finalStyle}>
        Preview with all CSS applied
      </div>
    </div>
  );
}
