import { test, expect } from '@playwright/test';

// Real renderer, pairing, connection controller, proposal parser and journal
// orchestration. Auth, transcript, durable journal and native Clock are controlled
// boundaries: no model call, physical microphone, Android Intent or real alarm.
for (const mode of ['confirm','transcribed','zone','modal','unknown','receipt-loss','unavailable','denied','failed','show','snooze','dismiss','browser','old-host','duplicate'] as const) {
  test(`agent Clock handoff: ${mode}`, async ({ page }) => {
    await page.addInitScript((mode) => {
      const w = window as any, store = new Map(JSON.parse(localStorage.getItem('fixture-secure')||'[]'));w.calendarEntry=JSON.parse(localStorage.getItem('fixture-journal')||'null');
      const agentId = '12345678-1234-4234-8234-123456789abc';
      const fixture = w.recoveryFixture = { posts: 0, lists: 0, decisions: 0, claims: 0, receipts: 0, effects: Number(localStorage.getItem('fixture-effects')||0), journal: [] as string[], proposal: null as any };
      const methods = (names: string[]) => names.map(name => ({ name, rtype: 'promise' }));
      if(mode!=='browser')w.androidBridge={};
      w.Capacitor = {
        PluginHeaders: [
          {name:'AlphaVoiceCloud',methods:methods(['localSpeechStatus','transcribeLocalRecording','startRecording','stopRecording','releaseLocalSpeech','cancel','cancelRecording','stopPlayback','addListener','removeListener'])},
          {name:'DailyApps',methods:methods(['clockHandoff','perform','surfaceInfo','addListener','removeListener'])},
          { name: 'AlphaConnection', methods: methods(['request', 'cancel', 'secureRead', 'secureWrite', 'secureRemove','addListener','removeListener']) },
          { name: 'AlphaActionJournal', methods: methods(['reserve', 'markApplying', 'finish', 'get', 'list']) },
        ],
        nativeCallback:()=> 'fixture-listener',
        nativePromise: async (plugin: string, method: string, input: any) => {
          if(method==='addListener')return {callbackId:'fixture-listener'};if(method==='removeListener')return {};
          if(plugin==='AlphaVoiceCloud'){if(method==='localSpeechStatus')return {ready:true,execution:'device'};if(method==='startRecording')return {recordingId:'clock-voice-fixture',maxDurationMs:29000};if(method==='stopRecording')return {recordingId:'clock-voice-fixture',durationMs:1000};if(method==='transcribeLocalRecording')return {text:'Set an alarm for 07:00; await my review.',local:true,execution:'device'};return {};}
          if(plugin==='DailyApps'){if(method==='surfaceInfo')return {developmentBuild:true,assistant:false};if(method==='perform')return {status:'selected',transcript:'Set an alarm for 07:00; await my review.'};if(method==='clockHandoff'){fixture.effects++;localStorage.setItem('fixture-effects',String(fixture.effects));if(mode==='unknown')throw Error('Lost native bridge response');return {action:input.action,status:mode==='unavailable'?'unavailable':mode==='denied'?'denied':mode==='failed'?'failed':'opened',message:'Clock request sent'};}throw Error('Unexpected DailyApps method');}
          if (plugin === 'AlphaActionJournal') {
            fixture.journal.push(method);
            if (method === 'reserve') { if(w.calendarEntry)return {created:false,entry:structuredClone(w.calendarEntry)};w.calendarEntry={...structuredClone(input),phase:'reserved'}; localStorage.setItem('fixture-journal',JSON.stringify(w.calendarEntry));return { created: true }; }
            if (method === 'markApplying') { Object.assign(w.calendarEntry,{phase:'applying',attemptId:input.attemptId});return {}; }
            if(method==='get')return {entry:structuredClone(w.calendarEntry)};
            if(method==='list')return {entries:w.calendarEntry?[structuredClone(w.calendarEntry)]:[]};
            if (method === 'finish') {
              w.calendarRetained = structuredClone(input);Object.assign(w.calendarEntry,structuredClone(input),{phase:'terminal'});localStorage.setItem('fixture-journal',JSON.stringify(w.calendarEntry));

              return {};
            }
            throw Error('Unexpected journal call');
          }
          if (plugin !== 'AlphaConnection') throw Error('Unexpected native effect');
          if (method === 'secureRead') return { value: store.get(input.slot) ?? null };
          if (method === 'secureWrite') { store.set(input.slot, input.value);localStorage.setItem('fixture-secure',JSON.stringify([...store])); return {}; }
          if (method === 'secureRemove') { store.delete(input.slot); return {}; }
          if (method === 'cancel') return {};
          const pathname = new URL(input.url).pathname;
          const ok = (data: any) => ({ status: 200, data });
          if (pathname === '/api/auth/status') return ok({ required: true, authenticated: false, pairingEnabled: true, bootstrapRequired: false, instanceId: 'recovery-fixture', expiresAt: Date.now() + 60000 });
          if (pathname === '/api/auth/pair') return ok({ token: 'synthetic-session', identityId: 'fixture-owner', access: 'owner', instanceId: 'recovery-fixture' });
          if (input.headers.Authorization !== 'Bearer synthetic-session') throw Error('Unpaired request');
          if (pathname === '/api/auth/me') return ok({ identity: { id: 'fixture-owner', displayName: 'Fixture owner', kind: 'owner' }, session: { id: 'synthetic-session', kind: 'machine', expiresAt: Date.now() + 600000 }, access: { role: 'OWNER', mode: 'session' } });
          if (pathname === '/api/agents') return ok({ agents: [{ id: agentId, name: 'Recovery fixture', status: 'running' }] });
          if (pathname === '/api/client-devices/register') {
            w.calendarInstallation=input.headers['X-Eliza-Device-Id'];
            return ok({ installationId: input.headers['X-Eliza-Device-Id'], enrollmentId: 'fixture-enrollment', capabilities: mode==='old-host'?['calendar.local-event.v1']:['reminders.local-record.v1','calendar.local-event.v1','clock.handoff.v1'] });
          }
          if (pathname === '/api/workflow/status') return ok({});
          if (pathname === '/api/conversations' && input.method === 'POST') return ok({ conversation: { id: 'fixture-chat', title: 'Fixture' } });
          if (pathname === '/api/conversations/fixture-chat/messages' && input.method === 'POST') {
            if(mode==='old-host'||mode==='browser'){if(input.headers['X-Eliza-Device-Capabilities'].includes('clock.handoff.v1'))throw Error('Unsupported capability advertised');return ok({text:'Clock handoff is unavailable on this host. Open Clock from Calendar.',agentName:'Fixture'});}
            if (!input.headers['X-Eliza-Device-Capabilities']?.split(',').includes('clock.handoff.v1')) throw Error('Calendar capability was not negotiated');
            fixture.posts++;
            const sent=JSON.parse(input.body);w.calendarSent=sent;
            const operation=mode==='show'||mode==='dismiss'?{type:'clock_handoff',action:mode}:mode==='snooze'?{type:'clock_handoff',action:'snooze',snoozeMinutes:10}:{type:'clock_handoff',action:'set',hour:7,minute:0,label:'Wake up',timeZone:sent.metadata.clientDevice.context.timeZone};
            fixture.proposal={id:'fixture-proposal',digest:'a'.repeat(64),state:'pending',expiresAt:new Date(Date.now()+60000).toISOString(),subjectUserId:'fixture-owner',requestedBy:agentId,action:'device_action',payload:{action:'device_action',version:1,installationId:w.calendarInstallation,enrollmentId:'fixture-enrollment',operation}};
            return ok({ text: 'The request remains incomplete because processing stopped unexpectedly. Recorded tool outcomes are preserved; remaining work has not been completed.', agentName: 'Recovery fixture', terminalFailure: { kind: 'handler_error', code: 'PLANNER_INTERRUPTED_AFTER_ACTION', transient: false } });
          }
          if (pathname === '/api/client-devices/proposals') { fixture.lists++; return ok({proposals:fixture.proposal?[fixture.proposal]:[]}); }
          const body = input.body ? JSON.parse(input.body) : {};
          if (pathname.startsWith('/api/client-devices/proposals/fixture-proposal/')) {
            if (body.digest !== fixture.proposal.digest) throw Error('Review digest changed');
            if (pathname.endsWith('/decision')) { if (body.decision !== 'approve') throw Error('Unexpected decision'); fixture.decisions++; return ok({ proposal: { ...fixture.proposal, state: 'approved' }, digest: fixture.proposal.digest }); }
            if (pathname.endsWith('/claim')) { fixture.claims++; fixture.proposal={...fixture.proposal,state:'executing',execution:{attemptId:'fixture-attempt'}}; return ok({ proposal: { ...fixture.proposal, state: 'executing', execution: { attemptId: 'fixture-attempt' } }, digest: fixture.proposal.digest }); }
            if (pathname.endsWith('/receipt')) {  fixture.receipts++;if(mode==='receipt-loss'&&!w.allowReceipt)throw Error('Lost receipt upload'); w.calendarUploaded=structuredClone(body.receipt.result); return ok({ proposal: { ...fixture.proposal, state: 'succeeded' }, digest: fixture.proposal.digest }); }
          }
          throw Error('Unexpected fixture route ' + pathname);
        },
      };
    }, mode);
    await page.goto('/?mode=dev');
    const connect=async()=>{
      if(mode==='browser'){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Agent connection',exact:true}).click();}
    await page.getByText('Local development agent', { exact: true }).click();
    const local = page.locator('.alpha-connection details').filter({ has: page.getByText('Local development agent', { exact: true }) });
    await local.getByLabel('Local agent address').fill('http://127.0.0.1:47842');
    await local.getByLabel('Pairing code', { exact: true }).fill('synthetic-code');
    await local.getByRole('button', { name: 'Connect local agent', exact: true }).click();
    await page.locator('.alpha-connection-scrim').waitFor({ state: 'detached' });
    };await connect();
    if(mode==='browser')await page.getByRole('button',{name:'Home',exact:true}).click();
    const input=page.getByRole('textbox',{name:'Ask Alpha',exact:true});
    if(mode==='transcribed'){await page.getByRole('button',{name:'Talk',exact:true}).first().click();await page.getByRole('button',{name:'Start recording',exact:true}).click();await page.getByRole('button',{name:'Stop recording',exact:true}).click();await page.getByRole('button',{name:'Transcribe on this phone',exact:true}).click();await page.getByRole('button',{name:'Use in conversation',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message Alpha',exact:true})).toHaveValue('Set an alarm for 07:00; await my review.');await page.getByRole('textbox',{name:'Message Alpha',exact:true}).press('Enter');}
    else {await input.fill(mode==='show'?'Show my alarms':mode==='snooze'?'Snooze ringing alarms for ten minutes':mode==='dismiss'?'Dismiss the ringing alarm':'Set an alarm for 07:00; await my review.');await input.press('Enter');}
    if(mode==='old-host'||mode==='browser'){await expect(page.getByText('Clock handoff is unavailable on this host. Open Clock from Calendar.',{exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).recoveryFixture.effects)).toBe(0);await expect(page.getByText('Approve: clock handoff',{exact:true})).toHaveCount(0);return;}
    await expect(page.getByText(/Pending phone actions are available for separate review/)).toBeVisible();
    await expect(page.getByText('Approve: clock handoff',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>(window as any).recoveryFixture.effects)).toBe(0);
    if(mode==='zone')await page.evaluate(()=>{const original=Intl.DateTimeFormat.prototype.resolvedOptions;Intl.DateTimeFormat.prototype.resolvedOptions=function(){return {...original.call(this),timeZone:'Pacific/Honolulu'};};});
    if(mode==='modal'){
      await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back',{cancelable:true})));
      await page.getByRole('button',{name:'Calendar',exact:true}).click();await page.getByRole('button',{name:'Clock alarms',exact:true}).click();
      const context=await page.evaluate(async()=> (await import('/src/runtime/alpha-client.ts')).alphaClient.getState().context);
      expect(context.selectedObject.kind).toBe('clock-draft');
      await page.getByLabel('Alarm label',{exact:true}).fill('Edited draft');
      const edited=await page.evaluate(async()=> (await import('/src/runtime/alpha-client.ts')).alphaClient.getState().context);
      expect(edited.revision).toBeGreaterThan(context.revision);expect(edited.selectedObject.revision).not.toBe(context.selectedObject.revision);
      await page.getByRole('button',{name:'Close Clock',exact:true}).click();
      const closed=await page.evaluate(async()=> (await import('/src/runtime/alpha-client.ts')).alphaClient.getState().context);expect(closed.selectedObject?.kind).not.toBe('clock-draft');
      expect(await page.evaluate(async()=>{try{await (await import('/src/runtime/alpha-client.ts')).alphaClient.approve('fixture-proposal');return false;}catch{return true;}})).toBe(true);
      expect(await page.evaluate(()=>(window as any).recoveryFixture.effects)).toBe(0);return;
    }
    await page.getByText('Approve: clock handoff',{exact:true}).click();
    if(mode==='zone'){await expect(page.getByText('Phone time zone changed. Review the Clock request again.',{exact:true}).first()).toBeVisible();expect(await page.evaluate(()=>(window as any).recoveryFixture.effects)).toBe(0);return;}

    await expect.poll(()=>page.evaluate(()=>(window as any).recoveryFixture.effects)).toBe(1);
    await expect.poll(()=>page.evaluate(()=>(window as any).recoveryFixture.receipts)).toBe(1);
    if(mode==='receipt-loss'){
      expect(await page.evaluate(()=>(window as any).calendarRetained.result.clockResult.status)).toBe('opened');
      await page.evaluate(async()=>{(window as any).allowReceipt=true;await (await import('/src/runtime/connection-ui.tsx')).connectionController.actionHistory(true);});
      await expect.poll(()=>page.evaluate(()=>(window as any).recoveryFixture.receipts)).toBe(2);expect(await page.evaluate(()=>(window as any).recoveryFixture.effects)).toBe(1);
    }
    if(mode==='unknown')expect(await page.evaluate(()=>(window as any).calendarRetained.status)).toBe('unknown');
    else expect(await page.evaluate(()=>(window as any).calendarUploaded)).toEqual({kind:'clock-handoff',action:['show','snooze','dismiss'].includes(mode)?mode:'set',status:mode==='unavailable'?'unavailable':mode==='denied'?'denied':mode==='failed'?'failed':'opened'});
    if(mode==='duplicate'||mode==='unknown'){
      await page.evaluate(()=>{const keep=['fixture-secure','fixture-journal','fixture-effects'].map(k=>[k,localStorage.getItem(k)]);localStorage.clear();for(const [k,v] of keep)if(v)localStorage.setItem(k!,v);});
      await page.reload();await connect();
      const again=page.getByRole('textbox',{name:'Ask Alpha',exact:true});await again.fill('Repeat this same request');await again.press('Enter');
      // Let the reply settle, then keep the review card in the expanded chat.
      // A newly opening sheet can scroll its inner text between pointer down/up.
      await expect(page.getByText(/Pending phone actions are available for separate review/)).toBeVisible();
      await page.getByRole('button',{name:'Expand chat',exact:true}).click();
      await page.getByRole('button',{name:'Approve: clock handoff Tap to approve this exact action',exact:true}).click();
      await expect(page.getByText(/already has a device journal entry/).first()).toBeVisible();expect(await page.evaluate(()=>(window as any).recoveryFixture.effects)).toBe(1);
    }

  });
}
