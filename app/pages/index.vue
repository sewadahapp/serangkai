<script setup lang="ts">
definePageMeta({ layout: false })

const heroVariant: 'split' | 'centered' = 'split'
const hero = {
  eyebrow: 'PROJECT DOCUMENTATION',
  title: 'Everything you need to get started.',
  description: 'Clear guides, practical examples, and reference material for your team and users.',
  primaryLabel: 'Get started',
  primaryTo: '/guide/getting-started',
  secondaryLabel: 'Explore the API',
  secondaryTo: '/reference/api',
}
const sectionEyebrow = 'EXPLORE THE DOCS'
const sectionTitle = 'Find what you need'
const cards = [
  {
    title: 'Guides',
    description: 'Follow task-focused instructions to set up your project and learn the basics.',
    linkLabel: 'Start with the guide →',
    to: '/guide/getting-started',
  },
  {
    title: 'API reference',
    description: 'Look up endpoints, parameters, and response examples when you need them.',
    linkLabel: 'Browse the reference →',
    to: '/reference/api',
  },
  {
    title: 'Homepage patterns',
    description: 'Choose a hero layout and adapt its message, links, and preview to your project.',
    linkLabel: 'Explore the hero patterns →',
    to: '/guide/homepage-heroes',
  },
]
const site = useAppConfig().selarasDocs?.site
useSeoMeta({ title: hero.title, description: site?.description })
</script>

<template>
  <div class="flex min-h-screen flex-col bg-[var(--selaras-resolved-surface-canvas)]">
    <DocsHeader />

    <main class="flex-1">
      <SContainer size="full" class="py-8 sm:py-12 lg:py-16">
        <DocsHomeHero v-if="heroVariant === 'split'" v-bind="hero" />
        <DocsHomeHeroAlt v-else v-bind="hero" />

        <section class="mx-auto max-w-6xl space-y-5">
          <div class="max-w-2xl space-y-2">
            <p class="text-xs font-semibold tracking-[0.16em] text-[var(--selaras-resolved-text-muted)]">{{ sectionEyebrow }}</p>
            <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">{{ sectionTitle }}</h2>
          </div>

          <SCardGroup :cols="3">
            <SCard v-for="card in cards" :key="card.title">
              <template #header>
                <h3>{{ card.title }}</h3>
              </template>
              <p>{{ card.description }}</p>
              <NuxtLink :to="card.to" class="mt-4 inline-flex font-medium text-[var(--selaras-resolved-color-primary-fill)] hover:underline">
                {{ card.linkLabel }}
              </NuxtLink>
            </SCard>
          </SCardGroup>
        </section>
      </SContainer>
    </main>

    <DocsFooter />
  </div>
</template>
