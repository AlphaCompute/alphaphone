import type { Page } from '@playwright/test';

/**
 * Dependency-free accessibility checks for the renderer, in the spirit of axe rules.
 *
 * Names, roles and focusability come from Chromium's own accessibility tree (the tree
 * Android WebView hands to TalkBack is computed by the same engine), so there is no
 * second, approximate accessible-name implementation here. Geometry, contrast and
 * clipping are measured in the page.
 *
 * These are renderer checks only. They are not a TalkBack, Switch Access, physical
 * large-font or device rotation pass; those stay device acceptance (MVP-48).
 */
export type Violation = { rule: string; target: string; detail?: string };

const NAMED_ROLES = new Set([
  'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'slider',
  'spinbutton', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'listbox', 'dialog', 'alertdialog',
  'image', 'img', 'progressbar', 'meter', 'PopUpButton', 'ColorWell', 'DisclosureTriangle',
]);
const OPERABLE_ROLES = new Set([
  'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'slider',
  'spinbutton', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'PopUpButton', 'DisclosureTriangle',
]);

type AxNode = {
  ignored?: boolean; role?: { value?: string }; name?: { value?: string }; backendDOMNodeId?: number;
  properties?: Array<{ name: string; value: { value?: unknown } }>;
};

/** Every exposed control, dialog and image has a name, and every exposed control takes focus. */
export async function auditTree(page: Page): Promise<Violation[]> {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Accessibility.enable');
    const { nodes } = await session.send('Accessibility.getFullAXTree') as { nodes: AxNode[] };
    const out: Violation[] = [];
    const describe = async (node: AxNode) => {
      if (!node.backendDOMNodeId) return `<${node.role?.value}>`;
      try {
        const { object } = await session.send('DOM.resolveNode', { backendNodeId: node.backendDOMNodeId }) as { object: { objectId: string } };
        const { result } = await session.send('Runtime.callFunctionOn', {
          objectId: object.objectId, returnByValue: true,
          functionDeclaration: `function(){const el=this.nodeType===1?this:this.parentElement;if(!el)return '';const layer=el.closest('[data-alpha-subview],[data-alpha-layer],[data-screen],dialog,[role=dialog]');const where=layer?(layer.getAttribute('data-alpha-subview')||layer.getAttribute('data-alpha-layer')||layer.getAttribute('data-screen')||layer.getAttribute('aria-label')||layer.tagName.toLowerCase()):'';return (where?'['+where+'] ':'')+el.outerHTML.replace(/\\s+/g,' ').replace(/ style="[^"]*"/g,'').slice(0,180);}`,
        }) as { result: { value: string } };
        return result.value;
      } catch { return `<${node.role?.value}>`; }
    };
    for (const node of nodes) {
      if (node.ignored) continue;
      const role = node.role?.value || '';
      const properties = Object.fromEntries((node.properties || []).map(item => [item.name, item.value.value]));
      const name = String(node.name?.value || '').trim();
      if (NAMED_ROLES.has(role) && !name) out.push({ rule: 'accessible-name', target: await describe(node), detail: role });
      if (OPERABLE_ROLES.has(role) && !properties.disabled && properties.focusable !== true)
        out.push({ rule: 'keyboard-focusable', target: await describe(node), detail: role });
    }
    return out;
  } finally { await session.detach().catch(() => {}); }
}

export type PageAuditOptions = {
  /** Check text contrast against the composited background (WCAG 1.4.3). */
  contrast?: boolean;
  /** Check that text and controls are not clipped or pushed off the phone (WCAG 1.4.4, 1.4.10). */
  clipping?: boolean;
  /** Smallest pointer target in CSS pixels (WCAG 2.5.8 requires 24). */
  targetSize?: number;
};

/** Structure, keyboard operability, contrast and clipping measured in the page. */
export async function auditPage(page: Page, options: PageAuditOptions = {}): Promise<Violation[]> {
  return page.evaluate(({ contrast, clipping, targetSize }) => {
    const out: Array<{ rule: string; target: string; detail?: string }> = [];
    const describe = (el: Element) => {
      const layer = el.closest('[data-alpha-subview],[data-alpha-layer],[data-screen],dialog,[role=dialog]');
      const where = layer ? (layer.getAttribute('data-alpha-subview') || layer.getAttribute('data-alpha-layer') || layer.getAttribute('data-screen') || layer.getAttribute('aria-label') || layer.tagName.toLowerCase()) : '';
      return (where ? `[${where}] ` : '') + el.outerHTML.replace(/\s+/g, ' ').replace(/ style="[^"]*"/g, '').slice(0, 180);
    };
    const shown = (el: Element) => {
      if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
      if (!el.getClientRects().length) return false;
      const style = getComputedStyle(el);
      return style.visibility === 'visible' && style.display !== 'none';
    };
    const exposed = (el: Element) => shown(el) && !el.closest('[inert]');
    const INTERACTIVE = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=switch],[role=tab],[role=menuitem],[role=radio],[role=slider],[role=option],[role=textbox],[role=searchbox],[role=combobox]';
    const TABBABLE = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[tabindex],[contenteditable=""],[contenteditable=true]';
    const tabbable = (el: Element) => el.matches(TABBABLE) && !el.matches(':disabled,[tabindex="-1"]') && exposed(el);
    // A top-layer <dialog> or an open inline dialog owns the screen; only it is judged for geometry.
    const top = Array.from(document.querySelectorAll('dialog[open]')).at(-1) || null;
    const within = (el: Element) => !top || top.contains(el);
    // The map is a pannable surface: labels and pins outside the frame are reached by panning,
    // and every place is also listed in the results sheet.
    const PANNABLE = '[data-alpha-map-canvas],[data-alpha-map-plane]';
    const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };

    // 1. Focus must never be able to enter content that assistive technology cannot see.
    for (const el of document.querySelectorAll('[aria-hidden="true"]'))
      for (const control of el.querySelectorAll(TABBABLE)) if (tabbable(control)) out.push({ rule: 'aria-hidden-focus', target: describe(control) });

    // 2. A click handler on an element that is not a control cannot be reached by keyboard,
    //    switch or TalkBack. Pointer-only scrims with no content of their own are allowed
    //    (their dialog must close another way; the keyboard sweep checks that).
    const handler = (el: Element) => {
      for (const key of Object.keys(el)) if (key.startsWith('__reactProps$')) return typeof (el as any)[key]?.onClick === 'function';
      return false;
    };
    for (const el of document.querySelectorAll('*')) {
      if (!handler(el) || !exposed(el) || el.closest('[aria-hidden="true"]')) continue;
      if (el.matches(INTERACTIVE) || el.closest(INTERACTIVE) || el.matches('label,dialog,form,[role=dialog],[role=alertdialog]')) continue;
      if (el.querySelector(INTERACTIVE)) continue;
      const own = (el.textContent || '').trim() || el.getAttribute('aria-label') || el.querySelector('img,svg');
      if (!own) continue;
      out.push({ rule: 'click-without-control', target: describe(el) });
    }

    // 3. References must resolve, and ids used by them must be unique.
    for (const el of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')) {
      if (!exposed(el)) continue;
      for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
        for (const id of (el.getAttribute(attribute) || '').split(/\s+/).filter(Boolean)) {
          const matches = document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length;
          if (matches !== 1 && !(attribute === 'aria-controls' && matches === 0)) out.push({ rule: 'aria-reference', target: describe(el), detail: `${attribute}=${id} resolves to ${matches}` });
        }
      }
    }

    // 4. Pointer targets.
    if (targetSize) for (const el of document.querySelectorAll(INTERACTIVE)) {
      if (!exposed(el) || !within(el) || el.closest('[aria-hidden="true"]') || el.matches(':disabled')) continue;
      // An inline link inside a sentence is exempt (WCAG 2.5.8 inline exception).
      if (el.matches('a[href]') && getComputedStyle(el).display.startsWith('inline')) continue;
      // A native checkbox, radio or range inside a label takes the label as its target.
      const subject = el.matches('input') && el.closest('label') ? el.closest('label')! : el;
      const rect = subject.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.width < targetSize - .5 || rect.height < targetSize - .5) out.push({ rule: 'target-size', target: describe(el), detail: `${Math.round(rect.width)}x${Math.round(rect.height)}` });
    }

    // 5. Contrast of rendered text against whatever is painted behind it.
    if (contrast) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      const cache = new Map<string, number[]>();
      const rgba = (value: string) => {
        let parsed = cache.get(value);
        if (!parsed) {
          context.clearRect(0, 0, 1, 1); context.fillStyle = '#000'; context.fillStyle = value; context.fillRect(0, 0, 1, 1);
          const data = context.getImageData(0, 0, 1, 1).data; parsed = [data[0], data[1], data[2], data[3] / 255]; cache.set(value, parsed);
        }
        return parsed;
      };
      const opacity = (el: Element | null) => { let value = 1; for (let node = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity); return value; };
      const over = (top: number[], under: number[]) => { const a = top[3] + under[3] * (1 - top[3]); return a ? [0, 1, 2].map(i => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0]; };
      const luminance = (color: number[]) => { const [r, g, b] = color.map(v => { const c = v / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const seen = new Set<Element>();
      // Text that is fading or sliding in is judged once it has arrived, not mid-transition.
      const moving = document.getAnimations().filter(item => item.playState === 'running').map(item => (item.effect as KeyframeEffect | null)?.target).filter((target): target is Element => !!target);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement; const text = (node.nodeValue || '').trim();
        if (!el || !text || seen.has(el) || !shown(el) || !within(el)) continue;
        if (el.closest('script,style,noscript,[aria-disabled="true"],:disabled,option') || moving.some(target => target.contains(el))) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        const rect = Array.from(range.getClientRects()).find(item => item.width > 1 && item.height > 1);
        if (!rect) continue;
        const x = rect.left + Math.min(rect.width / 2, 6), y = rect.top + rect.height / 2;
        if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) continue;
        const stack = document.elementsFromPoint(x, y);
        // Covered text is not what the user sees.
        if (!stack.length || !(stack[0] === el || el.contains(stack[0]) || stack[0].contains(el))) continue;
        const start = stack.indexOf(el); if (start < 0) continue;
        seen.add(el);
        const style = getComputedStyle(el);
        let background = [0, 0, 0, 0], unknown = false;
        for (const layer of stack.slice(start)) {
          const layerStyle = getComputedStyle(layer);
          if (layer.matches('img,video,canvas,picture,iframe') || (layer !== el && layer.matches('svg')) || layerStyle.backgroundImage !== 'none' || layerStyle.backdropFilter !== 'none' && layerStyle.backdropFilter) { unknown = true; break; }
          const color = rgba(layerStyle.backgroundColor); color[3] *= opacity(layer);
          background = over(background, color);
          if (background[3] >= .999) break;
        }
        // Text over imagery, gradients and blur is checked by the dedicated overlay specs.
        if (unknown) continue;
        background = over(background, [255, 255, 255, 1]);
        const ink = rgba(style.color).slice(); ink[3] *= opacity(el);
        const foreground = over(ink, background);
        const l1 = luminance(foreground), l2 = luminance(background);
        const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
        const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
        const needed = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        if (ratio + .005 < needed) out.push({ rule: 'contrast', target: describe(el), detail: `${ratio.toFixed(2)}:1 < ${needed}:1 "${text.slice(0, 40)}" ${Math.round(size)}px` });
      }
    }

    // 6. Clipping: nothing readable may be cut off, and nothing may leave the phone sideways.
    if (clipping) {
      const scrolls = (el: Element, axis: 'x' | 'y') => { const value = getComputedStyle(el)[axis === 'x' ? 'overflowX' : 'overflowY']; return value === 'auto' || value === 'scroll'; };
      const scroller = (el: Element, axis: 'x' | 'y') => { for (let node = el.parentElement; node; node = node.parentElement) if (scrolls(node, axis) && (axis === 'x' ? node.scrollWidth > node.clientWidth : node.scrollHeight > node.clientHeight)) return node; return null; };
      const root = top || document.querySelector('.alpha-recovery') || document.querySelector('.os') || document.body;
      const bounds = root.getBoundingClientRect();
      const left = Math.max(0, bounds.left), right = Math.min(viewport.width, bounds.right);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const judged = new Set<Element>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement; const text = (node.nodeValue || '').trim();
        if (!el || !text || judged.has(el) || !exposed(el) || el.closest('[aria-hidden="true"],script,style,option') || el.closest(PANNABLE)) continue;
        judged.add(el);
        const style = getComputedStyle(el);
        const range = document.createRange(); range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects()).filter(item => item.width > 1 && item.height > 1);
        if (!rects.length) continue;
        // Text must stay inside every clipping ancestor, unless that ancestor scrolls to it.
        let freeX = false, freeY = false, hidden = false;
        for (let box: Element | null = el; box && box !== root.parentElement && !(freeX && freeY); box = box.parentElement) {
          const boxStyle = getComputedStyle(box);
          // Past a scroller, the user can bring the text into view on that axis.
          if (scrolls(box, 'x')) freeX = true;
          if (scrolls(box, 'y')) freeY = true;
          const clipX = !freeX && boxStyle.overflowX !== 'visible', clipY = !freeY && boxStyle.overflowY !== 'visible';
          if (!clipX && !clipY) continue;
          const frame = box.getBoundingClientRect();
          // Text wholly outside a clipping box is hidden, not cut; only a partial cut is illegible.
          if (rects.every(item => item.left >= frame.right - 1 || item.right <= frame.left + 1 || item.top >= frame.bottom - 1 || item.bottom <= frame.top + 1)) { hidden = true; break; }
          const cutX = clipX && rects.some(item => item.right > frame.right + 1.5 || item.left < frame.left - 1.5);
          const cutY = clipY && rects.some(item => item.bottom > frame.bottom + 2.5 || item.top < frame.top - 2.5);
          if (cutX || cutY) {
            // Deliberate single-line truncation keeps the full text available to assistive
            // technology; it is reported separately so it can be judged per surface.
            const ellipsis = cutX && !cutY && (style.textOverflow === 'ellipsis' || boxStyle.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none' && !!style.webkitLineClamp);
            const clamp = cutY && (boxStyle.webkitLineClamp !== 'none' && !!boxStyle.webkitLineClamp);
            out.push({ rule: ellipsis || clamp ? 'text-truncated' : 'text-clipped', target: describe(el), detail: `"${text.slice(0, 40)}" cut ${cutX ? 'horizontally' : 'vertically'} by ${box === el ? 'itself' : describe(box).slice(0, 80)}` });
            hidden = true; // already reported; the part beyond the box is not painted
            break;
          }
        }
        // Wrapped lines must not print over each other: a line box shorter than the text it holds
        // (a pixel line height under scaled text) overlaps the line above.
        const lineHeight = parseFloat(style.lineHeight), fontSize = parseFloat(style.fontSize);
        if (!hidden && lineHeight && lineHeight < fontSize * .95 && new Set(rects.map(item => Math.round(item.top))).size > 1)
          out.push({ rule: 'text-lines-overlap', target: describe(el), detail: `"${text.slice(0, 40)}" ${Math.round(fontSize)}px text on ${Math.round(lineHeight)}px lines` });
        // Text must not run off the side of the phone where no scroller can bring it back.
        if (!hidden && !scroller(el, 'x') && rects.some(item => item.right > right + 1.5 || item.left < left - 1.5))
          out.push({ rule: 'text-off-screen', target: describe(el), detail: `"${text.slice(0, 40)}"` });
      }
      for (const el of root.querySelectorAll(INTERACTIVE)) {
        if (!exposed(el) || el.closest('[aria-hidden="true"]') || el.closest(PANNABLE)) continue;
        const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
        if (!scroller(el, 'x') && (rect.right > right + 1.5 || rect.left < left - 1.5)) out.push({ rule: 'control-off-screen', target: describe(el), detail: `${Math.round(rect.left)}..${Math.round(rect.right)} outside ${Math.round(left)}..${Math.round(right)}` });
        // A label wider or taller than its own control spills onto its neighbours.
        if (getComputedStyle(el).overflow === 'visible' && !el.matches('input,textarea,select')) {
          const labels = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let node = labels.nextNode(); node; node = labels.nextNode()) {
            if (!(node.nodeValue || '').trim() || !node.parentElement || !shown(node.parentElement) || getComputedStyle(node.parentElement).position === 'absolute') continue;
            // Text clipped or truncated inside the control is judged by the clipping rules above.
            let inner = false; for (let box: Element | null = node.parentElement; box && box !== el; box = box.parentElement) if (getComputedStyle(box).overflow !== 'visible') { inner = true; break; }
            if (inner) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            if (Array.from(range.getClientRects()).some(item => item.width > 1 && (item.right > rect.right + 2.5 || item.left < rect.left - 2.5 || item.bottom > rect.bottom + 3.5 || item.top < rect.top - 3.5))) {
              out.push({ rule: 'label-overflows-control', target: describe(el), detail: `"${(node.nodeValue || '').trim().slice(0, 40)}"` }); break;
            }
          }
        }
        // A control below or above the fold with no vertical scroller cannot be reached at all.
        if (!scroller(el, 'y') && (rect.top > viewport.height - 1 || rect.bottom < 1) && getComputedStyle(el).position !== 'fixed') out.push({ rule: 'control-unreachable', target: describe(el), detail: `top ${Math.round(rect.top)} in ${viewport.height}` });
      }
    }
    return out;
  }, { contrast: !!options.contrast, clipping: !!options.clipping, targetSize: options.targetSize || 0 });
}

/**
 * Walk the tab order. Focus must move on every press, must never land in content hidden from
 * assistive technology, and must return to where it began (no trap, no dead end). A modal
 * dialog with a single control keeps focus on it by design; its dismissal is covered by the
 * dialog specs. Outside a modal, the walk must also reach every exposed tab stop: an order
 * that cycles through part of the page leaves the rest unreachable by keyboard. While a menu
 * or sheet is open over a scrim, no stop may sit under the scrim or the panel.
 */
export async function auditTabOrder(page: Page, limit = 120): Promise<Violation[]> {
  const read = () => page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return { key: 'body', hidden: false, visible: true, behind: false, modal: false, stops: 0, segmented: false, text: 'body' };
    const anyEl = el as any; anyEl.__alphaTabId ||= Math.random().toString(36).slice(2);
    const rect = el.getBoundingClientRect();
    const dialog = el.closest('dialog,[role=dialog],[role=alertdialog]');
    const stops = dialog ? Array.from(dialog.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary,[tabindex]'))
      .filter(item => !item.matches(':disabled,[tabindex="-1"]') && !item.closest('[inert]') && item.getClientRects().length > 0).length : 0;
    // A scrim is an empty button laid over (nearly) the whole phone to close a menu or sheet.
    // Focus on a control under it, or under the panel that follows it, is focus the user cannot
    // see on a control a pointer cannot reach: the popup must take the page out of the tab order.
    const phone = (document.querySelector('.os') || document.documentElement).getBoundingClientRect();
    const scrim = Array.from(document.querySelectorAll('button')).find(item => {
      if (item === el || item.contains(el) || (item.textContent || '').trim() || item.closest('[inert]') || !item.getClientRects().length) return false;
      const box = item.getBoundingClientRect();
      return box.width * box.height >= phone.width * phone.height * .8;
    });
    const hit = scrim ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
    const behind = !!scrim && !!hit && hit !== el && !el.contains(hit) && !hit.contains(el) && (hit === scrim || !!(scrim.compareDocumentPosition(hit) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      key: anyEl.__alphaTabId as string, hidden: !!el.closest('[inert],[aria-hidden="true"]'),
      visible: rect.width > 0 && rect.height > 0, behind, modal: !!dialog, stops,
      // Tab steps through the hour, minute and period fields of a native date or time input before leaving it.
      segmented: el.matches('input[type=time],input[type=date],input[type=datetime-local],input[type=month],input[type=week]'), text: el.outerHTML.replace(/\s+/g, ' ').replace(/ style="[^"]*"/g, '').slice(0, 140),
    };
  });
  const out: Violation[] = [];
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    for (const el of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary,[tabindex]')) (el as any).__alphaTabCandidate = true;
  });
  const order: string[] = []; let previous = 'start', stuck = 0, wrapped = false, contained = false, edges = 0, idle = 0;
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press('Tab');
    const current = await read();
    if (current.hidden) out.push({ rule: 'focus-in-hidden-content', target: current.text });
    if (!current.visible && current.key !== 'body') out.push({ rule: 'focus-not-visible', target: current.text });
    if (current.behind) out.push({ rule: 'focus-behind-scrim', target: current.text });
    if (current.key === previous && current.key !== 'body') { if (++stuck >= (current.segmented ? 8 : 2)) { if (!current.modal || current.stops > 1) out.push({ rule: 'focus-trap', target: current.text }); break; } } else stuck = 0;
    previous = current.key;
    if (stuck) continue;
    if (current.key !== 'body' && order.includes(current.key)) { wrapped = true; break; }
    if (current.key !== 'body') { order.push(current.key); contained ||= current.modal; }
    // Leaving the last stop passes through the browser's own controls. The walk starts wherever
    // focus was (a newly opened subview takes it), so it carries on past the edge until a stop
    // repeats: the stops before the starting point are part of the order too.
    else if (order.length ? ++edges > 1 : ++idle > 3) { wrapped = true; break; }
  }
  if (!wrapped && order.length >= limit - 1) out.push({ rule: 'focus-order-unbounded', target: `more than ${limit} tab stops` });
  // A dialog legitimately keeps focus to itself. Anywhere else, a completed cycle must have
  // visited every exposed tab stop. Radio groups share one stop, so radios are not counted.
  // A walk that never leaves the page body is a completed cycle of no stops: if Tab is swallowed,
  // every control on the page is unreachable by keyboard and is reported here.
  // Only controls that were on screen before the walk and are still there count: content that
  // arrives on a timer while the walk is under way is not a stop the walk skipped.
  if (wrapped && !contained) {
    const missed = await page.evaluate(() => Array.from(document.querySelectorAll('button,a[href],input:not([type=hidden]):not([type=radio]),select,textarea,summary,[tabindex]'))
      .filter(el => {
        if ((el as any).__alphaTabId || !(el as any).__alphaTabCandidate || el.matches(':disabled,[tabindex="-1"]') || el.closest('[inert],[aria-hidden="true"]') || !el.getClientRects().length) return false;
        const closed = el.closest('details:not([open])'); if (closed && !(el.matches('summary') && el.parentElement === closed)) return false;
        return getComputedStyle(el).visibility === 'visible';
      }).map(el => el.outerHTML.replace(/\s+/g, ' ').replace(/ style="[^"]*"/g, '').slice(0, 140)));
    for (const target of missed) out.push({ rule: 'focus-order-incomplete', target });
  }
  return out;
}

export function format(violations: Violation[]) {
  const seen = new Set<string>();
  return violations.filter(item => { const key = `${item.rule}|${item.target}|${item.detail || ''}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .map(item => `${item.rule}: ${item.target}${item.detail ? `  (${item.detail})` : ''}`);
}
