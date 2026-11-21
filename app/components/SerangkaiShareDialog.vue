<template>
  <!-- One share dialog for the workspace list and the rangka page. Picking a
       visibility saves it right away, like the "general access" control in
       document tools; the link appears as soon as the rangka is shareable. -->
  <SModal v-model:open="open" title="Share rangka" :description="rangka?.title">
    <template #body>
      <div class="space-y-4">
        <SFormField v-slot="{ id }" label="Visibility">
          <SSelect :id="id" :model-value="visibility" :items="visibilityOptions" :disabled="saving" class="w-full" @update:model-value="changeVisibility" />
        </SFormField>
        <p class="text-sm text-[var(--selaras-resolved-text-muted)]" role="status">
          <template v-if="saving">Saving…</template>
          <template v-else>{{ visibilityHelp[visibility] }}</template>
        </p>
        <SFormField v-if="visibility !== 'private' && shareUrl" label="Share link">
          <SInput :model-value="shareUrl" readonly aria-label="Share link" class="w-full font-mono text-xs">
            <template #trailing="{ buttonSize }"><SerangkaiCopyButton :value="shareUrl" label="share link" :size="buttonSize" /></template>
          </SInput>
        </SFormField>
        <SAlert v-if="error" color="danger" variant="subtle" :title="error" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <SButton v-if="visibility !== 'private' && shareUrl" variant="outline" color="neutral" icon="lucide:external-link" :to="shareUrl" target="_blank" rel="noopener">Open link</SButton>
        <SButton @click="open = false">Done</SButton>
      </div>
    </template>
  </SModal>
</template>

<script setup lang="ts">
type Visibility = 'private' | 'unlisted' | 'public'
type ShareTarget = { id: string; title: string; visibility: string }

const props = defineProps<{ rangka: ShareTarget | null }>()
const emit = defineEmits<{ updated: [rangka: any, shareUrl: string | null] }>()
const open = defineModel<boolean>('open', { default: false })
const { add: toast } = useToast()

const visibilityOptions = [
  { label: 'Private', value: 'private', icon: 'lucide:lock' },
  { label: 'Unlisted', value: 'unlisted', icon: 'lucide:link' },
  { label: 'Public', value: 'public', icon: 'lucide:globe' },
]
const visibilityHelp: Record<Visibility, string> = {
  private: 'Only you can open this rangka.',
  unlisted: 'Anyone with the signed link can read this rangka.',
  public: 'Anyone with the link can read this rangka.',
}
const visibility = ref<Visibility>('private')
const shareUrl = ref<string | null>(null)
const saving = ref(false)
const error = ref('')

const loadLink = async (id: string) => {
  if (visibility.value === 'private') { shareUrl.value = null; return }
  const link = await $fetch<any>(`/api/rangka/${id}/share`, { method: 'POST' })
  shareUrl.value = link.url
}

watch(open, async (value) => {
  if (!value || !props.rangka) return
  visibility.value = props.rangka.visibility as Visibility
  shareUrl.value = null
  error.value = ''
  try { await loadLink(props.rangka.id) } catch (e: any) { error.value = e?.data?.message || 'Could not create a share link.' }
}, { immediate: true })

const changeVisibility = async (value: unknown) => {
  const target = props.rangka
  const next = value as Visibility
  if (!target || saving.value || next === visibility.value) return
  const previous = visibility.value
  visibility.value = next
  saving.value = true
  error.value = ''
  let result: any
  try {
    result = await $fetch<any>(`/api/rangka/${target.id}`, { method: 'PUT', body: { visibility: next } })
  } catch (e: any) {
    visibility.value = previous
    error.value = e?.data?.message || 'Could not change who can open this rangka.'
    saving.value = false
    return
  }
  // The visibility is saved even if minting the link fails; say so separately.
  try { await loadLink(target.id) } catch (e: any) { shareUrl.value = null; error.value = e?.data?.message || 'Saved, but could not create a share link.' }
  saving.value = false
  toast({ title: next === 'private' ? 'Rangka is private' : next === 'public' ? 'Rangka is public' : 'Rangka is unlisted', color: 'success' })
  emit('updated', result.rangka, shareUrl.value)
}
</script>
