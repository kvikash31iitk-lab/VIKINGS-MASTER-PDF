# ── PdfBox-Android (tom_roush) ──
# Reflection-heavy font/parser internals; keep the public surface and resources.
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.fontbox.** { *; }
-keep class com.tom_roush.harmony.** { *; }
-dontwarn com.tom_roush.**
-dontwarn org.apache.**
-dontwarn javax.**

# ── ML Kit (document scanner + text recognition) ──
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.mlkit.**

# ── Retrofit / OkHttp / Gson ──
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, AnnotationDefault
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**

# Gson model classes are serialized by name — keep their fields.
-keepclassmembers class com.vikingstech.masterpdf.data.network.dto.** { <fields>; }

# ── Kotlin coroutines ──
-dontwarn kotlinx.coroutines.**

# ── Compose keeps itself; nothing extra required for R8 + AGP 8.5. ──
