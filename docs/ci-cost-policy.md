# CI cost and qualification policy

## Automatic checks

Pull requests run the affected lanes below. A full Git diff includes deleted files
and both sides of renames. Missing history, unknown paths and shared dependencies
select all lanes; they never silently skip checks. No GitHub file-list API or its
300-file path-filter limit is used. Reference-only changes start small selection
jobs but allocate no build/test runners.

| Changed input | Repository verification | Chromium + production browser | Android build + emulator | Resident preparation |
| --- | --- | --- | --- | --- |
| README, AGENTS, docs, design references | No | No | No | No |
| Host tests | Yes | No | No | No |
| Browser specs/configuration | Yes | Yes | No | No |
| Renderer, including assets | Yes | Yes | Yes | No |
| Android packaging/native sources | Yes | No | Yes | No |
| Shared source pin, dependencies, unknown paths | Yes | Yes | Yes | Yes |
| Individual workflow | Yes | Its automatic lane | Its automatic lane | Its automatic lane |

Existing browser-spec-only edits use one Chromium shard and select exact changed
spec paths. Production-only specs run just the production project; development-only
specs skip production and unrelated speech-profile qualification. Shared helpers,
deleted or renamed specs, application code, dependencies and unavailable diffs keep
the full inventory. File selectors are validated and escaped, then passed as process
arguments without a shell. This shortcut changes test scope only when no executable
application/shared input changed.

The production browser server audits the exact freshly built flag-off bundle before
serving it. CI no longer builds a second unused flag-off bundle in that job. The
separate test-mocks bundle still receives its own audit.

Repository verification runs once in parallel with Chromium's three shards and
Android, instead of four times per event. The existing parallel emulator jobs and
browser shards remain; a failing matrix cancels siblings to limit wasted minutes.
Main pushes run affected repository verification, including the production bundle
audit, but do not repeat PR browser/emulator/native builds. The repository ruleset
requires PRs. An administrative direct push therefore gets only repository
verification; explicitly dispatch qualification if one is used.

Android still checks both standalone and launcher, debug and release outputs and
flag-off production isolation. Renderer changes select Android because renderer
bytes are packaged into APKs. Gradle dependency/build caching reduces repeat setup;
speech sources/models retain hash verification and generated native speech is still
built fresh. No unverified generated runtime cache replaces qualification.

## Explicit, expensive qualification

Alpha Phone ships Android WebView. Chromium remains automatic for affected PRs.
Firefox and macOS WebKit are additional portability qualification and are now
opt-in, including the real macOS audio-recording coverage. Full resident builds
and emulator campaigns are also opt-in; preparation remains automatic for changes
to shared/build inputs. The Bun seccomp reproduction is a diagnostic, not a routine
gate. There are no schedules or hidden branch-specific automatic diagnostic runs.

```sh
# Use the reviewed branch/ref. A dispatch selects all lanes in that workflow.
gh workflow run browser.yml --ref main -f cross_browser=true
gh workflow run android.yml --ref main
gh workflow run resident-android.yml --ref main
gh workflow run resident-prepare.yml --ref main
gh workflow run bun-spawn-seccomp.yml --ref main
```

Before distributing a new runtime/APK, explicitly run resident qualification on
the reviewed revision and inspect its terminal result. A green ordinary PR does
not claim resident execution, Firefox/WebKit, full AOSP, physical-device or real
integration acceptance. Later dispatches on the same ref cancel older runs;
use separate reviewed refs for intentionally concurrent qualification.

Temporary Actions evidence expires after three days. APK transfer bundles are
uploaded once, rather than included again in the generic build-evidence artifact.
Preserve release evidence separately before expiration. Existing uploaded artifacts
are not deleted or shortened by this change.

## Baseline measured October 7, 2026

The Actions API returned 2,685 runs from September 29 through October 6:
1,144 Android foundation, 1,111 Browser MVP, 312 resident Android, 59 preparation,
55 Bun diagnostics and four retired overlay diagnostics. Conclusions were 1,365
cancelled, 961 failed and 359 successful. This is an unusually high-volume week,
not a normalized monthly projection.

Removed automatic duplication includes 587 Android main pushes, 578 full browser
main pushes, 267 resident pushes and 53 diagnostic pushes in that history.
Browser main pushes now retain only repository verification when needed.

[Browser run 37504530726](https://github.com/AlphaCompute/alphaphone/actions/runs/37504530726)
used 186.8 Linux runner-minutes and 10.2 macOS runner-minutes (197.0 total). Its
first Chromium shard spent 9.2 minutes repeating `npm run verify` before 43 minutes
of browser tests. The other two shards also repeated verification. Moving this
check to one parallel job avoids two copies, plus the Android copy.
[Android run 37504530731](https://github.com/AlphaCompute/alphaphone/actions/runs/37504530731)
used 95.4 runner-minutes; [resident run 37504530771](https://github.com/AlphaCompute/alphaphone/actions/runs/37504530771)
used 84.8. Their emulator failures predate this CI-policy change.

For an affected renderer PR followed by a merge, applying this policy to those
latest durations removes the second full browser and Android runs, the resident
run, cross-browser portability checks and redundant verification. This suggests
roughly a 60–70% reduction in runner time for that scenario, before path skips,
Gradle cache savings and failure cancellation. It is an estimate, not observed
post-change billing; manual qualification frequency and future change mix matter.

The legacy run timing endpoint returned zero billable milliseconds despite real
job durations. No dollar or invoice claim is inferred from those zeros. Compare
the organization's billing export and Actions metrics after a week of this policy;
track Linux minutes, macOS minutes, cancelled minutes and artifact storage separately.
