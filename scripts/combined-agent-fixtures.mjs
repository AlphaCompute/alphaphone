/** Synthetic, product-owned workflows for both combined-agent campaigns. */
export const arithmetic=`/** @jsxImportSource smthrs */
import {createSmithers} from 'smthrs/create';import {z} from 'zod';
const {Workflow,Task,smithers,outputs}=createSmithers({answer:z.object({value:z.number()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});
export default smithers(()=><Workflow name="alpha-combined"><Task id="answer" output={outputs.answer}>{{value:7*8}}</Task></Workflow>);`;
export const approvalSource=effect=>`/** @jsxImportSource smthrs */
import {appendFileSync} from 'node:fs';import {createSmithers} from 'smthrs/create';import {approvalDecisionSchema} from 'smthrs';import {z} from 'zod';
const {Workflow,Sequence,Approval,Task,smithers,outputs}=createSmithers({decision:approvalDecisionSchema,output:z.object({message:z.string()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});
export default smithers(()=><Workflow name="alpha-combined-approval"><Sequence><Approval id="write-fixture" output={outputs.decision} request={{title:'Write synthetic fixture?',summary:'Append one synthetic line to a test-owned temporary file.',metadata:{alphaPhone:{operation:'Append synthetic fixture line',target:'Test-owned temporary file',account:'Isolated local fixture owner'}}}}/><Task id="effect" output={outputs.output} noRetry sideEffect={true}>{()=>{appendFileSync(${JSON.stringify(effect)},'combined-effect\\n');return {message:'Explicitly approved fixture'};}}</Task></Sequence></Workflow>);`;
