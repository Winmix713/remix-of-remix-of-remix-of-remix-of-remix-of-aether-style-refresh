/**
 * css-diff.ts — Normalized CSS declaration diffing
 *
 * Compares two CSS strings at the declaration level,
 * ignoring whitespace, comments, and formatting differences.
 * Produces semantic diffs usable by glow/change-highlighting.
 */

import { walkCSS, type CSSDeclaration } from '@/components/css-utils';
import type { DeclarationDiff, DiffKind } from '@/types/css-diagnostics';

/** Accessibility-related CSS properties */
const A11Y_PROPERTIES = new Set([
  'color', 'background', 'background-color', 'opacity',
  'font-size', 'line-height', 'letter-spacing',
]);

/** Visually impactful properties */
const VISUAL_PROPERTIES = new Set([
  'background', 'background-color', 'border', 'border-radius',
  'box-shadow', 'backdrop-filter', '-webkit-backdrop-filter',
  'opacity', 'color', 'transform',
]);

/**
 * Normalize a CSS value for comparison:
 * - collapse whitespace
 * - lowercase
 * - remove trailing semicolons
 * - normalize color formats would be ideal but costly; 
 *   we do basic normalization here
 */
function normalizeValue(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/;$/, '')
    // Normalize 0px → 0
    .replace(/\b0px\b/g, '0')
    // Normalize rgba(0, 0, 0, 0) → transparent
    .replace(/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/g, 'transparent');
}

/**
 * Convert declarations array to a normalized map for diffing
 */
function toNormalizedMap(declarations: CSSDeclaration[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of declarations) {
    map.set(decl.property, normalizeValue(decl.value));
  }
  return map;
}

/**
 * Diff two CSS strings at the declaration level.
 * Returns an array of declaration-level diffs.
 */
export function diffCSS(oldCSS: string, newCSS: string): DeclarationDiff[] {
  const oldResult = walkCSS(oldCSS);
  const newResult = walkCSS(newCSS);

  const oldMap = toNormalizedMap(oldResult.declarations);
  const newMap = toNormalizedMap(newResult.declarations);

  const allProperties = new Set([...oldMap.keys(), ...newMap.keys()]);
  const diffs: DeclarationDiff[] = [];

  for (const prop of allProperties) {
    const oldVal = oldMap.get(prop);
    const newVal = newMap.get(prop);

    let kind: DiffKind;
    if (oldVal === undefined) {
      kind = 'added';
    } else if (newVal === undefined) {
      kind = 'removed';
    } else if (oldVal === newVal) {
      kind = 'unchanged';
    } else {
      kind = 'changed';
    }

    if (kind === 'unchanged') continue;

    diffs.push({
      property: prop,
      kind,
      oldValue: oldVal,
      newValue: newVal,
      isVisual: VISUAL_PROPERTIES.has(prop),
      isAccessibility: A11Y_PROPERTIES.has(prop),
    });
  }

  return diffs;
}

/**
 * Check if two CSS strings are semantically equivalent
 * (same declarations, ignoring whitespace/comments/order)
 */
export function isSemanticallyEqual(css1: string, css2: string): boolean {
  return diffCSS(css1, css2).length === 0;
}

/**
 * Get a summary of changes for display purposes
 */
export function diffSummary(diffs: DeclarationDiff[]): {
  added: number;
  removed: number;
  changed: number;
  hasVisualChanges: boolean;
  hasA11yChanges: boolean;
} {
  return {
    added: diffs.filter((d) => d.kind === 'added').length,
    removed: diffs.filter((d) => d.kind === 'removed').length,
    changed: diffs.filter((d) => d.kind === 'changed').length,
    hasVisualChanges: diffs.some((d) => d.isVisual),
    hasA11yChanges: diffs.some((d) => d.isAccessibility),
  };
}
