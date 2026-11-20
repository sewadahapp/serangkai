<template>
  <div class="app-frame serangkai-canvas-pattern" :class="{ 'app-frame-signed-in': appShell }">
    <a class="serangkai-skip" href="#main">Skip to content</a>

    <!-- Signed-in shell: a resizable, collapsible sidebar (Selaras dashboard
         composite). Below 1024px it becomes a left drawer that holds both the
         sections and, on the workspace, the folder tree. The page itself keeps
         scrolling on the window so sticky headers inside pages still work. -->
    <SDashboardGroup
      v-if="appShell"
      auto-save-id="serangkai-sidebar"
      :mobile-breakpoint="SIDEBAR_BREAKPOINT"
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
            <!-- Names the mobile drawer for screen readers (and Reka's
                 required title); the inline desktop sidebar is named by its
                 complementary landmark instead. -->
            <DrawerTitle v-if="isNarrow" class="sr-only">Navigation</DrawerTitle>
            <STooltip v-if="isCollapsed" text="Serangkai" :content="{ side: 'right' }">
              <NuxtLink to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span></NuxtLink>
            </STooltip>
            <NuxtLink v-else to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span>Serangkai</NuxtLink>
            <!-- The mobile drawer has its own close button. -->
            <STooltip v-if="!isNarrow" :text="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'" :content="{ side: 'right' }">
              <SDashboardSidebarToggle :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'" class="app-sidebar-toggle" />
            </STooltip>
          </div>
        </template>

        <template #default="{ isCollapsed }">
          <SNavigationMenu
            :items="navigationItems"
            orientation="vertical"
            color="neutral"
            :collapsed="isCollapsed"
            tooltip
            aria-label="Workspace sections"
          />
          <div v-if="isWorkspace && folderPanel && !isCollapsed" class="app-sidebar-folders">
            <p class="app-sidebar-label">FOLDERS</p>
            <component :is="folderPanel" />
          </div>
        </template>

        <template #footer="{ isCollapsed }">
          <!-- Common dashboard footer: a small promo card, then the account
               row whose menu holds account actions (Log out included). -->
          <div class="app-sidebar-foot">
            <SerangkaiSelarasCredit v-if="!isCollapsed" />
            <div class="app-account" :class="{ 'app-account-collapsed': isCollapsed }">
              <SDropdown :items="accountMenu" :positioning="isCollapsed ? { side: 'right', align: 'end', sideOffset: 8 } : { side: 'top', align: 'start', sideOffset: 6 }" :ui="{ content: isCollapsed ? undefined : 'min-w-[var(--reka-dropdown-menu-trigger-width)]' }">
                <button type="button" class="app-account-trigger" :aria-label="`Account menu for ${user?.username || 'account'}`">
                  <SAvatar :text="accountInitial" color="primary" size="md" class="app-account-avatar" aria-hidden="true" />
                  <template v-if="!isCollapsed">
                    <span class="app-account-text">
                      <span class="app-account-name">{{ user?.username }}</span>
                      <span class="app-account-role">Workspace owner</span>
                    </span>
                    <SIcon name="lucide:chevrons-up-down" class="app-account-chevron" aria-hidden="true" />
                  </template>
                </button>
              </SDropdown>
            </div>
          </div>
        </template>
      </SDashboardSidebar>

      <SDashboardResizeHandle class="app-resize-handle" />

      <SDashboardPanel :ui="{ root: 'app-panel' }">
        <header class="app-topbar app-topbar-private">
          <NuxtLink to="/" class="app-brand" aria-label="Serangkai home"><span class="app-logo">S</span>Serangkai</NuxtLink>
          <SDashboardSidebarToggle v-slot="{ toggle }">
            <SButton variant="ghost" color="neutral" icon="lucide:menu" aria-label="Open navigation" @click="toggle()" />
          </SDashboardSidebarToggle>
        </header>
        <main id="main" class="app-main" :class="mainClass"><slot /></main>
      </SDashboardPanel>

      <SDashboardSidebarToggle v-slot="{ toggle, isCollapsed }">
        <SerangkaiDrawerAutoClose :toggle="toggle" :open="isNarrow && !isCollapsed" />
      </SDashboardSidebarToggle>
    </SDashboardGroup>

    <template v-else>
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
import { DrawerTitle } from 'reka-ui'

// Keep in step with the CSS guard below and the `lg` breakpoint pages use.
const SIDEBAR_BREAKPOINT = 1024

const { loggedIn, user, ready, clear } = useUserSession()
const route = useRoute()
const folderPanel = useWorkspaceSidebar()
const appShell = computed(() => loggedIn.value && !route.path.startsWith('/share/'))
const isWorkspace = computed(() => route.path === '/' || route.path === '/workspace')
const mainClass = computed(() => ({
  'app-main-login': route.path === '/auth/login',
  'app-main-document': route.path.startsWith('/rangka/') || route.path === '/workspace/new',
}))
const workspaceLinks = [
  { to: '/', label: 'Workspace', icon: 'lucide:layers' },
  { to: '/agent', label: 'Agents', icon: 'lucide:bot' },
  { to: '/settings', label: 'Settings', icon: 'lucide:settings' },
]
const navigationItems = computed(() => workspaceLinks.map(link => ({ ...link, active: link.to === '/' ? isWorkspace.value : route.path.startsWith(link.to) })))
const accountInitial = computed(() => Array.from(user.value?.username?.trim() || '?')[0]?.toLocaleUpperCase() || '?')
const logout = async () => { await clear(); await navigateTo('/auth/login') }
// Settings is a main sidebar section, so it isn't repeated here.
const accountMenu = [
  [{ label: 'Log out', icon: 'lucide:log-out', destructive: true, onSelect: () => { void logout() } }],
]

// Mirrors DashboardGroup's own breakpoint so the drawer can close itself
// after navigation without ever collapsing the desktop sidebar.
const isNarrow = ref(false)
let narrowQuery: MediaQueryList | undefined
const updateNarrow = () => { isNarrow.value = narrowQuery?.matches ?? false }
onMounted(() => {
  narrowQuery = window.matchMedia(`(max-width: ${SIDEBAR_BREAKPOINT - 1}px)`)
  updateNarrow()
  narrowQuery.addEventListener('change', updateNarrow)
})
onBeforeUnmount(() => narrowQuery?.removeEventListener('change', updateNarrow))
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
.app-frame :deep(.app-sidebar-header) { padding: 1rem .75rem .75rem; }
.app-frame :deep(.app-sidebar-body) { padding: .25rem .75rem .75rem; }
.app-frame :deep(.app-sidebar-footer) { padding: 0 .75rem .75rem; border-top: 0; }

.app-sidebar-head { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .5rem; padding-left: .25rem; }
.app-sidebar-head-collapsed { flex-direction: column; justify-content: flex-start; gap: .5rem; padding-left: 0; }
.app-brand { display: flex; align-items: center; gap: .6rem; min-width: 0; font-size: .95rem; font-weight: 700; letter-spacing: -.025em; white-space: nowrap; }
.app-logo { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; flex-shrink: 0; border-radius: .5rem; background: var(--selaras-resolved-color-primary-fill); color: var(--selaras-resolved-color-primary-on-fill); font-size: .85rem; }
.app-sidebar-toggle { flex-shrink: 0; color: var(--selaras-resolved-text-muted); }

.app-sidebar-folders { margin-top: 1.5rem; }
.app-sidebar-label { margin: 0 .625rem .75rem; font-size: .6rem; font-weight: 700; letter-spacing: .12em; color: var(--selaras-resolved-text-muted); }
.app-sidebar-foot { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: .75rem; }
.app-account { padding-top: .75rem; border-top: 1px solid var(--selaras-resolved-border-muted); }
.app-account-trigger { display: flex; width: 100%; min-width: 0; align-items: center; gap: .625rem; padding: .375rem; border-radius: var(--selaras-resolved-radius-md); text-align: left; transition: background-color 100ms; }
.app-account-trigger:hover, .app-account-trigger[data-state='open'] { background: var(--selaras-resolved-color-neutral-subtle); }
.app-account-trigger:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
.app-account-avatar { flex-shrink: 0; border-radius: var(--selaras-resolved-radius-md); }
.app-account-text { display: flex; min-width: 0; flex: 1; flex-direction: column; line-height: 1.25; }
.app-account-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .875rem; font-weight: 600; }
.app-account-role { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .75rem; color: var(--selaras-resolved-text-muted); }
.app-account-chevron { width: 1rem; height: 1rem; flex-shrink: 0; color: var(--selaras-resolved-text-muted); }
.app-account-collapsed .app-account-trigger { justify-content: center; padding: .25rem; }

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
/* Server rendering cannot know the viewport, so DashboardGroup first renders
   the desktop split and swaps to the drawer after mount. Hide the inline
   sidebar on narrow screens so phones never flash a 256px column. */
@media (max-width: 1023px) {
  .app-frame :deep(.app-sidebar), .app-frame :deep(.app-resize-handle) { display: none; }
}
.app-main.app-main-document, .app-frame-signed-in .app-main.app-main-document { max-width: none; padding: 0; }
</style>
