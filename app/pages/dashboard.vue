<template>
  <div class="space-y-6">
    <SerangkaiPageHeader title="Overview" description="Your workspace at a glance.">
      <template #actions>
        <SButton to="/workspace" variant="outline" trailing-icon="lucide:arrow-right">Open workspace</SButton>
      </template>
    </SerangkaiPageHeader>

    <SAlert v-if="error" color="danger" variant="subtle" :title="error" />

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="card in cards" :key="card.label" class="serangkai-panel p-4">
        <p class="text-xs font-medium uppercase tracking-wider text-[var(--selaras-resolved-text-muted)]">{{ card.label }}</p>
        <p class="serangkai-tabular mt-2 text-2xl font-semibold tracking-tight">{{ card.value }}</p>
        <p class="mt-0.5 text-xs text-[var(--selaras-resolved-text-muted)]">{{ card.hint }}</p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section class="serangkai-panel overflow-hidden" aria-labelledby="recent-heading">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
          <h2 id="recent-heading" class="text-sm font-semibold">Recent activity</h2>
          <NuxtLink to="/workspace" class="text-xs text-[var(--selaras-resolved-text-muted)] underline-offset-4 hover:underline">View all</NuxtLink>
        </div>
        <ul v-if="recent.length" class="divide-y divide-[var(--selaras-resolved-border-muted)]">
          <li v-for="artifact in recent" :key="artifact.id">
            <NuxtLink :to="`/artifacts/${artifact.id}`" class="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-[var(--selaras-resolved-surface-elevated)]">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ artifact.title }}</p>
                <p class="mt-0.5 text-xs text-[var(--selaras-resolved-text-muted)]">{{ artifact.type }} · {{ artifact.visibility }}</p>
              </div>
              <time class="shrink-0 text-xs text-[var(--selaras-resolved-text-muted)]" :datetime="artifact.updatedAt">{{ formatDate(artifact.updatedAt) }}</time>
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="px-5 py-8 text-center text-sm text-[var(--selaras-resolved-text-muted)]">No artifacts yet.</p>
      </section>

      <div class="space-y-6">
        <section class="serangkai-panel p-5" aria-labelledby="types-heading">
          <h2 id="types-heading" class="text-sm font-semibold">By type</h2>
          <ul v-if="typeRows.length" class="mt-3 space-y-2">
            <li v-for="row in typeRows" :key="row.type" class="flex items-center gap-3">
              <span class="w-20 shrink-0 text-sm">{{ row.type }}</span>
              <SProgress :model-value="row.percent" size="sm" class="flex-1" :aria-label="`${row.type} share of artifacts`" />
              <span class="serangkai-tabular w-8 text-end text-sm text-[var(--selaras-resolved-text-muted)]">{{ row.count }}</span>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-[var(--selaras-resolved-text-muted)]">Nothing to summarize yet.</p>
        </section>

        <section class="serangkai-panel p-5" aria-labelledby="visibility-heading">
          <h2 id="visibility-heading" class="text-sm font-semibold">Visibility</h2>
          <dl class="mt-3 space-y-2 text-sm">
            <div v-for="row in visibilityRows" :key="row.label" class="flex items-center justify-between gap-2">
              <dt class="flex items-center gap-2">
                <span class="size-2 rounded-full" :style="{ backgroundColor: row.color }" aria-hidden="true" />
                {{ row.label }}
              </dt>
              <dd class="serangkai-tabular text-[var(--selaras-resolved-text-muted)]">{{ row.count }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Overview · Serangkai' })

const { loggedIn } = useUserSession()
const summary = ref<any>(null)
const recent = ref<any[]>([])
const error = ref('')

const formatDate = (value: string) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' })

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const cards = computed(() => [
  { label: 'Artifacts', value: summary.value?.artifacts ?? 0, hint: 'Across all folders' },
  { label: 'Folders', value: summary.value?.folders ?? 0, hint: 'Nested organization' },
  { label: 'Shared', value: (summary.value?.publicArtifacts ?? 0) + (summary.value?.unlistedArtifacts ?? 0), hint: 'Public or unlisted' },
  { label: 'Stored', value: formatBytes(summary.value?.totalBytes ?? 0), hint: 'Uploaded file size' },
])

const typeRows = computed(() => {
  const entries = Object.entries(summary.value?.byType || {}) as Array<[string, number]>
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1
  return entries
    .map(([type, count]) => ({ type, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
})

const visibilityRows = computed(() => [
  { label: 'Private', count: summary.value?.privateArtifacts ?? 0, color: 'var(--selaras-resolved-text-muted)' },
  { label: 'Unlisted', count: summary.value?.unlistedArtifacts ?? 0, color: 'var(--selaras-resolved-color-accent-indicator)' },
  { label: 'Public', count: summary.value?.publicArtifacts ?? 0, color: 'var(--selaras-resolved-color-success-indicator)' },
])

const loadOverview = async () => {
  error.value = ''
  try {
    const res = await $fetch<any>('/api/overview')
    summary.value = res.summary
    recent.value = res.recent || []
  } catch (e: any) {
    error.value = e.data?.message || 'Could not load the workspace overview'
  }
}

onMounted(() => { if (loggedIn.value) loadOverview() })
</script>
