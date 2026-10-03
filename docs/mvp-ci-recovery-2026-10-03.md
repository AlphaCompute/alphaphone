# MVP discovery and Android provisioning recovery — October 3

## Product and flow changes

The legacy development host advertised Phone, SMS and Contacts even though the phone MVP renderer refused them. Its native debug bridge also accepted those proposals. A shared approved-view contract now governs the host tool schema, host response validation, Eliza proposal action and renderer transport. Native validation uses the same list, checked for parity. Assistant, Apps and Passwords are not executable proposal routes; password-provider setup remains in Settings. The intentional browser simulator profile remains unchanged.

The actual loopback request journey uses a synthetic HTTPS provider inside the child process: thirteen supported routes produce reviewable proposals, seven unsupported/deferred routes produce none. Existing approval, stale-context, replay and reminder checks remain. The combined scope change passes 164 repository checks and 29 rendered MVP flows. Native Java compilation and source parity are narrower evidence than installed Android execution.

The hosted Calendar failure was an assertion race. Saving an event commits before acknowledging its creation receipt. The previous test inspected the receipt immediately after observing the event. A controlled acknowledgement hold reproduced the exact failure. The corrected test waits for the actual completion UI; the new delayed flow verifies two events/two pending receipts while held, no premature success, then only the new receipt acknowledged and the old unresolved receipt preserved. Eleven recovery flows and six repeated targeted executions pass. Product behavior and deadlines are unchanged.

## Android boot-device finding

Diagnostic f506d23/run37097102302 captured boot_devices containing PCI03.0 and PCI06.0, while userdata vdc resolved to PCI05.0. The userdata by-name alias was missing before every postboot helper and scratch did not survive reboot. The two runs used emulator37.2.12.0/build16428233 and the same admitted API35 image.

The official emulator source supports `-append-userspace-opt` overrides before it emits bootconfig. Trial71cee32/run37097983752 supplied the captured three-controller list and required exact bootconfig, property, sysfs and preexisting-alias readback. The second checkpoint, before remount or alias handling, shows scratch254:5, /mnt/scratch mounted as f2fs, and overlays already mounted for product/vendor/system/system_ext/system_dlkm. There was one post-disable-verity reboot, zero ln commands, and remount returned success without requesting another reboot.

The diagnostic deliberately failed at its refusal to stop the framework for provider replacement. Stock provider replacement and native browser execution did not occur. This proves the observed boot-persistence correction on the disposable fixture, not provider or production image acceptance. The unavailable lpdump observation does not establish whether its path, format or read access was the cause.

Foundation adopts the same emulator option, checks the exact boot identity before download and after reboot, and refuses a missing alias instead of creating it late. Provider hashes/signers, resource floors, exact image/mapper identity, and the repeated-reboot refusal remain enforced. Boot readbacks retain only relevant fields under explicit bounds.

Primary source: [emulator boot-property construction](https://android.googlesource.com/platform/external/qemu/+/ae9d18d2b6261179fbd57fffec720a04f7bfb053/android/android-emu/android/userspace-boot-properties.cpp), [bootconfig handoff](https://android.googlesource.com/platform/external/qemu/+/ae9d18d2b6261179fbd57fffec720a04f7bfb053/android-qemu2-glue/main.cpp). This source revision explains the mechanism; the actual hosted readback verifies the installed emulator behavior.

## Qualification boundaries

At exact c7eadc8, the PR browser run37096809521 passes972 cases with4 explicit skips. The separate push37096808130 fails the Calendar race described above. Both Foundation builds pass, but smoke runs37096809417 and37096808102 fail at repeated remount; neither reaches full native smoke. Resident37096808143 remains independently active at this checkpoint. Historical running statuses are not terminal acceptance.

The combined composition passes168 repository checks, typecheck and production build with all3,769 source-file identities unchanged through qualification before this documentation result was added. Thirty-nine provider/alias/boot checks and workflow lint also pass. The first combined verification failed with ENOSPC during temporary source checkout; the unchanged retry passed after free capacity recovered. Both attempts remain recorded in test-results/combined-scope-boot-c7. The new composition needs fresh hosted build/native qualification. Local disk fell below1GiB, so no new full Android build is claimed for the scope change. Existing c7 APKs and earlier native evidence remain preserved and do not qualify changed source. The installed Pixel still has the earlier e4 standalone build; visible upgrade checks, live integrations, physical speech/alarms/latency, signed AOSP and user/device acceptance remain open.

Evidence: test-results/mvp-development-scope-c7, test-results/browser-c7-calendar-ack, test-results/candidate-e4d-ci-audit/overlay-diagnostic-71cee, and test-results/foundation-bootdevice-fix-v2 and its bounded-retention follow-up test-results/foundation-bootdevice-fix-v3. The MVP remains incomplete.
