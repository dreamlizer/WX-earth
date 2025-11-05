@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem === 根目录（本脚本所在目录） ===
set "ROOT=%~dp0"
set "OUT_BASE=%ROOT%outputImage_high"
set "LOG=%ROOT%webp_convert_high.log"

rem === 找 cwebp.exe ===
set "TOOL="
if exist "%ROOT%libwebp-1.6.0-windows-x64\bin\cwebp.exe" set "TOOL=%ROOT%libwebp-1.6.0-windows-x64\bin\cwebp.exe"
if not defined TOOL for %%P in (cwebp.exe) do set "TOOL=%%~$PATH:P"
if not defined TOOL (
  echo [err] cwebp.exe not found. Put libwebp under this folder or add cwebp to PATH. > "%LOG%"
  echo [err] cwebp.exe not found. See "%LOG%".
  pause
  exit /b 2
)

rem === 准备输出与日志 ===
if not exist "%OUT_BASE%" mkdir "%OUT_BASE%" >nul 2>nul
> "%LOG%" echo [start] %DATE% %TIME%  ROOT="%ROOT%"  OUT="%OUT_BASE%"
>>"%LOG%" echo [info] tool="%TOOL%"

rem === 遍历所有图片（递归） ===
for /R "%ROOT%" %%F in (*.jpg *.jpeg *.png *.tif *.tiff) do (
  set "IN=%%~fF"

  rem --- 跳过工具包、输出目录 ---
  echo "!IN!" | findstr /i "\\libwebp-"        >nul && (>>"%LOG%" echo [skip] tool:     "!IN!" & goto :next)
  echo "!IN!" | findstr /i "\\outputImage_std" >nul && (>>"%LOG%" echo [skip] otherOut: "!IN!" & goto :next)
  echo "!IN!" | findstr /i "\\outputImage_high">nul && (>>"%LOG%" echo [skip] thisOut:  "!IN!" & goto :next)
  echo "!IN!" | findstr /i "\\.git"            >nul && (>>"%LOG%" echo [skip] git:      "!IN!" & goto :next)

  rem --- 高质量方案 ---
  set "TARGET_W=" & set "Q=90" & set "EXTRA="

  rem 白天/夜晚/Albedo：8K
  echo %%~nxF | findstr /i "night day albedo" >nul && ( set "TARGET_W=8192" & set "Q=90" )

  rem 法线：4K 且使用无损（保持细节；若体积太大自己改回 -q 88）
  echo %%~nxF | findstr /i "normal"           >nul && ( set "TARGET_W=4096" & set "EXTRA=-lossless -z 9" )

  rem 高光/云：4K
  echo %%~nxF | findstr /i "specular"         >nul && ( set "TARGET_W=4096" & set "Q=90" )
  echo %%~nxF | findstr /i "cloud"            >nul && ( set "TARGET_W=4096" & set "Q=90" )

  rem 兜底：4K
  if not defined TARGET_W set "TARGET_W=4096"

  rem --- 计算相对路径 & 目标输出路径 ---
  set "REL=%%~dpF"
  set "REL=!REL:%ROOT%=!"
  set "OUTDIR=%OUT_BASE%\!REL!"
  if not exist "!OUTDIR!" mkdir "!OUTDIR!" >nul 2>nul

  set "OUTFILE=!OUTDIR!\%%~nF.webp"

  rem --- 若已有且较新，跳过 ---
  if exist "!OUTFILE!" (
    for %%A in ("!IN!") do for %%B in ("!OUTFILE!") do (
      if "%%~tB" GEQ "%%~tA" (>>"%LOG%" echo [skip] up-to-date: "!IN!" & goto :next)
    )
  )

  rem --- 转换 ---
  set "IN_SIZE=%%~zF"
  "%TOOL%" -q !Q! -m 6 -sharp_yuv !EXTRA! -resize !TARGET_W! 0 "%%F" -o "!OUTFILE!" 1>>"%LOG%" 2>&1
  if errorlevel 1 (
    >>"%LOG%" echo [err ] convert failed: "!IN!"
  ) else (
    for %%S in ("!OUTFILE!") do set "OUT_SIZE=%%~zS"
    >>"%LOG%" echo [ok  ] "!IN!" ^> "!OUTFILE!" (w=!TARGET_W! q=!Q!  in=!IN_SIZE!B  out=!OUT_SIZE!B !EXTRA!)
  )

  :next
)

>>"%LOG%" echo [done] %DATE% %TIME%
echo 完成。高分辨率输出在：%OUT_BASE%
echo 日志：%LOG%
pause
