<template>
  <form class="serangkai-editor-workspace" aria-label="New rangka" @submit.prevent="createRangka">
    <header class="serangkai-editor-workspace-bar">
      <h1 class="sr-only">New rangka</h1>
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <STooltip text="Back to rangka list"><SButton to="/" variant="ghost" color="neutral" icon="lucide:arrow-left" aria-label="Back to rangka list" class="shrink-0" /></STooltip>
        <SInput v-model="title" placeholder="Untitled rangka" required aria-label="Title" class="min-w-0 max-w-xl flex-1" :ui="{ base: 'bg-transparent font-semibold ring-0 not-focus:hover:ring-0' }" />
        <span class="hidden shrink-0 text-xs text-[var(--selaras-resolved-text-muted)] md:inline">Draft</span>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <SButton to="/" variant="ghost" color="neutral" class="hidden sm:inline-flex" :disabled="saving">Cancel</SButton>
        <STooltip text="Create rangka"><SButton type="submit" icon="lucide:plus" aria-label="Create rangka" :loading="saving" :disabled="saving || loading || !!loadError"><span class="hidden sm:inline">Create rangka</span></SButton></STooltip>
      </div>
    </header>

    <div class="serangkai-editor-properties">
      <SFormField v-slot="{ id }" label="Type"><SSelect :id="id" v-model="type" :items="typeOptions" size="sm" class="w-full" /></SFormField>
      <SFormField v-slot="{ id }" label="Visibility"><SSelect :id="id" v-model="visibility" :items="visibilityOptions" size="sm" class="w-full" /></SFormField>
      <SFormField v-slot="{ id }" label="Folder" class="col-span-2 sm:col-span-1"><SSelect :id="id" v-model="folderId" :items="folderOptions" size="sm" placeholder="No folder" :disabled="loading" class="w-full" /></SFormField>
    </div>

    <div class="serangkai-editor-workspace-body">
      <SerangkaiErrorState v-if="loadError" title="Could not load folders" :description="loadError" retry-label="Try again" class="m-4" @retry="loadFolders" />
      <template v-else>
        <SAlert v-if="error" color="danger" variant="subtle" :title="error" class="m-3 shrink-0" />
        <SerangkaiCodeEditor id="new-rangka-content" v-model="content" :language="language" :dirty="dirty" :autofocus="false" fill embedded aria-label="Content" @save="createRangka" />
      </template>
    </div>
  </form>
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
  if (saving.value || loading.value || loadError.value) return
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
