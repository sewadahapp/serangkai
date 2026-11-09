/**
 * Preview height bridge for the authenticated HTML preview.
 *
 * The owner preview is framed with `sandbox allow-scripts` and no same-origin
 * access, so the parent cannot measure the document directly. This bootstrap
 * reports the document's content height to the framing app, which then sizes
 * the iframe to match. Document-style artifacts scroll with the page instead of
 * trapping their overflow inside the frame.
 *
 * Only `/api/artifacts/:id/preview` injects this. The public share reader keeps
 * its full-viewport frame, and PDFs keep the browser's own viewer.
 */
export const MAX_PREVIEW_HEIGHT = 50_000

const BOOTSTRAP = `(function () {
  // A direct visit has no framing app to report to.
  if (window.parent === window) return;

  var doc = document;
  var root = doc.documentElement;
  var last = -1;
  var scheduled = false;
  var forceNext = false;

  function measure() {
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
    if (!forceNext && height === last) return;
    forceNext = false;
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

  if (window.ResizeObserver) {
    var observer = new ResizeObserver(function () { schedule(false); });
    if (root) observer.observe(root);
    if (doc.body) observer.observe(doc.body);
  }
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (data && data.type === 'serangkai:height-request') schedule(true);
  });
  window.addEventListener('load', function () { schedule(false); });
  window.addEventListener('resize', function () { schedule(false); });
  doc.addEventListener('DOMContentLoaded', function () { schedule(false); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { schedule(false); }).catch(function () {});
  setTimeout(function () { schedule(false); }, 0);
  setTimeout(function () { schedule(false); }, 250);
  setTimeout(function () { schedule(false); }, 1000);
})();`

const TAG = `<script data-serangkai-preview-height>${BOOTSTRAP}</script>`

export function withPreviewHeight(content: string): string {
  if (/data-serangkai-preview-height\b/i.test(content)) return content

  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/<head[^>]*>/i, head => `${head}${TAG}`)
  }
  if (/<html[^>]*>/i.test(content)) {
    return content.replace(/<html[^>]*>/i, html => `${html}<head>${TAG}</head>`)
  }
  if (/<body[^>]*>/i.test(content)) {
    return content.replace(/<body[^>]*>/i, body => `${body}${TAG}`)
  }
  return TAG + content
}
