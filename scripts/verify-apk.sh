#!/bin/bash
# اعتبارسنجی APK نهایی
set -e
APK="$(realpath "$1")"
CERT="$2"
AAPT2="/usr/local/lib/python3.11/dist-packages/aapt2/bin/Linux/aapt2"
[ -x "$AAPT2" ] || AAPT2="$(command -v aapt2 || true)"

echo "== 1) badging =="
"$AAPT2" dump badging "$APK" 2>/dev/null | grep -E "package:|application-label:|sdkVersion|targetSdkVersion|uses-permission" | head -8

echo "== 2) منابع =="
"$AAPT2" dump resources "$APK" 2>/dev/null | grep -a -E "app_name|exit_app|error_message" | head -6

echo "== 3) dex =="
unzip -p "$APK" classes.dex | strings | grep -E "file:///android_asset" || { echo "FAIL: URL پچ نشده!"; exit 1; }

echo "== 4) امضای v1 =="
cd "$(mktemp -d)"
unzip -o -q "$APK" "META-INF/*"
openssl smime -verify -in META-INF/CERT.RSA -inform DER -content META-INF/CERT.SF -noverify -out /dev/null 2>/dev/null && echo "  ✓ امضای PKCS7 معتبر است"
python3 - "$APK" <<'EOF'
import sys, zipfile, hashlib, base64
apk = sys.argv[1]
z = zipfile.ZipFile(apk)
mf = z.read("META-INF/MANIFEST.MF").decode()
sections = {}
cur = None
for line in mf.split("\r\n"):
    if line.startswith("Name: "): cur = line[6:]
    elif line.startswith("SHA-256-Digest: ") and cur:
        sections[cur] = line[16:]
ok = 0
for name, want in sections.items():
    got = base64.b64encode(hashlib.sha256(z.read(name)).digest()).decode()
    assert got == want, f"digest mismatch: {name}"
    ok += 1
print(f"  ✓ {ok} فایل از نظر دیجست MANIFEST سالم هستند")
# بررسی SF
sf = z.read("META-INF/CERT.SF").decode()
mf_b = z.read("META-INF/MANIFEST.MF")
import re
dm = re.search(r"SHA-256-Digest-Manifest: ([A-Za-z0-9+/=]+)", sf)
assert dm and base64.b64encode(hashlib.sha256(mf_b).digest()).decode() == dm.group(1), "SF manifest digest mismatch"
print("  ✓ دیجست MANIFEST در SF درست است")
EOF

echo "== 5) ورویدگی ساختار =="
python3 - "$APK" <<'EOF'
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
bad = z.testzip()
assert bad is None, f"zip corrupt at {bad}"
names = z.namelist()
assert "assets/x.htm" in names, "assets/x.htm missing"
assert "classes.dex" in names
assert "resources.arsc" in names
print(f"  ✓ zip سالم — {len(names)} فایل — assets/x.htm موجود است")
EOF

echo "== 6) آندروگارد + v2 =="
python3 - "$APK" <<'EOF'
import sys, logging
logging.disable(logging.CRITICAL)
from androguard.core.apk import APK
a = APK(sys.argv[1])
assert a.is_signed_v1(), "v1 signature missing"
assert a.is_signed_v2(), "v2 signature missing — اندروید ۱۱+ نصب نمی‌کند"
name = a.get_app_name()
print("  ✓ signed v1+v2 | package:", a.get_package(), "| label:", name, "| minSdk:", a.get_min_sdk_version(), "| targetSdk:", a.get_target_sdk_version())
assert "solo" in name.lower() or "system" in name.lower() or "سولو" in name, "bad label: "+name
print("  ✓ certs:", [str(c.serial_number)[:16] for c in a.get_certificates()])
# resources.arsc must be stored
import zipfile
z = zipfile.ZipFile(sys.argv[1])
info = z.getinfo("resources.arsc")
assert info.compress_type == 0, "resources.arsc must be uncompressed"
print("  ✓ resources.arsc uncompressed")
EOF

echo "=== همهٔ بررسی‌ها موفق بود ✓ ==="
