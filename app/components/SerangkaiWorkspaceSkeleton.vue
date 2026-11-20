<template>
  <div role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">Loading workspace…</span>

    <!-- Mirrors the workspace toolbar and the selected view, so the page
         does not change shape when rangka arrive. Folders load in the
         sidebar, so they are not repeated here. -->
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3" aria-hidden="true">
      <div class="flex items-baseline gap-2.5">
        <SSkeleton animation="shimmer" class="h-5 w-28" />
        <SSkeleton animation="shimmer" class="h-3.5 w-16" />
      </div>
      <SSkeleton animation="shimmer" class="h-9 w-full rounded-md sm:w-[25rem]" />
    </div>

    <div v-if="view === 'grid'" class="workspace-skeleton-grid" aria-hidden="true">
      <div v-for="(width, index) in cardWidths" :key="index" class="overflow-hidden rounded-[var(--selaras-resolved-radius-lg)] border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-default)]">
        <SSkeleton animation="shimmer" class="workspace-skeleton-cover w-full rounded-none" />
        <div class="space-y-2 p-3.5">
          <SSkeleton animation="shimmer" class="h-4" :style="{ width }" />
          <SSkeleton animation="shimmer" class="h-3 w-2/5" />
        </div>
      </div>
    </div>

    <div v-else class="space-y-px" aria-hidden="true">
      <div v-for="(width, index) in rowWidths" :key="index" class="flex items-center gap-3 px-2.5 py-2">
        <SSkeleton animation="shimmer" class="size-9 shrink-0 rounded-md" />
        <div class="min-w-0 flex-1 space-y-2">
          <SSkeleton animation="shimmer" class="h-4" :style="{ width }" />
          <SSkeleton animation="shimmer" class="h-3 w-40 max-w-full" />
        </div>
        <SSkeleton animation="shimmer" class="h-8 w-8 shrink-0 rounded-md" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ view?: 'list' | 'grid' }>(), { view: 'grid' })
const cardWidths = ['82%', '64%', '74%', '58%', '88%', '70%']
const rowWidths = ['58%', '76%', '64%', '48%', '70%', '54%']
</script>

<style scoped>
/* Keep in step with the workspace grid in pages/index.vue. */
.workspace-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); gap: 1rem; }
.workspace-skeleton-cover { height: 4rem; }
@media (min-width: 640px) { .workspace-skeleton-cover { height: 5.5rem; } }
</style>
