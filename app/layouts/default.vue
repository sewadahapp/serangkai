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

          <nav v-if="user" aria-label="Workspace" class="hidden items-center gap-1 lg:flex">
            <NuxtLink
              v-for="link in workspaceLinks"
              :key="link.to"
              :to="link.to"
              class="rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--selaras-resolved-text-muted)] transition-colors hover:bg-[var(--selaras-resolved-surface-elevated)] hover:text-[var(--selaras-resolved-text-default)]"
              active-class="!text-[var(--selaras-resolved-text-default)] !bg-[var(--selaras-resolved-surface-elevated)]"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-1.5">
          <SColorModeToggle />

          <template v-if="!user">
            <SButton to="/agent" variant="ghost" size="sm" class="hidden sm:inline-flex">Agents</SButton>
            <SButton to="/auth/login" variant="ghost" size="sm">Login</SButton>
            <SButton to="/auth/register" size="sm">Register</SButton>
          </template>

          <template v-else>
            <SDropdown :items="accountItems">
              <template #default>
                <SButton variant="ghost" size="sm" aria-haspopup="menu" class="gap-1.5">
                  <span class="hidden max-w-40 truncate sm:inline">{{ user.email }}</span>
                  <span class="sm:hidden">Menu</span>
                </SButton>
              </template>
            </SDropdown>
          </template>
        </div>
      </div>

      <nav v-if="user" aria-label="Workspace sections" class="border-t border-[var(--selaras-resolved-border-muted)] lg:hidden">
        <div class="serangkai-shell flex gap-1 overflow-x-auto py-1.5">
          <NuxtLink
            v-for="link in workspaceLinks"
            :key="link.to"
            :to="link.to"
            class="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--selaras-resolved-text-muted)] hover:bg-[var(--selaras-resolved-surface-elevated)]"
            active-class="!text-[var(--selaras-resolved-text-default)] !bg-[var(--selaras-resolved-surface-elevated)]"
          >
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
const user = useState<any>('user')

const workspaceLinks = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/workspace', label: 'Workspace' },
  { to: '/agent', label: 'Agents' },
  { to: '/settings', label: 'Settings' },
]

const accountItems = computed(() => [
  workspaceLinks.map(link => ({ label: link.label, to: link.to })),
  [{ label: 'Log out', onSelect: logout }],
])

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  await navigateTo('/')
}
</script>
