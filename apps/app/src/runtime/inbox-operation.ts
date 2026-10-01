import { reviewMailAttachment, type MailAttachment } from './inbox-attachment';
import type { GmailInboxReceipt } from './cloud-protocol';

type Bag = Record<string, unknown>;
export interface InboxOperationRecord {
  version: 1; owner: string; grantId: string; requestId: string; proposal: Bag;
  phase: 'preparing' | 'review' | 'dispatching' | 'observed';
  review: Bag | null; receipt: GmailInboxReceipt | null;
}
export interface InboxOperationDependencies {
  owner: string; grantId: string; active(): boolean;
  store: { read<T>(key: string): Promise<T | null>; compareExchange(key: string, expected: unknown, value: unknown): Promise<{status: string}> };
  client: {
    gmailPrepareOperation(grant: string, request: string, proposal: Bag, signal: AbortSignal): Promise<{receipt: GmailInboxReceipt; review: Bag}>;
    gmailDispatchOperation(grant: string, request: string, digest: string, proposal: Bag, signal: AbortSignal): Promise<GmailInboxReceipt>;
    gmailOperation(grant: string, request: string, signal: AbortSignal): Promise<GmailInboxReceipt>;
  };
}
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** One durable selected-account intent. No recovery path dispatches an effect. */
export class InboxOperation {
  private record: InboxOperationRecord | null = null;
  private busy = false;
  private controller = new AbortController();
  constructor(private readonly deps: InboxOperationDependencies) {}
  snapshot() { return this.record ? copy(this.record) : null; }
  stop() { this.controller.abort(); }
  private check() { if (!this.deps.active() || this.controller.signal.aborted) throw new DOMException('Inbox account changed','AbortError'); }
  private async key() { return `inbox-operation:v1:${await digest(JSON.stringify([this.deps.owner,this.deps.grantId]))}`; }
  private async exclusive<T>(run:()=>Promise<T>) { if(this.busy)throw new Error('An Inbox operation is already pending');this.busy=true;try{this.check();return await run();}finally{this.busy=false;} }
  private async save(next: InboxOperationRecord | null) {
    this.check();const result=await this.deps.store.compareExchange(await this.key(),this.record,next);this.check();
    if(result.status!=='saved')throw new Error('Inbox operation changed. Reload its receipt before continuing.');this.record=next;
  }
  async load() { return this.exclusive(async()=>{
    const value=await this.deps.store.read<InboxOperationRecord>(await this.key());this.check();
    if(value && (value.version!==1||value.owner!==this.deps.owner||value.grantId!==this.deps.grantId||!value.requestId||!value.proposal||!['preparing','review','dispatching','observed'].includes(value.phase)))throw new Error('Invalid saved Inbox operation');
    this.record=value;return this.snapshot();
  }); }
  async prepare(proposal: Bag) { return this.exclusive(async()=>{
    if(this.record)throw new Error('Review the saved operation before starting another.');
    const clean=copy(proposal);if(new TextEncoder().encode(JSON.stringify(clean)).length>7.5*1024*1024)throw new Error('Message exceeds the supported review size');
    await this.save({version:1,owner:this.deps.owner,grantId:this.deps.grantId,requestId:crypto.randomUUID(),proposal:clean,phase:'preparing',review:null,receipt:null});
    await this.reviewCurrent();return this.snapshot();
  }); }
  /** Explicit review recovery is an idempotent prepare, never provider dispatch. */
  async reloadReview() { return this.exclusive(async()=>{if(!this.record||this.record.phase!=='preparing')throw new Error('Review recovery is unavailable');await this.reviewCurrent();return this.snapshot();}); }
  private async reviewCurrent() {
    const record=this.record!;
    const result=await this.deps.client.gmailPrepareOperation(record.grantId,record.requestId,record.proposal,this.controller.signal);this.check();
    if(result.receipt.requestId!==record.requestId||result.receipt.kind!==record.proposal.kind||result.receipt.reviewDigest!==await digest(JSON.stringify(result.review)))throw new Error('Server review does not match its receipt');
    const review=result.review;
    for(const field of ['kind','mode','subject','bodyText','replyMessageId','draftId','expectedDigest','messageId','expectedHistoryId']) if(record.proposal[field]!==undefined&&JSON.stringify(record.proposal[field])!==JSON.stringify(review[field]))throw new Error('Server changed the requested '+field);
    for(const field of ['to','cc','bcc'])if(record.proposal[field]!==undefined&&JSON.stringify(record.proposal[field])!==JSON.stringify(review[field]))throw new Error('Server changed the reviewed recipients');
    if(typeof review.from!=='string'||!review.from)throw new Error('Unsupported sender');
    const attachments=record.proposal.attachments||[];if(!Array.isArray(attachments)||attachments.length>1)throw new Error('Unsupported attachments');
    const checked=await Promise.all(attachments.map(async file=>{const {text,...metadata}=await reviewMailAttachment(file as MailAttachment);return metadata;}));
    if(JSON.stringify(checked)!==JSON.stringify(review.attachments||[]))throw new Error('Server changed the reviewed attachments');
    await this.save({...record,review:copy(review),receipt:copy(result.receipt),phase:result.receipt.state==='prepared'?'review':'observed'});
  }
  async confirm() { return this.exclusive(async()=>{
    const record=this.record;if(!record||record.phase!=='review'||!record.review||record.receipt?.state!=='prepared')throw new Error('A fresh exact review is required');
    // Durable before the single network attempt. A lost write reply cannot cause dispatch.
    await this.save({...record,phase:'dispatching'});this.check();
    const receipt=await this.deps.client.gmailDispatchOperation(record.grantId,record.requestId,record.receipt.reviewDigest,record.proposal,this.controller.signal);this.check();
    await this.observe(receipt);return this.snapshot();
  }); }
  private async observe(receipt: GmailInboxReceipt) {
    const record=this.record!;if(receipt.requestId!==record.requestId||receipt.kind!==record.proposal.kind||(record.receipt&&receipt.reviewDigest!==record.receipt.reviewDigest))throw new Error('Unexpected operation receipt');
    // A prepared response after an attempted dispatch remains uncertain locally; never re-enable Send.
    await this.save({...record,receipt:copy(receipt),phase:receipt.state==='prepared'?(record.phase==='dispatching'?'dispatching':record.review?'review':'preparing'):'observed'});
  }
  async refresh() { return this.exclusive(async()=>{if(!this.record)throw new Error('No saved operation');await this.observe(await this.deps.client.gmailOperation(this.record.grantId,this.record.requestId,this.controller.signal));return this.snapshot();}); }
  async clear() { return this.exclusive(async()=>{
    if(!this.record)return;
    if(!['review','preparing'].includes(this.record.phase)&&!['succeeded','rejected'].includes(this.record.receipt?.state||''))throw new Error('Outcome is unresolved. Check the existing receipt; do not repeat this message.');
    await this.save(null);
  }); }
}
