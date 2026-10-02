# Resident recovery qualification — October 2

This candidate combines product `54a8229d3c5cdb5f61fc54ba28d8d5132e409513` with resident candidate `52ab225f745c8c49b83e2cda83540e8cdb4eecbc`. Later concurrent product work is separate. All nine resident patch bytes and runtime identities are preserved. Independent replay verified nine patch hashes and 25 composed runtime source hashes.

## Observed failures and repairs

- Foundation 52ab built both distributions but refused Android’s explicit successful-remount reboot request. The repair allows one authenticated additional overlay activation reboot and retains provider, stock backup, scratch identity/size and final readiness checks. Sixteen supervisor flows pass.
- Resident run 37064574354 built and archived both distributions successfully. Its native phase failed before the private-peer positive control because API 35 rejects `LocalSocket.connect(address, timeout)`. Both fixture callers now initialize the descriptor with `getInputStream()` (no read), set the two-second timeout, then use supported one-argument connect. An initial proposed repair omitted descriptor initialization; independent review rejected it before publication. Both classes compile.
- A synthetic API 35 probe on the dedicated ARM64 Pixel 9 verified both former API failures, corrected same-UID byte transfer and a full-backlog timeout of 2006 ms. The first filesystem probe was refused by SELinux; protections were retained and its owned files removed. The successful abstract-socket probe does not prove filesystem or cross-UID isolation. The unchanged full private-peer assertions require a new hosted native result.
- Hosted recovery stopped before its first method because ActivityManager switched users before keyguard binding. The first local retry then exposed a separate PowerManager/secondary-user idle-policy race. The revised guard waits read-only for exact keyguard and power user bindings, requires known unsecured state, configures only the owned disposable user’s 40-minute timeout with readback, and permits at most two wakes in the original 30-observation budget. Captured-state and refusal flows pass; actual retry is pending.

## Evidence and limits

The combined product and WebView repair passed `npm run verify`; all 3,740 tracked source files matched the tested tree. Reading/password-provider code previously passed 84 combined rendered flows and 10 final provider flows. Runtime patches and the 18 product file hashes remain guarded during composition. Subsequent fixture-only changes have Java compilation, owning Python checks and the bounded actual Android API result described above.

The complete 52ab resident archive SHA256 is `fa1f75189423e8e8c96e32fb773f7462983c7fdc3e2c32ea6e636d20719d312a`. Its APK hashes/signers, generated native provenance and exact source were verified before the dedicated Pixel campaign. Local harness overlays are recorded separately; APK bytes remain 52ab. Neither a successful build nor this API probe is full native, live-provider, signed-AOSP, physical-device or user acceptance. The MVP remains incomplete.

Local evidence: `test-results/resident-ci-staging/reading-provider-combined/`, `test-results/resident-52ab-native-failure/`, `test-results/recovery-display-binding-fix/`, `test-results/recovery-secondary-idle-fix/`, and `test-results/pixel-visible-52ab/`.
