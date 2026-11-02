<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Settings</h1>
    </div>

    <SCard v-if="!user">
      <SCardHeader><SCardTitle>Sign in required</SCardTitle></SCardHeader>
      <SCardContent>
        <p class="mb-4 text-sm text-muted-foreground">Sign in to manage workspace settings and API tokens.</p>
        <SButton to="/auth/login">Login</SButton>
      </SCardContent>
    </SCard>

    <template v-else>
      <SCard>
        <SCardHeader><SCardTitle>API tokens</SCardTitle></SCardHeader>
        <SCardContent>
          <p class="mb-4 text-sm text-muted-foreground">
            Tokens let AI agents and scripts call the REST and MCP APIs. Treat them like passwords and give them the smallest scope that works.
          </p>
          <form class="space-y-4" @submit.prevent="createToken">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1 block text-muted-foreground">Name</span>
                <SInput v-model="tokenName" placeholder="Token name" required />
              </label>
              <label class="block text-sm">
                <span class="mb-1 block text-muted-foreground">Expires (optional)</span>
                <input v-model="expiresAt" type="date" class="w-full rounded-md border bg-background px-3 py-2" />
              </label>
            </div>
            <fieldset class="flex flex-wrap gap-4 text-sm">
              <legend class="mb-1 text-muted-foreground">Scopes</legend>
              <label class="flex items-center gap-2"><input v-model="scopes" type="checkbox" value="read" /> Read</label>
              <label class="flex items-center gap-2"><input v-model="scopes" type="checkbox" value="write" /> Write</label>
              <label class="flex items-center gap-2"><input v-model="scopes" type="checkbox" value="full" /> Full (manage tokens)</label>
            </fieldset>
            <SButton type="submit" :disabled="creatingToken">{{ creatingToken ? 'Creating...' : 'Create token' }}</SButton>
          </form>

          <div v-if="newToken" class="mt-4 rounded-md border p-3">
            <p class="mb-2 text-sm font-medium">Copy this token now. It will not be shown again.</p>
            <input :value="newToken" readonly aria-label="New API token" class="w-full rounded-md border bg-muted px-3 py-2 font-mono text-xs" />
          </div>
          <p v-if="tokenMessage" class="mt-3 text-sm text-muted-foreground">{{ tokenMessage }}</p>
        </SCardContent>
      </SCard>

      <SCard>
        <SCardHeader><SCardTitle>Existing tokens</SCardTitle></SCardHeader>
        <SCardContent>
          <ul v-if="tokens.length" class="divide-y">
            <li v-for="token in tokens" :key="token.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p class="font-medium">{{ token.name }}</p>
                <p class="text-sm text-muted-foreground">
                  {{ token.scopes.join(', ') }} · created {{ new Date(token.createdAt).toLocaleDateString() }}
                  <template v-if="token.lastUsedAt"> · last used {{ new Date(token.lastUsedAt).toLocaleString() }}</template>
                  <template v-if="token.expiresAt"> · expires {{ new Date(token.expiresAt).toLocaleDateString() }}</template>
                </p>
              </div>
              <SButton variant="outline" @click="revokeToken(token)">Revoke</SButton>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">No tokens yet.</p>
        </SCardContent>
      </SCard>
    </template>
  </div>
</template>

<script setup lang="ts">
const user = useState('user')
const tokens = ref<any[]>([])
const tokenName = ref('')
const scopes = ref<string[]>(['read', 'write'])
const expiresAt = ref('')
const creatingToken = ref(false)
const tokenMessage = ref('')
const newToken = ref('')

const loadTokens = async () => {
  try {
    const res = await $fetch('/api/tokens')
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
    const res = await $fetch('/api/tokens', {
      method: 'POST',
      body: {
        name: tokenName.value,
        scopes: scopes.value,
        ...(expiresAt.value ? { expiresAt: new Date(`${expiresAt.value}T00:00:00Z`).toISOString() } : {}),
      },
    })
    newToken.value = res.token
    tokenName.value = ''
    expiresAt.value = ''
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
