/**
 * Selaras design tokens for sandboxed HTML artifacts.
 *
 * Single source of truth for two consumers:
 *  - the MCP authoring surface (capabilities, HTML guide, and the
 *    `serangkai://tokens/selaras` resource), so an agent can theme-match without
 *    knowing which theme the viewer has active;
 *  - `scripts/build-artifact-runtime.ts`, which emits the opt-in document theme
 *    CSS from the same values.
 *
 * The contract for authors is `var(--selaras-resolved-<token>)`. The generated
 * stylesheet defines the semantic `--selaras-<token>` per active theme and mode
 * (via `light-dark()` plus a `data-serangkai-theme` override) and a uniform
 * `--selaras-resolved-<token>` wrapper, mirroring Selaras' own architecture.
 * Keep this module free of Vue/CSS imports so tests and the server share it.
 */

export type ArtifactThemeId = 'serangkai' | 'rose-pine'

export interface SelarasToken {
  /** Semantic token name, e.g. `surface-elevated`. */
  name: string
  /** The CSS an author should write. */
  css: string
  purpose: string
}

export interface SelarasTokenGroup {
  group: string
  title: string
  tokens: SelarasToken[]
}

const COLOR_SUFFIXES = ['fill', 'fill-hover', 'on-fill', 'text', 'text-hover', 'subtle', 'on-subtle', 'border'] as const

function colorTokens(family: 'primary' | 'accent' | 'secondary', label: string): SelarasToken[] {
  const purposes: Record<string, string> = {
    'fill': `solid ${label} background (buttons, badges)`,
    'fill-hover': `${label} background on hover`,
    'on-fill': `text/icon sitting on a solid ${label} fill`,
    'text': `${label} used as text or a link`,
    'text-hover': `${label} text on hover`,
    'subtle': `tinted ${label} background (callouts, chips)`,
    'on-subtle': `text sitting on a subtle ${label} background`,
    'border': `${label} border or outline`,
  }
  return COLOR_SUFFIXES.map(suffix => ({
    name: `color-${family}-${suffix}`,
    css: `var(--selaras-resolved-color-${family}-${suffix})`,
    purpose: purposes[suffix],
  }))
}

export const SELARAS_TOKEN_GROUPS: SelarasTokenGroup[] = [
  {
    group: 'surface',
    title: 'Surfaces',
    tokens: [
      { name: 'surface-canvas', css: 'var(--selaras-resolved-surface-canvas)', purpose: 'page background' },
      { name: 'surface-default', css: 'var(--selaras-resolved-surface-default)', purpose: 'card / panel background' },
      { name: 'surface-elevated', css: 'var(--selaras-resolved-surface-elevated)', purpose: 'raised surface (code, table head)' },
      { name: 'surface-inverted', css: 'var(--selaras-resolved-surface-inverted)', purpose: 'high-contrast inverted surface' },
    ],
  },
  {
    group: 'text',
    title: 'Text',
    tokens: [
      { name: 'text-default', css: 'var(--selaras-resolved-text-default)', purpose: 'body text' },
      { name: 'text-muted', css: 'var(--selaras-resolved-text-muted)', purpose: 'secondary / caption text' },
      { name: 'text-inverted', css: 'var(--selaras-resolved-text-inverted)', purpose: 'text on an inverted surface' },
    ],
  },
  {
    group: 'border',
    title: 'Borders',
    tokens: [
      { name: 'border-default', css: 'var(--selaras-resolved-border-default)', purpose: 'card / table / input border' },
      { name: 'border-muted', css: 'var(--selaras-resolved-border-muted)', purpose: 'hairline divider' },
      { name: 'border-hover', css: 'var(--selaras-resolved-border-hover)', purpose: 'border on hover' },
    ],
  },
  { group: 'primary', title: 'Primary (brand action)', tokens: colorTokens('primary', 'primary') },
  { group: 'accent', title: 'Accent (highlight)', tokens: colorTokens('accent', 'accent') },
  { group: 'secondary', title: 'Secondary (support)', tokens: colorTokens('secondary', 'secondary') },
  {
    group: 'shape',
    title: 'Radius & elevation',
    tokens: [
      { name: 'radius-sm', css: 'var(--selaras-resolved-radius-sm)', purpose: 'small corner (chips, inputs)' },
      { name: 'radius-md', css: 'var(--selaras-resolved-radius-md)', purpose: 'default corner (cards)' },
      { name: 'radius-lg', css: 'var(--selaras-resolved-radius-lg)', purpose: 'large corner (panels)' },
      { name: 'radius-full', css: 'var(--selaras-resolved-radius-full)', purpose: 'pill / circle' },
      { name: 'shadow-sm', css: 'var(--selaras-resolved-shadow-sm)', purpose: 'subtle elevation' },
      { name: 'shadow-md', css: 'var(--selaras-resolved-shadow-md)', purpose: 'card elevation' },
      { name: 'shadow-lg', css: 'var(--selaras-resolved-shadow-lg)', purpose: 'overlay elevation' },
    ],
  },
]

export const ALL_SELARAS_TOKENS: SelarasToken[] = SELARAS_TOKEN_GROUPS.flatMap(group => group.tokens)

type ModeValues = Record<string, string>
interface ThemeValues { light: ModeValues; dark: ModeValues }

function family(base: Record<'fill' | 'onFill' | 'text' | 'subtle' | 'onSubtle' | 'border', string>, hover: { fill: string; text: string }) {
  return {
    'fill': base.fill,
    'fill-hover': hover.fill,
    'on-fill': base.onFill,
    'text': base.text,
    'text-hover': hover.text,
    'subtle': base.subtle,
    'on-subtle': base.onSubtle,
    'border': base.border,
  }
}

function theme(light: {
  surface: [string, string, string, string]
  text: [string, string, string]
  border: [string, string, string]
  primary: ReturnType<typeof family>
  accent: ReturnType<typeof family>
  secondary: ReturnType<typeof family>
}, dark: typeof light): ThemeValues {
  const expand = (v: typeof light): ModeValues => {
    const out: ModeValues = {
      'surface-canvas': v.surface[0],
      'surface-default': v.surface[1],
      'surface-elevated': v.surface[2],
      'surface-inverted': v.surface[3],
      'text-default': v.text[0],
      'text-muted': v.text[1],
      'text-inverted': v.text[2],
      'border-default': v.border[0],
      'border-muted': v.border[1],
      'border-hover': v.border[2],
    }
    for (const fam of ['primary', 'accent', 'secondary'] as const) {
      for (const [suffix, value] of Object.entries(v[fam])) out[`color-${fam}-${suffix}`] = value
    }
    return out
  }
  return { light: expand(light), dark: expand(dark) }
}

export const ARTIFACT_THEME_VALUES: Record<ArtifactThemeId, ThemeValues> = {
  serangkai: theme(
    {
      surface: ['#f8fafc', '#ffffff', '#f1f5f9', '#0f172a'],
      text: ['#0f172a', '#64748b', '#f8fafc'],
      border: ['#dbe3ee', '#e8eef6', '#b6c4d9'],
      primary: family({ fill: '#2563eb', onFill: '#ffffff', text: '#1d4ed8', subtle: '#e8effc', onSubtle: '#1e40af', border: '#2563eb' }, { fill: '#1d4ed8', text: '#1e40af' }),
      accent: family({ fill: '#ea580c', onFill: '#ffffff', text: '#c2410c', subtle: '#fdeee3', onSubtle: '#9a3412', border: '#ea580c' }, { fill: '#c2410c', text: '#9a3412' }),
      secondary: family({ fill: '#0d9488', onFill: '#ffffff', text: '#0f766e', subtle: '#e6f4f2', onSubtle: '#115e59', border: '#0d9488' }, { fill: '#0f766e', text: '#115e59' }),
    },
    {
      surface: ['#090d18', '#0c0c0d', '#111827', '#f8fafc'],
      text: ['#e2e8f0', '#94a3b8', '#0f172a'],
      border: ['#263349', '#1b2637', '#3b4c66'],
      primary: family({ fill: '#417eff', onFill: '#061024', text: '#93c5fd', subtle: '#16233c', onSubtle: '#bfdbfe', border: '#417eff' }, { fill: '#619aff', text: '#bfdbfe' }),
      accent: family({ fill: '#f97316', onFill: '#1a0d02', text: '#fdba74', subtle: '#2a1608', onSubtle: '#fed7aa', border: '#f97316' }, { fill: '#fb923c', text: '#fed7aa' }),
      secondary: family({ fill: '#2dd4bf', onFill: '#032622', text: '#5eead4', subtle: '#062a26', onSubtle: '#99f6e4', border: '#2dd4bf' }, { fill: '#5eead4', text: '#99f6e4' }),
    },
  ),
  'rose-pine': theme(
    {
      surface: ['#faf4ed', '#fffaf3', '#f2e9e1', '#575279'],
      text: ['#575279', '#797593', '#fffaf3'],
      border: ['#dfdad9', '#eaddda', '#cecacd'],
      primary: family({ fill: '#907aa9', onFill: '#191724', text: '#5b4d6d', subtle: '#f4edec', onSubtle: '#5b4d6d', border: '#907aa9' }, { fill: '#84709c', text: '#4f4260' }),
      accent: family({ fill: '#ea9d34', onFill: '#191724', text: '#7a4f12', subtle: '#fdf1e0', onSubtle: '#7a4f12', border: '#ea9d34' }, { fill: '#d59032', text: '#6b4510' }),
      secondary: family({ fill: '#d7827e', onFill: '#191724', text: '#8f4c49', subtle: '#fbeee7', onSubtle: '#8f4c49', border: '#d7827e' }, { fill: '#c47775', text: '#7c3f3c' }),
    },
    {
      surface: ['#1f1d2e', '#232136', '#2a273f', '#e0def4'],
      text: ['#e0def4', '#908caa', '#1f1d2e'],
      border: ['#44415a', '#2a273f', '#56526e'],
      primary: family({ fill: '#c4a7e7', onFill: '#191724', text: '#c4a7e7', subtle: '#2a273f', onSubtle: '#e0def4', border: '#c4a7e7' }, { fill: '#d3bdf0', text: '#e0def4' }),
      accent: family({ fill: '#f6c177', onFill: '#191724', text: '#f6c177', subtle: '#2a273f', onSubtle: '#f6c177', border: '#f6c177' }, { fill: '#f8cf95', text: '#f8cf95' }),
      secondary: family({ fill: '#ebbcba', onFill: '#191724', text: '#ebbcba', subtle: '#2a273f', onSubtle: '#ebbcba', border: '#ebbcba' }, { fill: '#f0cccb', text: '#f0cccb' }),
    },
  ),
}

const SHAPE_VALUES: ModeValues = {
  'radius-sm': '0.375rem',
  'radius-md': '0.5rem',
  'radius-lg': '1rem',
  'radius-full': '9999px',
  'shadow-sm': '0 1px 2px 0 rgba(0,0,0,.06)',
  'shadow-md': '0 4px 16px -2px rgba(0,0,0,.12)',
  'shadow-lg': '0 12px 32px -4px rgba(0,0,0,.16)',
}

/** Every semantic name that gets a resolved wrapper (color + shape). */
export const RESOLVED_TOKEN_NAMES: string[] = [
  ...Object.keys(ARTIFACT_THEME_VALUES.serangkai.light),
  ...Object.keys(SHAPE_VALUES),
]

/**
 * Emits the token layer of the opt-in document theme.
 *
 * Base block = the default (serangkai) theme; a `data-serangkai-theme` override
 * swaps in the alternate palette. `light-dark()` resolves against the artifact's
 * own `color-scheme`, which the delivery bridge keeps in sync with the viewer.
 */
export function buildArtifactTokenCss(): string {
  const lines: string[] = [':root {', '  color-scheme: light dark;']
  const base = ARTIFACT_THEME_VALUES.serangkai
  for (const [name, light] of Object.entries(base.light)) {
    lines.push(`  --selaras-${name}: light-dark(${light}, ${base.dark[name]});`)
  }
  for (const [name, value] of Object.entries(SHAPE_VALUES)) {
    lines.push(`  --selaras-${name}: ${value};`)
  }
  for (const name of RESOLVED_TOKEN_NAMES) {
    lines.push(`  --selaras-resolved-${name}: var(--selaras-${name});`)
  }
  lines.push('}')

  const alt = ARTIFACT_THEME_VALUES['rose-pine']
  lines.push(`:root[data-serangkai-theme='rose-pine'] {`)
  for (const [name, light] of Object.entries(alt.light)) {
    lines.push(`  --selaras-${name}: light-dark(${light}, ${alt.dark[name]});`)
  }
  lines.push('}')
  return lines.join('\n')
}

/** Markdown reference for the MCP `serangkai://tokens/selaras` resource. */
export function selarasTokensGuide(): string {
  const sections = SELARAS_TOKEN_GROUPS.map(group => {
    const rows = group.tokens.map(token => `| \`${token.css}\` | ${token.purpose} |`).join('\n')
    return `### ${group.title}\n\n| CSS | Use for |\n| --- | --- |\n${rows}`
  }).join('\n\n')

  return `# Selaras design tokens for HTML artifacts

Opt in to the document theme, then style with the resolved tokens below. They
resolve against the viewer's active theme (Serangkai or Rosé Pine) and light/dark
mode, so you never hard-code a palette or need to know which theme is active.

\`\`\`html
<head>
  <meta name="serangkai-theme" content="selaras-document">
  <style>
    .card {
      background: var(--selaras-resolved-surface-default);
      color: var(--selaras-resolved-text-default);
      border: 1px solid var(--selaras-resolved-border-default);
      border-radius: var(--selaras-resolved-radius-md);
    }
    .card a { color: var(--selaras-resolved-color-primary-text); }
    .badge {
      background: var(--selaras-resolved-color-accent-subtle);
      color: var(--selaras-resolved-color-accent-on-subtle);
    }
  </style>
</head>
\`\`\`

Rules:
- Always read the \`--selaras-resolved-*\` wrapper, not a raw palette value.
- Provide a sensible fallback only if you must render without the theme:
  \`var(--selaras-resolved-surface-default, #fff)\`.
- Use \`color-scheme: light dark\` (the default) so light/dark follows the viewer.
- Do not import Selaras CSS or a CDN; the tokens are injected with the theme.

${sections}
`
}
