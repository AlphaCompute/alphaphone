import crypto from 'node:crypto';
import http from 'node:http';

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

/** Alpha campaign receipts and deliberate metadata-response loss, shared by both runs. */
export function createCombinedAgentProxy({host, getActive, timeout = 180000, maxBytes = 2 * 1024 * 1024}) {
  return http.createServer((req, res) => {
    // Bind every callback to the campaign and phase that admitted this request.
    const active = getActive(), phase = active?.phase;
    const current = () => getActive() === active && active?.phase === phase;
    const fail = () => { if (active) active.failed = true; };
    if (phase === 'verify' && req.method !== 'GET' && !(req.method === 'POST' && req.url === '/api/client-devices/register')) {
      fail(); active.replayAttempts++;
      res.writeHead(409, {'Content-Type': 'application/json'}).end('{"error":"Unexpected replay attempt during read-only restart verification"}');
      return;
    }
    if (!req.url?.startsWith('/api/') || req.url.startsWith('//') || req.url.includes('://')) {
      res.writeHead(404).end(); return;
    }
    const post = req.method === 'POST';
    const message = post && /^\/api\/conversations\/[^/]+\/messages$/.test(req.url);
    const workflow = active && `/api/workflow/workflows/${active.workflowId}`;
    const metadata = active && post && req.url === workflow + '/metadata';
    const lifecycle = active && post && req.url === workflow + '/lifecycle';
    const workflowRun = active && post && req.url === workflow + '/run';
    if (active && post && req.url === `/api/workflow/executions/${active.approvalRunId}/approvals/write-fixture/0`) active.approvalDecisions++;
    if (active && message && req.url !== `/api/conversations/${encodeURIComponent(active.conversationId)}/messages`) fail();
    let deliberateDrop = false;
    const upstream = http.request(host + req.url, {
      method: req.method,
      headers: {...req.headers, host: '10.0.2.2:47858', 'x-forwarded-for': '192.0.2.1'},
      timeout,
    }, reply => {
      reply.on('error', () => { fail(); res.destroy(); });
      if (!current()) { fail(); reply.destroy(); res.destroy(); return; }
      const successful = reply.statusCode >= 200 && reply.statusCode < 300;
      if (active) {
        if (phase === 'verify' && successful && req.method === 'GET') {
          if (req.url === '/api/auth/me') active.restoredAuth++;
          if (req.url.startsWith('/api/workflow/executions/')) active.readReceipts.add(req.url.split('/')[4]);
          if (req.url === `/api/conversations/${encodeURIComponent(active.conversationId)}/messages`) active.restoredHistory++;
        }
        if (req.url === '/api/auth/pair' && post && successful) active.pairings++;
        if (req.headers.authorization && successful) {
          active.sessions.add(digest(req.headers.authorization));
          if (active.sessions.size !== 1) fail();
        }
        if (req.headers['x-eliza-device-id'] && successful) {
          active.devices.add(digest(String(req.headers['x-eliza-device-id']) + '|' + String(req.headers['x-eliza-device-key'] || '')));
          if (active.devices.size !== 1) fail();
        }
        if (reply.statusCode === 429) active.providerFailure = true;
        if (successful && post) {
          if (req.url === '/api/asr/whisper') active.asr++;
          if (req.url === '/api/tts/local-inference') active.tts++;
          if (req.url.startsWith('/api/client-devices/')) {
            if (req.url.endsWith('/decision')) active.deviceDecisions++;
            if (req.url.endsWith('/claim')) active.deviceClaims++;
            if (req.url.endsWith('/receipt')) active.deviceReceipts++;
          }
          if (metadata) active.metadataPosts++;
        }
      }
      if (message || metadata || lifecycle || workflowRun) {
        let bytes = 0;
        const chunks = [];
        reply.on('data', chunk => {
          bytes += chunk.length;
          if (!current() || bytes > maxBytes) { fail(); reply.destroy(); res.destroy(); return; }
          chunks.push(chunk);
        });
        reply.on('end', () => {
          if (!current() || res.destroyed) { fail(); res.destroy(); return; }
          const data = Buffer.concat(chunks);
          try {
            const parsed = JSON.parse(data);
            if (message && active) {
              active.chats++;
              if (parsed.terminalFailure || parsed.failureKind) active.providerFailure = true;
              if (active.chats === 1) active.exactChat = String(parsed.text).trim() === String(active.answer);
            }
            if (lifecycle && successful) active.lifecycleReceipts.push(parsed.receipt);
            if (workflowRun && successful) active.nativeRunIds.push(parsed.execution?.id);
            if (metadata && successful) {
              active.metadataReceipt = parsed.receipt;
              active.mutationId = parsed.receipt?.mutationId;
              active.droppedMetadata++;
              deliberateDrop = true;
              res.destroy(); return;
            }
          } catch { fail(); }
          const headers = {...reply.headers, 'content-length': String(data.length)};
          delete headers['transfer-encoding'];
          res.writeHead(reply.statusCode, headers); res.end(data);
        });
      } else {
        // A phase change while streaming still invalidates this campaign's evidence.
        reply.on('end', () => { if (!current()) fail(); });
        res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
      }
    });
    upstream.on('timeout', () => { fail(); upstream.destroy(); });
    upstream.on('error', () => {
      fail();
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.on('aborted', () => { fail(); upstream.destroy(); });
    req.on('error', () => { fail(); upstream.destroy(); });
    res.on('close', () => {
      if (!res.writableEnded) {
        if (!deliberateDrop) fail();
        upstream.destroy();
      }
    });
    req.pipe(upstream);
  });
}
