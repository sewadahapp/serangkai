<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  announcement?: string
  title?: string
  description?: string
  primaryLabel?: string
  primaryTo?: string
  secondaryLabel?: string
  secondaryTo?: string
  visualPosition?: 'top' | 'bottom'
}>(), {
  eyebrow: 'PROJECT DOCUMENTATION',
  announcement: undefined,
  title: 'Documentation for what comes next.',
  description: 'Give your readers a clear place to learn, explore, and find answers.',
  primaryLabel: 'Get started',
  primaryTo: '/guide/getting-started',
  secondaryLabel: 'Browse the guides',
  secondaryTo: '/guide/getting-started',
  visualPosition: 'bottom',
})

const NuxtLinkComponent = resolveComponent('NuxtLink')
</script>

<template>
  <section class="mx-auto mb-16 max-w-6xl space-y-10 py-8 sm:py-12 lg:py-16">
    <div class="flex flex-col gap-10" :class="visualPosition === 'top' ? 'flex-col-reverse' : ''">
      <div class="mx-auto w-full max-w-4xl space-y-6 text-center">
        <p class="text-xs font-semibold tracking-[0.18em] text-[var(--selaras-resolved-text-muted)]">
          {{ eyebrow }}
        </p>
        <p
          v-if="announcement"
          class="mx-auto inline-flex rounded-full border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-elevated)] px-3 py-1.5 text-sm font-medium"
        >
          {{ announcement }}
        </p>
        <h1 class="text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
          {{ title }}
        </h1>
        <p class="mx-auto max-w-3xl text-base leading-7 text-[var(--selaras-resolved-text-muted)] sm:text-xl sm:leading-8">
          {{ description }}
        </p>
        <div class="flex flex-wrap justify-center gap-3 pt-2">
          <SButton
            :as="NuxtLinkComponent"
            :to="primaryTo"
            color="primary"
            variant="solid"
          >
            {{ primaryLabel }}
          </SButton>
          <SButton
            :as="NuxtLinkComponent"
            :to="secondaryTo"
            color="neutral"
            variant="outline"
          >
            {{ secondaryLabel }}
          </SButton>
        </div>
      </div>

      <div class="w-full overflow-hidden rounded-2xl border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-elevated)] shadow-xl">
        <slot name="visual">
          <div class="flex items-center gap-2 border-b border-[var(--selaras-resolved-border-default)] px-5 py-3">
            <span class="size-2.5 rounded-full bg-[var(--selaras-resolved-border-default)]" />
            <span class="size-2.5 rounded-full bg-[var(--selaras-resolved-border-default)]" />
            <span class="size-2.5 rounded-full bg-[var(--selaras-resolved-border-default)]" />
            <span class="ml-3 text-xs text-[var(--selaras-resolved-text-muted)]">Project docs preview</span>
          </div>
          <div class="grid min-h-72 md:grid-cols-[220px_1fr]">
            <nav class="hidden border-r border-[var(--selaras-resolved-border-default)] p-5 md:block" aria-label="Preview navigation">
              <p class="mb-4 text-sm font-semibold">Project Docs</p>
              <p class="rounded-md bg-[var(--selaras-resolved-surface-default)] px-3 py-2 text-sm font-medium">Getting started</p>
              <p class="px-3 py-2 text-sm text-[var(--selaras-resolved-text-muted)]">Guides</p>
              <p class="px-3 py-2 text-sm text-[var(--selaras-resolved-text-muted)]">API reference</p>
            </nav>
            <div class="space-y-5 p-6 sm:p-9">
              <p class="text-xs font-semibold tracking-wide text-[var(--selaras-resolved-text-muted)]">GETTING STARTED</p>
              <div class="space-y-2">
                <h2 class="text-2xl font-semibold">Make your first request</h2>
                <p class="text-sm text-[var(--selaras-resolved-text-muted)]">A short guide helps readers reach a useful result.</p>
              </div>
              <div class="rounded-xl bg-[var(--selaras-resolved-surface-default)] p-4 font-mono text-xs sm:text-sm">
                <p><span class="text-[var(--selaras-resolved-text-muted)]">$</span> curl https://api.example.com/v1/projects</p>
                <p class="mt-2 text-[var(--selaras-resolved-text-muted)]">-H "Authorization: Bearer $API_TOKEN"</p>
              </div>
            </div>
          </div>
        </slot>
      </div>
    </div>
  </section>
</template>
