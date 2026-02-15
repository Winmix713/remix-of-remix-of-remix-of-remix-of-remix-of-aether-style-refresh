/**
 * CSS Normalization Utilities
 * 
 * Handles shorthand vs non-shorthand property conflicts to prevent React warnings.
 */

import type { CSSProperties } from 'react';

/**
 * Pairs of shorthand and non-shorthand properties that can conflict
 */
const SHORTHAND_CONFLICTS: Array<[string, string]> = [
  ['background', 'backgroundColor'],
  ['backgroundColor', 'background'],
  ['border', 'borderWidth'],
  ['border', 'borderColor'],
  ['borderWidth', 'border'],
  ['borderColor', 'border'],
  ['margin', 'marginTop'],
  ['margin', 'marginRight'],
  ['margin', 'marginBottom'],
  ['margin', 'marginLeft'],
  ['padding', 'paddingTop'],
  ['padding', 'paddingRight'],
  ['padding', 'paddingBottom'],
  ['padding', 'paddingLeft'],
];

/**
 * Normalize CSS properties to avoid shorthand/non-shorthand conflicts
 * Prioritizes shorthand properties over non-shorthand ones
 */
export function normalizeStyleProperties(
  properties: Record<string, string | undefined>
): CSSProperties {
  const style: Record<string, string> = {};
  const processedKeys = new Set<string>();

  // First pass: add all properties
  for (const [key, val] of Object.entries(properties)) {
    if (!val) continue;
    style[key] = val;
    processedKeys.add(key);
  }

  // Second pass: remove non-shorthand properties if shorthand exists
  for (const [shorthand, nonShorthand] of SHORTHAND_CONFLICTS) {
    if (processedKeys.has(shorthand) && processedKeys.has(nonShorthand)) {
      // If both exist, keep shorthand and remove non-shorthand
      if (shorthand.length < nonShorthand.length) {
        delete style[nonShorthand];
        processedKeys.delete(nonShorthand);
      } else {
        // If shorthand is longer, remove it and keep non-shorthand
        delete style[shorthand];
        processedKeys.delete(shorthand);
      }
    }
  }

  return style as CSSProperties;
}

/**
 * Convert kebab-case CSS properties to camelCase and normalize
 */
export function convertAndNormalizeStyles(
  cssProperties: Record<string, string | undefined>
): CSSProperties {
  const camelCaseProps: Record<string, string | undefined> = {};

  for (const [key, val] of Object.entries(cssProperties)) {
    if (!val) continue;
    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    camelCaseProps[camelKey] = val;
  }

  return normalizeStyleProperties(camelCaseProps);
}

/**
 * Merge two style objects while avoiding shorthand conflicts
 */
export function mergeAndNormalizeStyles(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
): CSSProperties {
  const merged = {
    ...base,
    ...overrides,
  };

  return normalizeStyleProperties(merged);
}
