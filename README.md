# سیستم سولو لولینگ (Solo System)

اپ کامل سولو لولینگ برای اندروید — **ساختهٔ ارشام** · نسخه **۳.۸**

پکیج: `com.arsham.solosystem` · minSdk **۲۲** · target **۳۴** · versionCode **۳۸**

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
npm test             # موتور (www لازم نیست)
npm run test:ui      # خودش اول build می‌کند
npm run test:deep    # خودش اول build می‌کند
```

## دیتابیس

SQL را یک‌بار در Supabase اجرا کن (`sql/schema.sql`). بعد از موفقیت رمز دیتابیس را عوض کن.

ساعت ماموریت روزانه وقتی آنلاین باشی با آفست سرور هم‌خوان می‌شود؛ منطقهٔ زمانی دستگاه برای برچسب روز می‌ماند.

## ZIP

- کامل: `https://github.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/raw/arena/01a019a9-chatgpt-next-web-fork/solo-system-full.zip`
- Gradle: `https://github.com/arshamkhakpour1391-afk/ChatGPT-Next-Web-fork/raw/arena/01a019a9-chatgpt-next-web-fork/solo-system-gradle.zip`
