import { NextResponse } from "next/server";
import {
  AcademyHeadquartersCreationError,
  createAcademyHeadquartersFromPlatformEntitlement
} from "@/lib/academy/headquarters-creation-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    return json({ ok: false, error: "ログインが必要です。" }, 401);
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "リクエストの形式が不正です。" }, 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return json({ ok: false, error: "本部名を100文字以内で入力してください。" }, 400);
  }

  try {
    const headquarters = await createAcademyHeadquartersFromPlatformEntitlement({ accessToken, name });
    return json({ ok: true, headquarters }, 200);
  } catch (error) {
    if (error instanceof AcademyHeadquartersCreationError) {
      return json({ ok: false, error: error.message }, error.status);
    }
    return json({ ok: false, error: "本部を作成できませんでした。時間をおいてもう一度お試しください。" }, 500);
  }
}
