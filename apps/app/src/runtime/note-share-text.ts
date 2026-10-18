type Note={kind:string;title?:string;body?:string;audio?:{transcript?:string};items?:{t:string;done?:boolean}[];url?:string;clips?:string[];lines?:{s?:string;t:string;at?:number}[];summary?:string[];actions?:{t:string;done?:boolean}[]};
/** Serialize the selected note's stored content; voice audio is never implied or attached. */
export function noteShareText(note:Note):{title:string;text:string}{
 const title=String(note.title||'Note');let body:string;
 if(note.kind==='text')body=String(note.body||'');
 else if(note.kind==='list')body=(note.items||[]).map(item=>`[${item.done?'x':' '}] ${item.t}`).join('\n');
 else if(note.kind==='link')body=[note.url,...(note.clips||[])].filter(Boolean).join('\n\n');
 else if(note.kind==='voice'){
  const transcript=String(note.body||note.audio?.transcript||'');
  const lines=transcript?[transcript]:(note.lines||[]).map(line=>line.t).filter(Boolean);
  body=['Voice note text (audio not included)',lines.length?'Transcript\n'+lines.join('\n'):'No transcript saved.',note.summary?.length?'Summary\n'+note.summary.join('\n'):'',note.actions?.length?'Action items\n'+note.actions.map(item=>`[${item.done?'x':' '}] ${item.t}`).join('\n'):''].filter(Boolean).join('\n\n');
 }else throw Error('This note has no supported text export.');
 return {title,text:[title,body].filter(Boolean).join('\n\n')};
}
