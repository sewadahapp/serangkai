<template>
  <div class="space-y-6" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">Loading artifact…</span>

    <div aria-hidden="true" class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <SSkeleton animation="shimmer" class="h-3.5 w-24" />
          <SSkeleton animation="shimmer" class="mt-3 h-8 w-72 max-w-full" />
          <div class="mt-3 flex flex-wrap items-center gap-1.5">
            <SSkeleton animation="shimmer" class="h-5 w-16 rounded-full" />
            <SSkeleton animation="shimmer" class="h-5 w-16 rounded-full" />
            <SSkeleton animation="shimmer" class="h-3.5 w-24" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <SSkeleton v-for="index in 3" :key="index" animation="shimmer" class="h-9 w-24 rounded-md" />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="serangkai-panel overflow-hidden">
          <div class="flex items-center justify-between gap-3 border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
            <SSkeleton animation="shimmer" class="h-4 w-16" />
            <SSkeleton animation="shimmer" class="h-3 w-20" />
          </div>
          <div class="space-y-3 p-5">
            <SSkeleton animation="shimmer" class="h-5 w-2/3" />
            <SSkeleton animation="shimmer" class="h-4 w-full" />
            <SSkeleton animation="shimmer" class="h-4 w-11/12" />
            <SSkeleton animation="shimmer" class="h-4 w-4/5" />
            <SSkeleton animation="shimmer" class="h-4 w-full" />
            <SSkeleton animation="shimmer" class="h-4 w-3/5" />
            <SSkeleton animation="shimmer" class="h-4 w-10/12" />
            <SSkeleton animation="shimmer" class="h-4 w-2/3" />
          </div>
        </section>

        <div class="space-y-4">
          <section class="serangkai-panel p-4">
            <SSkeleton animation="shimmer" class="h-4 w-20" />
            <div class="mt-3 space-y-3">
              <div>
                <SSkeleton animation="shimmer" class="h-3 w-16" />
                <SSkeleton animation="shimmer" class="mt-2 h-9 w-full rounded-md" />
              </div>
              <div class="flex flex-wrap gap-2">
                <SSkeleton animation="shimmer" class="h-9 w-32 rounded-md" />
                <SSkeleton animation="shimmer" class="h-9 w-24 rounded-md" />
              </div>
            </div>
          </section>

          <section class="serangkai-panel p-4">
            <SSkeleton animation="shimmer" class="h-4 w-16" />
            <div class="mt-3 space-y-2">
              <SSkeleton animation="shimmer" class="h-3 w-14" />
              <SSkeleton animation="shimmer" class="h-9 w-full rounded-md" />
              <SSkeleton animation="shimmer" class="h-9 w-28 rounded-md" />
            </div>
          </section>

          <section class="serangkai-panel p-4">
            <div class="flex items-center justify-between gap-2">
              <SSkeleton animation="shimmer" class="h-4 w-16" />
              <SSkeleton animation="shimmer" class="h-3 w-20" />
            </div>
            <div class="mt-4 space-y-4">
              <div v-for="index in 3" :key="index" class="flex items-start gap-3">
                <SSkeleton animation="shimmer" class="mt-0.5 size-2.5 shrink-0 rounded-full" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <SSkeleton animation="shimmer" class="h-3.5 w-8" />
                    <SSkeleton animation="shimmer" class="h-3 w-16" />
                  </div>
                  <SSkeleton animation="shimmer" class="mt-2 h-7 w-24 rounded-md" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
