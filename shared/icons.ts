/**
 * Lucide everywhere, matching the Serangkai app (`shared/selaras-icons.ts` on
 * master). Change both together.
 *
 * `selarasIcons` overrides every Selaras internal icon through
 * `app.config.selaras.icons`. `docsIconAliases` maps the few icons the
 * selaras-docs layer names directly (header GitHub link, edit and issue
 * links, viewport preview devices) through Nuxt Icon aliases, so the layer's
 * own components stay untouched.
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

export const docsIconAliases: Record<string, string> = {
  'hugeicons:github': 'lucide:github',
  'hugeicons:bug-01': 'lucide:bug',
  'hugeicons:pencil-edit-01': 'lucide:pencil',
  'hugeicons:computer': 'lucide:monitor',
  'hugeicons:tablet-01': 'lucide:tablet',
  'hugeicons:smart-phone-01': 'lucide:smartphone',
}

/** Every Lucide name referenced indirectly, for the client bundle. */
export const lucideIconNames = [...new Set([...Object.values(selarasIcons), ...Object.values(docsIconAliases)])]
