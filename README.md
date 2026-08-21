# سیستم سولو لولینگ (Solo System)

اپ کامل سولو لولینگ برای اندروید — **ساختهٔ ارشام** · نسخه **۳.۷**

تم مشکی، فارسی، راست‌چین. پکیج: `com.arsham.solosystem`  
minSdk **۲۲** · target/compile **۳۴** · versionCode **۳۷** · versionName **۳.۷.۰**

## انتشار (مایکت / مردم)

APK را **فقط با Gradle** بساز. قالب پایتون/WebView قدیمی روی اندروید ۱۱–۱۶ نصب نمی‌شود.

### ساخت APK روی ویندوز (Android Studio)

1. ZIP کامل یا ZIP گرادل را از همین برنچ دانلود کن
2. پوشهٔ `android` را در Android Studio باز کن
3. JDK ۱۷ + SDK ۳۴
4. `Build → Generate Signed Bundle / APK → APK → release`
5. پکیج قبلی `com.arsham.solosystem` را از گوشی حذف کن، بعد APK جدید را نصب کن

کلید داخل پروژه: `android/keystore/solo-system.jks` (اگر هست). اگر نبود Studio یک کلید جدید می‌سازد — همان را نگه دار.

لینک ZIP بعد از هر پوش:

- کامل: `https://github.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/raw/arena/01a019a9-chatgpt-next-web-fork/solo-system-full.zip`
- فقط Gradle: `https://github.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/raw/arena/01a019a9-chatgpt-next-web-fork/solo-system-gradle.zip`

از ترمینال لینوکس/مک (اگر JDK هست):

```bash
npm install
npm run build
cp www/index.html android/app/src/main/assets/public/index.html
cd android && ./gradlew assembleRelease
```

## قابلیت‌ها

- سقف سطح **۱۰٬۰۰۰** با تگ نام یکتا و رنک تا X
- **۱۰٬۰۰۰ دانجن**، **۱۰٬۰۰۰ باس**، **۱۰٬۰۰۰ مهارت**، کاتالوگ **۱۰۰٬۰۰۰** وسیله
- ماموریت اجباری هر ۲ ساعت: اگر تب را باز نکنی هم موتور مجازات می‌کند
- ماموریت روزانه: اگر روز بگذرد و کار تمام نشود، مجازات واقعی
- رقابت کلیکی و شوتر + نبرد آزاد تا ۱۰۰ نفر
- ذخیره اجباری روی ابر؛ بدون اینترنت: «شما آفلاینید» و حساب آفلاین (مهمان)
- رمز حساب: **bcrypt** (رمزهای قدیمی SHA-256 یک‌بار ارتقا می‌شوند)
- لیدربرد از ستون‌های کلمپ‌شدهٔ سرور — کلاینت نمی‌تواند سطح/طلا را مستقیم در جدول `players` بنویسد

## دیتابیس (یک بار، بعد از هر آپدیت اسکیما)

SQL را در پروژهٔ Supabase اجرا کن. از داخل اپ: تنظیمات → نصب دیتابیس. یا از ترمینال (رمز را خودت بگذار):

```bash
pkg install -y curl postgresql && ( curl -fsSL -o schema.sql "https://cdn.jsdelivr.net/gh/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork@SHA/supabase/migrations/20260819000000_solo_leveling.sql" || curl -fsSL -o schema.sql "https://raw.githubusercontent.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/arena/01a019a9-chatgpt-next-web-fork/supabase/migrations/20260819000000_solo_leveling.sql" ) && ( PGPASSWORD='YOUR_DB_PASSWORD' psql "postgresql://postgres.baooyxmxzkzwimitjfjk@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require" -v ON_ERROR_STOP=1 -f schema.sql || PGPASSWORD='YOUR_DB_PASSWORD' psql "postgresql://postgres.baooyxmxzkzwimitjfjk@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require" -v ON_ERROR_STOP=1 -f schema.sql ) && echo OK
```

`SHA` را با هش کامیت عوض کن. بعد از موفقیت، رمز دیتابیس را در داشبورد عوض کن.

بدون این مرحله بازی آفلاین کار می‌کند؛ حساب ابری / لیدربرد / چت / رقابت ابری نه.

## تست

```bash
npm test             # موتور
npm run test:ui      # رابط (۹ تب، مهمان، بدون اسکرول نوار)
npm run test:deep    # ۱۰ دور هر ۹ تب + ثبت‌نام محلی
```

## ساختار

```
src/                 پوسته، استایل، موتور، UI، ابر، نبرد
sql/schema.sql       اسکیما idempotent (bcrypt + finish_duel + clamp)
android/             پروژهٔ Capacitor / Gradle — بیلد واقعی APK
build.mjs            یک فایل www/index.html
ci/                  تست موتور و DOM
```
