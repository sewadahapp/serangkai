import { CANVAS_KEYS, CANVAS_MODIFIED_KEYS } from '../../shared/rangka-canvas'

// Runs inside the existing sandbox. The only data it relays is local canvas
// input. Install it after the reader asks for the opted-in canvas dimensions.
export const canvasInput = `function installCanvasInput() {
  var keys = ${JSON.stringify(CANVAS_KEYS)};
  var modifiedKeys = ${JSON.stringify(CANVAS_MODIFIED_KEYS)};
  var spaceHeld = false;
  var suppressClick = false;
  var pinch = null;
  var multiTouch = false;
  var interactive = 'input, textarea, select, button, a[href], summary, [contenteditable], [tabindex]:not(body):not(html)';
  function send(kind, gesture) {
    parent.postMessage({ type: 'serangkai:canvas-input', kind: kind, gesture: gesture }, '*');
  }

  function holdSpace(held) {
    if (spaceHeld === held) return;
    spaceHeld = held;
    send('space', { held: held });
  }

  function canScroll(event, dx, dy) {
    return event.composedPath().some(function (node) {
      if (!(node instanceof Element)) return false;
      if (node.matches('select, input[type="number"]:focus')) return true;
      var css = getComputedStyle(node);
      // Keep each scrollable region's wheel behavior, including at its edges.
      return (dx && /^(auto|scroll|overlay)$/.test(css.overflowX) && node.scrollWidth > node.clientWidth + 1)
        || (dy && /^(auto|scroll|overlay)$/.test(css.overflowY) && node.scrollHeight > node.clientHeight + 1);
    });
  }

  window.addEventListener('wheel', function (event) {
    if (!event.isTrusted || event.defaultPrevented || !event.cancelable) return;
    var zoom = event.ctrlKey || event.metaKey;
    var mode = event.deltaMode;
    var horizontal = !zoom && event.shiftKey && !event.deltaX;
    var dx = horizontal ? event.deltaY : event.deltaX;
    var dy = horizontal ? 0 : event.deltaY;
    if (zoom ? !dy : (!dx && !dy) || canScroll(event, dx, dy)) return;
    event.preventDefault();
    send('wheel', { x: event.clientX, y: event.clientY, dx: dx, dy: dy, mode: mode, zoom: zoom });
  }, { passive: false });

  window.addEventListener('keydown', function (event) {
    if (!event.isTrusted || event.defaultPrevented || event.isComposing || event.altKey
      || (event.target instanceof Element && event.target.closest(interactive))) return;
    var keyboard = doc.head?.querySelector('meta[name="serangkai-canvas-keys" i]');
    if (keyboard?.content.trim().toLowerCase() === 'none') return;
    var modified = event.ctrlKey || event.metaKey;
    if (event.code === 'Space' && !modified && !event.shiftKey) {
      event.preventDefault();
      holdSpace(true);
      return;
    }
    var map = modified ? modifiedKeys : keys;
    var key = event.shiftKey && event.code === 'Digit1' && !modified ? '0' : event.key;
    if (!Object.hasOwn(map, key)) return;
    event.preventDefault();
    if (map[key] !== 'hand' || !event.repeat) send('key', { command: map[key], fast: event.shiftKey });
  });
  window.addEventListener('keyup', function (event) {
    if (event.code === 'Space') holdSpace(false);
  });
  window.addEventListener('blur', function () {
    holdSpace(false);
    pinch = null;
    multiTouch = false;
  });

  // A click immediately after keydown may beat the viewer's hand surface.
  window.addEventListener('pointerdown', function (event) {
    if (!event.isTrusted) return;
    suppressClick = false;
    if (!spaceHeld || event.pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = true;
  }, true);
  window.addEventListener('click', function (event) {
    if (!suppressClick || !event.isTrusted || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);

  function onTouch(event) {
    if (!event.isTrusted || event.defaultPrevented) return;
    var points = event.touches;
    if (points.length < 2 && !multiTouch) return;
    if (event.cancelable) event.preventDefault();
    multiTouch = points.length > 0;
    if (points.length !== 2) {
      if (pinch) send('pinch-end', {});
      pinch = null;
      return;
    }
    var a = points[0], b = points[1];
    var x = (a.screenX + b.screenX) / 2;
    var y = (a.screenY + b.screenY) / 2;
    var distance = Math.max(1, Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY));
    if (!pinch) {
      pinch = { x: x, y: y, distance: distance };
      send('pinch-start', { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    } else {
      send('pinch', { dx: x - pinch.x, dy: y - pinch.y, factor: distance / pinch.distance });
    }
  }
  for (var type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    window.addEventListener(type, onTouch, { passive: false });
  }

  // Safari can deliver trackpad pinch as GestureEvent instead of wheel.
  window.addEventListener('gesturestart', function (event) {
    if (!event.isTrusted || event.defaultPrevented) return;
    event.preventDefault();
    if (!multiTouch) send('pinch-start', { x: event.clientX, y: event.clientY });
  });
  window.addEventListener('gesturechange', function (event) {
    if (!event.isTrusted || event.defaultPrevented) return;
    event.preventDefault();
    if (!multiTouch) send('pinch', { dx: 0, dy: 0, factor: event.scale });
  });
  window.addEventListener('gestureend', function (event) {
    if (event.isTrusted && !multiTouch) send('pinch-end', {});
  });
}`
