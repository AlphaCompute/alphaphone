/**
 * The size text is really drawn at, relative to the pixel sizes the page declares.
 *
 * Android applies large text as WebView text zoom (Alpha's text size multiplied by the system
 * font scale, see AlphaDevicePlugin.effectiveTextZoom). Text zoom enlarges glyphs and line boxes
 * only: declared lengths, em units and media queries stay as authored, so CSS alone cannot tell
 * that a label now needs twice the room. A hidden probe with a declared 100px font and a line
 * height of 1 is measured instead, and the ratio is published as `--alpha-text-scale` on the
 * root element. Layout rules use it where room has to be made: how many columns of labelled
 * tiles fit, and how wide a Home card may grow. The browser build's text size setting rewrites
 * declared sizes (browser/display.ts), which the same probe measures.
 *
 * Above the largest in-app size (150%) the root element also carries `alpha-text-xl`: that is
 * only reached with a large system font, and it is where a screen title no longer fits beside
 * its header's buttons. phone.css gives the title a row of its own there instead of shortening it.
 */
export const TEXT_XL_CLASS = 'alpha-text-xl';
const TEXT_XL_ABOVE = 1.5;
export const TEXT_SCALE_PROPERTY = '--alpha-text-scale';

export function installTextScale(): () => void {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.dataset.alphaTextProbe = '';
  probe.style.cssText = 'position:absolute;left:0;top:0;width:0;overflow:hidden;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;font-size:100px;line-height:1;white-space:nowrap;contain:layout';
  probe.textContent = 'M';
  document.body.append(probe);
  let published = 0;
  const read = () => {
    const height = probe.offsetHeight;
    // Not laid out (hidden document, detached root): keep the last known value.
    if (!height) return;
    const scale = Math.round(height) / 100;
    if (scale === published) return;
    published = scale;
    document.documentElement.style.setProperty(TEXT_SCALE_PROPERTY, String(scale));
    document.documentElement.classList.toggle(TEXT_XL_CLASS, scale > TEXT_XL_ABOVE);
  };
  read();
  const observer = new ResizeObserver(read);
  observer.observe(probe);
  return () => { observer.disconnect(); probe.remove(); document.documentElement.style.removeProperty(TEXT_SCALE_PROPERTY); document.documentElement.classList.remove(TEXT_XL_CLASS); };
}
