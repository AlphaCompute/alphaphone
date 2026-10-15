# Independent Listening chip: development source candidate

Issue #424 and ADR 0001 require an indicator independent of listener self-report
and the normal AppOps privacy animation. This source candidate connects the
listener's existing Pause capability to a product-owned SystemUI recording-state
monitor and separate status-bar/keyguard views. It is **not qualified** and does
not complete G3. No SystemUI compilation, image build, boot or device test is
recorded. The actual pinned AOSP source is unchanged.

## Trust and data flow

`AlphaListeningController` is a SystemUI `CoreStartable`, bound in the existing
privacy Dagger module. It registers an `AudioManager.AudioRecordingCallback` and
reads active recording configurations on startup. The pinned SystemUI already
requests `MODIFY_AUDIO_ROUTING`; no permission is added. Visibility comes from
an unsilenced platform recording configuration for the verified sense UID, not
from a notification, broadcast, service status, transcript or app-provided UID.

Before attribution, the monitor requires the foreground primary user, a normal
application UID in user 0, system/privileged installation, one current APK signer
matching the image-generated certificate resource, matching Alpha/sense signatures,
and an unambiguous single package for that UID. The generated resource comes only
from the listener signer already admitted by `stageListener`; its unconfigured
default is empty and admits nothing. Package changes trigger fresh checks. User
switching clears state and prevents admission until the current user is settled.
Unknown isolated or shared UIDs are refused; ADR 0001 has no isolated capture
process today. Adding one requires a reviewed platform ownership mapping.

The monitor receives metadata only. It never reads audio, transcript, model state,
or the listener's signature-protected control provider. PCM capture and recognition
stay in their existing processes.

## Pause capability

`ListenerNotifications` marks only the existing Pause action with a versioned
action extra. Resume, Turn off and notification dismissal are never marked.
The existing token is an immutable broadcast PendingIntent to the non-exported
`ListenerActionReceiver`; the receiver and provider permissions are unchanged.

On a user tap, SystemUI rechecks capture and identity, reads its existing
NotificationListener's active notifications, and requires all of:

- The expected sense package, verified UID, active notification ID and channel.
- Exactly one matching marked action, from that same creator UID/package.
- An immutable broadcast token that does not request unlock.
- The exact Pause action and explicit listener receiver, with no data, ClipData
  or extras in the underlying Intent.

SystemUI sends the token without fill-in data. It does not invoke Resume or call
the control provider. Successful token delivery does not immediately hide the
chip: the platform must report that recording has stopped. A missing, ambiguous,
canceled or invalid token is refused and the view announces that Pause is
unavailable. No capture state or audio is transferred by this action.

## Surfaces and remaining blockers

The status-bar view is a sibling of ordinary status-bar contents, outside their
clock/notification disable flags. The keyguard view is a separate sibling of the
rotating indication area in `DefaultIndicationAreaSection`, so battery, biometric
and transient text do not replace its content. It follows the existing keyguard
indication burn-in X/Y flows. The fixed text is “Listening · Pause”; no transcript
appears on the lock screen. Strings are product-owned resources.

These are source hooks, **not proof of persistent visibility**. In particular:

- No SystemUI-health/visible-surface lease is implemented. SystemUI death, an
  invisible/detached parent, an occluding window or a missing view does not yet
  force the listener to stop. This is a release blocker; the existing foreground
  notification checks are not a substitute for this independent guarantee.
- Immersive status-bar hiding, the selected keyguard blueprint/scene flags,
  notification shade/QS coverage, doze scheduling, AOD burn-in behavior and tap
  handling need image tests. Layout/cutout overlap and large-font behavior are
  unqualified. This candidate does not override emergency, camera or power gestures.
- Identity failure refuses attribution and Pause, but does not remotely stop a
  recording listener. The health protocol must fail closed if the required
  indicator cannot be trusted or displayed, without granting a resume capability.
- Native SystemUI compilation and Android tests of recording callback ordering,
  package replacement, user switch, token selection and view disposal remain open.

The next health protocol should use a narrow signed-image trust contract with
short monotonic leases and generation-bound visible-surface acknowledgements.
The listener must release capture on lease loss, before-unlock restart, or invalid
controller identity. Acknowledgement must be from SystemUI after effective view
visibility is established, not merely from a live process. It must carry no audio,
transcripts, consent grants or resume command. This protocol is not implemented by
the current patch and must receive independent review before release.

## Exact source application

The optional chip bundle is separate from the microphone-op patch in
[SystemUI source preparation](aosp-listener-systemui.md). Both target the same
locked `frameworks/base` revision and touch disjoint files. Listener staging copies
both bundles and generates the exact certificate resource overlay in the optional
`listener/systemui/chip/overlay` directory. The ordinary listener makefile does not
include it: this avoids introducing an unknown resource into unpatched SystemUI.

First verify/stage the original complete source as documented there. Then prepare
the chip overlay outside that source:

```sh
node scripts/aosp-listener-systemui.mjs --source /absolute/original-aosp --chip --output /absolute/new-chip-overlay
```

Copy its manifest-listed files only into the separate disposable build copy,
after checking that copy's preimages with `--source … --chip`. Verify the resulting
files with `--source … --chip --after`. Prepare/copy/verify the separate op-list
overlay as well. Only in that patched disposable development product, explicitly
include `vendor/alphaphone/listener/systemui/chip/chip.mk` to activate the generated
certificate overlay. Without this opt-in the empty resource refuses identity and
the chip stays inactive. This is a development source experiment, not a release
activation. Never replace the complete baseline receipt with either derived
receipt. The chip receipt verifies only its eight listed files; all other files
in the build copy remain outside its verification scope. Newly added source files
must be absent in the original input; collisions and changed bytes are refused.
The ordinary full-source verifier still rejects this modified build tree.

The manifest and derived receipts keep `fullTreeVerified`, `imageBuilt`,
`lockAodIndicatorQualified` and `indicatorHealthLeaseImplemented` false. Production
and device acceptance gates remain unchanged.

Host validation runs the actual staged pure policy on the JVM against wrong user,
isolated/shared UID, signer substitution, silenced/wrong-UID capture, forged action
ownership, mutable/non-broadcast tokens and Resume markers. The producer's marker
contract is checked against the consumer. With `ALPHA_SYSTEMUI_TEST_SOURCE` set to
the pinned AOSP root, the host test applies the exact patch to copies and checks
postimage hashes, collisions and mutation rejection. None of these tests executes
Android SystemUI or demonstrates a visible indicator.
