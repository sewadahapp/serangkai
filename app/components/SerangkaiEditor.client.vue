<template>
  <div ref="host" class="serangkai-editor-host" />
</template>

<script setup lang="ts">
import { basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { html } from '@codemirror/lang-html'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { lintGutter, linter } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import type { EditorLanguage, EditorStatus } from '~/utils/editor'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: EditorLanguage
  ariaLabel?: string
  id?: string
  autofocus?: boolean
}>(), {
  language: 'text',
  ariaLabel: 'Content',
  autofocus: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  status: [status: EditorStatus]
  ready: []
}>()

const host = ref<HTMLElement | null>(null)
const languageCompartment = new Compartment()
let view: EditorView | null = null

const languageExtension = (language: EditorLanguage): Extension => {
  switch (language) {
    case 'html':
      return html()
    case 'json':
      return [json(), jsonLinter, lintGutter()]
    case 'javascript':
      return javascript()
    case 'markdown':
      return [markdown(), EditorView.lineWrapping]
    default:
      return []
  }
}

// V8 omits the character position from some JSON.parse errors ("Unexpected
// token '}'"). Prefer the descriptive message, but move those position-less
// diagnostics to the parser's error node so the marker lands on the bad line.
const jsonLinter = linter((view) => {
  const diagnostics = jsonParseLinter()(view)
  if (!diagnostics.length) return diagnostics

  const hasPosition = (diagnostic: { from: number; to: number }) => diagnostic.from !== 0 || diagnostic.to !== 0
  if (diagnostics.every(hasPosition)) return diagnostics

  let fallback = 0
  syntaxTree(view.state).iterate({
    enter(node) {
      if (!fallback && node.type.isError) fallback = node.from
    },
  })

  return diagnostics.map(diagnostic => hasPosition(diagnostic)
    ? diagnostic
    : { ...diagnostic, from: fallback, to: fallback })
}, { delay: 250 })

// Use Selaras' resolved palette so the editor follows the active color mode
// without shipping a foreign theme. Highlighters added with syntaxHighlighting
// outrank basicSetup's fallback style.
const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: 'var(--selaras-resolved-color-primary-text)', fontWeight: '600' },
  { tag: [tags.tagName, tags.typeName], color: 'var(--selaras-resolved-color-danger-text)' },
  { tag: [tags.attributeName], color: 'var(--selaras-resolved-color-warning-text)' },
  { tag: [tags.propertyName], color: 'var(--selaras-resolved-color-primary-text)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.escape], color: 'var(--selaras-resolved-color-success-text)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit], color: 'var(--selaras-resolved-color-warning-text)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--selaras-resolved-text-muted)', fontStyle: 'italic' },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: 'var(--selaras-resolved-text-muted)' },
  { tag: [tags.meta, tags.processingInstruction, tags.annotation], color: 'var(--selaras-resolved-color-accent-text)' },
  { tag: [tags.link, tags.url], color: 'var(--selaras-resolved-color-primary-text)', textDecoration: 'underline' },
  { tag: [tags.heading], fontWeight: '700' },
  { tag: [tags.strong], fontWeight: '700' },
  { tag: [tags.emphasis], fontStyle: 'italic' },
  { tag: [tags.strikethrough], textDecoration: 'line-through' },
  { tag: [tags.invalid], color: 'var(--selaras-resolved-color-danger-text)', textDecoration: 'underline wavy' },
])

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--selaras-resolved-surface-default)',
    color: 'var(--selaras-resolved-text-default)',
    fontSize: '0.875rem',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.65',
    overflow: 'auto',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '0.75rem 0',
    caretColor: 'var(--selaras-resolved-color-primary-indicator)',
  },
  '.cm-line': { padding: '0 1.25rem 0 0.5rem' },
  '.cm-gutters': {
    backgroundColor: 'var(--selaras-resolved-surface-default)',
    color: 'var(--selaras-resolved-text-muted)',
    border: 'none',
    borderRight: '1px solid var(--selaras-resolved-border-muted)',
    paddingLeft: '0.25rem',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '2.5rem',
    padding: '0 0.5rem 0 0.75rem',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--selaras-resolved-color-primary-fill) 8%, transparent)',
    color: 'var(--selaras-resolved-text-default)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--selaras-resolved-text-default) 4%, transparent)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--selaras-resolved-color-primary-fill) 24%, transparent)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--selaras-resolved-color-primary-indicator)',
    borderLeftWidth: '2px',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'color-mix(in srgb, var(--selaras-resolved-color-primary-fill) 14%, transparent)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, var(--selaras-resolved-color-warning-fill) 35%, transparent)',
    outline: '1px solid var(--selaras-resolved-color-warning-border)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--selaras-resolved-color-warning-fill) 55%, transparent)',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--selaras-resolved-color-primary-fill) 18%, transparent)',
    outline: '1px solid var(--selaras-resolved-color-primary-border)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--selaras-resolved-surface-elevated)',
    color: 'var(--selaras-resolved-text-default)',
  },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--selaras-resolved-border-default)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--selaras-resolved-border-default)' },
  '.cm-textfield': {
    backgroundColor: 'var(--selaras-resolved-surface-default)',
    border: '1px solid var(--selaras-resolved-border-default)',
    borderRadius: 'var(--selaras-resolved-radius-sm)',
    color: 'var(--selaras-resolved-text-default)',
    padding: '0.25rem 0.5rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
  },
  '.cm-textfield:focus': {
    outline: 'none',
    borderColor: 'var(--selaras-resolved-color-primary-border)',
    boxShadow: '0 0 0 1px var(--selaras-resolved-color-primary-border)',
  },
  '.cm-panel.cm-search label': {
    fontSize: '0.75rem',
    color: 'var(--selaras-resolved-text-muted)',
  },
  '.cm-panel.cm-search input[type=checkbox]': {
    accentColor: 'var(--selaras-resolved-color-primary-fill)',
  },
  '.cm-panel.cm-search [name=close]': {
    cursor: 'pointer',
    color: 'var(--selaras-resolved-text-muted)',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--selaras-resolved-surface-default)',
    border: '1px solid var(--selaras-resolved-border-default)',
    borderRadius: 'var(--selaras-resolved-radius-sm)',
    color: 'var(--selaras-resolved-text-default)',
    fontFamily: 'inherit',
    fontSize: '0.8125rem',
    padding: '0.25rem 0.5rem',
  },
  '.cm-button:active': {
    backgroundImage: 'none',
    backgroundColor: 'var(--selaras-resolved-surface-elevated)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--selaras-resolved-surface-default)',
    border: '1px solid var(--selaras-resolved-border-default)',
    borderRadius: 'var(--selaras-resolved-radius-md)',
    boxShadow: '0 10px 30px -12px color-mix(in srgb, var(--selaras-resolved-text-default) 35%, transparent)',
    color: 'var(--selaras-resolved-text-default)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    maxHeight: '18rem',
  },
  '.cm-tooltip-autocomplete > ul > li': { padding: '0.25rem 0.5rem' },
  // CodeMirror's default completion glyphs are noisy squiggles/squares; the
  // label and detail already carry the meaning in this compact list.
  '.cm-completionIcon': { display: 'none' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--selaras-resolved-color-primary-subtle)',
    color: 'var(--selaras-resolved-color-primary-on-subtle)',
  },
  '.cm-completionDetail': {
    color: 'var(--selaras-resolved-text-muted)',
    fontStyle: 'normal',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--selaras-resolved-color-danger-indicator)',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--selaras-resolved-color-warning-indicator)',
  },
  '.cm-lintPoint-error': {
    '&::after': { borderBottomColor: 'var(--selaras-resolved-color-danger-indicator)' },
  },
  '.cm-lintPoint-warning': {
    '&::after': { borderBottomColor: 'var(--selaras-resolved-color-warning-indicator)' },
  },
  '.cm-lintPoint-info': {
    '&::after': { borderBottomColor: 'var(--selaras-resolved-color-info-indicator)' },
  },
  '.cm-diagnostic': {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
  },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--selaras-resolved-color-danger-indicator)' },
  '.cm-diagnostic-warning': { borderLeft: '3px solid var(--selaras-resolved-color-warning-indicator)' },
})

const statusFor = (state: EditorState): EditorStatus => {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  return {
    line: line.number,
    column: head - line.from + 1,
    lines: state.doc.lines,
    chars: state.doc.length,
    selected: state.selection.ranges.reduce((total, range) => total + (range.to - range.from), 0),
  }
}

onMounted(() => {
  if (!host.value) return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      EditorState.tabSize.of(2),
      languageCompartment.of(languageExtension(props.language)),
      EditorView.contentAttributes.of({
        ...(props.id ? { id: props.id } : {}),
        'aria-label': props.ariaLabel,
        'aria-multiline': 'true',
        spellcheck: 'false',
        autocapitalize: 'off',
        autocomplete: 'off',
      }),
      editorTheme,
      syntaxHighlighting(highlightStyle),
      Prec.highest(keymap.of([
        { key: 'Mod-s', preventDefault: true, run: () => { emit('save'); return true } },
        indentWithTab,
      ])),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
          emit('status', statusFor(update.state))
        } else if (update.selectionSet) {
          emit('status', statusFor(update.state))
        }
      }),
    ],
  })

  view = new EditorView({ state, parent: host.value })
  emit('status', statusFor(view.state))
  emit('ready')

  if (props.autofocus) requestAnimationFrame(() => view?.focus())
})

// External resets (for example the 409 conflict reload) update the document
// without dragging the cursor through a full replacement on every keystroke.
watch(() => props.modelValue, (value) => {
  if (!view || value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})

watch(() => props.language, (language) => {
  view?.dispatch({ effects: languageCompartment.reconfigure(languageExtension(language)) })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>
