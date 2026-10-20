# 一键构建 Android Release APK。
# 用法：在 tool/item_manage 目录执行  powershell -ExecutionPolicy Bypass -File build-apk.ps1
# 前置条件：先执行过 npm install 与 npx cap sync android（本脚本不会自动同步网页资源）。

$ErrorActionPreference = 'Stop'

# 必须使用 JDK 21；JDK 26 会因 jlink 无法处理 core-for-system-modules.jar 而构建失败。
$jdkHome = 'C:\Users\lan\.jdks\jbr-21.0.11'
if (-not (Test-Path $jdkHome)) {
    throw "未找到 JDK 21：$jdkHome。请修改脚本开头的 `$jdkHome 变量。"
}
$env:JAVA_HOME = $jdkHome
Write-Host "JAVA_HOME = $env:JAVA_HOME"

$androidDir = Join-Path $PSScriptRoot 'android'
$apkDir = Join-Path $androidDir 'app\build\outputs\apk\release'

Push-Location $androidDir
try {
    & .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle 构建失败，退出码 $LASTEXITCODE。"
    }
}
finally {
    Pop-Location
}

$apks = Get-ChildItem -Path $apkDir -Filter *.apk -ErrorAction SilentlyContinue
if (-not $apks) {
    throw "构建结束但未在 $apkDir 找到 APK。"
}

Write-Host ''
Write-Host '构建完成，产物：'
foreach ($apk in $apks) {
    Write-Host ("  {0}  ({1:N2} MB)" -f $apk.FullName, ($apk.Length / 1MB))
}
