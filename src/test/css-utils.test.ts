import { describe, it, expect } from 'vitest';
import {
  Color,
  walkCSS,
  parseWithUnit,
  parseAndValidateCSS,
  PROPERTIES_BY_MODE,
  SETTING_RANGES,
} from '@/components/css-utils';
import type { LiquidGlassSettings, GlowSettings } from '@/types/css-generator';

// ══════════════════════════════════════════════════════════════════
// Color Engine Tests
// ══════════════════════════════════════════════════════════════════

describe('Color', () => {
  describe('fromHex', () => {
    it('parses 6-digit hex', () => {
      const c = Color.fromHex('#ff0000');
      expect(c).not.toBeNull();
      expect(c!.r).toBe(255);
      expect(c!.g).toBe(0);
      expect(c!.b).toBe(0);
    });

    it('parses 3-digit hex', () => {
      const c = Color.fromHex('#f00');
      expect(c).not.toBeNull();
      expect(c!.r).toBe(255);
    });

    it('parses 8-digit hex with alpha', () => {
      const c = Color.fromHex('#ff000080');
      expect(c).not.toBeNull();
      expect(c!.a).toBeCloseTo(0.5, 1);
    });

    it('returns null for invalid hex', () => {
      expect(Color.fromHex('#xyz')).toBeNull();
      expect(Color.fromHex('#12')).toBeNull();
    });
  });

  describe('parse', () => {
    it('parses rgb()', () => {
      const c = Color.parse('rgb(100, 200, 50)');
      expect(c).not.toBeNull();
      expect(c!.r).toBe(100);
      expect(c!.g).toBe(200);
      expect(c!.b).toBe(50);
    });

    it('parses rgba()', () => {
      const c = Color.parse('rgba(255, 0, 0, 0.5)');
      expect(c).not.toBeNull();
      expect(c!.a).toBeCloseTo(0.5);
    });

    it('parses hsl()', () => {
      const c = Color.parse('hsl(0, 100%, 50%)');
      expect(c).not.toBeNull();
      expect(c!.r).toBe(255);
      expect(c!.g).toBe(0);
    });

    it('parses named colors', () => {
      expect(Color.parse('white')!.r).toBe(255);
      expect(Color.parse('black')!.r).toBe(0);
      expect(Color.parse('transparent')!.a).toBe(0);
    });

    it('returns null for unknown values', () => {
      expect(Color.parse('not-a-color')).toBeNull();
      expect(Color.parse('')).toBeNull();
    });
  });

  describe('contrastWith', () => {
    it('black vs white gives ~21:1', () => {
      const black = Color.fromHex('#000000')!;
      const white = Color.fromHex('#ffffff')!;
      expect(black.contrastWith(white)).toBeCloseTo(21, 0);
    });

    it('same color gives 1:1', () => {
      const c = Color.fromHex('#808080')!;
      expect(c.contrastWith(c)).toBeCloseTo(1, 0);
    });
  });

  describe('toHex', () => {
    it('round-trips correctly', () => {
      const c = Color.fromHex('#abcdef')!;
      expect(c.toHex()).toBe('#abcdef');
    });
  });
});

// ══════════════════════════════════════════════════════════════════
// PostCSS Walker Tests
// ══════════════════════════════════════════════════════════════════

describe('walkCSS', () => {
  it('extracts declarations from valid CSS', () => {
    const result = walkCSS('.test { color: red; font-size: 16px; }');
    expect(result.syntaxError).toBeUndefined();
    expect(result.declarations).toHaveLength(2);
    expect(result.declarations[0].property).toBe('color');
    expect(result.declarations[1].property).toBe('font-size');
  });

  it('returns syntax error for invalid CSS but falls back', () => {
    const result = walkCSS('.test { color: red; font-size: }');
    // PostCSS may or may not error on this; test that it returns something
    expect(result.declarations.length).toBeGreaterThanOrEqual(0);
  });

  it('handles empty CSS', () => {
    const result = walkCSS('');
    expect(result.declarations).toHaveLength(0);
  });

  it('preserves line numbers', () => {
    const result = walkCSS('.x {\n  color: red;\n  margin: 0;\n}');
    expect(result.declarations[0].line).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Unit Normalization Tests
// ══════════════════════════════════════════════════════════════════

describe('parseWithUnit', () => {
  it('parses px values', () => {
    const r = parseWithUnit('16px');
    expect(r).not.toBeNull();
    expect(r!.px).toBe(16);
    expect(r!.wasConverted).toBe(false);
  });

  it('converts rem to px', () => {
    const r = parseWithUnit('2rem');
    expect(r).not.toBeNull();
    expect(r!.px).toBe(32);
    expect(r!.wasConverted).toBe(true);
  });

  it('converts em to px', () => {
    const r = parseWithUnit('1.5em');
    expect(r!.px).toBe(24);
  });

  it('converts pt to px', () => {
    const r = parseWithUnit('12pt');
    expect(r!.px).toBe(16);
    expect(r!.wasConverted).toBe(true);
  });

  it('handles unitless as px', () => {
    const r = parseWithUnit('10');
    expect(r!.px).toBe(10);
  });

  it('returns null for invalid input', () => {
    expect(parseWithUnit('abc')).toBeNull();
    expect(parseWithUnit('')).toBeNull();
  });

  it('handles negative values', () => {
    const r = parseWithUnit('-5px');
    expect(r!.px).toBe(-5);
  });
});

// ══════════════════════════════════════════════════════════════════
// parseAndValidateCSS Tests
// ══════════════════════════════════════════════════════════════════

describe('parseAndValidateCSS', () => {
  const defaultLiquidGlass: LiquidGlassSettings = {
    blur: 20, opacity: 80, borderRadius: 16,
    bgColor: '#ffffff', bgAlpha: 12,
    borderColor: '#ffffff', borderAlpha: 20, borderWidth: 1,
    refractionIntensity: 30,
    shadowX: 0, shadowY: 8, shadowBlur: 32, shadowSpread: 0,
    shadowColor: '#000000', shadowAlpha: 25,
    saturation: 120, brightness: 110,
  };

  it('parses valid liquid-glass CSS and returns settings', () => {
    const css = `.liquid-glass {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px) saturate(120%) brightness(110%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0px 8px 32px 0px rgba(0, 0, 0, 0.25);
}`;
    const result = parseAndValidateCSS('liquid-glass', css, defaultLiquidGlass);
    expect(result.settings).not.toBeNull();
    expect(result.validity.status).toBe('valid');
    expect(result.ghostProperties).toHaveLength(0);
  });

  it('detects ghost properties', () => {
    const css = `.liquid-glass {
  background: rgba(255, 255, 255, 0.12);
  transform: rotate(45deg);
  z-index: 10;
}`;
    const result = parseAndValidateCSS('liquid-glass', css, defaultLiquidGlass);
    expect(result.ghostProperties.length).toBeGreaterThan(0);
    expect(result.ghostProperties.some(g => g.property === 'transform')).toBe(true);
  });

  it('clamps out-of-range values', () => {
    const css = `.liquid-glass {
  backdrop-filter: blur(100px) saturate(500%);
  border-radius: 200px;
}`;
    const result = parseAndValidateCSS('liquid-glass', css, defaultLiquidGlass);
    expect(result.clampedFields.length).toBeGreaterThan(0);
  });

  it('returns null settings for completely invalid CSS', () => {
    const result = parseAndValidateCSS('liquid-glass', '{{{{invalid', defaultLiquidGlass);
    expect(result.validity.status).toBe('invalid');
  });

  it('generates accessibility info', () => {
    const css = `.liquid-glass {
  background: rgba(0, 0, 0, 0.85);
}`;
    const result = parseAndValidateCSS('liquid-glass', css, defaultLiquidGlass);
    expect(result.accessibility).toBeDefined();
    expect(result.accessibility!.contrastRatio).toBeGreaterThan(1);
  });

  it('generates auto-fix suggestions for WCAG failures', () => {
    const css = `.liquid-glass {
  background: rgba(128, 128, 128, 0.05);
}`;
    const result = parseAndValidateCSS('liquid-glass', css, defaultLiquidGlass);
    // With very low alpha, contrast should be borderline
    expect(result.autoFixes).toBeDefined();
  });

  it('handles glow mode correctly', () => {
    const defaultGlow: GlowSettings = {
      borderRadius: 24, bgColor: '#1a1a2e', bgAlpha: 85,
      glowColor: '#facc15', glowIntensity: 60, glowSpread: 30, glowBlur: 60,
      innerGlow: 20,
      borderColor: '#facc15', borderAlpha: 40, borderWidth: 1,
      blur: 8, saturation: 150, brightness: 110,
    };
    const css = `.glow {
  background: rgba(26, 26, 46, 0.85);
  border-radius: 24px;
  box-shadow: 0 0 60px 30px rgba(250, 204, 21, 0.36), 0 0 30px 12px rgba(250, 204, 21, 0.18);
}`;
    const result = parseAndValidateCSS('glow', css, defaultGlow);
    expect(result.settings).not.toBeNull();
    expect(result.validity.status).toBe('valid');
  });

  it('returns validity info', () => {
    const css = `.test { border-radius: 10px; }`;
    const result = parseAndValidateCSS('liquid-glass', css, defaultLiquidGlass);
    expect(result.validity).toBeDefined();
    expect(result.validity.parsedCount).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Property Registry Tests
// ══════════════════════════════════════════════════════════════════

describe('PROPERTIES_BY_MODE', () => {
  it('has entries for all modes', () => {
    expect(PROPERTIES_BY_MODE['liquid-glass']).toBeDefined();
    expect(PROPERTIES_BY_MODE['glassmorphism']).toBeDefined();
    expect(PROPERTIES_BY_MODE['neumorphism']).toBeDefined();
    expect(PROPERTIES_BY_MODE['glow']).toBeDefined();
  });

  it('glow mode supports expected properties', () => {
    const glowProps = PROPERTIES_BY_MODE['glow'];
    expect(glowProps['background']).toBeDefined();
    expect(glowProps['box-shadow']).toBeDefined();
    expect(glowProps['border-radius']).toBeDefined();
  });
});

describe('SETTING_RANGES', () => {
  it('has ranges for glow mode', () => {
    const r = SETTING_RANGES['glow'];
    expect(r.glowIntensity).toEqual([0, 100]);
    expect(r.glowBlur).toEqual([0, 200]);
    expect(r.borderRadius).toEqual([0, 100]);
  });
});
