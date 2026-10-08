import {test,expect} from '@playwright/test';
import {silentMicrophone,recorder,typedTranscript,agentContext} from './voice-fixture';

// Voice entry from an open note keeps that note open, unchanged, and keeps its selection
// revision in the agent context envelope. No message is sent.
// The development server is shared and slow on a loaded machine.
test.describe.configure({timeout:120000});
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});

test('Use in conversation returns to the open note with the same selectedObject revision',async({page})=>{
 let sent=0;page.on('request',request=>{if(request.method()==='POST'&&!new URL(request.url()).pathname.startsWith('/browser-speech/'))sent++;});
 await page.goto('/');await silentMicrophone(page);
 await page.getByRole('button',{name:'Notes',exact:true}).click();
 await page.getByRole('button',{name:'New note',exact:true}).click();
 await page.getByRole('textbox',{name:'Title',exact:true}).fill('Voice context');
 await page.getByRole('textbox',{name:'Note',exact:true}).fill('Original body stays put.');
 await expect.poll(async()=>(await agentContext(page)).selectedObject?.kind,{timeout:15000}).toBe('note');
 const before=await agentContext(page);
 expect(before.view).toBe('notes');
 await page.getByRole('button',{name:'Talk',exact:true}).first().click();
 await expect(recorder(page)).toBeVisible();
 await typedTranscript(page,'Summarize this note');
 await page.getByRole('button',{name:'Use in conversation',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Message Alpha',exact:true})).toHaveValue('Summarize this note');
 await expect(recorder(page)).toHaveCount(0);
 // The same note is still open under the conversation sheet, and the envelope still names it at the same revision.
 await expect(page.locator('textarea[aria-label="Note"]')).toHaveValue('Original body stays put.');
 await expect.poll(async()=>JSON.stringify((await agentContext(page)).selectedObject),{timeout:15000}).toBe(JSON.stringify(before.selectedObject));
 await page.getByRole('button',{name:'Minimize chat',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Note',exact:true})).toHaveValue('Original body stays put.');
 await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('Voice context');
 await expect.poll(async()=>JSON.stringify((await agentContext(page)).selectedObject),{timeout:15000}).toBe(JSON.stringify(before.selectedObject));
 const after=await agentContext(page);
 expect(after.view).toBe('notes');
 expect(after.selectedObject).toEqual(before.selectedObject);
 expect(sent).toBe(0);
});
