/**
 * Serangkai's supported declarative component registry.
 *
 * This is the single source of truth for:
 *  - which Comark tags are mapped to Selaras components;
 *  - which props are accepted and what values are valid;
 *  - which slots are allowed;
 *  - MCP capability/catalog documentation;
 *  - author-facing examples.
 *
 * Components not listed here are either application-only (they need private
 * application state, callbacks, or privileged actions) or impossible to use
 * safely from untrusted content. They are never advertised as available.
 */

export const colorValues = ['primary', 'secondary', 'neutral', 'success', 'danger', 'warning', 'info', 'accent'] as const
export const sizeValues = ['sm', 'md', 'lg'] as const

export type ComponentProp =
  | { type: 'string' | 'number' | 'boolean' | 'url' | 'array' | 'object'; description?: string }
  | { type: 'color'; description?: string }
  | { type: 'icon'; description?: string }
  | { type: 'enum'; values: readonly string[]; description?: string }
  | { type: 'stringOrArray'; description?: string }
  | { type: 'stringOrFalse'; description?: string }

export interface ArtifactComponent {
  /** Canonical Comark tag. */
  tag: string
  /** Alternative Comark tags normalized to `tag`. */
  aliases?: string[]
  /** Selaras (or Serangkai bridge) component name. */
  component: string
  support: 'declarative' | 'restricted'
  description: string
  props: Record<string, ComponentProp>
  slots?: string[]
  /** Components like tabs/accordion accept one named slot per item value. */
  dynamicSlots?: boolean
  /** Notes shown to authors and agents. */
  notes?: string
  example: string
}

export const artifactComponents: ArtifactComponent[] = [
  {
    tag: 's-alert',
    aliases: ['alert'],
    component: 'SAlert',
    support: 'declarative',
    description: 'Inline status message with an optional title and description.',
    props: {
      title: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'icon' },
      color: { type: 'color' },
      variant: { type: 'enum', values: ['solid', 'soft', 'outline'] },
    },
    slots: ['title', 'description', 'actions'],
    example: '::s-alert{title="Heads up" description="The export command changed." color="info"}\n::',
  },
  {
    tag: 's-avatar',
    component: 'SAvatar',
    support: 'declarative',
    description: 'User or entity avatar with image, initials, icon, or status.',
    props: {
      src: { type: 'url' },
      alt: { type: 'string' },
      text: { type: 'string' },
      icon: { type: 'icon' },
      color: { type: 'color' },
      statusColor: { type: 'color' },
      size: { type: 'enum', values: sizeValues },
      shape: { type: 'enum', values: ['circle', 'rounded'] },
      status: { type: 'boolean' },
    },
    example: '::s-avatar{text="AR" alt="Arif Rahman" size="sm"}\n::',
  },
  {
    tag: 's-avatar-group',
    component: 'SAvatarGroup',
    support: 'declarative',
    description: 'Overlapping avatar group; nest s-avatar components inside.',
    props: {
      max: { type: 'number' },
      size: { type: 'enum', values: sizeValues },
    },
    example: '::s-avatar-group{max="3"}\n  ::s-avatar{text="AR"}\n  ::\n  ::s-avatar{text="DS"}\n  ::\n::',
  },
  {
    tag: 's-badge',
    component: 'SBadge',
    support: 'declarative',
    description: 'Compact status or category label.',
    props: {
      label: { type: 'string' },
      icon: { type: 'icon' },
      trailingIcon: { type: 'icon' },
      rounded: { type: 'boolean' },
      dot: { type: 'boolean' },
      color: { type: 'color' },
      variant: { type: 'enum', values: ['solid', 'soft', 'outline', 'subtle'] },
      size: { type: 'enum', values: sizeValues },
    },
    example: '::s-badge{label="Stable" color="success" variant="soft"}\n::',
  },
  {
    tag: 's-button',
    component: 'SButton',
    support: 'restricted',
    description: 'Link button. Only navigation is allowed; event handlers and form actions are stripped.',
    props: {
      label: { type: 'string' },
      type: { type: 'enum', values: ['button'] },
      color: { type: 'color' },
      to: { type: 'url' },
      variant: { type: 'enum', values: ['solid', 'soft', 'subtle', 'outline', 'ghost', 'text', 'link'] },
      size: { type: 'enum', values: sizeValues },
      block: { type: 'boolean' },
      raised: { type: 'boolean' },
      disabled: { type: 'boolean' },
      icon: { type: 'icon' },
      trailingIcon: { type: 'icon' },
      square: { type: 'boolean' },
    },
    slots: ['default', 'icon', 'trailing-icon'],
    notes: 'Use `to` for links. Do not use buttons for actions that require JavaScript.',
    example: '::s-button{to="/workspace" color="primary" trailing-icon="lucide:arrow-right"}\nOpen workspace\n::',
  },
  {
    tag: 's-chip',
    component: 'SChip',
    support: 'declarative',
    description: 'Compact label chip. Removal is intentionally unavailable.',
    props: {
      label: { type: 'string' },
      icon: { type: 'icon' },
      disabled: { type: 'boolean' },
      rounded: { type: 'boolean' },
      color: { type: 'color' },
      variant: { type: 'enum', values: ['solid', 'soft', 'outline'] },
      size: { type: 'enum', values: sizeValues },
    },
    slots: ['default', 'icon'],
    example: '::s-chip{label="Design system" icon="lucide:palette"}\n::',
  },
  {
    tag: 's-icon',
    component: 'SIcon',
    support: 'declarative',
    description: 'Decorative or meaningful icon. Only the locally bundled lucide set is allowed.',
    props: {
      name: { type: 'icon' },
      color: { type: 'color' },
    },
    example: '::s-icon{name="lucide:sparkles" color="primary"}\n::',
  },
  {
    tag: 's-kbd',
    component: 'SKbd',
    support: 'declarative',
    description: 'Keyboard key or shortcut label.',
    props: {
      value: { type: 'string' },
      size: { type: 'enum', values: sizeValues },
    },
    slots: ['default'],
    example: ':s-kbd[⌘ K]\n',
  },
  {
    tag: 's-progress',
    component: 'SProgress',
    support: 'declarative',
    description: 'Read-only progress indicator.',
    props: {
      modelValue: { type: 'number' },
      max: { type: 'number' },
      type: { type: 'enum', values: ['linear', 'circular'] },
      size: { type: 'enum', values: sizeValues },
      color: { type: 'color' },
    },
    slots: ['default'],
    example: '::s-progress{model-value="68" max="100" color="primary"}\n68%\n::',
  },
  {
    tag: 's-separator',
    component: 'SSeparator',
    support: 'declarative',
    description: 'Horizontal or vertical divider, optionally labeled.',
    props: {
      orientation: { type: 'enum', values: ['horizontal', 'vertical'] },
      variant: { type: 'enum', values: ['solid', 'dashed', 'dotted', 'double'] },
      color: { type: 'color' },
      decorative: { type: 'boolean' },
    },
    slots: ['default'],
    example: '::s-separator{variant="dashed"}\nSection two\n::',
  },
  {
    tag: 's-skeleton',
    component: 'SSkeleton',
    support: 'declarative',
    description: 'Loading placeholder.',
    props: {
      animation: { type: 'enum', values: ['pulse', 'shimmer'] },
    },
    example: '::s-skeleton{animation="pulse"}\n::',
  },
  {
    tag: 's-toggle',
    component: 'SToggle',
    support: 'restricted',
    description: 'A locally interactive toggle with an uncontrolled default value.',
    props: {
      defaultValue: { type: 'boolean' },
      disabled: { type: 'boolean' },
      icon: { type: 'icon' },
      color: { type: 'color' },
      size: { type: 'enum', values: sizeValues },
      square: { type: 'boolean' },
    },
    slots: ['default'],
    example: '::s-toggle{default-value="true" color="primary"}\nBookmarked\n::',
  },
  {
    tag: 's-toggle-group',
    component: 'SToggleGroup',
    support: 'restricted',
    description: 'Locally interactive single or multiple toggle group.',
    props: {
      items: { type: 'array' },
      type: { type: 'enum', values: ['single', 'multiple'] },
      defaultValue: { type: 'stringOrArray' },
      disabled: { type: 'boolean' },
      orientation: { type: 'enum', values: ['horizontal', 'vertical'] },
      color: { type: 'color' },
      size: { type: 'enum', values: sizeValues },
    },
    slots: ['item'],
    example: '::s-toggle-group{items=\'[{"label":"List","value":"list","icon":"lucide:list"},{"label":"Grid","value":"grid","icon":"lucide:grid-2x2"}]\' default-value="list"}\n::',
  },
  {
    tag: 's-card',
    component: 'SCard',
    support: 'declarative',
    description: 'Bordered content card with optional header and footer slots.',
    props: {
      variant: { type: 'enum', values: ['outline', 'solid', 'soft', 'subtle'] },
    },
    slots: ['default', 'header', 'footer'],
    example: '::s-card{variant="soft"}\n#header\n### Release notes\n\n#default\nEverything shipped this week.\n::',
  },
  {
    tag: 's-card-group',
    component: 'SCardGroup',
    support: 'declarative',
    description: 'Responsive grid of cards.',
    props: {
      cols: { type: 'enum', values: ['2', '3', '4'] },
    },
    example: '::s-card-group{cols="2"}\n  ::s-card\n  First\n  ::\n  ::s-card\n  Second\n  ::\n::',
  },
  {
    tag: 's-container',
    component: 'SContainer',
    support: 'declarative',
    description: 'Constrained content container.',
    props: {
      size: { type: 'enum', values: ['sm', 'md', 'lg', 'xl', 'full'] },
    },
    example: '::s-container{size="md"}\nCentered content.\n::',
  },
  {
    tag: 's-scroll-area',
    component: 'SScrollArea',
    support: 'declarative',
    description: 'Scrollable content region.',
    props: {
      orientation: { type: 'enum', values: ['vertical', 'horizontal', 'both'] },
    },
    example: '::s-scroll-area{orientation="vertical"}\nLong content goes here.\n::',
  },
  {
    tag: 's-accordion',
    component: 'SAccordion',
    support: 'restricted',
    description: 'Locally collapsible sections with a default open value.',
    props: {
      items: { type: 'array' },
      type: { type: 'enum', values: ['single', 'multiple'] },
      defaultValue: { type: 'stringOrArray' },
      collapsible: { type: 'boolean' },
      disabled: { type: 'boolean' },
      size: { type: 'enum', values: sizeValues },
      variant: { type: 'enum', values: ['list', 'pill'] },
      chevronPosition: { type: 'enum', values: ['start', 'end'] },
      color: { type: 'color' },
    },
    dynamicSlots: true,
    example: '::s-accordion{items=\'[{"value":"one","label":"First section"},{"value":"two","label":"Second section"}]\' default-value="one"}\n#one\nFirst section body.\n#two\nSecond section body.\n::',
  },
  {
    tag: 's-breadcrumb',
    component: 'SBreadcrumb',
    support: 'declarative',
    description: 'Breadcrumb trail with static items.',
    props: {
      items: { type: 'array' },
      maxItems: { type: 'number' },
      separatorIcon: { type: 'icon' },
      color: { type: 'color' },
    },
    slots: ['item', 'separator'],
    example: '::s-breadcrumb{items=\'[{"label":"Workspace","to":"/workspace"},{"label":"Reports"}]\'}\n::',
  },
  {
    tag: 's-collapsible',
    component: 'SCollapsible',
    support: 'restricted',
    description: 'Single locally collapsible panel.',
    props: {
      defaultOpen: { type: 'boolean' },
      disabled: { type: 'boolean' },
      size: { type: 'enum', values: sizeValues },
      direction: { type: 'enum', values: ['down', 'up'] },
      color: { type: 'color' },
    },
    slots: ['trigger', 'default', 'chevron-icon'],
    example: '::s-collapsible{default-open="true"}\n#trigger\nShow details\n#default\nHidden **Markdown** content.\n::',
  },
  {
    tag: 's-navigation-menu',
    component: 'SNavigationMenu',
    support: 'restricted',
    description: 'Static navigation tree with link items. Callbacks are stripped.',
    props: {
      items: { type: 'array' },
      orientation: { type: 'enum', values: ['horizontal', 'vertical'] },
      contentOrientation: { type: 'enum', values: ['horizontal', 'vertical'] },
      positioning: { type: 'object' },
      color: { type: 'color' },
      variant: { type: 'enum', values: ['pill', 'link'] },
      highlight: { type: 'boolean' },
      collapsed: { type: 'boolean' },
      collapsedGroups: { type: 'enum', values: ['separator', 'spacing', 'none'] },
      tooltip: { type: 'boolean' },
    },
    dynamicSlots: true,
    example: '::s-navigation-menu{items=\'[{"label":"Overview","to":"/dashboard"},{"label":"Workspace","to":"/workspace"}]\' variant="link"}\n::',
  },
  {
    tag: 's-pagination',
    component: 'SPagination',
    support: 'restricted',
    description: 'Locally paged navigation with a default page.',
    props: {
      total: { type: 'number' },
      itemsPerPage: { type: 'number' },
      defaultPage: { type: 'number' },
      siblingCount: { type: 'number' },
      showEdges: { type: 'boolean' },
      showFirstLast: { type: 'boolean' },
      showControls: { type: 'boolean' },
      disabled: { type: 'boolean' },
      size: { type: 'enum', values: sizeValues },
      color: { type: 'color' },
      variant: { type: 'enum', values: ['solid', 'soft', 'outline', 'ghost', 'text'] },
      activeColor: { type: 'color' },
      activeVariant: { type: 'enum', values: ['solid', 'soft', 'outline', 'ghost', 'text'] },
    },
    example: '::s-pagination{total="42" items-per-page="10" default-page="1"}\n::',
  },
  {
    tag: 's-stepper',
    component: 'SStepper',
    support: 'restricted',
    description: 'Step indicator with a default active step.',
    props: {
      items: { type: 'array' },
      defaultValue: { type: 'number' },
      linear: { type: 'boolean' },
      orientation: { type: 'enum', values: ['horizontal', 'vertical'] },
      size: { type: 'enum', values: sizeValues },
      color: { type: 'color' },
    },
    slots: ['progress', 'indicator', 'title', 'description'],
    example: '::s-stepper{items=\'[{"title":"Draft"},{"title":"Review"},{"title":"Publish"}]\' default-value="2"}\n::',
  },
  {
    tag: 's-tabs',
    component: 'STabs',
    support: 'restricted',
    description: 'Locally switchable tabs. Give each item a value and a matching named slot.',
    props: {
      items: { type: 'array' },
      variant: { type: 'enum', values: ['underline', 'pill'] },
      orientation: { type: 'enum', values: ['horizontal', 'vertical'] },
      scrollable: { type: 'boolean' },
      unmountOnHide: { type: 'boolean' },
      defaultValue: { type: 'string' },
      color: { type: 'color' },
    },
    dynamicSlots: true,
    example: '::s-tabs{items=\'[{"label":"Overview","value":"overview"},{"label":"Details","value":"details"}]\' default-value="overview"}\n#overview\nOverview content.\n#details\nDetails content.\n::',
  },
  {
    tag: 's-tree',
    component: 'STree',
    support: 'restricted',
    description: 'Static tree with local expansion. Selection callbacks are stripped.',
    props: {
      items: { type: 'array' },
      defaultValue: { type: 'stringOrArray' },
      defaultExpanded: { type: 'array' },
      multiple: { type: 'boolean' },
      checkbox: { type: 'boolean' },
      propagateSelect: { type: 'boolean' },
      bubbleSelect: { type: 'boolean' },
      disabled: { type: 'boolean' },
      size: { type: 'enum', values: sizeValues },
      color: { type: 'color' },
    },
    slots: ['item'],
    example: '::s-tree{items=\'[{"label":"Docs","value":"docs","children":[{"label":"Guide","value":"guide"}]}]\' default-expanded=\'["docs"]\'}\n::',
  },
  {
    tag: 's-empty-state',
    component: 'SEmptyState',
    support: 'declarative',
    description: 'Empty-state message with optional icon and actions.',
    props: {
      title: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'icon' },
    },
    slots: ['icon', 'title', 'description', 'default', 'actions'],
    example: '::s-empty-state{title="No results" description="Try a different search." icon="lucide:search-x"}\n::',
  },
  {
    tag: 's-table',
    component: 'STable',
    support: 'declarative',
    description: 'Data table from JSON data and column definitions.',
    props: {
      data: { type: 'array' },
      columns: { type: 'array' },
      size: { type: 'enum', values: sizeValues },
      gridlines: { type: 'boolean' },
      striped: { type: 'boolean' },
      rowHover: { type: 'boolean' },
      loading: { type: 'boolean' },
      defaultSorting: { type: 'array' },
      color: { type: 'color' },
    },
    slots: ['empty'],
    notes: 'Selection, expandable rows, tree rows, and column toggles require application state and are not available.',
    example: '::s-table{data=\'[{"name":"Ada","role":"Admin"},{"name":"Lin","role":"Member"}]\' columns=\'[{"field":"name","header":"Name"},{"field":"role","header":"Role"}]\' striped}\n::',
  },
  {
    tag: 's-timeline',
    component: 'STimeline',
    support: 'declarative',
    description: 'Timeline of events.',
    props: {
      items: { type: 'array' },
      orientation: { type: 'enum', values: ['vertical', 'horizontal'] },
      align: { type: 'enum', values: ['start', 'end', 'alternate'] },
      size: { type: 'enum', values: sizeValues },
      color: { type: 'color' },
    },
    dynamicSlots: true,
    example: '::s-timeline{items=\'[{"id":"1","date":"Monday","title":"Draft","description":"First pass."},{"id":"2","date":"Tuesday","title":"Review","description":"Feedback collected."}]\'}\n::',
  },
  {
    tag: 's-callout',
    aliases: ['callout'],
    component: 'SCallout',
    support: 'declarative',
    description: 'Documentation callout with note, tip, warning, or danger tone.',
    props: {
      type: { type: 'enum', values: ['note', 'tip', 'warning', 'danger'] },
      title: { type: 'string' },
      icon: { type: 'stringOrFalse' },
    },
    slots: ['title', 'default'],
    example: '::s-callout{type="tip" title="Good to know"}\nMarkdown works **inside** callouts.\n::',
  },
  {
    tag: 's-code-button',
    component: 'SCodeButton',
    support: 'declarative',
    description: 'Inline code snippet with a copy button.',
    props: {
      code: { type: 'string' },
    },
    slots: ['default'],
    example: '::s-code-button{code="bun run dev"}\nbun run dev\n::',
  },
  {
    tag: 's-code-tree',
    component: 'SCodeTree',
    support: 'declarative',
    description: 'File tree with selectable source previews.',
    props: {
      items: { type: 'array' },
      defaultExpanded: { type: 'boolean' },
    },
    example: '::s-code-tree{items=\'[{"name":"src","children":[{"name":"index.ts","code":"export const ok = true","language":"ts"}]}]\'}\n::',
  },
  {
    tag: 's-file-tree',
    component: 'SFileTree',
    support: 'declarative',
    description: 'File tree for paths and structure.',
    props: {
      items: { type: 'array' },
      defaultExpanded: { type: 'boolean' },
      color: { type: 'color' },
    },
    example: '::s-file-tree{items=\'[{"name":"docs","children":[{"name":"guide.md"}]}]\'}\n::',
  },
  {
    tag: 's-read-more',
    component: 'SReadMore',
    support: 'restricted',
    description: 'Locally expandable long content block.',
    props: {
      previewHeight: { type: 'number' },
      color: { type: 'color' },
    },
    slots: ['default'],
    example: '::s-read-more{preview-height="160"}\nLong **Markdown** content that can expand.\n::',
  },
  {
    tag: 'serangkai-mermaid',
    component: 'MarkdownMermaid',
    support: 'declarative',
    description: 'Theme-aware Mermaid diagram. Prefer ```mermaid fences; ::mermaid is also accepted.',
    props: { source: { type: 'string' } },
    notes: 'Mermaid is parsed and rendered inside Serangkai; no CDN or initialization code is needed.',
    example: '```mermaid\nflowchart LR\n  Draft --> Review --> Share\n```',
  },
  {
    tag: 'serangkai-chart',
    component: 'MarkdownChart',
    support: 'declarative',
    description: 'TanStack chart from the declarative JSON schema. Prefer ```chart fences.',
    props: { definition: { type: 'string' } },
    notes: 'Supported types: bar, line, area, and horizontal bar. This is not the full TanStack Charts API.',
    example: '```chart\n{"type":"bar","data":[{"week":"W1","value":12},{"week":"W2","value":18}],"x":"week","y":"value"}\n```',
  },
]

export const componentByTag = new Map<string, ArtifactComponent>()
for (const entry of artifactComponents) {
  componentByTag.set(entry.tag, entry)
  for (const alias of entry.aliases || []) componentByTag.set(alias, entry)
}

export function findComponent(tag: string) {
  return componentByTag.get(tag.toLowerCase())
}

export function normalizeComponentTag(tag: string) {
  return findComponent(tag)?.tag || tag
}

/** Components that require application state or privileged actions. */
export const applicationOnlyComponents: Record<string, string> = {
  SApp: 'Application root; not a content component.',
  SAlertDialog: 'Requires application confirmation state.',
  SModal: 'Requires application modal state and focus management.',
  SDrawer: 'Requires application drawer state.',
  SSlideover: 'Requires application slideover state.',
  SToast: 'Requires the application toast renderer.',
  SCommandPalette: 'Requires application command state and keyboard routing.',
  SContextMenu: 'Requires pointer-driven application state.',
  SDropdown: 'Requires application menu state.',
  SPopover: 'Requires application popover state.',
  SColorModeSwitch: 'Controls the application color mode.',
  SColorModeToggle: 'Controls the application color mode.',
  STheme: 'Can rewrite global design tokens for the application.',
  SHeader: 'Application navigation shell.',
  SDashboardGroup: 'Application dashboard layout state.',
  SDashboardNavbar: 'Application dashboard shell.',
  SDashboardPanel: 'Application dashboard state.',
  SDashboardResizeHandle: 'Application layout state.',
  SDashboardSidebar: 'Application navigation state.',
  SDashboardSidebarToggle: 'Application navigation state.',
  SContentNavigation: 'Application navigation data.',
  SContentSurround: 'Application content routing.',
  SContentToc: 'The reader provides its own TOC rail.',
  SPageAside: 'Application page layout.',
  SPageHeader: 'Application page layout.',
  SFormField: 'Application form state and validation.',
  SInput: 'Requires form state and writes.',
  SInputGroup: 'Requires form state.',
  SInputNumber: 'Requires form state.',
  SSelect: 'Requires form state.',
  SAutocomplete: 'Requires form state.',
  SListbox: 'Requires form state.',
  SDatePicker: 'Requires form state and a date value.',
  SFileUpload: 'Requires upload actions and application state.',
  SColorPicker: 'Requires form state.',
  SCheckbox: 'Requires a writable model value; use a static badge instead in read-only documents.',
  SSwitch: 'Requires a writable model value.',
  SRadioGroup: 'Requires a writable model value.',
  SSlider: 'Requires a writable model value.',
  SRating: 'Requires a writable model value.',
  SPinInput: 'Requires a writable model value.',
  STransferList: 'Requires writable selection state.',
  SEditable: 'Requires an edit action.',
  SCalendar: 'Requires date selection state.',
  SSplitter: 'Requires application resize state.',
  SSplitterPanel: 'Requires the splitter application layout.',
  SSplitterResizeHandle: 'Requires the splitter application layout.',
  SToolbar: 'Requires application command actions.',
  SToolbarButton: 'Requires application command actions.',
  SToolbarSeparator: 'Application toolbar only.',
  SToolbarToggleGroup: 'Requires application command state.',
  SCodeGroup: 'Requires code-tab application state.',
  SDrawerRenderer: 'Internal renderer.',
  SModalRenderer: 'Internal renderer.',
  SConfirmRenderer: 'Internal renderer.',
  SSlideoverRenderer: 'Internal renderer.',
}

export function componentCatalogMarkdown() {
  const supported = artifactComponents.map((component) => {
    const props = Object.entries(component.props)
      .map(([name, spec]) => {
        if (spec.type === 'enum') return `${name}: ${spec.values.join(' | ')}`
        if (spec.type === 'color') return `${name}: color role`
        if (spec.type === 'icon') return `${name}: lucide icon name`
        return `${name}: ${spec.type}`
      })
      .join(', ')
    return `### ${component.tag}\n\n${component.description}\n\n- Selaras: \`${component.component}\`\n- Support: ${component.support}\n- Props: ${props || 'none'}\n- Slots: ${component.dynamicSlots ? 'one named slot per item value' : (component.slots?.join(', ') || 'default only')}\n${component.notes ? `- Notes: ${component.notes}\n` : ''}- Example:\n\n\`\`\`mdc\n${component.example}\n\`\`\``
  }).join('\n\n')

  const unsupported = Object.entries(applicationOnlyComponents)
    .map(([name, reason]) => `- \`${name}\`: ${reason}`)
    .join('\n')

  return `# Selaras components in Serangkai Markdown

Only the components below are available to Markdown/Comark artifacts. They are
rendered with the installed Selaras components, not recreated with custom HTML.
Application-only components remain available to prebuilt Vue applications but
are not exposed to untrusted Markdown.

${supported}

## Application-only components

${unsupported}
`
}
