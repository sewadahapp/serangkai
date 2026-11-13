<template>
  <nav aria-label="Folders" class="space-y-0.5">
    <SButton variant="ghost" color="neutral" class="folder-select w-full justify-between text-left" :class="{ 'folder-active': selectedId === null }" @click="$emit('select', null)">
      <span class="flex items-center gap-1.5"><SIcon name="lucide:layers" class="size-4 shrink-0" aria-hidden="true" /> All artifacts</span>
      <span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ total }}</span>
    </SButton>
    <div v-for="row in rows" :key="row.id" class="folder-row" :class="{ 'folder-active': selectedId === row.id }">
      <SButton variant="ghost" color="neutral" class="folder-select min-w-0 flex-1 justify-start text-left" :style="{ paddingInlineStart: `${0.5 + Math.min(row.depth, 6) * 0.85}rem` }" @click="$emit('select', row.id)">
        <SIcon :name="selectedId === row.id ? 'lucide:folder-open' : 'lucide:folder'" class="size-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ row.name }}</span>
      </SButton>
      <span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ count(row.id) }}</span>
      <STooltip :text="`Actions for ${row.name}`"><span class="inline-flex min-w-0"><SDropdown :positioning="{ align: 'end', collisionPadding: 12 }" :items="actions(row)" :adaptive="true"><SButton variant="ghost" size="sm" icon="lucide:ellipsis" :aria-label="`Actions for ${row.name}`" /></SDropdown></span></STooltip>
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
.folder-select { height: auto; min-height: 2.25rem; padding-block: .5rem; padding-inline-end: .5rem; }
.folder-row { display: flex; align-items: center; gap: .4rem; border-radius: 6px; }
.folder-row:hover { background: var(--selaras-resolved-surface-elevated); }
.folder-active, .folder-row.folder-active:hover { background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); font-weight: 700; }
</style>
