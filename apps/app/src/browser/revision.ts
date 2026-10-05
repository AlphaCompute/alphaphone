/** Opaque browser operation and revision IDs. */
export const revision=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
