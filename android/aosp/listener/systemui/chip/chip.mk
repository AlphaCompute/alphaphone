# Development-only opt-in, after applying the exact SystemUI chip source patch.
# Not included by listener.mk: unpatched SystemUI has no matching certificate resource.
PRODUCT_PACKAGE_OVERLAYS += $(patsubst %/,%,$(dir $(lastword $(MAKEFILE_LIST))))/overlay
