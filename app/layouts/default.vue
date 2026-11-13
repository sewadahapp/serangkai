<template>
  <div class="app-frame serangkai-canvas-pattern" :class="{ 'app-frame-signed-in': appShell }">
    <a class="serangkai-skip" href="#main">Skip to content</a>
    <aside v-if="appShell" class="app-sidebar hidden lg:flex" aria-label="Workspace sidebar">
      <NuxtLink to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span>Serangkai</NuxtLink>
      <SNavigationMenu :items="navigationItems" orientation="vertical" color="neutral" aria-label="Workspace sections" />
      <div v-if="isWorkspace" class="app-sidebar-folders"><p class="app-sidebar-label">FOLDERS</p><div id="workspace-folder-navigation" /></div>
      <div class="app-sidebar-bottom">
        <div class="app-account-label"><SAvatar :text="accountInitial" color="neutral" size="md" aria-hidden="true" /><span class="truncate">{{ user?.username }}</span></div>
        <STooltip text="Log out"><SButton variant="ghost" color="neutral" icon="lucide:log-out" aria-label="Log out" @click="logout" /></STooltip>
      </div>
    </aside>
    <header class="app-topbar" :class="{ 'app-topbar-private': appShell }">
      <NuxtLink to="/" class="app-brand" :class="{ 'lg:hidden': appShell }" aria-label="Serangkai home"><span class="app-logo">S</span>Serangkai</NuxtLink>
      <div class="flex min-w-0 items-center gap-1.5" :class="{ 'lg:hidden': appShell }">
        <template v-if="!ready"><SSkeleton class="h-8 w-24" /></template>
        <SSlideover v-else-if="loggedIn" v-model:open="mobileMenuOpen" side="right" title="Navigation" :description="user?.username ? `Signed in as ${user.username}` : undefined">
          <SerangkaiAccountButton :username="user?.username" />
          <template #body><SNavigationMenu :items="navigationItems" orientation="vertical" color="neutral" aria-label="Workspace sections" /></template>
          <template #footer><SButton variant="ghost" icon="lucide:log-out" @click="logout">Log out</SButton></template>
        </SSlideover>
        <SButton v-else-if="route.path !== '/auth/login'" to="/auth/login" size="sm">Log in</SButton>
      </div>
    </header>
    <main id="main" class="app-main" :class="{ 'app-main-login': route.path === '/auth/login', 'app-main-document': route.path.startsWith('/rangka/') }"><slot /></main>
    <footer v-if="!appShell" class="app-public-footer">Serangkai · Private by default</footer>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, user, ready, clear } = useUserSession()
const route = useRoute()
const mobileMenuOpen = ref(false)
const appShell = computed(() => loggedIn.value && !route.path.startsWith('/share/'))
const isWorkspace = computed(() => route.path === '/' || route.path === '/workspace')
const workspaceLinks = [
  { to: '/', label: 'Workspace', icon: 'lucide:layers' },
  { to: '/agent', label: 'Agents', icon: 'lucide:bot' },
  { to: '/settings', label: 'Settings', icon: 'lucide:settings' },
]
const navigationItems = computed(() => workspaceLinks.map(link => ({ ...link, active: link.to === '/' ? isWorkspace.value : route.path.startsWith(link.to), onSelect: () => { mobileMenuOpen.value = false } })))
const accountInitial = computed(() => Array.from(user.value?.username?.trim() || '?')[0]?.toLocaleUpperCase() || '?')
const logout = async () => { mobileMenuOpen.value = false; await clear(); await navigateTo('/auth/login') }
</script>

<style scoped>
.app-frame { min-height: 100dvh; background-color: var(--selaras-resolved-surface-canvas); color: var(--selaras-resolved-text-default); }
.app-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 30; width: 16rem; flex-direction: column; padding: 1.25rem .75rem .75rem; background: var(--selaras-resolved-surface-elevated); border-right: 1px solid var(--selaras-resolved-border-muted); }
.app-brand { display: flex; align-items: center; gap: .6rem; min-width: 0; font-size: .95rem; font-weight: 700; letter-spacing: -.025em; }
.app-sidebar > .app-brand { margin: .25rem .6rem 2rem; }
.app-logo { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; flex-shrink: 0; border-radius: .5rem; background: var(--selaras-resolved-color-primary-fill); color: var(--selaras-resolved-color-primary-on-fill); font-size: .85rem; }
.app-sidebar-folders { flex: 1; min-height: 0; overflow-y: auto; margin-top: 2rem; padding-inline: .25rem; }.app-sidebar-label { margin: 0 .5rem .75rem; font-size: .6rem; font-weight: 700; letter-spacing: .12em; color: var(--selaras-resolved-text-muted); }.app-sidebar-bottom { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-top: auto; padding-top: 1rem; }
.app-account-label { display: flex; min-width: 0; align-items: center; gap: .5rem; padding-left: .25rem; font-size: .875rem; font-weight: 600; }
.app-topbar { position: sticky; top: 0; z-index: 20; display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .5rem; height: 4rem; padding-inline: 1rem; background: var(--selaras-resolved-surface-canvas); border-bottom: 1px solid var(--selaras-resolved-border-muted); }
.app-main { width: 100%; max-width: 88rem; min-width: 0; margin-inline: auto; padding: 2rem 1rem 4rem; }.app-main-login { padding-top: clamp(3rem, 12vh, 8rem); }.app-public-footer { padding: 1.5rem; text-align: center; font-size: .75rem; color: var(--selaras-resolved-text-muted); }
@media (min-width: 768px) { .app-main { padding-inline: 2.5rem; } }
@media (min-width: 1024px) { .app-frame-signed-in { padding-left: 16rem; }.app-topbar-private { display: none; }.app-frame-signed-in .app-main { padding-top: 2.5rem; }.app-topbar-private > .app-brand { display: none; } }
.app-main.app-main-document, .app-frame-signed-in .app-main.app-main-document { max-width: none; padding: 0; }
</style>
