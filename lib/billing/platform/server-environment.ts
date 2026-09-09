// The HTTP exception is opt-in, development-only and limited to one exact local origin.
export function isAllowedPlatformSupabaseUrl(value: string, mode: string | undefined, localOrigin: string | undefined) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return mode === 'development'
      && value === localOrigin
      && /^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(value)
      && url.origin === value
      && Number(url.port) > 0 && Number(url.port) <= 65535;
  } catch { return false; }
}
