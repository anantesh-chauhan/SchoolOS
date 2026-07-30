export const DEFAULT_SCHOOL_PALETTE_ID = 'ocean';

const surfaces = (light, dark) => ({ light, dark });

export const SCHOOL_PALETTES = [
  {
    id: 'ocean',
    name: 'Calm Ocean',
    description: 'Restful teal and misty blue for long study and work sessions.',
    primary: '#13766f',
    primaryHover: '#0f625d',
    primarySoft: '#d8eeeb',
    primarySoftText: '#174f4b',
    secondary: '#315f73',
    accent: '#3b8294',
    gradientStart: '#176f6a',
    gradientEnd: '#376f88',
    focusRgb: '43 132 126',
    darkPrimary: '#6fc8bf',
    darkPrimaryHover: '#85d6ce',
    darkSoft: '#24433f',
    darkSoftText: '#bce8e2',
    darkSecondary: '#88b9ca',
    darkAccent: '#7fc4d3',
    ...surfaces(
      { canvas: '#e8f1f0', canvasAlt: '#edf4f3', card: '#f5f9f8', elevated: '#f9fbfa', sidebar: '#e1edeb', hover: '#d8e8e5', border: '#c8dbd8', text: '#203b3e', muted: '#617779' },
      { canvas: '#102124', canvasAlt: '#14272b', card: '#192e32', elevated: '#1e373b', sidebar: '#13282b', hover: '#244145', border: '#315055', text: '#e3efed', muted: '#9bb3b2' },
    ),
  },
  {
    id: 'royal',
    name: 'Quiet Indigo',
    description: 'Soft academic indigo with a cool lavender undertone.',
    primary: '#5b5fa7',
    primaryHover: '#4b4f90',
    primarySoft: '#e5e5f3',
    primarySoftText: '#454879',
    secondary: '#56657f',
    accent: '#7379b8',
    gradientStart: '#585d9d',
    gradientEnd: '#667b9d',
    focusRgb: '105 110 178',
    darkPrimary: '#aeb3ef',
    darkPrimaryHover: '#c0c4f4',
    darkSoft: '#343755',
    darkSoftText: '#dddffd',
    darkSecondary: '#a7b7d0',
    darkAccent: '#b5b9ee',
    ...surfaces(
      { canvas: '#ececf3', canvasAlt: '#f0f0f6', card: '#f7f7fa', elevated: '#fafafd', sidebar: '#e6e6f0', hover: '#dddded', border: '#d0d0df', text: '#303446', muted: '#6b6e82' },
      { canvas: '#181a27', canvasAlt: '#1d2030', card: '#242738', elevated: '#2a2e41', sidebar: '#1d2030', hover: '#30344a', border: '#3d4259', text: '#e9eaf3', muted: '#aaadbf' },
    ),
  },
  {
    id: 'forest',
    name: 'Study Sage',
    description: 'Muted sage and eucalyptus tones with a grounded classroom feel.',
    primary: '#497b61',
    primaryHover: '#3c6851',
    primarySoft: '#dcebe1',
    primarySoftText: '#365b47',
    secondary: '#536f67',
    accent: '#6b927d',
    gradientStart: '#47755d',
    gradientEnd: '#607d72',
    focusRgb: '84 137 107',
    darkPrimary: '#91c4a4',
    darkPrimaryHover: '#a5d1b4',
    darkSoft: '#294337',
    darkSoftText: '#cde9d6',
    darkSecondary: '#9abcb2',
    darkAccent: '#a3ceb3',
    ...surfaces(
      { canvas: '#ebf1ec', canvasAlt: '#eff4f0', card: '#f6f9f6', elevated: '#fafcf9', sidebar: '#e4ece6', hover: '#dbe7de', border: '#ccdacf', text: '#2b3d33', muted: '#68796f' },
      { canvas: '#15221b', canvasAlt: '#19281f', card: '#1f3027', elevated: '#25392e', sidebar: '#192a21', hover: '#2b4335', border: '#385442', text: '#e6eee9', muted: '#a3b7aa' },
    ),
  },
  {
    id: 'sunset',
    name: 'Warm Sand',
    description: 'Low-glare sand and clay accents for a warm, welcoming campus.',
    primary: '#9a684c',
    primaryHover: '#80563f',
    primarySoft: '#eee2d8',
    primarySoftText: '#704b37',
    secondary: '#74665c',
    accent: '#b07c5c',
    gradientStart: '#95654b',
    gradientEnd: '#7f7164',
    focusRgb: '166 112 82',
    darkPrimary: '#d3a283',
    darkPrimaryHover: '#dfb296',
    darkSoft: '#4b372d',
    darkSoftText: '#f1d7c6',
    darkSecondary: '#c2b3a8',
    darkAccent: '#d8a98b',
    ...surfaces(
      { canvas: '#f2ede7', canvasAlt: '#f5f0eb', card: '#faf7f3', elevated: '#fcfaf7', sidebar: '#ece5de', hover: '#e5dbd1', border: '#dacdc1', text: '#413934', muted: '#786d65' },
      { canvas: '#251d19', canvasAlt: '#2b221d', card: '#342923', elevated: '#3d3029', sidebar: '#2b211c', hover: '#46362e', border: '#59463b', text: '#f0e8e2', muted: '#baa9a0' },
    ),
  },
  {
    id: 'berry',
    name: 'Soft Lavender',
    description: 'Gentle lavender and mauve without bright or tiring saturation.',
    primary: '#80658f',
    primaryHover: '#6b5578',
    primarySoft: '#ebe2ee',
    primarySoftText: '#5d4968',
    secondary: '#6c647b',
    accent: '#967ba2',
    gradientStart: '#7b6289',
    gradientEnd: '#6d718b',
    focusRgb: '137 108 151',
    darkPrimary: '#c9a9d3',
    darkPrimaryHover: '#d8bce0',
    darkSoft: '#45364b',
    darkSoftText: '#eedbf2',
    darkSecondary: '#bbb0c9',
    darkAccent: '#d2b4db',
    ...surfaces(
      { canvas: '#f0ebf1', canvasAlt: '#f3eef4', card: '#f9f6f9', elevated: '#fcf9fc', sidebar: '#eae3ec', hover: '#e3d9e6', border: '#d7cbd9', text: '#403744', muted: '#766a79' },
      { canvas: '#211a24', canvasAlt: '#271f2a', card: '#302634', elevated: '#392d3e', sidebar: '#281f2b', hover: '#423448', border: '#55435b', text: '#eee7f0', muted: '#b7a8ba' },
    ),
  },
];

export const DEFAULT_SCHOOL_PALETTE =
  SCHOOL_PALETTES.find((palette) => palette.id === DEFAULT_SCHOOL_PALETTE_ID);

const normalizeHex = (value) => String(value || '').trim().toLowerCase();

export function getSchoolPalette(id) {
  return SCHOOL_PALETTES.find((palette) => palette.id === id) || DEFAULT_SCHOOL_PALETTE;
}

export function findSchoolPalette(primaryColor, secondaryColor) {
  const primary = normalizeHex(primaryColor);
  const secondary = normalizeHex(secondaryColor);
  return SCHOOL_PALETTES.find((palette) => (
    normalizeHex(palette.primary) === primary
    && normalizeHex(palette.secondary) === secondary
  )) || {
    ...DEFAULT_SCHOOL_PALETTE,
    id: 'custom',
    name: 'Custom',
    primary: primaryColor || DEFAULT_SCHOOL_PALETTE.primary,
    secondary: secondaryColor || DEFAULT_SCHOOL_PALETTE.secondary,
  };
}

export function applySchoolPalette(palette) {
  const resolved = palette || DEFAULT_SCHOOL_PALETTE;
  const root = document.documentElement;
  const properties = {
    '--palette-primary': resolved.primary,
    '--palette-primary-hover': resolved.primaryHover,
    '--palette-primary-soft': resolved.primarySoft,
    '--palette-primary-soft-text': resolved.primarySoftText,
    '--palette-secondary': resolved.secondary,
    '--palette-accent': resolved.accent,
    '--palette-focus-rgb': resolved.focusRgb,
    '--palette-gradient-start': resolved.gradientStart,
    '--palette-gradient-end': resolved.gradientEnd,
    '--palette-dark-primary': resolved.darkPrimary,
    '--palette-dark-primary-hover': resolved.darkPrimaryHover,
    '--palette-dark-soft': resolved.darkSoft,
    '--palette-dark-soft-text': resolved.darkSoftText,
    '--palette-dark-secondary': resolved.darkSecondary,
    '--palette-dark-accent': resolved.darkAccent,
    '--palette-canvas': resolved.light.canvas,
    '--palette-canvas-alt': resolved.light.canvasAlt,
    '--palette-card': resolved.light.card,
    '--palette-elevated': resolved.light.elevated,
    '--palette-sidebar': resolved.light.sidebar,
    '--palette-hover': resolved.light.hover,
    '--palette-border': resolved.light.border,
    '--palette-text': resolved.light.text,
    '--palette-muted': resolved.light.muted,
    '--palette-dark-canvas': resolved.dark.canvas,
    '--palette-dark-canvas-alt': resolved.dark.canvasAlt,
    '--palette-dark-card': resolved.dark.card,
    '--palette-dark-elevated': resolved.dark.elevated,
    '--palette-dark-sidebar': resolved.dark.sidebar,
    '--palette-dark-hover': resolved.dark.hover,
    '--palette-dark-border': resolved.dark.border,
    '--palette-dark-text': resolved.dark.text,
    '--palette-dark-muted': resolved.dark.muted,
  };

  Object.entries(properties).forEach(([property, value]) => {
    if (value) root.style.setProperty(property, value);
  });
  root.dataset.schoolPalette = resolved.id;
}
