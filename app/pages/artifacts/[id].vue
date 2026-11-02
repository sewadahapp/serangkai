<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">{{ artifact?.title || 'Loading...' }}</h1>
      <div v-if="artifact" class="flex gap-2">
        <SButton variant="outline" @click="editing = !editing">{{ editing ? 'Preview' : 'Edit' }}</SButton>
        <SButton v-if="artifact.visibility !== 'private'" :to="`/api/share/${artifact.slug}`" target="_blank">Open share link</SButton>
      </div>
    </div>
    
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

onMounted(async () => {
  try {
    const res = await $fetch(`/api/artifacts/${route.params.id}`)
    artifact.value = res.artifact
    content.value = res.content
    renderedContent.value = res.renderedContent || ''
    draftTitle.value = res.artifact.title
    draftContent.value = res.content
    const history = await $fetch(`/api/artifacts/${route.params.id}/versions`)
    versions.value = history.versions || []
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
