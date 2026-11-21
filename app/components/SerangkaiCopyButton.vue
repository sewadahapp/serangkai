<template>
  <STooltip :text="copied ? 'Copied' : `Copy ${label}`" :disabled="!!text"><SButton
    :icon="copied ? 'lucide:check' : 'lucide:copy'"
    :variant="text ? variant : 'ghost'"
    :color="text ? color : 'neutral'"
    :size="size"
    :square="!text"
    :disabled="!value"
    :aria-label="copied ? 'Copied' : `Copy ${label}`"
    @click="copy"
  ><template v-if="text">{{ copied ? 'Copied' : text }}</template></SButton></STooltip>
</template>

<script setup lang="ts">
/**
 * Compact copy control for read-only values (endpoints, share links, tokens).
 *
 * Swaps to a check mark after copying, so it works inside an input's trailing
 * slot without adding a toast for every copy. Pass `text` for a labelled
 * button (e.g. a page's primary "Copy setup prompt" action).
 */
const props = withDefaults(defineProps<{
  value: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
  text?: string
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost'
  color?: 'primary' | 'neutral'
}>(), {
  label: 'value',
  size: 'sm',
  text: undefined,
  variant: 'solid',
  color: 'primary',
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
