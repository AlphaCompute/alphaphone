# Listening chip certificate overlay. Included by every staged listener product (scripts/aosp-listener.mjs
# listenerProductMakefile), production included: the listener captures only with the chip's indicator lease.
# Requires SystemUI built with the exact chip source patch (listening-chip.patch); unpatched SystemUI has no
# matching certificate resource. Only an explicit development call with systemuiChip:false omits it.
PRODUCT_PACKAGE_OVERLAYS += $(patsubst %/,%,$(dir $(lastword $(MAKEFILE_LIST))))/overlay
