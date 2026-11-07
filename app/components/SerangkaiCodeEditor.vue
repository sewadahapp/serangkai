<template>
  <div
    class="serangkai-editor"
    :class="{ 'serangkai-editor-fill': fill, 'serangkai-editor-fullscreen': fullscreen }"
    :style="{ '--serangkai-editor-height': height }"
  >
    <div class="serangkai-editor-toolbar">
      <div class="serangkai-editor-tab" :title="fileName">
        <SIcon :name="fileMeta.icon" class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ fileName }}</span>
        <span v-if="dirty" class="serangkai-editor-dirty" role="status">
          <span class="sr-only">Unsaved changes</span>
        </span>
      </div>

      <div class="ms-auto flex shrink-0 items-center gap-2">
        <span class="hidden text-[0.6875rem] font-medium tracking-wide text-[var(--selaras-resolved-text-muted)] sm:inline">
          {{ fileMeta.label }}
        </span>
        <button
          v-if="!fill"
          type="button"
          class="serangkai-editor-action"
          :aria-label="fullscreen ? 'Exit fullscreen editor' : 'Fullscreen editor'"
          :aria-pressed="fullscreen"
          @click="toggleFullscreen"
        >
          <SIcon :name="fullscreen ? 'lucide:minimize-2' : 'lucide:maximize-2'" class="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="serangkai-editor-body">
      <ClientOnly>
        <LazySerangkaiEditor
          v-model="model"
          :id="id"
          :language="language"
          :aria-label="ariaLabel"
          :autofocus="autofocus"
          @save="emit('save')"
          @status="status = $event"
        />
        <template #fallback>
          <div class="serangkai-editor-loading" role="status">Loading editor…</div>
        </template>
      </ClientOnly>
    </div>

    <div class="serangkai-editor-status" aria-hidden="true">
      <span class="flex min-w-0 items-center gap-2">
        <span class="serangkai-tabular">Ln {{ status.line }}, Col {{ status.column }}</span>
        <span class="serangkai-editor-status-sep hidden sm:inline" />
        <span class="hidden sm:inline">{{ status.lines }} lines</span>
        <span class="serangkai-editor-status-sep hidden md:inline" />
        <span class="hidden md:inline">{{ status.chars }} chars</span>
      </span>
      <span class="hidden shrink-0 items-center gap-2 sm:flex">
        <span v-if="version" class="serangkai-tabular">v{{ version }}</span>
        <span>UTF-8</span>
        <span>Spaces: 2</span>
        <span class="hidden md:inline">{{ fileMeta.label }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { editorLanguageMeta, type EditorLanguage, type EditorStatus } from '~/utils/editor'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: EditorLanguage
  id?: string
  filename?: string
  version?: number | null
  dirty?: boolean
  ariaLabel?: string
  fill?: boolean
  height?: string
  autofocus?: boolean
}>(), {
  language: 'text',
  filename: '',
  version: null,
  dirty: false,
  ariaLabel: 'Content',
  fill: false,
  height: '28rem',
  autofocus: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

const status = ref<EditorStatus>({
  line: 1,
  column: 1,
  lines: 1,
  chars: props.modelValue.length,
  selected: 0,
})

const fullscreen = ref(false)
const fileMeta = computed(() => editorLanguageMeta[props.language])
const fileName = computed(() => props.filename || fileMeta.value.name)

const toggleFullscreen = () => {
  fullscreen.value = !fullscreen.value
  if (import.meta.client) {
    document.documentElement.classList.toggle('serangkai-editor-fullscreen-open', fullscreen.value)
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && fullscreen.value) {
    event.stopPropagation()
    toggleFullscreen()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (import.meta.client) {
    document.documentElement.classList.remove('serangkai-editor-fullscreen-open')
  }
})
</script>
