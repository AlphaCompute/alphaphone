/**
 * How much of the bottom of the phone the floating dock takes (the composer bar with whatever is
 * stacked on it, or the pill), measured, in the phone canvas's own pixels.
 *
 * The dock floats over the page. Home used to scroll underneath it with a fixed 108px of padding,
 * which stopped being enough as soon as Home needed to scroll: at 200% text the last row of apps
 * was drawn under the composer, and TalkBack read the composer after controls that sat lower on
 * the screen (round 8 emulator run). A fixed number cannot be right either way: Android moves the
 * dock up by the navigation bar inset, and the composer grows with a longer draft or a status
 * line. So the footprint is measured and published as `--alpha-dock-clearance` on the root
 * element; phone.css ends Home and the app library above it, and gives every app scroller that
 * much scroll padding so a focused control is brought wholly above the dock.
 *
 * Two lengths are published. `--alpha-dock-clearance` is everything the dock covers now, and is
 * where Home's scroll area ends. `--alpha-dock-rest` is the bar alone, without a status line or
 * reply context stacked on it: Home lays its rows out against that, so a line that comes and goes
 * above the bar (the draft status at startup) shortens what is visible of Home instead of moving
 * every row.
 *
 * While no dock is on screen (the shade, a voice session, the lock screen) the last footprint is
 * kept, so Home does not jump when the dock returns.
 */
export const DOCK_CLEARANCE_PROPERTY = '--alpha-dock-clearance';
export const DOCK_REST_PROPERTY = '--alpha-dock-rest';
const DOCK = '[data-alpha-layer="composer"],[data-alpha-layer="pill"] > *';

/** The dock elements on screen now: rendered, and not retired behind the shade or a voice session. */
export function visibleDocks(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(DOCK)).filter(dock => dock.getClientRects().length > 0 && !dock.closest('[inert]'));
}

let installed: (() => void) | null = null;
/** Installed once per document; a second call returns the same uninstaller. */
export function installDockClearance(): () => void {
  if (installed) return installed;
  let published = '', frame = 0, watched: HTMLElement[] = [];
  const sizes = new ResizeObserver(() => schedule());
  const read = () => {
    frame = 0;
    const screen = document.querySelector<HTMLElement>('[data-screen]');
    if (!screen || !screen.offsetWidth) return;
    const docks = visibleDocks(screen);
    if (docks.length !== watched.length || docks.some((dock, index) => dock !== watched[index])) {
      sizes.disconnect(); sizes.observe(screen); for (const dock of docks) sizes.observe(dock);
      watched = docks;
    }
    if (!docks.length) return;
    // The canvas is drawn scaled to the screen (--phone-scale); lengths in CSS are canvas pixels.
    const frameBox = screen.getBoundingClientRect(), scale = frameBox.width / screen.offsetWidth || 1;
    const above = (element: Element) => (frameBox.bottom - element.getBoundingClientRect().top) / scale;
    const clearance = Math.ceil(Math.max(...docks.map(above)));
    // The bar is the composer's last row; the pill is its own bar.
    const rest = Math.ceil(Math.max(...docks.map(dock => above(dock.querySelector('[data-alpha-input-bar]') ?? dock))));
    if (!Number.isFinite(clearance) || clearance <= 0 || !Number.isFinite(rest) || rest <= 0) return;
    const next = `${clearance}/${rest}`;
    if (next === published) return;
    published = next;
    document.documentElement.style.setProperty(DOCK_CLEARANCE_PROPERTY, `${clearance}px`);
    document.documentElement.style.setProperty(DOCK_REST_PROPERTY, `${Math.min(rest, clearance)}px`);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(read); };
  // The dock is rendered by the phone shell: it appears, changes kind and leaves with the view.
  const changes = new MutationObserver(schedule);
  changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['inert'] });
  // Android's bar insets and the phone's scale arrive as custom properties and classes on the root
  // element (main.tsx); they move the dock without resizing it.
  const root = new MutationObserver(schedule);
  root.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  window.addEventListener('resize', schedule);
  // The dock slides in: its resting place is known only once its entry animation has finished.
  document.addEventListener('animationend', schedule, true);
  document.addEventListener('transitionend', schedule, true);
  read();
  installed = () => {
    installed = null;
    changes.disconnect(); root.disconnect(); sizes.disconnect(); window.removeEventListener('resize', schedule);
    document.removeEventListener('animationend', schedule, true); document.removeEventListener('transitionend', schedule, true);
    if (frame) cancelAnimationFrame(frame);
    document.documentElement.style.removeProperty(DOCK_CLEARANCE_PROPERTY);
    document.documentElement.style.removeProperty(DOCK_REST_PROPERTY);
  };
  return installed;
}
