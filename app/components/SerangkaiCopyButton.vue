<template>
  <STooltip :text="copied ? 'Copied' : `Copy ${label}`"><SButton
    :icon="copied ? 'lucide:check' : 'lucide:copy'"
    variant="ghost"
    color="neutral"
    :size="size"
    square
    :disabled="!value"
    :aria-label="copied ? 'Copied' : `Copy ${label}`"

    @click="copy"
  /></STooltip>
</template>

<script setup lang="ts">
/**
 * Compact copy control for read-only values (endpoints, share links, tokens).
 *
 * Swaps to a check mark after copying, so it works inside an input's trailing
 * slot without adding a toast for every copy.
 */
const props = withDefaults(defineProps<{
  value: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  label: 'value',
  size: 'sm',
})

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  if (await copyText(props.value)) {
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = false }, 1500)
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>
