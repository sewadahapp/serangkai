<template>
  <!-- The Serangkai mark: a frame (rangka) holding a set of pieces. Colors follow
       the active theme, so it matches Rosé Pine, Flexoki, and the rest. -->
  <svg class="serangkai-logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <g fill="none" stroke="var(--selaras-resolved-color-primary-fill)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 10.4V7a3 3 0 0 1 3-3h3.4" />
      <path d="M21.6 4H25a3 3 0 0 1 3 3v3.4" />
      <path d="M28 21.6V25a3 3 0 0 1-3 3h-3.4" />
      <path d="M10.4 28H7a3 3 0 0 1-3-3v-3.4" />
    </g>
    <rect x="9" y="9" width="7.4" height="14" rx="2" fill="var(--selaras-resolved-color-accent-fill)" />
    <rect x="18.4" y="9" width="4.6" height="6" rx="1.6" fill="var(--selaras-resolved-color-primary-fill)" />
    <rect x="18.4" y="17" width="4.6" height="6" rx="1.6" fill="var(--selaras-resolved-color-primary-fill)" />
  </svg>
</template>

<style scoped>
.serangkai-logo { display: block; width: 1.75rem; height: 1.75rem; flex-shrink: 0; }
</style>
