import { CANVAS_DIMENSIONS, MAX_CANVAS_DIMENSION, MIN_CANVAS_DIMENSION } from '../../shared/rangka-canvas'

/**
 * Preview height bridge for sandboxed HTML delivery.
 *
 * Both the owner preview and the public share reader frame HTML with
 * `sandbox allow-scripts` and no same-origin access, so the parent cannot
 * measure the document directly. This bootstrap reports the document's content
 * height to the framing app, which then sizes the iframe to match. Document
 * rangka scroll with the page instead of trapping their overflow inside the
 * frame.
 *
 * A full-viewport application that intentionally manages its own scrolling can
 * opt out without changing the delivery route:
 *
 *   <meta name="serangkai-presentation" content="app">
 *
 * The reader keeps a bounded frame. Fixed canvases declare their dimensions
 * with serangkai-canvas and report them instead of a document height.
 */
export const MAX_PREVIEW_HEIGHT = 50_000

const bootstrap = (reportHeight: boolean) => `(function () {
  // A direct visit has no framing app to report to.
  if (window.parent === window) return;

  var doc = document;
  var root = doc.documentElement;
  var last = -1;
  var scheduled = false;
  var forceNext = false;

  // Apps that set their own viewport-sized layout are not documents: growing
  // the frame to their reported height would fight their internal scrolling.
  // The meta is checked on every measure so it wins even when declared late.
  function usesBoundedFrame() {
    var meta = doc.querySelector('meta[name="serangkai-presentation"]');
    var value = meta ? String(meta.getAttribute('content') || '').trim().toLowerCase() : '';
    return value === 'app';
  }

  function measure() {
    var force = forceNext;
    forceNext = false;
    var canvas = doc.querySelector('meta[name="serangkai-canvas" i]');
    var size = canvas ? (canvas.getAttribute('content') || '').trim() : '';
    var dimensions = ${CANVAS_DIMENSIONS}.exec(size);
    if (dimensions
      && Number(dimensions[1]) >= ${MIN_CANVAS_DIMENSION} && Number(dimensions[1]) <= ${MAX_CANVAS_DIMENSION}
      && Number(dimensions[2]) >= ${MIN_CANVAS_DIMENSION} && Number(dimensions[2]) <= ${MAX_CANVAS_DIMENSION}) {
      if (force && doc.readyState === 'complete') parent.postMessage({ type: 'serangkai:canvas-size', size: size }, '*');
      return;
    }
    if (!${reportHeight} || usesBoundedFrame()) return;
    var body = doc.body;
    var height = Math.max(
      root ? root.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );
    if (!height) return;
    // Automatic reports are deduped, but an explicit request must always
    // answer: the first report can fire before the framing app has hydrated
    // and attached its listener, so the parent asks again once it is ready.
    if (!force && height === last) return;
    last = height;
    try {
      parent.postMessage({
        type: 'serangkai:height',
        height: Math.min(height, ${MAX_PREVIEW_HEIGHT})
      }, '*');
    } catch (error) {}
  }

  function schedule(force) {
    if (force) forceNext = true;
    if (scheduled) return;
    scheduled = true;
    var run = function () {
      scheduled = false;
      measure();
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  if (${reportHeight} && window.ResizeObserver) {
    var observer = new ResizeObserver(function () { schedule(false); });
    if (root) observer.observe(root);
    if (doc.body) observer.observe(doc.body);
  }
  window.addEventListener('message', function (event) {
    if (event.source !== parent) return;
    var data = event && event.data;
    if (data && data.type === 'serangkai:height-request') schedule(true);
  });
  if (!${reportHeight}) return;
  window.addEventListener('load', function () { schedule(false); });
  window.addEventListener('resize', function () { schedule(false); });
  doc.addEventListener('DOMContentLoaded', function () { schedule(false); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { schedule(false); }).catch(function () {});
  setTimeout(function () { schedule(false); }, 0);
  setTimeout(function () { schedule(false); }, 250);
  setTimeout(function () { schedule(false); }, 1000);
})();`

const previewTag = `<script data-serangkai-preview-height>${bootstrap(true)}</script>`
const canvasTag = `<script data-serangkai-preview-height>${bootstrap(false)}</script>`

function withPreviewBridge(content: string, tag: string): string {
  if (/data-serangkai-preview-height\b/i.test(content)) return content

  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/<head[^>]*>/i, head => `${head}${tag}`)
  }
  if (/<html[^>]*>/i.test(content)) {
    return content.replace(/<html[^>]*>/i, html => `${html}<head>${tag}</head>`)
  }
  if (/<body[^>]*>/i.test(content)) {
    return content.replace(/<body[^>]*>/i, body => `${body}${tag}`)
  }
  return tag + content
}

export function withPreviewHeight(content: string): string {
  return withPreviewBridge(content, previewTag)
}

// Only opted-in bundle pages need a bridge. Their height stays bounded.
export function withBundleCanvas(content: Buffer): string | Buffer {
  const html = content.toString()
  if (!/<meta\b[^>]*\sname\s*=\s*(?:"serangkai-canvas"|'serangkai-canvas'|serangkai-canvas(?=[\s/>]))/i.test(html)) return content
  return withPreviewBridge(html, canvasTag)
}
