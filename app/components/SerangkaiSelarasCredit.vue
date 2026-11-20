<template>
  <!-- Sidebar promo card for the UI library Serangkai is built with.
       Dismissible; the choice is kept in a cookie so the server does not
       render it again (no flash after reload). -->
  <aside v-if="!dismissed" class="selaras-card" aria-label="Selaras">
    <div class="selaras-card-head">
      <p class="selaras-card-title"><SerangkaiSelarasMark class="selaras-card-mark" />Selaras</p>
      <STooltip text="Dismiss">
        <SButton variant="ghost" color="neutral" size="sm" icon="lucide:x" aria-label="Dismiss Selaras card" class="selaras-card-close" @click="dismissed = true" />
      </STooltip>
    </div>
    <p class="selaras-card-text">The Nuxt UI library behind Serangkai.</p>
    <a href="https://selarasui.my.id" target="_blank" rel="noopener noreferrer" class="selaras-card-link">
      Open Selaras docs<SIcon name="lucide:arrow-up-right" class="size-3.5" aria-hidden="true" /><span class="sr-only"> (opens in a new tab)</span>
    </a>
  </aside>
</template>

<script setup lang="ts">
const dismissedCookie = useCookie<string | null>('serangkai-selaras-card', { default: () => null, maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const dismissed = computed({
  get: () => dismissedCookie.value === 'dismissed',
  set: value => { dismissedCookie.value = value ? 'dismissed' : null },
})
</script>

<style scoped>
.selaras-card { padding: .875rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-surface-default); }
.selaras-card-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin: -.25rem -.375rem -.25rem 0; }
.selaras-card-title { display: flex; align-items: center; gap: .5rem; font-size: .875rem; font-weight: 600; }
.selaras-card-mark { width: 1.25rem; height: 1.25rem; color: var(--selaras-resolved-color-primary-text); }
.selaras-card-close { color: var(--selaras-resolved-text-muted); }
.selaras-card-text { margin-top: .5rem; font-size: .8125rem; line-height: 1.45; color: var(--selaras-resolved-text-default); }
.selaras-card-link { display: inline-flex; align-items: center; gap: .25rem; margin-top: .625rem; border-radius: var(--selaras-resolved-radius-sm); font-size: .75rem; color: var(--selaras-resolved-text-muted); }
.selaras-card-link:hover { color: var(--selaras-resolved-text-default); text-decoration: underline; text-underline-offset: 3px; }
</style>
