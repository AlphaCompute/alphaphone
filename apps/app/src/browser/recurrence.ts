import type { ReminderRepeat } from '../runtime/reminder-contract';
const day = 86400000;
type Civil = { year: number; month: number; day: number; hour: number; minute: number };
function civil(at: number, zone: string): Civil {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
  const fields = Object.fromEntries(parts.map(p => [p.type, Number(p.value)]));
  return {year:fields.year,month:fields.month,day:fields.day,hour:fields.hour,minute:fields.minute};
}
const nominal = (value:Civil) => Date.UTC(value.year,value.month-1,value.day,value.hour,value.minute);
/** Earlier overlap offset; first valid civil minute after a gap, matching Android policy. */
export function zonedInstant(date:string,time:string,zone:string):number {
  const [year,month,dateDay]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
  const target={year,month,day:dateDay,hour,minute}, local=nominal(target);
  if(!Number.isFinite(local)||new Date(Date.UTC(year,month-1,dateDay)).toISOString().slice(0,10)!==date||hour<0||hour>23||minute<0||minute>59)throw Error('Invalid reminder time.');
  const candidates = new Set<number>();
  for(let delta=-48;delta<=48;delta+=6){const sample=local+delta*3600000;const offset=nominal(civil(sample,zone))-sample;candidates.add(local-offset);}
  const exact=[...candidates].filter(at=>nominal(civil(at,zone))===local).sort((a,b)=>a-b);
  if(exact.length)return exact[0];
  // Gaps are uncommon: scan only between the candidate offsets, at minute precision.
  const begin=Math.min(...candidates)-day,end=Math.max(...candidates)+day;
  let best=Infinity,bestCivil=Infinity;
  for(let at=begin;at<=end;at+=60000){const current=nominal(civil(at,zone));if(current>=local&&(current<bestCivil||current===bestCivil&&at<best)){bestCivil=current;best=at;}}
  if(!Number.isFinite(best))throw Error('Reminder time could not be resolved.');
  return best;
}
export function nextReminder(repeat:ReminderRepeat,dueAt:number,now:number):{dueAt:number;at:number;skippedDates:number} {
  const previous=civil(dueAt,repeat.zone),today=civil(now+repeat.leadMinutes*60000,repeat.zone);
  const start=Date.UTC(previous.year,previous.month-1,previous.day),current=Date.UTC(today.year,today.month-1,today.day);
  const step=repeat.rule==='weekly'?7:1;
  let offset=Math.max(step,Math.floor((current-start)/day/step)*step),skippedDates=0;
  // Count eligible earlier dates without executing each elapsed occurrence.
  for(let n=step;n<offset;n+=step)if(repeat.rule!=='weekdays'||![0,6].includes(new Date(start+n*day).getUTCDay()))skippedDates++;
  for(let attempts=0;attempts<16;attempts++,offset+=step){
    const date=new Date(start+offset*day);
    if(repeat.rule==='weekdays'&&[0,6].includes(date.getUTCDay()))continue;
    const dueAt=zonedInstant(date.toISOString().slice(0,10),repeat.time,repeat.zone),at=dueAt-repeat.leadMinutes*60000;
    if(at>now)return {dueAt,at,skippedDates};skippedDates++;
  }
  throw Error('Next reminder date could not be resolved.');
}
