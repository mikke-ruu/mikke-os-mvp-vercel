import { NextRequest, NextResponse } from "next/server";
import {
  BillingExclusionAdminError,
  grantAcademyBillingExclusion,
  listAcademyBillingExclusions,
  revokeAcademyBillingExclusion
} from "@/lib/hq/billing-exclusions-admin";

export const dynamic = "force-dynamic";

function accessToken(request: NextRequest) {
  const value = request.headers.get("authorization") ?? "";
  return /^Bearer [A-Za-z0-9._~-]{16,8192}$/.test(value) ? value.slice(7) : null;
}

function responseError(error: unknown) {
  const known = error instanceof BillingExclusionAdminError;
  return NextResponse.json({ error: known ? error.message : "課金対象外設定を処理できませんでした。" }, { status: known ? error.status : 500 });
}

export async function GET(request: NextRequest) {
  const token = accessToken(request);
  if (!token) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  try {
    return NextResponse.json(await listAcademyBillingExclusions(token), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: NextRequest) {
  const token = accessToken(request);
  if (!token) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const value = body as Record<string, unknown>;
  try {
    if (value.action === "grant" && Object.keys(value).sort().join(",") === "action,effectiveUntil,headquartersId,reason,targetHandle") {
      if (typeof value.headquartersId !== "string" || typeof value.targetHandle !== "string" || typeof value.reason !== "string" || (value.effectiveUntil !== null && typeof value.effectiveUntil !== "string")) throw new BillingExclusionAdminError(400, "入力内容を確認してください。");
      return NextResponse.json(await grantAcademyBillingExclusion(token, { headquartersId: value.headquartersId, targetHandle: value.targetHandle, reason: value.reason, effectiveUntil: value.effectiveUntil as string | null }));
    }
    if (value.action === "revoke" && Object.keys(value).sort().join(",") === "action,exclusionId,reason") {
      if (typeof value.exclusionId !== "string" || typeof value.reason !== "string") throw new BillingExclusionAdminError(400, "入力内容を確認してください。");
      return NextResponse.json(await revokeAcademyBillingExclusion(token, { exclusionId: value.exclusionId, reason: value.reason }));
    }
    throw new BillingExclusionAdminError(400, "入力内容を確認してください。");
  } catch (error) {
    return responseError(error);
  }
}
