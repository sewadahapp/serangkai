/**
 * `serangkai.data` for HTML rangka.
 *
 * The frame is sandboxed with `connect-src 'none'`, so a rangka cannot call the
 * data API itself. This script gives it a small promise API that posts each
 * request to the framing page; the page (SerangkaiHtmlPreview) checks the
 * sender, performs the request with its own credentials, and posts the result
 * back. The sandbox boundary is unchanged: the rangka only ever reaches its own
 * documents, and only in the ways the framing page allows. Shared pages answer
 * reads and refuse writes.
 *
 *   const info = await serangkai.data.info()          // { available, writable }
 *   const cards = await serangkai.data.list('cards')  // [{ id, data, updatedAt }]
 *   await serangkai.data.set('cards', 'c1', { title: 'Write notes', column: 'doing' })
 *   await serangkai.data.update('cards', 'c1', { column: 'done' })
 *   await serangkai.data.get('cards', 'c1')           // document or null
 *   await serangkai.data.remove('cards', 'c1')
 *
 * Outside Serangkai (the file opened directly) every call rejects, so a rangka
 * can fall back to its built-in content.
 *
 * Each load carries a random key: the framing page puts it in the frame URL
 * (`?bridge=…`), delivery embeds it here, and the page answers only messages
 * that carry it. If the frame navigates away (a link in the rangka, say), the
 * new page never learns the key, so it cannot use the owner's data access.
 */
const BRIDGE = `(function(){
  var key = __KEY__;
  var root = window.serangkai = window.serangkai || {};
  if (root.data) return;
  var pending = {};
  var sequence = 0;
  var framed = window.parent !== window;
  function call(op, payload) {
    return new Promise(function (resolve, reject) {
      if (!framed) { reject(new Error('Rangka data is only available inside Serangkai.')); return; }
      var id = ++sequence;
      var timer = setTimeout(function () {
        delete pending[id];
        reject(new Error('Rangka data did not respond.'));
      }, 15000);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      var message = { type: 'serangkai:data', key: key, id: id, op: op };
      for (var field in payload) message[field] = payload[field];
      try { window.parent.postMessage(message, '*'); }
      catch (error) { clearTimeout(timer); delete pending[id]; reject(error); }
    });
  }
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || data.type !== 'serangkai:data-result') return;
    var request = pending[data.id];
    if (!request) return;
    delete pending[data.id];
    clearTimeout(request.timer);
    if (data.ok) { request.resolve(data.result); return; }
    var error = new Error((data.error && data.error.message) || 'Rangka data request failed.');
    error.status = data.error && data.error.status;
    request.reject(error);
  });
  root.data = {
    info: function () { return call('info', {}); },
    list: function (collection) { return call('list', { collection: collection }); },
    get: function (collection, id) { return call('get', { collection: collection, docId: id }); },
    set: function (collection, id, value) { return call('set', { collection: collection, docId: id, data: value }); },
    update: function (collection, id, fields) { return call('update', { collection: collection, docId: id, data: fields }); },
    remove: function (collection, id) { return call('delete', { collection: collection, docId: id }); }
  };
})();`

/**
 * Injects the data bridge as early as possible in the document, so it exists
 * before any of the rangka's own scripts run.
 */
/** Keys the framing page generates: 32 URL-safe characters. Anything else is dropped. */
export const BRIDGE_KEY = /^[A-Za-z0-9_-]{32}$/

/** The bridge key from the frame URL, or '' when there is none or it is malformed. */
export function bridgeKeyFrom(value: unknown): string {
  return typeof value === 'string' && BRIDGE_KEY.test(value) ? value : ''
}

export function withDataBridge(content: string, key = ''): string {
  if (/data-serangkai-data-bridge\b/i.test(content)) return content
  // The key is validated to [A-Za-z0-9_-], so JSON.stringify is a safe literal.
  const tag = `<script data-serangkai-data-bridge>${BRIDGE.replace('__KEY__', JSON.stringify(bridgeKeyFrom(key)))}</script>`
  if (/<head[^>]*>/i.test(content)) return content.replace(/<head[^>]*>/i, head => `${head}${tag}`)
  if (/<html[^>]*>/i.test(content)) return content.replace(/<html[^>]*>/i, html => `${html}<head>${tag}</head>`)
  return tag + content
}
