/**
 * Application color themes.
 *
 * `serangkai` is the compiled default in `nuxt.config.ts`; additional themes are
 * CSS-only overrides selected by `data-serangkai-theme` on `<html>` (see
 * `app/assets/css/main.css`). Keep this module free of Vue and CSS imports so
 * tests and the settings UI can share the same list.
 */
export type ThemeId = 'serangkai' | 'rose-pine' | 'flexoki' | 'catppuccin'

export interface ThemePreview {
  surface: string
  primary: string
  accent: string
}

export interface ThemeDefinition {
  id: ThemeId
  label: string
  description: string
  preview: {
    light: ThemePreview
    dark: ThemePreview
  }
}

export const DEFAULT_THEME: ThemeId = 'serangkai'

export const themes: ThemeDefinition[] = [
  {
    id: 'serangkai',
    label: 'Serangkai',
    description: 'Jade lacquer and a scarlet signal on ivory porcelain. The default palette.',
    preview: {
      light: { surface: '#fdfbf6', primary: '#0b7a5e', accent: '#e0281e' },
      dark: { surface: '#151a18', primary: '#0b7a5e', accent: '#e0281e' },
    },
  },
  {
    id: 'rose-pine',
    label: 'Rosé Pine',
    description: 'Iris, rose, and pine on soft, low-contrast surfaces.',
    preview: {
      light: { surface: '#fffaf3', primary: '#907aa9', accent: '#ea9d34' },
      dark: { surface: '#1f1d2e', primary: '#c4a7e7', accent: '#f6c177' },
    },
  },
  {
    id: 'flexoki',
    label: 'Flexoki',
    description: 'Ink on paper. Steph Ango’s reading-first palette with warm neutrals.',
    preview: {
      light: { surface: '#fffcf0', primary: '#205ea6', accent: '#bc5215' },
      dark: { surface: '#1c1b1a', primary: '#4385be', accent: '#da702c' },
    },
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    description: 'Soothing pastels. Latte by day, Mocha by night.',
    preview: {
      light: { surface: '#eff1f5', primary: '#8839ef', accent: '#fe640b' },
      dark: { surface: '#1e1e2e', primary: '#cba6f7', accent: '#fab387' },
    },
  },
]

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themes.some(theme => theme.id === value)
}
