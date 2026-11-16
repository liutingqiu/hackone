#!/usr/bin/env bash
# 无 Gradle 手工打包：aapt2 -> javac -> d8 -> zip(dex) -> zipalign -> apksigner
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_SDK:-D:/app/AndroidSdk}"
BT="$SDK/build-tools/34.0.0"
AJ="$SDK/platforms/android-34/android.jar"
JHOME="${JAVA_HOME_17:-C:/Program Files/Microsoft/jdk-17.0.11.9-hotspot}"
# javac 17 生成的 MethodParameters 属性会让 build-tools 34 的 d8 报 NPE，用 JDK 8 编译
JAVAC8="${JAVAC8:-C:/Program Files/BellSoft/LibericaJDK-8/bin/javac.exe}"
export PATH="$JHOME/bin:$PATH"

PKG="com.pindou.pattern"
OUT="build"
DIST="dist"
APK_FILE="pindou-tablet.apk"
APK_CN="拼豆图纸-平板.apk"

for f in "$BT/aapt2.exe" "$BT/zipalign.exe" "$AJ" "$BT/lib/d8.jar"; do
  [ -e "$f" ] || { echo "缺少构建组件: $f" >&2; exit 1; }
done

echo "==> 清理 $OUT"
rm -rf "$OUT"
rm -f "$DIST"/*.apk "$DIST"/*.idsig
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT/assets/www" "$DIST"

echo "==> 复制页面资源"
cp tablet/index.html "$OUT/assets/www/index.html"

echo "==> aapt2 compile / link"
"$BT/aapt2.exe" compile --dir android/res -o "$OUT/res.zip"
"$BT/aapt2.exe" link \
  -o "$OUT/app-unsigned.apk" \
  -I "$AJ" \
  --manifest android/AndroidManifest.xml \
  -R "$OUT/res.zip" \
  --java "$OUT/gen" \
\
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 3 \
  --version-name 1.0.2 \
  --auto-add-overlay

echo "==> javac (JDK 8)"
find android/src "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
"$JAVAC8" -encoding UTF-8 -source 8 -target 8 -nowarn \
  -bootclasspath "$AJ" -classpath "$AJ" \
  -d "$OUT/classes" @"$OUT/sources.txt"

echo "==> d8 (dex)"
# 工作目录里有空格，先把 cwd 切到 classes 用相对路径，避免 d8 参数被拆开
( cd "$OUT/classes" && java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 \
    --min-api 24 --lib "$AJ" --output ../dex \
    $(find . -name '*.class' | tr '\n' ' ') )

echo "==> 打包 dex + 资源"
PY="${PYTHON:-python}"
"$PY" tools/pack-apk.py "$OUT/app-unsigned.apk" "$OUT/dex/classes.dex" "$OUT/assets/www/index.html" "$OUT/app-packed.apk"

echo "==> zipalign"
"$BT/zipalign.exe" -f -p 4 "$OUT/app-packed.apk" "$OUT/app-aligned.apk"

if [ ! -f tools/debug.keystore ]; then
  echo "==> 生成调试签名"
  keytool -genkeypair -keystore tools/debug.keystore -alias pindou \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android -keypass android \
    -dname "CN=Pindou Pattern, OU=App, O=Pindou, L=Beijing, S=Beijing, C=CN" >/dev/null
fi

echo "==> apksigner"
java -jar "$BT/lib/apksigner.jar" sign \
  --ks tools/debug.keystore --ks-pass pass:android --key-pass pass:android \
  --v1-signing-enabled true --v2-signing-enabled true --v4-signing-enabled false \
  --out "$DIST/$APK_FILE" "$OUT/app-aligned.apk"

echo "==> 校验"
"$BT/aapt.exe" dump badging "$DIST/$APK_FILE" | head -6
java -jar "$BT/lib/apksigner.jar" verify --print-certs "$DIST/$APK_FILE" | head -4
"$BT/zipalign.exe" -c -v 4 "$DIST/$APK_FILE" | tail -2
cp "$DIST/$APK_FILE" "$DIST/$APK_CN"
ls -lh "$DIST/$APK_FILE" "$DIST/$APK_CN"