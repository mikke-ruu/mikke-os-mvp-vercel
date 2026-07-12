@echo off
setlocal
cd /d "%~dp0"

echo Team Works を開く準備をしています...
echo.

start "Mikke OS 開発サーバー" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$paths=@('/apps/team-works','/apps/team-works/portal/worker','/apps/team-works/assignments','/apps/team-works/sessions','/apps/team-works/reports','/apps/team-works/payouts');" ^
  "$ports=@(3000,3001,3002);" ^
  "$found=$null;" ^
  "for($i=0;$i -lt 90 -and -not $found;$i++){" ^
  "  foreach($port in $ports){" ^
  "    try{" ^
  "      $url='http://127.0.0.1:'+$port+'/apps/team-works';" ^
  "      $res=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2;" ^
  "      if($res.StatusCode -eq 200){$found=$port; break}" ^
  "    } catch {}" ^
  "  }" ^
  "  if(-not $found){Start-Sleep -Seconds 2}" ^
  "}" ^
  "if($found){" ^
  "  foreach($path in $paths){Start-Process ('http://localhost:'+$found+$path)}" ^
  "} else {" ^
  "  Add-Type -AssemblyName PresentationFramework;" ^
  "  [System.Windows.MessageBox]::Show('画面を自動で開けませんでした。開発サーバーの黒い画面に表示された Local: http://localhost:XXXX を確認してください。','Team Works')" ^
  "}"

echo.
echo ブラウザが開いたら、この画面は閉じて大丈夫です。
pause
