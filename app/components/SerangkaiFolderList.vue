<template>
  <nav aria-label="Folders" class="space-y-0.5">
    <SButton variant="ghost" color="neutral" class="folder-select w-full justify-between text-left" :class="{ 'folder-active': selectedId === null }" @click="$emit('select', null)">
      <span class="flex items-center gap-2"><SIcon name="lucide:layers" class="size-4 shrink-0" aria-hidden="true" /> All rangka</span>
      <span class="flex items-center gap-1.5"><span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ total }}</span><span class="size-8 shrink-0" aria-hidden="true" /></span>
    </SButton>
    <STree
      v-if="rows.length"
      :items="treeItems"
      :model-value="selectedNode || []"
      :expanded="expanded"
      :ui="treeUi"
      aria-label="Folder tree"
      class="folder-tree"
      @update:expanded="$emit('update:expanded', $event)"
    >
      <template #item="{ item, expanded: branchOpen, selected }">
        <span class="folder-tree-content">
          <span v-if="(item as FolderNode).folder.depth" aria-hidden="true" class="folder-branch" :class="{ 'folder-branch-last': (item as FolderNode).last }" />
          <span v-for="offset in (item as FolderNode).guides" :key="offset" aria-hidden="true" class="folder-guide" :style="{ insetInlineStart: `calc(-1.75rem - ${offset}rem)` }" />
          <SIcon :name="selected || branchOpen ? 'lucide:folder-open' : 'lucide:folder'" class="size-4 shrink-0" aria-hidden="true" />
          <STooltip :text="(item as FolderNode).folder.path.replaceAll('/', ' / ')"><span class="min-w-0 flex-1 truncate">{{ item.label }}</span></STooltip>
          <span class="serangkai-tabular shrink-0 text-xs text-[var(--selaras-resolved-text-muted)]">{{ count((item as FolderNode).value) }}</span>
          <span class="inline-flex shrink-0" @click.stop @pointerdown.stop @keydown.stop>
            <STooltip :text="`Actions for ${item.label}`"><span class="inline-flex min-w-0"><SDropdown :positioning="{ align: 'end', collisionPadding: 12 }" :items="actions((item as FolderNode).folder)" :adaptive="true"><SButton variant="ghost" color="neutral" size="sm" icon="lucide:ellipsis" :aria-label="`Actions for ${item.label}`" /></SDropdown></span></STooltip>
          </span>
        </span>
      </template>
    </STree>
    <p v-if="!rows.length" class="px-2.5 py-2 text-sm text-[var(--selaras-resolved-text-muted)]">No folders yet.</p>
  </nav>
</template>

<script setup lang="ts">
import type { TreeItemType } from '@sewadah/selaras/types'

interface FolderRow { id: string; name: string; parentId: string | null; path: string; depth: number }
interface Action { label: string; icon?: string; destructive?: boolean; onSelect: () => void }
interface FolderNode extends TreeItemType { value: string; folder: FolderRow; last: boolean; guides: number[]; children?: FolderNode[] }
const props = defineProps<{ rows: FolderRow[]; selectedId: string | null; total: number; expanded: string[]; count: (id: string) => number; actions: (row: FolderRow) => Action[][] }>()
const emit = defineEmits<{ select: [id: string | null]; 'update:expanded': [ids: string[]] }>()

const treeItems = computed(() => {
  const byParent = new Map<string | null, FolderRow[]>()
  const ids = new Set(props.rows.map(row => row.id))
  for (const row of props.rows) {
    const parentId = row.parentId && ids.has(row.parentId) ? row.parentId : null
    const siblings = byParent.get(parentId) || []
    siblings.push(row)
    byParent.set(parentId, siblings)
  }
  const build = (parentId: string | null, ancestors: FolderNode[]): FolderNode[] => {
    const siblings = byParent.get(parentId) || []
    return siblings.map((folder, index) => {
      const depth = Math.min(folder.depth, 4)
      const node: FolderNode = {
        label: folder.name, value: folder.id, folder, last: index === siblings.length - 1,
        guides: ancestors.filter(ancestor => !ancestor.last && ancestor.folder.depth > 0 && ancestor.folder.depth < depth).map(ancestor => depth - ancestor.folder.depth),
      }
      const children = build(folder.id, [...ancestors, node])
      if (children.length) node.children = children
      return node
    })
  }
  return build(null, [])
})

const selectedNode = computed(() => {
  const find = (nodes: FolderNode[]): FolderNode | undefined => {
    for (const node of nodes) {
      if (node.value === props.selectedId) return node
      const match = node.children && find(node.children)
      if (match) return match
    }
  }
  return find(treeItems.value)
})

type TreeEvent = CustomEvent<{ value: FolderNode; originalEvent: Event }>
const isChevronClick = (event: Event) => event.target instanceof Element && !!event.target.closest('[data-folder-toggle]')
const treeUi = {
  item: {
    class: 'folder-tree-row min-w-0 gap-1 py-0',
    onSelect: (event: TreeEvent) => {
      // Keep selection controlled by the workspace, including clearing it via
      // All rangka. Expanding a branch must leave the mobile drawer open.
      event.preventDefault()
      if (!isChevronClick(event.detail.originalEvent)) emit('select', event.detail.value.value)
    },
    onToggle: (event: TreeEvent) => {
      if (event.detail.originalEvent.type === 'click' && !isChevronClick(event.detail.originalEvent)) event.preventDefault()
    },
  },
  toggle: { class: 'size-6 p-1', 'data-folder-toggle': '' },
  spacer: 'size-6',
  label: 'folder-tree-label',
}
</script>

<style scoped>
.folder-select { height: auto; min-height: 2rem; padding-block: 0; padding-inline: .625rem; }
.folder-active { background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); font-weight: 700; }
.folder-tree :deep(.folder-tree-label) { flex: 1; min-width: 0; overflow: visible; white-space: normal; }
.folder-tree-content { position: relative; display: flex; min-width: 0; align-items: center; gap: .375rem; }
.folder-tree :deep([data-selected]) { font-weight: 600; }
/* Cap visual indentation so deeply nested folders keep their actions usable.
   STree supplies inline indentation, while aria-level retains the true depth. */
.folder-tree :deep(.folder-tree-row) { min-height: 2rem; padding-inline-start: 4.375rem !important; padding-inline-end: .625rem; border-radius: var(--selaras-resolved-radius-md); }
.folder-tree :deep([aria-level="1"]) { padding-inline-start: .375rem !important; }
.folder-tree :deep([aria-level="2"]) { padding-inline-start: 1.375rem !important; }
.folder-tree :deep([aria-level="3"]) { padding-inline-start: 2.375rem !important; }
.folder-tree :deep([aria-level="4"]) { padding-inline-start: 3.375rem !important; }
.folder-branch, .folder-guide { position: absolute; inset-block: -.25rem; inset-inline-start: -1.75rem; border-inline-start: 1px solid var(--selaras-resolved-border-default); pointer-events: none; }
.folder-branch { width: .75rem; }
.folder-branch::after { position: absolute; top: 50%; width: 100%; border-top: 1px solid var(--selaras-resolved-border-default); content: ''; }
.folder-branch-last { bottom: 50%; }
.folder-branch-last::after { top: 100%; }
</style>
