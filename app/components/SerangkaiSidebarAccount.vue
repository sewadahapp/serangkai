<template>
  <!-- Sidebar footer, shared by the desktop sidebar and the mobile drawer:
       the storage meter, then the account row whose menu holds Log out. -->
  <div class="app-sidebar-foot">
    <SerangkaiStorageMeter :collapsed="collapsed" />
    <div class="app-account" :class="{ 'app-account-collapsed': collapsed }">
      <SDropdown :items="accountMenu" :positioning="collapsed ? { side: 'right', align: 'end', sideOffset: 8 } : { side: 'top', align: 'start', sideOffset: 6 }" :ui="{ content: collapsed ? undefined : 'min-w-[var(--reka-dropdown-menu-trigger-width)]' }">
        <button type="button" class="app-account-trigger" :aria-label="`Account menu for ${user?.username || 'account'}`">
          <SAvatar :text="accountInitial" color="primary" size="md" class="app-account-avatar" aria-hidden="true" />
          <template v-if="!collapsed">
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

<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()

const { user, clear } = useUserSession()
const accountInitial = computed(() => Array.from(user.value?.username?.trim() || '?')[0]?.toLocaleUpperCase() || '?')
const logout = async () => { await clear(); await navigateTo('/auth/login') }
// Settings is a main sidebar section, so it isn't repeated here.
const accountMenu = [
  [{ label: 'Log out', icon: 'lucide:log-out', destructive: true, onSelect: () => { void logout() } }],
]
</script>

<style scoped>
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
</style>
