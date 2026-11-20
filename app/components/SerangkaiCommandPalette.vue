<template>
  <!-- The one app-wide palette (Cmd/Ctrl+K). Selaras filters item labels as
       you type, so recent rangka and folders are loaded each time it opens. -->
  <SCommandPalette :groups="groups" />
</template>

<script setup lang="ts">
import type { CommandPaletteGroup } from '@sewadah/selaras/types'
import { themes } from '#shared/themes'
import type { WorkspaceAction } from '~/composables/useWorkspaceAction'

interface PaletteRangka { id: string; title: string; type: string }
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

const go = (to: string) => () => { void navigateTo(to) }
const route = useRoute()
const workspaceAction = (action: WorkspaceAction) => () => {
  pendingAction.value = action
  // Stay in the current folder/search when already on the workspace.
  if (route.path !== '/' && route.path !== '/workspace') void navigateTo('/')
}
const folderLabel = (path: string) => path.replace(/^\//, '').replaceAll('/', ' / ')

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
  {
    label: 'Recent rangka',
    items: recent.value.map(item => ({ label: item.title, icon: rangkaIcon(item.type), onSelect: go(`/rangka/${item.id}`) })),
  },
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
