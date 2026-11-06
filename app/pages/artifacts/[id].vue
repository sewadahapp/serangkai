<template>
  <div v-if="artifact" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <NuxtLink to="/workspace" class="text-sm text-[var(--selaras-resolved-text-muted)] underline-offset-4 hover:underline">← Workspace</NuxtLink>
        <h1 class="serangkai-balance mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{{ artifact.title }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <SBadge :label="artifact.type" variant="subtle" color="neutral" size="sm" />
          <SBadge
            :label="artifact.visibility"
            variant="subtle"
            :color="artifact.visibility === 'private' ? 'neutral' : artifact.visibility === 'public' ? 'success' : 'accent'"
            size="sm"
          />
          <span v-if="artifact.folderId" class="text-xs text-[var(--selaras-resolved-text-muted)]">{{ folderPath }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <SButton variant="outline" :icon="editing ? 'lucide:eye' : 'lucide:pencil'" @click="editing = !editing">{{ editing ? 'Preview' : 'Edit' }}</SButton>
        <SButton variant="outline" :to="`/api/artifacts/${route.params.id}/download`" icon="lucide:download">Download</SButton>
        <SButton variant="outline" icon="lucide:copy" :loading="duplicating" :disabled="duplicating" @click="duplicateArtifact">Duplicate</SButton>
        <SButton v-if="artifact.type === 'bundle'" variant="outline" :to="`/api/share/${artifact.slug}/index.html`" target="_blank" rel="noopener">Open bundle</SButton>
        <SButton v-if="shareUrl" variant="outline" icon="lucide:external-link" :to="shareUrl" target="_blank" rel="noopener">Open share link</SButton>
        <SButton variant="ghost" color="danger" icon="lucide:trash-2" :loading="deleting" :disabled="deleting" @click="removeArtifact">Delete</SButton>
      </div>
    </div>

    <SAlert v-if="deleteMessage" color="danger" variant="subtle" :title="deleteMessage" />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="artifact-content" class="serangkai-panel overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
          <h2 id="artifact-content" class="text-sm font-semibold">Content</h2>
          <span v-if="message" class="text-xs text-[var(--selaras-resolved-text-muted)]">{{ message }}</span>
        </div>

        <div class="p-5">
          <form v-if="editing" class="space-y-3" @submit.prevent="save">
            <SFormField label="Title" required>
              <SInput v-model="draftTitle" required class="w-full" />
            </SFormField>
            <SFormField v-slot="{ id }" label="Content" required>
              <STextarea :id="id" v-model="draftContent" :rows="20" autoresize :maxrows="60" required class="font-mono text-sm" />
            </SFormField>
            <div class="flex flex-wrap items-center gap-2">
              <SButton type="submit" icon="lucide:save" :loading="saving" :disabled="saving">Save version</SButton>
              <SButton type="button" variant="ghost" @click="editing = false">Cancel</SButton>
            </div>
          </form>

          <template v-else>
            <img
              v-if="artifact.type === 'image'"
              :src="`/api/artifacts/${artifact.id}/preview`"
              :alt="artifact.title"
              class="max-h-[70vh] max-w-full rounded-md border border-[var(--selaras-resolved-border-default)]"
            />
            <iframe
              v-else-if="artifact.type === 'pdf'"
              :src="`/api/artifacts/${artifact.id}/preview`"
              :title="`${artifact.title} PDF`"
              class="h-[70vh] w-full rounded-md border border-[var(--selaras-resolved-border-default)]"
            />
            <SerangkaiHtmlPreview
              v-else-if="artifact.type === 'html'"
              :src="`/api/artifacts/${artifact.id}/preview`"
              :title="`${artifact.title} HTML preview`"
            />
            <div v-else-if="artifact.type === 'markdown'" class="serangkai-prose mx-auto">
              <MarkdownDocument :html="renderedContent" />
            </div>
            <pre v-else class="overflow-auto whitespace-pre-wrap rounded-md bg-[var(--selaras-resolved-surface-elevated)] p-4 font-mono text-sm">{{ content }}</pre>
          </template>
        </div>
      </section>

      <div class="space-y-4">
        <section class="serangkai-panel p-4" aria-labelledby="sharing-heading">
          <h2 id="sharing-heading" class="text-sm font-semibold">Sharing</h2>

          <div class="mt-3 space-y-3">
            <SFormField v-slot="{ id }" label="Visibility">
              <SSelect :id="id" v-model="draftVisibility" :items="visibilityOptions" class="w-full" />
            </SFormField>

            <div class="flex flex-wrap gap-2">
              <SButton icon="lucide:eye" :loading="savingVisibility" :disabled="savingVisibility" @click="saveVisibility">Save visibility</SButton>
              <SButton v-if="draftVisibility !== 'private'" variant="outline" :to="shareUrl || undefined" target="_blank" rel="noopener" :disabled="!shareUrl">Open link</SButton>
            </div>

            <p v-if="draftVisibility === 'private'" class="text-sm text-[var(--selaras-resolved-text-muted)]">Only you can open this artifact.</p>
            <template v-else-if="shareUrl">
              <SFormField label="Share link">
                <SInput :model-value="shareUrl" readonly aria-label="Share link" class="w-full font-mono text-xs" />
              </SFormField>
              <p class="text-sm text-[var(--selaras-resolved-text-muted)]">
                {{ draftVisibility === 'unlisted' ? 'The signed link is required. Anyone with it can read this artifact.' : 'Anyone with the link can read this artifact.' }}
              </p>
            </template>
            <p v-if="shareMessage" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ shareMessage }}</p>
          </div>
        </section>

        <section class="serangkai-panel p-4" aria-labelledby="folder-heading">
          <h2 id="folder-heading" class="text-sm font-semibold">Folder</h2>
          <div class="mt-3 space-y-2">
            <SFormField v-slot="{ id }" label="Move to">
              <SSelect :id="id" v-model="draftFolderId" :items="folderOptions" placeholder="No folder" clearable class="w-full" />
            </SFormField>
            <SButton icon="lucide:folder-input" :loading="savingFolder" :disabled="savingFolder" @click="saveFolder">Move artifact</SButton>
            <p v-if="folderMessage" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ folderMessage }}</p>
          </div>
        </section>

        <section v-if="versions.length" class="serangkai-panel p-4" aria-labelledby="versions-heading">
          <div class="flex items-center justify-between gap-2">
            <h2 id="versions-heading" class="text-sm font-semibold">History</h2>
            <span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ versions.length }} versions</span>
          </div>

          <STimeline :items="versionItems" size="sm" class="mt-3">
            <template #title="{ item }">
              <span class="text-sm font-medium">v{{ item.version }}</span>
            </template>
            <template #content="{ item }">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium">v{{ item.version }}</span>
                <time class="text-xs text-[var(--selaras-resolved-text-muted)]">{{ formatDate(item.createdAt) }}</time>
              </div>
              <div class="mt-1.5 flex gap-1.5">
                <SButton variant="text" size="sm" icon="lucide:eye" @click="viewVersion(item.version)">View</SButton>
                <SButton
                  v-if="item.version !== latestVersion"
                  variant="text"
                  size="sm"
                  icon="lucide:history"
                  :loading="restoring === item.version"
                  :disabled="restoring === item.version"
                  @click="restoreVersion(item.version)"
                >
                  Restore
                </SButton>
              </div>
            </template>
          </STimeline>

          <div v-if="viewing" class="mt-3 border-t border-[var(--selaras-resolved-border-muted)] pt-3">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-[var(--selaras-resolved-text-muted)]">Version {{ viewing.version }}</p>
              <SButton variant="text" size="sm" @click="closeViewing">Close</SButton>
            </div>
            <pre class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--selaras-resolved-surface-elevated)] p-3 font-mono text-xs">{{ viewing.content }}</pre>
          </div>

          <p v-if="versionMessage" class="mt-2 text-xs text-[var(--selaras-resolved-text-muted)]">{{ versionMessage }}</p>
        </section>
      </div>
    </div>
  </div>

  <div v-else class="serangkai-panel p-12 text-center">
    <SSkeleton class="mx-auto h-6 w-56" />
    <p class="mt-3 text-sm text-[var(--selaras-resolved-text-muted)]">Loading artifact…</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const artifact = ref<any>(null)
const content = ref('')
const renderedContent = ref('')

const editing = ref(false)
const draftTitle = ref('')
const draftContent = ref('')
const versions = ref<any[]>([])
const saving = ref(false)
const message = ref('')
const draftVisibility = ref('private')
const shareUrl = ref('')
const shareMessage = ref('')
const savingVisibility = ref(false)
const folders = ref<any[]>([])
const draftFolderId = ref('')
const savingFolder = ref(false)
const folderMessage = ref('')
const deleting = ref(false)
const deleteMessage = ref('')
const viewing = ref<{ version: number; content: string } | null>(null)
const restoring = ref<number | null>(null)
const versionMessage = ref('')
const duplicating = ref(false)

const { confirm } = useConfirm()
const { add: toast } = useToast()

const visibilityOptions = [
  { label: 'Private — only you', value: 'private' },
  { label: 'Unlisted — signed link required', value: 'unlisted' },
  { label: 'Public — anyone with the link', value: 'public' },
]

const folderOptions = computed(() => [
  { label: 'No folder', value: '' },
  ...folders.value.map((folder: any) => ({ label: folder.path || folder.name, value: folder.id })),
])

watch(artifact, (value) => {
  if (value) useHead({ title: `${value.title} · Serangkai` })
}, { immediate: true })

const latestVersion = computed(() => versions.value[0]?.version ?? null)

// STimeline wants a flat item list; carry the raw version so the #content
// slot can render the View/Restore actions for each entry.
const versionItems = computed(() => versions.value.map(version => ({
  id: version.id,
  version: version.version,
  createdAt: version.createdAt,
  title: `v${version.version}`,
  date: formatDate(version.createdAt),
  icon: version.version === latestVersion.value ? 'lucide:circle-dot' : 'lucide:git-commit-horizontal',
})))
const folderPath = computed(() => folders.value.find(folder => folder.id === artifact.value?.folderId)?.path || '')

const formatDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

const viewVersion = async (version: number) => {
  versionMessage.value = ''
  try {
    const res = await $fetch(`/api/artifacts/${route.params.id}/versions/${version}`)
    viewing.value = { version: res.version.version, content: res.content }
  } catch (e: any) {
    versionMessage.value = e.data?.message || `Could not load version ${version}`
  }
}

const closeViewing = () => { viewing.value = null }

const restoreVersion = async (version: number) => {
  restoring.value = version; versionMessage.value = ''
  try {
    const res = await $fetch(`/api/artifacts/${route.params.id}/versions/${version}/restore`, { method: 'POST' })
    versionMessage.value = `Restored version ${version} as version ${res.version}.`
    await reloadArtifact()
  } catch (e: any) {
    versionMessage.value = e.data?.message || `Could not restore version ${version}`
  } finally {
    restoring.value = null
  }
}

const reloadArtifact = async () => {
  const res = await $fetch<any>(`/api/artifacts/${route.params.id}`)
  artifact.value = res.artifact
  content.value = res.content
  renderedContent.value = res.renderedContent || ''
  draftTitle.value = res.artifact.title
  draftContent.value = res.content
  draftVisibility.value = res.artifact.visibility
  draftFolderId.value = res.artifact.folderId || ''
  shareMessage.value = ''
  versions.value = (await $fetch<any>(`/api/artifacts/${route.params.id}/versions`)).versions || []
}

const loadShareLink = async () => {
  shareUrl.value = ''
  if (draftVisibility.value === 'private') return
  try {
    const link = await $fetch<any>(`/api/artifacts/${route.params.id}/share`, { method: 'POST' })
    shareUrl.value = link.url
  } catch (e: any) {
    shareMessage.value = e.data?.message || 'Could not create a share link'
  }
}

const saveVisibility = async () => {
  savingVisibility.value = true; shareMessage.value = ''
  try {
    const res = await $fetch<any>(`/api/artifacts/${route.params.id}`, { method: 'PUT', body: { visibility: draftVisibility.value } })
    artifact.value = res.artifact
    await loadShareLink()
    if (!shareMessage.value) shareMessage.value = 'Sharing settings saved.'
  } catch (e: any) { shareMessage.value = e.data?.message || 'Could not save sharing settings' }
  finally { savingVisibility.value = false }
}

const saveFolder = async () => {
  savingFolder.value = true; folderMessage.value = ''
  try {
    const res = await $fetch<any>(`/api/artifacts/${route.params.id}`, { method: 'PUT', body: { folderId: draftFolderId.value || null } })
    artifact.value = res.artifact
    folderMessage.value = 'Folder updated.'
  } catch (e: any) { folderMessage.value = e.data?.message || 'Could not move artifact' }
  finally { savingFolder.value = false }
}

const duplicateArtifact = async () => {
  duplicating.value = true; deleteMessage.value = ''
  try {
    const res = await $fetch<any>(`/api/artifacts/${route.params.id}/duplicate`, { method: 'POST' })
    await navigateTo(`/artifacts/${res.artifact.id}`)
  } catch (e: any) {
    deleteMessage.value = e.data?.message || 'Could not duplicate artifact'
  } finally {
    duplicating.value = false
  }
}

const removeArtifact = async () => {
  deleteMessage.value = ''
  const accepted = await confirm({
    title: `Delete “${artifact.value?.title}”?`,
    description: 'This removes the artifact, every version, and its stored files. It cannot be undone.',
    confirmLabel: 'Delete artifact',
    confirmColor: 'danger',
    icon: 'lucide:trash-2',
  })
  if (!accepted) return

  deleting.value = true
  try {
    await $fetch(`/api/artifacts/${route.params.id}`, { method: 'DELETE' })
    toast({ title: 'Artifact deleted', color: 'success' })
    await navigateTo('/workspace')
  } catch (e: any) {
    deleteMessage.value = e.data?.message || 'Could not delete artifact'
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  try {
    const res = await $fetch<any>(`/api/artifacts/${route.params.id}`)
    artifact.value = res.artifact
    content.value = res.content
    renderedContent.value = res.renderedContent || ''
    draftTitle.value = res.artifact.title
    draftContent.value = res.content
    draftVisibility.value = res.artifact.visibility
    draftFolderId.value = res.artifact.folderId || ''
    await loadShareLink()
    const [history, folderList] = await Promise.all([
      $fetch<any>(`/api/artifacts/${route.params.id}/versions`),
      $fetch<any>('/api/folders'),
    ])
    versions.value = history.versions || []
    folders.value = folderList.folders || []
  } catch (e) {
    console.error(e)
  }
})

const save = async () => {
  saving.value = true; message.value = ''
  try {
    const res = await $fetch<any>(`/api/artifacts/${route.params.id}`, {
      method: 'PUT',
      body: { title: draftTitle.value, content: draftContent.value, baseVersion: latestVersion.value },
    })
    artifact.value = res.artifact
    content.value = draftContent.value
    renderedContent.value = res.artifact.type === 'markdown' ? (await $fetch<any>(`/api/artifacts/${route.params.id}`)).renderedContent : ''
    versions.value = (await $fetch<any>(`/api/artifacts/${route.params.id}/versions`)).versions || []
    editing.value = false
    message.value = res.versionCreated ? `Saved version ${res.version}` : 'No changes to save'
  } catch (e: any) {
    const status = e.statusCode || e.response?.status
    if (status === 409) {
      // Someone else published while this editor was open. Reload so the form
      // reflects the new content, and keep the user's draft in the textarea.
      const draft = draftContent.value
      await reloadArtifact()
      draftContent.value = draft
      message.value = 'This artifact changed since you opened it. Your edits are preserved below — review and save again to publish them on top of the latest version.'
    } else {
      message.value = e.data?.message || 'Could not save'
    }
  }
  finally { saving.value = false }
}
</script>
