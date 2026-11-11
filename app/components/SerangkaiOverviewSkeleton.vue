<template>
  <div class="space-y-6" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">Loading overview…</span>

    <div aria-hidden="true" class="space-y-6">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="index in 4" :key="index" class="serangkai-panel p-4">
          <SSkeleton animation="shimmer" class="h-3 w-20" />
          <SSkeleton animation="shimmer" class="mt-3 h-7 w-16" />
          <SSkeleton animation="shimmer" class="mt-2 h-3 w-24" />
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section class="serangkai-panel overflow-hidden">
          <div class="flex items-center justify-between gap-3 border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
            <SSkeleton animation="shimmer" class="h-4 w-28" />
            <SSkeleton animation="shimmer" class="h-3 w-12" />
          </div>
          <div class="divide-y divide-[var(--selaras-resolved-border-muted)]">
            <div
              v-for="(width, index) in recentWidths"
              :key="index"
              class="flex items-center justify-between gap-4 px-5 py-3"
            >
              <div class="min-w-0 flex-1">
                <SSkeleton animation="shimmer" class="h-4" :style="{ width }" />
                <SSkeleton animation="shimmer" class="mt-2 h-3 w-28" />
              </div>
              <SSkeleton animation="shimmer" class="h-3 w-12 shrink-0" />
            </div>
          </div>
        </section>

        <div class="space-y-6">
          <section class="serangkai-panel p-5">
            <SSkeleton animation="shimmer" class="h-4 w-16" />
            <div class="mt-4 space-y-3">
              <div v-for="index in 3" :key="index" class="flex items-center gap-3">
                <SSkeleton animation="shimmer" class="h-3.5 w-16 shrink-0" />
                <SSkeleton animation="shimmer" class="h-2 flex-1 rounded-full" />
                <SSkeleton animation="shimmer" class="h-3.5 w-5 shrink-0" />
              </div>
            </div>
          </section>

          <section class="serangkai-panel p-5">
            <SSkeleton animation="shimmer" class="h-4 w-20" />
            <div class="mt-4 space-y-3">
              <div v-for="index in 3" :key="index" class="flex items-center justify-between gap-2">
                <SSkeleton animation="shimmer" class="h-3.5 w-20" />
                <SSkeleton animation="shimmer" class="h-3.5 w-5" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const recentWidths = ['58%', '76%', '64%', '48%']
</script>
