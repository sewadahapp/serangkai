<template>
  <div class="settings-page">
    <SerangkaiPageHeader title="Settings" description="Appearance, connected agents, and API tokens." class="!mb-0" />

    <!-- One page of section cards (no tabs): each card has a title and
         description, an optional action on the right, then its content. -->
    <section id="appearance" class="serangkai-card settings-card" aria-labelledby="appearance-title">
      <header class="serangkai-card-head">
        <div class="min-w-0">
          <h2 id="appearance-title" class="settings-section-title">Appearance</h2>
          <p class="settings-description">Saved for this browser.</p>
        </div>
      </header>
      <div class="settings-card-body">
        <div class="settings-row">
          <div class="min-w-0">
            <h3 class="settings-row-title">Color mode</h3>
            <p class="settings-description">Light, dark, or follow your system.</p>
          </div>
          <ClientOnly>
            <SToggleGroup :model-value="colorModePreference" :items="colorModeOptions" color="neutral" size="sm" aria-label="Color mode" @update:model-value="setColorMode">
              <template #item="{ item }"><SIcon :name="item.icon!" class="size-4" aria-hidden="true" /><span>{{ item.label }}</span></template>
            </SToggleGroup>
            <template #fallback><SSkeleton class="h-8 w-56 rounded-md" /></template>
          </ClientOnly>
        </div>
        <div class="settings-row settings-row-stacked">
          <div class="min-w-0">
            <h3 class="settings-row-title">Color theme</h3>
            <p class="settings-description">Each theme has a light and a dark palette.</p>
          </div>
          <SRadioGroup :model-value="theme" variant="card" :items="themeOptions" :ui="{ root: 'grid grid-cols-1 gap-3 sm:grid-cols-2', label: 'min-w-0 flex-1' }" aria-label="Color theme" @update:model-value="setTheme">
            <template #label="{ item }">
              <span class="settings-theme-card">
                <span class="settings-theme-previews" aria-hidden="true">
                  <span v-for="mode in ['light', 'dark']" :key="mode" class="settings-theme-preview" :style="{ backgroundColor: themePreview(item.value, mode).surface }">
                    <span class="settings-theme-rail" :style="{ backgroundColor: themePreview(item.value, mode).primary }" />
                    <span class="settings-theme-bar" :style="{ backgroundColor: themePreview(item.value, mode).primary }" />
                    <span class="settings-theme-line" :style="{ backgroundColor: themePreview(item.value, mode).primary }" />
                    <span class="settings-theme-dot" :style="{ backgroundColor: themePreview(item.value, mode).accent }" />
                  </span>
                </span>
                <span class="block text-sm font-medium">{{ item.label }}</span>
                <span class="settings-theme-description">{{ item.description }}</span>
              </span>
            </template>
          </SRadioGroup>
        </div>
      </div>
    </section>

    <section id="storage" class="serangkai-card settings-card" aria-labelledby="storage-title">
      <header class="serangkai-card-head">
        <div class="min-w-0">
          <h2 id="storage-title" class="settings-section-title">Storage</h2>
          <p class="settings-description">How much space your rangka use, and what happens at your limit.</p>
        </div>
      </header>
      <div class="settings-card-body">
        <div class="settings-row settings-row-stacked">
          <div v-if="storageMeterView" class="settings-storage-meter">
            <div class="settings-storage-numbers">
              <span class="settings-row-title">{{ storageMeterView.summary }}</span>
              <span class="settings-description" :class="{ 'settings-storage-warning': storageMeterView.color === 'warning', 'settings-storage-danger': storageMeterView.color === 'danger' }">{{ storageMeterView.remaining }}</span>
            </div>
            <SProgress v-if="storageMeterView.percent !== null" :model-value="storageMeterView.percent" :color="storageMeterView.color" aria-label="Storage used" />
            <p class="settings-metadata">
              <span v-if="storage?.measuring">Measuring older files…</span>
              <span v-if="storage?.operatorLimitBytes">Server cap {{ formatByteSize(storage.operatorLimitBytes) }}</span>
              <span v-if="storage?.disk">Disk {{ formatByteSize(storage.disk.freeBytes) }} free of {{ formatByteSize(storage.disk.totalBytes) }}</span>
              <span v-if="!storage?.disk && !storage?.limitBytes">Object storage reports no capacity; set a limit to track it.</span>
            </p>
          </div>
          <SSkeleton v-else class="h-14 w-full rounded-md" />
        </div>

        <form id="storage-form" class="contents" @submit.prevent="saveStorage">
          <div class="settings-row">
            <div class="min-w-0">
              <h3 id="storage-limit-label" class="settings-row-title">Storage limit</h3>
              <p class="settings-description">{{ storage?.operatorLimitBytes ? `Up to ${formatByteSize(storage.operatorLimitBytes)} on this server. ` : '' }}Leave empty for no limit.</p>
            </div>
            <div class="settings-storage-limit" role="group" aria-labelledby="storage-limit-label">
              <SInput v-model="limitAmount" inputmode="decimal" placeholder="No limit" aria-label="Limit amount" class="w-28" :invalid="!!limitProblem" />
              <SSelect v-model="limitUnit" :items="limitUnits" aria-label="Limit unit" class="w-24" />
            </div>
          </div>
          <div class="settings-row settings-row-stacked">
            <div class="min-w-0">
              <h3 class="settings-row-title">When the limit is reached</h3>
              <p class="settings-description">Block new writes if going over would cost you, for example on a plan that bills overuse.</p>
            </div>
            <SRadioGroup v-model="storageModeChoice" :items="storageModeOptions" aria-label="When the limit is reached" />
          </div>
          <div class="settings-row">
            <div class="min-w-0">
              <h3 id="keep-versions-label" class="settings-row-title">Version history</h3>
              <p class="settings-description">How many versions each rangka keeps. When a save goes past this, the oldest versions are deleted. History protects you from bad edits, so keep enough to recover.</p>
            </div>
            <SSelect v-model="keepVersionsChoice" :items="keepVersionsOptions" aria-labelledby="keep-versions-label" class="w-36" />
          </div>
        </form>
      </div>
      <div class="settings-card-foot settings-storage-foot">
        <SAlert v-if="limitProblem || storageError" color="danger" variant="subtle" :title="limitProblem || storageError" class="flex-1" />
        <SButton type="submit" form="storage-form" size="sm" :loading="savingStorage" :disabled="!storageDirty || !!limitProblem || savingStorage">Save storage settings</SButton>
      </div>
    </section>

    <section id="connected-agents" class="serangkai-card settings-card" aria-labelledby="connected-clients">
      <header class="serangkai-card-head">
        <div class="min-w-0">
          <div class="flex items-center gap-2"><h2 id="connected-clients" class="settings-section-title">Connected agents</h2><SBadge v-if="!loadingClients && !clientsError" :label="String(oauthClients.length)" color="neutral" variant="subtle" size="sm" /></div>
          <p class="settings-description">Agents you've approved through browser sign-in.</p>
        </div>
      </header>
      <div v-if="clientsError" class="settings-card-body"><SerangkaiErrorState title="Could not load connected agents" :description="clientsError" retry-label="Try again" @retry="loadClients" /></div>
      <div v-else-if="loadingClients" class="settings-loading" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Loading connected agents…</span><div v-for="index in 2" :key="index" class="settings-credential" aria-hidden="true"><div class="min-w-0 flex-1"><SSkeleton animation="shimmer" class="h-4 w-32" /><SSkeleton animation="shimmer" class="mt-2 h-3 w-56 max-w-full" /></div><SSkeleton animation="shimmer" class="h-8 w-8 rounded-md" /></div></div>
      <ul v-else-if="oauthClients.length" class="settings-credentials" aria-label="Connected agents">
        <li v-for="client in oauthClients" :key="client.id" class="settings-credential">
          <span class="settings-credential-icon" aria-hidden="true"><SIcon name="lucide:bot" class="size-4" /></span>
          <div class="min-w-0 flex-1"><p class="settings-credential-name">{{ client.name }}</p><p class="settings-metadata"><span v-for="scope in client.scopes" :key="scope" class="settings-scope" :class="{ 'settings-scope-full': scope === 'full' }">{{ scope }}</span><span>Connected {{ formatDate(client.connectedAt) }}</span><span>Access until {{ formatDate(client.refreshExpiresAt) }}</span></p></div>
          <STooltip text="Disconnect agent"><SButton variant="ghost" color="danger" size="sm" icon="lucide:unplug" :aria-label="`Disconnect ${client.name}`" :loading="disconnectingClientId === client.id" :disabled="!!disconnectingClientId" @click="disconnectClient(client)"><span class="hidden sm:inline">Disconnect</span></SButton></STooltip>
        </li>
      </ul>
      <div v-else class="settings-empty"><h3>No agents connected</h3><p>Connect a compatible MCP client with browser sign-in. Approved agents appear here.</p><SButton to="/agent" variant="outline" color="neutral" size="sm" icon="lucide:plug">Connection guide</SButton></div>
      <div v-if="clientMessage" class="settings-card-foot"><SAlert color="info" variant="subtle" :title="clientMessage" /></div>
    </section>

    <section id="api-tokens" class="serangkai-card settings-card" aria-labelledby="existing-tokens">
      <header class="serangkai-card-head">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2"><h2 id="existing-tokens" class="settings-section-title">API tokens</h2><SBadge v-if="!loadingTokens && !tokensError" :label="String(tokens.length)" color="neutral" variant="subtle" size="sm" /></div>
          <p class="settings-description">Scoped access for agents and scripts that use a bearer token.</p>
        </div>
        <SButton icon="lucide:plus" size="sm" :disabled="loadingTokens" @click="openTokenDialog">Create token</SButton>
      </header>
      <div v-if="tokensError" class="settings-card-body"><SerangkaiErrorState title="Could not load API tokens" :description="tokensError" retry-label="Try again" @retry="loadTokens" /></div>
      <div v-else-if="loadingTokens" class="settings-loading" role="status" aria-live="polite" aria-busy="true">
        <span class="sr-only">Loading API tokens…</span>
        <div v-for="index in 3" :key="index" class="settings-credential" aria-hidden="true"><div class="min-w-0 flex-1"><SSkeleton animation="shimmer" class="h-4 w-28" /><SSkeleton animation="shimmer" class="mt-2 h-3 w-56 max-w-full" /></div><SSkeleton animation="shimmer" class="h-8 w-8 rounded-md" /></div>
      </div>
      <ul v-else-if="tokens.length" class="settings-credentials" aria-label="API tokens">
        <li v-for="token in tokens" :key="token.id" class="settings-credential">
          <span class="settings-credential-icon" aria-hidden="true"><SIcon name="lucide:key-round" class="size-4" /></span>
          <div class="min-w-0 flex-1"><p class="settings-credential-name">{{ token.name }}</p><p class="settings-metadata"><span v-for="scope in token.scopes" :key="scope" class="settings-scope" :class="{ 'settings-scope-full': scope === 'full' }">{{ scope }}</span><span>Created {{ formatDate(token.createdAt) }}</span><span v-if="token.lastUsedAt">Last used {{ formatDate(token.lastUsedAt) }}</span><span v-if="token.expiresAt">Expires {{ formatDate(token.expiresAt) }}</span></p></div>
          <STooltip text="Revoke token"><SButton variant="ghost" color="danger" size="sm" icon="lucide:ban" :aria-label="`Revoke ${token.name}`" :loading="revokingTokenId === token.id" :disabled="!!revokingTokenId" @click="revokeToken(token)"><span class="hidden sm:inline">Revoke</span></SButton></STooltip>
        </li>
      </ul>
      <div v-else class="settings-empty"><h3>No tokens yet</h3><p>Create one when an agent or script can't use browser sign-in.</p></div>
      <div v-if="tokenMessage" class="settings-card-foot"><SAlert color="info" variant="subtle" :title="tokenMessage" /></div>
    </section>

    <SModal v-model:open="showTokenDialog" :title="newToken ? 'Token created' : 'Create token'" :description="newToken ? 'Copy this token now — it will not be shown again.' : 'Choose a name, permissions, and an optional expiry date.'" :dismissible="!creatingToken" :close="!creatingToken" :ui="{ content: 'max-w-xl' }">
      <template #body>
        <div v-if="newToken" class="space-y-4"><SFormField label="API token"><SInput :model-value="newToken" readonly aria-label="New API token" icon="lucide:key-round" class="w-full font-mono text-xs"><template #trailing="{ buttonSize }"><SerangkaiCopyButton :value="newToken" label="API token" :size="buttonSize" /></template></SInput></SFormField><p class="settings-description">Use this as the bearer token in your client configuration.</p></div>
        <form v-else id="create-token-form" class="space-y-5" @submit.prevent="createToken">
          <div class="grid gap-4 sm:grid-cols-2"><SFormField label="Name" required><SInput v-model="tokenName" placeholder="e.g. Local coding agent" required class="w-full" /></SFormField><SFormField v-slot="{ id }" label="Expires" hint="Optional; leave empty for no expiry."><SDatePicker :id="id" v-model="expiresAt" trigger-mode="button" class="w-full" /></SFormField></div>
          <fieldset><legend class="text-sm font-medium">Permissions</legend><p class="settings-description mt-1">Scopes combine. Full includes Read and Write, plus token management.</p><div class="mt-3 space-y-2"><SCheckbox v-for="scope in scopeOptions" :key="scope.value" :model-value="scopes.includes(scope.value)" :label="scope.label" :description="scope.hint" @update:model-value="checked => toggleScope(scope.value, checked)" /></div><SAlert class="mt-3" :color="scopes.includes('full') ? 'warning' : 'info'" variant="subtle" :title="scopeSummary" /></fieldset>
          <SAlert v-if="tokenCreateError" color="danger" variant="subtle" :title="tokenCreateError" />
        </form>
      </template>
      <template #footer><SButton v-if="newToken" color="neutral" @click="showTokenDialog = false">Done</SButton><template v-else><SButton variant="ghost" color="neutral" :disabled="creatingToken" @click="showTokenDialog = false">Cancel</SButton><SButton type="submit" form="create-token-form" icon="lucide:key-round" :loading="creatingToken" :disabled="creatingToken || !scopes.length">Create token</SButton></template></template>
    </SModal>
  </div>
</template>

<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone } from '@internationalized/date'
import { isThemeId, themes } from '#shared/themes'
import { formatByteSize, parseByteSize } from '#shared/byte-size'

useHead({ title: 'Settings' })

const route = useRoute()

// Settings used to be tabs; existing links (?tab=tokens, ?tab=agents from
// the Agents page and elsewhere) now scroll to the matching section card.
const sectionForTab: Record<string, string> = { appearance: 'appearance', storage: 'storage', tokens: 'api-tokens', agents: 'connected-agents' }
const scrollToRequestedSection = () => {
  const id = sectionForTab[String(route.query.tab || '')]
  if (id && id !== 'appearance') document.getElementById(id)?.scrollIntoView({ block: 'start' })
}
watch(() => route.query.tab, () => nextTick(scrollToRequestedSection))

// Light / Dark / System, stored by Nuxt color mode (same preference the
// Selaras toggles write).
const colorMode = useColorMode()
const colorModeOptions = [
  { label: 'Light', value: 'light', icon: 'lucide:sun' },
  { label: 'Dark', value: 'dark', icon: 'lucide:moon' },
  { label: 'System', value: 'system', icon: 'lucide:monitor' },
]
const colorModePreference = computed(() => colorMode.preference)
const setColorMode = (value: string | string[]) => {
  if (value === 'light' || value === 'dark' || value === 'system') colorMode.preference = value
}
const formatDate = (value: string) => new Date(value).toLocaleDateString()

// Storage: the meter plus the owner's limit and warn/block choice. The server
// re-checks everything (cap, session-only), so this form is a convenience.
const { status: storage, refresh: refreshStorage } = useStorageStatus()
const { add: toast } = useToast()
const storageMeterView = computed(() => storage.value ? storageMeter(storage.value) : null)
const limitUnits = ['MB', 'GB', 'TB']
const limitAmount = ref('')
const limitUnit = ref('GB')
const storageModeChoice = ref<'warn' | 'reject'>('warn')
const storageModeOptions = [
  { value: 'warn', label: 'Warn only', description: 'Keep saving. The meter turns amber at 80% and red at 95%.' },
  { value: 'reject', label: 'Block new writes', description: 'Refuse uploads, new rangka, and versions that would go over. Deleting always works.' },
]
const keepVersionsChoice = ref('all')
// Presets, plus a value set through the API that is not one, so it still shows.
const keepVersionsOptions = computed(() => {
  const counts = new Set([100, 50, 20, 10, 5])
  if (storage.value?.keepVersions) counts.add(storage.value.keepVersions)
  return [
    { value: 'all', label: 'Keep all' },
    ...[...counts].sort((a, b) => b - a).map(count => ({ value: String(count), label: `Last ${count}` })),
  ]
})
const parsedKeepVersions = computed(() => keepVersionsChoice.value === 'all' ? null : Number(keepVersionsChoice.value))
const savingStorage = ref(false)
const storageError = ref('')

const syncStorageForm = (value: typeof storage.value) => {
  if (!value) return
  storageModeChoice.value = value.mode
  keepVersionsChoice.value = value.keepVersions ? String(value.keepVersions) : 'all'
  const bytes = value.ownerLimitBytes
  if (!bytes) { limitAmount.value = ''; return }
  const unit = bytes >= 1e12 ? 'TB' : bytes >= 1e9 ? 'GB' : 'MB'
  limitUnit.value = unit
  limitAmount.value = String(Number((bytes / ({ MB: 1e6, GB: 1e9, TB: 1e12 } as Record<string, number>)[unit]!).toFixed(2)))
}
watch(storage, (value, previous) => { if (!previous) syncStorageForm(value) }, { immediate: true })

const parsedLimit = computed(() => limitAmount.value.trim() ? parseByteSize(`${limitAmount.value.trim()}${limitUnit.value}`) : null)
const limitProblem = computed(() => {
  if (limitAmount.value.trim() && parsedLimit.value === null) return 'Enter the limit as a number, like 10 or 2.5.'
  const cap = storage.value?.operatorLimitBytes
  if (cap && parsedLimit.value && parsedLimit.value > cap) return `The limit can be at most ${formatByteSize(cap)} on this server.`
  return ''
})
const storageDirty = computed(() => !!storage.value && (parsedLimit.value !== storage.value.ownerLimitBytes || storageModeChoice.value !== storage.value.mode || parsedKeepVersions.value !== storage.value.keepVersions))

const saveStorage = async () => {
  if (!storageDirty.value || limitProblem.value || savingStorage.value) return
  savingStorage.value = true
  storageError.value = ''
  try {
    const res = await $fetch<{ storage: NonNullable<typeof storage.value> }>('/api/storage', { method: 'PUT', body: { limitBytes: parsedLimit.value, mode: storageModeChoice.value, keepVersions: parsedKeepVersions.value } })
    storage.value = res.storage
    syncStorageForm(res.storage)
    toast({ title: 'Storage settings saved', color: 'success' })
  } catch (e: any) {
    storageError.value = e?.data?.message || 'Could not save storage settings.'
  } finally {
    savingStorage.value = false
  }
}

const theme = useAppTheme()
const themeOptions = themes.map(({ id, label, description }) => ({ value: id, label, description }))

const themePreview = (id: string, mode: 'light' | 'dark') => (
  (themes.find(entry => entry.id === id) || themes[0]).preview[mode]
)

const setTheme = (value: string) => {
  if (isThemeId(value)) theme.value = value
}

const { loggedIn } = useUserSession()
const tokens = ref<any[]>([])
const tokenName = ref('')
const scopes = ref<string[]>(['read', 'write'])
const expiresAt = shallowRef<DateValue | undefined>()
const creatingToken = ref(false)
const tokenMessage = ref('')
const tokensError = ref('')
const newToken = ref('')
const showTokenDialog = ref(false)
const tokenCreateError = ref('')
const revokingTokenId = ref<string | null>(null)
const disconnectingClientId = ref<string | null>(null)
const clientsError = ref('')

const openTokenDialog = () => {
  tokenName.value = ''
  scopes.value = ['read', 'write']
  expiresAt.value = undefined
  newToken.value = ''
  tokenCreateError.value = ''
  tokenMessage.value = ''
  showTokenDialog.value = true
}
watch(showTokenDialog, (open) => {
  if (!open) { newToken.value = ''; tokenCreateError.value = '' }
})
const oauthClients = ref<any[]>([])
const clientMessage = ref('')
const loadingTokens = ref(true)
const loadingClients = ref(true)

const scopeOptions = [
  { value: 'read', label: 'Read', hint: 'Read rangka, folders, and version history.' },
  { value: 'write', label: 'Write', hint: 'Create, update, move, restore, and delete.' },
  { value: 'full', label: 'Full', hint: 'Everything, including creating and revoking tokens.' },
]

// Scopes are stored as a set the API checks membership against, so ticking
// several boxes grants their union rather than a ranked level.
const scopeSummary = computed(() => {
  if (!scopes.value.length) return 'No access — this token will not work until you pick at least one scope.'
  const includes = (value: string) => scopes.value.includes(value)
  if (includes('full')) return 'Grants full access, plus the ability to create and revoke API tokens — including this one.'
  const parts: string[] = []
  if (includes('read')) parts.push('read')
  if (includes('write')) parts.push('write')
  if (!parts.length) return 'Token management only. A token without read or write cannot call the rangka API.'
  return `Grants ${parts.join(' and ')} access. Cannot create or revoke tokens.`
})

/**
 * Scopes are a set the API checks membership against, and `full` satisfies
 * read and write checks. Rather than only describing that, keep the checkboxes
 * truthful: ticking Full also ticks Read and Write, and unticking Read or Write
 * while Full is on drops Full (since Full alone would just re-tick them).
 */
const toggleScope = (value: string, checked: boolean | 'indeterminate') => {
  const next = new Set(scopes.value)

  if (checked === true) {
    next.add(value)
    if (value === 'full') {
      next.add('read')
      next.add('write')
    }
  } else {
    next.delete(value)
    if (value !== 'full') next.delete('full')
  }

  // Normalise: full implies read + write, so never store it alone.
  if (next.has('full')) {
    next.add('read')
    next.add('write')
  }

  if (!next.size) {
    scopes.value = []
    return
  }
  scopes.value = ['read', 'write', 'full'].filter(scope => next.has(scope))
}

const loadTokens = async () => {
  tokensError.value = ''
  loadingTokens.value = true
  try {
    const res = await $fetch<any>('/api/tokens')
    tokens.value = res.tokens || []
  } catch (e: any) {
    tokensError.value = e.data?.message || 'Could not load API tokens. Check the server and try again.'
  } finally {
    loadingTokens.value = false
  }
}

const loadClients = async () => {
  loadingClients.value = true
  clientsError.value = ''
  try {
    const res = await $fetch<any>('/api/oauth/clients')
    oauthClients.value = res.clients || []
  } catch (e: any) {
    // Keep this error local to the agent tab so token management still works.
    clientsError.value = e.data?.message || 'Could not load connected agents. Try again.'
  } finally {
    loadingClients.value = false
  }
}

const disconnectClient = async (client: any) => {
  if (disconnectingClientId.value) return
  disconnectingClientId.value = client.id
  clientMessage.value = ''
  try {
    await $fetch(`/api/oauth/clients/${client.id}`, { method: 'DELETE' })
    await loadClients()
    clientMessage.value = `Disconnected ${client.name}.`
  } catch (e: any) {
    clientMessage.value = e.data?.message || 'Could not disconnect client'
  } finally { disconnectingClientId.value = null }
}

const createToken = async () => {
  if (creatingToken.value) return
  tokenCreateError.value = ''; newToken.value = ''
  if (!scopes.value.length) { tokenCreateError.value = 'Select at least one scope.'; return }
  creatingToken.value = true
  try {
    const res = await $fetch<any>('/api/tokens', {
      method: 'POST',
      body: {
        name: tokenName.value,
        scopes: scopes.value,
        ...(expiresAt.value ? { expiresAt: expiresAt.value.toDate(getLocalTimeZone()).toISOString() } : {}),
      },
    })
    newToken.value = res.token
    tokenName.value = ''
    expiresAt.value = undefined
    await loadTokens()
  } catch (e: any) {
    tokenCreateError.value = e.data?.message || 'Could not create token'
  } finally {
    creatingToken.value = false
  }
}

const revokeToken = async (token: any) => {
  if (revokingTokenId.value) return
  revokingTokenId.value = token.id
  tokenMessage.value = ''
  try {
    await $fetch(`/api/tokens/${token.id}`, { method: 'DELETE' })
    await loadTokens()
    tokenMessage.value = `Revoked ${token.name}.`
  } catch (e: any) {
    tokenMessage.value = e.data?.message || 'Could not revoke token'
  } finally { revokingTokenId.value = null }
}

onMounted(async () => {
  nextTick(scrollToRequestedSection)
  void refreshStorage()
  if (!loggedIn.value) return
  // Lists change height once loaded; land on the requested card again.
  await Promise.all([loadTokens(), loadClients()])
  nextTick(scrollToRequestedSection)
})
</script>

<style scoped>
/* One page of section cards; width comes from the shared page column. */
.settings-page { display: flex; min-width: 0; flex-direction: column; gap: 1.5rem; overflow-wrap: anywhere; }
/* Card look comes from the shared .serangkai-card in main.css. */
.settings-card { scroll-margin-top: 1.5rem; }
.settings-card-body { display: flex; min-width: 0; flex-direction: column; padding: 0 1.25rem; }
.settings-card-foot { padding: 0 1.25rem 1rem; }
.settings-section-title { font-size: 1rem; font-weight: 650; line-height: 1.5; letter-spacing: -.02em; }
.settings-description { margin-top: .125rem; color: var(--selaras-resolved-text-muted); font-size: .875rem; line-height: 1.6; }

/* Rows inside a card: label left, control right; stacked rows put the
   control under the label. */
.settings-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 1.5rem; padding: 1.125rem 0; }
.settings-row + .settings-row { border-top: 1px solid var(--selaras-resolved-border-muted); }
.settings-row-stacked { flex-direction: column; align-items: stretch; }
.settings-row-title { font-size: .875rem; font-weight: 600; }

.settings-theme-card { display: block; min-width: 0; }
.settings-theme-previews { display: grid; width: 100%; max-width: 16.5rem; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; margin-bottom: .75rem; }
.settings-theme-preview { position: relative; min-width: 0; aspect-ratio: 16 / 10; overflow: hidden; border: 1px solid var(--selaras-resolved-border-muted); border-radius: .375rem; }
.settings-theme-rail { position: absolute; inset: 0 auto 0 0; width: 22%; opacity: .15; }
.settings-theme-bar { position: absolute; top: .625rem; left: 30%; width: 50%; height: .3rem; border-radius: 2px; }
.settings-theme-line { position: absolute; top: 1.25rem; left: 30%; width: 35%; height: .2rem; border-radius: 2px; opacity: .25; }
.settings-theme-dot { position: absolute; right: .5rem; bottom: .5rem; width: .5rem; height: .5rem; border-radius: 50%; }
.settings-theme-description { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-top: .25rem; color: var(--selaras-resolved-text-muted); font-size: .75rem; line-height: 1.5; }

/* Credential rows (agents and tokens) share one shape. */
.settings-credentials { max-height: 32rem; overflow-y: auto; overscroll-behavior: contain; }
.settings-credential { display: flex; align-items: center; gap: .875rem; padding: .875rem 1.25rem; }
.settings-credential + .settings-credential { border-top: 1px solid var(--selaras-resolved-border-muted); }
.settings-credential-icon { display: grid; width: 2rem; height: 2rem; flex-shrink: 0; place-items: center; border-radius: var(--selaras-resolved-radius-md); background: var(--selaras-resolved-surface-elevated); color: var(--selaras-resolved-text-muted); }
.settings-credential-name { overflow-wrap: anywhere; font-size: .875rem; font-weight: 600; }
.settings-metadata { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .75rem; margin-top: .25rem; color: var(--selaras-resolved-text-muted); font-size: .75rem; line-height: 1.5; }
.settings-scope { padding: 0 .375rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-sm); font-family: var(--font-mono); font-size: .6875rem; color: var(--selaras-resolved-text-default); }
.settings-storage-meter { display: flex; flex-direction: column; gap: .5rem; }
.settings-storage-numbers { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem 1rem; font-variant-numeric: tabular-nums; }
.settings-storage-warning { color: var(--selaras-resolved-color-warning-text); font-weight: 600; }
.settings-storage-danger { color: var(--selaras-resolved-color-danger-text); font-weight: 600; }
.settings-storage-limit { display: flex; gap: .5rem; }
.settings-storage-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .75rem; padding-top: 1rem; border-top: 1px solid var(--selaras-resolved-border-muted); }
.settings-scope-full { border-color: var(--selaras-resolved-color-warning-border); background: var(--selaras-resolved-color-warning-subtle); color: var(--selaras-resolved-color-warning-text); }
.settings-empty { display: flex; align-items: flex-start; flex-direction: column; gap: .375rem; padding: 1.25rem; }
.settings-empty h3 { font-size: .875rem; font-weight: 600; }
.settings-empty p { max-width: 32rem; color: var(--selaras-resolved-text-muted); font-size: .875rem; line-height: 1.6; }
.settings-empty :deep(a) { margin-top: .375rem; }
/* Below 1024px a sticky top bar covers the first 4rem when jumping to a card. */
@media (max-width: 1023px) { .settings-card { scroll-margin-top: 5rem; } }
@media (max-width: 639px) {
  .settings-credential, .settings-empty { padding-inline: 1rem; }
  .settings-card-body { padding-inline: 1rem; }
}
</style>
