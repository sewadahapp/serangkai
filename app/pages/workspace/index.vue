<template>
  <div class="workspace-page space-y-6">
    <div class="workspace-heading">
      <div><h1>Workspace</h1><p>Create, upload, and organize your artifacts.</p></div>
      <div class="workspace-actions">
        <SButton variant="outline" icon="lucide:folder-plus" aria-label="New folder" title="New folder" @click="openNewFolder"><span class="hidden sm:inline">New folder</span></SButton>
        <SButton variant="outline" icon="lucide:upload" aria-label="Upload" title="Upload" @click="openUpload"><span class="hidden sm:inline">Upload</span></SButton>
        <SButton icon="lucide:file-plus" aria-label="New artifact" title="New artifact" @click="openNewArtifact"><span class="hidden sm:inline">New artifact</span></SButton>
      </div>
    </div>

    <SModal v-model:open="showNewFolder" title="Create folder" description="Nest it under a folder or keep it at the top level." :dismissible="!saving" :close="!saving">
      <template #body>
        <form id="new-folder-form" class="space-y-4" @submit.prevent="createFolder">
          <SFormField label="Folder name" required><SInput v-model="folderName" placeholder="Folder name" required class="w-full" /></SFormField>
          <SFormField v-slot="{ id }" label="Parent"><SSelect :id="id" v-model="parentFolderId" :items="parentOptions" placeholder="Top level" class="w-full" /></SFormField>
          <SAlert v-if="error" color="danger" variant="subtle" :title="error" />
        </form>
      </template>
      <template #footer><div class="flex justify-end gap-2"><SButton variant="ghost" :disabled="saving" @click="showNewFolder = false">Cancel</SButton><SButton type="submit" form="new-folder-form" :loading="saving" :disabled="saving">Create folder</SButton></div></template>
    </SModal>

    <SModal v-model:open="showUpload" :ui="{ content: 'max-w-2xl' }" title="Upload artifact" description="Add a file to your workspace." :dismissible="!uploading" :close="!uploading">
      <template #body>
        <form id="upload-form" class="space-y-4" @submit.prevent="uploadArtifact">
          <div>
            <p class="text-sm font-medium">File <span class="text-[var(--selaras-resolved-color-danger-text)]">*</span></p>
            <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">Markdown, HTML, JS, JSON, PDF, images, or a ZIP bundle. Up to 25 MiB.</p>
            <SFileUpload v-model="uploadFiles" :accept="acceptTypes" :max-size="MAX_UPLOAD_BYTES" class="mt-2" @error="onUploadError" />
          </div>
          <SFormField label="Title"><SInput v-model="uploadTitle" placeholder="Optional" class="w-full" /></SFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <SFormField v-slot="{ id }" label="Visibility"><SSelect :id="id" v-model="uploadVisibility" :items="visibilityOptions" class="w-full" /></SFormField>
            <SFormField v-slot="{ id }" label="Folder"><SSelect :id="id" v-model="uploadFolderId" :items="artifactFolderOptions" placeholder="No folder" clearable class="w-full" /></SFormField>
          </div>
          <p v-if="uploadFiles.length" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ uploadFiles[0].name }} · {{ formatBytes(uploadFiles[0].size) }}</p>
          <p v-if="uploading" role="status" class="text-sm text-[var(--selaras-resolved-text-muted)]">Uploading artifact…</p>
          <SAlert v-if="uploadError" color="warning" variant="subtle" :title="uploadError" />
          <SAlert v-if="error" color="danger" variant="subtle" :title="error" />
        </form>
      </template>
      <template #footer><div class="flex justify-end gap-2"><SButton variant="ghost" :disabled="uploading" @click="showUpload = false">Cancel</SButton><SButton type="submit" form="upload-form" :loading="uploading" :disabled="uploading || !uploadFiles.length">Upload artifact</SButton></div></template>
    </SModal>

    <SerangkaiErrorState
      v-if="loadError"
      title="Could not load the workspace"
      :description="loadError"
      retry-label="Try again"
      @retry="retryWorkspace"
    />

    <SerangkaiWorkspaceSkeleton v-else-if="loadingWorkspace" />

    <div v-else class="workspace-shell">
      <aside class="workspace-sidebar hidden lg:block">
        <div class="workspace-folder-list">
          <div class="workspace-sidebar-heading"><span>WORKSPACE</span><SIcon name="lucide:panel-left" class="size-4" aria-hidden="true" /></div>
          <SerangkaiFolderList :rows="folderRows" :selected-id="selectedFolderId" :total="workspaceTotal" :count="folderArtifactCount" :actions="folderActions" @select="selectFolder" />
        </div>
      </aside>

      <section class="workspace-content" aria-labelledby="artifact-list">
        <SSlideover v-model:open="folderPanelOpen" side="left" title="Folders" description="Choose a folder to browse its artifacts.">
          <template #default>
            <SButton variant="outline" icon="lucide:panel-left" class="mb-4 lg:hidden">Browse folders</SButton>
          </template>
          <template #body>
            <SerangkaiFolderList :rows="folderRows" :selected-id="selectedFolderId" :total="workspaceTotal" :count="folderArtifactCount" :actions="folderActions" @select="selectFolder" />
          </template>
        </SSlideover>
        <div class="workspace-breadcrumb">Workspace <span>/</span> {{ selectedFolder ? selectedFolder.name : 'All artifacts' }}</div>
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="artifact-list" class="workspace-list-title">
              {{ appliedQuery ? 'Search results' : selectedFolder ? selectedFolder.name : 'All artifacts' }}
            </h2>
            <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">
              <template v-if="searchPending">Searching…</template>
              <template v-else-if="appliedQuery">
                {{ selectedFolder ? `In ${selectedFolder.name} and its subfolders` : 'Across all artifacts and folders' }} · {{ totalArtifacts }} found
              </template>
              <template v-else>{{ totalArtifacts }} {{ totalArtifacts === 1 ? 'artifact' : 'artifacts' }}</template>
            </p>
          </div>

          <div class="w-full sm:w-72">
            <SInput
              :model-value="searchQuery"
              type="search"
              aria-label="Search artifacts and folders"
              placeholder="Search artifacts and folders…"
              icon="lucide:search"
              clearable
              class="w-full"
              @update:model-value="updateSearch"
            />
          </div>
        </div>

        <div v-if="visibleArtifacts.length" class="space-y-2">
          <div
            v-for="artifact in visibleArtifacts"
            :key="artifact.id"
            class="workspace-artifact group flex items-center gap-3 transition-colors"
          >
            <NuxtLink
              :to="`/artifacts/${artifact.id}`"
              class="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--selaras-resolved-color-primary-focus)]"
            >
              <span
                class="workspace-artifact-icon grid size-10 shrink-0 place-items-center rounded-md transition-colors"
                aria-hidden="true"
              >
                <SIcon :name="artifactIcon(artifact.type)" class="size-5" />
              </span>
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <h3 class="min-w-0 flex-1 truncate font-medium group-hover:underline group-hover:underline-offset-4">{{ artifact.title }}</h3>
                  <SBadge
                    :label="visibilityLabel(artifact.visibility)"
                    variant="subtle"
                    :color="visibilityColor(artifact.visibility)"
                    size="sm"
                    class="shrink-0"
                  />
                </div>
                <div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--selaras-resolved-text-muted)]">
                  <span>{{ artifactTypeLabel(artifact.type) }}</span>
                  <span v-if="artifact.folderId" class="max-w-full truncate">· {{ folderPathLabel(artifact.folderId) }}</span>
                  <span aria-hidden="true">·</span>
                  <span class="whitespace-nowrap">
                    Updated
                    <time :datetime="artifact.updatedAt" :title="fullDate(artifact.updatedAt)">{{ formatDate(artifact.updatedAt) }}</time>
                  </span>
                </div>
              </div>
            </NuxtLink>

            <SButton
              v-if="artifact.shareUrl"
              variant="ghost"
              size="sm"
              icon="lucide:external-link"
              :to="artifact.shareUrl || undefined"
              target="_blank"
              rel="noopener"
              :aria-label="`Preview ${artifact.title}`"
              :title="`Preview ${artifact.title}`"
              class="shrink-0"
            >
              <span class="hidden sm:inline">Preview</span>
            </SButton>
          </div>
        </div>

        <SEmptyState
          v-else
          icon="lucide:file-text"
          :title="appliedQuery ? 'No matches' : 'No artifacts yet'"
          :description="appliedQuery ? 'Try another phrase, or clear the search to see everything.' : 'Create an artifact or upload a file to get started.'"
        >
          <template #actions>
            <SButton v-if="searchQuery.trim()" variant="outline" icon="lucide:x" @click="clearSearch">Clear search</SButton>
            <SButton v-else icon="lucide:file-plus" @click="openNewArtifact">New artifact</SButton>
          </template>
        </SEmptyState>
        <nav v-if="totalPages > 1" aria-label="Artifact pages" class="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span class="text-sm text-[var(--selaras-resolved-text-muted)]">Page {{ currentPage }} of {{ totalPages }}</span>
          <div class="flex gap-2">
            <SButton variant="outline" size="sm" :disabled="currentPage <= 1 || searchPending" @click="changePage(currentPage - 1)">Previous</SButton>
            <SButton variant="outline" size="sm" :disabled="currentPage >= totalPages || searchPending" @click="changePage(currentPage + 1)">Next</SButton>
          </div>
        </nav>
      </section>
    </div>

    <SModal v-model:open="showFolderDialog" :title="folderDialogMode === 'rename' ? 'Rename folder' : 'Move folder'" :description="selectedFolder ? `Manage ${selectedFolder.name}` : undefined">
      <template #body>
        <form id="folder-action-form" class="space-y-4" @submit.prevent="saveFolderDialog">
          <SFormField v-if="folderDialogMode === 'rename'" label="Folder name" required>
            <SInput v-model="renameValue" placeholder="Folder name" required class="w-full" />
          </SFormField>
          <SFormField v-else v-slot="{ id }" label="Move under">
            <SSelect :id="id" v-model="moveParentId" :items="moveTargetOptions" placeholder="Top level" class="w-full" />
          </SFormField>
          <SAlert v-if="folderMessage" color="danger" variant="subtle" :title="folderMessage" />
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <SButton variant="ghost" @click="showFolderDialog = false">Cancel</SButton>
          <SButton type="submit" form="folder-action-form" :loading="savingFolder" :disabled="savingFolder">{{ folderDialogMode === 'rename' ? 'Save name' : 'Move folder' }}</SButton>
        </div>
      </template>
    </SModal>
  </div>
</template>

<script setup lang="ts">
import { NO_FOLDER, folderIdFromSelection, folderSelection } from '~/utils/folders'

useHead({ title: 'Workspace' })

interface Folder {
  id: string
  name: string
  parentId: string | null
  path: string
}

interface Artifact {
  id: string
  title: string
  type: string
  visibility: string
  folderId: string | null
  updatedAt: string
  shareUrl: string | null
}

const folders = ref<Folder[]>([])
const artifacts = ref<Artifact[]>([])
const folderCounts = ref<Array<{ folderId: string | null; value: number }>>([])
const totalArtifacts = ref(0)
const currentPage = ref(1)
const pageSize = ref(25)
const totalPages = computed(() => Math.max(1, Math.ceil(totalArtifacts.value / pageSize.value)))
const workspaceTotal = computed(() => folderCounts.value.reduce((sum, row) => sum + row.value, 0))
const searchQuery = ref('')
// The query whose results are currently on screen. Keeping it separate from
// the input value avoids labeling the previous list as the new search.
const appliedQuery = ref('')
const searchPending = ref(false)
const folderName = ref('')
const parentFolderId = ref<string | undefined>(NO_FOLDER)
const selectedFolderId = ref<string | null>(null)
const folderPanelOpen = ref(false)
const renameValue = ref('')
const moveParentId = ref<string | undefined>(NO_FOLDER)
const saving = ref(false)
const savingFolder = ref(false)
const folderMessage = ref('')
const showFolderDialog = ref(false)
const folderDialogMode = ref<'rename' | 'move'>('rename')
const error = ref('')
const loadError = ref('')
const loadingWorkspace = ref(true)
let searchSequence = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const { confirm } = useConfirm()
const { add: toast } = useToast()

const showNewFolder = ref(false)
const showUpload = ref(false)
const uploadFiles = ref<File[]>([])
const uploadError = ref('')
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const acceptTypes = '.md,.markdown,.txt,.html,.htm,.js,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip' 
const uploadTitle = ref('')
const uploadVisibility = ref('private')
const uploadFolderId = ref<string | undefined>(NO_FOLDER)
const uploading = ref(false)

const folderMap = computed(() => new Map(folders.value.map(folder => [folder.id, folder])))

const folderRows = computed(() => {
  const byId = folderMap.value
  const children = new Map<string | null, Folder[]>()
  for (const folder of folders.value) {
    const parentKey = folder.parentId && byId.has(folder.parentId) ? folder.parentId : null
    if (!children.has(parentKey)) children.set(parentKey, [])
    children.get(parentKey)!.push(folder)
  }
  const rows: Array<Folder & { depth: number }> = []
  const seen = new Set<string>()
  const walk = (parentKey: string | null, depth: number) => {
    const list = [...(children.get(parentKey) || [])].sort((a, b) => a.name.localeCompare(b.name))
    for (const folder of list) {
      if (seen.has(folder.id)) continue
      seen.add(folder.id)
      rows.push({ ...folder, depth })
      walk(folder.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
})

const visibilityOptions = [
  { label: 'Private', value: 'private' },
  { label: 'Unlisted', value: 'unlisted' },
  { label: 'Public', value: 'public' },
]

const artifactTypeMeta: Record<string, { icon: string; label: string }> = {
  markdown: { icon: 'lucide:file-text', label: 'Markdown' },
  html: { icon: 'lucide:code-xml', label: 'HTML' },
  json: { icon: 'lucide:braces', label: 'JSON' },
  javascript: { icon: 'lucide:file-code-2', label: 'JavaScript' },
  image: { icon: 'lucide:image', label: 'Image' },
  pdf: { icon: 'lucide:file-type-2', label: 'PDF' },
  bundle: { icon: 'lucide:package', label: 'Bundle' },
}

const artifactIcon = (type: string) => artifactTypeMeta[type]?.icon || 'lucide:file'
const artifactTypeLabel = (type: string) => artifactTypeMeta[type]?.label || type
const visibilityLabel = (visibility: string) => visibility.charAt(0).toUpperCase() + visibility.slice(1)
const visibilityColor = (visibility: string) => (
  visibility === 'private' ? 'neutral' : visibility === 'public' ? 'success' : 'accent'
)

const folderOption = (row: Folder & { depth: number }) => ({ label: `${'— '.repeat(row.depth)}${row.name}`, value: row.id })

const moveTargets = computed(() => {
  if (!selectedFolderId.value) return folderRows.value
  const blocked = descendantIds(selectedFolderId.value)
  return folderRows.value.filter(row => !blocked.has(row.id))
})

const parentOptions = computed(() => [{ label: 'Top level', value: NO_FOLDER }, ...folderRows.value.map(folderOption)])
const artifactFolderOptions = computed(() => [{ label: 'No folder', value: NO_FOLDER }, ...folderRows.value.map(folderOption)])
const moveTargetOptions = computed(() => [{ label: 'Top level', value: NO_FOLDER }, ...moveTargets.value.map(folderOption)])

const selectedFolder = computed(() => selectedFolderId.value ? folderMap.value.get(selectedFolderId.value) || null : null)

const descendantIds = (folderId: string) => {
  const ids = new Set([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders.value) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        changed = true
      }
    }
  }
  return ids
}



const visibleArtifacts = computed(() => artifacts.value)

const folderArtifactCount = (folderId: string) => {
  const ids = descendantIds(folderId)
  return folderCounts.value.reduce((sum, row) => sum + (row.folderId && ids.has(row.folderId) ? row.value : 0), 0)
}

const folderPathLabel = (folderId: string) => {
  const path = folderMap.value.get(folderId)?.path || ''
  return path.replace(/^\//, '').replaceAll('/', ' / ')
}

const formatDate = (value: string) => {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 86_400_000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const fullDate = (value: string) => new Date(value).toLocaleString()

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const closePanels = () => { showNewFolder.value = false; showUpload.value = false }

const openNewFolder = () => {
  closePanels()
  parentFolderId.value = folderSelection(selectedFolderId.value)
  showNewFolder.value = true
  error.value = ''
}

const openNewArtifact = () => navigateTo({ path: '/workspace/new', query: selectedFolderId.value ? { folderId: selectedFolderId.value } : {} })

const openUpload = () => {
  closePanels()
  uploadFolderId.value = folderSelection(selectedFolderId.value)
  uploadFiles.value = []
  uploadError.value = ''
  uploadTitle.value = ''
  showUpload.value = true
  error.value = ''
}

const onUploadError = (rejected: Array<{ file: File; reason: string }>) => {
  uploadError.value = rejected.map(item => `${item.file.name}: ${item.reason}`).join(', ')
}

watch(uploadFiles, (files) => {
  if (files.length && !uploadTitle.value) uploadTitle.value = files[0].name.replace(/\.[^.]+$/, '')
})

const selectFolder = (folderId: string | null) => {
  folderPanelOpen.value = false
  selectedFolderId.value = folderId
  renameValue.value = folderId ? folderMap.value.get(folderId)?.name || '' : ''
  moveParentId.value = folderSelection(folderId ? folderMap.value.get(folderId)?.parentId : null)
  folderMessage.value = ''
  closePanels()
  currentPage.value = 1
  void search()
}

const openFolderDialog = (folder: Folder, mode: 'rename' | 'move') => {
  selectFolder(folder.id)
  folderDialogMode.value = mode
  showFolderDialog.value = true
}

const folderActions = (folder: Folder) => [
  [
    { label: 'Rename', icon: 'lucide:pencil', onSelect: () => openFolderDialog(folder, 'rename') },
    { label: 'Move', icon: 'lucide:corner-down-right', onSelect: () => openFolderDialog(folder, 'move') },
  ],
  [{ label: 'Delete folder', icon: 'lucide:folder-minus', destructive: true, onSelect: () => { selectFolder(folder.id); void deleteFolder() } }],
]

const saveFolderDialog = () => folderDialogMode.value === 'rename' ? renameFolder() : moveFolder()

const loadWorkspace = async () => {
  await search(true)
}

const workspaceError = (e: any) => (
  e?.data?.message || e?.message || 'Could not reach the server. Check your connection and try again.'
)

const retryWorkspace = async () => {
  if (searchQuery.value.trim()) {
    await search()
    return
  }
  loadingWorkspace.value = true
  loadError.value = ''
  try {
    await loadWorkspace()
  } catch (e: any) {
    loadError.value = workspaceError(e)
  } finally {
    loadingWorkspace.value = false
  }
}

const { loggedIn } = useUserSession()

onMounted(async () => {
  if (!loggedIn.value) {
    await navigateTo('/auth/login')
    return
  }
  await retryWorkspace()
})

const search = async (throwOnError = false) => {
  clearTimeout(searchTimer)
  const sequence = ++searchSequence
  const query = searchQuery.value.trim()
  const folderId = selectedFolderId.value
  const page = currentPage.value
  loadError.value = ''
  searchPending.value = true
  try {
    const result = await $fetch('/api/workspace', {
      query: { page, ...(query ? { q: query } : {}), ...(folderId ? { folderId } : {}) },
    })
    if (sequence !== searchSequence) return
    folders.value = result.folders
    folderCounts.value = result.counts
    artifacts.value = result.artifacts
    totalArtifacts.value = result.total
    currentPage.value = result.page
    pageSize.value = result.pageSize
    appliedQuery.value = query
  } catch (e: any) {
    if (sequence !== searchSequence) return
    if (throwOnError) throw e
    loadError.value = workspaceError(e)
  } finally {
    if (sequence === searchSequence) searchPending.value = false
  }
}

const updateSearch = (value: string) => {
  searchQuery.value = value
  currentPage.value = 1
  clearTimeout(searchTimer)
  // Invalidate in-flight results as soon as the input changes.
  searchSequence++
  searchPending.value = true
  if (!value.trim()) { void search(); return }
  searchTimer = setTimeout(() => { void search() }, 200)
}

const clearSearch = () => updateSearch('')
const changePage = (page: number) => { currentPage.value = page; void search() }

onBeforeUnmount(() => clearTimeout(searchTimer))

const createFolder = async () => {
  saving.value = true; error.value = ''
  try {
    const parentId = folderIdFromSelection(parentFolderId.value)
    const res = await $fetch('/api/folders', { method: 'POST', body: { name: folderName.value, ...(parentId ? { parentId } : {}) } })
    folderName.value = ''
    parentFolderId.value = NO_FOLDER
    showNewFolder.value = false
    await loadWorkspace()
    selectFolder(res.folder.id)
    toast({ title: 'Folder created', color: 'success' })
  } catch (e: any) {
    error.value = e.data?.message || 'Could not create folder'
  } finally {
    saving.value = false
  }
}

const uploadArtifact = async () => {
  if (!uploadFiles.value.length) {
    error.value = 'Choose a file to upload'
    return
  }
  uploading.value = true; error.value = ''
  try {
    const form = new FormData()
    form.append('file', uploadFiles.value[0])
    if (uploadTitle.value.trim()) form.append('title', uploadTitle.value.trim())
    form.append('visibility', uploadVisibility.value)
    const uploadFolder = folderIdFromSelection(uploadFolderId.value)
    if (uploadFolder) form.append('folderId', uploadFolder)
    await $fetch('/api/artifacts/upload', { method: 'POST', body: form })
    showUpload.value = false
    uploadFiles.value = []
    uploadError.value = ''
    uploadTitle.value = ''
    await loadWorkspace()
    toast({ title: 'Artifact uploaded', color: 'success' })
  } catch (e: any) {
    error.value = e.data?.message || 'Could not upload artifact'
  } finally {
    uploading.value = false
  }
}

const renameFolder = async () => {
  if (!selectedFolderId.value) return
  savingFolder.value = true; folderMessage.value = ''
  try {
    const res = await $fetch(`/api/folders/${selectedFolderId.value}`, { method: 'PUT', body: { name: renameValue.value } })
    await loadWorkspace()
    renameValue.value = res.folder.name
    showFolderDialog.value = false
    toast({ title: 'Folder renamed', color: 'success' })
  } catch (e: any) {
    folderMessage.value = e.data?.message || 'Could not rename folder'
  } finally {
    savingFolder.value = false
  }
}

const moveFolder = async () => {
  if (!selectedFolderId.value) return
  savingFolder.value = true; folderMessage.value = ''
  try {
    const res = await $fetch(`/api/folders/${selectedFolderId.value}`, { method: 'PUT', body: { parentId: folderIdFromSelection(moveParentId.value) } })
    const movedId = res.folder.id
    await loadWorkspace()
    selectFolder(movedId)
    showFolderDialog.value = false
    toast({ title: 'Folder moved', color: 'success' })
  } catch (e: any) {
    folderMessage.value = e.data?.message || 'Could not move folder'
  } finally {
    savingFolder.value = false
  }
}

const deleteFolder = async () => {
  if (!selectedFolder.value) return
  const accepted = await confirm({
    title: `Delete “${selectedFolder.value.name}”?`,
    description: 'Only empty folders can be deleted. Move or remove its contents first.',
    confirmLabel: 'Delete folder',
    confirmColor: 'danger',
    icon: 'lucide:folder-minus',
  })
  if (!accepted) return

  savingFolder.value = true; folderMessage.value = ''
  try {
    await $fetch(`/api/folders/${selectedFolderId.value}`, { method: 'DELETE' })
    toast({ title: 'Folder deleted', color: 'success' })
    selectedFolderId.value = null
    renameValue.value = ''
    await loadWorkspace()
  } catch (e: any) {
    toast({ title: e.data?.message || 'Could not delete folder', color: 'danger' })
  } finally {
    savingFolder.value = false
  }
}
</script>

<style scoped>
.workspace-page { padding-top: .25rem; }
.workspace-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 1.5rem; padding-bottom: 1.5rem; }
.workspace-eyebrow { color: var(--selaras-resolved-color-primary-text); font-size: .68rem; font-weight: 700; letter-spacing: .14em; }
.workspace-heading h1 { font-size: 1.875rem; line-height: 1.2; font-weight: 700; letter-spacing: -.035em; }
.workspace-heading h1 span { color: var(--selaras-resolved-color-primary-text); }
.workspace-heading p:last-child { margin-top: .8rem; font-size: .9rem; color: var(--selaras-resolved-text-muted); }
.workspace-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.workspace-shell { display: grid; gap: 1.5rem; }
.workspace-sidebar { min-width: 0; }
.workspace-folder-list { border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-surface-default); padding: .5rem; }
.workspace-sidebar-heading { display: flex; justify-content: space-between; align-items: center; padding: .5rem .5rem 1rem; color: var(--selaras-resolved-text-muted); font-size: .65rem; font-weight: 700; letter-spacing: .12em; }
.workspace-content { min-width: 0; }
.workspace-breadcrumb { overflow-wrap: anywhere; margin-bottom: 2rem; color: var(--selaras-resolved-text-muted); font-size: .75rem; }
.workspace-breadcrumb span { padding: 0 .5rem; opacity: .5; }
.workspace-list-title { overflow-wrap: anywhere; font-size: 1.25rem; line-height: 1.3; font-weight: 700; letter-spacing: -.025em; }
.workspace-artifact { padding: 1rem .5rem; border-bottom: 1px solid var(--selaras-resolved-border-default); }
.workspace-artifact:hover { background: var(--selaras-resolved-surface-elevated); }
.workspace-artifact-icon { background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); }
@media (min-width: 1024px) { .workspace-shell { grid-template-columns: 17rem minmax(0, 1fr); } }
</style>
