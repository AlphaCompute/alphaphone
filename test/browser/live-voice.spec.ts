import { test, expect } from '@playwright/test';

// The live voice client (apps/app/src/runtime/live-voice.ts) in a real browser against a stub
// agent: POST /api/asr/local-inference/live answered by a route handler, and the ephemeral
// voice-transcript agent events delivered over a stubbed agent WebSocket. No microphone, model or
// network: the stub speaks the upstream wire format (elizaOS #36213 / #36214).
test('live voice: partials render as interim text, stale turns are dropped and the final arrives once', async ({ page }) => {
  const posts: any[] = [];
  let socket: import('@playwright/test').WebSocketRoute | undefined;
  await page.routeWebSocket('ws://stub-agent.invalid/ws', ws => { socket = ws; });
  await page.route('https://stub-agent.invalid/api/asr/local-inference/live', async route => {
    const body = route.request().postDataJSON();posts.push(body);
    const end = Array.isArray(body.vad) && body.vad.some((edge: any) => edge.type === 'speech-end');
    await route.fulfill({ json: { ok: true, sessionId: body.sessionId, mode: 'stream', framesReceived: posts.length, ...(end ? { final: { turnId: 'turn-1', text: 'Remind me to call Sam at five', mode: 'stream', asrFinalFromSpeechEndMs: 120 } } : {}) } });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const live = await import('/src/runtime/live-voice.ts');
    const w = window as any;
    const view = document.createElement('p');view.setAttribute('data-test-interim', '');document.body.append(view);
    w.liveFinals = [];
    w.liveSession = live.createLiveVoiceSession({
      transport: {
        post: async (body: any, signal: AbortSignal) => (await fetch('https://stub-agent.invalid/api/asr/local-inference/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })).json(),
        subscribe: live.webSocketAgentEvents(() => new WebSocket('ws://stub-agent.invalid/ws')),
      },
      onInterim: (text: string) => { view.textContent = text; },
      onFinal: (final: any, latency: any) => { w.liveFinals.push({ final, latency }); },
    });
    w.liveFrame = () => live.encodeLiveFrame(new Float32Array(512).fill(0.05), Date.now());
  });
  await expect.poll(() => socket !== undefined).toBe(true);
  const sessionId = await page.evaluate(() => (window as any).liveSession.sessionId);
  const send = (payload: Record<string, unknown>) => socket!.send(JSON.stringify({ type: 'agent_event', version: 1, ephemeral: true, eventId: 'eph-1', stream: 'voice-transcript', ts: Date.now(), runId: `voice-transcript:${sessionId}`, seq: 1, payload: { type: 'voice-transcript', sessionId, ...payload } }));

  await page.evaluate(() => (window as any).liveSession.push([(window as any).liveFrame()], [{ type: 'speech-start', timestampMs: Date.now() }]));
  send({ turnId: 'turn-1', phase: 'speech-start' });
  send({ turnId: 'turn-1', phase: 'partial', text: 'Remind me', seq: 1 });
  await expect(page.locator('[data-test-interim]')).toHaveText('Remind me');
  send({ turnId: 'turn-1', phase: 'partial', text: 'Remind me to call Sam', seq: 2 });
  await expect(page.locator('[data-test-interim]')).toHaveText('Remind me to call Sam');
  // A stale turn and another session never replace the interim text.
  send({ turnId: 'turn-0', phase: 'partial', text: 'from an earlier turn', seq: 7 });
  socket!.send(JSON.stringify({ type: 'agent_event', stream: 'voice-transcript', payload: { type: 'voice-transcript', sessionId: 'other', turnId: 'turn-1', phase: 'partial', text: 'not this session', seq: 3 } }));
  await page.waitForTimeout(100);
  await expect(page.locator('[data-test-interim]')).toHaveText('Remind me to call Sam');

  await page.evaluate(() => (window as any).liveSession.push([(window as any).liveFrame()], [{ type: 'speech-end', timestampMs: Date.now() }]));
  send({ turnId: 'turn-1', phase: 'final', text: 'Remind me to call Sam at five', mode: 'stream', asrFinalFromSpeechEndMs: 120 });
  await expect(page.locator('[data-test-interim]')).toHaveText('');
  const finals = await page.evaluate(() => (window as any).liveFinals);
  expect(finals).toHaveLength(1);
  expect(finals[0].final).toEqual({ turnId: 'turn-1', text: 'Remind me to call Sam at five', mode: 'stream', asrFinalFromSpeechEndMs: 120 });
  expect(finals[0].latency.partials).toBe(2);
  expect(typeof finals[0].latency.firstPartialMs).toBe('number');
  expect(posts.map(body => body.vad?.[0]?.type)).toEqual(['speech-start', 'speech-end']);
  expect(posts[0].frames[0]).toMatchObject({ sampleRate: 16000, channels: 1, samples: 512 });
  // Interim text never reaches storage.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain('Remind me to call Sam');
  await page.evaluate(() => (window as any).liveSession.close());
  expect(posts.at(-1)).toMatchObject({ sessionId, close: true });
});
