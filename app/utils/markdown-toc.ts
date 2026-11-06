export interface TocLink {
  id: string
  text: string
  depth: number
  children?: TocLink[]
}

/**
 * Builds an `SContentToc` tree from rendered Markdown.
 *
 * The server renderer assigns heading ids, so this only reads the HTML it
 * already produced — no second Markdown parse and no client-side DOM scraping
 * that could run before the article exists.
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

    const text = match[3]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue

    flat.push({ id, text, depth })
  }

  // Nest deeper headings under the preceding shallower one; `SContentToc`
  // renders `children` through its own recursive branch.
  const tree: TocLink[] = []
  let current: TocLink | undefined
  for (const link of flat) {
    if (link.depth === minDepth || !current) {
      tree.push(link)
      current = link
    } else {
      (current.children ||= []).push(link)
    }
  }
  return tree
}
