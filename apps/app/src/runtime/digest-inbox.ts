import {DigestInbox,type DigestStorage,type DigestResult,type HostedDigestProtocol} from './hosted-digests';
export interface ResultInbox {history():Promise<DigestResult[]>;sync(client:HostedDigestProtocol,signal:AbortSignal):Promise<DigestResult[]>;}
/** Use the native inbox only after its exact session binding is verified. */
export function createDigestInbox(input:{android:boolean;nativeReady:boolean;storage:DigestStorage;scope:string;native:()=>ResultInbox}):ResultInbox {
 return input.android&&input.nativeReady?input.native():new DigestInbox(input.storage,input.scope);
}
