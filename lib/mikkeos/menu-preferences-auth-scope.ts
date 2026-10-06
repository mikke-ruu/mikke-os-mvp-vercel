type MenuSession = { user: { id: string }; access_token: string };

/** 認証が一度でも切り替われば、同じ本人に戻っても古い操作を復活させない。 */
export function createMikkeMenuAuthScope() {
  let epoch = 0;
  let identity: string | null | undefined;
  let session: MenuSession | null = null;
  return {
    observe(next: MenuSession | null) {
      const nextIdentity = next?.user.id ?? null;
      session = next;
      if (identity !== nextIdentity) {
        identity = nextIdentity;
        epoch++;
      }
    },
    capture(expectedActor: string) {
      const capturedEpoch = epoch;
      function assertCurrent() {
        if (!expectedActor || capturedEpoch !== epoch || session?.user.id !== expectedActor) {
          throw new Error("ログイン状態が変わりました。画面を開き直してください。");
        }
      }
      assertCurrent();
      return {
        assertCurrent,
        accessToken() {
          assertCurrent();
          return session!.access_token;
        }
      };
    }
  };
}

export async function runWithMikkeMenuLease<T>(
  lease: ReturnType<ReturnType<typeof createMikkeMenuAuthScope>["capture"]>,
  operation: () => Promise<T>
): Promise<T> {
  lease.assertCurrent();
  const result = await operation();
  lease.assertCurrent();
  return result;
}
