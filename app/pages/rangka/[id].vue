<template>
  <div v-if="rangka">
    <section v-if="editing" class="serangkai-editor-workspace" aria-label="Rangka editor">
      <header class="serangkai-editor-workspace-bar">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <STooltip text="Back to rangka"><SButton variant="ghost" color="neutral" icon="lucide:arrow-left" aria-label="Close editor" class="shrink-0" @click="cancelEdit" /></STooltip>
          <SInput v-model="draftTitle" aria-label="Title" class="min-w-0 max-w-xl flex-1" :ui="{ base: 'bg-transparent font-semibold ring-0 not-focus:hover:ring-0' }" />
          <SBadge :label="rangka.type" variant="subtle" color="neutral" size="sm" class="hidden md:inline-flex" />
          <span v-if="dirty" role="status" class="hidden shrink-0 text-xs text-[var(--selaras-resolved-text-muted)] lg:inline">Unsaved changes</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <SButton variant="ghost" color="neutral" class="hidden sm:inline-flex" @click="cancelEdit">Cancel</SButton>
          <STooltip text="Save version"><SButton icon="lucide:check" aria-label="Save version" :loading="saving" :disabled="saving" @click="save"><span class="hidden sm:inline">Save version</span></SButton></STooltip>
        </div>
      </header>

      <div class="serangkai-editor-workspace-body">
        <SAlert v-if="message" :color="saveMessageColor" variant="subtle" :title="message" class="m-3 shrink-0" />
        <SerangkaiCodeEditor
          v-model="draftContent"
          :language="editorLanguage"
          :filename="editorFilename"
          :version="latestVersion"
          :dirty="dirty"
          fill
          embedded
          aria-label="Content"
          @save="save"
        />
      </div>
    </section>

    <div v-else class="rangka-reader">
      <header class="rangka-toolbar">
        <STooltip text="Back to rangka list"><SButton to="/" variant="ghost" color="neutral" icon="lucide:arrow-left" aria-label="Back to rangka list" class="shrink-0" /></STooltip>
        <div class="min-w-0 flex-1">
          <h1 class="min-w-0" :aria-label="rangka.title">
            <STooltip :text="rangka.title"><span class="inline-flex min-w-0 max-w-full"><SDropdown :positioning="{ collisionPadding: 12 }" :items="rangkaActions" :adaptive="true"><SButton variant="ghost" color="neutral" trailing-icon="lucide:chevron-down" aria-label="Rangka actions" class="min-w-0 max-w-full"><span class="truncate">{{ rangka.title }}</span></SButton></SDropdown></span></STooltip>
          </h1>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <STooltip v-if="isTextRangka" text="Edit"><SButton variant="ghost" color="neutral" icon="lucide:pencil" :disabled="historyLoading || latestVersion === null" aria-label="Edit" @click="openEditor"><span class="hidden sm:inline">Edit</span></SButton></STooltip>
          <STooltip text="History"><SButton variant="ghost" color="neutral" icon="lucide:history" aria-label="History" @click="historyOpen = true" /></STooltip>
          <STooltip text="Share"><SButton variant="outline" color="neutral" icon="lucide:share-2" aria-label="Share" @click="sharingOpen = true"><span class="hidden sm:inline">Share</span></SButton></STooltip>
        </div>
      </header>
      <p v-if="message" class="rangka-notice" role="status">{{ message }}</p>
      <SAlert v-if="deleteMessage" color="danger" variant="subtle" :title="deleteMessage" />

      <section class="rangka-document" aria-label="Rangka content" :class="{ 'rangka-document-markdown': rangka.type === 'markdown' }">
            <img
              v-if="rangka.type === 'image'"
              :src="`/api/rangka/${rangka.id}/preview`"
              :alt="rangka.title"
              class="max-h-[70vh] max-w-full rounded-md border border-[var(--selaras-resolved-border-default)]"
            />
            <iframe
              v-else-if="rangka.type === 'pdf'"
              :src="`/api/rangka/${rangka.id}/preview`"
              :title="`${rangka.title} PDF`"
              class="min-h-[70vh] w-full flex-1 rounded-md border border-[var(--selaras-resolved-border-default)]"
            />
            <SerangkaiHtmlPreview
              v-else-if="rangka.type === 'html'"
              :src="`/api/rangka/${rangka.id}/preview`"
              :title="`${rangka.title} HTML preview`"
              auto-height
              class="min-h-[70vh]"
            />
            <div v-else-if="rangka.type === 'markdown'" class="min-w-0 w-full">
              <MarkdownDocument :body="contentBody" />
            </div>
            <SerangkaiCode
              v-else-if="rangka.type === 'json' || rangka.type === 'javascript'"
              :code="content"
              :language="rangka.type === 'json' ? 'json' : 'javascript'"
              :filename="rangka.metadata?.filename"
            />
            <pre v-else class="overflow-auto whitespace-pre-wrap rounded-md bg-[var(--selaras-resolved-surface-elevated)] p-4 font-mono text-sm">{{ content }}</pre>
      </section>


      <SModal v-model:open="sharingOpen" title="Share rangka" description="Choose who can open this rangka.">
        <template #body>

            <div class="mt-3 space-y-3">
              <SFormField v-slot="{ id }" label="Visibility">
                <SSelect :id="id" v-model="draftVisibility" :items="visibilityOptions" class="w-full" />
              </SFormField>

              <div class="flex flex-wrap gap-2">
                <SButton icon="lucide:eye" :loading="savingVisibility" :disabled="savingVisibility" @click="saveVisibility">Save visibility</SButton>
                <SButton v-if="draftVisibility !== 'private'" variant="outline" :to="shareUrl || undefined" target="_blank" rel="noopener" :disabled="!shareUrl">Open link</SButton>
              </div>

              <p v-if="draftVisibility === 'private'" class="text-sm text-[var(--selaras-resolved-text-muted)]">Only you can open this rangka.</p>
              <template v-else-if="shareUrl">
                <SFormField label="Share link">
                  <SInput :model-value="shareUrl" readonly aria-label="Share link" class="w-full font-mono text-xs">
                    <template #trailing="{ buttonSize }">
                      <SerangkaiCopyButton :value="shareUrl" label="share link" :size="buttonSize" />
                    </template>
                  </SInput>
                </SFormField>
                <p class="text-sm text-[var(--selaras-resolved-text-muted)]">
                  {{ draftVisibility === 'unlisted' ? 'The signed link is required. Anyone with it can read this rangka.' : 'Anyone with the link can read this rangka.' }}
                </p>
              </template>
              <p v-if="shareMessage" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ shareMessage }}</p>
            </div>
        </template>
      </SModal>

      <SModal v-model:open="movingOpen" title="Move rangka" :description="folderPath ? `Currently in ${folderPath}` : 'Choose a folder for this rangka.'">
        <template #body>
            <div class="mt-3 space-y-2">
              <SFormField v-slot="{ id }" label="Move to">
                <SSelect :id="id" v-model="draftFolderId" :items="folderOptions" placeholder="No folder" clearable class="w-full" />
              </SFormField>
              <SButton icon="lucide:folder-input" :loading="savingFolder" :disabled="savingFolder" @click="saveFolder">Move rangka</SButton>
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
    title="Could not load this rangka"
    :description="loadError"
    retry-label="Try again"
    @retry="loadRangka"
  />

  <SerangkaiRangkaSkeleton v-else-if="loadingRangka" />

  <div v-else class="serangkai-panel p-12 text-center">
    <p class="text-sm text-[var(--selaras-resolved-text-muted)]">Rangka unavailable.</p>
    <SButton class="mt-4" variant="outline" icon="lucide:refresh-cw" @click="loadRangka">
      Try again
    </SButton>
  </div>
</template>

<script setup lang="ts">
import { NO_FOLDER, folderIdFromSelection, folderSelection } from '~/utils/folders'
import type { EditorLanguage } from '~/utils/editor'
import { onBeforeRouteLeave } from 'vue-router'

const route = useRoute()
const requestFetch = useRequestFetch()
const rangka = ref<any>(null)
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
const loadingRangka = ref(true)

// The rangka itself is fetched during SSR. That makes a direct load render
// the real title instead of an empty tab, and a missing rangka answer 404
// instead of a soft 200. History, folders, and the share link stay client-only:
// they are secondary panels and must not delay the document.
const { data: rangkaData, error: rangkaError, refresh: refreshRangka } = await useAsyncData(
  () => `rangka:${route.params.id}`,
  () => requestFetch<any>(`/api/rangka/${route.params.id}`),
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

const rangkaPageTitle = computed(() => {
  const value = rangka.value
  // Before the payload resolves (or on an inline retry) the tab still needs a
  // name rather than being blank.
  if (!value) return 'Rangka'
  // The title is user content: trim the noise but keep the author's wording.
  const title = String(value.title || '').trim()
  return title || 'Rangka'
})

// A function input, so the title resolves after the rangka payload has been
// applied. A watcher would run after the SSR head snapshot is taken.
useHead(() => ({ title: rangkaPageTitle.value }))


const TEXT_RANGKA_TYPES = ['markdown', 'html', 'json', 'javascript'] as const

const isTextRangka = computed(() => TEXT_RANGKA_TYPES.includes(rangka.value?.type))

const editorLanguage = computed<EditorLanguage>(() => {
  const type = rangka.value?.type
  if (type === 'markdown' || type === 'html' || type === 'json' || type === 'javascript') return type
  return 'text'
})

const editorFilename = computed(() => {
  const stored = rangka.value?.metadata?.filename
  if (stored) return stored
  const base = String(rangka.value?.title || 'rangka')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'rangka'
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
  if (!rangka.value) return false
  return draftContent.value !== content.value || draftTitle.value !== rangka.value.title
})

const openEditor = () => {
  if (!isTextRangka.value) return
  message.value = ''
  saveMessageColor.value = 'danger'
  editing.value = true
}

const cancelEdit = async () => {
  if (dirty.value) {
    const accepted = await confirm({
      title: 'Discard unsaved changes?',
      description: 'Your edits to this rangka have not been saved as a version.',
      confirmLabel: 'Discard changes',
      confirmColor: 'danger',
      icon: 'lucide:undo-2',
    })
    if (!accepted) return
  }
  draftTitle.value = rangka.value.title
  draftContent.value = content.value
  editing.value = false
  message.value = ''
}

onBeforeRouteLeave(async () => {
  if (!editing.value || !dirty.value) return true
  return await confirm({ title: 'Discard unsaved changes?', description: 'Your edits to this rangka have not been saved as a version.', confirmLabel: 'Discard changes', confirmColor: 'danger', icon: 'lucide:undo-2' })
})

const beforeUnload = (event: BeforeUnloadEvent) => { if (editing.value && dirty.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

const folderPath = computed(() => folders.value.find(folder => folder.id === rangka.value?.folderId)?.path || '')

const formatDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

const loadVersions = async (page = 1) => {
  const sequence = ++historySequence
  const id = String(route.params.id)
  historyLoading.value = true
  historyError.value = ''
  try {
    const result = await $fetch<any>(`/api/rangka/${id}/versions`, { query: { page } })
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
    const res = await $fetch(`/api/rangka/${route.params.id}/versions/${version}`)
    viewing.value = { version: res.version.version, content: res.content }
  } catch (e: any) {
    versionMessage.value = e.data?.message || `Could not load version ${version}`
  }
}

const closeViewing = () => { viewing.value = null }

const restoreVersion = async (version: number) => {
  restoring.value = version; versionMessage.value = ''
  try {
    const res = await $fetch(`/api/rangka/${route.params.id}/versions/${version}/restore`, { method: 'POST' })
    versionMessage.value = `Restored version ${version} as version ${res.version}.`
    await reloadRangka()
  } catch (e: any) {
    versionMessage.value = e.data?.message || `Could not restore version ${version}`
  } finally {
    restoring.value = null
  }
}

const reloadRangka = async () => {
  const res = await $fetch<any>(`/api/rangka/${route.params.id}`)
  applyRangka(res)
  shareMessage.value = ''
  await loadVersions()
}

const loadShareLink = async () => {
  shareUrl.value = ''
  if (draftVisibility.value === 'private') return
  try {
    const link = await $fetch<any>(`/api/rangka/${route.params.id}/share`, { method: 'POST' })
    shareUrl.value = link.url
  } catch (e: any) {
    shareMessage.value = e.data?.message || 'Could not create a share link'
  }
}

const saveVisibility = async () => {
  savingVisibility.value = true; shareMessage.value = ''
  try {
    const res = await $fetch<any>(`/api/rangka/${route.params.id}`, { method: 'PUT', body: { visibility: draftVisibility.value } })
    rangka.value = res.rangka
    await loadShareLink()
    if (!shareMessage.value) shareMessage.value = 'Sharing settings saved.'
  } catch (e: any) { shareMessage.value = e.data?.message || 'Could not save sharing settings' }
  finally { savingVisibility.value = false }
}

const saveFolder = async () => {
  savingFolder.value = true; folderMessage.value = ''
  try {
    const res = await $fetch<any>(`/api/rangka/${route.params.id}`, { method: 'PUT', body: { folderId: folderIdFromSelection(draftFolderId.value) } })
    rangka.value = res.rangka
    folderMessage.value = 'Folder updated.'
  } catch (e: any) { folderMessage.value = e.data?.message || 'Could not move rangka' }
  finally { savingFolder.value = false }
}

const duplicateRangka = async () => {
  duplicating.value = true; deleteMessage.value = ''
  try {
    const res = await $fetch<any>(`/api/rangka/${route.params.id}/duplicate`, { method: 'POST' })
    await navigateTo(`/rangka/${res.rangka.id}`)
  } catch (e: any) {
    deleteMessage.value = e.data?.message || 'Could not duplicate rangka'
  } finally {
    duplicating.value = false
  }
}

const removeRangka = async () => {
  deleteMessage.value = ''
  const accepted = await confirm({
    title: `Delete “${rangka.value?.title}”?`,
    description: 'This removes the rangka, every version, and its stored files. It cannot be undone.',
    confirmLabel: 'Delete rangka',
    confirmColor: 'danger',
    icon: 'lucide:trash-2',
  })
  if (!accepted) return

  deleting.value = true
  try {
    await $fetch(`/api/rangka/${route.params.id}`, { method: 'DELETE' })
    toast({ title: 'Rangka deleted', color: 'success' })
    await navigateTo('/workspace')
  } catch (e: any) {
    deleteMessage.value = e.data?.message || 'Could not delete rangka'
  } finally {
    deleting.value = false
  }
}

const rangkaActions = computed(() => [
  [
    { label: 'Share', icon: 'lucide:share-2', onSelect: () => { sharingOpen.value = true } },
    { label: 'Move to folder', icon: 'lucide:folder-input', onSelect: () => { movingOpen.value = true } },
    { label: 'Version history', icon: 'lucide:history', onSelect: () => { historyOpen.value = true } },
    { label: 'Download', icon: 'lucide:download', to: `/api/rangka/${route.params.id}/download` },
    { label: 'Duplicate', icon: 'lucide:copy', disabled: duplicating.value, onSelect: () => { void duplicateRangka() } },
    ...(rangka.value?.type === 'bundle' ? [{ label: 'Open bundle', icon: 'lucide:external-link', to: `/share/${rangka.value.slug}`, target: '_blank', rel: 'noopener' }] : []),
    ...(shareUrl.value ? [{ label: 'Open share link', icon: 'lucide:external-link', to: shareUrl.value, target: '_blank', rel: 'noopener' }] : []),
  ],
  [{ label: 'Delete', icon: 'lucide:trash-2', destructive: true, disabled: deleting.value, onSelect: () => { void removeRangka() } }],
])

// A direct load already has the rangka from SSR. Missing or forbidden
// rangka become a real error page (with its status code) instead of a soft
// 200 with an empty shell.
const fatalStatus = (error: any) => {
  const status = Number(error?.statusCode || error?.data?.statusCode)
  return status === 404 || status === 401 || status === 403 ? status : 0
}

const showRangkaError = async (status: number) => showError({
  statusCode: status,
  statusMessage: status === 404 ? 'Rangka not found' : status === 401 ? 'Sign in required' : 'Forbidden',
  message: status === 404
    ? 'This rangka may have been deleted or moved to another account.'
    : 'Sign in again with the owner account to open this rangka.',
  url: route.fullPath,
})

const prefetchStatus = fatalStatus(rangkaError.value)
if (prefetchStatus) await showRangkaError(prefetchStatus)

// Assignment helper shared by the server payload, reloads, and saves, so every
// path keeps the rangka, its content, and the draft fields in sync.
const applyRangka = (res: any) => {
  rangka.value = res.rangka
  content.value = res.content
  contentBody.value = res.body || null
  draftTitle.value = res.rangka.title
  draftContent.value = res.content
  draftVisibility.value = res.rangka.visibility
  draftFolderId.value = folderSelection(res.rangka.folderId)
}

if (rangkaData.value) applyRangka(rangkaData.value)

// Secondary panels: loaded once the document is on screen. They never block the
// rangka and never replace it on failure.
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
  loadError.value = (rangkaError.value as any)?.data?.message
    || rangkaError.value?.message
    || 'Could not reach the server. Check your connection and try again.'
}

// Client-side navigation between two rangka keeps this component mounted, so
// the payload watcher has to drive both the document and the secondary panels.
watch(rangkaData, async (value) => {
  if (value) {
    applyRangka(value)
    loadError.value = ''
    await loadSecondary()
    return
  }
  const status = fatalStatus(rangkaError.value)
  if (status) {
    await showRangkaError(status)
    return
  }
  if (rangkaError.value) reportRecoverableLoadError()
})

onMounted(async () => {
  loadingRangka.value = false
  if (!rangkaData.value) {
    if (rangkaError.value) reportRecoverableLoadError()
    return
  }
  await loadSecondary()
})

const loadRangka = async () => {
  loadingRangka.value = true
  loadError.value = ''
  try {
    await refreshRangka()
    if (!rangkaData.value && rangkaError.value) throw rangkaError.value
    await loadSecondary()
  } catch (e: any) {
    const status = fatalStatus(e)
    if (status) {
      await showRangkaError(status)
      return
    }
    loadError.value = e?.data?.message || e?.message || 'Could not reach the server. Check your connection and try again.'
  } finally {
    loadingRangka.value = false
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
    const res = await $fetch<any>(`/api/rangka/${route.params.id}`, {
      method: 'PUT',
      body: { title: draftTitle.value, content: draftContent.value, baseVersion: latestVersion.value },
    })
    rangka.value = res.rangka
    content.value = draftContent.value
    contentBody.value = res.rangka.type === 'markdown'
      ? ((await $fetch<any>(`/api/rangka/${route.params.id}`)).body || null)
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
      await reloadRangka()
      draftContent.value = draft
      draftTitle.value = draftTitleSnapshot
      message.value = 'This rangka changed since you opened it. Your edits are preserved below — review and save again to publish them on top of the latest version.'
    } else {
      saveMessageColor.value = 'danger'
      message.value = e.data?.message || 'Could not save'
    }
  }
  finally { saving.value = false }
}
</script>

<style scoped>
.rangka-reader { min-width: 0; }
.rangka-toolbar { position: sticky; top: 4rem; z-index: 10; display: flex; align-items: center; gap: .5rem; min-height: 3.5rem; padding: .5rem 1rem; border-bottom: 1px solid var(--selaras-resolved-border-muted); background: var(--selaras-resolved-surface-canvas); }
.rangka-document { min-width: 0; padding: 1.5rem 1rem 4rem; }
.rangka-document-markdown { max-width: 58rem; margin-inline: auto; padding-top: 2.5rem; }
.rangka-document-markdown :deep(.selaras-prose :is(h1, h2, h3, h4):first-child) { margin-block-start: 0; }
.rangka-notice { padding: .75rem 1.5rem; font-size: .75rem; color: var(--selaras-resolved-text-muted); }
@media (min-width: 768px) { .rangka-document { padding-inline: 2.5rem; }.rangka-toolbar { padding-inline: 1.5rem; } }
@media (min-width: 1024px) { .rangka-toolbar { top: 0; }.rangka-document-markdown { padding-top: 3.5rem; } }
</style>
