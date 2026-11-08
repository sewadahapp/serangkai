<template>
  <div class="space-y-6">
    <SerangkaiPageHeader title="Workspace" description="Create, upload, and organize artifacts. Private until you share them.">
      <template #actions>
        <SButton variant="outline" icon="lucide:folder-plus" @click="openNewFolder">New folder</SButton>
        <SButton variant="outline" icon="lucide:upload" @click="openUpload">Upload</SButton>
        <SButton icon="lucide:file-plus" @click="openNewArtifact">New artifact</SButton>
      </template>
    </SerangkaiPageHeader>

    <div v-if="showNewFolder || showNewArtifact || showUpload" class="serangkai-panel p-5">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold">{{ showNewFolder ? 'Create folder' : showUpload ? 'Upload artifact' : 'Create artifact' }}</h2>
          <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">
            {{ showNewFolder ? 'Nest it under the selected folder or keep it at the top level.' : showUpload ? 'Markdown, HTML, JSON, PDF, images, and static ZIP bundles.' : 'Write Markdown, HTML, or JSON directly.' }}
          </p>
        </div>
        <SButton variant="ghost" size="sm" @click="closePanels">Close</SButton>
      </div>

      <form v-if="showNewFolder" class="space-y-3" @submit.prevent="createFolder">
        <div class="grid gap-3 sm:grid-cols-2">
          <SFormField label="Folder name" required>
            <SInput v-model="folderName" placeholder="Folder name" required class="w-full" />
          </SFormField>
          <SFormField v-slot="{ id }" label="Parent">
            <SSelect :id="id" v-model="parentFolderId" :items="parentOptions" placeholder="Top level" class="w-full" />
          </SFormField>
        </div>
        <div class="flex gap-2">
          <SButton type="submit" :loading="saving" :disabled="saving">Create folder</SButton>
          <SButton type="button" variant="ghost" @click="showNewFolder = false">Cancel</SButton>
        </div>
      </form>

      <form v-else-if="showNewArtifact" class="space-y-3" @submit.prevent="createArtifact">
        <div class="grid gap-3 sm:grid-cols-3">
          <SFormField label="Title" required>
            <SInput v-model="artifactTitle" placeholder="Artifact title" required class="w-full" />
          </SFormField>
          <SFormField v-slot="{ id }" label="Type">
            <SSelect :id="id" v-model="artifactType" :items="typeOptions" class="w-full" />
          </SFormField>
          <SFormField v-slot="{ id }" label="Visibility">
            <SSelect :id="id" v-model="artifactVisibility" :items="visibilityOptions" class="w-full" />
          </SFormField>
        </div>
        <SFormField v-slot="{ id }" label="Folder">
          <SSelect :id="id" v-model="artifactFolderId" :items="artifactFolderOptions" placeholder="No folder" clearable class="w-full" />
        </SFormField>
        <SFormField v-slot="{ id }" label="Content" required>
          <SerangkaiCodeEditor :id="id" v-model="artifactContent" :language="artifactLanguage" aria-label="Content" height="24rem" />
        </SFormField>
        <div class="flex gap-2">
          <SButton type="submit" :loading="saving" :disabled="saving">Create artifact</SButton>
          <SButton type="button" variant="ghost" @click="showNewArtifact = false">Cancel</SButton>
        </div>
      </form>

      <form v-else class="space-y-3" @submit.prevent="uploadArtifact">
        <div>
          <p class="text-sm font-medium">File <span class="text-[var(--selaras-resolved-color-danger-text)]">*</span></p>
          <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">Markdown, HTML, JS, JSON, PDF, images, or a ZIP bundle. Up to 25 MiB.</p>
          <SFileUpload
            v-model="uploadFiles"
            :accept="acceptTypes"
            :max-size="MAX_UPLOAD_BYTES"
            class="mt-2"
            @error="onUploadError"
          />
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <SFormField label="Title">
            <SInput v-model="uploadTitle" placeholder="Optional" class="w-full" />
          </SFormField>
          <SFormField v-slot="{ id }" label="Visibility">
            <SSelect :id="id" v-model="uploadVisibility" :items="visibilityOptions" class="w-full" />
          </SFormField>
          <SFormField v-slot="{ id }" label="Folder">
            <SSelect :id="id" v-model="uploadFolderId" :items="artifactFolderOptions" placeholder="No folder" clearable class="w-full" />
          </SFormField>
        </div>
        <p v-if="uploadFiles.length" class="text-sm text-[var(--selaras-resolved-text-muted)]">
          {{ uploadFiles[0].name }} · {{ formatBytes(uploadFiles[0].size) }}
        </p>
        <div class="flex gap-2">
          <SButton type="submit" :loading="uploading" :disabled="uploading || !uploadFiles.length">Upload artifact</SButton>
          <SButton type="button" variant="ghost" @click="showUpload = false">Cancel</SButton>
        </div>
      </form>

      <SAlert v-if="uploadError" class="mt-4" color="warning" variant="subtle" :title="uploadError" />
      <SAlert v-if="error" class="mt-4" color="danger" variant="subtle" :title="error" />
    </div>

    <div class="grid gap-6 lg:grid-cols-[17rem_1fr]">
      <aside class="space-y-4">
        <div class="serangkai-panel overflow-hidden">
          <div class="border-b border-[var(--selaras-resolved-border-muted)] px-4 py-3">
            <h2 class="text-sm font-semibold">Folders</h2>
          </div>
          <nav aria-label="Folders" class="space-y-0.5 p-2">
            <button
              type="button"
              class="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--selaras-resolved-surface-elevated)]"
              :class="{ 'bg-[var(--selaras-resolved-surface-elevated)] font-medium': selectedFolderId === null }"
              @click="selectFolder(null)"
            >
              <span class="flex items-center gap-1.5">
                <SIcon name="lucide:layers" class="size-4 shrink-0" aria-hidden="true" />
                All artifacts
              </span>
              <span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ artifacts.length }}</span>
            </button>
            <button
              v-for="row in folderRows"
              :key="row.id"
              type="button"
              class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--selaras-resolved-surface-elevated)]"
              :class="{ 'bg-[var(--selaras-resolved-surface-elevated)] font-medium': selectedFolderId === row.id }"
              :style="{ paddingInlineStart: `${0.5 + row.depth * 0.85}rem` }"
              @click="selectFolder(row.id)"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <SIcon :name="selectedFolderId === row.id ? 'lucide:folder-open' : 'lucide:folder'" class="size-4 shrink-0" aria-hidden="true" />
                <span class="truncate">{{ row.name }}</span>
              </span>
              <span class="serangkai-tabular text-xs text-[var(--selaras-resolved-text-muted)]">{{ folderArtifactCount(row.id) }}</span>
            </button>
            <p v-if="folderRows.length === 0" class="px-2 py-2 text-sm text-[var(--selaras-resolved-text-muted)]">No folders yet.</p>
          </nav>
        </div>

        <div v-if="selectedFolder" class="serangkai-panel p-4">
          <h2 class="text-sm font-semibold">Manage “{{ selectedFolder.name }}”</h2>

          <div class="mt-3 space-y-3">
            <SFormField label="Rename">
              <div class="flex gap-2">
                <SInput v-model="renameValue" placeholder="Folder name" class="min-w-0 flex-1" />
                <SButton variant="outline" icon="lucide:pencil" :loading="savingFolder" :disabled="savingFolder" @click="renameFolder">Rename</SButton>
              </div>
            </SFormField>

            <SFormField v-slot="{ id }" label="Move under">
              <div class="flex gap-2">
                <SSelect :id="id" v-model="moveParentId" :items="moveTargetOptions" placeholder="Top level" class="min-w-0 flex-1" />
                <SButton variant="outline" icon="lucide:corner-down-right" :loading="savingFolder" :disabled="savingFolder" @click="moveFolder">Move</SButton>
              </div>
            </SFormField>

            <div class="border-t border-[var(--selaras-resolved-border-muted)] pt-3">
              <SButton variant="ghost" color="danger" icon="lucide:folder-minus" :loading="savingFolder" :disabled="savingFolder" @click="deleteFolder">Delete folder</SButton>
            </div>

            <p v-if="folderMessage" class="text-sm text-[var(--selaras-resolved-text-muted)]">{{ folderMessage }}</p>
          </div>
        </div>
      </aside>

      <section aria-labelledby="artifact-list">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="artifact-list" class="text-lg font-semibold tracking-tight">
              {{ searchQuery.trim() ? 'Search results' : selectedFolder ? selectedFolder.name : 'All artifacts' }}
            </h2>
            <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">
              <template v-if="searchQuery.trim()">
                {{ selectedFolder ? `In ${selectedFolder.name} and its subfolders` : 'Across all artifacts and folders' }} · {{ visibleArtifacts.length }} found
              </template>
              <template v-else>{{ visibleArtifacts.length }} {{ visibleArtifacts.length === 1 ? 'artifact' : 'artifacts' }}</template>
            </p>
          </div>

          <div class="w-full sm:w-72">
            <SInput
              v-model="searchQuery"
              type="search"
              aria-label="Search artifacts and folders"
              placeholder="Search artifacts and folders…"
              icon="lucide:search"
              clearable
              class="w-full"
              @input="search"
            />
          </div>
        </div>

        <div v-if="visibleArtifacts.length" class="space-y-2">
          <NuxtLink
            v-for="artifact in visibleArtifacts"
            :key="artifact.id"
            :to="`/artifacts/${artifact.id}`"
            class="group flex items-start justify-between gap-4 rounded-lg border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-default)] p-4 transition-colors hover:border-[var(--selaras-resolved-border-hover)] hover:bg-[var(--selaras-resolved-surface-elevated)]"
          >
            <div class="min-w-0">
              <h3 class="truncate font-medium group-hover:underline group-hover:underline-offset-4">{{ artifact.title }}</h3>
              <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--selaras-resolved-text-muted)]">
                <SBadge :label="artifact.type" variant="subtle" color="neutral" size="sm" />
                <SBadge
                  :label="artifact.visibility"
                  variant="subtle"
                  :color="artifact.visibility === 'private' ? 'neutral' : artifact.visibility === 'public' ? 'success' : 'accent'"
                  size="sm"
                />
                <span v-if="artifact.folderId" class="truncate">· {{ folderLabel(artifact.folderId) }}</span>
              </div>
            </div>
            <time class="shrink-0 text-xs text-[var(--selaras-resolved-text-muted)]" :datetime="artifact.updatedAt">
              {{ formatDate(artifact.updatedAt) }}
            </time>
          </NuxtLink>
        </div>

        <SEmptyState
          v-else
          icon="lucide:file-text"
          :title="searchQuery.trim() ? 'No matches' : 'No artifacts yet'"
          :description="searchQuery.trim() ? 'Try another phrase, or clear the search to see everything.' : 'Create an artifact or upload a file to get started.'"
        >
          <template #actions>
            <SButton v-if="searchQuery.trim()" variant="outline" icon="lucide:x" @click="clearSearch">Clear search</SButton>
            <SButton v-else icon="lucide:file-plus" @click="openNewArtifact">New artifact</SButton>
          </template>
        </SEmptyState>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorLanguage } from '~/utils/editor'

useHead({ title: 'Workspace · Serangkai' })

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
}

const folders = ref<Folder[]>([])
const artifacts = ref<Artifact[]>([])
const searchQuery = ref('')
const folderName = ref('')
const parentFolderId = ref('')
const artifactFolderId = ref('')
const artifactTitle = ref('')
const artifactType = ref('markdown')
const artifactVisibility = ref('private')
const artifactContent = ref('# New artifact\n\nStart writing here.')
const selectedFolderId = ref<string | null>(null)
const renameValue = ref('')
const moveParentId = ref('')
const saving = ref(false)
const savingFolder = ref(false)
const folderMessage = ref('')
const error = ref('')

const { confirm } = useConfirm()
const { add: toast } = useToast()

const showNewFolder = ref(false)
const showNewArtifact = ref(false)
const showUpload = ref(false)
const uploadFiles = ref<File[]>([])
const uploadError = ref('')
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const acceptTypes = '.md,.markdown,.txt,.html,.htm,.js,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip' 
const uploadTitle = ref('')
const uploadVisibility = ref('private')
const uploadFolderId = ref('')
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

const typeOptions = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'HTML', value: 'html' },
  { label: 'JSON', value: 'json' },
]

const artifactDefaults: Record<string, string> = {
  markdown: '# New artifact\n\nStart writing here.',
  html: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>New artifact</title>\n  </head>\n  <body>\n    <h1>New artifact</h1>\n  </body>\n</html>',
  json: '{\n  "title": "New artifact"\n}',
}

const artifactLanguage = computed<EditorLanguage>(() => {
  if (artifactType.value === 'html' || artifactType.value === 'json') return artifactType.value
  return 'markdown'
})

// Keep the starter document valid for the selected type, but never overwrite
// content the user actually edited.
watch(artifactType, (type, previous) => {
  if (!artifactContent.value.trim() || artifactContent.value === artifactDefaults[previous]) {
    artifactContent.value = artifactDefaults[type] || artifactDefaults.markdown
  }
})

const visibilityOptions = [
  { label: 'Private', value: 'private' },
  { label: 'Unlisted', value: 'unlisted' },
  { label: 'Public', value: 'public' },
]

const folderOption = (row: Folder & { depth: number }) => ({ label: `${'— '.repeat(row.depth)}${row.name}`, value: row.id })

const moveTargets = computed(() => {
  if (!selectedFolderId.value) return folderRows.value
  const blocked = descendantIds(selectedFolderId.value)
  return folderRows.value.filter(row => !blocked.has(row.id))
})

const parentOptions = computed(() => [{ label: 'Top level', value: '' }, ...folderRows.value.map(folderOption)])
const artifactFolderOptions = computed(() => [{ label: 'No folder', value: '' }, ...folderRows.value.map(folderOption)])
const moveTargetOptions = computed(() => [{ label: 'Top level', value: '' }, ...moveTargets.value.map(folderOption)])

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



const visibleArtifacts = computed(() => {
  if (searchQuery.value.trim()) return artifacts.value
  if (!selectedFolderId.value) return artifacts.value
  const ids = descendantIds(selectedFolderId.value)
  return artifacts.value.filter(artifact => artifact.folderId && ids.has(artifact.folderId))
})

const folderArtifactCount = (folderId: string) => {
  const ids = descendantIds(folderId)
  return artifacts.value.filter(artifact => artifact.folderId && ids.has(artifact.folderId)).length
}

const folderLabel = (folderId: string) => folderMap.value.get(folderId)?.name || ''
const folderIndent = (depth: number) => '— '.repeat(depth)

const formatDate = (value: string) => {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 86_400_000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const closePanels = () => { showNewFolder.value = false; showNewArtifact.value = false; showUpload.value = false }

const openNewFolder = () => {
  closePanels()
  parentFolderId.value = selectedFolderId.value || ''
  showNewFolder.value = true
  error.value = ''
}

const openNewArtifact = () => {
  closePanels()
  artifactFolderId.value = selectedFolderId.value || ''
  showNewArtifact.value = true
  error.value = ''
}

const openUpload = () => {
  closePanels()
  uploadFolderId.value = selectedFolderId.value || ''
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
  selectedFolderId.value = folderId
  renameValue.value = folderId ? folderMap.value.get(folderId)?.name || '' : ''
  moveParentId.value = folderId ? folderMap.value.get(folderId)?.parentId || '' : ''
  folderMessage.value = ''
  closePanels()
  if (searchQuery.value.trim()) search()
}

const loadWorkspace = async () => {
  const [foldersRes, artifactsRes] = await Promise.all([$fetch('/api/folders'), $fetch('/api/artifacts')])
  folders.value = foldersRes.folders || []
  artifacts.value = artifactsRes.artifacts || []
}

const { loggedIn } = useUserSession()

onMounted(async () => {
  if (!loggedIn.value) {
    await navigateTo('/auth/login')
    return
  }
  try {
    await loadWorkspace()
  } catch (e) {
    console.error(e)
  }
})

const search = async () => {
  if (!searchQuery.value.trim()) return loadWorkspace()
  const result = await $fetch('/api/search', { query: { q: searchQuery.value, ...(selectedFolderId.value ? { folderId: selectedFolderId.value } : {}) } })
  folders.value = result.folders || []
  artifacts.value = result.artifacts || []
}

const clearSearch = async () => {
  searchQuery.value = ''
  await loadWorkspace()
}

const createFolder = async () => {
  saving.value = true; error.value = ''
  try {
    const res = await $fetch('/api/folders', { method: 'POST', body: { name: folderName.value, ...(parentFolderId.value ? { parentId: parentFolderId.value } : {}) } })
    folderName.value = ''
    parentFolderId.value = ''
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

const createArtifact = async () => {
  if (!artifactTitle.value.trim()) {
    error.value = 'Add a title before creating the artifact.'
    return
  }
  if (!artifactContent.value.trim()) {
    error.value = 'Add some content before creating the artifact.'
    return
  }
  saving.value = true; error.value = ''
  try {
    await $fetch('/api/artifacts', {
      method: 'POST',
      body: {
        title: artifactTitle.value,
        type: artifactType.value,
        visibility: artifactVisibility.value,
        content: artifactContent.value,
        ...(artifactFolderId.value ? { folderId: artifactFolderId.value } : {}),
      },
    })
    artifactTitle.value = ''
    showNewArtifact.value = false
    await loadWorkspace()
    toast({ title: 'Artifact created', color: 'success' })
  } catch (e: any) {
    error.value = e.data?.message || 'Could not create artifact'
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
    if (uploadFolderId.value) form.append('folderId', uploadFolderId.value)
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
    folderMessage.value = 'Folder renamed.'
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
    const res = await $fetch(`/api/folders/${selectedFolderId.value}`, { method: 'PUT', body: { parentId: moveParentId.value || null } })
    const movedId = res.folder.id
    await loadWorkspace()
    selectFolder(movedId)
    folderMessage.value = 'Folder moved.'
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
    folderMessage.value = e.data?.message || 'Could not delete folder'
  } finally {
    savingFolder.value = false
  }
}
</script>
