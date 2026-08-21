# سیستم سولو لولینگ (Solo System)

اپ کامل سولو لولینگ برای اندروید — **ساختهٔ ارشام** · نسخه **۳.۹**

پکیج: `com.arsham.solosystem` · minSdk **۲۲** · target **۳۴** · versionCode **۳۹**

طلا فقط از Reward سرور می‌آید (`apply_play` / `claim_reward` / `finish_duel`). `save_full_state` طلا نمی‌سازد؛ claim_id یک‌بارمصرف است. تکسچرها SVG برداری‌اند نه بیت‌مپ ۴K.

## انتشار (فقط Gradle)

مسیر قالب پایتون / `webtoapp` حذف شد. APK معتبر فقط از Android Studio / Gradle:

```bash
npm install
npm run build
cp www/index.html android/app/src/main/assets/public/index.html
cd android && ./gradlew assembleRelease
```

خروجی: `android/app/build/outputs/apk/release/app-release.apk`

امضا: فایل `android/keystore.properties` را از `keystore.properties.example` بساز و مسیر `.jks` را بگذار. رمز و کلید را در گیت نگذار.

اعتبارسنجی پکیج (بعد از بیلد):

```bash
bash scripts/verify-apk.sh android/app/build/outputs/apk/release/app-release.apk
```

باید `com.arsham.solosystem` باشد نه `com.myexampoint.webtoapp`.

## تست

```bash
npm test                # موتور + اقتصاد ضدتقلب
npm run test:ui         # خودش اول build می‌کند
npm run test:deep       # خودش اول build می‌کند
npm run test:integration  # با SUPABASE_URL و SUPABASE_ANON_KEY؛ بدون کلید SKIP
npm run test:screenshots
```

GitHub Actions: engine + ui + deep + integration + screenshots + assembleDebug.

## دیتابیس

SQL را **یک‌بار کامل** در Supabase اجرا کن:

- `sql/schema.sql` (۱۲۴۱ خط، یک‌شات) **یا**
- اول `supabase/migrations/20260819000000_solo_leveling.sql` بعد `supabase/migrations/20260821120000_economy_authoritative.sql`

بدون فایل دوم `apply_play` نصب نمی‌شود. بعد از موفقیت رمز دیتابیس را عوض کن. `service_role` را داخل اپ نگذار.

ساعت ماموریت روزانه وقتی آنلاین باشی با آفست سرور هم‌خوان می‌شود؛ منطقهٔ زمانی دستگاه برای برچسب روز می‌ماند.

## ZIP

- کامل: `https://github.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/raw/arena/01a019a9-chatgpt-next-web-fork/solo-system-full.zip`
- Gradle: `https://github.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/raw/arena/01a019a9-chatgpt-next-web-fork/solo-system-gradle.zip`
