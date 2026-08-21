# ============================================================
#  نصب یک‌کلیکی دیتابیس سیستم سولو لولینگ (ویندوز)
#  در همان پوشه‌ای اجرا کن که supabase init را زده‌ای
# ============================================================
$ErrorActionPreference = "Stop"
$mig = "https://raw.githubusercontent.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/arena/01a019a9-chatgpt-next-web-fork/supabase/migrations/20260819000000_solo_leveling.sql"

Write-Host "1) بررسی Supabase CLI ..."
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Host "Supabase CLI نصب نیست. نصب کن: npm install -g supabase"
  exit 1
}

Write-Host "2) دانلود migration ..."
New-Item -ItemType Directory -Force supabase\migrations | Out-Null
Invoke-WebRequest -Uri $mig -OutFile "supabase\migrations\20260819000000_solo_leveling.sql"
Write-Host "   migration آماده شد"

Write-Host "3) اجرای db push (رمز دیتابیس را که پرسید تایپ کن و Enter بزن) ..."
supabase db push

Write-Host ""
Write-Host "تمام شد! داخل اپ: تنظیمات -> نصب دیتابیس -> بررسی دوباره"
