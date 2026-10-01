# Architecture and product decisions

October 1 architecture change: the user has selected an **Android-resident agent instead of Nitro/TEE hosting**. The [on-device agent plan](on-device-agent-plan.md) supersedes cloud-only and enclave-primary requirements below. Agent execution and model inference are separate decisions; inference placement remains pending. Historical evidence is retained. Powered-off-phone execution needs explicit scope reconciliation.

## Accepted foundation decisions

1. Keep Alpha Phone and senior-care independent: separate repository, application ID, renderer, assets and release stream.
2. Use a pinned Eliza source submodule while upstream consumer exports stabilize. The complete imported `base/eliza-app` remains immutable and hash-verified. Avoid publishing every workspace package before testing the actual dependency closure.
3. Compile Eliza's real system plugin into a local bundled Capacitor shell. Cloud runtime pairing is explicit future work; the current composer never reports a successful send.
4. Use standalone and launcher product flavors with the same Alpha identity. Switching flavor replaces the installed Alpha app. Senior-care has a different identity and can coexist.
5. Make AOSP installation additive, nonprivileged and certificate/hash verified. Device provisioning chooses default HOME. Keep system recovery paths available.
6. Preserve the prototype's brand and layout direction while labeling data and agent capabilities honestly. Do not port mocked transfers, account linking or generated success messages.

## Open decisions

| ID | Decision needed | Proposed accountable role | Blocks / evidence required |
| --- | --- | --- | --- |
| A-01 | Exact phone SKU, Android version and distribution | Mobile/release | Full OS image; supported device tree, proprietary artifacts, clean build and hardware matrix |
| A-02 | Approved managed Alpha endpoint and owner/agent pairing | Runtime/security | Connected chat; correct-account, wrong-origin, revoke/reconnect tests |
| A-03 | MVP views and native default roles | Product/mobile | Prioritized real modules; permission and emergency/system access matrix |
| A-04 | Voice provider, processing location, mic and retention policy | Voice/privacy | Real voice; interruption, denied permission and sensitive-data evidence |
| A-05 | Background notification and reconnect policy | Mobile/runtime | Missed events exactly once across suspend/restart and account changes |
| A-06 | Signing, update authority and support/rollback owner | Release/security | Signed distribution and OTA; protected keys, recovery drill and explicit operator |
| A-07 | Initial account providers and read/write scopes | Integrations/product | Real overview/inbox/calendar data; official consent, revoke and stale-cache handling |
| A-08 | Wallet deferral or separately funded scope | Product/security | No wallet work until custody/provider/hardware and transaction approval are specified |

All open entries require a named owner, chosen approach, evidence and date. Hardware names in upstream issues or the prototype are not a supported-device commitment. Refer to `implementation-plan.md` for dependencies and acceptance tests.
