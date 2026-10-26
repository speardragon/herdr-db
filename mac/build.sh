#!/bin/sh
# Builds "mac/build/Herdr DB.app" (macOS only; needs the Swift toolchain from Xcode or CLT).
set -eu
cd "$(dirname "$0")"
if [ "$(uname -s)" != "Darwin" ]; then
  echo "herdr-db: skipping the native app (not macOS); the viewer opens in the browser instead."
  exit 0
fi
if ! command -v swiftc >/dev/null 2>&1; then
  echo "herdr-db: swiftc not found; the viewer will open in the browser instead." >&2
  exit 0
fi
APP="build/Herdr DB.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp Info.plist "$APP/Contents/Info.plist"
swiftc -O -o "$APP/Contents/MacOS/HerdrDB" HerdrDB.swift -framework Cocoa -framework WebKit
codesign --force --sign - "$APP" >/dev/null 2>&1 || true
echo "built $(pwd)/$APP"
