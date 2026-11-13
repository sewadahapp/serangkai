<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <NuxtLink to="/workspace" class="inline-flex items-center gap-1 text-sm text-[var(--selaras-resolved-text-muted)] hover:underline"><SIcon name="lucide:arrow-left" class="size-4" /> Workspace</NuxtLink>
        <h1 class="mt-4 text-2xl font-semibold tracking-tight">New rangka</h1>
        <p class="mt-1 text-sm text-[var(--selaras-resolved-text-muted)]">Create a Markdown, HTML, or JSON rangka.</p>
      </div>
    </div>

    <SerangkaiErrorState v-if="loadError" title="Could not load folders" :description="loadError" retry-label="Try again" @retry="loadFolders" />
    <form v-else class="space-y-5" @submit.prevent="createRangka">
      <div class="serangkai-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <SFormField label="Title" required><SInput v-model="title" placeholder="Rangka title" required class="w-full" /></SFormField>
        <SFormField v-slot="{ id }" label="Type"><SSelect :id="id" v-model="type" :items="typeOptions" class="w-full" /></SFormField>
        <SFormField v-slot="{ id }" label="Visibility"><SSelect :id="id" v-model="visibility" :items="visibilityOptions" class="w-full" /></SFormField>
        <SFormField v-slot="{ id }" label="Folder"><SSelect :id="id" v-model="folderId" :items="folderOptions" placeholder="No folder" :disabled="loading" class="w-full" /></SFormField>
      </div>
      <SFormField v-slot="{ id }" label="Content" required>
        <SerangkaiCodeEditor :id="id" v-model="content" :language="language" aria-label="Content" height="32rem" />
      </SFormField>
      <SAlert v-if="error" color="danger" variant="subtle" :title="error" />
      <div class="flex flex-wrap gap-2">
        <SButton type="submit" :loading="saving" :disabled="saving || loading">Create rangka</SButton>
        <SButton to="/workspace" variant="ghost" :disabled="saving">Cancel</SButton>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { NO_FOLDER, folderIdFromSelection, folderSelection } from '~/utils/folders'
import type { EditorLanguage } from '~/utils/editor'
import { onBeforeRouteLeave } from 'vue-router'

useHead({ title: 'New rangka' })
const route = useRoute()
const { loggedIn } = useUserSession()
const { add: toast } = useToast()
const { confirm } = useConfirm()
const title = ref('')
const type = ref('markdown')
const visibility = ref('private')
const folderId = ref(folderSelection(typeof route.query.folderId === 'string' ? route.query.folderId : null))
const defaults: Record<string, string> = {
  markdown: '# New rangka\n\nStart writing here.',
  html: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>New rangka</title>\n  </head>\n  <body>\n    <h1>New rangka</h1>\n  </body>\n</html>',
  json: '{\n  "title": "New rangka"\n}',
}
const content = ref(defaults.markdown)
const initialFolder = folderId.value
const saved = ref(false)
const dirty = computed(() => !!title.value.trim() || type.value !== 'markdown' || visibility.value !== 'private' || folderId.value !== initialFolder || content.value !== defaults.markdown)
const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.value && !saved.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(async () => {
  if (!dirty.value || saved.value) return true
  return await confirm({ title: 'Discard unsaved changes?', description: 'Your new rangka has not been saved.', confirmLabel: 'Discard', confirmColor: 'danger' })
})
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
const language = computed<EditorLanguage>(() => type.value === 'html' || type.value === 'json' ? type.value : 'markdown')
watch(type, (value, previous) => {
  if (!content.value.trim() || content.value === defaults[previous]) content.value = defaults[value] || defaults.markdown
})
const typeOptions = [{ label: 'Markdown', value: 'markdown' }, { label: 'HTML', value: 'html' }, { label: 'JSON', value: 'json' }]
const visibilityOptions = [{ label: 'Private', value: 'private' }, { label: 'Unlisted', value: 'unlisted' }, { label: 'Public', value: 'public' }]
const folders = ref<Array<{ id: string; path: string }>>([])
const folderOptions = computed(() => [{ label: 'No folder', value: NO_FOLDER }, ...folders.value.map(folder => ({ label: folder.path.replace(/^\//, '').replaceAll('/', ' / '), value: folder.id }))])
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const error = ref('')

const loadFolders = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const result = await $fetch('/api/folders')
    folders.value = result.folders
    if (folderId.value !== NO_FOLDER && !folders.value.some(folder => folder.id === folderId.value)) folderId.value = NO_FOLDER
  } catch (e: any) {
    loadError.value = e?.data?.message || 'Could not reach the server. Try again.'
  } finally { loading.value = false }
}
onMounted(async () => {
  if (!loggedIn.value) { await navigateTo('/auth/login'); return }
  await loadFolders()
})
const createRangka = async () => {
  if (!title.value.trim() || !content.value.trim()) { error.value = 'Add a title and content before creating the rangka.'; return }
  saving.value = true
  error.value = ''
  try {
    const folder = folderIdFromSelection(folderId.value)
    const result = await $fetch('/api/rangka', { method: 'POST', body: { title: title.value, type: type.value, visibility: visibility.value, content: content.value, ...(folder ? { folderId: folder } : {}) } })
    saved.value = true
    toast({ title: 'Rangka created', color: 'success' })
    await navigateTo(`/rangka/${result.rangka.id}`)
  } catch (e: any) {
    error.value = e?.data?.message || 'Could not create rangka'
  } finally { saving.value = false }
}
</script>
