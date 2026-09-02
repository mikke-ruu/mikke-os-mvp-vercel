import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { AcademyHeadquarters } from "@/types/database";

const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false
} as const;

export class AcademyHeadquartersCreationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AcademyHeadquartersCreationError";
  }
}

function getEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secretKey) {
    throw new AcademyHeadquartersCreationError(503, "本部作成を現在利用できません。時間をおいてもう一度お試しください。");
  }
  return { url, publicKey, secretKey };
}

export async function createAcademyHeadquartersFromPlatformEntitlement(input: {
  accessToken: string;
  name: string;
}) {
  const { url, publicKey, secretKey } = getEnvironment();
  const userClient = createClient(url, publicKey, {
    auth: serverAuthOptions,
    global: { headers: { Authorization: `Bearer ${input.accessToken}` } }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(input.accessToken);
  if (userError || !userData.user) {
    throw new AcademyHeadquartersCreationError(401, "ログインを確認できませんでした。もう一度ログインしてください。");
  }
  if (userData.user.is_anonymous) {
    throw new AcademyHeadquartersCreationError(403, "登録済みのアカウントでログインしてください。");
  }

  const adminClient = createClient(url, secretKey, { auth: serverAuthOptions });
  const { data, error } = await adminClient.rpc(
    "academy_create_headquarters_with_platform_entitlement",
    { p_actor_user_id: userData.user.id, p_name: input.name }
  );
  if (error || !data) {
    throw new AcademyHeadquartersCreationError(
      409,
      "有効なAcademy利用申込みを確認できませんでした。請求状況を確認してから、もう一度お試しください。"
    );
  }
  return data as AcademyHeadquarters;
}
