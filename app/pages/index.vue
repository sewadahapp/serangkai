<template>
  <div class="workspace-page space-y-6">
    <div class="workspace-heading"><h1>Artifacts</h1></div>

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
      <ClientOnly>
        <Teleport to="#workspace-folder-navigation">
          <SerangkaiFolderList :rows="folderRows" :selected-id="selectedFolderId" :total="workspaceTotal" :count="folderArtifactCount" :actions="folderActions" @select="selectFolder" />
        </Teleport>
      </ClientOnly>

      <section class="workspace-content" aria-labelledby="artifact-list">
        <SSlideover v-model:open="folderPanelOpen" side="left" title="Folders" description="Choose a folder to browse its artifacts.">
          <template #default>
            <SButton variant="outline" icon="lucide:panel-left" class="mb-4 lg:hidden">Browse folders</SButton>
          </template>
          <template #body>
            <SerangkaiFolderList :rows="folderRows" :selected-id="selectedFolderId" :total="workspaceTotal" :count="folderArtifactCount" :actions="folderActions" @select="selectFolder" />
          </template>
        </SSlideover>
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

          <div class="workspace-list-controls">
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
            <SToggleGroup :model-value="artifactView" :items="viewOptions" color="neutral" size="sm" aria-label="Artifact view" @update:model-value="setArtifactView">
              <template #item="{ item }"><SIcon :name="item.icon!" class="size-4" aria-hidden="true" /><span class="sr-only">{{ item.label }}</span></template>
            </SToggleGroup>
            <div class="workspace-actions">
              <STooltip text="New folder"><SButton variant="ghost" color="neutral" icon="lucide:folder-plus" aria-label="New folder" @click="openNewFolder" /></STooltip>
              <STooltip text="Upload"><SButton variant="ghost" color="neutral" icon="lucide:upload" aria-label="Upload" @click="openUpload" /></STooltip>
              <STooltip text="New artifact"><SButton variant="ghost" color="neutral" icon="lucide:plus" aria-label="New artifact" @click="openNewArtifact" /></STooltip>
            </div>
          </div>
        </div>

        <div v-if="visibleArtifacts.length" class="workspace-artifacts" :class="{ 'workspace-artifacts-grid': artifactView === 'grid' }">
          <div
            v-for="artifact in visibleArtifacts"
            :key="artifact.id"
            class="workspace-artifact group flex items-center gap-3 transition-colors"
          >
            <NuxtLink
              :to="`/artifacts/${artifact.id}`"
              class="workspace-artifact-link flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--selaras-resolved-color-primary-focus)]"
            >
              <div v-if="artifactView === 'grid'" class="workspace-card-cover" :class="`workspace-card-${artifact.type}`" aria-hidden="true">
                <div class="workspace-card-sheet"><SIcon :name="artifactIcon(artifact.type)" class="size-7" /><span>{{ artifactTypeLabel(artifact.type) }}</span><i /><i /><i /></div>
              </div>
              <span
                class="workspace-artifact-icon grid size-10 shrink-0 place-items-center rounded-md transition-colors"
                aria-hidden="true"
              >
                <SIcon :name="artifactIcon(artifact.type)" class="size-5" />
              </span>
              <div class="workspace-artifact-details min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <STooltip :text="artifact.title"><h3 class="min-w-0 truncate font-medium group-hover:underline group-hover:underline-offset-4">{{ artifact.title }}</h3></STooltip>
                  <STooltip :text="visibilityLabel(artifact.visibility)"><SIcon :name="artifact.visibility === 'private' ? 'lucide:lock-keyhole' : artifact.visibility === 'public' ? 'lucide:globe' : 'lucide:link'" class="size-3.5 shrink-0 text-[var(--selaras-resolved-text-muted)]" :aria-label="visibilityLabel(artifact.visibility)" /></STooltip>
                </div>
                <div class="workspace-artifact-meta mt-1 flex min-w-0 items-center gap-2 text-xs text-[var(--selaras-resolved-text-muted)]">
                  <span>{{ artifactTypeLabel(artifact.type) }}</span>
                  <span v-if="artifact.folderId" class="min-w-0 truncate">· {{ folderPathLabel(artifact.folderId) }}</span>
                </div>
              </div>
              <STooltip :text="fullDate(artifact.updatedAt)"><time :datetime="artifact.updatedAt" class="workspace-artifact-updated">{{ formatDate(artifact.updatedAt) }}</time></STooltip>
            </NuxtLink>

            <div class="workspace-item-actions">
            <STooltip v-if="artifact.shareUrl" :text="`Preview ${artifact.title}`"><SButton
              variant="ghost"
              size="sm"
              icon="lucide:external-link"
              :to="artifact.shareUrl || undefined"
              target="_blank"
              rel="noopener"
              :aria-label="`Preview ${artifact.title}`"

              class="workspace-artifact-preview shrink-0"
            /></STooltip>
            <STooltip :text="`Actions for ${artifact.title}`"><span class="inline-flex min-w-0"><SDropdown :positioning="{ align: 'end', collisionPadding: 12 }" :items="artifactMenu(artifact)" :adaptive="true"><SButton variant="ghost" color="neutral" size="sm" icon="lucide:ellipsis" :aria-label="`Actions for ${artifact.title}`" /></SDropdown></span></STooltip>
            </div>
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
        <div v-if="totalPages > 1" class="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span class="text-sm text-[var(--selaras-resolved-text-muted)]">Page {{ currentPage }} of {{ totalPages }}</span>
          <SPagination :page="currentPage" :total="totalArtifacts" :items-per-page="pageSize" :sibling-count="0" :show-edges="false" :show-first-last="false" :disabled="searchPending" size="sm" color="neutral" active-color="neutral" aria-label="Artifact pages" @update:page="changePage" />
        </div>
      </section>
    </div>

    <SModal :open="!!artifactDialog" :title="artifactDialog === 'rename' ? 'Rename artifact' : artifactDialog === 'move' ? 'Move artifact' : 'Share artifact'" :description="actionTarget?.title" :dismissible="!artifactBusy" :close="!artifactBusy" @update:open="open => { if (!open) artifactDialog = null }">
      <template #body>
        <form id="artifact-action-form" class="space-y-4" @submit.prevent="saveArtifactAction">
          <SFormField v-if="artifactDialog === 'rename'" label="Artifact title" required><SInput v-model="actionTitle" required class="w-full" /></SFormField>
          <SFormField v-else-if="artifactDialog === 'move'" v-slot="{ id }" label="Move to"><SSelect :id="id" v-model="actionFolderId" :items="artifactFolderOptions" class="w-full" /></SFormField>
          <template v-else>
            <SFormField v-slot="{ id }" label="Visibility"><SSelect :id="id" v-model="actionVisibility" :items="visibilityOptions" class="w-full" /></SFormField>
            <p class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ actionVisibility === 'private' ? 'Only you can open this artifact.' : 'Anyone with the share link can read this artifact.' }}</p>
            <SFormField v-if="actionTarget?.shareUrl && actionVisibility === actionTarget.visibility" label="Share link">
              <SInput :model-value="actionTarget.shareUrl" readonly class="w-full" aria-label="Share link"><template #trailing="{ buttonSize }"><SerangkaiCopyButton :value="actionTarget.shareUrl" label="share link" :size="buttonSize" /></template></SInput>
            </SFormField>
          </template>
          <SAlert v-if="artifactActionError" color="danger" variant="subtle" :title="artifactActionError" />
        </form>
      </template>
      <template #footer><div class="flex gap-2"><SButton variant="ghost" :disabled="!!artifactBusy" @click="artifactDialog = null">{{ artifactDialog === 'share' ? 'Done' : 'Cancel' }}</SButton><SButton type="submit" form="artifact-action-form" :loading="!!artifactBusy" :disabled="!!artifactBusy">{{ artifactDialog === 'share' ? 'Save visibility' : artifactDialog === 'move' ? 'Move artifact' : 'Save name' }}</SButton></div></template>
    </SModal>

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

definePageMeta({ alias: '/workspace' })
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
const actionTarget = ref<Artifact | null>(null)
const artifactDialog = ref<'rename' | 'move' | 'share' | null>(null)
const actionTitle = ref('')
const actionFolderId = ref<string | undefined>(NO_FOLDER)
const actionVisibility = ref('private')
const artifactBusy = ref<string | null>(null)
const artifactActionError = ref('')

const viewOptions = [
  { label: 'List view', value: 'list', icon: 'lucide:list' },
  { label: 'Grid view', value: 'grid', icon: 'lucide:layout-grid' },
]
const setArtifactView = (value: string | string[]) => {
  if (value === 'list' || value === 'grid') artifactView.value = value
}
const savedArtifactView = useCookie<string>('serangkai-artifact-view', { default: () => 'list', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const artifactView = computed<'list' | 'grid'>({
  get: () => savedArtifactView.value === 'grid' ? 'grid' : 'list',
  set: value => { savedArtifactView.value = value },
})
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

const openArtifactAction = (item: Artifact, mode: 'rename' | 'move' | 'share') => {
  actionTarget.value = { ...item }
  actionTitle.value = item.title
  actionFolderId.value = folderSelection(item.folderId)
  actionVisibility.value = item.visibility
  artifactActionError.value = ''
  artifactDialog.value = mode
}

const saveArtifactAction = async () => {
  const item = actionTarget.value
  const mode = artifactDialog.value
  if (!item || !mode || artifactBusy.value) return
  if (mode === 'rename' && !actionTitle.value.trim()) { artifactActionError.value = 'Add a title.'; return }
  artifactBusy.value = item.id
  artifactActionError.value = ''
  try {
    const body = mode === 'rename' ? { title: actionTitle.value.trim() } : mode === 'move' ? { folderId: folderIdFromSelection(actionFolderId.value) } : { visibility: actionVisibility.value }
    const result = await $fetch<any>(`/api/artifacts/${item.id}`, { method: 'PUT', body })
    if (mode === 'share') {
      const link = actionVisibility.value === 'private' ? null : await $fetch<any>(`/api/artifacts/${item.id}/share`, { method: 'POST' })
      actionTarget.value = { ...result.artifact, shareUrl: link?.url || null }
    } else artifactDialog.value = null
    toast({ title: mode === 'rename' ? 'Artifact renamed' : mode === 'move' ? 'Artifact moved' : 'Sharing settings saved', color: 'success' })
    await search()
  } catch (e: any) { artifactActionError.value = e?.data?.message || 'Could not update artifact.' }
  finally { artifactBusy.value = null }
}

const duplicateFromList = async (item: Artifact) => {
  if (artifactBusy.value) return
  artifactBusy.value = item.id
  try {
    await $fetch(`/api/artifacts/${item.id}/duplicate`, { method: 'POST' })
    toast({ title: 'Artifact duplicated', color: 'success' })
    await search()
  } catch (e: any) { toast({ title: e?.data?.message || 'Could not duplicate artifact.', color: 'danger' }) }
  finally { artifactBusy.value = null }
}

const deleteFromList = async (item: Artifact) => {
  if (artifactBusy.value) return
  if (!await confirm({ title: `Delete “${item.title}”?`, description: 'This removes the artifact, every version, and its stored files. It cannot be undone.', confirmLabel: 'Delete artifact', confirmColor: 'danger' })) return
  artifactBusy.value = item.id
  try {
    await $fetch(`/api/artifacts/${item.id}`, { method: 'DELETE' })
    toast({ title: 'Artifact deleted', color: 'success' })
    await search()
  } catch (e: any) { toast({ title: e?.data?.message || 'Could not delete artifact.', color: 'danger' }) }
  finally { artifactBusy.value = null }
}

const copyArtifactLink = async (url: string) => {
  try { await navigator.clipboard.writeText(url); toast({ title: 'Share link copied', color: 'success' }) }
  catch { toast({ title: 'Could not copy link.', color: 'danger' }) }
}
const artifactMenu = (item: Artifact) => [
  [
    { label: 'Rename', icon: 'lucide:pencil', disabled: !!artifactBusy.value, onSelect: () => openArtifactAction(item, 'rename') },
    { label: 'Duplicate', icon: 'lucide:copy', disabled: !!artifactBusy.value, onSelect: () => { void duplicateFromList(item) } },
    { label: 'Move to folder', icon: 'lucide:folder-input', disabled: !!artifactBusy.value, onSelect: () => openArtifactAction(item, 'move') },
  ],
  [
    { label: 'Share', icon: 'lucide:share-2', disabled: !!artifactBusy.value, onSelect: () => openArtifactAction(item, 'share') },
    ...(item.shareUrl ? [{ label: 'Copy share link', icon: 'lucide:link', onSelect: () => { void copyArtifactLink(item.shareUrl!) } }] : []),
    { label: 'Download', icon: 'lucide:download', to: `/api/artifacts/${item.id}/download` },
  ],
  [{ label: 'Delete', icon: 'lucide:trash-2', destructive: true, disabled: !!artifactBusy.value, onSelect: () => { void deleteFromList(item) } }],
]

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
.workspace-heading { padding-block: .5rem 1rem; }
.workspace-heading h1 { font-size: 1.875rem; line-height: 1.2; font-weight: 700; letter-spacing: -.035em; }
.workspace-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.workspace-shell { display: grid; gap: 1.5rem; }
.workspace-sidebar { min-width: 0; }
.workspace-folder-list { border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-surface-default); padding: .5rem; }
.workspace-sidebar-heading { display: flex; justify-content: space-between; align-items: center; padding: .5rem .5rem 1rem; color: var(--selaras-resolved-text-muted); font-size: .65rem; font-weight: 700; letter-spacing: .12em; }
.workspace-content { min-width: 0; }
.workspace-list-title { overflow-wrap: anywhere; font-size: .9rem; line-height: 1.5; font-weight: 700; letter-spacing: -.025em; }
.workspace-artifact { position: relative; min-width: 0; padding: .75rem; border-radius: .5rem; }.workspace-artifact-link { min-height: 2.5rem; }.workspace-artifact-details { flex: 1; }.workspace-artifact-updated { flex-shrink: 0; font-size: .75rem; color: var(--selaras-resolved-text-muted); }.workspace-item-actions { display: flex; align-items: center; flex-shrink: 0; gap: .125rem; }
.workspace-artifact:hover { background: var(--selaras-resolved-surface-elevated); }
.workspace-artifact-icon { background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); }

.workspace-list-controls { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; width: 100%; min-width: 0; }
.workspace-list-controls > :first-child { min-width: 0; flex: 1 0 100%; }.workspace-actions { margin-left: auto; }
.workspace-artifacts-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; }
.workspace-artifacts-grid .workspace-artifact { display: block; padding: 0; overflow: hidden; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-surface-default); }
.workspace-artifacts-grid .workspace-artifact:hover { border-color: var(--selaras-resolved-border-hover); }
.workspace-artifacts-grid .workspace-artifact-link { display: flex; flex-direction: column; align-items: stretch; gap: 0; height: 100%; }
.workspace-artifacts-grid .workspace-artifact-icon { display: none; }
.workspace-artifacts-grid .workspace-artifact-details { padding: 1rem; }
.workspace-artifacts-grid .workspace-item-actions { position: absolute; top: .5rem; right: .5rem; padding: .125rem; border-radius: .5rem; background: var(--selaras-resolved-surface-default); }.workspace-artifacts-grid .workspace-artifact-updated { padding: 0 1rem 1rem; }
.workspace-artifacts-grid .workspace-artifact-preview span { display: none; }
.workspace-card-cover { display: grid; place-items: end center; height: 11rem; overflow: hidden; padding: 1.5rem 2rem 0; border-bottom: 1px solid var(--selaras-resolved-border-muted); background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); }
.workspace-card-html, .workspace-card-bundle { background: var(--selaras-resolved-color-accent-subtle); color: var(--selaras-resolved-color-accent-text); }
.workspace-card-image, .workspace-card-pdf { background: var(--selaras-resolved-color-secondary-subtle); color: var(--selaras-resolved-color-secondary-text); }
.workspace-card-sheet { display: grid; gap: .5rem; width: 100%; max-width: 13rem; padding: 1.25rem; border: 1px solid var(--selaras-resolved-border-default); border-bottom: 0; border-radius: .5rem .5rem 0 0; background: var(--selaras-resolved-surface-default); transform: translateY(.3rem); transition: transform 150ms var(--serangkai-ease); }
.workspace-artifact:hover .workspace-card-sheet { transform: translateY(0); }
.workspace-card-sheet > svg { width: 1.75rem; height: 1.75rem; }.workspace-card-sheet > span { font-size: .7rem; font-weight: 700; }.workspace-card-sheet i { width: 100%; height: 4px; border-radius: 2px; background: var(--selaras-resolved-border-muted); }.workspace-card-sheet i:last-child { width: 60%; }
@media (min-width: 640px) { .workspace-list-controls { width: auto; flex-wrap: nowrap; }.workspace-list-controls > :first-child { flex: 1; width: 16rem; } .workspace-artifacts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1280px) { .workspace-artifacts-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 639px) { .workspace-artifacts:not(.workspace-artifacts-grid) .workspace-artifact-updated { display: none; } .workspace-artifact { padding-inline: .25rem; } .workspace-artifact-icon { width: 2rem; height: 2rem; } }
</style>
