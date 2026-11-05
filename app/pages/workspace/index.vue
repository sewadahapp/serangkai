<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Workspace</h1>
      <div class="flex gap-2">
        <SButton @click="openNewFolder">New Folder</SButton>
        <SButton @click="openNewArtifact">New Artifact</SButton>
        <SButton variant="outline" @click="openUpload">Upload</SButton>
      </div>
    </div>

    <SCard v-if="showNewFolder || showNewArtifact || showUpload" class="mb-6">
      <SCardHeader>
        <SCardTitle>{{ showNewFolder ? 'Create folder' : showUpload ? 'Upload artifact' : 'Create artifact' }}</SCardTitle>
      </SCardHeader>
      <SCardContent>
        <form v-if="showNewFolder" class="space-y-3" @submit.prevent="createFolder">
          <SInput v-model="folderName" placeholder="Folder name" required class="w-full" />
          <select v-model="parentFolderId" aria-label="Parent folder" class="w-full rounded-md border bg-background px-3 py-2">
            <option value="">Top level</option>
            <option v-for="row in folderRows" :key="row.id" :value="row.id">{{ folderIndent(row.depth) }}{{ row.name }}</option>
          </select>
          <div class="flex gap-2">
            <SButton type="submit" :disabled="saving">Create</SButton>
            <SButton type="button" variant="ghost" @click="showNewFolder = false">Cancel</SButton>
          </div>
        </form>
        <form v-else-if="showNewArtifact" class="space-y-3" @submit.prevent="createArtifact">
          <SInput v-model="artifactTitle" placeholder="Artifact title" required />
          <div class="grid gap-3 sm:grid-cols-3">
            <select v-model="artifactType" aria-label="Artifact type" class="rounded-md border bg-background px-3 py-2">
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
            </select>
            <select v-model="artifactVisibility" aria-label="Artifact visibility" class="rounded-md border bg-background px-3 py-2">
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
            </select>
            <select v-model="artifactFolderId" aria-label="Artifact folder" class="rounded-md border bg-background px-3 py-2">
              <option value="">No folder</option>
              <option v-for="row in folderRows" :key="row.id" :value="row.id">{{ folderIndent(row.depth) }}{{ row.name }}</option>
            </select>
          </div>
          <textarea v-model="artifactContent" class="min-h-48 w-full rounded-md border bg-background p-3 font-mono text-sm" placeholder="# Start writing..." required />
          <div class="flex gap-2">
            <SButton type="submit" :disabled="saving">Create artifact</SButton>
            <SButton type="button" variant="ghost" @click="showNewArtifact = false">Cancel</SButton>
          </div>
        </form>
        <form v-else class="space-y-3" @submit.prevent="uploadArtifact">
          <input
            type="file"
            aria-label="Artifact file"
            accept=".md,.markdown,.txt,.html,.htm,.js,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip"
            class="block w-full rounded-md border bg-background px-3 py-2 text-sm"
            @change="selectUploadFile"
          />
          <div class="grid gap-3 sm:grid-cols-3">
            <SInput v-model="uploadTitle" placeholder="Title (optional)" />
            <select v-model="uploadVisibility" aria-label="Upload visibility" class="rounded-md border bg-background px-3 py-2">
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
            <select v-model="uploadFolderId" aria-label="Upload folder" class="rounded-md border bg-background px-3 py-2">
              <option value="">No folder</option>
              <option v-for="row in folderRows" :key="row.id" :value="row.id">{{ folderIndent(row.depth) }}{{ row.name }}</option>
            </select>
          </div>
          <p v-if="uploadFile" class="text-sm text-muted-foreground">{{ uploadFile.name }} · {{ (uploadFile.size / 1024).toFixed(1) }} KiB</p>
          <div class="flex gap-2">
            <SButton type="submit" :disabled="uploading || !uploadFile">{{ uploading ? 'Uploading...' : 'Upload artifact' }}</SButton>
            <SButton type="button" variant="ghost" @click="showUpload = false">Cancel</SButton>
          </div>
        </form>
        <p v-if="error" class="mt-3 text-sm text-red-500">{{ error }}</p>
      </SCardContent>
    </SCard>

    <div class="mb-6">
      <SInput v-model="searchQuery" placeholder="Search artifacts and folders..." @input="search" />
      <p v-if="searchQuery.trim()" class="mt-2 text-sm text-muted-foreground">
        {{ selectedFolder ? `Searching in ${selectedFolder.name} and its subfolders` : 'Searching all artifacts and folders' }}
      </p>
    </div>
    
    <div class="grid md:grid-cols-4 gap-6">
      <aside class="md:col-span-1">
        <SCard>
          <SCardHeader>
            <SCardTitle>Folders</SCardTitle>
          </SCardHeader>
          <SCardContent>
            <div class="space-y-1">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded p-2 text-left hover:bg-accent"
                :class="{ 'bg-accent': selectedFolderId === null }"
                @click="selectFolder(null)"
              >
                <span>All artifacts</span>
                <span class="text-xs text-muted-foreground">{{ artifacts.length }}</span>
              </button>
              <button
                v-for="row in folderRows"
                :key="row.id"
                type="button"
                class="flex w-full items-center justify-between rounded p-2 text-left hover:bg-accent"
                :class="{ 'bg-accent': selectedFolderId === row.id }"
                :style="{ paddingLeft: `${0.5 + row.depth * 0.9}rem` }"
                @click="selectFolder(row.id)"
              >
                <span class="truncate">{{ row.name }}</span>
                <span class="text-xs text-muted-foreground">{{ folderArtifactCount(row.id) }}</span>
              </button>
              <div v-if="folderRows.length === 0" class="text-sm text-muted-foreground">No folders</div>
            </div>
            <div v-if="selectedFolder" class="mt-3 space-y-2 border-t pt-3">
              <div class="flex gap-2">
                <SInput v-model="renameValue" placeholder="Rename folder" class="flex-1" />
                <SButton :disabled="savingFolder" @click="renameFolder">Rename</SButton>
              </div>
              <div class="flex gap-2">
                <select v-model="moveParentId" aria-label="Move folder under" class="flex-1 rounded-md border bg-background px-3 py-2">
                  <option value="">Top level</option>
                  <option v-for="row in moveTargets" :key="row.id" :value="row.id">{{ folderIndent(row.depth) }}{{ row.name }}</option>
                </select>
                <SButton :disabled="savingFolder" @click="moveFolder">Move</SButton>
              </div>
              <template v-if="confirmDeleteFolder">
                <p class="text-sm text-muted-foreground">Delete “{{ selectedFolder.name }}”? Only empty folders can be deleted.</p>
                <div class="flex gap-2">
                  <SButton variant="outline" :disabled="savingFolder" @click="deleteFolder">Confirm delete</SButton>
                  <SButton variant="ghost" @click="confirmDeleteFolder = false">Cancel</SButton>
                </div>
              </template>
              <SButton v-else variant="outline" @click="confirmDeleteFolder = true">Delete folder</SButton>
              <p v-if="folderMessage" class="text-sm text-muted-foreground">{{ folderMessage }}</p>
            </div>
          </SCardContent>
        </SCard>
      </aside>
      
      <main class="md:col-span-3">
        <SCard>
          <SCardHeader>
            <SCardTitle>{{ selectedFolder ? selectedFolder.name : 'Artifacts' }}</SCardTitle>
          </SCardHeader>
          <SCardContent>
            <div class="space-y-2">
              <NuxtLink v-for="artifact in visibleArtifacts" :key="artifact.id" :to="`/artifacts/${artifact.id}`" 
                class="block p-4 border rounded hover:bg-accent">
                <div class="flex justify-between">
                  <div>
                    <h3 class="font-semibold">{{ artifact.title }}</h3>
                    <p class="text-sm text-muted-foreground">
                      {{ artifact.type }} • {{ artifact.visibility }}<template v-if="artifact.folderId"> • {{ folderLabel(artifact.folderId) }}</template>
                    </p>
                  </div>
                </div>
              </NuxtLink>
              <div v-if="visibleArtifacts.length === 0" class="text-center text-muted-foreground py-8">
                {{ selectedFolder ? 'No artifacts in this folder yet.' : 'No artifacts yet. Create your first artifact!' }}
              </div>
            </div>
          </SCardContent>
        </SCard>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
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
const savingFolder = ref(false)
const confirmDeleteFolder = ref(false)
const folderMessage = ref('')
const saving = ref(false)
const error = ref('')

const showNewFolder = ref(false)
const showNewArtifact = ref(false)
const showUpload = ref(false)
const uploadFile = ref<File | null>(null)
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

const selectedFolder = computed(() => selectedFolderId.value ? folderMap.value.get(selectedFolderId.value) || null : null)

const moveTargets = computed(() => {
  if (!selectedFolderId.value) return folderRows.value
  const blocked = descendantIds(selectedFolderId.value)
  return folderRows.value.filter(row => !blocked.has(row.id))
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

const openNewFolder = () => {
  parentFolderId.value = selectedFolderId.value || ''
  showNewFolder.value = true
  showNewArtifact.value = false
  showUpload.value = false
}

const openNewArtifact = () => {
  artifactFolderId.value = selectedFolderId.value || ''
  showNewArtifact.value = true
  showNewFolder.value = false
  showUpload.value = false
}

const openUpload = () => {
  uploadFolderId.value = selectedFolderId.value || ''
  uploadFile.value = null
  uploadTitle.value = ''
  showUpload.value = true
  showNewFolder.value = false
  showNewArtifact.value = false
  error.value = ''
}

const selectUploadFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  uploadFile.value = file
  if (file && !uploadTitle.value) uploadTitle.value = file.name.replace(/\.[^.]+$/, '')
}

const selectFolder = (folderId: string | null) => {
  selectedFolderId.value = folderId
  renameValue.value = folderId ? folderMap.value.get(folderId)?.name || '' : ''
  moveParentId.value = folderId ? folderMap.value.get(folderId)?.parentId || '' : ''
  confirmDeleteFolder.value = false
  folderMessage.value = ''
  showNewFolder.value = false
  showNewArtifact.value = false
  showUpload.value = false
  if (searchQuery.value.trim()) search()
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
  if (!selectedFolderId.value) return
  savingFolder.value = true; folderMessage.value = ''
  try {
    await $fetch(`/api/folders/${selectedFolderId.value}`, { method: 'DELETE' })
    selectedFolderId.value = null
    renameValue.value = ''
    confirmDeleteFolder.value = false
    await loadWorkspace()
  } catch (e: any) {
    folderMessage.value = e.data?.message || 'Could not delete folder'
  } finally {
    savingFolder.value = false
  }
}

const loadWorkspace = async () => {
  const [foldersRes, artifactsRes] = await Promise.all([$fetch('/api/folders'), $fetch('/api/artifacts')])
  folders.value = foldersRes.folders || []
  artifacts.value = artifactsRes.artifacts || []
}

onMounted(async () => {
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

const createFolder = async () => {
  saving.value = true; error.value = ''
  try {
    const res = await $fetch('/api/folders', { method: 'POST', body: { name: folderName.value, ...(parentFolderId.value ? { parentId: parentFolderId.value } : {}) } })
    folderName.value = ''
    parentFolderId.value = ''
    showNewFolder.value = false
    await loadWorkspace()
    selectFolder(res.folder.id)
  } catch (e: any) {
    error.value = e.data?.message || 'Could not create folder'
  } finally {
    saving.value = false
  }
}

const createArtifact = async () => {
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
  } catch (e: any) {
    error.value = e.data?.message || 'Could not create artifact'
  } finally {
    saving.value = false
  }
}

const uploadArtifact = async () => {
  if (!uploadFile.value) {
    error.value = 'Choose a file to upload'
    return
  }
  uploading.value = true; error.value = ''
  try {
    const form = new FormData()
    form.append('file', uploadFile.value)
    if (uploadTitle.value.trim()) form.append('title', uploadTitle.value.trim())
    form.append('visibility', uploadVisibility.value)
    if (uploadFolderId.value) form.append('folderId', uploadFolderId.value)
    await $fetch('/api/artifacts/upload', { method: 'POST', body: form })
    showUpload.value = false
    uploadFile.value = null
    uploadTitle.value = ''
    await loadWorkspace()
  } catch (e: any) {
    error.value = e.data?.message || 'Could not upload artifact'
  } finally {
    uploading.value = false
  }
}
</script>
