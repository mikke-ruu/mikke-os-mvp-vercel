param([switch]$Run, [switch]$AuthPreflightConfirmed)
$ErrorActionPreference = 'Stop'
$mediaRef = 'ydwvaljzorgwmqihvocf'
if (-not $Run -or -not $AuthPreflightConfirmed) {
  Write-Output 'NOT_RUN_EXPLICIT_RUN_AND_AUTH_PREFLIGHT_REQUIRED'
  exit 1
}
if ([DateTime]::UtcNow -ge [DateTime]::Parse('2026-09-07T13:59:05Z').ToUniversalTime()) {
  Write-Output 'NOT_RUN_BRANCH_DEADLINE_EXPIRED'
  exit 1
}
$mediaEnvNames = @('MEDIA_TEST_URL', 'MEDIA_TEST_PUBLIC_KEY', 'MEDIA_TEST_ADMIN_KEY', 'MEDIA_TEST_DB_READY', 'MEDIA_TEST_AUTH_PREFLIGHT')
$mediaExit = 1
try {
  # CLI credentials remain in the official CLI. Capture all branch secrets in
  # process memory; never echo the JSON or write it to a file.
  $mediaRaw = & 'G:/Musubiプロジェクト/mikke-os-mvp-db-baseline-20260829/.tools/supabase-2.116.0/supabase.exe' branches get 324a8009-452b-4268-bcb5-6c96cb582b20 --project-ref nttqpprkqbynxyldbnjs -o json 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'CLI_FAILED' }
  $mediaConfig = ($mediaRaw -join "`n") | ConvertFrom-Json
  if ($mediaConfig.SUPABASE_URL -ne "https://$mediaRef.supabase.co") { throw 'TARGET_REJECTED' }
  $env:MEDIA_TEST_URL = $mediaConfig.SUPABASE_URL
  $env:MEDIA_TEST_PUBLIC_KEY = $mediaConfig.SUPABASE_ANON_KEY
  $env:MEDIA_TEST_ADMIN_KEY = $mediaConfig.SUPABASE_SERVICE_ROLE_KEY
  $env:MEDIA_TEST_DB_READY = $mediaRef
  $env:MEDIA_TEST_AUTH_PREFLIGHT = $mediaRef
  & 'C:/Program Files/nodejs/node.exe' (Join-Path $PSScriptRoot 'media-free-auth-e2e.mjs') --run
  $mediaExit = $LASTEXITCODE
} catch {
  Write-Output 'FAIL_SAFE_BRANCH_RUNNER_LAUNCH'
} finally {
  foreach ($mediaEnvName in $mediaEnvNames) {
    [Environment]::SetEnvironmentVariable($mediaEnvName, $null, 'Process')
  }
  $mediaRaw = $null
  $mediaConfig = $null
}
exit $mediaExit
