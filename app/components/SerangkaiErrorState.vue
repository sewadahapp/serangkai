<script setup lang="ts">
defineProps<{
  title: string
  description: string
  detail?: string
  retryLabel?: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="serangkai-panel p-5 sm:p-6" role="alert">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <span
        class="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--selaras-resolved-color-danger-subtle)] text-[var(--selaras-resolved-color-danger-text)]"
        aria-hidden="true"
      >
        <SIcon name="lucide:cloud-alert" class="size-5" />
      </span>

      <div class="min-w-0 flex-1">
        <h2 class="font-semibold">{{ title }}</h2>
        <p class="mt-1 text-sm text-[var(--selaras-resolved-text-muted)]">{{ description }}</p>
        <p v-if="detail" class="mt-2 break-words font-mono text-xs text-[var(--selaras-resolved-text-muted)]">{{ detail }}</p>
        <div v-if="retryLabel || $slots.actions" class="mt-4 flex flex-wrap gap-2">
          <SButton v-if="retryLabel" variant="outline" icon="lucide:refresh-cw" @click="$emit('retry')">
            {{ retryLabel }}
          </SButton>
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>
