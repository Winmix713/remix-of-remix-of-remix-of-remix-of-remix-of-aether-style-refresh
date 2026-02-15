

# Advanced CSS Parser and Editor Integration

## Overview

Add two new files (`css-utils.ts` and `CSSCodeEditor.tsx`) that provide an AST-driven CSS parser, color engine, semantic validation, and a rich code editor with line-number gutter, diagnostics panel, ghost property detection, and WCAG accessibility analysis.

## What You Will Get

- A **CSS code editor** with line numbers and inline error/warning indicators
- **Paste any CSS** and the engine reverse-engineers it back into slider values
- **Smart diagnostics**: performance warnings (blur too high), design hints (opacity-blur imbalance), unit conversion notices (rem to px)
- **Ghost property panel**: shows which CSS properties are ignored by the current effect mode
- **Accessibility card**: WCAG contrast ratio with AA/AAA pass/fail badges and recommended text color
- **Apply button** that feeds parsed settings back into the sliders

## Changes

### 1. Move `postcss` from devDependencies to dependencies
The new `css-utils.ts` uses PostCSS at runtime to parse CSS into an AST. Currently it is only a dev dependency.

### 2. Create `src/components/css-utils.ts`
The uploaded 1,197-line utility module containing:
- `Color` class (hex/rgb/hsl/oklch parsing, WCAG contrast, neumorphism shadow generation)
- `walkCSS()` PostCSS AST walker with regex fallback
- `parseWithUnit()` unit normalization (rem/em/pt/cm/mm to px)
- Per-mode semantic validation rules
- `parseAndValidateCSS()` main entry point

**Glow mode gap**: The uploaded file does not include `glow` in `PROPERTIES_BY_MODE` or `SETTING_RANGES`. These will be added to avoid TypeScript errors, using the same property set as liquid-glass plus glow-specific properties.

### 3. Create `src/components/CSSCodeEditor.tsx`
The uploaded 732-line editor component containing:
- `LineEditor` -- textarea with scroll-synced line-number gutter and colored diagnostic dots
- `DiagnosticsPanel` -- collapsible error/warning/info list
- `GhostPanel` -- ignored properties and known-property reference
- `AccessibilityCard` -- contrast ratio bar with AA/AAA markers
- `CSSCodeEditor` -- main orchestrator

**Glow mode gap**: The `generateCSSForPreset` helper and `settingsToPreviewStyle` helper only handle three modes. Glow support will be added using the existing `generateGlowCSS`.

### 4. Integrate into PreviewPanel
Add a third "editor" tab (alongside "preview" and "code") that renders the `CSSCodeEditor`. This requires:
- Adding `onSettingsChange` callback prop to `PreviewPanel`
- Updating `PreviewPanelProps` and `PreviewTab` type to include `'editor'`
- Wiring `onSettingsChange` from `Index.tsx` through to the editor

### 5. Wire settings callback in Index.tsx
Pass a new `onSettingsChange` handler that calls the appropriate setter (`setLiquidGlass`, `setGlassmorphism`, etc.) based on the current mode. The `useCssGenerator` hook will need a new `applySettings` method exposed for this purpose.

## Technical Details

### File locations
- `src/components/css-utils.ts` (new)
- `src/components/CSSCodeEditor.tsx` (new)
- `src/components/PreviewPanel.tsx` (modified -- add editor tab)
- `src/hooks/use-css-generator.ts` (modified -- expose `applySettings`)
- `src/pages/Index.tsx` (modified -- pass `onSettingsChange`)
- `src/types/css-generator.ts` (modified -- add `'editor'` to `PreviewTab`)
- `package.json` (modified -- move postcss to dependencies)

### Glow mode additions in css-utils.ts
```text
PROPERTIES_BY_MODE['glow'] = {
  background, backdrop-filter, -webkit-backdrop-filter,
  border-radius, border, box-shadow, opacity
}

SETTING_RANGES['glow'] = {
  borderRadius: [0, 100], bgAlpha: [0, 100],
  glowIntensity: [0, 100], glowSpread: [0, 100],
  glowBlur: [0, 200], innerGlow: [0, 100],
  borderAlpha: [0, 100], borderWidth: [0, 5],
  blur: [0, 40], saturation: [50, 300], brightness: [50, 300]
}
```

### UI language
The uploaded components use Hungarian labels (e.g., "Diagnosztika", "Alkalmaz"). These will be kept as-is to match the author's intent.

