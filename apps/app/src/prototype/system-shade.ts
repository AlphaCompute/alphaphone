import { registerPlugin } from '../platform-plugins';

/*
 * Android's shade is the one notification and quick-settings surface (issues #416 and #417,
 * docs/gesture-zones.md). Alpha posts its notices as ordinary Android notifications with
 * owner-bound taps and draws no shade of its own in a product build:
 *
 * - launcher Home (Android): the Home "Notifications" button, or a downward pull that starts on
 *   empty Home, asks Android to expand its shade (AlphaDevice.openNotificationShade, which needs
 *   EXPAND_STATUS_BAR on the launcher flavor). Any other outcome shows a truthful fallback;
 *   Android's own top-edge swipe always remains.
 * - standalone app: an ordinary app. No button and no pull; Android's top-edge swipe only.
 * - browser development build (ELIZA_DEV_ALLOW_TEST_MOCKS=1): a simulated Android shade stands
 *   in for SystemUI, because a browser has none. It is a developer surface and is never shown
 *   by a production bundle or on Android.
 */

// system-shade:begin (dependency-free; exercised by test/system-shade.test.mjs)
/** Who answers "open notifications": Android itself, the development stand-in, or nobody. */
export type ShadeSurface = 'android' | 'simulated' | 'none';
/** Outcome names AlphaDevice.openNotificationShade resolves with (SystemShade.java). */
export type ShadeOutcome = 'opened' | 'standalone' | 'permission-missing' | 'unsupported' | 'not-in-front';

export function shadeSurface(options: { native: boolean; simulated: boolean }): ShadeSurface {
  if (options.native) return 'android';
  return options.simulated ? 'simulated' : 'none';
}

/** The fallback a person sees when Android did not open its shade. It never claims the shade opened. */
export function shadeFallback(outcome: unknown): string {
  if (outcome === 'opened') return '';
  if (outcome === 'not-in-front') return 'Alpha is not in front. Swipe down from the top edge of the screen for Android notifications.';
  if (outcome === 'standalone') return 'Swipe down from the top edge of the screen for Android notifications.';
  return 'Android did not open its notifications from Alpha. Swipe down from the top edge of the screen instead.';
}

/** What was under the finger when a pull started on Home. Collected from the page by pullStart(). */
export type PullStart = {
  /** Inside the Home layer (not the composer, the conversation, an app view or a sheet). */
  home: boolean;
  /** On a text field or another editable element. */
  editable: boolean;
  /** A text field has focus, so the on-screen keyboard may be open and owns the gesture. */
  keyboard: boolean;
  /** Some element under the finger, Home included, is scrolled away from its top: a downward
   * pull scrolls that content back instead. */
  scrolled: boolean;
};

/** Shell state that decides whether Home is empty Home. */
export type PullContext = {
  launcher: boolean; assistant: boolean; screen: string; view: unknown; chat: string;
  voice: string; drawer: boolean; secure: boolean; shade: boolean;
};

/** Height of Android's status bar band in canvas pixels. A pull from there is Android's own. */
export const STATUS_BAND = 44;

/**
 * Whether a finished pull on Home asks for Android's shade. Only on launcher Home with nothing
 * over it, only a clearly downward pull, never one that started in the status bar band (Android
 * already answered it), on editable content, while the keyboard may be up, or on content that
 * can still scroll toward its top.
 */
export function emptyHomeShadePull(context: PullContext, start: PullStart | null | undefined, startY: number, dx: number, dy: number, threshold = 46): boolean {
  if (!context.launcher || context.assistant || context.secure || context.shade) return false;
  if (context.screen !== 'home' || context.view || context.drawer || context.voice !== 'off') return false;
  if (context.chat === 'sheet' || context.chat === 'full') return false;
  if (!(dy > threshold) || !(dy > Math.abs(dx) * 1.5)) return false;
  if (!(startY >= STATUS_BAND)) return false;
  if (!start || !start.home || start.editable || start.keyboard || start.scrolled) return false;
  return true;
}
// system-shade:end

const EDITABLE = 'input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="slider"]';

/** Reads what a pull started on. Pure DOM reads; safe to call from pointerdown. */
export function pullStart(target: EventTarget | null): PullStart | null {
  const element = target instanceof Element ? target : null;
  if (!element) return null;
  const home = element.closest('[data-alpha-layer="home"]');
  const active = document.activeElement;
  let scrolled = false;
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.scrollTop > 0) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) { scrolled = true; break; }
    }
    if (node === home) break;
  }
  return {
    home: !!home,
    editable: !!element.closest(EDITABLE),
    keyboard: !!(active && active !== document.body && active.matches?.(EDITABLE)),
    scrolled,
  };
}

/**
 * A Home whose content fits gives vertical drags to the page, so a downward pull reaches Alpha as
 * pointer events instead of being taken by the WebView for scrolling or overscroll. A Home that
 * overflows (large text) scrolls normally; its Notifications button stays the way to the shade.
 */
export function markHomeFits(): void {
  const home = document.querySelector<HTMLElement>('[data-alpha-layer="home"]');
  if (!home) return;
  const fits = home.scrollHeight <= home.clientHeight + 1 ? 'true' : 'false';
  if (home.dataset.alphaHomeFits !== fits) home.dataset.alphaHomeFits = fits;
}

const device = registerPlugin<{ openNotificationShade(): Promise<{ status?: string }> }>('AlphaDevice');

/** Android side of the system shade: ask Android, and say so truthfully when it does not open. */
export function installSystemShade(Component: any, options: { native: boolean }): void {
  const p = Component.prototype, mount = p.componentDidMount, update = p.componentDidUpdate, unmount = p.componentWillUnmount;
  // Home's height changes without a render too (text size, fonts loading, the dock): watch both
  // Home and its content, and follow Home when the shell replaces the element.
  const watch = (self: any) => {
    const home = document.querySelector('[data-alpha-layer="home"]'), layout = home?.querySelector('[data-alpha-home-layout]');
    if (home !== self.alphaHomeWatched || layout !== self.alphaHomeLayoutWatched) {
      self.alphaHomeObserver?.disconnect();
      self.alphaHomeWatched = home; self.alphaHomeLayoutWatched = layout;
      // An observer reports each element once when observed, and again whenever its size changes,
      // so renders do not force a layout read here.
      if (home && typeof ResizeObserver !== 'undefined') {
        self.alphaHomeObserver = new ResizeObserver(() => markHomeFits());
        self.alphaHomeObserver.observe(home);
        if (layout) self.alphaHomeObserver.observe(layout);
      } else markHomeFits();
    }
  };
  p.componentDidMount = function () {
    mount?.call(this);
    this.alphaHomeFits = () => markHomeFits();
    window.addEventListener('resize', this.alphaHomeFits);
    watch(this);
  };
  p.componentDidUpdate = function (...args: unknown[]) { update?.apply(this, args); watch(this); };
  p.componentWillUnmount = function () { window.removeEventListener('resize', this.alphaHomeFits); this.alphaHomeObserver?.disconnect(); unmount?.call(this); };
  if (!options.native) return;
  p.expandAndroidShade = async function () {
    if (this.alphaShadeAsking) return;
    this.alphaShadeAsking = true;
    let outcome: unknown = 'unsupported';
    try { outcome = (await device.openNotificationShade())?.status; }
    catch { outcome = 'unsupported'; }
    finally { this.alphaShadeAsking = false; }
    const message = shadeFallback(outcome);
    if (message) this.toast(message);
  };
}
