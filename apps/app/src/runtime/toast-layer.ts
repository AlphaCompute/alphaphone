/**
 * Toasts over a top-layer dialog.
 *
 * The phone's toast region lives in the page. A modal `<dialog>` is drawn in the browser's top
 * layer and makes everything outside itself inert, so a toast raised while one is open ("Saved",
 * a refusal, "Deleted … Undo") was painted underneath the dialog and removed from the
 * accessibility tree: neither seen nor announced.
 *
 * While a modal dialog is open it is given a status region of its own: an element inside the
 * dialog (so it is not inert and belongs to what assistive technology reads), shown as a manual
 * popover (so it is drawn above the dialog, in the top layer, and is never clipped by it). The
 * region is present and empty from the moment the dialog opens, because a live region that
 * arrives together with its text is not announced reliably. A toast is then copied into the
 * region of the topmost modal dialog; its Undo runs the page's own Undo. The page's region is
 * untouched and is inert for as long as the dialog is open, so nothing is announced twice.
 */
const SOURCE = '[data-alpha-toast]';
const HOST = 'data-alpha-dialog-toast';

let installed: (() => void) | null = null;
/** Installed once per document; a second call returns the same uninstaller. */
export function installToastLayer(): () => void {
  if (installed) return installed;
  let frame = 0, undo: HTMLButtonElement | null = null;
  const modals = () => Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).filter(dialog => dialog.matches(':modal'));
  const host = (dialog: HTMLDialogElement) => {
    let region = Array.from(dialog.children).find((child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute(HOST));
    if (region) return region;
    region = document.createElement('div');
    region.setAttribute(HOST, '');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.setAttribute('popover', 'manual');
    // Reset the popover defaults; the region itself takes no pointer events, only the toast in it does.
    region.style.cssText = 'position:fixed;inset:auto;margin:0;padding:0;border:0;background:transparent;color:inherit;overflow:visible;display:flex;justify-content:center;pointer-events:none;box-sizing:border-box;z-index:2147483647';
    dialog.append(region);
    return region;
  };
  const place = (region: HTMLElement) => {
    const screen = document.querySelector<HTMLElement>('[data-screen]');
    const box = screen?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const scale = screen && screen.offsetWidth ? box.width / screen.offsetWidth : 1;
    region.style.left = `${Math.max(0, box.left) + 16 * scale}px`;
    region.style.width = `${Math.max(0, Math.min(window.innerWidth, box.right) - Math.max(0, box.left) - 32 * scale)}px`;
    region.style.bottom = `${Math.max(0, window.innerHeight - box.bottom) + 40 * scale}px`;
    // A popover is display:none until shown; an older engine without popovers draws it as placed.
    try { if (typeof region.showPopover === 'function' && !region.matches(':popover-open')) region.showPopover(); } catch { /* not connected yet, or already open */ }
  };
  const sync = () => {
    frame = 0;
    const open = modals(), topmost = open.at(-1);
    for (const stale of document.querySelectorAll<HTMLElement>(`[${HOST}]`)) if (!open.includes(stale.parentElement as HTMLDialogElement)) stale.remove();
    if (!topmost) { undo = null; return; }
    const regions = open.map(host);
    for (const region of regions) place(region);
    const source = document.querySelector<HTMLElement>(SOURCE), shown = source?.firstElementChild as HTMLElement | null;
    const text = (shown?.querySelector('span')?.textContent ?? '').trim();
    undo = shown?.querySelector('button') ?? null;
    const signature = text ? `${text}\n${undo ? 'undo' : ''}` : '';
    for (const region of regions) {
      const wanted = region === regions.at(-1) ? signature : '';
      if ((region.dataset.alphaToastShown ?? '') === wanted) continue;
      region.dataset.alphaToastShown = wanted;
      region.replaceChildren();
      if (!wanted || !shown) continue;
      const paint = getComputedStyle(shown);
      const body = document.createElement('div');
      body.style.cssText = 'pointer-events:auto;min-height:48px;max-width:100%;box-sizing:border-box;border-radius:24px;font:600 14px/1.35 "Public Sans",system-ui,sans-serif;display:flex;gap:14px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.28)';
      body.style.background = paint.backgroundColor; body.style.color = paint.color;
      body.style.padding = undo ? '0 4px 0 18px' : '0 18px';
      const message = document.createElement('span');
      message.style.cssText = 'flex-grow:1;min-width:0;padding:8px 0;overflow-wrap:anywhere';
      message.textContent = text;
      body.append(message);
      if (undo) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = 'Undo';
        button.style.cssText = 'flex-shrink:0;min-height:40px;padding:0 14px;border:0;border-radius:20px;color:inherit;background:rgba(127,127,127,.28);font:inherit;font-weight:700';
        // The page's own Undo is inert under the dialog, not disabled: run it.
        button.addEventListener('click', () => { undo?.click(); });
        body.append(button);
      }
      region.append(body);
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
  const changes = new MutationObserver(schedule);
  changes.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['open'] });
  window.addEventListener('resize', schedule);
  sync();
  installed = () => {
    installed = null;
    changes.disconnect(); window.removeEventListener('resize', schedule);
    if (frame) cancelAnimationFrame(frame);
    for (const region of document.querySelectorAll(`[${HOST}]`)) region.remove();
  };
  return installed;
}
