<template>
  <div class="grid gap-6 lg:grid-cols-[17rem_1fr]" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">Loading workspace…</span>

    <aside class="space-y-4" aria-hidden="true">
      <div class="serangkai-panel overflow-hidden">
        <div class="border-b border-[var(--selaras-resolved-border-muted)] px-4 py-3">
          <SSkeleton animation="shimmer" class="h-4 w-20" />
        </div>
        <div class="space-y-1 p-2">
          <div class="flex items-center justify-between gap-3 px-2 py-1.5">
            <div class="flex items-center gap-1.5">
              <SSkeleton animation="shimmer" class="size-4 rounded-sm" />
              <SSkeleton animation="shimmer" class="h-3.5 w-24" />
            </div>
            <SSkeleton animation="shimmer" class="h-3 w-4" />
          </div>
          <div
            v-for="(width, index) in folderWidths"
            :key="index"
            class="flex items-center justify-between gap-3 px-2 py-1.5"
          >
            <div class="flex min-w-0 items-center gap-1.5">
              <SSkeleton animation="shimmer" class="size-4 shrink-0 rounded-sm" />
              <SSkeleton animation="shimmer" class="h-3.5" :style="{ width }" />
            </div>
            <SSkeleton animation="shimmer" class="h-3 w-4 shrink-0" />
          </div>
        </div>
      </div>
    </aside>

    <section aria-hidden="true">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <SSkeleton animation="shimmer" class="h-5 w-36" />
          <SSkeleton animation="shimmer" class="mt-2 h-3.5 w-24" />
        </div>
        <SSkeleton animation="shimmer" class="h-9 w-full rounded-md sm:w-72" />
      </div>

      <div class="space-y-2">
        <div
          v-for="(width, index) in artifactWidths"
          :key="index"
          class="flex items-center gap-3 rounded-lg border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-default)] p-3.5"
        >
          <SSkeleton animation="shimmer" class="size-10 shrink-0 rounded-md" />
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 items-center gap-2">
              <SSkeleton animation="shimmer" class="h-4" :style="{ width }" />
              <SSkeleton animation="shimmer" class="h-4 w-14 shrink-0 rounded-full" />
            </div>
            <SSkeleton animation="shimmer" class="mt-2 h-3 w-40 max-w-full" />
          </div>
          <SSkeleton animation="shimmer" class="h-8 w-8 shrink-0 rounded-md sm:w-20" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const folderWidths = ['6.5rem', '5rem', '7.5rem', '4.5rem', '6rem']
const artifactWidths = ['58%', '76%', '64%', '48%']
</script>
