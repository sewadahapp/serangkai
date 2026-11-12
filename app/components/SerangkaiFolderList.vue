<template>
  <nav aria-label="Folders" class="space-y-0.5">
    <button type="button" class="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-[var(--selaras-resolved-surface-elevated)]" :class="{ 'folder-active': selectedId === null }" @click="$emit('select', null)">
      <span class="flex items-center gap-1.5"><SIcon name="lucide:layers" class="size-4 shrink-0" aria-hidden="true" /> All artifacts</span>
      <span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ total }}</span>
    </button>
    <div v-for="row in rows" :key="row.id" class="folder-row" :class="{ 'folder-active': selectedId === row.id }">
      <button type="button" class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md py-2 text-left text-sm" :style="{ paddingInlineStart: `${0.5 + Math.min(row.depth, 6) * 0.85}rem` }" @click="$emit('select', row.id)">
        <SIcon :name="selectedId === row.id ? 'lucide:folder-open' : 'lucide:folder'" class="size-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ row.name }}</span>
      </button>
      <span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ count(row.id) }}</span>
      <SDropdown :items="actions(row)" :adaptive="true">
        <SButton variant="ghost" size="sm" icon="lucide:ellipsis" :aria-label="`Actions for ${row.name}`" />
      </SDropdown>
    </div>
    <p v-if="!rows.length" class="px-2 py-2 text-sm text-[var(--selaras-resolved-text-muted)]">No folders yet.</p>
  </nav>
</template>

<script setup lang="ts">
interface FolderRow { id: string; name: string; parentId: string | null; path: string; depth: number }
interface Action { label: string; icon?: string; destructive?: boolean; onSelect: () => void }
defineProps<{ rows: FolderRow[]; selectedId: string | null; total: number; count: (id: string) => number; actions: (row: FolderRow) => Action[][] }>()
defineEmits<{ select: [id: string | null] }>()
</script>

<style scoped>
.folder-row { display: flex; align-items: center; gap: .4rem; border-radius: 6px; }
.folder-row:hover { background: var(--selaras-resolved-surface-elevated); }
.folder-active, .folder-row.folder-active:hover { background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); font-weight: 700; }
</style>
