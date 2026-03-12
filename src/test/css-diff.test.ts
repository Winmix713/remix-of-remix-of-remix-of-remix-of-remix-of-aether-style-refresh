import { describe, it, expect } from 'vitest';
import { diffCSS, isSemanticallyEqual, diffSummary } from '@/utils/css-diff';

describe('diffCSS', () => {
  it('detects no changes for identical CSS', () => {
    const css = '.test { color: red; margin: 0; }';
    const diffs = diffCSS(css, css);
    expect(diffs).toHaveLength(0);
  });

  it('detects added property', () => {
    const old = '.test { color: red; }';
    const next = '.test { color: red; margin: 10px; }';
    const diffs = diffCSS(old, next);
    expect(diffs.some(d => d.property === 'margin' && d.kind === 'added')).toBe(true);
  });

  it('detects removed property', () => {
    const old = '.test { color: red; margin: 10px; }';
    const next = '.test { color: red; }';
    const diffs = diffCSS(old, next);
    expect(diffs.some(d => d.property === 'margin' && d.kind === 'removed')).toBe(true);
  });

  it('detects changed property', () => {
    const old = '.test { color: red; }';
    const next = '.test { color: blue; }';
    const diffs = diffCSS(old, next);
    expect(diffs.some(d => d.property === 'color' && d.kind === 'changed')).toBe(true);
  });

  it('ignores whitespace differences', () => {
    const old = '.test { color:   red ; }';
    const next = '.test { color: red; }';
    const diffs = diffCSS(old, next);
    expect(diffs).toHaveLength(0);
  });

  it('marks accessibility-related properties', () => {
    const old = '.test { background: red; }';
    const next = '.test { background: blue; }';
    const diffs = diffCSS(old, next);
    expect(diffs[0].isAccessibility).toBe(true);
  });
});

describe('isSemanticallyEqual', () => {
  it('returns true for equivalent CSS', () => {
    expect(isSemanticallyEqual(
      '.a { color: red; }',
      '.a {  color:  red ; }',
    )).toBe(true);
  });

  it('returns false for different CSS', () => {
    expect(isSemanticallyEqual(
      '.a { color: red; }',
      '.a { color: blue; }',
    )).toBe(false);
  });
});

describe('diffSummary', () => {
  it('summarizes diffs correctly', () => {
    const diffs = diffCSS(
      '.t { color: red; margin: 0; }',
      '.t { color: blue; padding: 5px; }',
    );
    const s = diffSummary(diffs);
    expect(s.changed).toBeGreaterThanOrEqual(1);
    expect(s.added).toBeGreaterThanOrEqual(1);
    expect(s.removed).toBeGreaterThanOrEqual(1);
  });
});
