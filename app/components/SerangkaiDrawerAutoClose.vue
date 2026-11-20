<script setup lang="ts">
/**
 * Closes the mobile sidebar drawer after any navigation, including choosing a
 * folder (which only changes the query), so the user lands on what they
 * picked. Desktop collapse state is never touched: `open` is only true while
 * the drawer is showing.
 */
const props = defineProps<{ open: boolean; toggle: () => void }>()
const route = useRoute()
watch(() => route.fullPath, () => {
  if (props.open) props.toggle()
})
</script>

<template>
  <span hidden />
</template>
