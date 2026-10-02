/** Hidden controls must not mask a visible lock or powered-off screen. */
export function browserScreenLocked():boolean {
 return Array.from(document.querySelectorAll('[aria-label="Unlock with fingerprint"], [aria-label="Wake"]')).some(element=>element.getClientRects().length>0);
}
