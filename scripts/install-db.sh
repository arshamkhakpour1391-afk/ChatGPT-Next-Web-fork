#!/bin/bash
# ============================================================
#  نصب یک‌کلیکی دیتابیس سیستم سولو لولینگ
#  در همان پوشه‌ای اجرا کن که supabase init را زده‌ای
# ============================================================
set -e
MIG="https://raw.githubusercontent.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/arena/01a019a9-chatgpt-next-web-fork/supabase/migrations/20260819000000_solo_leveling.sql"

echo "۱) بررسی Supabase CLI ..."
if ! command -v supabase >/dev/null 2>&1; then
  echo "✗ Supabase CLI نصب نیست. نصب کن:"
  echo "   npm install -g supabase"
  exit 1
fi

echo "۲) دانلود migration ..."
mkdir -p supabase/migrations
if command -v curl >/dev/null 2>&1; then
  curl -fsSL -o supabase/migrations/20260819000000_solo_leveling.sql "$MIG"
else
  wget -q -O supabase/migrations/20260819000000_solo_leveling.sql "$MIG"
fi
echo "   ✓ migration آماده شد ($(wc -l < supabase/migrations/20260819000000_solo_leveling.sql) خط)"

echo "۳) اجرای db push (رمز دیتابیس را که پرسید تایپ کن و Enter بزن) ..."
supabase db push

echo ""
echo "✅ تمام شد! حالا داخل اپ: تنظیمات → نصب دیتابیس → بررسی دوباره"
