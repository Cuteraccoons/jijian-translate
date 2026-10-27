#!/bin/sh
# Stage the extension for Safari and (re)generate the Xcode project.
#
#   scripts/build-safari.sh            stage files; create safari/ project if missing
#   scripts/build-safari.sh --rebuild  also rebuild the project (after adding new files)
#   scripts/build-safari.sh --build    stage, then compile the macOS app unsigned
#
# Safari ignores the manifest "sandbox" key and has its own extension scheme;
# the source already handles both, so the same files ship to Chrome and Safari.
# Set your team and signing in Xcode (Signing & Capabilities) before archiving.
# --rebuild regenerates the project and drops hand edits (Chinese display name
# "极简翻译", the Chinese text in "Shared (App)/Resources"); re-apply them after.
set -eu
cd "$(dirname "$0")/.."
. scripts/release-files.sh
BUNDLE_ID="${SAFARI_BUNDLE_ID:-com.cuteraccoons.JijianTranslate}"
STAGE="safari/web-extension"
PROJECT="safari/Jijian Translate/Jijian Translate.xcodeproj"

rm -rf "$STAGE"
mkdir -p "$STAGE"
for item in $RELEASE_FILES; do
  mkdir -p "$STAGE/$(dirname "$item")"
  cp -R "$item" "$STAGE/$item"
done
find "$STAGE" -name ".DS_Store" -delete
# Safari has no manifest sandbox; drop the key (and its CSP) so Safari does
# not warn. ocr-sandbox.js detects the missing sandbox and uses ocr-worker.js.
node -e '
const fs=require("fs"),p=process.argv[1],m=JSON.parse(fs.readFileSync(p,"utf8"));
delete m.sandbox; if(m.content_security_policy) delete m.content_security_policy.sandbox;
if(m.options_ui) delete m.options_ui.open_in_tab;
fs.writeFileSync(p,JSON.stringify(m,null,2)+"\n");' "$STAGE/manifest.json"

if [ ! -d "$PROJECT" ] || [ "${1:-}" = "--rebuild" ]; then
  if [ -d "$PROJECT" ]; then
    xcrun safari-web-extension-converter --rebuild-project "$PROJECT" --no-open --no-prompt --force "$STAGE"
  else
    xcrun safari-web-extension-converter "$STAGE" --project-location safari --app-name "Jijian Translate" \
      --bundle-identifier "$BUNDLE_ID" --swift --no-open --no-prompt --force
  fi
fi

# Keep the app version in step with manifest.json.
VERSION=$(node -p "require('./manifest.json').version")
sed -i '' "s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $VERSION;/" "$PROJECT/project.pbxproj"

if [ "${1:-}" = "--build" ]; then
  xcodebuild -project "$PROJECT" -scheme "Jijian Translate (macOS)" -configuration Debug \
    -derivedDataPath safari/build CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO build | tail -3
fi
echo "Safari project: $PROJECT"
