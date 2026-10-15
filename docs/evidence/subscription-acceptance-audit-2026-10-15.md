# Subscription acceptance audit — 2026-10-15

Issue [#410](https://github.com/AlphaCompute/alphaphone/issues/410) remains open. The phone has subscription state, signed-entitlement verification, background refresh, account binding, offline behavior and typed retry waits. This audit adds a **local lower-bound latency measurement**, not Cloud deployment, Android audio, real-account, or pricing acceptance.

## Sources and execution boundary

Alpha source reviewed: `7ef6fa84e71e3d49c87cb62213c33c729cd51129` in [PR #537](https://github.com/AlphaCompute/alphaphone/pull/537). Upstream source tested: `1a5a05db0c80dceeff528d3b70c1724cf84ea153`, the isolated Maps relay candidate reviewed in [elizaOS/eliza #36303](https://github.com/elizaOS/eliza/pull/36303). These were review candidates when this evidence was recorded; the measurement does not prove either was deployed.

[Raw measurements and source/harness hashes](subscription-latency-local-2026-10-15.json) record the existing `packages/cloud/scripts/plan-request-limit-latency.ts` harness, run with Bun 1.4.2 on Linux x64. The harness explicitly selects in-memory PGlite and a synthetic organization. No provider request, purchase, account credential, or live billing mutation was used. Cached dependency packages were reused with workspace exports pointed to the checked-out source; a clean dependency installation was not performed.

The raw log, unchanged result JSON, exact harness and SHA-256 manifest are also archived locally at `/home/shaw/Android/alpha-qualification/2026-10-15-entitlement`. The committed JSON records those hashes.

The harness times 20,000 limiter-stage calls per condition and 400 end-to-end calls per comparison, after warmup. End-to-end here means `enforceOrgRateLimit` plus **in-process PGlite**, not an HTTP inference turn. Values are milliseconds, rounded to 0.001 ms.

| Condition | Limiter enabled p50 | Limiter enabled p95 |
| --- | ---: | ---: |
| Normal | 1.122 | 1.179 |
| Cache miss | 1.100 | 1.133 |
| Exhausted | 0.001 | 0.003 |
| Expired policy | 1.161 | 1.236 |
| Billing outage, exhausted request refusal | 0.001 | 0.003 |

The exhausted case refuses before the policy transaction. The expired case measures the existing stale-policy fence, not successful admission. Billing-outage refusal does not prove an otherwise admissible request can continue through an unavailable database. Some enabled-minus-disabled differences are negative: sequential runs and local timing noise do not establish a production speedup. The limiter-only sub-microsecond readings rounded to zero do not mean zero execution cost. Synthetic benchmark limits are **not selected product limits**.

## Acceptance by requirement

| #410 requirement | Source evidence | Remaining acceptance |
| --- | --- | --- |
| Signed entitlement, account binding, refresh and expiry/outage behavior | Alpha `apps/app/src/runtime/subscription-entitlement.ts`, `connection-ui.tsx`, `test/subscription-entitlement.test.mjs`; upstream `subscription-entitlement-token.ts` issues ES256 tokens from configured secrets | Verify deployed issuer/key rotation, production/staging configuration, actual account revocation propagation and real-account sign-in/redemption. Local source does not establish deployment. |
| Cached inference/Maps limits and asynchronous idempotent usage | Inference has cached admission projections, revision-aware admission and deterministic settlement; Maps has plan-specific isolate-local buckets and a per-credential route limiter | Maps still reads primary plan authority per request. Its handler has no usage-accounting emission or shared organization Maps bucket. Per-isolate buckets are not a global allowance. |
| Subscription UI, allowance and retry information, no automatic overage | Alpha entitlement and subscription browser tests cover these controls; live resident retry duration handling was added in #533 | Real account/provider refusals remain to be exercised. A period allowance reset timestamp is not currently part of the resident terminal-failure contract; direct HTTP reset timestamps are supported. |
| Added p50/p95 across five conditions without blocking audio | Local harness above runs all five conditions | Measure deployed cold/warm paths, cache misses, exhaustion, expiry and outage with actual network/database costs; measure concurrent Android capture/playback and interruption. This harness has no audio pipeline. |
| Propose prices and burst/sustained allowances from measured cost and pilot traffic | Limiter configuration explicitly distinguishes unselected benchmark values | Provider cost data, pilot workload, cross-service allowance policy and owner-selected prices/limits remain absent. No values are selected here. |

## Maps implementation boundary

All upstream paths below are at the tested `1a5a05db0c80dceeff528d3b70c1724cf84ea153` commit:

- [`packages/cloud/api/src/lib/maps-route.ts`](https://github.com/elizaOS/eliza/blob/1a5a05db0c80dceeff528d3b70c1724cf84ea153/packages/cloud/api/src/lib/maps-route.ts) authenticates, reads the plan summary, consumes local plan buckets and calls the provider. It does not emit a usage/accounting event. Its admission hook supplies organization, user, operation, plan key and effective end; it has no accounting/settlement contract.
- [`subscription-entitlement-token.ts`](https://github.com/elizaOS/eliza/blob/1a5a05db0c80dceeff528d3b70c1724cf84ea153/packages/cloud/shared/src/lib/services/subscription-entitlement-token.ts) implements `readOrganizationEntitlementSummary` with a primary database transaction. Replacing that authority read with an arbitrary TTL would weaken revocation and expiry guarantees.
- [`plan-request-limiter.ts`](https://github.com/elizaOS/eliza/blob/1a5a05db0c80dceeff528d3b70c1724cf84ea153/packages/cloud/shared/src/lib/services/plan-request-limiter.ts) already separates inference and Maps buckets. Its comments explicitly document isolate-local capacity, eviction refill, Maps' lack of shared organization authority, and the limiter being disabled when configuration is absent.
- [`inference-admission-snapshot.ts`](https://github.com/elizaOS/eliza/blob/1a5a05db0c80dceeff528d3b70c1724cf84ea153/packages/cloud/shared/src/lib/services/inference-admission-snapshot.ts) and [`generative-route-auth.ts`](https://github.com/elizaOS/eliza/blob/1a5a05db0c80dceeff528d3b70c1724cf84ea153/packages/cloud/api/src/lib/generative-route-auth.ts) provide reusable cache-warming, identity and revision-aware admission patterns. They carry inference funding/balance policy as well as rate limits; they are not a drop-in Maps authorization cache.
- [`org-rate-limits.ts`](https://github.com/elizaOS/eliza/blob/1a5a05db0c80dceeff528d3b70c1724cf84ea153/packages/cloud/shared/src/lib/services/org-rate-limits.ts) defines only `completions`, `embeddings`, `standard` and `strict` shared endpoint buckets. Assigning Maps to `standard`, or adding a new shared bucket, requires an explicit cross-service quota contract.
- [`organization-inference-admission.ts`](https://github.com/elizaOS/eliza/blob/1a5a05db0c80dceeff528d3b70c1724cf84ea153/packages/cloud/shared/src/lib/services/organization-inference-admission.ts) offers idempotent settlement patterns, but requires a billing context, request identity and token estimates or a provider-priced flat cost. Treating a Maps request as a zero-cost inference or inventing a flat price would not establish correct Maps accounting.

Before implementing that integration, establish: whether Maps usage is observational or consumes the subscription allowance; which operations and failed/cancelled/provider-unknown outcomes count; the server request/event identity and retry/deduplication boundary; how Maps shares or separates organization limits; and the revocation-consistent cached authority contract. Numeric policy remains owner-selected. These are separate from routine transport and UI fixes.

Once that contract exists, the testable implementation is a shared-authority Maps admission adapter plus asynchronous durable usage emission. Tests must cover the same account across multiple isolates, repeated event delivery, request retries, revoked/expired policy, cache warming/outage, cancellation and unknown provider outcomes. Existing rate-limit and settlement tests provide patterns; they do not currently prove those Maps cases.
