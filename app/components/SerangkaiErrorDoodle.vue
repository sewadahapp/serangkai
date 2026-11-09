<script setup lang="ts">
/**
 * Hand-drawn error illustration in the Open Doodles spirit: a small character
 * with either a lost map or a torn document. Everything is inline SVG with
 * currentColor so it follows the light/dark theme without extra assets.
 */
const props = withDefaults(defineProps<{
  variant?: 'lost' | 'torn'
}>(), {
  variant: 'lost',
})
</script>

<template>
  <svg
    class="serangkai-error-doodle h-auto w-full"
    viewBox="0 0 440 320"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <ellipse cx="220" cy="292" rx="146" ry="11" fill="var(--selaras-resolved-surface-elevated)" />

    <!-- Character -->
    <g stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M138 222c-2 16-6 31-10 45" />
      <path d="M159 222c2 16 6 31 10 45" />
      <path d="M128 267c-10 0-17 3-17 8 0 4 5 6 12 6h10v-14Z" fill="var(--selaras-resolved-surface-default)" />
      <path d="M169 267c10 0 17 3 17 8 0 4-5 6-12 6h-10v-14Z" fill="var(--selaras-resolved-surface-default)" />

      <path d="M126 175c15-8 34-8 49 0l6 47c-18 8-43 8-61 0l6-47Z" fill="var(--selaras-resolved-color-primary-subtle)" />
      <path d="M142 175l9 8 9-8" />

      <path d="M127 185c-16 8-24 19-28 32" />
      <circle cx="97" cy="220" r="6" fill="var(--selaras-resolved-surface-default)" />
      <path d="M174 185c17 0 31-7 41-17" />
      <circle cx="219" cy="166" r="6" fill="var(--selaras-resolved-surface-default)" />

      <circle cx="150" cy="143" r="28" fill="var(--selaras-resolved-surface-default)" />
      <path d="M122 141c1-21 16-33 35-29 12 3 20 10 23 21-12-7-24-5-34 2-8 5-15 7-24 6Z" fill="currentColor" stroke="none" />
      <circle cx="140" cy="147" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="161" cy="147" r="2.4" fill="currentColor" stroke="none" />
      <path d="M143 158c5 5 12 5 17 0" />
      <path d="M126 148c-5 0-9 1-11 3M174 148c5 0 9 1 11 3" />
    </g>

    <!-- Lost: a map that does not agree with the ground -->
    <g v-if="props.variant === 'lost'">
      <g transform="rotate(-4 300 150)">
        <path
          d="M246 78h100c6 0 11 5 10 11l-9 100c-1 6-6 10-12 9l-92-9c-6-1-10-6-9-12l8-88c0-6 3-10 4-11Z"
          fill="var(--selaras-resolved-surface-default)"
          stroke="currentColor"
          stroke-width="3"
          stroke-linejoin="round"
        />
        <path d="M337 78l-2 22 19-11" fill="var(--selaras-resolved-surface-elevated)" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
        <path
          d="M266 142c9-25 30-14 38-36 6-17 24-10 31-30"
          stroke="var(--selaras-resolved-color-accent-fill)"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-dasharray="1 9"
        />
        <path d="M328 67l12 12M340 67l-12 12" stroke="var(--selaras-resolved-color-danger-fill)" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="274" cy="104" r="9" stroke="currentColor" stroke-width="3" />
        <path d="M270 104h8M274 100v8" stroke="currentColor" stroke-width="2" />
        <path d="M264 176h48M264 190h35" stroke="currentColor" stroke-width="2.5" opacity=".45" stroke-linecap="round" />
      </g>

      <path
        d="M225 280c46-6 80 4 112-10 24-11 35-28 39-52"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-dasharray="2 10"
        opacity=".4"
        stroke-linecap="round"
      />

      <g stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none">
        <path d="M358 110c-1-9 5-15 12-14 8 1 11 9 7 15-3 5-8 6-8 13" />
        <circle cx="369" cy="134" r="1.8" fill="currentColor" stroke="none" />
        <path d="M80 100c-1-7 4-12 10-11 6 1 9 7 5 12-2 4-6 4-6 10" opacity=".7" />
        <circle cx="89" cy="119" r="1.5" fill="currentColor" stroke="none" opacity=".7" />
      </g>
    </g>

    <!-- Torn: the page split, but the pieces are still here -->
    <g v-else>
      <path
        d="M252 78h45l-3 25 7 8-8 9 6 9-6 10 5 10-7 9 4 15-43-2c-6 0-10-4-10-10V88c0-6 4-10 10-10Z"
        fill="var(--selaras-resolved-surface-default)"
        stroke="currentColor"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <path
        d="M319 82h26c6 0 10 5 10 11v94c0 6-5 10-11 10h-36l6-9-7-9 8-10-7-9 7-11-6-10 7-9-6-8 9-9-3-24Z"
        fill="var(--selaras-resolved-surface-default)"
        stroke="currentColor"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <path
        d="M299 80l-3 26 8 10-6 12 7 9-5 13 6 11-4 17"
        stroke="var(--selaras-resolved-color-accent-fill)"
        stroke-width="3.5"
        stroke-linecap="round"
      />
      <rect
        x="287"
        y="144"
        width="30"
        height="12"
        rx="3"
        transform="rotate(-8 302 150)"
        fill="var(--selaras-resolved-surface-elevated)"
        stroke="currentColor"
        stroke-width="2.5"
      />
      <path d="M261 100h25M261 114h20M261 128h24M261 142h14" stroke="currentColor" stroke-width="2.5" opacity=".45" stroke-linecap="round" />
      <path d="M328 110h10M328 126h12M328 142h8" stroke="currentColor" stroke-width="2.5" opacity=".45" stroke-linecap="round" />

      <path d="M232 64l12-8 4 13-13 5" fill="var(--selaras-resolved-surface-default)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M375 92l10 5-6 10-9-6" fill="var(--selaras-resolved-surface-default)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M354 244l11-7 5 11-12 6" fill="var(--selaras-resolved-surface-default)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M290 68l-4-12M310 66l2-12M270 72l-9-8" stroke="var(--selaras-resolved-color-accent-fill)" stroke-width="3" stroke-linecap="round" />
    </g>

    <g stroke="var(--selaras-resolved-color-accent-fill)" stroke-width="3" stroke-linecap="round">
      <path d="M74 74l8 8M82 70l-8 8" opacity=".8" />
      <path d="M388 60l10 10M398 56l-10 10" opacity=".6" />
    </g>
  </svg>
</template>

<style scoped>
.serangkai-error-doodle {
  animation: serangkai-error-float 7s ease-in-out infinite;
}

@keyframes serangkai-error-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}
</style>
