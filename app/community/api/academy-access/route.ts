import { NextResponse } from "next/server";
import {
  cancelCommunityAcademyInstructorInvitation,
  CommunityAcademyAccessError,
  declineCommunityAcademyInstructorInvitation,
  issueCommunityAcademyInstructorInvitation,
  readCommunityAcademyReleaseOverview
} from "@/lib/community/academy-access-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const policyKeyPattern = /^[a-z][a-z0-9_]{2,63}$/;
const maximumMutationBodyBytes = 8192;

class MutationBodyTooLargeError extends Error {}

async function readMutationBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) throw new Error("Request body is required");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maximumMutationBodyBytes) {
        await reader.cancel("Mutation body exceeds the byte limit");
        throw new MutationBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON object is required");
  return value as Record<string, unknown>;
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Authorization, Origin",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function accessToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) return null;
  return authorization.slice("Bearer ".length);
}

function mutationOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  return origin === new URL(request.url).origin;
}

function errorResponse(error: unknown) {
  if (error instanceof CommunityAcademyAccessError) {
    return json({ ok: false, error: error.message }, error.status);
  }
  return json({ ok: false, error: "Community連携を処理できませんでした。時間をおいてもう一度お試しください。" }, 500);
}

export async function GET(request: Request) {
  const token = accessToken(request);
  if (!token) return json({ ok: false, error: "ログインが必要です。" }, 401);

  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => !["headquartersId", "communityId"].includes(key))) {
    return json({ ok: false, error: "リクエストの形式が不正です。" }, 400);
  }
  const headquartersId = params.get("headquartersId");
  const communityId = params.get("communityId");
  if (!headquartersId || !communityId || !uuidPattern.test(headquartersId) || !uuidPattern.test(communityId)) {
    return json({ ok: false, error: "本部とCommunityを確認できませんでした。" }, 400);
  }

  try {
    const overview = await readCommunityAcademyReleaseOverview({
      accessToken: token,
      headquartersId,
      communityId
    });
    return json({ ok: true, overview }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const token = accessToken(request);
  if (!token) return json({ ok: false, error: "ログインが必要です。" }, 401);
  if (!mutationOriginAllowed(request)) return json({ ok: false, error: "この操作元を確認できませんでした。" }, 403);

  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumMutationBodyBytes)) {
    return json({ ok: false, error: "リクエストが大きすぎます。" }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = await readMutationBody(request);
  } catch (error) {
    if (error instanceof MutationBodyTooLargeError) {
      return json({ ok: false, error: "リクエストが大きすぎます。" }, 413);
    }
    return json({ ok: false, error: "リクエストの形式が不正です。" }, 400);
  }

  try {
    if (body.action === "issue") {
      const allowedKeys = ["action", "headquartersId", "communityId", "mappingId", "instructorId", "roomIds", "policyKey"];
      if (Object.keys(body).some((key) => !allowedKeys.includes(key))
        || typeof body.headquartersId !== "string" || !uuidPattern.test(body.headquartersId)
        || typeof body.communityId !== "string" || !uuidPattern.test(body.communityId)
        || typeof body.mappingId !== "string" || !uuidPattern.test(body.mappingId)
        || typeof body.instructorId !== "string" || !uuidPattern.test(body.instructorId)
        || typeof body.policyKey !== "string" || !policyKeyPattern.test(body.policyKey)
        || !Array.isArray(body.roomIds) || body.roomIds.length < 1 || body.roomIds.length > 100
        || body.roomIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))
        || new Set(body.roomIds).size !== body.roomIds.length) {
        return json({ ok: false, error: "招待内容を確認できませんでした。" }, 400);
      }
      const invitation = await issueCommunityAcademyInstructorInvitation({
        accessToken: token,
        headquartersId: body.headquartersId,
        communityId: body.communityId,
        mappingId: body.mappingId,
        instructorId: body.instructorId,
        roomIds: body.roomIds as string[],
        policyKey: body.policyKey
      });
      return json({ ok: true, invitation }, invitation.reused ? 200 : 201);
    }

    if (body.action === "cancel") {
      const allowedKeys = ["action", "headquartersId", "communityId", "invitationId"];
      if (Object.keys(body).some((key) => !allowedKeys.includes(key))
        || typeof body.headquartersId !== "string" || !uuidPattern.test(body.headquartersId)
        || typeof body.communityId !== "string" || !uuidPattern.test(body.communityId)
        || typeof body.invitationId !== "string" || !uuidPattern.test(body.invitationId)) {
        return json({ ok: false, error: "取消対象を確認できませんでした。" }, 400);
      }
      const status = await cancelCommunityAcademyInstructorInvitation({
        accessToken: token,
        headquartersId: body.headquartersId,
        communityId: body.communityId,
        invitationId: body.invitationId
      });
      return json({ ok: true, status }, 200);
    }

    if (body.action === "decline") {
      const allowedKeys = ["action", "invitationId"];
      if (Object.keys(body).some((key) => !allowedKeys.includes(key))
        || typeof body.invitationId !== "string" || !uuidPattern.test(body.invitationId)) {
        return json({ ok: false, error: "招待を確認できませんでした。" }, 400);
      }
      const status = await declineCommunityAcademyInstructorInvitation({
        accessToken: token,
        invitationId: body.invitationId
      });
      return json({ ok: true, status }, 200);
    }

    return json({ ok: false, error: "対応していない操作です。" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
