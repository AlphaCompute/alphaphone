import {DigestInbox,type DigestStorage,type DigestResult,type HostedDigestProtocol} from './hosted-digests';
export interface ResultInbox {history():Promise<DigestResult[]>;sync(client:HostedDigestProtocol,signal:AbortSignal):Promise<DigestResult[]>;}
/** Native background polling owns remote credentials. A resident connection has
 * native IPC instead, and must sync through its already-bound workflow client. */
export function createDigestInbox(input:{android:boolean;resident:boolean;storage:DigestStorage;scope:string;native:()=>ResultInbox}):ResultInbox {
 return input.android&&!input.resident?input.native():new DigestInbox(input.storage,input.scope);
}
