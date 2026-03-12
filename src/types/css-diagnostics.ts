/**
 * css-diagnostics.ts — Extended diagnostic types for the CSS editor system
 *
 * Separates diagnostic model from css-utils to keep concerns clean.
 * Re-exports base types from css-utils and adds auto-fix, categories, and diff types.
 */

import type { Severity } from '@/components/css-utils';
import type { EffectMode } from './css-generator';

// ── Auto-fix suggestion ─────────────────────────────────────────

export interface AutoFixSuggestion {
  /** Human-readable description of the fix */
  label: string;
  /** The CSS property affected */
  property: string;
  /** The current problematic value */
  currentValue: string;
  /** The suggested replacement value */
  suggestedValue: string;
  /** The settings key to update (for reverse-mapping) */
  settingsKey?: string;
  /** Numeric suggested value for slider update */
  settingsValue?: number | string;
  /** Severity of the issue this fixes */
  severity: Severity;
}

// ── Ghost property categories ───────────────────────────────────

export type GhostCategory =
  | 'mode-ignored'       // Property not supported by this effect mode
  | 'breakpoint-inactive' // Declaration inside an inactive media query
  | 'selector-mismatch'   // Selector doesn't match any rendered element
  | 'render-ineffective'; // Property exists but has no visual effect

export interface CategorizedGhostProperty {
  property: string;
  value: string;
  line?: number;
  column?: number;
  category: GhostCategory;
  reason: string;
}

// ── CSS validity state ──────────────────────────────────────────

export type CSSValidityStatus = 'valid' | 'partial' | 'invalid';

export interface CSSValidityInfo {
  status: CSSValidityStatus;
  /** Number of successfully parsed declarations */
  parsedCount: number;
  /** Number of declarations that failed to parse */
  failedCount: number;
  /** Human-readable summary */
  message: string;
}

// ── Change diff ─────────────────────────────────────────────────

export type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DeclarationDiff {
  property: string;
  kind: DiffKind;
  oldValue?: string;
  newValue?: string;
  /** Whether the change is purely visual (e.g., value change) vs. semantic */
  isVisual: boolean;
  /** Whether this change affects accessibility */
  isAccessibility: boolean;
}

// ── Enhanced parse result (extends base ParseResult) ────────────

export interface EnhancedParseResult {
  validity: CSSValidityInfo;
  autoFixes: AutoFixSuggestion[];
  categorizedGhosts: CategorizedGhostProperty[];
  diffs: DeclarationDiff[];
}

// ── Device preset for responsive analysis ───────────────────────

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  label: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'mobile',  width: 375,  height: 812,  label: 'Mobil (375px)' },
  { name: 'tablet',  width: 768,  height: 1024, label: 'Tablet (768px)' },
  { name: 'desktop', width: 1440, height: 900,  label: 'Desktop (1440px)' },
];
