export function canRenderManagerAccount(userId?: string | null, profileUserId?: string | null): boolean {
  return Boolean(userId && profileUserId && userId === profileUserId);
}
