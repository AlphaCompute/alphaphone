import {test} from 'node:test';
import assert from 'node:assert/strict';
// MVP-32 capability denial: requests the typed phone catalog can never satisfy are refused on the phone
// before any generation request. The filter recognizes phrasings, so these tables pin the ones it must
// catch and the supported requests it must not refuse. The typed catalog and compiler remain the bound
// for wording the filter does not recognize.
const S = await import('../apps/app/src/prototype/workflow-scope.ts');
const operations = ['supplied_text', 'selected_notes', 'calendar_range', 'contains', 'compose_draft', 'model_draft', 'save_note', 'app_notification', 'read_aloud'];

const refused = {
  calls: ['Call Maya every morning with my agenda', 'call maya every morning', 'CALL MAYA', 'Call the dentist at 9', 'call a taxi when my meeting ends', 'Phone the office and read my agenda', 'Ring the school', 'dial 911', 'FaceTime Maya', 'make a phone call', 'Read my notes, then call Sam', 'When Maya calls, read my agenda', 'ca​ll Maya', 'Ｃall Maya'],
  sms: ['Text Sam my calendar every evening', 'text sam my calendar', 'text the group my agenda', 'Message the team my notes', 'SMS my agenda', 'send a WhatsApp to Sam', 'Send a text', 'Whenever Maya texts, check my calendar'],
  payments: ['Pay my rent on the first of the month', 'pay rent', 'Pay the electricity bill', 'transfer $50 to John', 'Venmo Sam 20 dollars', 'send 20 dollars to Sam', 'wire money to Sam', 'send bitcoin', 'buy 2 shares of ACME', 'Buy milk', 'Read my list, then purchase the tickets', 'purchase the tickets with my card', 'order a pizza and pay with my card', 'donate $5', 'tip the driver', 'place an order', 'subscribe to Netflix', 'book a flight', 'add the amount to my wallet'],
  contacts: ['Add everyone from my notes to my contacts', 'look up Sam in my contacts', 'add a contact for Sam', 'Create a new contact named Sam', 'Use my contacts to find Sam', 'Read the address book'],
  code: ['Run this python script every hour', 'Run a script', 'execute rm -rf', 'evaluate this javascript: alert(1)', 'open a shell', 'post to a webhook', 'call an API', 'fetch https://example.com and summarize', 'curl the status page', 'use ```js console.log(1)```'],
  email: ['Email the summary to the team', 'Email my boss the summary', 'Email everyone my notes', 'send the summary by email', 'mail it to the team', 'Forward the notes to the team', 'reply to the email from Sam', 'Email it'],
};
const supported = [
  'Read my calendar for today and draft an agenda note',
  'Read my calendar for today, then draft an agenda and save a note',
  'Summarize my notes about bill payments',
  'Remind me to call Mom',
  'Save a note called Call sheet',
  'Save a note called Tip jar ideas',
  'Notify me about the contact lens order',
  'Read my notes on contact lenses and save a note',
  'Read supplied text and read it aloud',
  'Take the supplied text. Text from the note should be read aloud',
  'Draft text from my selected notes then post a notification',
  'Read my calendar and post a notification titled Buy milk',
  'Post a notification saying pay rent',
  'If the text contains payment then notify me',
  'If the note contains call then notify me',
  'Read my call notes',
  'Call notes digest: read my selected notes and draft a summary',
  'Call it Morning digest and read my notes',
  'Make a workflow and call this one Standup',
  'Message summary: read my notes and draft',
  'Draft a message of the day from my notes',
  'Draft what to say when I call the dentist',
  'Read my selected notes and tell me what to buy today',
  'Read my notes and compose a draft titled Contacts cleanup ideas',
  'summarize notes mentioning Venmo',
  'read my notes on API design',
  'a note about how to run code reviews',
  'Draft a script for my talk from my notes',
  'I look forward to a digest of my notes',
  'Read my notes and order them by date in a draft',
  'Phone notification with my agenda from calendar',
  'Email me the summary',
  'Email the summary to maya@example.com',
  'Read my calendar and text',
  // Phrasal verbs and namings that share a word with a refused action.
  'Read my calendar and call out conflicts',
  'Summarize supplied text; call out the key deadlines',
  'Read the calendar range and dial down the detail in the summary',
  'Call the workflow Morning brief and read my calendar',
  'Summarize the context of my selected notes and recall the dentist appointment from my calendar',
];

for (const [category, prompts] of Object.entries(refused)) {
  test(`refused before generation: ${category}`, () => {
    for (const prompt of prompts) {
      assert.ok(S.workflowScopeCategories(prompt).includes(category), `${JSON.stringify(prompt)} must be refused as ${category}`);
      const result = S.checkWorkflowScope(prompt, operations);
      assert.equal(result.refused, true, prompt);
      assert.match(result.message, /^Workflows can’t /);
      assert.match(result.message, /Nothing was sent to the agent\./);
      // The refusal names what a workflow here can do instead.
      assert.match(result.message, /Read supplied text; Read selected Notes; Read a Calendar range/);
    }
  });
}

test('supported requests are not refused', () => {
  for (const prompt of supported) assert.deepEqual(S.workflowScopeCategories(prompt), [], JSON.stringify(prompt));
  assert.deepEqual(S.checkWorkflowScope('Read my calendar for today and draft an agenda note', operations), {refused: false});
});

test('a refusal lists every unsupported category once and says when the agent offers no typed steps', () => {
  const mixed = S.checkWorkflowScope('Call Maya, then text Sam and pay the invoice with my card', operations);
  assert.equal(mixed.refused, true);
  assert.deepEqual(mixed.categories, ['calls', 'sms', 'payments']);
  assert.match(mixed.message, /^Workflows can’t place or answer phone calls, send text messages and make payments or move money\. Nothing was sent to the agent\./);
  const none = S.checkWorkflowScope('Call Maya', []);
  assert.match(none.message, /No typed workflow steps are available on this agent right now\./);
});

test('no typed operation label or refusal offers a schedule, a call, a text message, a payment or an email step', () => {
  const labels = Object.values(S.WORKFLOW_OPERATION_LABELS).join(' | ');
  assert.equal(/schedul|every day|daily|recurring|call|sms|text message|pay|e-?mail|contact/i.test(labels), false, labels);
  assert.deepEqual(Object.keys(S.WORKFLOW_OPERATION_LABELS).sort(), [...operations].sort());
});
