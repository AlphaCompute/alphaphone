import {connectionController} from './connection-ui';
import {useEffect,useRef,useState} from 'react';
import {deletions,refreshDeletionViews,type DeletionEntry} from './deletions';
import {browserScreenLocked} from '../browser/screen-locked';
import './deletion-undo.css';
export function DeletionUndo(){
 const [entries,setEntries]=useState<DeletionEntry[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');const signature=useRef('');
 useEffect(()=>{let retired=false,inflight=false,identityEpoch=0;
  const refresh=async()=>{if(inflight||retired)return;if(document.hidden||browserScreenLocked()){setEntries([]);return;}inflight=true;const admittedEpoch=identityEpoch;
   try{const result=await deletions.pending();if(retired||admittedEpoch!==identityEpoch||document.hidden||browserScreenLocked())return;
    const next=result.deletions.map(e=>[e.kind,e.id,e.phase]).join('|');if(signature.current&&next!==signature.current)refreshDeletionViews();signature.current=next;
    setEntries(result.deletions.filter(e=>['queued','paused','unknown','dispatching'].includes(e.phase)));setError('');
   }catch{if(!retired)setError('Pending deletion status is unavailable. Refresh before making another change.');}finally{inflight=false;}
  };
  const identity=()=>{const session=connectionController.getSnapshot().session;return session?JSON.stringify([session.origin,session.ownerId,session.agentId,session.sessionId]):'';};let previousIdentity=identity();
  const unsubscribe=connectionController.subscribe(()=>{const next=identity();if(next===previousIdentity)return;previousIdentity=next;identityEpoch++;setEntries([]);setError('');void refresh();});
  void refresh();const timer=setInterval(()=>void refresh(),500);window.addEventListener('alpha:deletions-changed',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('alpha:device-state',refresh);
  return()=>{retired=true;unsubscribe();clearInterval(timer);window.removeEventListener('alpha:deletions-changed',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('alpha:device-state',refresh);};
 },[]);
 if(!entries.length&&!error)return null;
 return <aside className="alpha-deletion-undo" aria-label="Pending deletions">{error&&<p role="status">{error}</p>}{entries.map(entry=>{
  const paused=entry.phase==='paused'||entry.window==='clock-changed',canUndo=paused||entry.phase==='queued'&&entry.window==='open';
  return <div key={entry.kind+entry.id}><p>{entry.target.row?.title||entry.target.fields?.title||entry.original?.title||'Selected '+entry.kind}<br/><small>{paused?'Deletion paused. Undo to keep it, then review again if you still want to delete.':canUndo?'Deletion queued for 10 seconds.':entry.phase==='unknown'||entry.phase==='dispatching'?'Deletion outcome needs review. It will not be repeated.':'Deletion is being verified.'}</small></p>{canUndo&&<button disabled={!!busy} onClick={async()=>{setBusy(entry.id);try{await deletions.undo({kind:entry.kind,id:entry.id});refreshDeletionViews();}catch{setError('Undo could not be confirmed. Refresh and inspect the saved item.');}finally{setBusy('');}}}>Undo</button>}</div>;
 })}</aside>;
}
