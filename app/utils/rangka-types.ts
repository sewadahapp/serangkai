/** Icon and label per rangka type, shared by the workspace and the command palette. */
const rangkaTypeMeta: Record<string, { icon: string; label: string }> = {
  markdown: { icon: 'lucide:file-text', label: 'Markdown' },
  html: { icon: 'lucide:code-xml', label: 'HTML' },
  json: { icon: 'lucide:braces', label: 'JSON' },
  javascript: { icon: 'lucide:file-code-2', label: 'JavaScript' },
  image: { icon: 'lucide:image', label: 'Image' },
  pdf: { icon: 'lucide:file-type-2', label: 'PDF' },
  bundle: { icon: 'lucide:package', label: 'Bundle' },
}

export const rangkaIcon = (type: string) => rangkaTypeMeta[type]?.icon || 'lucide:file'
export const rangkaTypeLabel = (type: string) => rangkaTypeMeta[type]?.label || type
