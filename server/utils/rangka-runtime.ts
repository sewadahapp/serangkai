/**
 * Opt-in chart and diagram runtime for sandboxed HTML rangka.
 *
 * HTML rangka cannot reach a CDN: their CSP allows same-origin and inline
 * scripts only, and `connect-src` is disabled. Rather than widening that
 * boundary, Serangkai serves two small same-origin bundles and injects only the
 * one a rangka actually uses. Markers are declarative (JSON and Mermaid
 * source), so the rangka's JavaScript is never evaluated by the runtime.
 */

const RUNTIME_STYLES = `
.serangkai-chart-figure,.serangkai-mermaid{margin:1.5rem 0;padding:1rem;border:1px solid light-dark(#dbe3ee,#2a3446);border-radius:.75rem;background:light-dark(#f8fafc,#0f172a);color:light-dark(#0f172a,#e2e8f0);overflow:auto}
.serangkai-chart-figure{white-space:normal}
.serangkai-chart-figure figcaption{margin:0 0 .75rem;font:600 .875rem/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
.serangkai-chart-figure .ts-chart-host{min-width:0}
.serangkai-mermaid{white-space:normal;font-family:initial}
.serangkai-mermaid svg{display:block;max-width:100%;height:auto;margin:0 auto}
.serangkai-runtime-error{margin:0;padding:.75rem;border-radius:.5rem;background:light-dark(#fef2f2,#450a0a);color:light-dark(#991b1b,#fecaca);font:400 .8125rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}
`

const STARTS = '<style data-serangkai-runtime>' + RUNTIME_STYLES + '</style>'

function injection(wantsCharts: boolean, wantsMermaid: boolean) {
  return [
    STARTS,
    wantsCharts ? '<script data-serangkai-runtime src="/runtime/charts.js" defer></script>' : '',
    wantsMermaid ? '<script data-serangkai-runtime src="/runtime/mermaid.js" defer></script>' : '',
  ].join('')
}

/**
 * Injects the runtime after the color-mode bridge, which guarantees the mode
 * attribute is available when Mermaid initializes. Returns the original content
 * untouched when no marker is present.
 */
export function withRangkaRuntime(content: string): string {
  if (/data-serangkai-runtime\b/i.test(content)) return content

  const wantsMermaid = /data-serangkai-mermaid\b/i.test(content)
    || /class\s*=\s*(?:"[^"]*\bmermaid\b[^"]*"|'[^']*\bmermaid\b[^']*')/i.test(content)
  const wantsCharts = /data-serangkai-chart\b/i.test(content)
  if (!wantsMermaid && !wantsCharts) return content

  const tags = injection(wantsCharts, wantsMermaid)
  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/<head[^>]*>/i, head => `${head}${tags}`)
  }
  if (/<html[^>]*>/i.test(content)) {
    return content.replace(/<html[^>]*>/i, html => `${html}<head>${tags}</head>`)
  }
  if (/<body[^>]*>/i.test(content)) {
    return content.replace(/<body[^>]*>/i, body => `${body}${tags}`)
  }
  return tags + content
}
