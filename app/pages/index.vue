<template>
  <div class="workspace-page">
    <SerangkaiPageHeader title="Rangka" description="Everything you and your agents publish.">
      <template #actions>
        <SButton variant="outline" color="neutral" icon="lucide:upload" @click="openUpload">Upload</SButton>
        <SButton icon="lucide:plus" @click="openNewRangka">New rangka</SButton>
      </template>
    </SerangkaiPageHeader>

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

    <SModal v-model:open="showUpload" :ui="{ content: 'max-w-2xl' }" title="Upload rangka" description="Add a file to your workspace." :dismissible="!uploading" :close="!uploading">
      <template #body>
        <form id="upload-form" class="space-y-4" @submit.prevent="uploadRangka">
          <div>
            <p class="text-sm font-medium">File <span class="text-[var(--selaras-resolved-color-danger-text)]">*</span></p>
            <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">Markdown, HTML, JS, JSON, PDF, images, or a zipped website with an index.html. Up to 25 MiB.</p>
            <SFileUpload v-model="uploadFiles" :accept="acceptTypes" :max-size="MAX_UPLOAD_BYTES" class="mt-2" @error="onUploadError" />
          </div>
          <SFormField label="Title"><SInput v-model="uploadTitle" placeholder="Optional" class="w-full" /></SFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <SFormField v-slot="{ id }" label="Visibility"><SSelect :id="id" v-model="uploadVisibility" :items="visibilityOptions" class="w-full" /></SFormField>
            <SFormField v-slot="{ id }" label="Folder"><SSelect :id="id" v-model="uploadFolderId" :items="rangkaFolderOptions" placeholder="No folder" clearable class="w-full" /></SFormField>
          </div>
          <p v-if="uploadFiles.length" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ uploadFiles[0].name }} · {{ formatBytes(uploadFiles[0].size) }}</p>
          <p v-if="uploading" role="status" class="text-sm text-[var(--selaras-resolved-text-muted)]">Uploading rangka…</p>
          <SAlert v-if="uploadError" color="warning" variant="subtle" :title="uploadError" />
          <SAlert v-if="error" color="danger" variant="subtle" :title="error" />
        </form>
      </template>
      <template #footer><div class="flex justify-end gap-2"><SButton variant="ghost" :disabled="uploading" @click="showUpload = false">Cancel</SButton><SButton type="submit" form="upload-form" :loading="uploading" :disabled="uploading || !uploadFiles.length">Upload rangka</SButton></div></template>
    </SModal>

    <SerangkaiErrorState
      v-if="loadError"
      title="Could not load the workspace"
      :description="loadError"
      retry-label="Try again"
      @retry="retryWorkspace"
    />

    <SerangkaiWorkspaceSkeleton v-else-if="loadingWorkspace" :view="rangkaView" />

    <div v-else class="workspace-shell">
      <section class="workspace-content" aria-labelledby="rangka-list">
        <div class="workspace-toolbar">
          <div class="workspace-scope">
            <!-- Folders live in the sidebar; on narrow screens that is the
                 navigation drawer, so this opens the same drawer. -->
            <SButton variant="ghost" color="neutral" size="sm" icon="lucide:panel-left" class="workspace-folders-trigger lg:hidden" @click="navDrawer = true">Browse folders</SButton>
            <p v-if="selectedFolderParents.length && !appliedQuery" class="workspace-scope-path">
              <template v-for="parent in selectedFolderParents" :key="parent.id">
                <button type="button" class="workspace-scope-crumb" @click="selectFolder(parent.id)">{{ parent.name }}</button><span aria-hidden="true">/</span>
              </template>
            </p>
            <div class="workspace-scope-title">
              <h2 id="rangka-list" class="workspace-list-title">{{ appliedQuery ? 'Search results' : selectedFolder ? selectedFolder.name : 'All rangka' }}</h2>
              <p class="workspace-scope-count" role="status">
                <template v-if="searchPending">Searching…</template>
                <template v-else-if="appliedQuery">{{ totalRangka }} found {{ selectedFolder ? `in ${selectedFolder.name} and its subfolders` : 'across all folders' }}</template>
                <template v-else>{{ totalRangka }} rangka</template>
              </p>
            </div>
          </div>

          <div class="workspace-list-controls">
            <SInput
              :model-value="searchQuery"
              type="search"
              aria-label="Search rangka and folders"
              aria-keyshortcuts="/"
              placeholder="Search rangka and folders…"
              icon="lucide:search"
              clearable
              class="workspace-search w-full"
              @update:model-value="updateSearch"
            />
            <SToggleGroup :model-value="rangkaView" :items="viewOptions" color="neutral" size="sm" aria-label="Rangka view" @update:model-value="setRangkaView">
              <template #item="{ item }"><SIcon :name="item.icon!" class="size-4" aria-hidden="true" /><span class="sr-only">{{ item.label }}</span></template>
            </SToggleGroup>
            <STooltip text="New folder"><SButton variant="ghost" color="neutral" icon="lucide:folder-plus" aria-label="New folder" @click="openNewFolder" /></STooltip>
          </div>
        </div>

        <div v-if="visibleRangka.length" class="workspace-rangka-collection" :class="rangkaView === 'grid' ? 'workspace-rangka-grid' : 'workspace-rangka-list'">
          <div
            v-for="rangka in visibleRangka"
            :key="rangka.id"
            class="workspace-rangka group flex items-center gap-3 transition-colors"
          >
            <NuxtLink
              :to="`/rangka/${rangka.id}`"
              class="workspace-rangka-link flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--selaras-resolved-color-primary-focus)]"
            >
              <div v-if="rangkaView === 'grid'" class="workspace-card-cover" :class="`workspace-card-${rangka.type}`" aria-hidden="true">
                <div class="workspace-card-sheet"><SIcon :name="rangkaIcon(rangka.type)" class="size-5" /><span>{{ rangkaTypeLabel(rangka.type) }}</span><i /><i /></div>
              </div>
              <span
                class="workspace-rangka-icon grid size-9 shrink-0 place-items-center rounded-md transition-colors"
                aria-hidden="true"
              >
                <SIcon :name="rangkaIcon(rangka.type)" class="size-[1.125rem]" />
              </span>
              <div class="workspace-rangka-details min-w-0">
                <STooltip :text="rangka.title"><h3 class="workspace-rangka-title group-hover:underline group-hover:underline-offset-4">{{ rangka.title }}</h3></STooltip>
                <div class="workspace-rangka-meta">
                  <SBadge v-if="rangka.visibility !== 'private'" :icon="rangka.visibility === 'public' ? 'lucide:globe' : 'lucide:link'" :label="visibilityLabel(rangka.visibility)" color="primary" variant="subtle" size="sm" class="shrink-0" />
                  <span v-else class="workspace-rangka-private"><SIcon name="lucide:lock-keyhole" class="size-3" aria-hidden="true" /><span class="sr-only">Private</span></span>
                  <span class="shrink-0">{{ rangkaTypeLabel(rangka.type) }}</span>
                  <span v-if="rangka.folderId" class="workspace-rangka-folder"><SIcon name="lucide:folder" class="size-3 shrink-0" aria-hidden="true" /><span class="truncate">{{ folderPathLabel(rangka.folderId) }}</span></span>
                  <!-- Inline date: grid view, and list view on phones. -->
                  <STooltip :text="fullDate(rangka.updatedAt)"><time :datetime="rangka.updatedAt" class="workspace-rangka-updated workspace-rangka-updated-inline">{{ formatDate(rangka.updatedAt) }}</time></STooltip>
                </div>
              </div>
              <!-- List view: the date is its own fixed-width column. -->
              <STooltip v-if="rangkaView === 'list'" :text="fullDate(rangka.updatedAt)"><time :datetime="rangka.updatedAt" class="workspace-rangka-updated workspace-rangka-updated-column">{{ formatDate(rangka.updatedAt) }}</time></STooltip>
            </NuxtLink>

            <div class="workspace-item-actions">
            <STooltip v-if="rangka.shareUrl" :text="`Preview ${rangka.title}`"><SButton
              variant="ghost"
              size="sm"
              icon="lucide:external-link"
              :to="rangka.shareUrl || undefined"
              target="_blank"
              rel="noopener"
              :aria-label="`Preview ${rangka.title}`"

              class="workspace-rangka-preview shrink-0"
            /></STooltip>
            <STooltip :text="`Actions for ${rangka.title}`"><span class="inline-flex min-w-0"><SDropdown :positioning="{ align: 'end', collisionPadding: 12 }" :items="rangkaMenu(rangka)" :adaptive="true"><SButton variant="ghost" color="neutral" size="sm" icon="lucide:ellipsis" :aria-label="`Actions for ${rangka.title}`" /></SDropdown></span></STooltip>
            </div>
          </div>
        </div>

        <SEmptyState
          v-else
          icon="lucide:file-text"
          :title="appliedQuery ? 'No matches' : 'No rangka yet'"
          :description="appliedQuery ? 'Try another phrase, or clear the search to see everything.' : selectedFolder ? 'This folder is empty. Create a rangka here, or move one in from its actions menu.' : 'Write one here, upload a file, or connect an agent and let it publish for you.'"
        >
          <template #actions>
            <SButton v-if="searchQuery.trim()" variant="outline" icon="lucide:x" @click="clearSearch">Clear search</SButton>
            <template v-else>
              <SButton icon="lucide:file-plus" @click="openNewRangka">New rangka</SButton>
              <SButton v-if="!selectedFolder" variant="outline" color="neutral" icon="lucide:bot" to="/agent">Connect an agent</SButton>
            </template>
          </template>
        </SEmptyState>
        <div v-if="totalPages > 1" class="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span class="text-sm text-[var(--selaras-resolved-text-muted)]">Page {{ currentPage }} of {{ totalPages }}</span>
          <SPagination :page="currentPage" :total="totalRangka" :items-per-page="pageSize" :sibling-count="0" :show-edges="false" :show-first-last="false" :disabled="searchPending" size="sm" color="neutral" active-color="neutral" aria-label="Rangka pages" @update:page="changePage" />
        </div>
      </section>
    </div>

    <SModal :open="!!rangkaDialog" :title="rangkaDialog === 'rename' ? 'Rename rangka' : 'Move rangka'" :description="actionTarget?.title" :dismissible="!rangkaBusy" :close="!rangkaBusy" @update:open="open => { if (!open) rangkaDialog = null }">
      <template #body>
        <form id="rangka-action-form" class="space-y-4" @submit.prevent="saveRangkaAction">
          <SFormField v-if="rangkaDialog === 'rename'" label="Rangka title" required><SInput v-model="actionTitle" required class="w-full" /></SFormField>
          <SFormField v-else v-slot="{ id }" label="Move to"><SSelect :id="id" v-model="actionFolderId" :items="rangkaFolderOptions" class="w-full" /></SFormField>
          <SAlert v-if="rangkaActionError" color="danger" variant="subtle" :title="rangkaActionError" />
        </form>
      </template>
      <template #footer><div class="flex gap-2"><SButton variant="ghost" :disabled="!!rangkaBusy" @click="rangkaDialog = null">Cancel</SButton><SButton type="submit" form="rangka-action-form" :loading="!!rangkaBusy" :disabled="!!rangkaBusy">{{ rangkaDialog === 'move' ? 'Move rangka' : 'Save name' }}</SButton></div></template>
    </SModal>
    <SerangkaiShareDialog v-model:open="shareOpen" :rangka="shareTarget" @updated="() => { void search() }" />

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
import SerangkaiFolderList from '~/components/SerangkaiFolderList.vue'

definePageMeta({ alias: '/workspace' })
useHead({ title: 'Workspace' })

interface Folder {
  id: string
  name: string
  parentId: string | null
  path: string
}

interface Rangka {
  id: string
  title: string
  type: string
  visibility: string
  folderId: string | null
  updatedAt: string
  shareUrl: string | null
}

const folders = ref<Folder[]>([])
const rangkaItems = ref<Rangka[]>([])
const actionTarget = ref<Rangka | null>(null)
const rangkaDialog = ref<'rename' | 'move' | null>(null)
const shareOpen = ref(false)
const shareTarget = ref<Rangka | null>(null)
const actionTitle = ref('')
const actionFolderId = ref<string | undefined>(NO_FOLDER)
const rangkaBusy = ref<string | null>(null)
const rangkaActionError = ref('')

const viewOptions = [
  { label: 'List view', value: 'list', icon: 'lucide:list' },
  { label: 'Grid view', value: 'grid', icon: 'lucide:layout-grid' },
]
const setRangkaView = (value: string | string[]) => {
  if (value === 'list' || value === 'grid') rangkaView.value = value
}
const savedRangkaView = useCookie<string>('serangkai-rangka-view', { default: () => 'grid', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const rangkaView = computed<'list' | 'grid'>({
  get: () => savedRangkaView.value === 'list' ? 'list' : 'grid',
  set: value => { savedRangkaView.value = value },
})
const folderCounts = ref<Array<{ folderId: string | null; value: number }>>([])
const totalRangka = ref(0)
const currentPage = ref(1)
const pageSize = ref(25)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRangka.value / pageSize.value)))
const workspaceTotal = computed(() => folderCounts.value.reduce((sum, row) => sum + row.value, 0))
const searchQuery = ref('')
// The query whose results are currently on screen. Keeping it separate from
// the input value avoids labeling the previous list as the new search.
const appliedQuery = ref('')
const searchPending = ref(false)
const folderName = ref('')
const parentFolderId = ref<string | undefined>(NO_FOLDER)
const selectedFolderId = ref<string | null>(null)
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
// Opens the shared mobile navigation drawer, which holds the folder tree.
const navDrawer = useNavDrawer()
// Keeps the sidebar storage meter current after uploads, copies, and deletes.
const { refresh: refreshStorage } = useStorageStatus()
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

const expandedFolderIds = ref<string[]>([])
const folderExpansionKey = 'serangkai-expanded-folders'
const restoreFolderExpansion = () => {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(folderExpansionKey) || '[]')
    if (Array.isArray(stored)) expandedFolderIds.value = [...new Set(stored.filter((id): id is string => typeof id === 'string' && !!id))]
  } catch {
    // Storage can be unavailable or contain an old/invalid preference.
  }
}
watch(expandedFolderIds, (ids) => {
  if (!import.meta.client) return
  try { window.localStorage.setItem(folderExpansionKey, JSON.stringify(ids)) } catch { /* Keep the tree usable without storage. */ }
})
watch(folderRows, (rows) => {
  const parents = new Set(rows.flatMap(row => row.parentId ? [row.parentId] : []))
  // Reconcile only after a successful fetch; the initial empty list must not
  // erase saved state before folders arrive. Refreshes never open branches.
  expandedFolderIds.value = expandedFolderIds.value.filter(id => parents.has(id))
})

const visibilityOptions = [
  { label: 'Private', value: 'private' },
  { label: 'Unlisted', value: 'unlisted' },
  { label: 'Public', value: 'public' },
]

// rangkaIcon / rangkaTypeLabel come from utils/rangka-types (shared with the command palette).
const visibilityLabel = (visibility: string) => visibility.charAt(0).toUpperCase() + visibility.slice(1)

const folderOption = (row: Folder & { depth: number }) => ({ label: `${'— '.repeat(row.depth)}${row.name}`, value: row.id })

const moveTargets = computed(() => {
  if (!selectedFolderId.value) return folderRows.value
  const blocked = descendantIds(selectedFolderId.value)
  return folderRows.value.filter(row => !blocked.has(row.id))
})

const parentOptions = computed(() => [{ label: 'Top level', value: NO_FOLDER }, ...folderRows.value.map(folderOption)])
const rangkaFolderOptions = computed(() => [{ label: 'No folder', value: NO_FOLDER }, ...folderRows.value.map(folderOption)])
const moveTargetOptions = computed(() => [{ label: 'Top level', value: NO_FOLDER }, ...moveTargets.value.map(folderOption)])

const selectedFolder = computed(() => selectedFolderId.value ? folderMap.value.get(selectedFolderId.value) || null : null)
const selectedFolderParents = computed(() => {
  const parents: Folder[] = []
  const seen = new Set<string>()
  let parentId = selectedFolder.value?.parentId
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = folderMap.value.get(parentId)
    if (!parent) break
    parents.unshift(parent)
    parentId = parent.parentId
  }
  return parents
})

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



const visibleRangka = computed(() => rangkaItems.value)

const folderRangkaCount = (folderId: string) => {
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

const openNewRangka = () => navigateTo({ path: '/workspace/new', query: selectedFolderId.value ? { folderId: selectedFolderId.value } : {} })

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

// The folder, search, and page live in the URL so reload, Back, and shared
// links restore the same view. Search typing replaces history; folder and
// page changes push it.
const route = useRoute()
const router = useRouter()
const queryValue = (value: unknown) => typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
const readUrlState = () => {
  const page = Number(queryValue(route.query.page))
  return {
    folderId: queryValue(route.query.folder) || null,
    query: queryValue(route.query.q),
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  }
}
const writeUrlState = (mode: 'push' | 'replace') => {
  const query: Record<string, string> = {}
  if (selectedFolderId.value) query.folder = selectedFolderId.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (currentPage.value > 1) query.page = String(currentPage.value)
  const current = readUrlState()
  if (current.folderId === (query.folder || null) && current.query === (query.q || '') && current.page === currentPage.value) return
  void router[mode]({ query })
}
const applyUrlState = () => {
  const state = readUrlState()
  selectedFolderId.value = state.folderId
  searchQuery.value = state.query
  currentPage.value = state.page
  revealFolder(state.folderId)
}

const revealFolder = (folderId: string | null) => {
  const expanded = new Set(expandedFolderIds.value)
  let parent = folderId ? folderMap.value.get(folderId)?.parentId : null
  while (parent && folderMap.value.has(parent)) {
    expanded.add(parent)
    parent = folderMap.value.get(parent)?.parentId
  }
  expandedFolderIds.value = [...expanded]
}

const selectFolder = (folderId: string | null) => {
  // Close the mobile drawer even when the folder is already selected (the URL
  // does not change then, so the layout's close-on-navigation does not fire).
  navDrawer.value = false
  // Reveal the path when selecting a newly created or moved folder, while
  // preserving manual collapses through searches and list refreshes.
  revealFolder(folderId)
  selectedFolderId.value = folderId
  renameValue.value = folderId ? folderMap.value.get(folderId)?.name || '' : ''
  moveParentId.value = folderSelection(folderId ? folderMap.value.get(folderId)?.parentId : null)
  folderMessage.value = ''
  closePanels()
  currentPage.value = 1
  writeUrlState('push')
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
  // A failed search retries in place; the first load (which may already carry
  // a query from the URL) always goes through the full loading state.
  if (searchQuery.value.trim() && !loadingWorkspace.value) {
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

// Hand the folder tree to the layout's sidebar (inline on desktop, drawer on
// mobile). It renders nothing until the first load succeeds, as before.
const workspaceSidebar = useWorkspaceSidebar()
const FolderPanel = markRaw(defineComponent({
  name: 'WorkspaceFolderPanel',
  setup: () => () => loadingWorkspace.value || loadError.value ? null : h(SerangkaiFolderList, {
    rows: folderRows.value,
    selectedId: selectedFolderId.value,
    total: workspaceTotal.value,
    count: folderRangkaCount,
    actions: folderActions,
    expanded: expandedFolderIds.value,
    'onUpdate:expanded': (ids: string[]) => { expandedFolderIds.value = ids },
    onSelect: selectFolder,
  }),
}))
onMounted(() => { workspaceSidebar.value = FolderPanel })

// Upload / New folder requested from the command palette on any page.
const pendingAction = useWorkspaceAction()
const runPendingAction = () => {
  const action = pendingAction.value
  if (!action || loadingWorkspace.value) return
  pendingAction.value = null
  if (action === 'upload') openUpload()
  else openNewFolder()
}
watch([pendingAction, loadingWorkspace], runPendingAction)
onBeforeUnmount(() => { if (workspaceSidebar.value === FolderPanel) workspaceSidebar.value = null })

onMounted(async () => {
  if (!loggedIn.value) {
    await navigateTo('/auth/login')
    return
  }
  restoreFolderExpansion()
  applyUrlState()
  await retryWorkspace()
  revealFolder(selectedFolderId.value)
  window.addEventListener('keydown', focusSearchShortcut)
})

watch(() => route.query, () => {
  if (loadingWorkspace.value) return
  const state = readUrlState()
  if (state.folderId === selectedFolderId.value && state.query === searchQuery.value.trim() && state.page === currentPage.value) return
  applyUrlState()
  void search()
})

// `/` focuses search, as in most file and docs tools, unless the user is
// already typing somewhere.
const focusSearchShortcut = (event: KeyboardEvent) => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"]')) return
  const input = document.querySelector<HTMLInputElement>('.workspace-search input')
  if (!input) return
  event.preventDefault()
  input.focus()
}

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
    rangkaItems.value = result.rangka
    totalRangka.value = result.total
    currentPage.value = result.page
    pageSize.value = result.pageSize
    appliedQuery.value = query
    if (result.page !== page) writeUrlState('replace')
  } catch (e: any) {
    if (sequence !== searchSequence) return
    // A stale or shared link can name a folder that no longer exists. Fall
    // back to all rangka instead of showing an error for the whole page.
    if (folderId && e?.statusCode === 404) {
      selectedFolderId.value = null
      writeUrlState('replace')
      return search(throwOnError)
    }
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
  writeUrlState('replace')
  if (!value.trim()) { void search(); return }
  searchTimer = setTimeout(() => { void search() }, 200)
}

const clearSearch = () => updateSearch('')
const changePage = (page: number) => { currentPage.value = page; writeUrlState('push'); void search() }

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('keydown', focusSearchShortcut)
})

const openShare = (item: Rangka) => { shareTarget.value = { ...item }; shareOpen.value = true }

const openRangkaAction = (item: Rangka, mode: 'rename' | 'move') => {
  actionTarget.value = { ...item }
  actionTitle.value = item.title
  actionFolderId.value = folderSelection(item.folderId)
  rangkaActionError.value = ''
  rangkaDialog.value = mode
}

const saveRangkaAction = async () => {
  const item = actionTarget.value
  const mode = rangkaDialog.value
  if (!item || !mode || rangkaBusy.value) return
  if (mode === 'rename' && !actionTitle.value.trim()) { rangkaActionError.value = 'Add a title.'; return }
  rangkaBusy.value = item.id
  rangkaActionError.value = ''
  try {
    const body = mode === 'rename' ? { title: actionTitle.value.trim() } : { folderId: folderIdFromSelection(actionFolderId.value) }
    await $fetch<any>(`/api/rangka/${item.id}`, { method: 'PUT', body })
    rangkaDialog.value = null
    toast({ title: mode === 'rename' ? 'Rangka renamed' : 'Rangka moved', color: 'success' })
    await search()
  } catch (e: any) { rangkaActionError.value = e?.data?.message || 'Could not update rangka.' }
  finally { rangkaBusy.value = null }
}

const duplicateFromList = async (item: Rangka) => {
  if (rangkaBusy.value) return
  rangkaBusy.value = item.id
  try {
    await $fetch(`/api/rangka/${item.id}/duplicate`, { method: 'POST' })
    toast({ title: 'Rangka duplicated', color: 'success' })
    void refreshStorage()
    await search()
  } catch (e: any) { toast({ title: e?.data?.message || 'Could not duplicate rangka.', color: 'danger' }) }
  finally { rangkaBusy.value = null }
}

const deleteFromList = async (item: Rangka) => {
  if (rangkaBusy.value) return
  if (!await confirm({ title: `Delete “${item.title}”?`, description: 'This removes the rangka, every version, and its stored files. It cannot be undone.', confirmLabel: 'Delete rangka', confirmColor: 'danger' })) return
  rangkaBusy.value = item.id
  try {
    await $fetch(`/api/rangka/${item.id}`, { method: 'DELETE' })
    toast({ title: 'Rangka deleted', color: 'success' })
    void refreshStorage()
    await search()
  } catch (e: any) { toast({ title: e?.data?.message || 'Could not delete rangka.', color: 'danger' }) }
  finally { rangkaBusy.value = null }
}

const copyRangkaLink = async (url: string) => {
  try { await navigator.clipboard.writeText(url); toast({ title: 'Share link copied', color: 'success' }) }
  catch { toast({ title: 'Could not copy link.', color: 'danger' }) }
}
const rangkaMenu = (item: Rangka) => [
  [
    { label: 'Rename', icon: 'lucide:pencil', disabled: !!rangkaBusy.value, onSelect: () => openRangkaAction(item, 'rename') },
    { label: 'Duplicate', icon: 'lucide:copy', disabled: !!rangkaBusy.value, onSelect: () => { void duplicateFromList(item) } },
    { label: 'Move to folder', icon: 'lucide:folder-input', disabled: !!rangkaBusy.value, onSelect: () => openRangkaAction(item, 'move') },
  ],
  [
    { label: 'Share', icon: 'lucide:share-2', disabled: !!rangkaBusy.value, onSelect: () => openShare(item) },
    ...(item.shareUrl ? [{ label: 'Copy share link', icon: 'lucide:link', onSelect: () => { void copyRangkaLink(item.shareUrl!) } }] : []),
    { label: 'Download', icon: 'lucide:download', to: `/api/rangka/${item.id}/download` },
  ],
  [{ label: 'Delete', icon: 'lucide:trash-2', destructive: true, disabled: !!rangkaBusy.value, onSelect: () => { void deleteFromList(item) } }],
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

const uploadRangka = async () => {
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
    await $fetch('/api/rangka/upload', { method: 'POST', body: form })
    showUpload.value = false
    uploadFiles.value = []
    uploadError.value = ''
    uploadTitle.value = ''
    await loadWorkspace()
    void refreshStorage()
    toast({ title: 'Rangka uploaded', color: 'success' })
  } catch (e: any) {
    error.value = e.data?.message || 'Could not upload rangka'
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
    writeUrlState('replace')
    await loadWorkspace()
  } catch (e: any) {
    toast({ title: e.data?.message || 'Could not delete folder', color: 'danger' })
  } finally {
    savingFolder.value = false
  }
}
</script>

<style scoped>
/* Workspace posture: recede. Titles are the content; colour is reserved for
   the primary action, selection, and shared visibility. */
.workspace-shell { display: grid; gap: 1.5rem; }
.workspace-content { min-width: 0; }

.workspace-toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .75rem 1rem; margin-bottom: 1rem; }
.workspace-scope { min-width: 0; }
.workspace-folders-trigger { margin: 0 0 .5rem -.5rem; }
.workspace-scope-path { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem; margin-bottom: .125rem; font-size: .75rem; color: var(--selaras-resolved-text-muted); }
.workspace-scope-crumb { border-radius: var(--selaras-resolved-radius-sm); }
.workspace-scope-crumb:hover { color: var(--selaras-resolved-text-default); text-decoration: underline; text-underline-offset: 3px; }
.workspace-scope-crumb:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
.workspace-scope-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: .25rem .625rem; min-width: 0; }
.workspace-list-title { overflow-wrap: anywhere; font-size: 1rem; line-height: 1.4; font-weight: 700; letter-spacing: -.02em; }
.workspace-scope-count { font-size: .8125rem; font-variant-numeric: tabular-nums; color: var(--selaras-resolved-text-muted); }

.workspace-list-controls { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; width: 100%; min-width: 0; }
.workspace-list-controls > :first-child { min-width: 0; flex: 1 1 100%; }

/* List view: one card per line, like a list of flights or trains. Each
   item has its own surface (so text never sits on the dotted canvas), and
   the date and actions keep fixed widths so they line up card to card
   whether or not an item has a preview link. */
.workspace-rangka { position: relative; min-width: 0; }
.workspace-rangka-list { display: flex; flex-direction: column; gap: .5rem; }
.workspace-rangka-list .workspace-rangka { padding: .75rem 1rem .75rem .75rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-surface-default); transition: border-color 100ms; }
.workspace-rangka-list .workspace-rangka:hover { border-color: var(--selaras-resolved-border-hover); }
.workspace-rangka-list .workspace-rangka-updated-column { width: 5.5rem; margin-left: 0; text-align: right; font-size: .8125rem; }
.workspace-rangka-list .workspace-rangka-updated-inline { display: none; }
.workspace-rangka-list .workspace-item-actions { width: 4.75rem; justify-content: flex-end; }
.workspace-rangka-link { min-height: 2.5rem; }
.workspace-rangka-details { flex: 1; }
.workspace-rangka-icon { background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); }
.workspace-rangka-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: .9375rem; line-height: 1.4; }
.workspace-rangka-meta { display: flex; min-width: 0; align-items: center; gap: .25rem .625rem; margin-top: .25rem; font-size: .75rem; line-height: 1.25rem; color: var(--selaras-resolved-text-muted); }
.workspace-rangka-private { display: inline-flex; flex-shrink: 0; }
.workspace-rangka-folder { display: inline-flex; min-width: 0; align-items: center; gap: .25rem; }
.workspace-rangka-updated { flex-shrink: 0; margin-left: auto; font-size: .75rem; font-variant-numeric: tabular-nums; color: var(--selaras-resolved-text-muted); }
.workspace-item-actions { display: flex; align-items: center; flex-shrink: 0; gap: .125rem; }

/* Grid view: a compact cover that names the type, then the same metadata as
   the list so switching views never hides information. */
/* Columns follow the page column's width, not the viewport: 3 across at the
   desktop column width, 2 on tablets, 1 on phones. */
.workspace-rangka-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); gap: 1rem; }
.workspace-rangka-grid .workspace-rangka { display: block; padding: 0; overflow: hidden; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-surface-default); }
.workspace-rangka-grid .workspace-rangka:hover { border-color: var(--selaras-resolved-border-hover); background: var(--selaras-resolved-surface-default); }
.workspace-rangka-grid .workspace-rangka-link { display: flex; flex-direction: column; align-items: stretch; gap: 0; height: 100%; border-radius: inherit; }
.workspace-rangka-grid .workspace-rangka-icon { display: none; }
.workspace-rangka-grid .workspace-rangka-details { display: flex; flex-direction: column; padding: .75rem .875rem .875rem; }
.workspace-rangka-grid .workspace-rangka-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; min-height: 2.625rem; white-space: normal; overflow-wrap: anywhere; }
.workspace-rangka-grid .workspace-rangka-meta { flex-wrap: wrap; margin-top: .5rem; }
.workspace-rangka-grid .workspace-item-actions { position: absolute; top: .375rem; right: .375rem; padding: .125rem; border-radius: var(--selaras-resolved-radius-md); background: var(--selaras-resolved-surface-default); box-shadow: 0 0 0 1px var(--selaras-resolved-border-muted); }
.workspace-card-cover { display: flex; align-items: flex-end; height: 5.5rem; overflow: hidden; padding: 0 .875rem; border-bottom: 1px solid var(--selaras-resolved-border-muted); background: var(--selaras-resolved-color-primary-subtle); color: var(--selaras-resolved-color-primary-text); }
.workspace-card-html, .workspace-card-bundle, .workspace-card-javascript { background: var(--selaras-resolved-color-accent-subtle); color: var(--selaras-resolved-color-accent-text); }
.workspace-card-image, .workspace-card-pdf { background: var(--selaras-resolved-color-secondary-subtle); color: var(--selaras-resolved-color-secondary-text); }
.workspace-card-sheet { display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: .5rem; row-gap: .4rem; width: 9.5rem; padding: .75rem .75rem .875rem; border: 1px solid var(--selaras-resolved-border-default); border-bottom: 0; border-radius: .375rem .375rem 0 0; background: var(--selaras-resolved-surface-default); transform: translateY(.25rem); transition: transform 150ms var(--serangkai-ease); }
.workspace-rangka:hover .workspace-card-sheet { transform: translateY(0); }
.workspace-card-sheet > span { font-size: .6875rem; font-weight: 700; letter-spacing: .02em; }
.workspace-card-sheet i { grid-column: 1 / -1; height: 3px; border-radius: 2px; background: var(--selaras-resolved-border-muted); }
.workspace-card-sheet i:last-child { width: 60%; }
@media (prefers-reduced-motion: reduce) { .workspace-card-sheet { transition: none; } }

@media (min-width: 640px) {
  .workspace-list-controls { width: auto; flex-wrap: nowrap; }
  .workspace-list-controls > :first-child { flex: 1; width: 17rem; }
}
@media (max-width: 639px) {
  .workspace-rangka-list .workspace-rangka-folder { display: none; }
  .workspace-rangka-list .workspace-rangka { padding: .625rem .5rem .625rem .625rem; }
  /* Phones: no room for a date column. The title takes the row and the
     date moves back into the meta line. */
  .workspace-rangka-list .workspace-rangka-updated-column { display: none; }
  .workspace-rangka-list .workspace-rangka-updated-inline { display: inline; margin-left: 0; }
  .workspace-rangka-list .workspace-item-actions { width: auto; }
  .workspace-rangka-icon { width: 2rem; height: 2rem; }
  .workspace-card-cover { height: 4rem; }
  .workspace-card-sheet { width: 7.5rem; padding: .5rem .625rem .625rem; }
  .workspace-card-sheet i { display: none; }
}
</style>
