// Test APK only: qualify Camera/Photos through the production account UI without
// real Cloud traffic or a resident service. Media and other native plugins stay real.
(() => {
  if (window.__alphaVideoAccount) throw Error('Video account fixture already installed');
  const native = Capacitor.nativePromise;
  const id = '9f1dc45a-4011-4e44-947a-30d999d24fa5';
  const session = '12345678-1234-4234-8234-123456789def';
  let credential = null, binding = null, running = false;
  const calls = [];
  window.__alphaVideoAccount = { calls };
  // Synthetic signed plan: a throwaway ES256 key generated here; the product admits only a
  // verified entitlement. Nothing is a real key, plan or account.
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encode = value => b64(new TextEncoder().encode(JSON.stringify(value)));
  const signing = crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']).then(async pair => {
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    return { privateKey: pair.privateKey, jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, kid: 'synthetic-video-key' } };
  });
  const entitlement = async () => {
    const { privateKey } = await signing, now = Math.floor(Date.now() / 1000);
    const input = encode({ alg: 'ES256', typ: 'eliza-entitlement+jwt', kid: 'synthetic-video-key' }) + '.' + encode({ iss: 'https://api.eliza.app', aud: 'eliza-alpha-phone', sub: id, jti: 'synthetic-video-entitlement', iat: now, exp: now + 3000, plan: { id: 'synthetic-plan', name: 'Synthetic plan', status: 'active' }, services: ['inference'] });
    return input + '.' + b64(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(input))));
  };
  Capacitor.nativePromise = async function(plugin, method, input = {}) {
    if (plugin === 'AlphaConnection') {
      if (input.slot === 'cloud:production') {
        if (method === 'secureRead') return { value: credential };
        if (method === 'secureWrite') { credential = input.value; return {}; }
        if (method === 'secureRemove') { credential = null; return {}; }
      }
      if (method === 'openExternal') {
        if (input.url !== `https://eliza.app/auth/cli-login?session=${session}`) throw Error('Unexpected account browser route');
        calls.push('browser-return'); return {};
      }
      if (method === 'request') {
        const url = new URL(input.url);
        if (url.origin !== 'https://api.eliza.app' || url.search || url.hash) throw Error('Unexpected account authority');
        const path = url.pathname;
        calls.push(path);
        if (path === '/api/auth/cli-session' && input.method === 'POST') return { status: 200, data: { sessionId: session, expiresAt: new Date(Date.now() + 60000).toISOString() } };
        if (path === `/api/auth/cli-session/${session}` && input.method === 'GET') return { status: 200, data: { status: 'authenticated', token: 'synthetic-video-account-only' } };
        // Public verification keys: the one route read without the account key.
        if (path === '/api/v1/subscription/entitlement-keys' && input.method === 'GET') return { status: 200, data: { keys: [(await signing).jwk] } };
        const saved = credential && JSON.parse(credential);
        if (!saved || input.headers?.Authorization !== `Bearer ${saved.token}` || input.method !== 'GET') throw Error('Unbound account request');
        if (path === '/api/v1/user') return { status: 200, data: { success: true, data: { id } } };
        if (path === '/api/v1/subscription/entitlement') return { status: 200, data: { entitlement: await entitlement() } };
        throw Error('Unexpected account request');
      }
    }
    if (plugin === 'Agent') {
      calls.push(method);
      if (method === 'getStatus') return { packaged: true, state: running ? 'running' : 'stopped', serviceActive: running, socketListening: running };
      if (method === 'stop') { running = false; return {}; }
      if (method === 'configureCloudProvider') {
        const saved = credential && JSON.parse(credential);
        if (!saved || input.credentialId !== saved.credentialId || input.model !== 'cerebras/qwen-3.8-27b') throw Error('Unbound resident account');
        binding = input.credentialId; return { configured: true };
      }
      if (method === 'start') {
        if (!binding || binding !== JSON.parse(credential).credentialId) throw Error('Unbound resident startup');
        running = true; return {};
      }
      if (method === 'cancelStart') { running = false; return {}; }
      if (method === 'request' && running) {
        let body;
        if (input.path === '/api/auth/me' && input.method === 'GET') body = { identity: { id, kind: 'owner' }, access: { role: 'OWNER', mode: 'local' } };
        else if (input.path === '/api/agents' && input.method === 'GET') body = { agents: [{ id, name: 'Synthetic video admission', status: 'running' }] };
        else if (input.path === '/api/client-devices/register' && input.method === 'POST') body = { installationId: input.headers['X-Eliza-Device-Id'], enrollmentId: 'video-fixture-enrollment', capabilities: [] };
        else if (input.path === '/api/conversations' && input.method === 'GET') body = { conversations: [] };
        else if (input.path === '/api/workflow/status' && input.method === 'GET') body = {};
        else throw Error('Unexpected resident request');
        return { status: 200, body: JSON.stringify(body) };
      }
      throw Error('Unexpected resident operation');
    }
    return native.apply(this, arguments);
  };
})();
