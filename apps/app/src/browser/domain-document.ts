/** Product migration/recovery policy; the injected upstream store owns transactions. */
type Snapshot = {revision:string;raw:string|null};
type Documents = {
 read(key:string,signal?:AbortSignal):Promise<Snapshot|undefined>;
 compareExchange(key:string,expected:Snapshot|undefined,raw:string|null,signal?:AbortSignal):Promise<Snapshot>;
 edit<R>(key:string,editor:(before:Snapshot|undefined)=>Promise<{raw:string|null;result:R}>,signal?:AbortSignal):Promise<R>;
};
type Envelope = {version:1;legacy:string|null;value:string|null};
export type DomainRecovery = {
 snapshot:Snapshot|undefined;
 legacy:string|null;
 raw:string|null;
 format:'domain'|'unrecognized';
 legacyChanged:boolean;
};
const envelope=(raw:string|null):Envelope=>{
 const value=raw===null?null:JSON.parse(raw);
 if(!value||value.version!==1||!Object.hasOwn(value,'legacy')||!Object.hasOwn(value,'value')||
  value.legacy!==null&&typeof value.legacy!=='string'||value.value!==null&&typeof value.value!=='string')
  throw Error('Browser document metadata needs recovery.');
 return value;
};
const unchanged=(actual:string|null,expected:string|null)=>{
 if(actual!==expected)throw Error('Older browser data changed. Close older tabs and review recovery before continuing.');
};

/**
 * One Alpha domain moves as a unit: readers, writers, backup and reset.
 * Legacy storage is never rewritten or removed. A later observed legacy write
 * stops normal access; it is not silently imported over newer document edits.
 */
export class BrowserDomainDocument {
 private documents:Documents;
 private key:string;
 private legacy:()=>string|null;
 constructor(documents:Documents,key:string,legacy:()=>string|null){
  this.documents=documents;this.key=key;this.legacy=legacy;
 }

 private async load(signal?:AbortSignal):Promise<Envelope>{
  const current=await this.documents.read(this.key,signal);
  if(current){const value=envelope(current.raw);unchanged(this.legacy(),value.legacy);return value;}
  return this.documents.edit(this.key,async before=>{
   signal?.throwIfAborted();
   const legacy=this.legacy();
   const value:Envelope=before?envelope(before.raw):{version:1,legacy,value:legacy};
   unchanged(legacy,value.legacy);
   return {raw:JSON.stringify(value),result:value};
  },signal);
 }

 async readRaw(signal?:AbortSignal):Promise<string|null>{return (await this.load(signal)).value;}
 async read<T>(initial:()=>T|Promise<T>,signal?:AbortSignal):Promise<T>{
  const raw=await this.readRaw(signal);signal?.throwIfAborted();
  return raw===null?initial():JSON.parse(raw);
 }
 async edit<T,R>(initial:()=>T|Promise<T>,edit:(data:T)=>R|Promise<R>,signal?:AbortSignal):Promise<R>{
  return this.documents.edit(this.key,async before=>{
   signal?.throwIfAborted();const legacy=this.legacy();
   const value:Envelope=before?envelope(before.raw):{version:1,legacy,value:legacy};
   unchanged(legacy,value.legacy);
   const data:T=value.value===null?await initial():JSON.parse(value.value);
   const result=await edit(data);signal?.throwIfAborted();
   unchanged(this.legacy(),value.legacy);
   const raw=JSON.stringify(data);
   if(raw===undefined)throw Error('Browser document cannot be saved.');
   return {raw:JSON.stringify({...value,value:raw}),result};
  },signal);
 }

 /** Capture without importing, parsing domain bytes, or requiring readable metadata. */
 async capture(signal?:AbortSignal):Promise<DomainRecovery>{
  const snapshot=await this.documents.read(this.key,signal),legacy=this.legacy();
  if(!snapshot)return {snapshot,legacy,raw:legacy,format:'domain',legacyChanged:false};
  try{const value=envelope(snapshot.raw);return {snapshot,legacy,raw:value.value,format:'domain',legacyChanged:legacy!==value.legacy};}
  catch{return {snapshot,legacy,raw:snapshot.raw,format:'unrecognized',legacyChanged:false};}
 }

 /** Called only after explicit reset confirmation of the captured recovery state. */
 async reset(expected:DomainRecovery,signal?:AbortSignal):Promise<void>{
  signal?.throwIfAborted();unchanged(this.legacy(),expected.legacy);
  // Keep a canonical empty domain so the retained legacy backup cannot reimport.
  await this.documents.compareExchange(this.key,expected.snapshot,JSON.stringify({version:1,legacy:expected.legacy,value:null}),signal);
 }
}
