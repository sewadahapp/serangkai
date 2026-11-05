<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">Overview</h1>
        <p class="mt-2 text-muted-foreground">Your workspace at a glance.</p>
      </div>
      <SButton to="/workspace" variant="outline">Open workspace</SButton>
    </div>

    <SCard v-if="!user">
      <SCardHeader><SCardTitle>Sign in required</SCardTitle></SCardHeader>
      <SCardContent>
        <p class="mb-4 text-sm text-muted-foreground">Sign in to see your workspace summary.</p>
        <SButton to="/auth/login">Login</SButton>
      </SCardContent>
    </SCard>

    <template v-else>
      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SCard v-for="card in cards" :key="card.label">
          <SCardContent>
            <p class="text-sm text-muted-foreground">{{ card.label }}</p>
            <p class="mt-1 text-2xl font-semibold">{{ card.value }}</p>
          </SCardContent>
        </SCard>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <SCard>
          <SCardHeader><SCardTitle>Recent activity</SCardTitle></SCardHeader>
          <SCardContent>
            <ul v-if="recent.length" class="divide-y">
              <li v-for="artifact in recent" :key="artifact.id" class="py-3">
                <NuxtLink :to="`/artifacts/${artifact.id}`" class="font-medium hover:underline">{{ artifact.title }}</NuxtLink>
                <p class="text-sm text-muted-foreground">
                  {{ artifact.type }} · {{ artifact.visibility }} · updated {{ formatDate(artifact.updatedAt) }}
                </p>
              </li>
            </ul>
            <p v-else class="text-sm text-muted-foreground">No artifacts yet. Create one in the workspace.</p>
          </SCardContent>
        </SCard>

        <SCard>
          <SCardHeader><SCardTitle>By type</SCardTitle></SCardHeader>
          <SCardContent>
            <ul v-if="typeRows.length" class="space-y-2 text-sm">
              <li v-for="row in typeRows" :key="row.type" class="flex items-center justify-between">
                <span>{{ row.type }}</span>
                <span class="text-muted-foreground">{{ row.count }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-muted-foreground">Nothing to summarize yet.</p>
          </SCardContent>
        </SCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const user = useState('user')
const summary = ref<any>(null)
const recent = ref<any[]>([])
const error = ref('')

const formatDate = (value: string) => new Date(value).toLocaleString()

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const cards = computed(() => [
  { label: 'Artifacts', value: summary.value?.artifacts ?? 0 },
  { label: 'Folders', value: summary.value?.folders ?? 0 },
  { label: 'Shared', value: (summary.value?.publicArtifacts ?? 0) + (summary.value?.unlistedArtifacts ?? 0) },
  { label: 'Stored', value: formatBytes(summary.value?.totalBytes ?? 0) },
])

const typeRows = computed(() => Object.entries(summary.value?.byType || {})
  .map(([type, count]) => ({ type, count: count as number }))
  .sort((a, b) => b.count - a.count))

const loadOverview = async () => {
  error.value = ''
  try {
    const res = await $fetch('/api/overview')
    summary.value = res.summary
    recent.value = res.recent || []
  } catch (e: any) {
    error.value = e.data?.message || 'Could not load the workspace overview'
  }
}

onMounted(() => { if (user.value) loadOverview() })
</script>
