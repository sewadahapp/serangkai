<template>
  <div class="flex min-h-dvh flex-col bg-[var(--selaras-resolved-surface-canvas)] text-[var(--selaras-resolved-text-default)]">
    <a class="serangkai-skip" href="#main">Skip to content</a>

    <header class="sticky top-0 z-30 border-b border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-canvas)]/85 backdrop-blur-md">
      <div class="serangkai-shell flex h-16 items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-6">
          <NuxtLink to="/" class="flex items-center gap-2 rounded-md focus-visible:outline-offset-4" aria-label="Serangkai home">
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--selaras-resolved-color-primary-fill)] text-sm font-bold text-[var(--selaras-resolved-color-primary-on-fill)]">S</span>
            <span class="truncate text-base font-semibold tracking-tight">Serangkai</span>
          </NuxtLink>

          <div v-if="loggedIn" class="hidden lg:block">
            <SNavigationMenu :items="workspaceLinks" variant="link" />
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <SColorModeToggle />

          <template v-if="!ready">
            <span class="h-8 w-24 animate-pulse rounded-md bg-[var(--selaras-resolved-surface-elevated)]" aria-hidden="true" />
          </template>

          <template v-else-if="!loggedIn">
            <SButton to="/agent" variant="ghost" size="sm" icon="lucide:bot" class="hidden sm:inline-flex">Agents</SButton>
            <SButton to="/auth/login" size="sm">Log in</SButton>
          </template>

          <template v-else>
            <SDropdown :items="accountItems">
              <template #default>
                <SButton variant="ghost" size="sm" icon="lucide:user-round" aria-haspopup="menu" class="gap-1.5">
                  <span class="hidden max-w-40 truncate sm:inline">{{ user?.username }}</span>
                  <span class="sm:hidden">Menu</span>
                </SButton>
              </template>
            </SDropdown>
          </template>
        </div>
      </div>

      <nav v-if="loggedIn" aria-label="Workspace sections" class="border-t border-[var(--selaras-resolved-border-muted)] lg:hidden">
        <div class="serangkai-shell flex gap-1 overflow-x-auto py-1.5">
          <NuxtLink
            v-for="link in workspaceLinks"
            :key="link.to"
            :to="link.to"
            class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--selaras-resolved-text-muted)] hover:bg-[var(--selaras-resolved-surface-elevated)]"
            active-class="!text-[var(--selaras-resolved-text-default)] !bg-[var(--selaras-resolved-surface-elevated)]"
          >
            <SIcon :name="link.icon" class="size-4 shrink-0" aria-hidden="true" />
            {{ link.label }}
          </NuxtLink>
        </div>
      </nav>
    </header>

    <main id="main" class="flex-1 py-8 md:py-10">
      <div class="serangkai-shell">
        <slot />
      </div>
    </main>

    <footer class="border-t border-[var(--selaras-resolved-border-muted)] py-6">
      <div class="serangkai-shell flex flex-col gap-2 text-sm text-[var(--selaras-resolved-text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>Serangkai — artifact and knowledge workspace.</p>
        <p>Private by default.</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, user, ready, clear } = useUserSession()

const workspaceLinks = [
  { to: '/dashboard', label: 'Overview', icon: 'lucide:layout-dashboard' },
  { to: '/workspace', label: 'Workspace', icon: 'lucide:folder-tree' },
  { to: '/agent', label: 'Agents', icon: 'lucide:bot' },
  { to: '/settings', label: 'Settings', icon: 'lucide:settings' },
]

const accountItems = computed(() => [
  workspaceLinks.map(link => ({ label: link.label, to: link.to, icon: link.icon })),
  [{ label: 'Log out', icon: 'lucide:log-out', onSelect: logout }],
])

const logout = async () => {
  await clear()
  await navigateTo('/')
}
</script>
