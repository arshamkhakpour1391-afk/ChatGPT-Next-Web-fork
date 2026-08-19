#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ساخت APK نهایی «سیستم سولو لولینگ» از قالب WebView
(فقط کتابخانهٔ استاندارد + openssl برای امضا)
مراحل: پچ dex (آدرس محلی) + پچ strings + آیکون‌ها + assets + امضای v1
"""
import sys, os, io, struct, subprocess, hashlib, base64, zipfile, tempfile, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, "build", "template.apk")
WWW_HTML = os.path.join(ROOT, "www", "index.html")
OUT = os.path.join(ROOT, "solo-leveling-system.apk")

# ---------- ابزار ----------
def uleb(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n: b |= 0x80
        out.append(b)
        if not n: return bytes(out)

def patch_dex(dex: bytearray, old: bytes, new: bytes, expect_count=1):
    """پچ رشته در dex: طول uleb حفظ‌شده و فقط محتوا عوض می‌شود (طول جدید باید ≤ قدیم)"""
    assert len(new) <= len(old), f"new ({len(new)}) > old ({len(old)})"
    count = 0
    start = 0
    while True:
        i = dex.find(old, start)
        if i < 0: break
        # طول uleb قبل از رشته — باید برابر utf16 طول قدیم باشد
        j = i - 1
        while j > 0 and (dex[j] & 0x80): j -= 1
        n = 0; shift = 0
        for k in range(j, i):
            n |= (dex[k] & 0x7F) << shift; shift += 7
        if n == len(old.decode("utf-8", "ignore")):
            dex[i:i+len(new)] = new
            for k in range(i+len(new), i+len(old)):
                dex[k] = 0x00
            count += 1
        start = i + 1
    assert count == expect_count, f"expected {expect_count} patches, got {count}"
    return count

def dex_string_ids(dex: bytes):
    """لیست (index, offset) رشته‌ها از string_ids"""
    string_ids_size, string_ids_off = struct.unpack_from("<II", dex, 56)
    out = []
    for idx in range(string_ids_size):
        off = struct.unpack_from("<I", dex, string_ids_off + idx*4)[0]
        out.append((idx, off))
    return out

def dex_read_string(dex: bytes, off: int):
    """خواندن رشتهٔ dex از offset (uleb utf16 len + MUTF-8 + null)"""
    i = off
    n = 0; shift = 0
    while True:
        b = dex[i]; i += 1
        n |= (b & 0x7F) << shift
        if not (b & 0x80): break
        shift += 7
    end = dex.index(b"\x00", i)
    return n, bytes(dex[i:end]), i, end

def patch_dex_repoint(dex: bytearray, old_url: bytes, new_url: bytes, victim_needle: bytes):
    """URL قدیمی کوتاه است → const-string را به رشتهٔ دیگری که بازنویسی می‌شود اشاره می‌دهیم"""
    ids = dex_string_ids(dex)
    url_idx = victim_idx = None
    url_off = victim_off = None
    for idx, off in ids:
        n, s, _, _ = dex_read_string(dex, off)
        if s == old_url: url_idx, url_off = idx, off
        if s == victim_needle: victim_idx, victim_off = idx, off
    assert url_idx is not None, "url string not found"
    assert victim_idx is not None, "victim string not found"
    # بازنویسی رشتهٔ قربانی (طول uleb دو بایتی حفظ می‌شود)
    n_old, _, data_start, data_end = dex_read_string(dex, victim_off)
    assert len(new_url) <= n_old
    # uleb دو بایته
    dex[victim_off] = (len(new_url) & 0x7F) | 0x80
    dex[victim_off+1] = (len(new_url) >> 7) & 0x7F
    dex[data_start:data_start+len(new_url)] = new_url
    for k in range(data_start+len(new_url), data_end+1):
        dex[k] = 0x00
    # پیدا کردن دستور const-string با ایندکس url و تغییر ایندکس
    pat = b"\x1a" + struct.pack("<H", url_idx)
    hits = []
    start = 0
    while True:
        i = dex.find(pat, start)
        if i < 0: break
        hits.append(i); start = i + 1
    assert len(hits) >= 1, "const-string for url not found"
    for i in hits:
        dex[i+1:i+3] = struct.pack("<H", victim_idx)
    return len(hits)

def patch_arsc(arsc: bytearray, pairs):
    """پچ رشته‌های UTF-8 در arsc با طول یکسان (بدون تغییر پیشوند)"""
    for old, new in pairs:
        assert len(new) <= len(old), f"{new!r} too long for {old!r}"
        found = 0
        start = 0
        while True:
            i = arsc.find(old, start)
            if i < 0: break
            arsc[i:i+len(new)] = new
            for k in range(i+len(new), i+len(old)):
                arsc[k] = 0x20
            found += 1
            start = i + 1
        print(f"  arsc patch {old!r} -> {new!r}: {found} occurrences")
        assert found >= 1, f"{old!r} not found in arsc"

# ---------- 1) خواندن قالب ----------
print("→ خواندن قالب:", TEMPLATE)
zin = zipfile.ZipFile(TEMPLATE)
entries = {}
for n in zin.namelist():
    if n.startswith("META-INF/") and (n.endswith(".RSA") or n.endswith(".SF") or n.endswith(".MF")):
        continue  # حذف امضای قبلی
    entries[n] = zin.read(n)

print("→ پچ classes.dex ...")
dex_name = [n for n in entries if n.endswith(".dex")][0]
dex = bytearray(entries[dex_name])
# URL به صورت درجا: uleb طول ۲۸ ← ۲۷ و محتوای جدید
url_needle = b"https://successtar.github.io"
url_i = dex.find(url_needle)
assert url_i > 0, "URL string not found in dex"
assert dex[url_i - 1] == len(url_needle), f"unexpected uleb: {dex[url_i-1]}"
new_url = b"file:///android_asset/x.htm"
assert len(new_url) == len(url_needle) - 1
dex[url_i - 1] = len(new_url)
dex[url_i:url_i + len(new_url)] = new_url
dex[url_i + len(new_url)] = 0x00  # حرف آخر قبلی → ترمیناتور
# --- بازمحاسبهٔ checksum و signature سربرگ dex (ضروری! وگرنه اندروید کرش می‌کند) ---
# ترتیب مهم است: اول SHA-1 (روی بایت ۳۲ به بعد)، بعد Adler32 (روی بایت ۱۲ به بعد که شامل SHA-1 هم هست)
import zlib as _zlib
struct.pack_into("<I", dex, 32, len(dex))
sha1 = hashlib.sha1(bytes(dex[32:])).digest()
dex[12:32] = sha1
adler = _zlib.adler32(bytes(dex[12:])) & 0xFFFFFFFF
struct.pack_into("<I", dex, 8, adler)
entries[dex_name] = bytes(dex)
print("  dex URL patched in-place ✓ (checksum + signature fixed)")

print("→ پچ resources.arsc ...")
arsc = bytearray(entries["resources.arsc"])
patch_arsc(arsc, [
    (b"Web to App", "ارشام".encode("utf-8")),
    (b"Do you want to exit this application?",
     "از برنامه خارج می‌شوی؟".encode("utf-8").ljust(37, b" ")[:37]),
    (b"Error occured, please check your internet connecion.",
     "خطا! اینترنتت را چک کن".encode("utf-8").ljust(52, b" ")[:52]),
    (b"SSL Error! Give Permission",
     "خطای امنیتی!".encode("utf-8").ljust(26, b" ")[:26]),
])
entries["resources.arsc"] = bytes(arsc)

print("→ آیکون‌ها ...")
from PIL import Image
import io as _io
src_icon = Image.open(os.path.join(ROOT, "assets", "icon-src.png")).convert("RGBA")
for name, data in entries.items():
    if name.endswith(".png") and "/ic_launcher" in name:
        w, h = Image.open(_io.BytesIO(data)).size
        buf = _io.BytesIO()
        src_icon.resize((w, h), Image.LANCZOS).save(buf, "PNG", optimize=True)
        entries[name] = buf.getvalue()
# پس‌زمینهٔ آیکون تطبیقی: بنفش تیره
bg_xml = b'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#0a0d15" android:pathData="M0,0h108v108h-108z"/></vector>'
fg_xml = b'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#7c5cff" android:pathData="M54,18 L62,50 L92,56 L62,62 L54,94 L46,62 L16,56 L46,50 Z"/></vector>'
for name in entries:
    if name == "res/drawable-anydpi-v21/ic_launcher_background.xml":
        entries[name] = bg_xml
    if "ic_launcher_foreground" in name and name.endswith(".xml"):
        entries[name] = fg_xml
print("  icons replaced ✓")

print("→ افزودن اپ ...")
with open(WWW_HTML, "rb") as f:
    entries["assets/x.htm"] = f.read()
print(f"  assets/x.htm = {len(entries['assets/x.htm'])} bytes ✓")

# ---------- 2) ساخت zip ----------
print("→ ساخت APK ...")
buf = io.BytesIO()
zout = zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9)
for name in sorted(entries):
    zout.writestr(name, entries[name])
zout.close()
apk = buf.getvalue()

# ---------- 3) امضای v1 ----------
print("→ امضا (v1 JAR signing) ...")
tmp = tempfile.mkdtemp()
key_pem = os.path.join(tmp, "key.pem")
cert_pem = os.path.join(tmp, "cert.pem")
subprocess.run(["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", key_pem], check=True, capture_output=True)
subprocess.run(["openssl", "req", "-new", "-x509", "-key", key_pem, "-out", cert_pem, "-days", "10000",
                "-subj", "/C=IR/O=Arsham/CN=Arsham Solo Leveling"], check=True, capture_output=True)

manifest = "Manifest-Version: 1.0\r\nCreated-By: 1.0 (Arsham)\r\n\r\n"
sf = "Signature-Version: 1.0\r\nCreated-By: 1.0 (Arsham)\r\n"
digest_map = {}
for name in sorted(entries):
    digest = base64.b64encode(hashlib.sha256(entries[name]).digest()).decode()
    digest_map[name] = digest
    manifest += f"Name: {name}\r\nSHA-256-Digest: {digest}\r\n\r\n"
sf += "SHA-256-Digest-Manifest: " + base64.b64encode(hashlib.sha256(manifest.encode()).digest()).decode() + "\r\n\r\n"
for name in sorted(entries):
    section = f"Name: {name}\r\nSHA-256-Digest: {digest_map[name]}\r\n\r\n"
    sf += "Name: " + name + "\r\nSHA-256-Digest: " + base64.b64encode(hashlib.sha256(section.encode()).digest()).decode() + "\r\n\r\n"
manifest = manifest.encode()
sf = sf.encode()

with open(os.path.join(tmp, "MANIFEST.MF"), "wb") as f: f.write(manifest)
with open(os.path.join(tmp, "CERT.SF"), "wb") as f: f.write(sf)
subprocess.run(["openssl", "smime", "-sign", "-binary", "-nodetach", "-in", os.path.join(tmp, "CERT.SF"),
                "-signer", cert_pem, "-inkey", key_pem, "-outform", "DER",
                "-out", os.path.join(tmp, "CERT.RSA")], check=True, capture_output=True)

# افزودن META-INF به zip (تغییرناپذیر بعد از امضا)
with open(os.path.join(tmp, "unsigned.apk"), "wb") as f: f.write(apk)
# ساخت APK نهایی: همهٔ فایل‌ها + META-INF (STORED برای فایل‌های امضا)
outbuf = io.BytesIO()
zfin = zipfile.ZipFile(io.BytesIO(apk))
zfout = zipfile.ZipFile(outbuf, "w", zipfile.ZIP_DEFLATED, compresslevel=9)
for info in zfin.infolist():
    if info.filename in ("META-INF/MANIFEST.MF", "META-INF/CERT.SF", "META-INF/CERT.RSA"):
        continue
    zfout.writestr(info.filename, zfin.read(info.filename))
for fn in ["MANIFEST.MF", "CERT.SF", "CERT.RSA"]:
    with open(os.path.join(tmp, fn), "rb") as f:
        data = f.read()
    zinfo = zipfile.ZipInfo("META-INF/" + fn)
    zinfo.compress_type = zipfile.ZIP_STORED
    zinfo.create_system = 3
    zfout.writestr(zinfo, data)
zfout.close()
final = outbuf.getvalue()

with open(OUT, "wb") as f:
    f.write(final)
print(f"✓ APK ساخته شد: {OUT} ({len(final)/1024:.0f} KB)")

# ---------- 4) اعتبارسنجی ----------
print("→ اعتبارسنجی ...")
subprocess.run([os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify-apk.sh"), OUT, os.path.join(tmp, "cert.pem")], check=True)
shutil.rmtree(tmp, ignore_errors=True)
