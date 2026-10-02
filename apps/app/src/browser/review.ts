/** A browser equivalent of the native operation review, with cancellation ownership. */
export class BrowserReviews {
  private pending = new Map<string, () => void>();
  cancel(id: string) { this.pending.get(id)?.(); }
  async confirm(id: string, title: string, details: string): Promise<boolean> {
    if (this.pending.has(id) || document.hidden) return false;
    const previous = document.activeElement as HTMLElement | null;
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-label', title);
      dialog.style.cssText = 'max-width:min(440px,85vw);max-height:80vh;overflow:auto;border:0;border-radius:18px;padding:24px;background:var(--bg,#fff);color:var(--fg,#111);font:16px system-ui';
      const heading = document.createElement('h2'); heading.textContent = title;
      const body = document.createElement('p'); body.textContent = details; body.style.whiteSpace = 'pre-wrap';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
      const approve = document.createElement('button'); approve.textContent = 'Confirm';
      approve.style.marginLeft = '16px';
      let settled = false;
      const finish = (confirmed: boolean) => {
        if (settled) return; settled = true;
        this.pending.delete(id); document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('alpha-back', back, true);
        dialog.remove(); previous?.isConnected && previous.focus(); resolve(confirmed);
      };
      const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); finish(false); };
      const visibility = () => { if (document.hidden) finish(false); };
      cancel.onclick = () => finish(false); approve.onclick = () => finish(!document.hidden);
      dialog.oncancel = () => finish(false); dialog.onclose = () => finish(false);
      this.pending.set(id, () => finish(false));
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('alpha-back', back, true);
      dialog.append(heading, body, cancel, approve); document.body.append(dialog); dialog.showModal(); cancel.focus();
    });
  }
}
