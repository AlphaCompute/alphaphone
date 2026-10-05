/** The synchronous prototype reducers require a held origin-wide writer lease. */
export class SimulatorWriter {
 private owned=false;
 private retired=false;
 private release?:()=>void;
 private state:'pending'|'owned'|'busy'|'unsupported'|'retired'='pending';
 constructor(private snapshots:Map<string,string|null>){
  window.addEventListener('pagehide',()=>{this.retired=true;this.owned=false;this.state='retired';this.release?.();},{once:true});
  if(!navigator.locks?.request){this.state='unsupported';return;}
  void navigator.locks.request('alpha.dev.simulator-writer.v1',{mode:'exclusive',ifAvailable:true},async lock=>{
   if(this.retired)return;if(!lock){this.state='busy';return;}this.owned=true;this.state='owned';
   await new Promise<void>(resolve=>this.release=resolve);this.owned=false;
  }).catch(()=>{this.owned=false;this.state='unsupported';});
 }
 get ready(){return this.owned&&!this.retired;}
 private assertOwned(){
  if(!this.ready){
   if(this.state==='busy')throw Error('Another development tab owns saved app changes. Close it and reload this tab before saving. Your draft is still here.');
   if(this.state==='pending')throw Error('Development storage is starting. Try Save again.');
   throw Error('Safe development storage is unavailable. Reload in a browser with Web Locks before saving.');
  }
 }
 write(key:string,value:string){
  this.assertOwned();
  if(localStorage.getItem(key)!==this.snapshots.get(key))throw Error('Saved app data changed since this tab loaded. Reload before saving; keep a copy of your draft first.');
  localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error('Development app save could not be confirmed.');this.snapshots.set(key,value);
 }
 /** Reset participates in the same lease as every synchronous reducer. */
 reset(key:string,expected:string){
  this.assertOwned();
  if(this.snapshots.get(key)!==expected||localStorage.getItem(key)!==expected)throw Error('Saved app data changed. Reload before resetting.');
  localStorage.removeItem(key);if(localStorage.getItem(key)!==null)throw Error('Development reset could not be confirmed.');
  this.snapshots.set(key,null);
  // Retire stale in-memory reducers before navigation can yield to another task.
  this.retired=true;this.owned=false;this.state='retired';this.release?.();
 }
}
