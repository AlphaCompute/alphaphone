import {DigestInbox,type DigestStorage,type DigestResult,type HostedDigestProtocol} from './hosted-digests';
export interface ResultInbox {history():Promise<DigestResult[]>;sync(client:HostedDigestProtocol,signal:AbortSignal):Promise<DigestResult[]>;}
/** Use the native inbox only after its exact session binding is verified. */
export function createDigestInbox(input:{android:boolean;nativeReady:boolean;storage:DigestStorage;scope:string;native:()=>ResultInbox;afterCommit?:(result:DigestResult,signal:AbortSignal)=>Promise<void>}):ResultInbox {
 if(input.android&&input.nativeReady)return input.native();
 // Unverified/native-unavailable renderer fallback must not write the native
 // delivery journal. Existing native rows remain accessible only through its API.
 const scope=input.android?'renderer-'+input.scope:input.scope;
 return new DigestInbox(input.storage,scope,input.afterCommit);
}
