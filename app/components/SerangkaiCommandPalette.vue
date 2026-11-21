<template>
  <!-- The one app-wide palette (Cmd/Ctrl+K). Selaras fuzzy-filters the local
       groups as you type; rangka are searched on the server so every rangka
       can be found, not only the recent ones loaded when it opens. -->
  <SCommandPalette v-model:search-term="searchTerm" :groups="groups" :loading="searching" />
</template>

<script setup lang="ts">
import type { CommandPaletteGroup } from '@sewadah/selaras/types'
import { themes } from '#shared/themes'
import type { WorkspaceAction } from '~/composables/useWorkspaceAction'

interface PaletteRangka { id: string; title: string; type: string; folderId?: string | null }
interface PaletteFolder { id: string; path: string }

const { isOpen } = useCommandPalette()
const pendingAction = useWorkspaceAction()
const colorMode = useColorMode()
const theme = useAppTheme()

const recent = ref<PaletteRangka[]>([])
const folders = ref<PaletteFolder[]>([])

// Refresh on every open so new rangka and renamed folders show up. A failed
// load just leaves those groups out; navigation and actions still work.
watch(isOpen, async (open) => {
  if (!open) return
  try {
    const result = await $fetch<{ rangka: PaletteRangka[]; folders: PaletteFolder[] }>('/api/workspace')
    recent.value = result.rangka
    folders.value = [...result.folders].sort((a, b) => a.path.localeCompare(b.path))
  } catch {
    recent.value = []
    folders.value = []
  }
})

// Server search across all rangka, debounced. Responses to an older term are
// dropped so fast typing never shows stale matches.
const SEARCH_MIN_LENGTH = 2
const SEARCH_LIMIT = 8
const searchTerm = ref('')
const matches = ref<PaletteRangka[]>([])
const searching = ref(false)
const searchQuery = computed(() => searchTerm.value.trim())
const isSearching = computed(() => searchQuery.value.length >= SEARCH_MIN_LENGTH)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSequence = 0
watch(searchQuery, (query) => {
  clearTimeout(searchTimer)
  const sequence = ++searchSequence
  if (query.length < SEARCH_MIN_LENGTH) { matches.value = []; searching.value = false; return }
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const result = await $fetch<{ rangka: PaletteRangka[] }>('/api/search', { query: { q: query, limit: SEARCH_LIMIT } })
      if (sequence === searchSequence) matches.value = result.rangka
    } catch {
      if (sequence === searchSequence) matches.value = []
    } finally {
      if (sequence === searchSequence) searching.value = false
    }
  }, 200)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const go = (to: string) => () => { void navigateTo(to) }
const route = useRoute()
const workspaceAction = (action: WorkspaceAction) => () => {
  pendingAction.value = action
  // Stay in the current folder/search when already on the workspace.
  if (route.path !== '/' && route.path !== '/workspace') void navigateTo('/')
}
const folderLabel = (path: string) => path.replace(/^\//, '').replaceAll('/', ' / ')
const folderPath = (id?: string | null) => folders.value.find(folder => folder.id === id)?.path
// The palette has no description line, so the folder follows the title; it
// also tells apart rangka that share a name.
const rangkaItem = (item: PaletteRangka) => {
  const path = folderPath(item.folderId)
  return { label: path ? `${item.title} — ${folderLabel(path)}` : item.title, icon: rangkaIcon(item.type), onSelect: go(`/rangka/${item.id}`) }
}

const groups = computed<CommandPaletteGroup[]>(() => [
  {
    label: 'Actions',
    items: [
      { label: 'New rangka', icon: 'lucide:plus', onSelect: go('/workspace/new') },
      { label: 'Upload file', icon: 'lucide:upload', onSelect: workspaceAction('upload') },
      { label: 'New folder', icon: 'lucide:folder-plus', onSelect: workspaceAction('new-folder') },
    ],
  },
  {
    label: 'Go to',
    items: [
      { label: 'Workspace', icon: 'lucide:layers', onSelect: go('/') },
      { label: 'Agents', icon: 'lucide:bot', onSelect: go('/agent') },
      { label: 'Settings', icon: 'lucide:settings', onSelect: go('/settings') },
      { label: 'API tokens', icon: 'lucide:key-round', onSelect: go('/settings?tab=tokens') },
      { label: 'Connected agents', icon: 'lucide:plug', onSelect: go('/settings?tab=agents') },
    ],
  },
  // While searching, server matches replace the recent list. They are already
  // matched by title or slug, so Selaras must not filter them again.
  isSearching.value
    ? { label: 'Rangka', items: matches.value.map(rangkaItem), ignoreFilter: true }
    : { label: 'Recent rangka', items: recent.value.map(rangkaItem) },
  {
    label: 'Folders',
    items: folders.value.map(folder => ({ label: folderLabel(folder.path), icon: 'lucide:folder', onSelect: go(`/?folder=${encodeURIComponent(folder.id)}`) })),
  },
  {
    label: 'Appearance',
    items: [
      { label: 'Light mode', icon: 'lucide:sun', onSelect: () => { colorMode.preference = 'light' } },
      { label: 'Dark mode', icon: 'lucide:moon', onSelect: () => { colorMode.preference = 'dark' } },
      { label: 'System color mode', icon: 'lucide:monitor', onSelect: () => { colorMode.preference = 'system' } },
      ...themes.map(entry => ({ label: `${entry.label} theme`, icon: 'lucide:palette', onSelect: () => { theme.value = entry.id } })),
    ],
  },
].filter(group => group.items.length))
</script>
