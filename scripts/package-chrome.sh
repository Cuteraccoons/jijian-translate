#!/bin/sh
# Build the Chrome Web Store upload: dist/Jijian-Translate-<version>.zip
set -eu
cd "$(dirname "$0")/.."
. scripts/release-files.sh
VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/Jijian-Translate-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
# shellcheck disable=SC2086
zip -q -X -r "$OUT" $RELEASE_FILES -x "*.DS_Store"
echo "$OUT"
