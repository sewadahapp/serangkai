<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Workspace</h1>
      <div class="flex gap-2">
        <SButton @click="showNewFolder = true">New Folder</SButton>
        <SButton @click="showNewArtifact = true">New Artifact</SButton>
      </div>
    </div>

    <SCard v-if="showNewFolder || showNewArtifact" class="mb-6">
      <SCardHeader>
        <SCardTitle>{{ showNewFolder ? 'Create folder' : 'Create artifact' }}</SCardTitle>
      </SCardHeader>
      <SCardContent>
        <form v-if="showNewFolder" class="flex gap-3" @submit.prevent="createFolder">
          <SInput v-model="folderName" placeholder="Folder name" required class="flex-1" />
          <SButton type="submit" :disabled="saving">Create</SButton>
          <SButton type="button" variant="ghost" @click="showNewFolder = false">Cancel</SButton>
        </form>
        <form v-else class="space-y-3" @submit.prevent="createArtifact">
          <SInput v-model="artifactTitle" placeholder="Artifact title" required />
          <div class="grid gap-3 sm:grid-cols-2">
            <select v-model="artifactType" class="rounded-md border bg-background px-3 py-2">
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
            </select>
            <select v-model="artifactVisibility" class="rounded-md border bg-background px-3 py-2">
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
            </select>
          </div>
          <textarea v-model="artifactContent" class="min-h-48 w-full rounded-md border bg-background p-3 font-mono text-sm" placeholder="# Start writing..." required />
          <div class="flex gap-2">
            <SButton type="submit" :disabled="saving">Create artifact</SButton>
            <SButton type="button" variant="ghost" @click="showNewArtifact = false">Cancel</SButton>
          </div>
        </form>
        <p v-if="error" class="mt-3 text-sm text-red-500">{{ error }}</p>
      </SCardContent>
    </SCard>

    <div class="mb-6">
      <SInput v-model="searchQuery" placeholder="Search artifacts and folders..." @input="search" />
    </div>
    
    <div class="grid md:grid-cols-4 gap-6">
      <aside class="md:col-span-1">
        <SCard>
          <SCardHeader>
            <SCardTitle>Folders</SCardTitle>
          </SCardHeader>
          <SCardContent>
            <div class="space-y-1">
              <div v-for="folder in folders" :key="folder.id" class="p-2 hover:bg-accent rounded cursor-pointer">
                {{ folder.name }}
              </div>
              <div v-if="folders.length === 0" class="text-sm text-muted-foreground">No folders</div>
            </div>
          </SCardContent>
        </SCard>
      </aside>
      
      <main class="md:col-span-3">
        <SCard>
          <SCardHeader>
            <SCardTitle>Artifacts</SCardTitle>
          </SCardHeader>
          <SCardContent>
            <div class="space-y-2">
              <NuxtLink v-for="artifact in artifacts" :key="artifact.id" :to="`/artifacts/${artifact.id}`" 
                class="block p-4 border rounded hover:bg-accent">
                <div class="flex justify-between">
                  <div>
                    <h3 class="font-semibold">{{ artifact.title }}</h3>
                    <p class="text-sm text-muted-foreground">{{ artifact.type }} • {{ artifact.visibility }}</p>
                  </div>
                </div>
              </NuxtLink>
              <div v-if="artifacts.length === 0" class="text-center text-muted-foreground py-8">
                No artifacts yet. Create your first artifact!
              </div>
            </div>
          </SCardContent>
        </SCard>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const folders = ref([])
const artifacts = ref([])
const searchQuery = ref('')
const folderName = ref('')
const artifactTitle = ref('')
const artifactType = ref('markdown')
const artifactVisibility = ref('private')
const artifactContent = ref('# New artifact\n\nStart writing here.')
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const [foldersRes, artifactsRes] = await Promise.all([
      $fetch('/api/folders'),
      $fetch('/api/artifacts')
    ])
    folders.value = foldersRes.folders || []
    artifacts.value = artifactsRes.artifacts || []
  } catch (e) {
    console.error(e)
  }
})

const showNewFolder = ref(false)
const showNewArtifact = ref(false)

const loadWorkspace = async () => {
  const [foldersRes, artifactsRes] = await Promise.all([$fetch('/api/folders'), $fetch('/api/artifacts')])
  folders.value = foldersRes.folders || []
  artifacts.value = artifactsRes.artifacts || []
}

const search = async () => {
  if (!searchQuery.value.trim()) return loadWorkspace()
  const result = await $fetch('/api/search', { query: { q: searchQuery.value } })
  folders.value = result.folders || []
  artifacts.value = result.artifacts || []
}

const createFolder = async () => {
  saving.value = true; error.value = ''
  try { await $fetch('/api/folders', { method: 'POST', body: { name: folderName.value } }); folderName.value = ''; showNewFolder.value = false; await loadWorkspace() }
  catch (e: any) { error.value = e.data?.message || 'Could not create folder' }
  finally { saving.value = false }
}

const createArtifact = async () => {
  saving.value = true; error.value = ''
  try { await $fetch('/api/artifacts', { method: 'POST', body: { title: artifactTitle.value, type: artifactType.value, visibility: artifactVisibility.value, content: artifactContent.value } }); artifactTitle.value = ''; showNewArtifact.value = false; await loadWorkspace() }
  catch (e: any) { error.value = e.data?.message || 'Could not create artifact' }
  finally { saving.value = false }
}
</script>
