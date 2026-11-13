<template>
  <div v-if="artifact">
    <section v-if="editing" class="serangkai-editor-workspace" aria-label="Artifact editor">
      <header class="serangkai-editor-workspace-bar">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <SButton variant="ghost" size="sm" icon="lucide:arrow-left" aria-label="Close editor" @click="cancelEdit" />
          <SInput v-model="draftTitle" size="sm" aria-label="Title" class="min-w-0 max-w-xl flex-1" />
          <SBadge :label="artifact.type" variant="subtle" color="neutral" size="sm" class="hidden sm:inline-flex" />
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <SButton variant="ghost" size="sm" class="hidden sm:inline-flex" @click="cancelEdit">Cancel</SButton>
          <SButton size="sm" icon="lucide:save" :loading="saving" :disabled="saving" @click="save">Save version</SButton>
        </div>
      </header>

      <div class="serangkai-editor-workspace-body">
        <SAlert v-if="message" :color="saveMessageColor" variant="subtle" :title="message" class="mb-3 shrink-0" />
        <SerangkaiCodeEditor
          v-model="draftContent"
          :language="editorLanguage"
          :filename="editorFilename"
          :version="latestVersion"
          :dirty="dirty"
          fill
          aria-label="Content"
          @save="save"
        />
      </div>
    </section>

    <div v-else class="artifact-reader">
      <header class="artifact-toolbar">
        <div class="min-w-0 flex-1">
          <h1 class="min-w-0" :aria-label="artifact.title">
            <STooltip :text="artifact.title"><span class="inline-flex min-w-0"><SDropdown :positioning="{ collisionPadding: 12 }" :items="artifactActions" :adaptive="true"><SButton variant="ghost" color="neutral" trailing-icon="lucide:chevron-down" aria-label="Artifact actions" class="max-w-full"><span class="truncate">{{ artifact.title }}</span></SButton></SDropdown></span></STooltip>
          </h1>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <STooltip v-if="isTextArtifact" text="Edit"><SButton variant="ghost" color="neutral" icon="lucide:pencil" :disabled="historyLoading || latestVersion === null" aria-label="Edit" @click="openEditor"><span class="hidden sm:inline">Edit</span></SButton></STooltip>
          <STooltip text="History"><SButton variant="ghost" color="neutral" icon="lucide:history" aria-label="History" @click="historyOpen = true" /></STooltip>
          <STooltip text="Share"><SButton variant="outline" color="neutral" icon="lucide:share-2" aria-label="Share" @click="sharingOpen = true"><span class="hidden sm:inline">Share</span></SButton></STooltip>
        </div>
      </header>
      <p v-if="message" class="artifact-notice" role="status">{{ message }}</p>
      <SAlert v-if="deleteMessage" color="danger" variant="subtle" :title="deleteMessage" />

      <section class="artifact-document" aria-label="Artifact content" :class="{ 'artifact-document-markdown': artifact.type === 'markdown' }">
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
              class="min-h-[70vh] w-full flex-1 rounded-md border border-[var(--selaras-resolved-border-default)]"
            />
            <SerangkaiHtmlPreview
              v-else-if="artifact.type === 'html'"
              :src="`/api/artifacts/${artifact.id}/preview`"
              :title="`${artifact.title} HTML preview`"
              auto-height
              class="min-h-[70vh]"
            />
            <div v-else-if="artifact.type === 'markdown'" class="min-w-0 w-full">
              <MarkdownDocument :body="contentBody" />
            </div>
            <SerangkaiCode
              v-else-if="artifact.type === 'json' || artifact.type === 'javascript'"
              :code="content"
              :language="artifact.type === 'json' ? 'json' : 'javascript'"
              :filename="artifact.metadata?.filename"
            />
            <pre v-else class="overflow-auto whitespace-pre-wrap rounded-md bg-[var(--selaras-resolved-surface-elevated)] p-4 font-mono text-sm">{{ content }}</pre>
      </section>


      <SModal v-model:open="sharingOpen" title="Share artifact" description="Choose who can open this artifact.">
        <template #body>

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
                  <SInput :model-value="shareUrl" readonly aria-label="Share link" class="w-full font-mono text-xs">
                    <template #trailing="{ buttonSize }">
                      <SerangkaiCopyButton :value="shareUrl" label="share link" :size="buttonSize" />
                    </template>
                  </SInput>
                </SFormField>
                <p class="text-sm text-[var(--selaras-resolved-text-muted)]">
                  {{ draftVisibility === 'unlisted' ? 'The signed link is required. Anyone with it can read this artifact.' : 'Anyone with the link can read this artifact.' }}
                </p>
              </template>
              <p v-if="shareMessage" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ shareMessage }}</p>
            </div>
        </template>
      </SModal>

      <SModal v-model:open="movingOpen" title="Move artifact" :description="folderPath ? `Currently in ${folderPath}` : 'Choose a folder for this artifact.'">
        <template #body>
            <div class="mt-3 space-y-2">
              <SFormField v-slot="{ id }" label="Move to">
                <SSelect :id="id" v-model="draftFolderId" :items="folderOptions" placeholder="No folder" clearable class="w-full" />
              </SFormField>
              <SButton icon="lucide:folder-input" :loading="savingFolder" :disabled="savingFolder" @click="saveFolder">Move artifact</SButton>
              <p v-if="folderMessage" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ folderMessage }}</p>
            </div>
        </template>
      </SModal>

      <SSlideover v-model:open="historyOpen" side="right" title="Version history" description="Browse and restore saved versions.">
        <template #body>
            <div class="flex items-start justify-between gap-2">
              <div><h2 id="versions-heading" class="text-sm font-semibold">History</h2><p class="mt-1 text-xs text-[var(--selaras-resolved-text-muted)]">{{ versionTotal }} {{ versionTotal === 1 ? 'version' : 'versions' }}</p></div>
              <SIcon name="lucide:history" class="size-4 text-[var(--selaras-resolved-text-muted)]" aria-hidden="true" />
            </div>
            <p v-if="historyLoading" class="mt-4 text-sm text-[var(--selaras-resolved-text-muted)]" role="status">Loading history…</p>
            <template v-else>
              <ul v-if="versions.length" class="mt-3 divide-y divide-[var(--selaras-resolved-border-muted)]">
                <li v-for="item in versions" :key="item.id" class="py-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2"><span class="text-sm font-semibold">v{{ item.version }}</span><SBadge v-if="item.version === latestVersion" label="Current" variant="subtle" color="primary" size="sm" /></div>
                    <time :datetime="item.createdAt" class="text-right text-xs text-[var(--selaras-resolved-text-muted)]">{{ formatDate(item.createdAt) }}</time>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <SButton variant="ghost" size="sm" icon="lucide:eye" @click="viewVersion(item.version)">View</SButton>
                    <SButton v-if="item.version !== latestVersion" variant="ghost" size="sm" icon="lucide:history" :loading="restoring === item.version" :disabled="restoring !== null" @click="restoreVersion(item.version)">Restore</SButton>
                  </div>
                </li>
              </ul>
              <p v-else-if="!historyError" class="mt-3 text-sm text-[var(--selaras-resolved-text-muted)]">No versions yet.</p>
              <div v-if="versionPages > 1" class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--selaras-resolved-border-muted)] pt-3">
                <span class="text-xs text-[var(--selaras-resolved-text-muted)]">Page {{ versionPage }} of {{ versionPages }}</span>
                <SPagination :page="versionPage" :total="versionTotal" :items-per-page="versionPageSize" :sibling-count="0" :show-edges="false" :show-first-last="false" size="sm" color="neutral" active-color="neutral" aria-label="History pages" @update:page="loadVersions" />
              </div>
            </template>
            <div v-if="historyError" class="mt-3"><p role="alert" class="text-sm text-[var(--selaras-resolved-color-danger-text)]">{{ historyError }}</p><SButton variant="ghost" size="sm" @click="loadVersions(versionPage)">Retry history</SButton></div>
            <p v-if="versionMessage" class="mt-3 text-xs text-[var(--selaras-resolved-text-muted)]" role="status">{{ versionMessage }}</p>
        </template>
      </SSlideover>
      <SModal :open="!!viewing" :title="`Version ${viewing?.version || ''}`" description="Saved content from this version." :ui="{ content: 'max-w-2xl' }" @update:open="value => { if (!value) closeViewing() }">
            <template #body><pre class="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-[var(--selaras-resolved-surface-elevated)] p-3 font-mono text-xs">{{ viewing?.content }}</pre></template>
      </SModal>
    </div>
  </div>

  <SerangkaiErrorState
    v-else-if="loadError"
    title="Could not load this artifact"
    :description="loadError"
    retry-label="Try again"
    @retry="loadArtifact"
  />

  <SerangkaiArtifactSkeleton v-else-if="loadingArtifact" />

  <div v-else class="serangkai-panel p-12 text-center">
    <p class="text-sm text-[var(--selaras-resolved-text-muted)]">Artifact unavailable.</p>
    <SButton class="mt-4" variant="outline" icon="lucide:refresh-cw" @click="loadArtifact">
      Try again
    </SButton>
  </div>
</template>

<script setup lang="ts">
import { NO_FOLDER, folderIdFromSelection, folderSelection } from '~/utils/folders'
import type { EditorLanguage } from '~/utils/editor'

const route = useRoute()
const requestFetch = useRequestFetch()
const artifact = ref<any>(null)
const content = ref('')
const contentBody = ref<Record<string, unknown> | null>(null)
const editing = ref(false)
const sharingOpen = ref(false)
const movingOpen = ref(false)
const historyOpen = ref(false)
const draftTitle = ref('')
const draftContent = ref('')
const versions = ref<any[]>([])
const versionTotal = ref(0)
const versionPage = ref(1)
const versionPageSize = ref(8)
const versionPages = computed(() => Math.max(1, Math.ceil(versionTotal.value / versionPageSize.value)))
const latestVersion = ref<number | null>(null)
const historyLoading = ref(false)
const historyError = ref('')
let historySequence = 0
const saving = ref(false)
const message = ref('')
const saveMessageColor = ref<'danger' | 'warning'>('danger')
const draftVisibility = ref('private')
const shareUrl = ref('')
const shareMessage = ref('')
const savingVisibility = ref(false)
const folders = ref<any[]>([])
const draftFolderId = ref<string | undefined>(NO_FOLDER)
const savingFolder = ref(false)
const folderMessage = ref('')
const deleting = ref(false)
const deleteMessage = ref('')
const viewing = ref<{ version: number; content: string } | null>(null)
const restoring = ref<number | null>(null)
const versionMessage = ref('')
const duplicating = ref(false)
const loadError = ref('')
const loadingArtifact = ref(true)

// The artifact itself is fetched during SSR. That makes a direct load render
// the real title instead of an empty tab, and a missing artifact answer 404
// instead of a soft 200. History, folders, and the share link stay client-only:
// they are secondary panels and must not delay the document.
const { data: artifactData, error: artifactError, refresh: refreshArtifact } = await useAsyncData(
  () => `artifact:${route.params.id}`,
  () => requestFetch<any>(`/api/artifacts/${route.params.id}`),
)

const { confirm } = useConfirm()
const { add: toast } = useToast()

const visibilityOptions = [
  { label: 'Private — only you', value: 'private' },
  { label: 'Unlisted — signed link required', value: 'unlisted' },
  { label: 'Public — anyone with the link', value: 'public' },
]

const folderOptions = computed(() => [
  { label: 'No folder', value: NO_FOLDER },
  ...folders.value.map((folder: any) => ({ label: folder.path || folder.name, value: folder.id })),
])

const artifactPageTitle = computed(() => {
  const value = artifact.value
  // Before the payload resolves (or on an inline retry) the tab still needs a
  // name rather than being blank.
  if (!value) return 'Artifact'
  // The title is user content: trim the noise but keep the author's wording.
  const title = String(value.title || '').trim()
  return title || 'Artifact'
})

// A function input, so the title resolves after the artifact payload has been
// applied. A watcher would run after the SSR head snapshot is taken.
useHead(() => ({ title: artifactPageTitle.value }))


const TEXT_ARTIFACT_TYPES = ['markdown', 'html', 'json', 'javascript'] as const

const isTextArtifact = computed(() => TEXT_ARTIFACT_TYPES.includes(artifact.value?.type))

const editorLanguage = computed<EditorLanguage>(() => {
  const type = artifact.value?.type
  if (type === 'markdown' || type === 'html' || type === 'json' || type === 'javascript') return type
  return 'text'
})

const editorFilename = computed(() => {
  const stored = artifact.value?.metadata?.filename
  if (stored) return stored
  const base = String(artifact.value?.title || 'artifact')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artifact'
  const extensions: Record<EditorLanguage, string> = {
    text: 'txt',
    markdown: 'md',
    html: 'html',
    json: 'json',
    javascript: 'js',
  }
  return `${base}.${extensions[editorLanguage.value]}`
})

const dirty = computed(() => {
  if (!artifact.value) return false
  return draftContent.value !== content.value || draftTitle.value !== artifact.value.title
})

const openEditor = () => {
  if (!isTextArtifact.value) return
  message.value = ''
  saveMessageColor.value = 'danger'
  editing.value = true
}

const cancelEdit = async () => {
  if (dirty.value) {
    const accepted = await confirm({
      title: 'Discard unsaved changes?',
      description: 'Your edits to this artifact have not been saved as a version.',
      confirmLabel: 'Discard changes',
      confirmColor: 'danger',
      icon: 'lucide:undo-2',
    })
    if (!accepted) return
  }
  editing.value = false
  message.value = ''
}

watch(editing, (active) => {
  if (!import.meta.client) return
  document.documentElement.classList.toggle('serangkai-editor-workspace-open', active)
})

onBeforeUnmount(() => {
  if (import.meta.client) document.documentElement.classList.remove('serangkai-editor-workspace-open')
})

const folderPath = computed(() => folders.value.find(folder => folder.id === artifact.value?.folderId)?.path || '')

const formatDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

const loadVersions = async (page = 1) => {
  const sequence = ++historySequence
  const id = String(route.params.id)
  historyLoading.value = true
  historyError.value = ''
  try {
    const result = await $fetch<any>(`/api/artifacts/${id}/versions`, { query: { page } })
    if (sequence !== historySequence || id !== String(route.params.id)) return
    versions.value = result.versions
    versionTotal.value = result.total
    versionPage.value = result.page
    versionPageSize.value = result.pageSize
    latestVersion.value = result.latestVersion
  } catch (e: any) {
    if (sequence !== historySequence || id !== String(route.params.id)) return
    historyError.value = e?.data?.message || 'Could not load history.'
  } finally {
    if (sequence === historySequence) historyLoading.value = false
  }
}

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
  applyArtifact(res)
  shareMessage.value = ''
  await loadVersions()
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
    const res = await $fetch<any>(`/api/artifacts/${route.params.id}`, { method: 'PUT', body: { folderId: folderIdFromSelection(draftFolderId.value) } })
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

const artifactActions = computed(() => [
  [
    { label: 'Share', icon: 'lucide:share-2', onSelect: () => { sharingOpen.value = true } },
    { label: 'Move to folder', icon: 'lucide:folder-input', onSelect: () => { movingOpen.value = true } },
    { label: 'Version history', icon: 'lucide:history', onSelect: () => { historyOpen.value = true } },
    { label: 'Download', icon: 'lucide:download', to: `/api/artifacts/${route.params.id}/download` },
    { label: 'Duplicate', icon: 'lucide:copy', disabled: duplicating.value, onSelect: () => { void duplicateArtifact() } },
    ...(artifact.value?.type === 'bundle' ? [{ label: 'Open bundle', icon: 'lucide:external-link', to: `/share/${artifact.value.slug}`, target: '_blank', rel: 'noopener' }] : []),
    ...(shareUrl.value ? [{ label: 'Open share link', icon: 'lucide:external-link', to: shareUrl.value, target: '_blank', rel: 'noopener' }] : []),
  ],
  [{ label: 'Delete', icon: 'lucide:trash-2', destructive: true, disabled: deleting.value, onSelect: () => { void removeArtifact() } }],
])

// A direct load already has the artifact from SSR. Missing or forbidden
// artifacts become a real error page (with its status code) instead of a soft
// 200 with an empty shell.
const fatalStatus = (error: any) => {
  const status = Number(error?.statusCode || error?.data?.statusCode)
  return status === 404 || status === 401 || status === 403 ? status : 0
}

const showArtifactError = async (status: number) => showError({
  statusCode: status,
  statusMessage: status === 404 ? 'Artifact not found' : status === 401 ? 'Sign in required' : 'Forbidden',
  message: status === 404
    ? 'This artifact may have been deleted or moved to another account.'
    : 'Sign in again with the owner account to open this artifact.',
  url: route.fullPath,
})

const prefetchStatus = fatalStatus(artifactError.value)
if (prefetchStatus) await showArtifactError(prefetchStatus)

// Assignment helper shared by the server payload, reloads, and saves, so every
// path keeps the artifact, its content, and the draft fields in sync.
const applyArtifact = (res: any) => {
  artifact.value = res.artifact
  content.value = res.content
  contentBody.value = res.body || null
  draftTitle.value = res.artifact.title
  draftContent.value = res.content
  draftVisibility.value = res.artifact.visibility
  draftFolderId.value = folderSelection(res.artifact.folderId)
}

if (artifactData.value) applyArtifact(artifactData.value)

// Secondary panels: loaded once the document is on screen. They never block the
// artifact and never replace it on failure.
const loadSecondary = async () => {
  versions.value = []
  latestVersion.value = null
  versionTotal.value = 0
  versionPage.value = 1
  const [, folderList] = await Promise.allSettled([
    loadVersions(),
    $fetch<any>('/api/folders'),
  ])
  if (folderList.status === 'fulfilled') folders.value = folderList.value.folders || []
  await loadShareLink()
}

const reportRecoverableLoadError = () => {
  // Only a recoverable failure (network/5xx) lands here: 404/401/403 was routed
  // to the error page before the page could render.
  loadError.value = (artifactError.value as any)?.data?.message
    || artifactError.value?.message
    || 'Could not reach the server. Check your connection and try again.'
}

// Client-side navigation between two artifacts keeps this component mounted, so
// the payload watcher has to drive both the document and the secondary panels.
watch(artifactData, async (value) => {
  if (value) {
    applyArtifact(value)
    loadError.value = ''
    await loadSecondary()
    return
  }
  const status = fatalStatus(artifactError.value)
  if (status) {
    await showArtifactError(status)
    return
  }
  if (artifactError.value) reportRecoverableLoadError()
})

onMounted(async () => {
  loadingArtifact.value = false
  if (!artifactData.value) {
    if (artifactError.value) reportRecoverableLoadError()
    return
  }
  await loadSecondary()
})

const loadArtifact = async () => {
  loadingArtifact.value = true
  loadError.value = ''
  try {
    await refreshArtifact()
    if (!artifactData.value && artifactError.value) throw artifactError.value
    await loadSecondary()
  } catch (e: any) {
    const status = fatalStatus(e)
    if (status) {
      await showArtifactError(status)
      return
    }
    loadError.value = e?.data?.message || e?.message || 'Could not reach the server. Check your connection and try again.'
  } finally {
    loadingArtifact.value = false
  }
}

const save = async () => {
  if (saving.value) return
  if (!draftTitle.value.trim()) {
    saveMessageColor.value = 'danger'
    message.value = 'Add a title before saving.'
    return
  }
  if (!draftContent.value.trim()) {
    saveMessageColor.value = 'danger'
    message.value = 'Add some content before saving.'
    return
  }

  saving.value = true; message.value = ''; saveMessageColor.value = 'danger'
  try {
    const res = await $fetch<any>(`/api/artifacts/${route.params.id}`, {
      method: 'PUT',
      body: { title: draftTitle.value, content: draftContent.value, baseVersion: latestVersion.value },
    })
    artifact.value = res.artifact
    content.value = draftContent.value
    contentBody.value = res.artifact.type === 'markdown'
      ? ((await $fetch<any>(`/api/artifacts/${route.params.id}`)).body || null)
      : null
    await loadVersions()
    editing.value = false
    message.value = res.versionCreated ? `Saved version ${res.version}` : 'Saved without a new version'
  } catch (e: any) {
    const status = e.statusCode || e.response?.status
    if (status === 409) {
      // Someone else published while this editor was open. Reload so the form
      // reflects the new content, and keep the user's draft in the editor.
      const draft = draftContent.value
      const draftTitleSnapshot = draftTitle.value
      saveMessageColor.value = 'warning'
      await reloadArtifact()
      draftContent.value = draft
      draftTitle.value = draftTitleSnapshot
      message.value = 'This artifact changed since you opened it. Your edits are preserved below — review and save again to publish them on top of the latest version.'
    } else {
      saveMessageColor.value = 'danger'
      message.value = e.data?.message || 'Could not save'
    }
  }
  finally { saving.value = false }
}
</script>

<style scoped>
.artifact-reader { min-width: 0; }
.artifact-toolbar { position: sticky; top: 4rem; z-index: 10; display: flex; align-items: center; gap: .5rem; min-height: 3.5rem; padding: .5rem 1rem; border-bottom: 1px solid var(--selaras-resolved-border-muted); background: var(--selaras-resolved-surface-canvas); }
.artifact-document { min-width: 0; padding: 1.5rem 1rem 4rem; }
.artifact-document-markdown { max-width: 58rem; margin-inline: auto; padding-top: 2.5rem; }
.artifact-document-markdown :deep(.selaras-prose :is(h1, h2, h3, h4):first-child) { margin-block-start: 0; }
.artifact-notice { padding: .75rem 1.5rem; font-size: .75rem; color: var(--selaras-resolved-text-muted); }
@media (min-width: 768px) { .artifact-document { padding-inline: 2.5rem; }.artifact-toolbar { padding-inline: 1.5rem; } }
@media (min-width: 1024px) { .artifact-toolbar { top: 0; }.artifact-document-markdown { padding-top: 3.5rem; } }
</style>
