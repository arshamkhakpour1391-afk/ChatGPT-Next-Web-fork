-keep class com.getcapacitor.** { *; }
-keep class com.arsham.solosystem.** { *; }
-dontwarn com.getcapacitor.**
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*
