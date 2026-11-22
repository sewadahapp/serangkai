<script setup lang="ts">
const paths = {
  'arrow-right': 'M5 12h14m-7-7 7 7-7 7',
  'arrow-down': 'M12 5v14m-7-7 7 7 7-7',
  'arrow-up-right': 'M7 17 17 7M7 7h10v10',
  'terminal': 'm4 17 6-6-6-6m8 14h8',
  'panels': 'M3 9h18M7 9v12M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  'folder': 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
  'file': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h6',
  'chart': 'M3 3v18h18M7 14l4-4 4 4 5-6',
  'diagram': 'M9 2h6v6H9zM2 16h6v6H2zm14 0h6v6h-6zM12 8v4m-7 4v-4h14v4',
  'code': 'm8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18',
  'lock': 'M5 10h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm2 0V7a5 5 0 0 1 10 0v3',
  'link': 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7m2.2 5.8a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  'check': 'm20 6-11 11-5-5',
  'history': 'M3 12a9 9 0 1 1 9 9 9 9 0 0 1-6.8-3.1M3 4v6h6m3-3v5l3 2',
  'pause': 'M9 5H6v14h3zm9 0h-3v14h3z',
  'play': 'm6 3 14 9-14 9Z',
  'replay': 'M3 12a9 9 0 1 1 3 6.7M3 4v6h6',
  'box': 'M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8ZM3.3 7 12 12l8.7-5M12 22V12M7.5 4.3l9 5.2',
  'cloud': 'M20 16.6A4.5 4.5 0 0 0 18 8h-1.3a7 7 0 1 0-6.7 9h8',
  'server': 'M4 3h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 10h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2ZM6 7h.01M6 17h.01',
  'key': 'M15.5 7.5h.01M21 8a5 5 0 0 1-6.5 4.8L6.3 21H3v-3.3l8.2-8.2A5 5 0 1 1 21 8Z',
  'shield': 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-10 2 2 4-4',
} as const

defineProps<{ name: keyof typeof paths }>()
</script>

<template>
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
