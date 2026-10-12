// Cloud provider admission (AP-04). Host-JVM run of the Capacitor-free LocalAgentProviderAdmission
// with synthetic credentials, plus a source check that the plugin delegates to it. Not Android,
// network or real-account evidence. Inference stays qwen-3.8-27b on Cerebras.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeSource,fixture,runJvm,jsonJarSkip} from './fixtures/jvm-tools.mjs';

test('Cloud and direct environments, expiry, credential match, identity and rollback',{skip:jsonJarSkip},()=>{
 assert.match(runJvm([nativeSource('LocalAgentProviderAdmission.java'),fixture('LocalAgentProviderAdmissionTest.java')],'ai.elizaresearch.alphaphone.LocalAgentProviderAdmissionTest',{json:true}),/^PASS local agent provider admission/);
});

test('the plugin delegates provider rules to the admission class and keeps the A-20 direct route',()=>{
 const source=readFileSync(nativeSource('AlphaLocalAgentPlugin.java'),'utf8');
 assert.match(source,/static void applyProviderEnvironment\([^)]*\) throws Exception \{LocalAgentProviderAdmission\.applyProviderEnvironment\(provider,cloudSaved,env,now\);\}/);
 assert.match(source,/static String cloudProviderToken\([^)]*\) throws Exception \{return LocalAgentProviderAdmission\.cloudProviderToken\(saved,credentialId,now\);\}/);
 assert.match(source,/LocalAgentProviderAdmission\.bindCloudProvider\(new LocalAgentProviderAdmission\.CloudBindingStore\(\)\{/);
 assert.match(source,/LocalAgentProviderAdmission\.providerStatus\(saved,cloud,System\.currentTimeMillis\(\)\)/);
 assert.doesNotMatch(source,/env\.put\("ELIZAOS_CLOUD_API_KEY"|env\.put\("CEREBRAS_API_KEY"/,'no provider environment is built in the plugin');
 assert.match(source,/static final String CLOUD_PROVIDER_MODEL=LocalAgentProviderAdmission\.CLOUD_PROVIDER_MODEL;/);
 const admission=readFileSync(nativeSource('LocalAgentProviderAdmission.java'),'utf8');
 assert.doesNotMatch(admission,/com\.getcapacitor|android\./,'the admission class is host-testable');
 assert.match(admission,/CEREBRAS_PROVIDER_MODEL="qwen-3\.8-27b"/);
 assert.match(admission,/CLOUD_PROVIDER_MODEL="cerebras\/qwen-3\.8-27b"/);
 const direct=source.slice(source.indexOf('* Direct Cerebras key'),source.indexOf('@PluginMethod public void clearProvider('));
 assert.match(direct,/decision A-20/);
 assert.match(direct,/if\(!runtimePackaged\(\)\)/);
 assert.doesNotMatch(direct,/ELIZA_DEV_ALLOW_TEST_MOCKS\)/,'the retained direct profile is not gated on test mocks (A-20)');
});
