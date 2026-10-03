# Reminder recovery, Clock consent and native storage isolation

This candidate continues the MVP completion plan. It does not close Android, AOSP-image, live-service or physical-device acceptance.

## Changes

Reminder notification body taps now retain an opaque token in encrypted native storage before renderer navigation. Each token binds the exact local source, reminder, occurrence and record revision. Failed reads and ordinary process death retain the route. Explicit stale-link dismissal unblocks older queued routes; it does not complete a reminder. The renderer waits for safe foreground navigation and retries after the connection chooser closes. A deliberate repost after consumption receives a fresh token; old tokens cannot revive. Acknowledged entries are reclaimed only after their exact OS notification is absent. The 512 outstanding-route bound fails closed; recovery from all entries being unacknowledged remains a documented limitation.

Agent Clock actions use the existing durable action journal plus native owner confirmation. Set can create an alarm immediately, so consent says so. Targetless agent snooze/dismiss opens Clock for manual target selection and does not issue global snooze/dismiss intents. Dispatch is not proof of alarm creation, ringing or manual completion. Cancellation and owner retirement wait for native acknowledgment; a failed acknowledgment remains registered until an explicit retry succeeds. Activity destruction retires native callbacks.

The generic renderer credential bridge denies ten native authority namespaces across read, write, compare-exchange and remove. Trusted native storage access remains available. Android renderer digest fallback uses its own namespace. Existing native-slot contents are not retrospectively authenticated: historical provenance/migration remains a separate release consideration, with no silent history deletion.

## Evidence and remaining gates

Parent-composed TypeScript passes. All 29 rendered Clock/reminder flows pass on the integrated source, including chooser-close recovery, exact reminder target matching, stale dismissal, navigation races and failed Clock cancellation followed by explicit successful retirement. These tests control native boundaries; they do not prove Android effects.

Evidence packets are retained under `test-results/clock-agent-review-c7`, `test-results/reminder-tap-recovery-7e`, `test-results/reminder-tap-review-addendum` and `test-results/native-slot-isolation-7e`. Original packets and follow-on corrections are separately hashed; failed attempts remain retained. Parent composed results: `test-results/reminder-tap-review-addendum/parent-composed-rendered.log`.

New Android fixtures cover reminder capture across exact main-process death, reminder lifecycle/reposting, native credential bridge denial and native Clock review/cancel/recreation. They must execute on both distributions with fresh owned users and verified cleanup. Clock interception does not replace actual alarm set/ring/snooze/dismiss, reboot, time-zone or physical audible-output acceptance. Full repository verification and Android builds for this composed candidate remain pending.

The first parent full verification attempt ran 221 checks: 217 passed and four failed. Two isolated VM harnesses omitted newly imported lifecycle dependencies; the actual local digest flow also exposed a namespace routing mismatch. Those corrections require requalification. The generated secure-store check separately failed while cloning its temporary source because the local disk was full. No full verification/build success is claimed for this candidate. Native recovery CI now requires all 16 exact methods for both distributions; parent supervisor scenarios pass, while actual Android execution remains pending. Computer Use was rechecked and still reports the Mac locked.

The three source/fixture failures above were corrected and rerun individually on the composed source: actual filesystem digest persistence with lost acknowledgments and namespace isolation, reminder DST scheduling with subscription teardown, and real controller/loopback Cloud history with held Clock retirement acknowledgment all pass. The disk-dependent temporary runtime clone has not been rerun locally. Complete hosted verification and both Android distribution builds remain required for this candidate.
