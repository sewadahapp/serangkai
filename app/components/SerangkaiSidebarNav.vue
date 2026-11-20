<template>
  <!-- Sidebar body, shared by the desktop sidebar and the mobile drawer:
       search (opens the command palette), sections, and on the workspace the
       folder tree. -->
  <STooltip v-if="collapsed" text="Search" :content="{ side: 'right' }">
    <button type="button" class="app-search app-search-collapsed" aria-label="Search" aria-keyshortcuts="Meta+K Control+K" @click="emit('search')">
      <SIcon name="lucide:search" class="size-4" aria-hidden="true" />
    </button>
  </STooltip>
  <button v-else type="button" class="app-search" aria-label="Search" aria-keyshortcuts="Meta+K Control+K" @click="emit('search')">
    <SIcon name="lucide:search" class="size-4 shrink-0" aria-hidden="true" />
    <span class="app-search-label">Search…</span>
    <span class="app-search-keys" aria-hidden="true"><SKbd value="mod" size="sm" /><SKbd value="K" size="sm" /></span>
  </button>
  <SNavigationMenu
    :items="navigationItems"
    orientation="vertical"
    color="neutral"
    :collapsed="collapsed"
    tooltip
    aria-label="Workspace sections"
  />
  <div v-if="isWorkspace && folderPanel && !collapsed" class="app-sidebar-folders">
    <p class="app-sidebar-label">FOLDERS</p>
    <component :is="folderPanel" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ search: [] }>()

const route = useRoute()
const folderPanel = useWorkspaceSidebar()
const isWorkspace = computed(() => route.path === '/' || route.path === '/workspace')
const workspaceLinks = [
  { to: '/', label: 'Workspace', icon: 'lucide:layers' },
  { to: '/agent', label: 'Agents', icon: 'lucide:bot' },
  { to: '/settings', label: 'Settings', icon: 'lucide:settings' },
]
const navigationItems = computed(() => workspaceLinks.map(link => ({ ...link, active: link.to === '/' ? isWorkspace.value : route.path.startsWith(link.to) })))
</script>

<style scoped>
.app-search { display: flex; width: 100%; min-width: 0; align-items: center; gap: .5rem; height: 2.25rem; margin-bottom: .75rem; padding: 0 .5rem 0 .625rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-md); background: var(--selaras-resolved-surface-default); font-size: .875rem; color: var(--selaras-resolved-text-muted); transition: border-color 100ms, color 100ms; }
.app-search:hover { border-color: var(--selaras-resolved-border-hover); color: var(--selaras-resolved-text-default); }
.app-search:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
.app-search-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.app-search-keys { display: flex; flex-shrink: 0; gap: .125rem; }
.app-search-collapsed { justify-content: center; width: 2.5rem; height: 2.5rem; margin-inline: auto; padding: 0; border-color: transparent; background: transparent; }
.app-sidebar-folders { margin-top: 1.5rem; }
.app-sidebar-label { margin: 0 .625rem .75rem; font-size: .6rem; font-weight: 700; letter-spacing: .12em; color: var(--selaras-resolved-text-muted); }
</style>
