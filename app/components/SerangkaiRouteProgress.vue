<template>
  <div v-if="isLoading" class="serangkai-route-progress" aria-hidden="true">
    <span :style="{ width: `${progress}%` }" />
  </div>
</template>

<script setup lang="ts">
// Nuxt throttles the indicator so fast navigations never flash a bar, and
// keeps it visible briefly after the new page is ready instead of snapping.
const { isLoading, progress } = useLoadingIndicator({
  duration: 2000,
  throttle: 150,
  hideDelay: 250,
})
</script>
