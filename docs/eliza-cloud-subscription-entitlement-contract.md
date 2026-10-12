# Eliza Cloud subscription entitlement: proposed contract (issue #410)

Status: proposal. This file describes the Alpha phone's side and what the Eliza Cloud server
must provide. The Cloud server work belongs to the Eliza Cloud repository and is not done here.
No price, plan allowance, entitlement lifetime or burst/sustained limit is chosen in this file.
Those values come from measured provider cost and pilot traffic, and the owner selects them.

Alpha source: `apps/app/src/runtime/subscription-entitlement.ts`, `cloud-protocol.ts`
(`subscriptionEntitlement`, `subscriptionEntitlementKeys`, `openSubscriptionManagement`) and
`connection-ui.tsx` (`admitCloudResident`). Tests: `test/subscription-entitlement.test.mjs` and
`test/browser/native-cloud-subscription.spec.ts`.

## Principles (policy P-26)

- Billing is a subscription with server-side rate limits. The phone shows no credit balance,
  top-up or per-token meter.
- An assistant turn never waits on a billing service. Cloud authorises each inference or Maps
  request from its own cached quota or token bucket.
- Local apps, on-device speech and local tools never depend on an online billing check.
- Nothing is purchased automatically: no overage purchase, upgrade or retry that spends money.

## 1. Entitlement read

`GET https://api.eliza.app/api/v1/subscription/entitlement`
with `Authorization: Bearer <the phone's Cloud CLI key>` and `Accept: application/json`.

- `200 {"entitlement": "<compact JWS>"}` returns the current entitlement. The JWS is at most
  8192 characters.
- `401` means the sign-in is invalid. The phone shows the sign-in action.
- `404`, `405` or `501` means the route is not deployed. The phone then uses the transitional
  account check (section 5).
- Any other status, or a transport failure, is a billing outage (section 4).

The phone reads the entitlement when the resident agent is admitted, then refreshes it in the
background. It never reads it once per turn.

### JWS header

`{"alg":"ES256","typ":"eliza-entitlement+jwt","kid":"<key id>"}`. The phone refuses any other
`alg` or `typ`, and any header that carries `crit`.

### Claims

| Claim | Required | Meaning |
|---|---|---|
| `iss` | yes | Exactly the Cloud API origin, `https://api.eliza.app` |
| `aud` | yes | `eliza-alpha-phone`, either as a string or inside an array |
| `sub` | yes | Cloud user id. It must equal `GET /api/v1/user` `data.id` |
| `org` | when the user has one | It must equal `data.organization_id`. When the user has none, omit it |
| `jti` | yes | Entitlement id, used for idempotent accounting and audit |
| `iat`, `exp` | yes | Times in epoch seconds. The phone allows at most 60 minutes from `iat` to `exp` (an engineering ceiling, not a billing value) and a clock skew of 60 seconds |
| `nbf` | no | Epoch seconds |
| `rfa` | no | Suggested refresh time in epoch seconds, between `iat` and `exp`. Without it, the phone refreshes after 75% of the lifetime |
| `plan` | yes | `{id, name, status}` with `status` one of `active`, `trialing`, `past_due`, `canceled`, `none` |
| `allowance` | no | `{unit: "requests"|"tokens", period: "day"|"week"|"month", limit?: int, used?: int, resetsAt?: epoch seconds}`. The phone shows only the numbers that are present |
| `services` | no | The managed services covered, e.g. `["inference","maps"]` |

The phone verifies the signature before it trusts any claim.

## 2. Verification keys

`GET https://api.eliza.app/api/v1/subscription/entitlement-keys` (no authentication) returns
`{"keys":[JWK,...]}`, at most 16 keys. Each key is a public EC P-256 key with `kid`, `x` and `y`,
and never `d`. The phone caches the keys per issuer for one hour. It fetches them again when an
entitlement names an unknown `kid`, which makes key rotation safe.

## 3. Enforcement and usage (server only)

- Inference (`/api/v1` OpenAI-compatible, used by the resident agent through
  `ELIZAOS_CLOUD_BASE_URL`) and Maps check the caller's quota against a server-side cache or
  token bucket. These checks must not add a synchronous request to the billing service on each
  call.
- Usage is sent asynchronously, keyed by request id, so accounting stays idempotent.
- Revocation takes effect on the server immediately. The phone shows it on its next refresh.
- The phone does not send the entitlement with inference requests. At the pinned revision, the
  upstream `@elizaos/plugin-elizacloud` OpenAI client adds only `Idempotency-Key` and the
  native-application slot headers (`applyNativeApplicationInferenceHeaders` in
  `@elizaos/cloud-sdk`). It has no hook for an entitlement. If Cloud later wants the token on
  each request, that hook must be added upstream first. Cloud can key usage records on the
  `Idempotency-Key` that the client already sends when it has an operation id.

### Refusal bodies

The native transport returns the status and the JSON body only. It does not return headers, so
Cloud must also put any `Retry-After` value in the body:

| Situation | Status | Body |
|---|---|---|
| Burst or sustained rate limit | 429 | `{"error":"rate_limited","retryAfterSeconds":N}` (or `retryAfterMs`, or `retryAt` as ISO time) |
| Period allowance used up | 429 | `{"error":{"code":"allowance_exhausted","resetsAt":"<ISO>"}}` |
| No active plan | 402 | `{"error":"subscription_required"}` |

When the resident agent's reply arrives as a failure, the same values may appear in
`failureKind` or `terminalFailure` (`kind`, `retryAfterMs`, `retryAfterSeconds`, `retryAt` and
`resetsAt`). The phone tells the owner when to retry. It never retries the message or buys
anything.

## 4. Phone behaviour by condition

| Condition | Phone result | Agent admitted |
|---|---|---|
| Valid entitlement, plan `active`, `trialing` or `past_due` | Plan name and the Cloud allowance. For `past_due`, also a link to manage the plan | yes |
| Valid entitlement, plan `canceled` or `none` | "No active plan" or "<plan> has ended", with a link to manage the plan in Eliza Cloud. Local apps stay available without AI | no |
| Billing outage (5xx, timeout, offline) | "Plan status unavailable"; Cloud still decides each request | yes |
| Bad signature, unknown key or bad claims | Reported as unavailable (`invalid`) and never trusted | yes |
| Entitlement issued for another account | An error asking the owner to sign in again | no |
| A verified entitlement lapses while refreshes fail | "Plan status is out of date" (`expired`) | unchanged; Cloud decides |
| Sign-in rejected (401) | Sign-in action | no |

Background refresh happens at `rfa`, or after 75% of the lifetime. After a failure it retries
after 30 s, then doubles the wait up to 5 minutes. It stops on sign-out, on a plan with no access,
or when Cloud returns 404 for the route.

## 5. Transitional account check

Until Cloud deploys section 1, a `404` sends the phone to the existing
`GET /api/v1/credits/balance` endpoint. A balance of zero or less is treated only as "no active
plan". The phone never shows the balance. Remove this path once the entitlement route ships.

## 6. Plan management

"Manage plan in Eliza Cloud" opens Cloud's hosted page at `https://cloud.eliza.app/cloud/billing`
in the system browser. The phone creates no checkout, upgrade or purchase.

## Gates that remain open

- Eliza Cloud has not implemented sections 1 to 3: entitlement issuance, signing keys, cached
  quotas and token buckets, asynchronous idempotent usage records, or refusal bodies.
- No p50/p95 latency benchmark has been run under the normal, cache-miss, exhausted, expired and
  billing-outage conditions. It needs the deployed Cloud.
- The numeric burst and sustained limits, the allowance and the price are not selected. They must
  be proposed from measured provider cost and pilot traffic, and the owner decides them.
- No real Cloud account, Android device or AOSP image was used for acceptance.
