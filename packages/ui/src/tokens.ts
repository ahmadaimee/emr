/**
 * Typed access to the Grove tokens, for charts and any code that must pick a colour
 * programmatically. Values mirror tokens.css; the CSS is the source of truth for the
 * DOM, this file is the source of truth for canvases and SVG.
 */
export const grove = {
  light: {
    surface: '#faf9f7',
    surfaceRaised: '#ffffff',
    line: '#e6e2db',
    ink: '#1c1b18',
    ink2: '#4a4741',
    ink3: '#7a766e',
    grove: '#2f6b4f',
    groveStrong: '#1f4d3d',
    clay: '#b4562f',
    warn: '#9a6a12',
    danger: '#a3392c',
    info: '#4f5f6b',
    ok: '#2f6b4f',
  },
  dark: {
    surface: '#171614',
    surfaceRaised: '#1f1e1b',
    line: '#2c2a26',
    ink: '#ece9e3',
    ink2: '#bdb8af',
    ink3: '#8d887f',
    grove: '#5f9f7f',
    groveStrong: '#96c8ad',
    clay: '#d47a52',
    warn: '#d9a63f',
    danger: '#d86f5f',
    info: '#9aabb7',
    ok: '#7ab596',
  },
} as const;

/**
 * Categorical series palette for charts — ordered so adjacent series are
 * distinguishable and none reads as a semantic (danger/warn) colour.
 */
export const chartSeries = {
  light: ['#2f6b4f', '#4f5f6b', '#b4562f', '#7fa88f', '#8a7f6b', '#9aabb7'],
  dark: ['#7ab596', '#9aabb7', '#d47a52', '#3f7a5d', '#bdb8af', '#625e57'],
} as const;

/** Format integer cents for display. Money is ink; only variance gets a colour. */
export function formatCents(cents: number, opts: { showSign?: boolean } = {}): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rem = String(abs % 100).padStart(2, '0');
  const sign = cents < 0 ? '−' : opts.showSign && cents > 0 ? '+' : '';
  return `${sign}$${dollars}.${rem}`;
}
