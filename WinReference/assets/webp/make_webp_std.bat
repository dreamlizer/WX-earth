@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

rem ===== 基本路径与输出 =====
set "ROOT=%~dp0"
set "TOOL=%ROOT%libwebp-1.6.0-windows-x64\bin\cwebp.exe"
set "OUT=%ROOT%outputImage_std"
set "LOG=%ROOT%webp_convert_std.log"

> "%LOG%" echo [start] %date% %time% ROOT="%ROOT%" OUT="%OUT%" TOOL="%TOOL%"
echo [start] %date% %time%

if not exist "%TOOL%" (
  echo [error] cwebp.exe 不存在：%TOOL% | (>>"%LOG%" findstr "^")
  goto :END_FAIL
)

echo [diag] cwebp 版本： | (>>"%LOG%" findstr "^")
"%TOOL%" -version 1>>"%LOG%" 2>&1
if errorlevel 1 (
  echo [error] 无法运行 cwebp | (>>"%LOG%" findstr "^")
  goto :END_FAIL
)

if not exist "%OUT%" mkdir "%OUT%"

rem ===== 5 大类的“最佳候选”与分数 =====
set "DAY_SRC="   & set /a DAY_SCORE=0
set "NIGHT_SRC=" & set /a NIGHT_SCORE=0
set "NORM_SRC="  & set /a NORM_SCORE=0
set "SPEC_SRC="  & set /a SPEC_SCORE=0
set "CLOUD_SRC=" & set /a CLOUD_SCORE=0

echo [scan] 开始遍历… | (>>"%LOG%" findstr "^")

for /R "%ROOT%" %%F in (*.tif *.tiff *.jpg *.jpeg *.png) do (
  set "F=%%~fF"
  set "FN=%%~nxF"

  rem ---- 排除工具与输出目录 ----
  echo !F! | findstr /i "\\libwebp-"        >nul && (echo [skip] tool  !F!>>"%LOG%" & goto :next)
  echo !F! | findstr /i "\\outputImage_"    >nul && (echo [skip] out   !F!>>"%LOG%" & goto :next)
  echo !F! | findstr /i "\\.git"            >nul && (echo [skip] git   !F!>>"%LOG%" & goto :next)

  rem ---- 分辨率线索：8k/4k/2k → 3/2/1 ----
  set /a res=0
  echo !FN! | findstr /i "8k 8192"  >nul && set /a res=3
  if !res! lss 3 echo !FN! | findstr /i "4k 4096" >nul && set /a res=2
  if !res! lss 2 echo !FN! | findstr /i "2k 2048" >nul && set /a res=1

  rem ---- 文件大小（MB）作为微调分：大图更优先 ----
  set /a mb=%%~zF / 1048576
  if !mb! lss 0 set /a mb=0

  rem ---- 统一基分（命中关键字才计分）= 1000*res + mb ----
  set /a base = 1000*!res! + !mb!

  rem ---- day / albedo / color / earth-dark / daymap ----
  echo !FN! | findstr /i "day albedo color daymap earth-dark" >nul && (
    if !base! gtr !DAY_SCORE! ( set "DAY_SCORE=!base!" & set "DAY_SRC=!F!" )
  )
  rem ---- night ----
  echo !FN! | findstr /i "night" >nul && (
    if !base! gtr !NIGHT_SCORE! ( set "NIGHT_SCORE=!base!" & set "NIGHT_SRC=!F!" )
  )
  rem ---- normal ----
  echo !FN! | findstr /i "normal" >nul && (
    if !base! gtr !NORM_SCORE! ( set "NORM_SCORE=!base!" & set "NORM_SRC=!F!" )
  )
  rem ---- specular / spec / gloss ----
  echo !FN! | findstr /i "specular spec gloss" >nul && (
    if !base! gtr !SPEC_SCORE! ( set "SPEC_SCORE=!base!" & set "SPEC_SRC=!F!" )
  )
  rem ---- cloud ----
  echo !FN! | findstr /i "cloud" >nul && (
    if !base! gtr !CLOUD_SCORE! ( set "CLOUD_SCORE=!base!" & set "CLOUD_SRC=!F!" )
  )
  :next
)

echo [pick] day   = "!DAY_SRC!"   (score=!DAY_SCORE!)   >>"%LOG%"
echo [pick] night = "!NIGHT_SRC!" (score=!NIGHT_SCORE!) >>"%LOG%"
echo [pick] normal= "!NORM_SRC!"  (score=!NORM_SCORE!)  >>"%LOG%"
echo [pick] spec  = "!SPEC_SRC!"  (score=!SPEC_SCORE!)  >>"%LOG%"
echo [pick] cloud = "!CLOUD_SRC!" (score=!CLOUD_SCORE!) >>"%LOG%"

for %%V in (DAY NIGHT NORM SPEC CLOUD) do (
  if not defined %%V_SRC (
    echo [error] 缺少源图：%%V_SRC%% | (>>"%LOG%" findstr "^")
    goto :END_FAIL
  )
)

echo [convert] 开始转换… | (>>"%LOG%" findstr "^")

call :DO "%DAY_SRC%"   "%OUT%\day.webp"      4096 2048 "-q 82"
call :DO "%NIGHT_SRC%" "%OUT%\night.webp"    4096 2048 "-q 82"
call :DO "%NORM_SRC%"  "%OUT%\normal.webp"   4096 2048 "-lossless -z 6"
call :DO "%SPEC_SRC%"  "%OUT%\specular.webp" 2048 1024 "-q 88"
call :DO "%CLOUD_SRC%" "%OUT%\clouds.webp"   2048 1024 "-q 90"

echo [done] OK >>"%LOG%"
echo.
echo === 成功（标准） ===
echo 输出：%OUT%
echo 日志：%LOG%
pause
exit /b 0

:DO
set "IN=%~1"
set "DST=%~2"
set "W=%~3"
set "H=%~4"
set "OPT=%~5"
echo [run] "%TOOL%" -mt -m 6 -sharp_yuv %OPT% -resize %W% %H% "%IN%" -o "%DST%"
>>"%LOG%" echo [run] "%TOOL%" -mt -m 6 -sharp_yuv %OPT% -resize %W% %H% "%IN%" -o "%DST%"
"%TOOL%" -mt -m 6 -sharp_yuv %OPT% -resize %W% %H% "%IN%" -o "%DST%" 1>>"%LOG%" 2>&1
if errorlevel 1 (
  echo [error] 转换失败：%DST%（见日志） | (>>"%LOG%" findstr "^")
  goto :END_FAIL
)
echo [ok] %DST% | (>>"%LOG%" findstr "^")
goto :eof

:END_FAIL
echo.
echo === 失败（标准） ===
echo 请打开日志：%LOG%
pause
exit /b 1
@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

rem ===== 基本路径与输出 =====
set "ROOT=%~dp0"
set "TOOL=%ROOT%libwebp-1.6.0-windows-x64\bin\cwebp.exe"
set "OUT=%ROOT%outputImage_std"
set "LOG=%ROOT%webp_convert_std.log"

> "%LOG%" echo [start] %date% %time% ROOT="%ROOT%" OUT="%OUT%" TOOL="%TOOL%"
echo [start] %date% %time%

if not exist "%TOOL%" (
  echo [error] cwebp.exe 不存在：%TOOL% | (>>"%LOG%" findstr "^")
  goto :END_FAIL
)

echo [diag] cwebp 版本： | (>>"%LOG%" findstr "^")
"%TOOL%" -version 1>>"%LOG%" 2>&1
if errorlevel 1 (
  echo [error] 无法运行 cwebp | (>>"%LOG%" findstr "^")
  goto :END_FAIL
)

if not exist "%OUT%" mkdir "%OUT%"

rem ===== 5 大类的“最佳候选”与分数 =====
set "DAY_SRC="   & set /a DAY_SCORE=0
set "NIGHT_SRC=" & set /a NIGHT_SCORE=0
set "NORM_SRC="  & set /a NORM_SCORE=0
set "SPEC_SRC="  & set /a SPEC_SCORE=0
set "CLOUD_SRC=" & set /a CLOUD_SCORE=0

echo [scan] 开始遍历… | (>>"%LOG%" findstr "^")

for /R "%ROOT%" %%F in (*.tif *.tiff *.jpg *.jpeg *.png) do (
  set "F=%%~fF"
  set "FN=%%~nxF"

  rem ---- 排除工具与输出目录 ----
  echo !F! | findstr /i "\\libwebp-"        >nul && (echo [skip] tool  !F!>>"%LOG%" & goto :next)
  echo !F! | findstr /i "\\outputImage_"    >nul && (echo [skip] out   !F!>>"%LOG%" & goto :next)
  echo !F! | findstr /i "\\.git"            >nul && (echo [skip] git   !F!>>"%LOG%" & goto :next)

  rem ---- 分辨率线索：8k/4k/2k → 3/2/1 ----
  set /a res=0
  echo !FN! | findstr /i "8k 8192"  >nul && set /a res=3
  if !res! lss 3 echo !FN! | findstr /i "4k 4096" >nul && set /a res=2
  if !res! lss 2 echo !FN! | findstr /i "2k 2048" >nul && set /a res=1

  rem ---- 文件大小（MB）作为微调分：大图更优先 ----
  set /a mb=%%~zF / 1048576
  if !mb! lss 0 set /a mb=0

  rem ---- 统一基分（命中关键字才计分）= 1000*res + mb ----
  set /a base = 1000*!res! + !mb!

  rem ---- day / albedo / color / earth-dark / daymap ----
  echo !FN! | findstr /i "day albedo color daymap earth-dark" >nul && (
    if !base! gtr !DAY_SCORE! ( set "DAY_SCORE=!base!" & set "DAY_SRC=!F!" )
  )
  rem ---- night ----
  echo !FN! | findstr /i "night" >nul && (
    if !base! gtr !NIGHT_SCORE! ( set "NIGHT_SCORE=!base!" & set "NIGHT_SRC=!F!" )
  )
  rem ---- normal ----
  echo !FN! | findstr /i "normal" >nul && (
    if !base! gtr !NORM_SCORE! ( set "NORM_SCORE=!base!" & set "NORM_SRC=!F!" )
  )
  rem ---- specular / spec / gloss ----
  echo !FN! | findstr /i "specular spec gloss" >nul && (
    if !base! gtr !SPEC_SCORE! ( set "SPEC_SCORE=!base!" & set "SPEC_SRC=!F!" )
  )
  rem ---- cloud ----
  echo !FN! | findstr /i "cloud" >nul && (
    if !base! gtr !CLOUD_SCORE! ( set "CLOUD_SCORE=!base!" & set "CLOUD_SRC=!F!" )
  )
  :next
)

echo [pick] day   = "!DAY_SRC!"   (score=!DAY_SCORE!)   >>"%LOG%"
echo [pick] night = "!NIGHT_SRC!" (score=!NIGHT_SCORE!) >>"%LOG%"
echo [pick] normal= "!NORM_SRC!"  (score=!NORM_SCORE!)  >>"%LOG%"
echo [pick] spec  = "!SPEC_SRC!"  (score=!SPEC_SCORE!)  >>"%LOG%"
echo [pick] cloud = "!CLOUD_SRC!" (score=!CLOUD_SCORE!) >>"%LOG%"

for %%V in (DAY NIGHT NORM SPEC CLOUD) do (
  if not defined %%V_SRC (
    echo [error] 缺少源图：%%V_SRC%% | (>>"%LOG%" findstr "^")
    goto :END_FAIL
  )
)

echo [convert] 开始转换… | (>>"%LOG%" findstr "^")

call :DO "%DAY_SRC%"   "%OUT%\day.webp"      4096 2048 "-q 82"
call :DO "%NIGHT_SRC%" "%OUT%\night.webp"    4096 2048 "-q 82"
call :DO "%NORM_SRC%"  "%OUT%\normal.webp"   4096 2048 "-lossless -z 6"
call :DO "%SPEC_SRC%"  "%OUT%\specular.webp" 2048 1024 "-q 88"
call :DO "%CLOUD_SRC%" "%OUT%\clouds.webp"   2048 1024 "-q 90"

echo [done] OK >>"%LOG%"
echo.
echo === 成功（标准） ===
echo 输出：%OUT%
echo 日志：%LOG%
pause
exit /b 0

:DO
set "IN=%~1"
set "DST=%~2"
set "W=%~3"
set "H=%~4"
set "OPT=%~5"
echo [run] "%TOOL%" -mt -m 6 -sharp_yuv %OPT% -resize %W% %H% "%IN%" -o "%DST%"
>>"%LOG%" echo [run] "%TOOL%" -mt -m 6 -sharp_yuv %OPT% -resize %W% %H% "%IN%" -o "%DST%"
"%TOOL%" -mt -m 6 -sharp_yuv %OPT% -resize %W% %H% "%IN%" -o "%DST%" 1>>"%LOG%" 2>&1
if errorlevel 1 (
  echo [error] 转换失败：%DST%（见日志） | (>>"%LOG%" findstr "^")
  goto :END_FAIL
)
echo [ok] %DST% | (>>"%LOG%" findstr "^")
goto :eof

:END_FAIL
echo.
echo === 失败（标准） ===
echo 请打开日志：%LOG%
pause
exit /b 1
