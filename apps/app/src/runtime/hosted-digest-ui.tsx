import {iconStyle} from '../icon-style';
import {registerPlugin} from '../platform-plugins';
import {openDomainRecovery} from '../browser/domain-recovery';
import {browserDevProfile} from '../browser/dev-profile';
import {browserScreenLocked} from '../browser/screen-locked';
import { holdPhoneInert } from './modal-inert';
import { browserHostedResults } from '../browser/hosted-results';
import { devSurfacesEnabled } from '../build-flags';
import { browserLocalAgentEnabled } from './local-agent';
import { NativeResultInbox, configureHostedBackground } from './hosted-background';
import { createDigestInbox, type ResultInbox } from './digest-inbox';
import { isAndroid } from '../native';
import { delegationNative } from "./cloud-delegation-ui";
import { HostedLiveSourcePicker } from "./hosted-live-source-ui";
import { hostedResultNative, publishHostedResult, resolveHostedResultTap, type HostedResultBinding } from "./hosted-result-notices";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { connectionController } from "./connection-ui";
import { secureConnectionStore } from "./native-connection";
import { actionScope } from "./device-actions";
import {
	HostedSourceRejected,
 digestSummaryText,
	type DigestSource,
	type DigestLoop,
	type DigestResult,
	type DigestTemplate,
	type HostedDigestProtocol,
 type DigestStorage,
} from "./hosted-digests";
import { DailyApps } from "../daily";
type Pending = {
	path: "sources" | "loops" | "sources/revoke" | "dossier";
	body: Record<string, unknown>;
	summary: string;
 nativeConsent?:{sourceId:string;scope:Record<string,unknown>;expiresAt:number;expectedBinding:Record<string,unknown>};
};
const nativeSources=registerPlugin<{nativeSourceConsent(input:Record<string,unknown>):Promise<Record<string,unknown>>;nativeSourceIdentity(input:{sessionId:string}):Promise<Record<string,unknown>>}>('AlphaHostedResults');
const nativeCalendars=registerPlugin<{requestWorkflowReadAccess():Promise<{status:string}>;workflowCalendars():Promise<{status:string;calendars:Array<{id:string;name:string;account:string;sourceRevision:string}>}>}>('AlphaCalendar');
function canSyncResults(){return !document.hidden&&(isAndroid||(document.documentElement.dataset.devBackground!=='true'&&!browserScreenLocked()));}
export function HostedDigestPanel() {
	const panel = useRef<HTMLElement>(null);
	const connection = useSyncExternalStore(
		connectionController.subscribe,
		connectionController.getSnapshot,
	);
	const interactiveDevelopment=devSurfacesEnabled&&browserDevProfile&&JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null')?.kind==='development';
	const [nativeReady,setNativeReady]=useState(false),[nativeSourceProtocol,setNativeSourceProtocol]=useState(false);
	const [backgroundEnabled,setBackgroundEnabled]=useState(false);
	const [noticeEnabled,setNoticeEnabled]=useState(false), [focusedRun,setFocusedRun]=useState<string|null>(null), [tap,setTap]=useState<{token:string;runId:string;sessionId:string}|null>(null);
	const [open, setOpen] = useState(false),
		[busy, setBusy] = useState(false),
		[message, setMessage] = useState(""),
		[sources, setSources] = useState<DigestSource[]>([]),
		[loops, setLoops] = useState<DigestLoop[]>([]),
		[results, setResults] = useState<DigestResult[]>([]),
		[review, setReview] = useState<Pending | null>(null),
		[pending, setPending] = useState<Pending | null>(null),
		[available, setAvailable] = useState(false);
    useEffect(()=>{if(!isAndroid)return;let stopped=false;const listener=delegationNative.addListener('cloudDelegationCallback',()=>{if(!stopped)setOpen(true);}).catch(()=>null);void delegationNative.readDelegationCallback().then(r=>{if(r.callback&&!stopped)setOpen(true);}).catch(()=>{});return()=>{stopped=true;void listener.then(l=>l?.remove());};},[]);
	const [text, setText] = useState(""),
		[label, setLabel] = useState("My reviewed tasks"),
		[kind, setKind] = useState("tasks"),
		[hours, setHours] = useState(24),
		[sourceId, setSourceId] = useState(""),
		[zone, setZone] = useState(
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		),
		[morning, setMorning] = useState("08:00"),
		[evening, setEvening] = useState("18:00");
 const [nativeLabel,setNativeLabel]=useState('Phone morning sources');
 const [calendarChoices,setCalendarChoices]=useState<Array<{id:string;name:string;account:string;sourceRevision:string}>>([]),[selectedCalendars,setSelectedCalendars]=useState<string[]>([]),[selectedReminders,setSelectedReminders]=useState(false);
 useEffect(()=>{setCalendarChoices([]);setSelectedCalendars([]);setSelectedReminders(false);},[connection.session?.sessionId]);
	const binding = useRef<{
		storage: DigestStorage;
        recover?:()=>void;
		notices: HostedResultBinding;
		client: HostedDigestProtocol;
		inbox: ResultInbox;
		slot: string;
		sessionId: string;
		controller: AbortController;
	} | null>(null);
	const mutationBusy = useRef(false);
	const refreshFlight = useRef<{controller:AbortController;promise:Promise<void>} | null>(null);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		const show = () => setOpen(true);
		window.addEventListener("alpha:hosted-digests", show);
		return () => {
			mounted.current = false;
			window.removeEventListener("alpha:hosted-digests", show);
		};
	}, []);
    useEffect(()=>{if(isAndroid)return;let live=true;const update=()=>{void hostedResultNative.status().then(value=>{if(live){setNoticeEnabled(value.enabled);setBackgroundEnabled(value.backgroundEnabled===true);}}).catch(()=>{});};update();window.addEventListener('alpha:hosted-notices-changed',update);return()=>{live=false;window.removeEventListener('alpha:hosted-notices-changed',update);};},[]);
    const checkTap = async (requestSignal?:AbortSignal) => {
        if(!canSyncResults())return;
        const b=binding.current;
        try {
            const result=await resolveHostedResultTap(hostedResultNative,b?.notices ?? null,requestSignal ?? b?.controller.signal ?? new AbortController().signal);
            if(result.kind==='none'||!canSyncResults()||requestSignal?.aborted)return;
            if(b && binding.current!==b)return;
            if(result.kind==='ready' && b){const history=await b.inbox.history();if(binding.current!==b||!canSyncResults())return;setOpen(true);setResults(history);setFocusedRun(result.result.runId);setTap({token:result.token,runId:result.result.runId,sessionId:b.sessionId});setMessage('Opened the saved result from this account and agent.');}
            else {setOpen(true);setMessage(result.kind==='other-account'?'Connect the matching account and agent to open this saved result. No account was switched.':'This result link needs a verified connection and retained history. No workflow was restarted.');}
        } catch { if(!b || binding.current===b)setMessage('Result link is waiting for a verified connection.'); }
    };
    useEffect(()=>{const listener=hostedResultNative.addListener('pendingResult',()=>{void checkTap();}).catch(()=>null);void checkTap();return()=>{void listener.then(value=>value?.remove());};},[]);
    useEffect(()=>{
        if(!open||!tap||!canSyncResults()||binding.current?.sessionId!==tap.sessionId)return;
        const node=document.getElementById('hosted-result-'+tap.runId);if(!node)return;node.scrollIntoView({block:'nearest'});node.focus();
        void hostedResultNative.consumeResult({token:tap.token}).then(()=>setTap(current=>current?.token===tap.token?null:current)).catch(()=>{});
    },[open,tap,results]);
	const refresh = (afterMutation=false):Promise<void> => {
		const b = binding.current;
		if (!b || !canSyncResults() || (mutationBusy.current && !afterMutation)) return Promise.resolve();
		if (refreshFlight.current) return refreshFlight.current.promise;
		const controller = new AbortController();
		const abort = () => controller.abort();
		b.controller.signal.addEventListener("abort", abort, {once:true});
		if (b.controller.signal.aborted) abort();
		let timedOut = false;
		const deadline = setTimeout(() => { timedOut = true; abort(); }, 20000);
		const signal = controller.signal;
		const promise = Promise.resolve().then(async () => {
		try {
			const supported = await b.client.available(signal);
			signal.throwIfAborted();
			if (binding.current !== b || document.hidden) return;
			setAvailable(supported);
            const nativeSupported=supported&&isAndroid&&connection.kind==='resident'?await b.client.nativeSourcesAvailable(signal):false;
            if(binding.current!==b)return;setNativeSourceProtocol(nativeSupported);
			if (!supported) {
				setMessage("This agent has not enabled scheduled digests.");
				return;
			}
			const [ss, ll, rr, pp] = await Promise.all([
				b.client.sources(signal),
				b.client.loops(signal),
				b.inbox.sync(b.client, signal),
				b.storage.read<Pending>(b.slot + ":pending"),
			]);
			signal.throwIfAborted();
			if (binding.current !== b || document.hidden) return;
			setSources(ss);
			setLoops(ll);
			setResults(rr);
			setPending(pp);
			setMessage("Synced with this agent.");
            try {const status=await hostedResultNative.status();if(binding.current===b){setNoticeEnabled(status.enabled);setBackgroundEnabled(status.backgroundEnabled===true);}}catch{}
            await checkTap(signal);
		} catch {
			if (binding.current === b && (timedOut || !signal.aborted) && !document.hidden)
				setMessage(
					"Sync unavailable. Previously saved results remain in this environment; no loop was restarted.",
				);
		}
		}).finally(() => {
			clearTimeout(deadline); b.controller.signal.removeEventListener("abort", abort); controller.abort();
			if (refreshFlight.current?.controller === controller) refreshFlight.current = null;
		});
		refreshFlight.current = {controller,promise};
		return promise;
	};
	useEffect(() => {
		const selected = connectionController.getWorkflowClient();
		binding.current?.controller.abort();
		binding.current = null;
		setAvailable(false);setNativeReady(false);setBackgroundEnabled(false);setNoticeEnabled(false);
		setResults([]);setFocusedRun(null);setTap(null);
		setSources([]);
		setLoops([]);
		setPending(null);
		setReview(null);
		setText("");
		setSourceId("");
		if (!selected || !connection.session) {
			setMessage(
				"Connect an agent with verified scheduled digest support. Results remain scoped to that account and agent.",
			);
			return;
		}
		const controller = new AbortController();
		let disposed = false;
        let releaseBrowser:undefined|(()=>void),releaseScheduler:undefined|(()=>void);
		void (async () => {
			const session = connection.session!,
				slot =
					"hosted-digests:v1:" +
					(await actionScope(
						JSON.stringify([session.origin, session.ownerId, session.agentId]),
					));
			if (disposed) return;
            const client=selected.client.hosted();let inbox:ResultInbox;
            const development=devSurfacesEnabled&&browserDevProfile&&JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null')?.kind==='development';
            const storage=development?await (await import('../browser/digest-storage')).browserDigestStore(session,()=>!disposed&&connectionController.getSnapshot().session?.sessionId===session.sessionId,controller.signal):devSurfacesEnabled&&!isAndroid&&browserLocalAgentEnabled&&connection.kind==='resident'?(await import('./local-agent-storage')).developmentDigestStore():secureConnectionStore;
            const notices:HostedResultBinding={scope:slot.slice('hosted-digests:v1:'.length),origin:session.origin,ownerId:session.ownerId,agentId:session.agentId,current:()=>!disposed&&binding.current?.sessionId===session.sessionId&&connectionController.getSnapshot().session?.sessionId===session.sessionId,revalidate:signal=>client.available(signal),history:()=>inbox.history()};
            let ready=false;
            if(isAndroid){
                const cloud=connection.kind==='cloud'?await secureConnectionStore.read<Record<string,unknown>>(`cloud-runtime:${session.sessionId}`):null;
                controller.signal.throwIfAborted();
                if(connectionController.getSnapshot().session?.sessionId!==session.sessionId)return;
                ready=await configureHostedBackground({...cloud,mode:connection.kind,origin:session.origin,ownerId:session.ownerId,agentId:session.agentId,sessionId:session.sessionId},controller.signal);
            }
            controller.signal.throwIfAborted();if(disposed)return;
            setNativeReady(ready);
            inbox=createDigestInbox({android:isAndroid,nativeReady:ready,storage,scope:slot,native:()=>new NativeResultInbox(session.sessionId),afterCommit:!isAndroid?async(result,signal)=>{await publishHostedResult(hostedResultNative,notices,result,signal);}:undefined});
			const b = {
                storage, notices,
                recover:development&&'recovery' in storage?()=>openDomainRecovery(storage.recovery as Parameters<typeof openDomainRecovery>[0],'digest inbox','Development digest inbox recovery','Download saved results and pending recovery records before resetting. Reset clears this account’s local inbox and pending request records. It does not cancel or restart agent schedules. Review uncertain requests with the agent before creating replacements. The backup preserves older slot bytes inside a JSON archive. Close older Alpha tabs before continuing.',controller.signal):undefined,
				client,
				inbox,
				slot,
				sessionId: selected.sessionId,
				controller,
			};
			binding.current = b;
            if(development){const {startDevelopmentDigestScheduler}=await import('../browser/development-digests');if(!disposed)releaseScheduler=startDevelopmentDigestScheduler(notices.current,controller.signal);}
            if(!isAndroid)releaseBrowser=browserHostedResults.bind(session.sessionId,notices);
			try {
				const old = await b.inbox.history();
				if (binding.current === b) setResults(old);
			} catch {}
			await refreshFlight.current?.promise;
			if (!disposed && binding.current === b) await refresh();
		})().catch(()=>{if(!disposed)setMessage('Result storage could not be connected. Reconnect the agent to try again.');});
		const resume = () => {
			if (!canSyncResults()) { refreshFlight.current?.controller.abort(); return; }
			void (async () => { await refreshFlight.current?.promise; if (!disposed && !document.hidden) await refresh(); })();
		};
		// Foreground freshness only; Android background delivery is a separate transport.
		const poll = setInterval(() => { if (canSyncResults()) void (async()=>{if(isAndroid||(await hostedResultNative.status()).backgroundEnabled)await refresh();})().catch(()=>{}); }, 15000);
		window.addEventListener("online", resume);
        let deviceFrame=0;const deviceResume=()=>{refreshFlight.current?.controller.abort();cancelAnimationFrame(deviceFrame);deviceFrame=requestAnimationFrame(resume);};
        window.addEventListener("alpha:device-state",deviceResume);
		document.addEventListener("visibilitychange", resume);
		const listener = DailyApps.addListener("appResumed", resume).catch(
			() => null,
		);
		return () => {
			disposed = true;
            releaseBrowser?.();releaseScheduler?.();
			clearInterval(poll);
			controller.abort();
			binding.current = null;
			window.removeEventListener("online", resume);
            window.removeEventListener("alpha:device-state",deviceResume);cancelAnimationFrame(deviceFrame);
			document.removeEventListener("visibilitychange", resume);
			void listener.then((value) => value?.remove());
		};
	}, [connection.session?.sessionId]);
	useEffect(() => {
		if (open) void refresh();
	}, [open]);
	useEffect(() => {
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		const phone = document.querySelector<HTMLElement>('.os');
		const releaseInert = holdPhoneInert(phone);

		panel.current?.focus();
		const back = (event: Event) => {
            if (document.querySelector("dialog[open]")) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			setOpen(false);
		};
		const key = (event: KeyboardEvent) => {
            if (document.querySelector("dialog[open]")) return;
			if (event.key === "Escape") back(event);
			if (event.key === 'Tab' && panel.current) {
				const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href]')).filter(item => item.getClientRects().length);
				const first = items[0], last = items.at(-1);
				if (!first) { event.preventDefault(); panel.current.focus(); }
				else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
				else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
			}
		};
		window.addEventListener("alpha-back", back, true);
		window.addEventListener("keydown", key);
		return () => {
			window.removeEventListener("alpha-back", back, true);
			window.removeEventListener("keydown", key);
			releaseInert();
			previous?.focus();
		};
	}, [open]);
	async function submit(value: Pending) {
		const b = binding.current;
		if (!b || busy || mutationBusy.current) return;
		setBusy(true); mutationBusy.current = true;
		try {
			refreshFlight.current?.controller.abort();
			await refreshFlight.current?.promise;
			if (binding.current !== b) return;
			await b.storage.write(b.slot + ":pending", value);
			if (binding.current !== b) return;
			setPending(value);
			let body=value.body;
            if(value.nativeConsent){
              const grant=await nativeSources.nativeSourceConsent({sessionId:b.sessionId,...value.nativeConsent,confirmed:true});
              if(binding.current!==b)return;
              body={...body,live:Object.fromEntries(['provider','ownerId','agentId','installationId','enrollmentId','sourceId','revision'].map(key=>[key,grant[key]]))};
            }
            if(value.path==='sources/revoke'){
              const source=sources.find(source=>source.id===body.id);
              if(source?.live?.provider==='native')await nativeSources.nativeSourceConsent({sessionId:b.sessionId,sourceId:source.live.sourceId,expectedBinding:source.live,revoke:true,confirmed:true});
              if(binding.current!==b)return;
            }
            await b.client.mutate(value.path, body, b.controller.signal);
            if(value.nativeConsent&&binding.current===b)setSourceId(value.nativeConsent.sourceId);
			if (binding.current !== b) return;
			await b.storage.remove(b.slot + ":pending");
			setPending(null);
			setReview(null);
			setText("");
			await refresh(true);
		} catch (error) {
      if(error instanceof HostedSourceRejected && binding.current===b){
        try { await b.storage.remove(b.slot + ":pending"); } catch {setMessage("Source was not saved, but its local recovery record could not be cleared. Retry to clear it safely.");return;}
        if(binding.current!==b)return;
        setPending(null);setReview(null);await refresh(true);setMessage(error.message);return;
      }
			if (binding.current === b)
				setMessage(
					"Save outcome is unconfirmed. Retry the same saved request to recover it safely.",
				);
		} finally {
			mutationBusy.current = false;
			if (mounted.current) setBusy(false);
		}
	}
 async function loadNativeCalendars(){const b=binding.current;if(!b||busy)return;setBusy(true);try{const permission=await nativeCalendars.requestWorkflowReadAccess();if(permission.status!=='granted')throw Error('Calendar permission was not granted.');const result=await nativeCalendars.workflowCalendars();if(binding.current!==b)return;if(result.status!=='ready')throw Error('Calendar sources unavailable.');setCalendarChoices(result.calendars);}catch(error){if(binding.current===b)setMessage((error as Error).message);}finally{setBusy(false);}}
 async function reviewNativeSource(){
  const b=binding.current;if(!b||busy)return;
  if(!nativeLabel.trim()){setMessage('Name this source selection before reviewing it.');return;}
  if(selectedCalendars.length>16){setMessage('Choose at most 16 calendars for this source.');return;}
  if(!selectedCalendars.length&&!selectedReminders){setMessage('Select a calendar or reminders first.');return;}
  try{new Intl.DateTimeFormat('en',{timeZone:zone}).format(0);if(!Number.isInteger(hours)||hours<1||hours>168)throw Error();}catch{setMessage('Choose a valid time zone and expiry from 1 to 168 hours.');return;}
  let expectedBinding:Record<string,unknown>;try{expectedBinding=await nativeSources.nativeSourceIdentity({sessionId:b.sessionId});if(binding.current!==b)return;}catch{setMessage('Reconnect the current phone enrollment before reviewing sources.');return;}
  const sourceId=crypto.randomUUID(),observedAt=new Date().toISOString(),expiresAt=Date.now()+hours*3600000;
  const scope={calendars:selectedCalendars.map(id=>({id,revision:calendarChoices.find(calendar=>calendar.id===id)!.sourceRevision})),reminders:selectedReminders,timeZone:zone,window:'owner_day_and_overdue_reminders',maximumItems:200,modelEgress:true};
  setReview({path:'sources',body:{id:sourceId,kind:'tasks',label:nativeLabel.trim(),observedAt,expiresAt:new Date(expiresAt).toISOString(),confirmed:true},nativeConsent:{sourceId,scope,expiresAt,expectedBinding},summary:`Allow ${connection.name||'your on-device agent'} to read the selected sources on this phone until ${new Date(expiresAt).toLocaleString()}?\nCalendars: ${calendarChoices.filter(c=>selectedCalendars.includes(c.id)).map(c=>c.name+' ('+c.account+')').join(', ')||'none'}. Reminders: ${selectedReminders?'open reminders due today and overdue':'excluded'}.\nThe brief uses only event titles and times for the local day in ${zone}, plus selected reminders’ titles, due times and status. At most 200 items; overflow fails. Calendar descriptions, attendees, locations and reminder bodies are excluded.\nThese fields may be sent to this agent’s configured text model. The agent may read these sources while Alpha is in the background or the phone is locked. Recurring reads require a separately reviewed morning schedule. You can revoke the source here. Briefs are saved privately with this agent; phone notifications follow your current result-notification setting. No app writes, inbox reads, messages or voice are authorized.`});
 }
	function schedule(template: DigestTemplate, enabled = true) {
		try {
			new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
		} catch {
			setMessage("Enter a valid IANA time zone.");
			return;
		}
		if (
			!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
				template === "morning" ? morning : evening,
			)
		) {
			setMessage("Choose a valid local time.");
			return;
		}
		const old = loops.find((l) => !l.removed && l.spec.template === template),
			source = sources.find((s) => s.id === (sourceId || old?.spec.sourceId));
		if (!source) {
			setMessage("Choose a reviewed source first.");
			return;
		}
		if (
			enabled &&
			(source.revoked || Date.parse(source.expiresAt) <= Date.now())
		) {
			setMessage("Choose a current, unrevoked source.");
			return;
		}
		const spec = {
			version: 1,
			template,
			sourceId: source.id,
			sourceRevision: source.revision,
			timeZone: zone,
			localTime: template === "morning" ? morning : evening,
			enabled,
		};
		setReview({
			path: "loops",
			body: {
				spec,
				mutationId: crypto.randomUUID(),
				confirmed: true,
				...(old ? { id: old.id, expectedVersionId: old.versionId } : {}),
			},
			summary: `${enabled ? "Enable" : "Pause"} ${template} digest at ${spec.localTime} in ${zone}, every day. Source: ${source.label}. ${source.live?.provider==='native'?'Permission reviewed':'Observed'} ${source.observedAt}; expires ${source.expiresAt}. ${source.live ? "This grants recurring model execution using fresh reads from the reviewed selected source and scope." : "This grants recurring model execution using that snapshot only."} ${source.live?.provider==='native'?'Save the brief in your agent’s private digest history and use the current phone result-notification setting. Android may delay delivery. ':''}No email delivery or device action is authorized.`,
		});
	}
	const liveBinding = binding.current;
	if (!open || (binding.current && binding.current.sessionId!==connection.session?.sessionId)) return null;
	return (
		<div className="alpha-connection-scrim">
			<section
				ref={panel}
				tabIndex={-1}
				className="alpha-connection"
				role="dialog"
				aria-modal="true"
				aria-labelledby="digest-title"
			>
				<header>
					<span className="alpha-connection-logo alpha-compute-mark" aria-label="Alpha Compute"/>
					<button
						aria-label="Close scheduled digests"
						onClick={() => setOpen(false)}
					>
						<span aria-hidden="true" data-alpha-icon="/icons/lucide/x.svg" style={iconStyle("x")}/>
					</button>
				</header>
				<h1 id="digest-title">Scheduled digests</h1>
                {liveBinding?.recover&&<button onClick={()=>{setOpen(false);liveBinding.recover?.();}}>Digest inbox recovery</button>}
				<p>
					{interactiveDevelopment ? 'Schedules run while this browser is open.' : connection.kind==='resident'
                        ? (isAndroid?'Your agent runs schedules on this phone. It cannot run while the phone is off.':'Schedules run on this computer while the local agent process is running.')
                        : connection.session ? 'Schedules run on your connected agent’s host, which must remain available.' : 'Choose where your agent runs to set up scheduled digests.'}
                </p>
                <p>Choose an expiring snapshot or review a read-only source from an account already connected to this agent.
				</p>
				<p role="status">{message}</p>
                {!isAndroid&&<p>Result checks are {backgroundEnabled?'on':'off'} while this browser is open. <button onClick={()=>void hostedResultNative.setBackgroundPolling({enabled:!backgroundEnabled}).then(value=>setBackgroundEnabled(value.backgroundEnabled===true)).catch(()=>setMessage('Check preference could not be saved.'))}>{backgroundEnabled?'Pause result checks':'Enable result checks'}</button></p>}
                {isAndroid&&nativeReady&&<p>Background checks are {backgroundEnabled?'on':'off'}. Android may delay checks beyond 15 minutes. Results remain available when you reopen the app. <button onClick={()=>void hostedResultNative.setBackgroundPolling({enabled:!backgroundEnabled}).then(value=>setBackgroundEnabled(value.backgroundEnabled===true)).catch(()=>setMessage('Background preference could not be saved.'))}>{backgroundEnabled?'Pause background checks':'Enable background checks'}</button></p>}
                {isAndroid&&!nativeReady?<p>Results sync while this app is open and are saved in encrypted device storage. Background delivery could not be verified for this connection. Reconnect to try again.</p>:<p>{noticeEnabled?'Result notifications are enabled.':isAndroid?'Result notifications are off or unavailable. Saved results remain here.':'Result notifications are off. Saved results remain here.'}</p>}
                {isAndroid&&nativeReady&&<button onClick={()=>void hostedResultNative.enable().then(()=>hostedResultNative.status()).then(value=>setNoticeEnabled(value.enabled)).catch(()=>setMessage('Enable result notifications in Android settings; history remains available.'))}>Notification settings</button>}
                {!isAndroid&&<button aria-pressed={noticeEnabled} onClick={()=>void browserHostedResults.setNotifications({enabled:!noticeEnabled}).catch(()=>setMessage('Notification preference could not be saved.'))}>Result notifications</button>}
				<button disabled={busy} onClick={() => void refresh()}>
					Refresh
				</button>
				{pending ? (
					<section>
						<h2>Unconfirmed save</h2>
						<p>{pending.summary}</p>
						<button disabled={busy} onClick={() => void submit(pending)}>
							Retry exact saved request
						</button>
					</section>
				) : review ? (
					<section>
						<h2>Review</h2>
						<p style={{ whiteSpace: "pre-wrap" }}>{review.summary}</p>
						<button disabled={busy} onClick={() => void submit(review)}>
							Confirm
						</button>
						<button disabled={busy} onClick={() => setReview(null)}>
							Cancel
						</button>
					</section>
				) : (
					available && (
						<>
							{isAndroid&&connection.kind==='resident'&&nativeReady&&nativeSourceProtocol&&<details><summary>Selected phone sources</summary><label>Source name<input maxLength={200} value={nativeLabel} onChange={e=>setNativeLabel(e.target.value)}/></label><p>Choose Calendar sources and reminders for a morning brief or an on-demand dossier.</p><button disabled={busy} onClick={()=>void loadNativeCalendars()}>Choose calendars</button>{calendarChoices.map(c=><label key={c.id}><input type="checkbox" checked={selectedCalendars.includes(c.id)} onChange={e=>setSelectedCalendars(ids=>e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id))}/>{c.name} · {c.account}</label>)}<label><input type="checkbox" checked={selectedReminders} onChange={e=>setSelectedReminders(e.target.checked)}/>Open phone reminders due today and overdue</label><label>Consent expires in hours<input type="number" min={1} max={168} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label><button disabled={busy} onClick={()=>void reviewNativeSource()}>Review source consent</button></details>}
                            {liveBinding && <HostedLiveSourcePicker key={liveBinding.sessionId} client={liveBinding.client} scope={liveBinding.notices.scope} signal={liveBinding.controller.signal} current={() => binding.current === liveBinding} busy={busy} review={setReview} />}
							<details>
								<summary>Share a snapshot</summary>
								<p>
									Only the text you review here is sent. This does not grant
									continuous access to phone apps.
								</p>
								<label>
									Source type
									<select
										value={kind}
										onChange={(e) => setKind(e.target.value)}
									>
										{["tasks", "calendar", "email", "notes"].map((v) => (
											<option key={v}>{v}</option>
										))}
									</select>
								</label>
								<label>
									Label
									<input
										maxLength={200}
										value={label}
										onChange={(e) => setLabel(e.target.value)}
									/>
								</label>
								<label>
									Snapshot text
									<textarea
										rows={5}
										maxLength={12000}
										value={text}
										onChange={(e) => setText(e.target.value)}
										style={{
											font: "inherit",
											width: "100%",
											boxSizing: "border-box",
										}}
									/>
								</label>
								<label>
									Expires after hours
									<input
										type="number"
										min={1}
										max={168}
										value={hours}
										onChange={(e) => setHours(Number(e.target.value))}
									/>
								</label>
								<button
									disabled={
										!text.trim() ||
										!label.trim() ||
										!Number.isFinite(hours) ||
										hours < 1 ||
										hours > 168 ||
										JSON.stringify({ text, label }).length > 14000 ||
										busy
									}
									onClick={() => {
										const observedAt = new Date().toISOString(),
											expiresAt = new Date(
												Date.now() + hours * 3600000,
											).toISOString();
										setReview({
											path: "sources",
											body: {
												id: crypto.randomUUID(),
												kind,
												label,
												text,
												observedAt,
												expiresAt,
												confirmed: true,
											},
											summary: `Share this ${kind} snapshot with the connected agent. Observation time records this submission, not a fresh app read. Expires ${expiresAt}.\n\n${label}\n${text}`,
										});
									}}
								>
									Review snapshot
								</button>
							</details>
							<label>
								Reviewed source
								<select
									value={sourceId}
									onChange={(e) => setSourceId(e.target.value)}
								>
									<option value="">Choose source</option>
									{sources
										.filter((s) => !s.revoked)
										.map((s) => (
											<option value={s.id} key={s.id}>
												{s.label} · expires{" "}
												{new Date(s.expiresAt).toLocaleString()}
											</option>
										))}
								</select>
							</label>
{sources.find(s=>s.id===sourceId)?.live?.provider==='native'&&<button disabled={busy} onClick={()=>{const source=sources.find(s=>s.id===sourceId)!;setReview({path:'dossier',body:{sourceId:source.id,sourceRevision:source.revision,mutationId:crypto.randomUUID(),confirmed:true},summary:`Prepare a dossier now from ${source.label}? This sends one fresh read of your reviewed selected phone sources to this agent’s configured text model. It creates no recurring schedule. Model usage is billed by this agent.`});}}>Review on-demand dossier</button>}
							<label>
								Time zone
								<input value={zone} onChange={(e) => setZone(e.target.value)} />
							</label>
							<label>
								Morning
								<input
									type="time"
									value={morning}
									onChange={(e) => setMorning(e.target.value)}
								/>
							</label>
{sources.find(source=>source.id===sourceId)?.live?.provider!=='native'&&							<label>
								Evening
								<input
									type="time"
									value={evening}
									onChange={(e) => setEvening(e.target.value)}
								/>
							</label>}
							<p>
								Skipped clock times are missed; repeated times run once at the
								earlier offset. A missed schedule does not replay a backlog.
								{interactiveDevelopment ? 'Digests use the configured development reply.' : 'Model usage is billed by the connected agent.'}
							</p>
							{(["morning", "evening"] as const).filter(t=>t==='morning'||sources.find(source=>source.id===sourceId)?.live?.provider!=='native').map((t) => (
								<div key={t}>
									<button disabled={busy} onClick={() => schedule(t)}>
										Review {t} schedule
									</button>
									{loops.some(
										(l) => !l.removed && l.spec.template === t && l.active,
									) && (
										<button disabled={busy} onClick={() => schedule(t, false)}>
											Review pause
										</button>
									)}
								</div>
							))}
							{sources
								.filter((s) => !s.revoked)
								.map((s) => (
									<div key={s.id}>
										<span>{s.label}</span>
										<button
											disabled={busy}
											onClick={() =>
												setReview({
													path: "sources/revoke",
													body: { id: s.id, confirmed: true },
													summary: `Revoke ${s.label} for future runs. Previously generated results are retained. A model request already in progress may finish.`,
												})
											}
										>
											Review revocation
										</button>
									</div>
								))}
						</>
					)
				)}
				<h2>Results</h2>
				<p>
					Latest 100 results retained in this environment. Delivery acknowledgement
					does not mark a task complete.
				</p>
				{(binding.current?.sessionId===connection.session?.sessionId ? results : [])
					.slice()
					.reverse()
					.map((result) => (
						<article className="alpha-connection-agent" key={result.runId} id={"hosted-result-"+result.runId} tabIndex={-1}>
                            {focusedRun===result.runId&&<span>Opened from notification</span>}
							<strong>
								{new Date(result.scheduledAt).toLocaleString()} ·{" "}
								{result.status}
							</strong>
							<span>
								{result.source.type==='live_selected_native_read'?'Phone sources read':result.source.type==='live_selected_google_read'?'Connected sources read':'Snapshot observed'} {new Date(String(result.source.observedAt)).toLocaleString()}; {result.source.type==='live_selected_native_read'?'permission expires':'expires'}{" "}
								{new Date(String(result.source.expiresAt)).toLocaleString()}
							</span>
							<pre
								style={{
									whiteSpace: "pre-wrap",
									overflowWrap: "anywhere",
									font: "inherit",
									width: "100%",
								}}
							>
								{digestSummaryText(result)}
							</pre>
                            {result.source.type!=='live_selected_native_read'&&<details><summary>Execution details</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',font:'inherit',width:'100%'}}>{JSON.stringify(result.output,null,2)}</pre></details>}
						</article>
					))}
			</section>
		</div>
	);
}
