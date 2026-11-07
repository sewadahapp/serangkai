export interface TocLink {
  id: string
  text: string
  depth: number
  children?: TocLink[]
}

const entityMap: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

function decodeEntities(value: string) {
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => entityMap[entity] || entity)
}

/**
 * Converts the MDC parser's flat TOC into the nested shape `SContentToc`
 * expects: deeper headings become children of the preceding shallower one.
 */
export function buildTocTree(links: TocLink[]): TocLink[] {
  const tree: TocLink[] = []
  let current: TocLink | undefined

  for (const link of links) {
    if (link.depth < 2) continue
    const node = { ...link, text: decodeEntities(link.text) }
    if (node.depth <= 2 || !current) {
      tree.push(node)
      current = node
    } else {
      (current.children ||= []).push(node)
    }
  }

  return tree
}

/**
 * Builds a nested TOC from rendered HTML.
 *
 * Kept for HTML that was already rendered (and for the existing tests). New
 * Markdown rendering uses `buildTocTree` straight from the MDC parser.
 */
export function extractToc(html: string, options: { minDepth?: number; maxDepth?: number } = {}): TocLink[] {
  const minDepth = options.minDepth ?? 2
  const maxDepth = options.maxDepth ?? 3
  const flat: TocLink[] = []
  const headingPattern = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi

  for (const match of html.matchAll(headingPattern)) {
    const depth = Number(match[1])
    if (depth < minDepth || depth > maxDepth) continue

    const id = /\bid="([^"]+)"/i.exec(match[2])?.[1]
    if (!id) continue

    const text = decodeEntities(match[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    if (!text) continue

    flat.push({ id, text, depth })
  }

  return buildTocTree(flat)
}
