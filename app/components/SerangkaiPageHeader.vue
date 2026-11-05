<template>
  <div class="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--selaras-resolved-border-default)] pb-6">
    <div class="min-w-0">
      <p v-if="eyebrow" class="serangkai-eyebrow">{{ eyebrow }}</p>
      <h1 class="serangkai-balance mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{{ title }}</h1>
      <p v-if="description" class="serangkai-pretty mt-1.5 max-w-2xl text-sm text-[var(--selaras-resolved-text-muted)] sm:text-base">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  eyebrow?: string
}>()
</script>
