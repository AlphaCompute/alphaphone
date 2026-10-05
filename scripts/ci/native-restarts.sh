#!/usr/bin/env bash
# Product scenarios; each runner authenticates APKs and owns its isolated user.
set -euo pipefail
if [[ $# != 2 ]]; then
  echo 'Usage: native-restarts.sh APK_ARCHIVE NEW_OUTPUT_DIRECTORY' >&2
  exit 2
fi
archive=$1
output=$2
if [[ -e "$output" ]]; then
  echo 'Use a new output directory to preserve restart evidence' >&2
  exit 2
fi
mkdir -p "$output"
for scenario in text-scale tree bookmark; do
  for variant in standalone launcher; do
    node scripts/test-native-restart.mjs "$scenario" \
      "$archive/$variant-debug.apk" "$archive/$variant-androidTest.apk" \
      "$output/$scenario-$variant"
  done
done
