<template>
  <div class="space-y-6">
    <SerangkaiPageHeader title="Settings" description="Choose how the workspace looks and manage API tokens for agents and scripts." />

    <section class="serangkai-panel overflow-hidden" aria-labelledby="appearance">
      <div class="border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
        <h2 id="appearance" class="text-sm font-semibold">Appearance</h2>
        <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">
          Pick a color theme. Light and dark mode stay independent and follow the toggle in the header.
        </p>
      </div>
      <div class="p-5">
        <SRadioGroup
          :model-value="theme"
          variant="card"
          :items="themeOptions"
          :ui="{ root: 'grid grid-cols-1 gap-3 sm:grid-cols-2' }"
          aria-label="Color theme"
          @update:model-value="setTheme"
        >
          <template #label="{ item }">
            <span class="flex min-w-0 flex-1 items-center gap-3">
              <span class="flex shrink-0 items-center gap-1" aria-hidden="true">
                <span
                  v-for="mode in ['light', 'dark']"
                  :key="mode"
                  class="relative grid size-9 place-items-end overflow-hidden rounded-md border border-[var(--selaras-resolved-border-default)] p-1"
                  :style="{ backgroundColor: themePreview(item.value, mode).surface }"
                >
                  <span class="absolute inset-x-1 top-1 h-1.5 rounded-full" :style="{ backgroundColor: themePreview(item.value, mode).primary }" />
                  <span class="size-2 rounded-full" :style="{ backgroundColor: themePreview(item.value, mode).accent }" />
                </span>
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium">{{ item.label }}</span>
                <span class="mt-0.5 block text-xs text-[var(--selaras-resolved-text-muted)]">{{ item.description }}</span>
              </span>
            </span>
          </template>
        </SRadioGroup>
      </div>
    </section>

    <SAlert v-if="!loggedIn" color="info" variant="subtle" title="Sign in required" description="Sign in to manage API tokens." />

    <SerangkaiErrorState
      v-if="loggedIn && tokensError"
      title="Could not load API tokens"
      :description="tokensError"
      retry-label="Try again"
      @retry="loadTokens"
    />

    <template v-if="loggedIn && !tokensError">
      <section class="serangkai-panel p-5" aria-labelledby="new-token">
        <h2 id="new-token" class="text-sm font-semibold">Create a token</h2>
        <p class="mt-1 text-sm text-[var(--selaras-resolved-text-muted)]">
          Give each agent the smallest scope that works. Scopes combine: a token gets the union of
          everything you tick, and <strong class="text-[var(--selaras-resolved-text-default)]">only Full</strong>
          can create or revoke API tokens.
        </p>

        <form class="mt-4 space-y-4" @submit.prevent="createToken">
          <div class="grid gap-3 sm:grid-cols-2">
            <SFormField label="Name" required>
              <SInput v-model="tokenName" placeholder="Token name" required class="w-full" />
            </SFormField>
            <SFormField v-slot="{ id }" label="Expires" hint="Leave empty for a token that does not expire.">
              <SDatePicker :id="id" v-model="expiresAt" trigger-mode="button" class="w-full" />
            </SFormField>
          </div>

          <fieldset>
            <legend class="text-sm font-medium">Scopes</legend>
            <p class="mt-0.5 text-xs text-[var(--selaras-resolved-text-muted)]">
              Tick any combination. Ticking Full ticks read and write too, since it covers them.
            </p>
            <div class="mt-3 grid gap-2 sm:grid-cols-3">
              <SCheckbox
                v-for="scope in scopeOptions"
                :key="scope.value"
                variant="card"
                :model-value="scopes.includes(scope.value)"
                :label="scope.label"
                :description="scope.hint"
                @update:model-value="(checked) => toggleScope(scope.value, checked)"
              />
            </div>
            <SAlert
              class="mt-3"
              :color="scopes.includes('full') ? 'warning' : 'info'"
              variant="subtle"
              :title="scopeSummary"
            />
          </fieldset>

          <SButton type="submit" icon="lucide:key-round" :loading="creatingToken" :disabled="creatingToken">Create token</SButton>
        </form>

        <div v-if="newToken" class="mt-4 rounded-md border border-[var(--selaras-resolved-color-primary-border)] bg-[var(--selaras-resolved-color-primary-subtle)] p-4">
          <p class="text-sm font-medium text-[var(--selaras-resolved-color-primary-on-subtle)]">Copy this token now — it will not be shown again.</p>
          <SInput :model-value="newToken" readonly aria-label="New API token" icon="lucide:key-round" class="mt-2 w-full font-mono text-xs">
            <template #trailing="{ buttonSize }">
              <SerangkaiCopyButton :value="newToken" label="API token" :size="buttonSize" />
            </template>
          </SInput>
        </div>

        <SAlert v-if="tokenMessage" class="mt-4" color="info" variant="subtle" :title="tokenMessage" />
      </section>

      <section class="serangkai-panel overflow-hidden" aria-labelledby="connected-clients">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
          <h2 id="connected-clients" class="text-sm font-semibold">Connected agents</h2>
          <SSkeleton v-if="loadingClients" animation="shimmer" class="h-3 w-16" />
          <span v-else class="text-xs text-[var(--selaras-resolved-text-muted)]">{{ oauthClients.length }} connected</span>
        </div>
        <div v-if="loadingClients" class="divide-y divide-[var(--selaras-resolved-border-muted)]" role="status" aria-live="polite" aria-busy="true">
          <span class="sr-only">Loading connected agents…</span>
          <div
            v-for="index in 2"
            :key="index"
            class="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            aria-hidden="true"
          >
            <div class="min-w-0 flex-1">
              <SSkeleton animation="shimmer" class="h-4 w-32" />
              <SSkeleton animation="shimmer" class="mt-2 h-3 w-64 max-w-full" />
            </div>
            <SSkeleton animation="shimmer" class="h-8 w-24 rounded-md" />
          </div>
        </div>
        <ul v-else-if="oauthClients.length" class="divide-y divide-[var(--selaras-resolved-border-muted)]">
          <li v-for="client in oauthClients" :key="client.id" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div class="min-w-0">
              <p class="font-medium">{{ client.name }}</p>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--selaras-resolved-text-muted)]">
                <span>{{ client.scopes.join(', ') || 'no scopes' }}</span>
                <span aria-hidden="true">·</span>
                <span>connected {{ new Date(client.connectedAt).toLocaleDateString() }}</span>
                <span aria-hidden="true">·</span>
                <span>session renews until {{ new Date(client.refreshExpiresAt).toLocaleDateString() }}</span>
              </p>
            </div>
            <SButton variant="ghost" color="danger" size="sm" icon="lucide:unplug" @click="disconnectClient(client)">Disconnect</SButton>
          </li>
        </ul>
        <div v-else class="px-5 py-6">
          <p class="text-sm text-[var(--selaras-resolved-text-muted)]">
            No agents are connected over OAuth. MCP clients that support OAuth will offer a
            browser sign-in instead of a pasted token; approved clients appear here.
          </p>
        </div>
        <p v-if="clientMessage" class="border-t border-[var(--selaras-resolved-border-muted)] px-5 py-3 text-sm text-[var(--selaras-resolved-text-muted)]">{{ clientMessage }}</p>
      </section>

      <section class="serangkai-panel overflow-hidden" aria-labelledby="existing-tokens">
        <div class="border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
          <h2 id="existing-tokens" class="text-sm font-semibold">Existing tokens</h2>
        </div>
        <div v-if="loadingTokens" class="divide-y divide-[var(--selaras-resolved-border-muted)]" role="status" aria-live="polite" aria-busy="true">
          <span class="sr-only">Loading API tokens…</span>
          <div
            v-for="index in 3"
            :key="index"
            class="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            aria-hidden="true"
          >
            <div class="min-w-0 flex-1">
              <SSkeleton animation="shimmer" class="h-4 w-28" />
              <SSkeleton animation="shimmer" class="mt-2 h-3 w-56 max-w-full" />
            </div>
            <SSkeleton animation="shimmer" class="h-8 w-20 rounded-md" />
          </div>
        </div>
        <ul v-else-if="tokens.length" class="divide-y divide-[var(--selaras-resolved-border-muted)]">
          <li v-for="token in tokens" :key="token.id" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div class="min-w-0">
              <p class="font-medium">{{ token.name }}</p>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--selaras-resolved-text-muted)]">
                <span>{{ token.scopes.join(', ') }}</span>
                <span aria-hidden="true">·</span>
                <span>created {{ new Date(token.createdAt).toLocaleDateString() }}</span>
                <template v-if="token.lastUsedAt">
                  <span aria-hidden="true">·</span>
                  <span>last used {{ new Date(token.lastUsedAt).toLocaleString() }}</span>
                </template>
                <template v-if="token.expiresAt">
                  <span aria-hidden="true">·</span>
                  <span>expires {{ new Date(token.expiresAt).toLocaleDateString() }}</span>
                </template>
              </p>
            </div>
            <SButton variant="ghost" color="danger" size="sm" icon="lucide:ban" @click="revokeToken(token)">Revoke</SButton>
          </li>
        </ul>
        <div v-else class="px-5 py-8 text-center">
          <p class="text-sm text-[var(--selaras-resolved-text-muted)]">No tokens yet. Create one to connect an agent.</p>
          <SButton to="/agent" variant="outline" icon="lucide:book-open" class="mt-3">Connection guide</SButton>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone } from '@internationalized/date'
import { isThemeId, themes } from '#shared/themes'

useHead({ title: 'Settings' })

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
const oauthClients = ref<any[]>([])
const clientMessage = ref('')
const loadingTokens = ref(true)
const loadingClients = ref(true)

const scopeOptions = [
  { value: 'read', label: 'Read', hint: 'List and read artifacts, folders, and versions. Read-only.' },
  { value: 'write', label: 'Write', hint: 'Create, update, move, restore, and delete artifacts and folders.' },
  { value: 'full', label: 'Full', hint: 'Everything, including creating and revoking API tokens. Treat as admin.' },
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
  if (!parts.length) return 'Token management only. A token without read or write cannot call the artifact API.'
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
  try {
    const res = await $fetch<any>('/api/oauth/clients')
    oauthClients.value = res.clients || []
  } catch {
    // Connected agents are additive: failing to list them must not hide the
    // token section the owner actually came here for.
    oauthClients.value = []
  } finally {
    loadingClients.value = false
  }
}

const disconnectClient = async (client: any) => {
  clientMessage.value = ''
  try {
    await $fetch(`/api/oauth/clients/${client.id}`, { method: 'DELETE' })
    await loadClients()
    clientMessage.value = `Disconnected ${client.name}.`
  } catch (e: any) {
    clientMessage.value = e.data?.message || 'Could not disconnect client'
  }
}

const createToken = async () => {
  tokenMessage.value = ''; newToken.value = ''
  if (!scopes.value.length) { tokenMessage.value = 'Select at least one scope.'; return }
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
    tokenMessage.value = e.data?.message || 'Could not create token'
  } finally {
    creatingToken.value = false
  }
}

const revokeToken = async (token: any) => {
  tokenMessage.value = ''
  try {
    await $fetch(`/api/tokens/${token.id}`, { method: 'DELETE' })
    await loadTokens()
    tokenMessage.value = `Revoked ${token.name}.`
  } catch (e: any) {
    tokenMessage.value = e.data?.message || 'Could not revoke token'
  }
}

onMounted(() => { if (loggedIn.value) { loadTokens(); loadClients() } })
</script>
