import {runReminderRecovery} from './reminder-recovery-fixture.mjs';
const [appApk,testApk,output='test-results/reminder-recurrence-recovery']=process.argv.slice(2);
await runReminderRecovery(true,appApk,testApk,output);
