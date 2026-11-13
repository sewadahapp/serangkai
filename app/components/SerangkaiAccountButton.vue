<template>
  <SButton variant="ghost" color="neutral" size="sm" class="account-button" :aria-label="`Account menu for ${username || 'account'}`">
    <SAvatar :text="initial" color="neutral" size="md" aria-hidden="true" />
    <span class="account-name">{{ username }}</span>
    <SIcon name="lucide:chevron-down" class="account-chevron size-3.5 shrink-0" aria-hidden="true" />
  </SButton>
</template>

<script setup lang="ts">
const props = defineProps<{ username?: string | null }>()
const initial = computed(() => Array.from(props.username?.trim() || '?')[0]?.toLocaleUpperCase() || '?')
</script>

<style scoped>
.account-button { gap: .5rem; border-radius: 9999px; padding: .25rem .625rem .25rem .25rem; color: var(--selaras-resolved-text-default); }
.account-name { max-width: 6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .875rem; font-weight: 600; }
.account-chevron { color: var(--selaras-resolved-text-muted); }
</style>
