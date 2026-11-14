/**
 * Shared color-mode bridge for HTML rangka delivery.
 *
 * A sandboxed iframe is its own document: the parent page's `color-scheme` does
 * not reach inside it, so a rangka cannot simply inherit the workspace theme.
 * What does work is setting `color-scheme` on the rangka's own root, because
 * that makes `light-dark()` resolve against the parent's choice instead of the
 * OS preference (`color-scheme` is not reset by the iframe boundary).
 *
 * Two delivery paths share this:
 *  - `/api/rangka/:id/preview` is framed by the app, so a small bootstrap
 *    reports the live mode and accepts updates, letting rangka follow the
 *    in-app toggle without a reload.
 *  - `/api/share/:slug` is a public page with no parent to talk to, so the mode
 *    is baked in from the request's `Sec-CH-Prefers-Color-Scheme` hint, falling
 *    back to `prefers-color-scheme`.
 *
 * Rangka may declare `<meta name="color-scheme" content="only light">` (or
 * `only dark`) to opt out and stay single-mode.
 */
export type RangkaColorMode = 'light' | 'dark'

const BOOTSTRAP = `(function(){
  var doc = document;
  var root = doc.documentElement;
  var system = window.matchMedia('(prefers-color-scheme: dark)');
  // A rangka that pins a single scheme is not ours to theme.
  var pinned = doc.querySelector('meta[name="color-scheme"]');
  if (pinned) {
    var content = (pinned.getAttribute('content') || '').toLowerCase();
    if (content.indexOf('only') !== -1 && !(content.indexOf('light') !== -1 && content.indexOf('dark') !== -1)) return;
  }
  var declared = root.getAttribute('data-serangkai-mode');
  var current = declared === 'dark' || declared === 'light'
    ? declared
    : (root.style.colorScheme === 'dark' ? 'dark' : 'light');
  if (!declared) root.style.colorScheme = current;
  var last = null;
  function apply(mode) {
    if (mode !== 'light' && mode !== 'dark') return;
    if (mode === last) return;
    last = mode;
    root.setAttribute('data-serangkai-mode', mode);
    root.style.colorScheme = mode;
    if (!/light-dark\\(/.test(getComputedStyle(root).transition || '')) {
      root.style.transition = getComputedStyle(root).backgroundColor ? 'background-color 160ms ease, color 160ms ease' : '';
    }
    try { window.dispatchEvent(new CustomEvent('serangkai:colormode', { detail: { mode: mode } })); } catch (e) {}
  }
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.type !== 'serangkai:color-mode') return;
    apply(data.mode);
  });
  // Standalone delivery has no parent: follow the OS preference.
  if (window.parent === window) {
    apply(system.matches ? 'dark' : 'light');
    system.addEventListener('change', function (e) { apply(e.matches ? 'dark' : 'light'); });
  } else {
    apply(current);
  }
})();`

function isPinned(content: string) {
  const meta = content.match(/<meta[^>]+name=["']color-scheme["'][^>]*>/i)
  if (!meta) return false
  const value = (meta[0].match(/content=["']([^"']*)["']/i)?.[1] || '').toLowerCase()
  return value.includes('only') && !(value.includes('light') && value.includes('dark'))
}

/**
 * Injects the mode bridge into an HTML rangka. Unpinned rangka always get
 * `color-scheme` set (so `light-dark()` works), plus a script that keeps it in
 * sync with the framing app.
 */
export function withColorMode(content: string, mode?: RangkaColorMode): string {
  if (isPinned(content)) return content

  const scheme = mode ? ` color-scheme:${mode};` : ''
  const declarations = [
    `<style data-serangkai-color-mode>html{${scheme}}</style>`,
    `<script data-serangkai-color-mode>${BOOTSTRAP}</script>`,
  ].join('')

  // Prefer <head> so the scheme applies before first paint.
  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/<head[^>]*>/i, head => `${head}${declarations}`)
  }
  if (/<html[^>]*>/i.test(content)) {
    return content.replace(/<html[^>]*>/i, html => `${html}<head>${declarations}</head>`)
  }
  return declarations + content
}

export function normalizeColorMode(value: unknown): RangkaColorMode | undefined {
  return value === 'dark' || value === 'light' ? value : undefined
}
