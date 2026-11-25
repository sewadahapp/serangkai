<template>
  <!-- Sidebar storage meter: a compact row with a bar when expanded, a ring in
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
    <!-- Flat like the account row below it: usage on the right, a thin bar
         under it. A warning replaces the usage with what is left. -->
    <NuxtLink v-else to="/settings?tab=storage" class="storage-card" :title="meter.description" :aria-label="meter.description">
      <span class="storage-card-row" aria-hidden="true">
        <SIcon name="lucide:hard-drive" class="storage-card-icon" />
        <span class="storage-card-title">Storage</span>
        <span class="storage-card-value" :class="{ 'storage-card-warning': meter.color === 'warning', 'storage-card-danger': meter.color === 'danger' }">{{ status?.measuring ? 'Measuring…' : meter.color === 'neutral' ? meter.summary : meter.remaining }}</span>
      </span>
      <span v-if="meter.percent !== null" class="storage-card-track" :data-color="meter.color" aria-hidden="true">
        <span class="storage-card-fill" :style="{ width: `${Math.max(meter.percent, 1.5)}%` }" />
      </span>
    </NuxtLink>
  </template>
</template>

<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()

const { status } = useStorageStatus()
const meter = computed(() => status.value ? storageMeter(status.value) : null)
</script>

<style scoped>
.storage-card { display: flex; flex-direction: column; gap: .5rem; padding: .5rem .5rem .625rem; border-radius: var(--selaras-resolved-radius-md); transition: background-color 100ms; }
.storage-card:hover { background: var(--selaras-resolved-surface-default); }
.storage-card:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
.storage-card-row { display: flex; min-width: 0; align-items: center; gap: .5rem; font-size: .8125rem; }
.storage-card-icon { flex-shrink: 0; width: 1rem; height: 1rem; color: var(--selaras-resolved-text-muted); }
.storage-card-title { flex-shrink: 0; font-weight: 500; color: var(--selaras-resolved-text-default); }
.storage-card-value { min-width: 0; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .75rem; font-variant-numeric: tabular-nums; color: var(--selaras-resolved-text-muted); }
.storage-card-warning { color: var(--selaras-resolved-color-warning-text); font-weight: 600; }
.storage-card-danger { color: var(--selaras-resolved-color-danger-text); font-weight: 600; }
.storage-card-track { display: block; height: .25rem; overflow: hidden; border-radius: 9999px; background: var(--selaras-resolved-border-muted); }
.storage-card-fill { display: block; height: 100%; border-radius: inherit; background: var(--selaras-resolved-color-primary-fill); transition: width 300ms ease; }
.storage-card-track[data-color="warning"] .storage-card-fill { background: var(--selaras-resolved-color-warning-fill); }
.storage-card-track[data-color="danger"] .storage-card-fill { background: var(--selaras-resolved-color-danger-indicator); }
.storage-ring { display: grid; width: 2.5rem; height: 2.5rem; margin-inline: auto; place-items: center; border-radius: 9999px; color: var(--selaras-resolved-text-muted); }
.storage-ring:hover { background: var(--selaras-resolved-surface-default); }
.storage-ring:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
</style>
