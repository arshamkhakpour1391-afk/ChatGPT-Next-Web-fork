#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ساخت APK قابل نصب روی اندروید قدیمی تا ۱۶
- resources.arsc فشرده نمی‌شود و ۴بایت تراز است
- امضای v1 + v2 با کلید ثابت
- نام لانچر: solo system
- آیکون واقعی (PNG همهٔ تراکم‌ها) بدون خراب کردن XML تطبیقی
"""
import os, sys, struct, hashlib, zipfile, io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apk_sign import (
    STORED, DEFLATED, load_or_create_key, build_aligned_zip,
    sign_v1, sign_v2,
)

TEMPLATE = os.path.join(ROOT, "build", "template.apk")
WWW_HTML = os.path.join(ROOT, "www", "index.html")
OUT = os.path.join(ROOT, "solo-leveling-system.apk")
KEY_PEM = os.path.join(ROOT, "build", "release-key.pem")
CERT_PEM = os.path.join(ROOT, "build", "release-cert.pem")
ICON_SRC = os.path.join(ROOT, "assets", "icon-src.png")


def patch_dex(dex: bytearray):
    url_needle = b"https://successtar.github.io"
    url_i = dex.find(url_needle)
    assert url_i > 0, "URL string not found in dex"
    assert dex[url_i - 1] == len(url_needle)
    new_url = b"file:///android_asset/x.htm"
    assert len(new_url) == len(url_needle) - 1
    dex[url_i - 1] = len(new_url)
    dex[url_i:url_i + len(new_url)] = new_url
    dex[url_i + len(new_url)] = 0x00
    import zlib
    struct.pack_into("<I", dex, 32, len(dex))
    dex[12:32] = hashlib.sha1(bytes(dex[32:])).digest()
    struct.pack_into("<I", dex, 8, zlib.adler32(bytes(dex[12:])) & 0xFFFFFFFF)


def arsc_set_name(arsc: bytearray, new: bytes):
    old = b"Web to App"
    idx = arsc.find(old)
    assert idx > 0, "app name not in arsc"
    assert arsc[idx - 2] == len(old) and arsc[idx - 1] == len(old)
    assert arsc[idx + len(old)] == 0
    if len(new) == len(old):
        arsc[idx:idx + len(new)] = new
        return arsc
    if len(new) < len(old):
        arsc[idx - 2] = len(new)
        arsc[idx - 1] = len(new)
        arsc[idx:idx + len(new)] = new
        arsc[idx + len(new)] = 0
        for k in range(idx + len(new) + 1, idx + len(old) + 1):
            arsc[k] = 0x20
        return arsc
    # رشد کنترل‌شده
    delta = len(new) - len(old)
    out = bytearray(arsc[:idx]) + new + b"\x00" + bytes(arsc[idx + len(old) + 1:])
    out[idx - 2] = len(new)
    out[idx - 1] = len(new)
    pool_off = 12
    pool_size = struct.unpack_from("<I", out, pool_off + 4)[0]
    table_size = struct.unpack_from("<I", out, 4)[0]
    extra = delta
    pad = (4 - ((pool_size + extra) % 4)) % 4
    insert_at = pool_off + pool_size + extra
    if pad:
        out[insert_at:insert_at] = b"\x00" * pad
        extra += pad
    struct.pack_into("<I", out, 4, table_size + extra)
    struct.pack_into("<I", out, pool_off + 4, pool_size + extra)
    str_count = struct.unpack_from("<I", out, pool_off + 8)[0]
    strings_start = struct.unpack_from("<I", out, pool_off + 20)[0]
    data_start = pool_off + strings_start
    this_rel = (idx - 2) - data_start
    off_base = pool_off + 28
    for i in range(str_count):
        o = struct.unpack_from("<I", out, off_base + i * 4)[0]
        if o > this_rel:
            struct.pack_into("<I", out, off_base + i * 4, o + delta)
    return out


def patch_arsc_messages(arsc: bytearray):
    pairs = [
        (b"Do you want to exit this application?",
         "Exit Solo System?".encode("utf-8").ljust(37, b" ")[:37]),
        (b"Error occured, please check your internet connecion.",
         "Error! Check your internet.".encode("utf-8").ljust(52, b" ")[:52]),
        (b"SSL Error! Give Permission",
         "Security error!".encode("utf-8").ljust(26, b" ")[:26]),
    ]
    for old, new in pairs:
        assert len(new) == len(old)
        i = arsc.find(old)
        assert i >= 0, old
        arsc[i:i + len(new)] = new


def make_icons():
    from PIL import Image
    src = Image.open(ICON_SRC).convert("RGBA")
    # برش مرکز امن برای آیکون تطبیقی
    w, h = src.size
    crop = int(w * 0.08)
    src = src.crop((crop, crop, w - crop, h - crop))
    return src


def main():
    print("→ خواندن قالب:", TEMPLATE)
    zin = zipfile.ZipFile(TEMPLATE)
    files = {}
    compress = {}
    for info in zin.infolist():
        name = info.filename
        if name.startswith("META-INF/") and (
            name.endswith(".RSA") or name.endswith(".SF") or name.endswith(".MF") or name.endswith(".EC")
        ):
            continue
        files[name] = zin.read(name)
        compress[name] = info.compress_type

    print("→ پچ classes.dex ...")
    dex_name = [n for n in files if n.endswith(".dex")][0]
    dex = bytearray(files[dex_name])
    patch_dex(dex)
    files[dex_name] = bytes(dex)
    print("  dex URL patched ✓")

    print("→ پچ resources.arsc (نام solo system) ...")
    arsc = bytearray(files["resources.arsc"])
    arsc = arsc_set_name(arsc, b"solo system")
    if not isinstance(arsc, bytearray):
        arsc = bytearray(arsc)
    patch_arsc_messages(arsc)
    files["resources.arsc"] = bytes(arsc)
    compress["resources.arsc"] = STORED
    print("  name patched ✓")

    print("→ آیکون‌ها (فقط PNG، XML تطبیقی دست‌نخورده) ...")
    icon = make_icons()
    import io as _io
    for name, data in list(files.items()):
        if not name.endswith(".png"):
            continue
        if "ic_launcher" not in name:
            continue
        try:
            w, h = __import__("PIL").Image.open(_io.BytesIO(data)).size
        except Exception:
            continue
        buf = _io.BytesIO()
        icon.resize((w, h), __import__("PIL").Image.LANCZOS).save(buf, "PNG", optimize=True)
        files[name] = buf.getvalue()
        compress[name] = STORED
    print("  icons replaced ✓")

    print("→ افزودن اپ ...")
    with open(WWW_HTML, "rb") as f:
        files["assets/x.htm"] = f.read()
    compress["assets/x.htm"] = DEFLATED
    print("  assets/x.htm = %d bytes ✓" % len(files["assets/x.htm"]))

    print("→ کلید امضا ...")
    key, cert = load_or_create_key(KEY_PEM, CERT_PEM)

    ordered = [(n, files[n]) for n in sorted(files) if not n.startswith("META-INF/MANIFEST") and not n.startswith("META-INF/CERT")]
    print("→ امضای v1 ...")
    meta = sign_v1(ordered, KEY_PEM, CERT_PEM)
    for n, d in meta.items():
        files[n] = d
        compress[n] = STORED
    ordered = [(n, files[n]) for n in sorted(files)]

    print("→ ساخت ZIP هم‌تراز ...")
    unsigned = build_aligned_zip(ordered, compress)

    print("→ امضای v2 ...")
    final = sign_v2(unsigned, key, cert)
    with open(OUT, "wb") as f:
        f.write(final)
    print("✓ APK ساخته شد: %s (%.0f KB)" % (OUT, len(final) / 1024))

    print("→ اعتبارسنجی ...")
    import subprocess
    subprocess.run(
        [os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify-apk.sh"), OUT, CERT_PEM],
        check=True,
    )


if __name__ == "__main__":
    main()
