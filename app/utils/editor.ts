export type EditorLanguage = 'text' | 'markdown' | 'html' | 'json' | 'javascript'

export interface EditorStatus {
  line: number
  column: number
  lines: number
  chars: number
  selected: number
}

export interface EditorLanguageMeta {
  name: string
  label: string
  icon: string
}

export const editorLanguageMeta: Record<EditorLanguage, EditorLanguageMeta> = {
  text: { name: 'untitled.txt', label: 'Plain text', icon: 'lucide:file-text' },
  markdown: { name: 'untitled.md', label: 'Markdown', icon: 'lucide:file-text' },
  html: { name: 'untitled.html', label: 'HTML', icon: 'lucide:code-xml' },
  json: { name: 'untitled.json', label: 'JSON', icon: 'lucide:braces' },
  javascript: { name: 'untitled.js', label: 'JavaScript', icon: 'lucide:file-code-2' },
}
