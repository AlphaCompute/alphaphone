export type ScanEventFields={title:string;date:string;time:string;minutes:number;location:string};
export type ScanEventDraft={id:null;title:string;off:number;t:number;d:number;where:string;notes:string;cal:'native:local';who:never[];repeat:'none';alert:null;video:false};
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function civilDate(year:number,month:number,day:number):string|undefined{
 const date=new Date(Date.UTC(year,month-1,day));
 if(year<1970||year>2100||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return;
 return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function clockTime(text:string):string|undefined{
 const clock=/^(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)$/i.exec(text);
 if(clock){const hour=Number(clock[1]);if(hour<1||hour>12)return;return `${String(hour%12+(/^p/i.test(clock[3])?12:0)).padStart(2,'0')}:${clock[2]||'00'}`;}
 return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)?text:undefined;
}
function timeWindow(text:string):{time:string;minutes?:number}|undefined{
 const single=clockTime(text);if(single)return {time:single};
 const range=text.split(/\s*(?:[-–—]|\s+to\s+)\s*/i);
 if(range.length!==2)return;
 const start=clockTime(range[0].trim()),end=clockTime(range[1].trim());if(!start||!end)return;
 const minute=(clock:string)=>Number(clock.slice(0,2))*60+Number(clock.slice(3));
 const minutes=minute(end)-minute(start);if(minutes<15||minutes>1440)return;
 return {time:start,minutes};
}
/** Explicit civil suggestions only: no invented year, locale order or time zone. */
export function suggestScanEvent(text:string):ScanEventFields{
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const dates:(string|undefined)[]=[];
 for(const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))dates.push(civilDate(Number(match[1]),Number(match[2]),Number(match[3])));
 const monthPattern='('+months.map(month=>month.length===3?month:month.slice(0,3)+'(?:'+month.slice(3)+')?').join('|')+')\\.?';
 for(const match of text.matchAll(new RegExp('\\b'+monthPattern+'[ \\t]+(\\d{1,2})(?:st|nd|rd|th)?(?:,?[ \\t]+(\\d{4}))?\\b','gi')))dates.push(civilDate(Number(match[3]),months.findIndex(month=>month.startsWith(match[1].toLowerCase()))+1,Number(match[2])));
 for(const match of text.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?[ \\t]+'+monthPattern+'(?:,?[ \\t]+(\\d{4}))?\\b','gi')))dates.push(civilDate(Number(match[3]),months.findIndex(month=>month.startsWith(match[2].toLowerCase()))+1,Number(match[1])));
 if(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(text))dates.push(undefined);
 const zoned=/\b(?:UTC|GMT|[ECMP](?:[DS])?T|AK[DS]T|HST|CET|CEST|BST|IST|JST|KST|MSK|(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific|Etc|US|Canada)\/[A-Za-z_/-]+)\b|\btime\s*zone\s*:/i.test(text);
 const timeLines=lines.map(line=>line.replace(/^(?:\d{4}-\d{2}-\d{2}[T ]+)?(?:at\s+|time:\s*|starts?:\s*)?/i,'')).filter(line=>/^\d{1,2}(?::|\s*[ap]\.?m)/i.test(line));
 const windows=timeLines.map(timeWindow);
 const times=windows.map(value=>value?.time),durations=windows.flatMap(value=>value?.minutes===undefined?[]:[value.minutes]);
 const dateClear=dates.length>0&&!dates.includes(undefined)&&new Set(dates).size===1;
 const timeClear=!zoned&&(dates.length===0||dateClear)&&!times.includes(undefined)&&new Set(times).size===1&&new Set(durations).size<=1;
 const locations=lines.map(line=>/^(?:location|venue):\s*(.+)$/i.exec(line)?.[1].trim()).filter((value):value is string=>!!value);
 return {title:(lines[0]||'').slice(0,200),date:dateClear?dates[0]!:'',time:timeClear?times[0]!:'',minutes:timeClear&&durations.length?durations[0]:60,location:new Set(locations).size===1&&locations[0].length<=500?locations[0]:''};
}
export function scanEventDraft(fields:ScanEventFields,text:string,now=new Date()):ScanEventDraft{
 if(text.length>16000)throw Error('Event notes support up to 16,000 characters. Shorten the scanned text before creating an event draft.');
 if(!fields.title.trim()||fields.title.length>200||fields.location.length>500)throw Error('Enter a title up to 200 characters and a location up to 500 characters.');
 const date=/^(\d{4})-(\d{2})-(\d{2})$/.exec(fields.date),time=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(fields.time);
 if(!date||!time)throw Error('Choose the event date and start time.');
 const [year,month,day]=date.slice(1).map(Number);if(year<1970||year>2100)throw Error('Choose a year from 1970 through 2100.');
 const civil=new Date(Date.UTC(year,month-1,day));if(civil.getUTCFullYear()!==year||civil.getUTCMonth()!==month-1||civil.getUTCDate()!==day)throw Error('Choose a valid date.');
 if(!Number.isInteger(fields.minutes)||fields.minutes<15||fields.minutes>1440)throw Error('Choose a duration from 15 to 1440 minutes.');
 const hour=Number(time[1]),minute=Number(time[2]),local=new Date(year,month-1,day,hour,minute);
 if(local.getFullYear()!==year||local.getMonth()!==month-1||local.getDate()!==day||local.getHours()!==hour||local.getMinutes()!==minute)throw Error('That local time does not exist because the clocks change. Choose another time.');
 return {id:null,title:fields.title.trim(),off:(civil.getTime()-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000,t:hour+minute/60,d:fields.minutes/60,where:fields.location.trim(),notes:text,cal:'native:local',who:[],repeat:'none',alert:null,video:false};
}
