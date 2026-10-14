import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

/**
 * The development browser bridge's adapter for Eliza Cloud's in-app email sign-in code. Routes and
 * body shapes come only from config/cloud-email-code.json, which android CloudEmailCode.java mirrors
 * (test/cloud-sign-in-flow.test.mjs pins both). No magic link, no hosted page.
 */
export const CLOUD_EMAIL_CODE=JSON.parse(readFileSync(new URL('../config/cloud-email-code.json',import.meta.url),'utf8')) as {sendPath:string;verifyPath:string;tenant:string;client:string};
export function emailCodeSendBody(email:string,verifier:string){
 return {email,tenantId:CLOUD_EMAIL_CODE.tenant,client:CLOUD_EMAIL_CODE.client,pkce:{codeChallenge:createHash('sha256').update(verifier).digest('base64url'),codeChallengeMethod:'S256'}};
}
export function emailCodeVerifyBody(email:string,code:string,verifier:string){
 return {email,code,tenantId:CLOUD_EMAIL_CODE.tenant,client:CLOUD_EMAIL_CODE.client,pkce:{codeVerifier:verifier}};
}
/** The server's expiresAt when present, never later than 15 minutes; 10 minutes when absent. */
export function emailCodeExpiresAt(reported:unknown,now=Date.now()){
 const value=typeof reported==='number'?reported:typeof reported==='string'?Date.parse(reported):NaN;
 return Number.isFinite(value)&&value>0?Math.min(value,now+15*60*1000):now+10*60*1000;
}
