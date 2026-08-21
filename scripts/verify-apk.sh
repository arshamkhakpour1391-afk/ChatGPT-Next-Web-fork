#!/bin/bash
# اعتبارسنجی APK گرادل — پکیج باید com.arsham.solosystem باشد
set -e
APK="${1:-android/app/build/outputs/apk/release/app-release.apk}"
if [ ! -f "$APK" ]; then
  echo "FAIL: APK نیست: $APK"
  echo "مسیر درست: cd android && ./gradlew assembleRelease"
  exit 1
fi
python3 - "$APK" <<'EOF'
import sys, zipfile, re
apk = sys.argv[1]
z = zipfile.ZipFile(apk)
data = z.read("AndroidManifest.xml")
# UTF-16LE strings in binary XML
s = data.decode("utf-16le", errors="ignore")
assert "com.arsham.solosystem" in s, "package must be com.arsham.solosystem, got template?"
assert "myexampoint" not in s, "old webtoapp template leaked into APK"
assert "POST_NOTIFICATIONS" in s or "POST_NOTIFICATIONS" in data.decode("latin-1", errors="ignore"), "notification permission missing"
print("  ✓ package com.arsham.solosystem")
print("  ✓ POST_NOTIFICATIONS present")
names = z.namelist()
assert any(n.startswith("assets/") for n in names), "assets missing"
print("  ✓ assets packed")
print("=== verify-apk OK ===")
EOF
