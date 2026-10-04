/** Direct persistence fault/fixture access; no production storage methods are replaced. */
export async function replaceCalendarBytes(raw:string|null){
 const request=indexedDB.open('alpha.browser.documents.v1',1);
 const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onupgradeneeded=()=>request.result.createObjectStore('documents');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{await new Promise<void>((resolve,reject)=>{const transaction=database.transaction('documents','readwrite');transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error);transaction.objectStore('documents').put({revision:crypto.randomUUID(),raw},'alpha.browser.calendar.v1');});}finally{database.close();}
}
export async function holdCalendarTransactions(){
 const request=indexedDB.open('alpha.browser.documents.v1',1);
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 const tx=db.transaction('documents','readwrite');let release=false;
 (window as any).releaseCalendarTransactions=()=>{release=true;};
 (window as any).calendarTransactionsHeld=new Promise<void>(resolve=>{tx.oncomplete=()=>{db.close();resolve();};});
 const keep=()=>{if(!release)tx.objectStore('documents').get('alpha.browser.calendar.v1').onsuccess=keep;};keep();
}
