import { loadPinnedRuntime } from './loader';
const {module,head,dataDir}=await loadPinnedRuntime();
await module.run({head,mode:process.argv.includes('--test-seed')?'seed':process.argv.includes('--test-recover')?'recover':process.argv.includes('--test-proposal')?'proposal':'smoke',dataDir});
