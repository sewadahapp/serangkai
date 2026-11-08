/**
 * Selaras internal icon overrides.
 *
 * Selaras ships a semantic-purpose icon registry whose defaults are all
 * Hugeicons. Serangkai standardizes on Lucide: every key is overridden so no
 * component falls back to Hugeicons, which is neither installed locally nor
 * bundled. `tests/selaras-icons.test.mjs` guards against new registry keys
 * slipping through on a Selaras upgrade.
 *
 * `app.config.ts` feeds this map to Selaras, and `nuxt.config.ts` uses the
 * same values to prebundle the icons for the client.
 */
export const selarasIcons = {
  edit: 'lucide:pencil',
  close: 'lucide:x',
  check: 'lucide:check',
  indeterminate: 'lucide:minus',
  chevronUp: 'lucide:chevron-up',
  chevronDown: 'lucide:chevron-down',
  chevronRight: 'lucide:chevron-right',
  chevronLeft: 'lucide:chevron-left',
  chevronsLeft: 'lucide:chevrons-left',
  chevronsRight: 'lucide:chevrons-right',
  loading: 'lucide:loader-circle',
  search: 'lucide:search',
  sortUnsorted: 'lucide:arrow-up-down',
  sortAscending: 'lucide:arrow-up',
  sortDescending: 'lucide:arrow-down',
  filter: 'lucide:filter',
  columns: 'lucide:columns-3',
  copy: 'lucide:copy',
  lightMode: 'lucide:sun',
  darkMode: 'lucide:moon',
  calendar: 'lucide:calendar',
  clock: 'lucide:clock',
  plus: 'lucide:plus',
  minus: 'lucide:minus',
  success: 'lucide:circle-check',
  danger: 'lucide:circle-x',
  warning: 'lucide:triangle-alert',
  info: 'lucide:info',
  user: 'lucide:user',
  maximize: 'lucide:maximize',
  minimize: 'lucide:minimize',
  star: 'lucide:star',
  upload: 'lucide:upload',
  file: 'lucide:file',
  folder: 'lucide:folder',
  folderOpen: 'lucide:folder-open',
  more: 'lucide:ellipsis',
  sidebarCollapse: 'lucide:panel-left-close',
} as const

export const selarasIconNames = [...new Set(Object.values(selarasIcons))]
