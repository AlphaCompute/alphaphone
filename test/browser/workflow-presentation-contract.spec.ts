import {test,expect} from '@playwright/test';
test('typed presentation review binds exact steps, title, device and run before any effect',async({page})=>{
 await page.goto('/?mode=dev');const result=await page.evaluate(async()=>{
  const {normalizePhoneSpec}=await import('/src/runtime/phone-workflow-authoring.ts');
  const {parseWorkflowPhoneReview,assertWorkflowOperation,workflowSha}=await import('/src/runtime/workflow-device-contract.ts');
  const device={installationId:'fixture-device',enrollmentId:'fixture-enrollment'};
  const spec={version:1,name:'Presentation',description:'',trigger:{kind:'manual'},device,steps:[{id:'input',kind:'Read',operation:'supplied_text',text:'Synthetic result'},{id:'notice',kind:'Notify',operation:'app_notification',source:'input',title:'Exact title'},{id:'speech',kind:'Speak',operation:'read_aloud',source:'input'}]};
  const expected={id:'run',workflowId:'workflow',versionId:'version'};
  const envelope=async(s:any)=>({...expected,runId:'run',spec:s,specDigest:await workflowSha(s),status:'waiting-approval',finished:false,cancellationRequestedAt:null});
  const review=await parseWorkflowPhoneReview(await envelope(spec),expected);
  const binding={runId:'run',workflowId:'workflow',versionId:'version',stepId:'notice',specDigest:review.specDigest};
  const notice={type:'post_notification',title:'Exact title',body:'Synthetic result'},speech={type:'speak_text',text:'Synthetic result'};
  assertWorkflowOperation(review,binding,device,notice);assertWorkflowOperation(review,{...binding,stepId:'speech'},device,speech);
  let rejected=0;const invalidSpecs=[{...spec,device:undefined},{...spec,steps:spec.steps.map(s=>s.id==='notice'?{...s,kind:'Write'}:s)},{...spec,steps:spec.steps.map(s=>s.id==='speech'?{...s,source:'later'}:s)},{...spec,steps:spec.steps.map(s=>s.id==='speech'?{...s,text:'Injected'}:s)},{...spec,steps:spec.steps.map(s=>s.id==='notice'?{...s,title:'x'.repeat(201)}:s)},{...spec,steps:spec.steps.map(s=>s.id==='notice'?{...s,title:'bad\0title'}:s)}];
  for(const bad of invalidSpecs){try{await parseWorkflowPhoneReview(await envelope(bad),expected);}catch{rejected++;}}
  const badOperations=[{...notice,title:'Different title'},{...notice,body:'x'.repeat(2001)},{...notice,body:'bad\0text'},{...notice,extra:'payload'},speech];
  for(const bad of badOperations){try{assertWorkflowOperation(review,binding,device,bad);}catch{rejected++;}}
  for(const bad of [{...binding,runId:'other'},{...binding,stepId:'speech'},{...binding,specDigest:'0'.repeat(64)}]){try{assertWorkflowOperation(review,bad,device,notice);}catch{rejected++;}}
  try{assertWorkflowOperation(review,binding,{...device,enrollmentId:'retired'},notice);}catch{rejected++;}
  try{await parseWorkflowPhoneReview({...await envelope(spec),specDigest:'0'.repeat(64)},expected);}catch{rejected++;}
  for(const text of ['x'.repeat(5001),'','bad\0text']){try{assertWorkflowOperation(review,{...binding,stepId:'speech'},device,{type:'speak_text',text});}catch{rejected++;}}
  return {kinds:normalizePhoneSpec(spec).steps.map(s=>s.kind),rejected};
 });expect(result).toEqual({kinds:['Read','Notify','Speak'],rejected:19});
});
