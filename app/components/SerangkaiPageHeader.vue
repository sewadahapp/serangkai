<template>
  <!-- The one page header for signed-in sections (Workspace, Agents,
       Settings): same title scale, one-line description, actions on the
       right, and the same gap to the content below. -->
  <header class="page-header">
    <div class="page-header-text">
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<style scoped>
.page-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; }
.page-header-text { min-width: 0; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; line-height: 1.2; letter-spacing: -.035em; overflow-wrap: anywhere; }
.page-header p { margin-top: .5rem; font-size: .9rem; line-height: 1.6; color: var(--selaras-resolved-text-muted); }
.page-header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
@media (min-width: 640px) { .page-header h1 { font-size: 1.875rem; } }
</style>
