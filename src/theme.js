export const light = {
  bgPage: '#F2F3F5',
  bgCard: '#FFFFFF',
  bgSidebar: '#F8F9FA',
  bgRow: '#F8F9FA',
  bgHover: '#EDEEF0',
  bgInput: '#F2F3F5',
  ink: '#1A1B1E',
  ink2: '#2C2D30',
  mid: '#52555C',
  muted: '#6D6F75', // WCAG AA (4.5:1) against bgCard and bgPage — the original #8A8D94 only cleared 3.3:1
  border: '#DDDFE3',
  border2: '#EDEEF0',
  brand: '#2563EB',
  brandL: '#EFF6FF',
  green: '#0F7B54',
  greenL: '#ECFDF5',
  amber: '#92400E',
  amberL: '#FFFBEB',
  red: '#B91C1C',
  redL: '#FEF2F2',
  purple: '#6D28D9',
  purpleL: '#F5F3FF',
  teal: '#0E7490',
  tealL: '#ECFEFF',
  pink: '#9D174D',
  pinkL: '#FDF2F8',
  orange: '#C2410C',
  orangeL: '#FFF7ED',
  gold: '#A16207',
  goldL: '#FEFCE8',
  accentBlue: '#3B82F6',
  accentGreen: '#10B981',
  accentAmber: '#F59E0B',
  accentRed: '#EF4444',
  accentPurple: '#8B5CF6',
  accentTeal: '#06B6D4',
  accentPink: '#EC4899',
  accentOrange: '#F97316',
  glassBg: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(0,0,0,0.06)',
  glassShadow: '0 1px 3px rgba(0,0,0,0.05)',
  sidebarGlassBg: 'rgba(248, 249, 250, 0.85)',
  sidebarGlassBorder: 'rgba(0,0,0,0.06)',
  topbarGlassBg: 'rgba(255, 255, 255, 0.8)',
  topbarGlassBorder: 'rgba(0,0,0,0.06)',
  pageGradient: 'linear-gradient(135deg, #F0F2F5 0%, #E8ECF0 100%)',
  rowBorder: 'rgba(0,0,0,0.06)',
  rowHover: 'rgba(0,0,0,0.025)',
  navHover: 'rgba(0,0,0,0.03)',
  secondaryBorder: 'rgba(0,0,0,0.12)',
};

export const dark = {
  bgPage: '#141517',
  bgCard: '#1C1D20',
  bgSidebar: '#18191C',
  bgRow: '#212225',
  bgHover: '#26272B',
  bgInput: '#212225',
  ink: '#E8E9EC',
  ink2: '#D0D2D8',
  mid: '#9EA1A8',
  muted: '#81858E', // WCAG AA (4.5:1) against bgCard and bgPage — the original #6B6E75 only cleared 3.3:1
  border: '#2E2F33',
  border2: '#26272B',
  brand: '#3B82F6',
  brandL: '#1E3A5F',
  green: '#10B981',
  greenL: '#052E16',
  amber: '#F59E0B',
  amberL: '#2D1B00',
  red: '#F15757', // WCAG AA (4.5:1) against bgRow — the original #EF4444 only cleared 4.23:1
  redL: '#2D0A0A',
  purple: '#9C74F7', // WCAG AA (4.5:1) against bgRow — the original #8B5CF6 only cleared 3.76:1
  purpleL: '#1E0A3C',
  teal: '#22D3EE',
  tealL: '#0A1F2D',
  pink: '#EC4899',
  pinkL: '#2D0A1A',
  orange: '#F97316',
  orangeL: '#2D1200',
  gold: '#EAB308',
  goldL: '#3F2E00',
  accentBlue: '#3B82F6',
  accentGreen: '#10B981',
  accentAmber: '#F59E0B',
  accentRed: '#EF4444',
  accentPurple: '#8B5CF6',
  accentTeal: '#22D3EE',
  accentPink: '#EC4899',
  accentOrange: '#F97316',
  glassBg: 'rgba(28, 29, 32, 0.85)',
  glassBorder: 'rgba(255,255,255,0.05)',
  glassShadow: '0 1px 3px rgba(0,0,0,0.2)',
  sidebarGlassBg: 'rgba(18, 19, 24, 0.9)',
  sidebarGlassBorder: 'rgba(255,255,255,0.05)',
  topbarGlassBg: 'rgba(18, 19, 24, 0.85)',
  topbarGlassBorder: 'rgba(255,255,255,0.05)',
  pageGradient: 'linear-gradient(135deg, #0F1117 0%, #131720 100%)',
  rowBorder: 'rgba(255,255,255,0.04)',
  rowHover: 'rgba(255,255,255,0.04)',
  navHover: 'rgba(255,255,255,0.04)',
  secondaryBorder: 'rgba(255,255,255,0.14)',
};

export function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Mix `hex` toward `target` by `amount` (0 = hex, 1 = target). Used to derive
// a light/dark tint of a brand color for its "L" (soft background) variant.
function mix(hex, target, amount) {
  const a = hexToRgb(hex), b = hexToRgb(target);
  return rgbToHex(a.r + (b.r - a.r) * amount, a.g + (b.g - a.g) * amount, a.b + (b.b - a.b) * amount);
}

export const BRAND_PRESETS = [
  { name: 'Ocean', hex: '#2563EB' },
  { name: 'Forest', hex: '#0F7B54' },
  { name: 'Slate', hex: '#3B4F6B' },
  { name: 'Plum', hex: '#6D28D9' },
  { name: 'Crimson', hex: '#9B1C1C' },
  { name: 'Midnight', hex: '#1E3A5C' },
];

export const DEFAULT_BRAND = '#2563EB';

// Applies a chosen brand color on top of the base light/dark palette. Every
// other token (backgrounds, ink, semantic colors) stays exactly as defined
// above — only `brand`/`brandL` are swapped, so the change cascades to every
// place in the app that already reads t.brand / t.brandL rather than needing
// per-component changes.
export function getTheme(mode, brandHex) {
  const base = mode === 'dark' ? dark : light;
  const hex = /^#[0-9A-Fa-f]{6}$/.test(brandHex || '') ? brandHex : DEFAULT_BRAND;
  if (mode === 'dark') {
    // 0.25 (not 0.2) so the default brand color clears WCAG AA (4.5:1) text
    // contrast against bgRow, the darkest background it's regularly read on.
    return { ...base, brand: mix(hex, '#FFFFFF', 0.25), brandL: mix(hex, '#000000', 0.78) };
  }
  return { ...base, brand: hex, brandL: mix(hex, '#FFFFFF', 0.88) };
}
