/**
 * How the phone canvas is fitted to the window (issue #411, responsive-surface matrix in
 * docs/implementation-plan.md).
 *
 * Layout is decided from measured window geometry, not from the screen's orientation:
 *
 * - The wide (landscape) arrangement is used when the window is wider than it is tall without the
 *   software keyboard. A keyboard only shortens the window while a text field has focus and the
 *   width is unchanged, so that shorter height is not taken as a rotation: typing in a portrait
 *   window never flips the page into the wide arrangement, and a landscape window on a portrait
 *   screen (freeform or split windows) still gets it.
 * - A standalone touch window is drawn at its own density: never magnified (a tablet does not get
 *   a doubled-up phone), and in the wide arrangement never shrunk either, so 44px controls stay
 *   44px when a small phone turns sideways. Surfaces bound their own reading width instead.
 * - From a canvas WIDE_CANVAS px wide, reading surfaces centre a bounded column (`alpha-wide`).
 * - The launcher presentation and the desktop browser preview keep their fitted 412px canvas.
 */
export type CanvasInput = {
  width: number;
  /** The window's layout height; the software keyboard may have shortened it. */
  layoutHeight: number;
  /** The usable visual height (keyboard excluded) and the space taken above the canvas. */
  available: number;
  /** A desktop pointer window: the 412x915 preview. */
  desktop: boolean;
  /** Drawn at the window's own density (Android standalone, or a touch browser). */
  fluid: boolean;
  /** The launcher presentation, fitted by its shorter side. */
  launcher: boolean;
  /** The screen's shorter side; only the launcher presentation still uses it. */
  screenShort: number;
  /** A text field has focus, so a shorter window may be the keyboard. */
  editing: boolean;
};
export type CanvasGeometry = { landscape: boolean; wide: boolean; scale: number; width: string; height: number; left: number; top: number };

const REFERENCE_WIDTH = 412, REFERENCE_HEIGHT = 915;
/** Canvas width from which lists, settings and readers hold a bounded reading column (phone.css). */
export const WIDE_CANVAS = 760;

/**
 * Remembers the window height without the keyboard for the current width.
 *
 * Android keeps the field focused and the keyboard up through a rotation (MainActivity handles
 * orientation changes itself and resizes for the keyboard), so the first measurement after turning
 * a small phone back to portrait can already be shorter than it is wide. When the width changes
 * while a field has focus and the new width is about the previous keyboard-free height, the sides
 * were swapped: the previous width stands in for the new keyboard-free height until the keyboard
 * closes or the field loses focus.
 */
export function keyboardFreeHeight() {
  let base = { width: 0, height: 0 };
  return (width: number, height: number, editing: boolean) => {
    if (width === base.width) {
      if (!editing || height > base.height) base = { width, height };
    } else {
      const swapped = editing && base.width > 0 && Math.abs(width - base.height) <= base.height * 0.2;
      base = { width, height: swapped ? Math.max(height, base.width) : height };
    }
    return base.height;
  };
}

export function canvasGeometry(input: CanvasInput, freeHeight: number, banner = 0): CanvasGeometry {
  const { width, available, desktop, fluid, launcher } = input;
  const landscape = !desktop && width > freeHeight;
  let scale: number;
  if (desktop) scale = Math.min(1, available / REFERENCE_HEIGHT);
  else if (fluid && !launcher) scale = landscape ? 1 : Math.min(1, width / REFERENCE_WIDTH);
  else scale = landscape ? Math.max(0.1, Math.min(width, input.screenShort) / REFERENCE_WIDTH) : width / REFERENCE_WIDTH;
  const canvasWidth = landscape ? `calc(100vw / ${scale})` : `${fluid && !launcher ? width / scale : REFERENCE_WIDTH}px`;
  const wide = !desktop && width / scale >= WIDE_CANVAS;
  return {
    landscape, wide, scale, width: canvasWidth,
    height: desktop ? REFERENCE_HEIGHT : available / scale,
    left: desktop ? (width - REFERENCE_WIDTH * scale) / 2 : 0,
    top: banner + (desktop ? 24 : 0),
  };
}

/** Text entry that raises the software keyboard. */
export function isEditing(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (element instanceof HTMLInputElement) return !element.readOnly && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'].includes(element.type);
  return false;
}

/** Canvas width from which Inbox, Notes and Files show the open item beside their list. */
export const SPLIT_CANVAS = 1000;
/** Narrowest readable Calendar day column at 100% text; the time gutter takes 76px. */
const DAY_COLUMN = 240;
/**
 * Large text (the largest in-app size, 150%, and any larger system font): the list-detail split
 * returns to one pane and Calendar shows the selected day as an agenda list instead of timed blocks
 * (responsive-surface matrix: "keep agenda fallback at large text").
 */
export const LARGE_TEXT = 1.5;

/** Layout choices that change what a surface renders, not only how CSS places it. */
export type SurfaceLayout = { split: boolean; calendarDays: number; agenda: boolean };
export function surfaceLayout(canvasWidth: number, textScale: number, desktop = false): SurfaceLayout {
  if (desktop || !Number.isFinite(canvasWidth)) return { split: false, calendarDays: 1, agenda: false };
  const scale = Number.isFinite(textScale) && textScale > 0 ? textScale : 1;
  if (scale >= LARGE_TEXT) return { split: false, calendarDays: 1, agenda: true };
  // Day columns widen with the text they hold, so enlarged text gets fewer, readable columns.
  const days = Math.floor((canvasWidth - 76) / (DAY_COLUMN * Math.max(1, scale)));
  return { split: canvasWidth >= SPLIT_CANVAS, calendarDays: Math.max(1, Math.min(7, days)), agenda: false };
}
let published: SurfaceLayout = { split: false, calendarDays: 1, agenda: false };
/** The layout surfaces render from; main.tsx publishes it from measured canvas and text size. */
export const currentSurfaceLayout = (): SurfaceLayout => published;
/** Returns true when the layout changed and surfaces must render again. */
export function publishSurfaceLayout(next: SurfaceLayout): boolean {
  if (next.split === published.split && next.calendarDays === published.calendarDays && next.agenda === published.agenda) return false;
  published = next;
  return true;
}
