import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runJvm} from './fixtures/jvm-tools.mjs';
test('native approval access admits only the exact owned GET, never mutation or query variants',()=>{
 const source=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','utf8');
 const method=source.match(/ static boolean calendarApprovalReadAllowed\([^\n]+/)[0];
 assert.match(source,/approvalRead=calendarApprovalReadAllowed\(path,method,expectedOwner\)/);assert.match(source,/\(!approvalRead&&!path\.matches/);
 const dir=mkdtempSync(join(tmpdir(),'alpha-approval-route-'));try{const file=join(dir,'CalendarApprovalRouteFixture.java');writeFileSync(file,`public class CalendarApprovalRouteFixture{${method}public static void main(String[] args){String path="/api/approvals?state=all&limit=500";if(!calendarApprovalReadAllowed(path,"GET","owner"))throw new AssertionError();for(String verb:new String[]{"POST","PUT","DELETE"})if(calendarApprovalReadAllowed(path,verb,"owner"))throw new AssertionError();for(String owner:new String[]{null,""," "})if(calendarApprovalReadAllowed(path,"GET",owner))throw new AssertionError();for(String bad:new String[]{"/api/approvals","/api/approvals/execute",path+"&x=1",path.replace("500","501"),"https://example.invalid"+path})if(calendarApprovalReadAllowed(bad,"GET","owner"))throw new AssertionError();System.out.println("PASS read-only owner route");}}`);assert.match(runJvm([file],'CalendarApprovalRouteFixture'),/PASS read-only/);}finally{rmSync(dir,{recursive:true,force:true});}
});
