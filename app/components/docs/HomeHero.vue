<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  primaryLabel?: string
  primaryTo?: string
  secondaryLabel?: string
  secondaryTo?: string
}>(), {
  eyebrow: 'DOCUMENTATION',
  title: 'Everything you need to get started.',
  description: 'Guides, references, and examples to help you move forward.',
  primaryLabel: 'Get started',
  primaryTo: '/guide/getting-started',
  secondaryLabel: 'Browse the guides',
  secondaryTo: '/guide/getting-started',
})

const NuxtLinkComponent = resolveComponent('NuxtLink')
</script>

<template>
  <section class="relative isolate mb-14 overflow-hidden rounded-3xl border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-default)]">
    <div class="pointer-events-none absolute inset-0 -z-10" style="background: radial-gradient(ellipse at top left, color-mix(in oklab, var(--selaras-resolved-color-primary-fill) 18%, transparent), transparent 58%)" />
    <div class="grid items-center gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-14 lg:py-16">
      <div class="space-y-6">
        <p class="inline-flex rounded-full border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-elevated)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--selaras-resolved-text-muted)]">
          {{ eyebrow }}
        </p>
        <h1 class="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {{ title }}
        </h1>
        <p class="max-w-xl text-base leading-7 text-[var(--selaras-resolved-text-muted)] sm:text-lg">
          {{ description }}
        </p>
        <div class="flex flex-wrap gap-3 pt-1">
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

      <div class="rounded-2xl border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-elevated)] p-5 shadow-xl sm:p-6">
        <slot name="preview">
          <div class="mb-6 flex items-center justify-between gap-4 border-b border-[var(--selaras-resolved-border-default)] pb-4">
            <div>
              <p class="text-xs font-medium text-[var(--selaras-resolved-text-muted)]">A QUICK TOUR</p>
              <h2 class="mt-1 text-lg font-semibold">Find your next step</h2>
            </div>
            <span class="rounded-lg bg-[var(--selaras-resolved-surface-default)] px-2.5 py-1 text-xs text-[var(--selaras-resolved-text-muted)]">Start here</span>
          </div>

          <div class="space-y-3">
            <NuxtLink
              :to="primaryTo"
              class="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-[var(--selaras-resolved-border-default)] hover:bg-[var(--selaras-resolved-surface-default)]"
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--selaras-resolved-surface-default)] text-sm font-semibold text-[var(--selaras-resolved-text-muted)]">1</span>
              <span class="min-w-0">
                <span class="block font-medium group-hover:underline">Get oriented</span>
                <span class="mt-1 block text-sm text-[var(--selaras-resolved-text-muted)]">Set up your project and learn the basics.</span>
              </span>
            </NuxtLink>

            <NuxtLink
              :to="secondaryTo"
              class="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-[var(--selaras-resolved-border-default)] hover:bg-[var(--selaras-resolved-surface-default)]"
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--selaras-resolved-surface-default)] text-sm font-semibold text-[var(--selaras-resolved-text-muted)]">2</span>
              <span class="min-w-0">
                <span class="block font-medium group-hover:underline">Find a reference</span>
                <span class="mt-1 block text-sm text-[var(--selaras-resolved-text-muted)]">Look up details when you need them.</span>
              </span>
            </NuxtLink>
          </div>

          <div class="mt-6 rounded-xl bg-[var(--selaras-resolved-surface-default)] p-4">
            <p class="mb-3 text-xs font-medium text-[var(--selaras-resolved-text-muted)]">YOUR DOCS, YOUR WAY</p>
            <div class="space-y-2 font-mono text-xs sm:text-sm">
              <p><span class="text-[var(--selaras-resolved-text-muted)]">content/</span></p>
              <p class="pl-4">├─ guide/</p>
              <p class="pl-4">├─ reference/</p>
              <p class="pl-4">└─ index.md</p>
            </div>
          </div>
        </slot>
      </div>
    </div>
  </section>
</template>
