import { supabase } from "@/lib/supabase/client";
import { isAcademyLocalReview } from "./preview";
import type { AcademyPrivateMaterialParent, AcademyPrivateMaterialAsset, AcademyPrivateInstructorMaterialInput, AcademyPrivateInstructorMaterial } from "./private-material-contract";

async function identity(expectedUserId: string) {
  if (isAcademyLocalReview()) throw new Error("サンプル画面ではファイルを送信・取得できません。");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) throw new Error("ログイン状態が変わりました。画面を開き直してください。");
  return data.session.access_token;
}

async function request(path: string, userId: string, init: RequestInit = {}) {
  const token = await identity(userId);
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000), headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error("通信を確認できませんでした。送信した場合は、一覧を再確認してから再試行してください。");
  }
  await identity(userId);
  if (!response.ok) {
    if (response.status === 503) throw new Error("ファイル機能は準備中です。現在は利用できません。");
    if (response.status === 401) throw new Error("ログインし直してからお試しください。");
    if (response.status === 403 || response.status === 404) throw new Error("資料を利用できません。公開状態と閲覧権限をご確認ください。");
    if (response.status === 413) throw new Error("PDFは3MB以下で選択してください。");
    throw new Error("処理できませんでした。PDFの形式と入力内容をご確認ください。");
  }
  return response;
}
const endpoint = (parent: AcademyPrivateMaterialParent) => `/api/academy/private-materials?${new URLSearchParams(parent)}`;
export async function listPrivateMaterials(parent: AcademyPrivateMaterialParent, userId: string) {
  const response = await request(endpoint(parent), userId);
  return (await response.json() as { assets: AcademyPrivateMaterialAsset[] }).assets;
}
export async function uploadPrivateMaterial(parent: AcademyPrivateMaterialParent, file: File, userId: string) {
  const response = await request(endpoint(parent), userId, { method: "POST", headers: { "Content-Type": "application/pdf", "X-Academy-Filename": encodeURIComponent(file.name) }, body: file });
  return (await response.json() as { asset: AcademyPrivateMaterialAsset }).asset;
}
export async function createPrivateInstructorMaterial(input: AcademyPrivateInstructorMaterialInput, userId: string) {
  const response = await request("/api/academy/private-materials/instructor-parent", userId, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  return (await response.json() as { material: AcademyPrivateInstructorMaterial }).material;
}
export async function downloadPrivateMaterial(asset: AcademyPrivateMaterialAsset, userId: string) {
  const response = await request(`/api/academy/private-materials/${encodeURIComponent(asset.id)}`, userId);
  const blob = await response.blob();
  await identity(userId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = asset.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
