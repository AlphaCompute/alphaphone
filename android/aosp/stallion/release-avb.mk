# Alpha Phone release verified-boot configuration for alpha_stallion_phone.
# Staged and included only by `stage-aosp.mjs --target pixel10a --production`.
#
# No key path is set here and no key is ever committed. The image builds with the
# AOSP test AVB key; scripts/sign-aosp-release.mjs re-signs vbmeta and the chained
# vbmeta partitions with the release `avb` key from a runtime key directory
# (sign_target_files_apks --avb_vbmeta_key / --avb_<partition>_key), using the
# algorithm below. The matching avb_pkmd.bin is enrolled on a device with
# `fastboot flash avb_custom_key avb_pkmd.bin` before `fastboot flashing lock`;
# that enrollment is a device step, not a build or staging step.
#
# Whether the board configuration honours these values is image-build evidence:
# staging this file does not prove the image was built, signed or booted.
BOARD_AVB_ENABLE := true
BOARD_AVB_ALGORITHM := SHA256_RSA4096
BOARD_AVB_VBMETA_SYSTEM_ALGORITHM := SHA256_RSA4096
BOARD_AVB_VBMETA_VENDOR_ALGORITHM := SHA256_RSA4096
# Anti-rollback: each release's rollback index is its platform security patch date.
BOARD_AVB_ROLLBACK_INDEX := $(PLATFORM_SECURITY_PATCH_TIMESTAMP)
BOARD_AVB_VBMETA_SYSTEM_ROLLBACK_INDEX := $(PLATFORM_SECURITY_PATCH_TIMESTAMP)
BOARD_AVB_VBMETA_VENDOR_ROLLBACK_INDEX := $(PLATFORM_SECURITY_PATCH_TIMESTAMP)
