// Alpha browser login-field reporter (issue #404). Injected by BrowserLoginFields.java at
// document start into every frame, in an isolated JavaScript world that page script cannot
// reach. It tells native code which focused field of THIS frame is a username or password field.
// It never reports an origin, URL or frame: native code takes the frame's origin only from the
// browser engine (WebMessageListener sourceOrigin). Fill values arrive only on this frame's own
// channel and are written only into a field this script registered in this document.
(() => {
  'use strict';
  const channel = globalThis.__alphaLoginFields;
  if (!channel || typeof channel.postMessage !== 'function') return;
  if (location.protocol !== 'https:' || !globalThis.isSecureContext) return;

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const documentId = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const keys = new WeakMap();
  const fields = new Map();
  let nextKey = 1;
  let reported = null;

  const tokens = el => String(el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/).filter(Boolean);
  const textual = el => el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'email' || el.type === 'tel');
  const usable = el => el instanceof HTMLInputElement && el.isConnected && !el.disabled && !el.readOnly && el.getClientRects().length > 0;
  const keyOf = el => {
    let key = keys.get(el);
    if (!key) {
      if (nextKey > 100000) return 0;
      key = nextKey++;
      keys.set(el, key);
      fields.set(key, new WeakRef(el));
    }
    return key;
  };
  const field = key => {
    const el = key ? fields.get(key)?.deref() : null;
    return el && usable(el) ? el : null;
  };

  /** Login fields of the form (or root) that owns {@code target}: exactly one password field. */
  function login(target) {
    if (!(target instanceof HTMLInputElement)) return null;
    const scope = target.form ? Array.from(target.form.elements) : Array.from(target.getRootNode().querySelectorAll('input'));
    const inputs = scope.filter(usable);
    const passwords = inputs.filter(el => el.type === 'password');
    if (passwords.length !== 1) return null;
    const password = passwords[0];
    let username = inputs.find(el => textual(el) && tokens(el).some(t => t === 'username' || t === 'email')) || null;
    if (!username) {
      for (let i = inputs.indexOf(password) - 1; i >= 0; i--) if (textual(inputs[i])) { username = inputs[i]; break; }
    }
    if (target !== password && target !== username) return null;
    return { username, password };
  }

  /**
   * Field box in the top-level viewport. Only computed through same-origin ancestors; when an
   * ancestor is another site's frame the field is not reported at all (native refuses it too).
   */
  function box(el) {
    const rect = el.getBoundingClientRect();
    let x = rect.left, y = rect.top, w = window;
    while (w !== w.top) {
      let frame;
      try { frame = w.frameElement; } catch { return null; }
      if (!frame) return null;
      const outer = frame.getBoundingClientRect();
      x += outer.left + frame.clientLeft;
      y += outer.top + frame.clientTop;
      w = w.parent;
    }
    return [x, y, rect.width, rect.height, w.innerWidth];
  }
  const number = n => Math.max(-99999, Math.min(999999, Number.isFinite(n) ? n : 0)).toFixed(3).replace(/\.?0+$/, '') || '0';
  const send = message => { try { channel.postMessage(message); } catch { /* channel gone with the document */ } };

  document.addEventListener('focusin', event => {
    if (!event.isTrusted) return;
    const target = event.composedPath()[0];
    const found = login(target);
    const where = found && box(target);
    if (!found || !where) { if (reported) { reported = null; send(`blur|${documentId}`); } return; }
    const u = found.username ? keyOf(found.username) : 0, p = keyOf(found.password);
    const focused = target === found.password ? p : u;
    if (!p || !focused) { if (reported) { reported = null; send(`blur|${documentId}`); } return; }
    const ua = found.username ? (tokens(found.username).find(t => t === 'username' || t === 'email') || '') : '';
    const pa = tokens(found.password).find(t => t === 'current-password' || t === 'new-password') || '';
    reported = { u, p };
    send(`focus|${documentId}|${focused}|${u}|${p}|${ua}|${pa}|${where.map(number).join(',')}`);
  }, true);

  document.addEventListener('focusout', event => {
    if (!event.isTrusted || !reported) return;
    reported = null;
    send(`blur|${documentId}`);
  }, true);

  // The document is unloading (a frame navigating on its own included): native ends the binding.
  addEventListener('pagehide', () => { reported = null; send(`gone|${documentId}`); }, true);

  // Save: values of fields registered by a focus report, on a real submit of their own form.
  document.addEventListener('submit', event => {
    if (!event.isTrusted) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const inputs = Array.from(form.elements).filter(usable);
    const password = inputs.find(el => el.type === 'password' && keys.has(el) && el.value);
    if (!password) return;
    const found = login(password);
    if (!found) return;
    const u = found.username && keys.has(found.username) ? keys.get(found.username) : 0;
    const username = u ? found.username.value : '';
    if (password.value.length > 1024 || username.length > 1024) return;
    let encoded;
    try { encoded = [encodeURIComponent(username), encodeURIComponent(password.value)]; } catch { return; }
    send(`submit|${documentId}|${u}|${keys.get(password)}|${encoded[0]}|${encoded[1]}`);
  }, true);

  // Fill: only this frame's channel delivers it; the address check is a second guard against a
  // document that replaced this one. Unknown or detached fields are ignored.
  channel.addEventListener('message', event => {
    let data;
    try { data = JSON.parse(String(event.data)); } catch { return; }
    if (!data || data.t !== 'fill' || data.d !== documentId || data.o !== location.origin) return;
    const targets = [[data.u, data.uv], [data.p, data.pv]];
    for (const [key, value] of targets) {
      if (typeof value !== 'string' || !Number.isInteger(key)) continue;
      const el = field(key);
      if (!el) continue;
      valueSetter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    data = null;
  });
})();
