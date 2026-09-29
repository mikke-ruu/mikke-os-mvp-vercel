import { NextResponse } from "next/server";
import {
  AcademyCommunityClaimStopError,
  stopAcademyCommunityClaims
} from "@/lib/academy/community-link-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  if (!accessToken) return json({ ok: false, stoppedCount: 0, error: "ログインが必要です。" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, stoppedCount: 0, error: "リクエストの形式が不正です。" }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, stoppedCount: 0, error: "リクエストの形式が不正です。" }, 400);
  }
  const { headquartersId, mappingId } = body as Record<string, unknown>;
  if (
    typeof headquartersId !== "string"
    || typeof mappingId !== "string"
    || !uuidPattern.test(headquartersId)
    || !uuidPattern.test(mappingId)
  ) {
    return json({ ok: false, stoppedCount: 0, error: "接続情報を確認できませんでした。画面を再読み込みしてください。" }, 400);
  }

  try {
    const result = await stopAcademyCommunityClaims({
      accessToken,
      headquartersId,
      mappingId
    });
    return json({ ok: true, stoppedCount: result.stoppedCount }, 200);
  } catch (error) {
    if (error instanceof AcademyCommunityClaimStopError) {
      return json({ ok: false, stoppedCount: error.stoppedCount, error: error.message }, error.status);
    }
    return json({ ok: false, stoppedCount: 0, error: "利用権を停止できませんでした。時間をおいてもう一度お試しください。" }, 500);
  }
}
