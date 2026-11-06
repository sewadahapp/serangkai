<template>
  <div class="space-y-6">
    <SerangkaiPageHeader title="Settings" description="Manage API tokens for agents and scripts." />

    <SAlert v-if="!user" color="info" variant="subtle" title="Sign in required" description="Sign in to manage API tokens." />

    <template v-else>
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
              <SDatePicker :id="id" v-model="expiresAt" class="w-full" />
            </SFormField>
          </div>

          <fieldset>
            <legend class="text-sm font-medium">Scopes</legend>
            <p class="mt-0.5 text-xs text-[var(--selaras-resolved-text-muted)]">
              Tick any combination. Full already includes read and write.
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
          <SInput :model-value="newToken" readonly aria-label="New API token" icon="lucide:key-round" class="mt-2 w-full font-mono text-xs" />
        </div>

        <SAlert v-if="tokenMessage" class="mt-4" color="info" variant="subtle" :title="tokenMessage" />
      </section>

      <section class="serangkai-panel overflow-hidden" aria-labelledby="existing-tokens">
        <div class="border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
          <h2 id="existing-tokens" class="text-sm font-semibold">Existing tokens</h2>
        </div>
        <ul v-if="tokens.length" class="divide-y divide-[var(--selaras-resolved-border-muted)]">
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

useHead({ title: 'Settings · Serangkai' })

const user = useState<any>('user')
const tokens = ref<any[]>([])
const tokenName = ref('')
const scopes = ref<string[]>(['read', 'write'])
const expiresAt = shallowRef<DateValue | undefined>()
const creatingToken = ref(false)
const tokenMessage = ref('')
const newToken = ref('')

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

const toggleScope = (value: string, checked: boolean | 'indeterminate') => {
  const next = new Set(scopes.value)
  if (checked === true) next.add(value)
  else next.delete(value)
  scopes.value = [...next]
}

const loadTokens = async () => {
  try {
    const res = await $fetch<any>('/api/tokens')
    tokens.value = res.tokens || []
  } catch (e: any) {
    tokenMessage.value = e.data?.message || 'Could not load tokens'
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

onMounted(() => { if (user.value) loadTokens() })
</script>
