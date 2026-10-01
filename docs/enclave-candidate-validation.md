# Enclave candidate validation — 2026-09-30

The latest-source candidate was built and tested in an isolated Linux container, then packaged as an **unsigned EIF**. It has not replaced the running enclave. Signing and Terraform image admission require the existing release operator.

## Source and artifact identity

| Item | Verified value |
| --- | --- |
| Upstream source | `elizaOS/eliza`, develop head checked during preparation: `4573712ebf0466daa4dfadaa4482704c209d9b8c` |
| Device-action patch commit | `45cc570386128bd613e8cc6675d571e0b75331de` |
| Patch file | `patches/eliza/0001-durable-device-actions.patch` |
| Patch SHA256 | `f617b97c8e9a53dad2ba6c1bc16b766f92c90da6b1a5da3d96ea86491acd0be2` |
| Original tracked-source archive SHA256 | `3e82e9596643fa5b6de161b3c1a56fe585064686c3088d3219abf271278edeb6` |
| Normalized source archive content hash | `ebd843a9dae560a07d4c4b453cd994b03dd60572f3f27ceb3ada698e8e8ffb2f` — matched the official fixed-SHA codeload archive |
| Runtime image | `sha256:06828bdcadc10c76a475c6134c1e50b9f4d9c489f6e04f6beb2b984e04b6afcb` |
| Attested-wrapper image | `sha256:3f6ebee49073c1660a72eaf66310c3aa70c0c573c77f4927d030f91efccbc038` |
| Unsigned EIF SHA256 | `4370ca3841067ddf733d0c0c102ff23093853c7cd52ae7687e77ecdd772e4712` |
| Unsigned EIF size | 1,716,852,147 bytes |
| Host artifact | `shaw-enclave.alphacompute.dev:/home/ec2-user/alpha-phone-release-4573712e/unsigned8-45cc570/candidate.eif` |
| EIF validation | Version 4; CRC true; signed false; kernel 6.12.110 |

The source checkout was isolated from `vendor/eliza`, the imported baseline, and the user's existing Eliza checkouts. The final patch passed a reverse-apply check against the candidate source. The initial full runtime image was followed by a small layer containing the final rebuilt assistant distribution and updated message-routing source; provenance labels record the final patch.

## Candidate measurements

| Measurement | Value |
| --- | --- |
| PCR0 | `681ca554f7249786d02dcd586557ec5be10f12d7a4544afc9ed0a355b956cc3aadf81e9ced3515b19bf75a2430adca1e` |
| PCR1 | `2b35551b37fc4ec2c7a14068a97fb84a2b119f893213e78f12eb9c688a6ec3ec2003e57ea01e22e79ad789af76598db6` |
| PCR2 | `9266451de4250aa7b97aa93f5589bf58fb658c2073397e8dac2dbfe40b6235975cf6ac5dc1b20e0e05eee040bcffe73e` |
| Required existing signer PCR8 | `0262c010615f7b6df9dbffc427982bb4f9c7a32e774c34a56b1cd58146faedbc9320bfd69bdff974323cf0f71564f6bd` |

PCR1 matches the current deployed kernel. PCR8 is the existing release certificate's identity, **not a measurement present on this unsigned candidate**. Recheck all measurements, signature validity and checksum after signing.

## Completed validation

- Pinned Node 24.15.0/Bun 1.4.2; frozen-lockfile dependency installation completed with 3,227 packages.
- Linux backend build graph, plugin/view builds and Vite renderer completed successfully. Renderer manifest contains 1,134 assets; viewport verification passed. Final assistant changes were rebuilt before the last runtime layer.
- Upstream root verification passed 284 workspace tasks, packed-consumer validation and final audits at the final patch commit. The separate live action verification exercised ordinary requests for the four supported device operations; that is distinct from the container evidence below.
- The actual runtime image started as uid 10001 using `packages/app/src/entry.ts start`. It uses the real Eliza app-host REST protocol.
- Synthetic private state disabled scheduling/personal-assistant defaults and selected direct Cerebras `qwen-3.8-27b` for text models with `ELIZAOS_CLOUD_USE_INFERENCE=false`. No production state or communication-account credentials were mounted.
- Runtime smoke passed readiness, pairing with the required instance ID, authenticated session identity, strict Host conversation creation, and rejection of both absent and invalid bearer credentials.
- A real model arithmetic request returned `72`; history contained the two messages. A full container stop/start restored the same history.
- The measured wrapper uses the current app entrypoint, requested provider/model and explicit `ELIZA_REQUIRE_LOCAL_AUTH=1`, preserving authentication on loopback/vsock ingress.

The container smoke was stopped after validation. Private fixture credentials and full runtime logs remain outside the repository and build context. They are not release artifacts.

## Packaging evidence and limitations

The existing packaging helper treated `sha256:` image IDs as registry names. The candidate helper uses local tags derived from inspected immutable image IDs. LinuxKit then hit 6 GiB and 8 GiB memory limits while converting its completed customer TAR.

A bounded alternative retained that generated TAR, extracted it with hardlinks intact, and streamed GNU cpio into gzip. Direct libarchive TAR-to-CPIO conversion was rejected because it lost hardlink semantics. Linux filesystem extraction normalized one symlink's permissions; its CPIO header was restored to the original TAR value before final validation.

The complete equivalence scan compared **388,242 paths** with zero missing, extra or different entries. It compared regular-file content hashes, resolved hardlink contents, symlink targets, permissions, UID/GID, timestamps and device metadata. Required `rootfs`, app entrypoint, bootstrap, `cmd` and `env` content was present. The existing custom-kernel `eif_build` completed within a 6 GiB cap and `nitro-cli describe-eif` verified CRC and measurements.

This proves packaging equivalence and image integrity. It does **not** establish new-candidate enclave boot, attested KMS release, encrypted-state recovery, public phone pairing, or all application features. Those remain deployment acceptance steps.

Nonsecret evidence is retained under `/Users/shawwalters/alpha-enclave-deployment/latest-source/`: `release-candidate-4573712e.json`, `candidate.description.json`, `candidate.sha256`, `payload-equivalence.json`, `SIGNING-ADMISSION-REQUEST.json`, and `prepared-wrapper-4573712e/`. The final EIF remains on the host; it was not copied into this repository. Disposable install/extraction trees and rejected intermediates were removed; immutable images and final artifacts were retained.

## Current production readback

At the final readback during this work:

- Enclave-d remained RUNNING at 12,288 MiB; its existing health endpoint returned `{"ready":true}`.
- Enclaves a, b and c remained RUNNING at 4,096 MiB each.
- Existing d release SHA256 remained the recorded rollback target `8e5ffbf5b1905006aa088ca7c6c2a338de1a805d3f0d3df55fae79545284babf`.
- No existing enclave was stopped, replaced, reconfigured or granted new KMS authority by candidate preparation.

The temporary public ingress is `https://knitting-clock-content-submitting.trycloudflare.com`. Its existing health/authentication checks passed earlier in this task; the final health readback above was through the host ingress. The old release's health is not evidence that the latest candidate is deployed.

## Signing and image-admission inputs still required

1. **Existing signer reference:** release signing key ARN or signing workflow/runner matching the installed certificate/PCR8 above, plus an authorized temporary operator session. The prepared KMS signing helper uses `nitro-cli sign-eif --private-key <KMS ARN> --signing-certificate <existing certificate>`. It needs `kms:Sign`, `kms:GetPublicKey` and `kms:DescribeKey` on the matching asymmetric signing key. Do not invent a replacement signer.
2. **Terraform ownership reference:** repository/workspace and authorized operator/runner for `terraform/kms.tf`. Current host handoff identifies it as the policy source of truth and describes independent image/signer deny conditions. Review the effective current policy and add the final candidate PCR0 while retaining the rollback image, signer PCR8, host-role PCR3 and slot/volume/purpose restrictions. Do not install a generated policy with `kms put-key-policy`.

Account `771726864498`, region `us-east-2`; data key `arn:aws:kms:us-east-2:771726864498:key/ba3b5556-dd7d-4346-9d8d-1fbfaa712d5d`; runtime role `arn:aws:iam::771726864498:role/shaw-enclave-host`; slot `enclave-d`; volume `3065158bdebf477db9089d4fb90d0ad3`.

The host cannot list KMS aliases or read the live key policy. The documented signer alias returns NotFound. The linked deployment thread records the signed production image/public certificate but provides no usable signer ARN, operator profile or Terraform runner. The local default AWS profile returned invalid credentials. These are authorization/reference gaps; no secret keys are requested.

After signing/admission, deploy **d only** using the guarded rollback procedure. Verify signature/CRC/PCR8, fresh hardware attestation, recipient-bound KMS recovery, public unauthenticated rejection, direct Cerebras response, full restart persistence, and phone pairing plus a grounded native action. Keep a–c unchanged. No candidate should be called deployed or accepted before those checks pass.

## Additional signer-source discovery

Read-only follow-up on 2026-09-30 inspected both user-specified Eliza checkouts (`~/v3`, `~/eliza-workspace/milady/eliza`) and the live `elizaOS/eliza` develop tree. GitHub returned exact head `4573712ebf0466daa4dfadaa4482704c209d9b8c` with an untruncated recursive tree. No matching `shaw-enclave` or `alpha-eliza-enclave-d-release-signing` definition was found in those local sources; repository-scoped GitHub code search for `shaw-enclave` also returned no results. This bounds the search to these sources, not all possible private repositories.

Two apparently relevant workflows are different infrastructure: `.github/workflows/tee-build-deploy.yml` deploys to Phala, while `.github/workflows/infra.yml` selects only Hetzner control-plane/apps/prod-ops and Cloudflare pages-domains Terraform roots (lines 290–294 in the inspected local source). Its AWS-named credentials are explicitly R2 state credentials, not evidence of AWS Nitro signing authority. The tracked AWS KMS custody adapter is application vault code; it contains no recovered enclave release signer reference. None supplies the missing slot-d signer or PCR-policy Terraform workspace. No workflow was dispatched, credential printed, policy changed or deployment performed.
