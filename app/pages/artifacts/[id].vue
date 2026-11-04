<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">{{ artifact?.title || 'Loading...' }}</h1>
      <div v-if="artifact" class="flex flex-wrap gap-2">
        <SButton variant="outline" @click="editing = !editing">{{ editing ? 'Preview' : 'Edit' }}</SButton>
        <SButton variant="outline" :to="`/api/artifacts/${route.params.id}/download`">Download</SButton>
        <SButton v-if="shareUrl" variant="outline" :to="shareUrl" target="_blank" rel="noopener">Open share link</SButton>
        <template v-if="confirmDelete">
          <SButton variant="outline" :disabled="deleting" @click="removeArtifact">{{ deleting ? 'Deleting...' : 'Confirm delete' }}</SButton>
          <SButton variant="ghost" @click="confirmDelete = false">Cancel</SButton>
        </template>
        <SButton v-else variant="outline" @click="confirmDelete = true">Delete</SButton>
      </div>
    </div>
    <p v-if="deleteMessage" class="mb-4 text-sm text-red-500">{{ deleteMessage }}</p>
    
    <SCard v-if="artifact">
      <SCardHeader>
        <SCardTitle>Content</SCardTitle>
      </SCardHeader>
      <SCardContent>
        <form v-if="editing" class="space-y-3" @submit.prevent="save">
          <SInput v-model="draftTitle" required />
          <textarea v-model="draftContent" class="min-h-96 w-full rounded-md border bg-background p-4 font-mono text-sm" required />
          <div class="flex items-center gap-3">
            <SButton type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save version' }}</SButton>
            <span v-if="message" class="text-sm text-muted-foreground">{{ message }}</span>
          </div>
        </form>
        <MarkdownDocument v-if="!editing && artifact.type === 'markdown'" :html="renderedContent" />
        <pre v-else-if="!editing" class="whitespace-pre-wrap bg-muted p-4 rounded overflow-auto">{{ content }}</pre>
      </SCardContent>
    </SCard>

    <SCard v-if="artifact" class="mt-6">
      <SCardHeader><SCardTitle>Sharing</SCardTitle></SCardHeader>
      <SCardContent>
        <div class="space-y-3">
          <label class="block text-sm">
            <span class="mb-1 block text-muted-foreground">Visibility</span>
            <select v-model="draftVisibility" aria-label="Artifact visibility" class="rounded-md border bg-background px-3 py-2">
              <option value="private">Private — only you</option>
              <option value="unlisted">Unlisted — signed link required</option>
              <option value="public">Public — anyone with the link</option>
            </select>
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <SButton :disabled="savingVisibility" @click="saveVisibility">{{ savingVisibility ? 'Saving...' : 'Save visibility' }}</SButton>
            <SButton v-if="draftVisibility !== 'private'" variant="outline" :to="shareUrl || undefined" target="_blank" rel="noopener" :disabled="!shareUrl">Open share link</SButton>
          </div>
          <p v-if="draftVisibility === 'private'" class="text-sm text-muted-foreground">Only you can open this artifact.</p>
          <template v-else-if="shareUrl">
            <input :value="shareUrl" readonly aria-label="Share link" class="w-full rounded-md border bg-muted px-3 py-2 font-mono text-xs" />
            <p class="text-sm text-muted-foreground">{{ draftVisibility === 'unlisted' ? 'The signed link is required to open this artifact. Anyone with the link can read it.' : 'Anyone with the link can read this artifact.' }}</p>
          </template>
          <p v-if="shareMessage" class="text-sm text-muted-foreground">{{ shareMessage }}</p>
        </div>
      </SCardContent>
    </SCard>

    <SCard v-if="artifact" class="mt-6">
      <SCardHeader><SCardTitle>Folder</SCardTitle></SCardHeader>
      <SCardContent>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="draftFolderId" aria-label="Artifact folder" class="rounded-md border bg-background px-3 py-2">
            <option value="">No folder</option>
            <option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.path || folder.name }}</option>
          </select>
          <SButton :disabled="savingFolder" @click="saveFolder">{{ savingFolder ? 'Moving...' : 'Move artifact' }}</SButton>
          <span v-if="folderMessage" class="text-sm text-muted-foreground">{{ folderMessage }}</span>
        </div>
      </SCardContent>
    </SCard>

    <SCard v-if="versions.length" class="mt-6">
      <SCardHeader><SCardTitle>Version history</SCardTitle></SCardHeader>
      <SCardContent><ol class="space-y-2 text-sm"><li v-for="version in versions" :key="version.id" class="flex justify-between"><span>Version {{ version.version }}</span><time>{{ new Date(version.createdAt).toLocaleString() }}</time></li></ol></SCardContent>
    </SCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const artifact = ref(null)
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
const confirmDelete = ref(false)
const deleting = ref(false)
const deleteMessage = ref('')

const loadShareLink = async () => {
  shareUrl.value = ''
  if (draftVisibility.value === 'private') return
  try {
    const link = await $fetch(`/api/artifacts/${route.params.id}/share`, { method: 'POST' })
    shareUrl.value = link.url
  } catch (e: any) {
    shareMessage.value = e.data?.message || 'Could not create a share link'
  }
}

const saveVisibility = async () => {
  savingVisibility.value = true; shareMessage.value = ''
  try {
    const res = await $fetch(`/api/artifacts/${route.params.id}`, { method: 'PUT', body: { visibility: draftVisibility.value } })
    artifact.value = res.artifact
    await loadShareLink()
    if (!shareMessage.value) shareMessage.value = 'Sharing settings saved.'
  } catch (e: any) { shareMessage.value = e.data?.message || 'Could not save sharing settings' }
  finally { savingVisibility.value = false }
}

const saveFolder = async () => {
  savingFolder.value = true; folderMessage.value = ''
  try {
    const res = await $fetch(`/api/artifacts/${route.params.id}`, { method: 'PUT', body: { folderId: draftFolderId.value || null } })
    artifact.value = res.artifact
    folderMessage.value = 'Folder updated.'
  } catch (e: any) { folderMessage.value = e.data?.message || 'Could not move artifact' }
  finally { savingFolder.value = false }
}

const removeArtifact = async () => {
  deleting.value = true; deleteMessage.value = ''
  try {
    await $fetch(`/api/artifacts/${route.params.id}`, { method: 'DELETE' })
    await navigateTo('/workspace')
  } catch (e: any) {
    deleteMessage.value = e.data?.message || 'Could not delete artifact'
    confirmDelete.value = false
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  try {
    const res = await $fetch(`/api/artifacts/${route.params.id}`)
    artifact.value = res.artifact
    content.value = res.content
    renderedContent.value = res.renderedContent || ''
    draftTitle.value = res.artifact.title
    draftContent.value = res.content
    draftVisibility.value = res.artifact.visibility
    draftFolderId.value = res.artifact.folderId || ''
    await loadShareLink()
    const [history, folderList] = await Promise.all([
      $fetch(`/api/artifacts/${route.params.id}/versions`),
      $fetch('/api/folders'),
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
    const res = await $fetch(`/api/artifacts/${route.params.id}`, { method: 'PUT', body: { title: draftTitle.value, content: draftContent.value } })
    artifact.value = res.artifact
    content.value = draftContent.value
    renderedContent.value = res.artifact.type === 'markdown' ? (await $fetch(`/api/artifacts/${route.params.id}`)).renderedContent : ''
    versions.value = (await $fetch(`/api/artifacts/${route.params.id}/versions`)).versions || []
    editing.value = false; message.value = `Saved version ${res.version}`
  } catch (e: any) { message.value = e.data?.message || 'Could not save' }
  finally { saving.value = false }
}

</script>
