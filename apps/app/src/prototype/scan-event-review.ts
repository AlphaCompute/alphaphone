import {scanEventDraft,suggestScanEvent,type ScanEventDraft} from './scan-event';

export function createScanEventReview(text:()=>string,active:()=>boolean,review:(draft:ScanEventDraft)=>boolean){
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Create event draft';summary.style.cssText='cursor:pointer;min-height:44px;padding-top:12px';
 const description=document.createElement('p');description.textContent='Check the date and time against the photo. This opens a draft in Calendar; Save there to create the event.';
 const zone=document.createElement('p');zone.textContent='Local time · '+Intl.DateTimeFormat().resolvedOptions().timeZone;
 const form=document.createElement('form');form.style.cssText='display:grid;gap:12px';
 const input=(name:string,type:string)=>{const label=document.createElement('label');label.textContent=name;label.style.cssText='display:grid;gap:4px';const value=document.createElement('input');value.type=type;value.setAttribute('aria-label',name);value.style.cssText='box-sizing:border-box;width:100%;min-height:44px;font:inherit;color:inherit;background:var(--s2,#eee);border:1px solid var(--bd,#aaa);border-radius:8px;padding:8px';label.append(value);form.append(label);return value;};
 const title=input('Event title','text'),date=input('Event date','date'),time=input('Event start time','time'),minutes=input('Event duration in minutes','number'),location=input('Event location','text');
 title.maxLength=200;title.required=true;date.required=true;date.min='1970-01-01';date.max='2100-12-31';time.required=true;minutes.required=true;minutes.min='15';minutes.max='1440';minutes.step='1';location.maxLength=500;
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-label','Event draft status');
 const button=document.createElement('button');button.type='submit';button.textContent='Review in Calendar';button.style.cssText='min-height:44px;font:inherit;background:var(--s2,#eee);color:inherit;border:1px solid var(--bd,#aaa);border-radius:8px;padding:8px 16px';form.append(button,status);
 let initialized=false,submitted=false;
 const initialize=()=>{if(initialized||!details.open)return;initialized=true;const suggested=suggestScanEvent(text());title.value=suggested.title;date.value=suggested.date;time.value=suggested.time;minutes.value=String(suggested.minutes);};
 details.addEventListener('toggle',initialize);
 form.onsubmit=event=>{event.preventDefault();if(submitted||!active())return;try{const draft=scanEventDraft({title:title.value,date:date.value,time:time.value,minutes:Number(minutes.value),location:location.value},text());if(!review(draft)){status.textContent='Calendar could not open. Your draft remains here.';return;}submitted=true;button.disabled=true;}catch(error){status.textContent=error instanceof Error?error.message:'Check the event details.';}};
 details.append(summary,description,zone,form);return details;
}
