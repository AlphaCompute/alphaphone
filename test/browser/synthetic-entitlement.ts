import type {Page} from '@playwright/test';

/**
 * Page-side synthetic Eliza Cloud subscription entitlement for flag-off fixtures. The product
 * admits the on-device agent only from a verified ES256 entitlement (there is no unsigned
 * fallback), so fixtures that need an admitted plan answer the two entitlement routes from here.
 * A throwaway P-256 key is generated in the page with WebCrypto; nothing is a real key, plan or
 * account, and no request leaves the page.
 *
 * Usage inside a fixture's native transport (an async handler):
 *   const answer = await (window as any).__syntheticEntitlement.answer(path, userId);
 *   if (answer) return answer;
 * `status` selects the plan status (active by default).
 */
export const syntheticEntitlementScript = `(() => {
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  const text = value => b64(new TextEncoder().encode(JSON.stringify(value)));
  let pair = null;
  const key = () => pair ??= (async () => {
    const generated = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = { ...(await crypto.subtle.exportKey('jwk', generated.publicKey)), kid: 'synthetic-fixture-key' };
    delete jwk.key_ops; delete jwk.ext;
    return { privateKey: generated.privateKey, jwk };
  })();
  async function token(sub, status = 'active', claims = {}) {
    const { privateKey } = await key();
    const now = Math.floor(Date.now() / 1000);
    const input = text({ alg: 'ES256', typ: 'eliza-entitlement+jwt', kid: 'synthetic-fixture-key' }) + '.' + text({
      iss: 'https://api.eliza.app', aud: 'eliza-alpha-phone', sub, jti: 'synthetic-entitlement-' + Math.random().toString(36).slice(2),
      iat: now, exp: now + 3000, plan: { id: 'synthetic-plan', name: 'Synthetic plan', status }, services: ['inference'], ...claims });
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(input)));
    return input + '.' + b64(signature);
  }
  window.__syntheticEntitlement = {
    token,
    async keys() { return [(await key()).jwk]; },
    /** The fixture answer for an entitlement route, or null for any other path. */
    async answer(path, sub, status = 'active') {
      if (path === '/api/v1/subscription/entitlement-keys') return { status: 200, data: { keys: [(await key()).jwk] } };
      if (path === '/api/v1/subscription/entitlement') return { status: 200, data: { entitlement: await token(sub, status) } };
      return null;
    },
  };
})();`;

/** Installs the page-side signer before the page's own scripts. */
export function addSyntheticEntitlement(page: Page) {
  return page.addInitScript({content: syntheticEntitlementScript});
}
