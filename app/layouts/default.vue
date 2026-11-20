<template>
  <div class="app-frame serangkai-canvas-pattern" :class="{ 'app-frame-signed-in': appShell }">
    <a class="serangkai-skip" href="#main">Skip to content</a>

    <!-- Signed-in shell: a resizable, collapsible sidebar (Selaras dashboard
         composite). The group stays in its desktop mode at every width: its
         mobile mode swaps the page into a different parent and remounts it,
         which would close dialogs and drop unsaved drafts when a window is
         resized across the breakpoint. Below 1024px the sidebar is hidden and
         the drawer underneath takes over. The page keeps scrolling on the
         window so sticky headers inside pages still work. -->
    <SDashboardGroup
      v-if="appShell"
      auto-save-id="serangkai-sidebar"
      :mobile-breakpoint="1"
      :ui="{ root: 'app-dashboard' }"
    >
      <SDashboardSidebar
        role="complementary"
        aria-label="Workspace sidebar"
        :default-size="256"
        :min-size="220"
        :max-size="420"
        :collapsed-size="64"
        :ui="{ root: 'app-sidebar', header: 'app-sidebar-header', body: 'app-sidebar-body', footer: 'app-sidebar-footer' }"
      >
        <template #header="{ isCollapsed }">
          <div class="app-sidebar-head" :class="{ 'app-sidebar-head-collapsed': isCollapsed }">
            <STooltip v-if="isCollapsed" text="Serangkai" :content="{ side: 'right' }">
              <NuxtLink to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span></NuxtLink>
            </STooltip>
            <NuxtLink v-else to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span>Serangkai</NuxtLink>
          </div>
        </template>
        <template #default="{ isCollapsed }">
          <SerangkaiSidebarNav :collapsed="isCollapsed" @search="openPalette" />
        </template>
        <template #footer="{ isCollapsed }">
          <SerangkaiSidebarAccount :collapsed="isCollapsed" />
        </template>
      </SDashboardSidebar>

      <SDashboardResizeHandle class="app-resize-handle" />

      <SDashboardPanel :ui="{ root: 'app-panel' }">
        <!-- Collapse/expand sits on the divider, outside the sidebar, at the
             logo's height; it stays put in both states (only the arrow flips).
             Desktop only. -->
        <div class="app-sidebar-edge">
          <SDashboardSidebarToggle v-slot="{ toggle, isCollapsed }">
            <STooltip :text="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'" :content="{ side: 'right' }">
              <button type="button" class="app-sidebar-edge-button" :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'" :aria-expanded="!isCollapsed" @click="toggle()">
                <SIcon :name="isCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-left'" class="size-3.5" aria-hidden="true" />
              </button>
            </STooltip>
          </SDashboardSidebarToggle>
        </div>
        <header class="app-topbar app-topbar-private">
          <NuxtLink to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span>Serangkai</NuxtLink>
          <div class="flex items-center gap-1">
            <SButton variant="ghost" color="neutral" icon="lucide:search" aria-label="Search" @click="openPalette" />
            <SButton variant="ghost" color="neutral" icon="lucide:menu" aria-label="Open navigation" @click="navDrawer = true" />
          </div>
        </header>
        <main id="main" class="app-main" :class="mainClass"><slot /></main>
      </SDashboardPanel>

      <SerangkaiCommandPalette />
    </SDashboardGroup>

    <!-- Mobile navigation (below 1024px): the same sidebar contents in a left
         drawer, opened from the top bar or the workspace's Browse folders. -->
    <SSlideover v-if="appShell" v-model:open="navDrawer" side="left" title="Navigation">
      <template #body><SerangkaiSidebarNav @search="openPalette" /></template>
      <template #footer><SerangkaiSidebarAccount /></template>
    </SSlideover>

    <template v-if="!appShell">
      <header class="app-topbar">
        <NuxtLink to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span>Serangkai</NuxtLink>
        <div class="flex min-w-0 items-center gap-1.5">
          <SSkeleton v-if="!ready" class="h-8 w-24" />
          <SButton v-else-if="route.path !== '/auth/login'" to="/auth/login" size="sm">Log in</SButton>
        </div>
      </header>
      <main id="main" class="app-main" :class="mainClass"><slot /></main>
      <footer class="app-public-footer">Serangkai · Private by default</footer>
    </template>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, ready } = useUserSession()
const route = useRoute()
const appShell = computed(() => loggedIn.value && !route.path.startsWith('/share/'))
const mainClass = computed(() => ({
  'app-main-login': route.path === '/auth/login',
  'app-main-document': route.path.startsWith('/rangka/') || route.path === '/workspace/new',
}))

// Mobile drawer: closes after any navigation (including choosing a folder,
// which only changes the query) so the user lands on what they picked.
const navDrawer = useNavDrawer()
watch(() => route.fullPath, () => { navDrawer.value = false })

// Command palette (also bound to Cmd/Ctrl+K by Selaras). Close the drawer
// first so the two overlays don't stack.
const palette = useCommandPalette()
const openPalette = () => {
  navDrawer.value = false
  palette.open()
}

// Storage meter: load once the shell is up, and refresh on navigation so it
// reflects rangka created or deleted on other pages.
const storage = useStorageStatus()
onMounted(() => { if (appShell.value) void storage.refresh() })
watch(() => route.path, () => { if (appShell.value) void storage.refresh() })
</script>

<style scoped>
.app-frame { min-height: 100dvh; background-color: var(--selaras-resolved-surface-canvas); color: var(--selaras-resolved-text-default); }

/* The composite defaults to a fixed-height app shell with internal scrolling.
   Keep window scrolling instead: the group grows with the page and only the
   sidebar sticks to the viewport. */
/* Reka's SplitterGroup sets height/overflow inline, hence !important. */
.app-frame :deep(.app-dashboard) { height: auto !important; min-height: 100dvh; overflow: visible !important; }
.app-frame :deep(.app-sidebar) { position: sticky; top: 0; align-self: flex-start; height: 100dvh; }
.app-frame :deep(.app-panel) { min-width: 0; overflow: visible !important; }
/* The sidebar's own scroll stops at its edges instead of moving the page. */
.app-frame :deep(.app-sidebar [data-reka-scroll-area-viewport]) { overscroll-behavior: contain; }
.app-frame :deep(.app-sidebar-header) { padding: 1rem .75rem .75rem; }
.app-frame :deep(.app-sidebar-body) { padding: .25rem .75rem .75rem; }
.app-frame :deep(.app-sidebar-footer) { padding: 0 .75rem .75rem; border-top: 0; }

.app-sidebar-head { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .5rem; padding-left: .25rem; }
.app-sidebar-head-collapsed { justify-content: center; padding-left: 0; }
.app-brand { display: flex; align-items: center; gap: .6rem; min-width: 0; font-size: .95rem; font-weight: 700; letter-spacing: -.025em; white-space: nowrap; }
.app-logo { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; flex-shrink: 0; border-radius: .5rem; background: var(--selaras-resolved-color-primary-fill); color: var(--selaras-resolved-color-primary-on-fill); font-size: .85rem; }
.app-sidebar-edge { display: none; }
.app-sidebar-edge-button { position: absolute; top: 0; left: 0; display: grid; width: 1.5rem; height: 1.5rem; place-items: center; transform: translateX(-50%); border: 1px solid var(--selaras-resolved-border-default); border-radius: 9999px; background: var(--selaras-resolved-surface-default); color: var(--selaras-resolved-text-muted); box-shadow: 0 1px 2px rgb(0 0 0 / .08); transition: color 100ms, border-color 100ms; }
.app-sidebar-edge-button:hover { border-color: var(--selaras-resolved-border-hover); color: var(--selaras-resolved-text-default); }
.app-sidebar-edge-button:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
@media (min-width: 1024px) {
  /* Zero-height sticky strip at the panel's left edge (the divider), centred
     on the logo: header padding 1rem + half the 1.75rem logo - half the
     1.5rem button. Above the resize handle so it stays clickable. */
  .app-sidebar-edge { position: sticky; top: 1.125rem; z-index: 25; display: block; height: 0; }
}


.app-topbar { position: sticky; top: 0; z-index: 20; display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .5rem; height: 4rem; padding-inline: 1rem; background: var(--selaras-resolved-surface-canvas); border-bottom: 1px solid var(--selaras-resolved-border-muted); }
.app-main { width: 100%; max-width: 88rem; min-width: 0; margin-inline: auto; padding: 2rem 1rem 4rem; }
/* Every signed-in section (Workspace, Agents, Settings) shares one centred
   column: 64rem of content plus the 2.5rem side padding, so both edges stay
   put when switching sections. Full-bleed document views opt out below. */
.app-frame-signed-in .app-main { max-width: 69rem; }
.app-main-login { padding-top: clamp(3rem, 12vh, 8rem); }
.app-public-footer { padding: 1.5rem; text-align: center; font-size: .75rem; color: var(--selaras-resolved-text-muted); }
@media (min-width: 768px) { .app-main { padding-inline: 2.5rem; } }
@media (min-width: 1024px) {
  .app-topbar-private { display: none; }
  .app-frame-signed-in .app-main { padding-top: 2.5rem; }
}
/* Below 1024px the inline sidebar and its handle are hidden (pure CSS, so
   nothing remounts and phones never flash a 256px column); the drawer is the
   navigation there. */
@media (max-width: 1023px) {
  .app-frame :deep(.app-sidebar), .app-frame :deep(.app-resize-handle) { display: none; }
}
.app-main.app-main-document, .app-frame-signed-in .app-main.app-main-document { max-width: none; padding: 0; }
</style>
