export type ScanEventFields={title:string;date:string;time:string;minutes:number;location:string};
export type ScanEventDraft={id:null;title:string;off:number;t:number;d:number;where:string;notes:string;cal:'native:local';who:never[];repeat:'none';alert:null;video:false};
/** Only a single explicit ISO civil date/time becomes a suggestion. No invented year. */
export function suggestScanEvent(text:string):ScanEventFields{
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const dates=[...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(match=>match[1]);
 const times=lines.map(line=>/^(?:\d{4}-\d{2}-\d{2}[T ]+)?(?:at )?((?:[01]\d|2[0-3]):[0-5]\d)$/i.exec(line)?.[1]).filter((value):value is string=>!!value);
 return {title:(lines[0]||'').slice(0,200),date:new Set(dates).size===1?dates[0]:'',time:new Set(times).size===1?times[0]:'',minutes:60,location:''};
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
