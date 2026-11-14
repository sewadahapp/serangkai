<script setup lang="ts">
/**
 * Shared error hero used by the full-page error screen and the shared-rangka
 * reader. Keeping one implementation means both keep the same illustration,
 * typography, and recovery actions.
 */
withDefaults(defineProps<{
  eyebrow: string
  title: string
  description: string
  detail?: string
  statusCode?: number
  variant?: 'lost' | 'torn'
  primaryLabel?: string
  primaryIcon?: string
  primaryTo?: string
  retryLabel?: string
}>(), {
  variant: 'lost',
  primaryIcon: 'lucide:arrow-left',
})

defineEmits<{
  primary: []
  retry: []
}>()

const heading = ref<HTMLHeadingElement>()
onMounted(() => heading.value?.focus())
</script>

<template>
  <div class="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
    <section>
      <p class="serangkai-eyebrow">{{ eyebrow }}</p>
      <h1
        ref="heading"
        tabindex="-1"
        class="serangkai-balance mt-3 text-4xl font-bold leading-[1.08] tracking-tight outline-none sm:text-5xl"
      >
        {{ title }}
      </h1>
      <p class="serangkai-pretty mt-4 max-w-xl text-lg leading-relaxed text-[var(--selaras-resolved-text-muted)]">
        {{ description }}
      </p>

      <div v-if="primaryLabel || retryLabel || $slots.actions" class="mt-8 flex flex-wrap items-center gap-3">
        <SButton v-if="primaryLabel && primaryTo" size="lg" :to="primaryTo" :icon="primaryIcon">
          {{ primaryLabel }}
        </SButton>
        <SButton v-else-if="primaryLabel" size="lg" :icon="primaryIcon" @click="$emit('primary')">
          {{ primaryLabel }}
        </SButton>
        <SButton v-if="retryLabel" size="lg" variant="outline" icon="lucide:refresh-cw" @click="$emit('retry')">
          {{ retryLabel }}
        </SButton>
        <slot name="actions" />
      </div>

      <p v-if="statusCode != null || $slots.footnote" class="mt-6 text-sm text-[var(--selaras-resolved-text-muted)]">
        <template v-if="statusCode != null">
          Error code <span class="serangkai-tabular font-mono text-[var(--selaras-resolved-text-default)]">{{ statusCode }}</span>
        </template>
        <slot name="footnote" />
      </p>

      <details v-if="detail" class="mt-6 max-w-xl rounded-md border border-[var(--selaras-resolved-border-muted)] p-3 text-sm">
        <summary class="cursor-pointer font-medium">Error details (development only)</summary>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-[var(--selaras-resolved-text-muted)]">{{ detail }}</pre>
      </details>
    </section>

    <div class="mx-auto w-full max-w-md lg:max-w-none">
      <SerangkaiErrorDoodle :variant="variant" />
    </div>
  </div>
</template>
