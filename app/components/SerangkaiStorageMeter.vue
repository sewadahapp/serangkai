<template>
  <!-- Sidebar storage meter: a small card with a bar when expanded, a ring in
       the collapsed rail. Both open the Storage section of Settings. -->
  <template v-if="meter">
    <STooltip v-if="collapsed" :text="meter.description" :content="{ side: 'right' }">
      <NuxtLink to="/settings?tab=storage" class="storage-ring" :aria-label="meter.description">
        <SProgress v-if="meter.percent !== null" type="circular" size="sm" :model-value="meter.percent" :color="meter.color">
          <SIcon name="lucide:hard-drive" class="size-3.5 text-[var(--selaras-resolved-text-muted)]" aria-hidden="true" />
        </SProgress>
        <SIcon v-else name="lucide:hard-drive" class="size-4" aria-hidden="true" />
      </NuxtLink>
    </STooltip>
    <NuxtLink v-else to="/settings?tab=storage" class="storage-card" :aria-label="meter.description">
      <span class="storage-card-title">Storage</span>
      <span class="storage-card-row" aria-hidden="true">
        <span class="truncate">{{ status?.measuring ? 'Measuring…' : meter.summary }}</span>
        <span class="shrink-0" :class="{ 'storage-card-warning': meter.color === 'warning', 'storage-card-danger': meter.color === 'danger' }">{{ meter.remaining }}</span>
      </span>
      <SProgress v-if="meter.percent !== null" :model-value="meter.percent" size="sm" :color="meter.color" aria-hidden="true" />
    </NuxtLink>
  </template>
</template>

<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()

const { status } = useStorageStatus()
const meter = computed(() => status.value ? storageMeter(status.value) : null)
</script>

<style scoped>
.storage-card { display: flex; flex-direction: column; gap: .375rem; padding: .75rem .875rem .875rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-surface-default); transition: border-color 100ms; }
.storage-card:hover { border-color: var(--selaras-resolved-border-hover); }
.storage-card:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
.storage-card-title { font-size: .875rem; font-weight: 600; }
.storage-card-row { display: flex; min-width: 0; align-items: baseline; justify-content: space-between; gap: .75rem; margin-bottom: .125rem; font-size: .75rem; font-variant-numeric: tabular-nums; color: var(--selaras-resolved-text-muted); }
.storage-card-warning { color: var(--selaras-resolved-color-warning-text); font-weight: 600; }
.storage-card-danger { color: var(--selaras-resolved-color-danger-text); font-weight: 600; }
.storage-ring { display: grid; width: 2.5rem; height: 2.5rem; margin-inline: auto; place-items: center; border-radius: 9999px; color: var(--selaras-resolved-text-muted); }
.storage-ring:hover { background: var(--selaras-resolved-surface-default); }
.storage-ring:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
</style>
