import { CANVAS_DIMENSIONS, MAX_CANVAS_DIMENSION, MIN_CANVAS_DIMENSION } from '../../shared/rangka-canvas'
import { canvasInput } from './rangka-canvas-input'

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
  var hasCanvasInput = false;
  var reportedLayout = null;

  ${canvasInput}

  // Apps that set their own viewport-sized layout are not documents: growing
  // the frame to their reported height would fight their internal scrolling.
  // The meta is checked on every measure so it wins even when declared late.
  function usesBoundedFrame() {
    var meta = doc.querySelector('meta[name="serangkai-presentation"]');
    var value = meta ? String(meta.getAttribute('content') || '').trim().toLowerCase() : '';
    return value === 'app';
  }

  function measure(force) {
    var ready = doc.body || doc.readyState !== 'loading';
    var canvas = doc.querySelector('meta[name="serangkai-canvas" i]');
    var size = canvas ? (canvas.getAttribute('content') || '').trim() : '';
    var dimensions = ${CANVAS_DIMENSIONS}.exec(size);
    if (dimensions
      && Number(dimensions[1]) >= ${MIN_CANVAS_DIMENSION} && Number(dimensions[1]) <= ${MAX_CANVAS_DIMENSION}
      && Number(dimensions[2]) >= ${MIN_CANVAS_DIMENSION} && Number(dimensions[2]) <= ${MAX_CANVAS_DIMENSION}) {
      if (ready && (force || reportedLayout !== size)) {
        if (!hasCanvasInput) {
          hasCanvasInput = true;
          installCanvasInput();
        }
        parent.postMessage({ type: 'serangkai:canvas-size', size: size }, '*');
        reportedLayout = size;
      }
      return;
    }
    if (${reportHeight} && !usesBoundedFrame()) {
      var body = doc.body;
      var height = Math.max(
        root ? root.scrollHeight : 0,
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0
      );
      if (height && (force || height !== last)) {
        last = height;
        parent.postMessage({
          type: 'serangkai:height',
          height: Math.min(height, ${MAX_PREVIEW_HEIGHT})
        }, '*');
      }
    }
    if (ready && (force || reportedLayout !== '')) {
      parent.postMessage({ type: 'serangkai:preview-ready' }, '*');
      reportedLayout = '';
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    var run = function () {
      scheduled = false;
      measure(false);
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  if (${reportHeight} && window.ResizeObserver) {
    var observer = new ResizeObserver(schedule);
    if (root) observer.observe(root);
    if (doc.body) observer.observe(doc.body);
  }
  window.addEventListener('message', function (event) {
    if (event.source !== parent) return;
    var data = event && event.data;
    // Respond immediately. Hidden frames may wait before their next animation frame.
    if (data && data.type === 'serangkai:height-request') measure(true);
  });
  // The head declares the presentation. Let the viewer fit it when the body
  // arrives, even if an image, font, or later script holds up the load event.
  var layoutObserver = new MutationObserver(function () {
    if (!doc.body) return;
    layoutObserver.disconnect();
    measure(false);
  });
  if (doc.body) measure(false);
  else if (root) layoutObserver.observe(root, { childList: true });
  doc.addEventListener('DOMContentLoaded', function () {
    layoutObserver.disconnect();
    measure(false);
  });
  if (!${reportHeight}) return;
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(schedule).catch(function () {});
  setTimeout(schedule, 0);
  setTimeout(schedule, 250);
  setTimeout(schedule, 1000);
})();`

const previewTag = `<script data-serangkai-preview-height>${bootstrap(true)}</script>`
const canvasTag = `<script data-serangkai-preview-height>${bootstrap(false)}</script>`
const readyTag = `<script data-serangkai-preview-height>
  (function () {
    if (window.parent === window) return;
    function ready() {
      if (document.body || document.readyState !== 'loading') {
        parent.postMessage({ type: 'serangkai:preview-ready' }, '*');
      }
    }
    document.addEventListener('DOMContentLoaded', ready, { once: true });
    window.addEventListener('message', function (event) {
      if (event.source === parent && event.data?.type === 'serangkai:height-request') ready();
    });
  })();
</script>`

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
  return content.replace(/^(\s*<!doctype[^>]*>)?/i, declaration => declaration + tag)
}

export function withPreviewHeight(content: string): string {
  return withPreviewBridge(content, previewTag)
}

// Bundle documents stay bounded. Only the preview needs a ready signal.
export function withBundleCanvas(content: Buffer, framed = false): string | Buffer {
  const html = content.toString()
  if (/<meta\b[^>]*\sname\s*=\s*(?:"serangkai-canvas"|'serangkai-canvas'|serangkai-canvas(?=[\s/>]))/i.test(html)) {
    return withPreviewBridge(html, canvasTag)
  }
  return framed ? withPreviewBridge(html, readyTag) : content
}
