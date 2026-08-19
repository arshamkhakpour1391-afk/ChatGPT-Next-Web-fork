#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ساخت ZIP هم‌تراز + امضای APK v1 و v2 (اندروید ۱۱ تا ۱۶)."""
import io, os, struct, hashlib, base64, zlib, subprocess, tempfile
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from datetime import datetime, timedelta, timezone

MAGIC = b"APK Sig Block 42"
ALG_RSA_PKCS1_SHA256 = 0x0103
V2_ID = 0x7109871A
STORED, DEFLATED = 0, 8


def u32p(data: bytes) -> bytes:
    return struct.pack("<I", len(data)) + data


def load_or_create_key(key_path: str, cert_path: str):
    if os.path.exists(key_path) and os.path.exists(cert_path):
        with open(key_path, "rb") as f:
            key = serialization.load_pem_private_key(f.read(), password=None)
        with open(cert_path, "rb") as f:
            cert = x509.load_pem_x509_certificate(f.read())
        return key, cert
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IR"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Solo System"),
        x509.NameAttribute(NameOID.COMMON_NAME, "Solo System"),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(name).issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
        .sign(key, hashes.SHA256())
    )
    os.makedirs(os.path.dirname(key_path), exist_ok=True)
    with open(key_path, "wb") as f:
        f.write(key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ))
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    return key, cert


def build_aligned_zip(files, compress_of):
    """files: list[(name, data)]. STORED داده‌ها روی مرز ۴ بایت."""
    buf = io.BytesIO()
    cd = []
    for name, data in files:
        method = compress_of.get(name, DEFLATED)
        crc = zlib.crc32(data) & 0xFFFFFFFF
        if method == DEFLATED:
            payload = zlib.compress(data, 9)[2:-4]
        else:
            payload = data
        name_b = name.encode("utf-8")
        extra = b""
        if method == STORED:
            header_wo_extra = 30 + len(name_b)
            pad = (4 - ((buf.tell() + header_wo_extra) % 4)) % 4
            if pad:
                extra = struct.pack("<HH", 0x0000, pad) + b"\x00" * pad
        local = struct.pack(
            "<IHHHHHIIIHH",
            0x04034B50, 20, 0, method, 0, 0,
            crc, len(payload), len(data), len(name_b), len(extra),
        )
        off = buf.tell()
        buf.write(local)
        buf.write(name_b)
        buf.write(extra)
        buf.write(payload)
        cd.append((off, name_b, extra, method, crc, len(payload), len(data)))
    cd_start = buf.tell()
    for off, name_b, extra, method, crc, csz, usz in cd:
        rec = struct.pack(
            "<IHHHHHHIIIHHHHHII",
            0x02014B50, 20, 20, 0, method, 0, 0,
            crc, csz, usz, len(name_b), len(extra), 0, 0, 0, 0, off,
        )
        buf.write(rec)
        buf.write(name_b)
        buf.write(extra)
    cd_size = buf.tell() - cd_start
    buf.write(struct.pack(
        "<IHHHHIIH",
        0x06054B50, 0, 0, len(cd), len(cd), cd_size, cd_start, 0,
    ))
    return buf.getvalue()


def _find_eocd(apk: bytes) -> int:
    for i in range(len(apk) - 22, max(-1, len(apk) - 22 - 65557), -1):
        if apk[i:i + 4] == b"PK\x05\x06":
            clen = struct.unpack_from("<H", apk, i + 20)[0]
            if i + 22 + clen == len(apk):
                return i
    raise ValueError("EOCD not found")


def _chunked_digest(parts):
    chunk = 1024 * 1024
    digests = []
    buf = b"".join(parts)
    n = len(buf)
    off = 0
    while off < n:
        piece = buf[off:off + chunk]
        digests.append(hashlib.sha256(b"\xa5" + struct.pack("<I", len(piece)) + piece).digest())
        off += chunk
    return hashlib.sha256(b"\x5a" + struct.pack("<I", len(digests)) + b"".join(digests)).digest()


def sign_v1(files, key_pem_path, cert_pem_path):
    """برمی‌گرداند dict نام META-INF → بایت."""
    manifest = "Manifest-Version: 1.0\r\nCreated-By: 1.0 (Solo System)\r\n\r\n"
    digest_map = {}
    for name, data in files:
        digest_map[name] = base64.b64encode(hashlib.sha256(data).digest()).decode()
        manifest += f"Name: {name}\r\nSHA-256-Digest: {digest_map[name]}\r\n\r\n"
    manifest_b = manifest.encode()
    sf = "Signature-Version: 1.0\r\nCreated-By: 1.0 (Solo System)\r\n"
    sf += "SHA-256-Digest-Manifest: " + base64.b64encode(hashlib.sha256(manifest_b).digest()).decode() + "\r\n\r\n"
    for name, _ in files:
        section = f"Name: {name}\r\nSHA-256-Digest: {digest_map[name]}\r\n\r\n"
        sf += "Name: " + name + "\r\nSHA-256-Digest: " + base64.b64encode(hashlib.sha256(section.encode()).digest()).decode() + "\r\n\r\n"
    sf_b = sf.encode()
    tmp = tempfile.mkdtemp()
    try:
        mf_p = os.path.join(tmp, "MANIFEST.MF")
        sf_p = os.path.join(tmp, "CERT.SF")
        rsa_p = os.path.join(tmp, "CERT.RSA")
        with open(mf_p, "wb") as f:
            f.write(manifest_b)
        with open(sf_p, "wb") as f:
            f.write(sf_b)
        subprocess.run(
            ["openssl", "smime", "-sign", "-binary", "-nodetach", "-in", sf_p,
             "-signer", cert_pem_path, "-inkey", key_pem_path, "-outform", "DER", "-out", rsa_p],
            check=True, capture_output=True,
        )
        with open(rsa_p, "rb") as f:
            rsa_b = f.read()
    finally:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)
    return {
        "META-INF/MANIFEST.MF": manifest_b,
        "META-INF/CERT.SF": sf_b,
        "META-INF/CERT.RSA": rsa_b,
    }


def sign_v2(apk: bytes, key, cert) -> bytes:
    eocd_off = _find_eocd(apk)
    cd_off = struct.unpack_from("<I", apk, eocd_off + 16)[0]
    before = apk[:cd_off]
    cd = apk[cd_off:eocd_off]
    eocd = bytearray(apk[eocd_off:])
    digest = _chunked_digest([before, cd, bytes(eocd)])
    digest_entry = struct.pack("<I", ALG_RSA_PKCS1_SHA256) + u32p(digest)
    digests = u32p(u32p(digest_entry))
    cert_der = cert.public_bytes(serialization.Encoding.DER)
    certs = u32p(u32p(cert_der))
    attrs = u32p(b"")
    signed_data = digests + certs + attrs
    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    sigs = u32p(u32p(struct.pack("<I", ALG_RSA_PKCS1_SHA256) + u32p(signature)))
    pub = key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    signer_body = u32p(signed_data) + sigs + u32p(pub)
    v2_value = u32p(u32p(signer_body))
    pair = struct.pack("<Q", 4 + len(v2_value)) + struct.pack("<I", V2_ID) + v2_value
    size_m8 = len(pair) + 24
    block = struct.pack("<Q", size_m8) + pair + struct.pack("<Q", size_m8) + MAGIC
    new_cd = cd_off + len(block)
    struct.pack_into("<I", eocd, 16, new_cd)
    return before + block + cd + bytes(eocd)


def arsc_replace_utf8(arsc: bytearray, old: bytes, new: bytes) -> int:
    """جایگزینی رشتهٔ UTF-8 در استخر سراسری؛ اگر لازم باشد استخر را بزرگ می‌کند."""
    idx = arsc.find(old)
    if idx < 0:
        raise ValueError("string not found: %r" % old)
    # طول‌های uleb تک‌بایتی (رشته‌های کوتاه)
    if arsc[idx - 3] != 0 or arsc[idx - 2] != len(old) or arsc[idx - 1] != len(old):
        # حالت بدون بایت صفر جداکننده
        if arsc[idx - 2] == len(old) and arsc[idx - 1] == len(old):
            len_at = idx - 2
        else:
            raise ValueError("unexpected utf8 length prefix around %r" % old)
    else:
        len_at = idx - 2
    if arsc[idx + len(old)] != 0:
        raise ValueError("string not NUL-terminated")
    delta = len(new) - len(old)
    arsc[len_at] = len(new)
    arsc[len_at + 1] = len(new)
    if delta == 0:
        arsc[idx:idx + len(new)] = new
        return 0
    if delta < 0:
        arsc[idx:idx + len(new)] = new
        arsc[idx + len(new)] = 0
        for k in range(idx + len(new) + 1, idx + len(old) + 1):
            arsc[k] = 0
        return 0
    # رشد: ۱ بایت (یا بیشتر) داخل داده، پد ۴بایتی در انتهای استخر
    tail = bytes(arsc[idx + len(old):])
    arsc[idx:idx + len(new)] = new
    # بقیه را شیفت بده
    grow = delta
    pad = (4 - ((len(arsc) + grow) % 4)) % 4
    # ساده‌تر: فقط داده را جابه‌جا کن
    out = bytearray(arsc[:idx]) + new + b"\x00" + tail[1:]
    # به‌روزرسانی اندازهٔ chunk استخر سراسری و جدول
    # ResTable header size field at offset 4
    old_size = struct.unpack_from("<I", out, 4)[0]
    # string pool starts at 12
    pool_size = struct.unpack_from("<I", out, 16)[0]
    extra = len(out) - len(arsc)
    # پد تا ۴
    if extra % 4:
        out.extend(b"\x00" * (4 - extra % 4))
        extra = len(out) - len(arsc)
    struct.pack_into("<I", out, 4, old_size + extra)
    struct.pack_into("<I", out, 16, pool_size + extra)
    # آفست رشته‌های بعدی در استخر
    str_count = struct.unpack_from("<I", out, 20)[0]
    flags = struct.unpack_from("<I", out, 28)[0]
    strings_start = struct.unpack_from("<I", out, 32)[0]
    pool_hdr = 12
    off_base = pool_hdr + 28
    # data offset of this string relative to string data start
    data_rel = (len_at - (pool_hdr + strings_start))
    for i in range(str_count):
        o = struct.unpack_from("<I", out, off_base + i * 4)[0]
        if o > data_rel:
            struct.pack_into("<I", out, off_base + i * 4, o + extra)
    arsc[:] = out
    return extra
