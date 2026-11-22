<script setup lang="ts">
withDefaults(defineProps<{ drawn?: boolean; compact?: boolean }>(), { drawn: true, compact: false })

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const guides = [
  { top: '8%', value: '250' },
  { top: '36%', value: '200' },
  { top: '64%', value: '150' },
  { top: '92%', value: '100' },
]
</script>

<template>
  <div class="trend" :class="{ drawn, compact }" role="img" aria-label="Sample p95 API latency from Monday through Sunday, falling from 238 to 149 milliseconds and passing below a 180 millisecond target on Friday.">
    <div class="plot">
      <div v-for="guide in guides" :key="guide.value" class="guide" :style="{ top: guide.top }">
        <span>{{ guide.value }}</span>
      </div>
      <div class="target" />
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="area" d="M0 14.7 66.7 23.7 133.3 21.4 200 39.9 266.7 52.2 333.3 60.1 400 64.6V92H0Z" />
        <path class="line" d="M0 14.7 66.7 23.7 133.3 21.4 200 39.9 266.7 52.2 333.3 60.1 400 64.6" vector-effect="non-scaling-stroke" />
      </svg>
      <span class="point" />
    </div>
    <div class="days" aria-hidden="true">
      <span v-for="day in days" :key="day">{{ day }}</span>
    </div>
  </div>
</template>

<style scoped>
.trend { --chart-height: 140px; padding: 1px 7px 0 29px; font: 11px/1.2 var(--a-mono); }
.compact { --chart-height: 125px; padding-right: 5px; font-size: 10px; }
.plot { height: var(--chart-height); position: relative; }
.plot svg { position: absolute; width: 100%; height: 100%; overflow: visible; }
.guide, .target { position: absolute; inset-inline: 0; border-top: 1px solid var(--a-rule); }
.guide span { position: absolute; right: calc(100% + 8px); color: var(--a-muted); transform: translateY(-50%); }
.target { top: 47.2%; border-top: 1px dashed var(--a-copper); opacity: .7; }
.area { fill: var(--a-accent); opacity: 0; transition: opacity .65s .3s; }
.line { fill: none; stroke: var(--a-accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; clip-path: inset(-4px 100% -4px -4px); }
.point { position: absolute; top: 64.6%; left: 100%; width: 8px; height: 8px; background: var(--a-accent); border: 2px solid var(--a-panel); outline: 1px solid var(--a-accent); border-radius: 50%; transform: translate(-50%, -50%); opacity: 0; }
.drawn .area { opacity: .12; }
.drawn .line { clip-path: inset(-4px); transition: clip-path .78s cubic-bezier(.3,.1,.4,1); }
.drawn .point { opacity: 1; transition: opacity .2s .62s; }
.days { display: flex; justify-content: space-between; align-items: center; color: var(--a-muted); margin: -3px -3px 0; }
@media (prefers-reduced-motion: reduce) {
  .drawn .area, .drawn .line, .drawn .point { transition: none; }
}
</style>
