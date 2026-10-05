import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const {checkWorkflowScope,workflowScopeCategories}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('apps/app/src/prototype/workflow-scope.ts','utf8'))).toString('base64'));
test('calls, SMS, payments, Contacts, arbitrary code and email to unnamed recipients are refused locally',()=>{
 const cases={calls:['Call Maya every morning','When I get home, phone my mom','place a phone call to the office','answer incoming calls','whenever Sam calls, read my calendar'],sms:['Text Sam the summary','send an SMS to my brother','send a message with my notes','whenever Maya texts, check my calendar','then message Ana the draft'],payments:['pay my rent on the 1st','Send $20 to Jo every Friday','every day at 6, add the amount to Wallet','use Venmo for the split'],contacts:['Look up my contacts','add the speaker to my address book'],code:['run this python script','execute a shell command every hour','call a webhook with my notes','```js\nfetch(x)\n```'],email:['email the summary to the team','send an email with the digest','forward the email to everyone']};
 for(const [category,prompts] of Object.entries(cases))for(const prompt of prompts)assert.ok(workflowScopeCategories(prompt).includes(category),`${category}: ${prompt}`);
});
test('supported Notes and Calendar requests, named or owner email recipients and nouns are not refused',()=>{
 for(const prompt of ['Read my calendar for today and draft a morning digest','Summarize call notes from my selected notes','Read supplied text then compose a draft','Save a note from the text of my selected notes','pay attention to deadlines in my notes','whenever Maya emails, summarize call notes','Post a notification when my calendar has meetings','Read aloud my notes','email it to bob@example.com','email me the summary','Draft a reply I can review in Notes'])
  assert.deepEqual(workflowScopeCategories(prompt),[],prompt);
});
test('a refusal names every refused category and only the operations available on this agent',()=>{
 const result=checkWorkflowScope('Call Maya and pay her',['supplied_text','selected_notes','calendar_range','not_a_known_op']);
 assert.equal(result.refused,true);assert.deepEqual(result.categories,['calls','payments']);
 assert.match(result.message,/place or answer phone calls and make payments or move money/);assert.match(result.message,/Nothing was sent to the agent/);
 assert.match(result.message,/Read supplied text; Read selected Notes; Read a Calendar range\./);assert.doesNotMatch(result.message,/not_a_known_op|Save a note/);
 assert.match(checkWorkflowScope('Call Maya',[]).message,/No typed workflow steps are available/);
 assert.deepEqual(checkWorkflowScope('Read my calendar',['calendar_range']),{refused:false});
});
