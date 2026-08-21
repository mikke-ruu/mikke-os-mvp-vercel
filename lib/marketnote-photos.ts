import { isMarketNoteGuestProfile } from "@/lib/marketnote-guest";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const bucket = "marketnote-photos";
const databaseName = "mikke-marketnote-photos-v1";
const storeName = "photos";

export const maxMarketNotePhotos = 3;

export type MarketNotePhoto = {
  id: string;
  marketEventId: string;
  storagePath: string | null;
  imageUrl: string;
  createdAt: string;
  guest: boolean;
};

export type MarketNotePhotoPreviewMap = Record<string, MarketNotePhoto>;

export type MarketNotePhotoDeletionPlan = {
  id: string;
  ownerKey: string;
  guestPhotoIds: string[];
  storagePaths: string[];
};

type GuestPhotoRecord = {
  id: string;
  marketEventId: string;
  blob: Blob;
  createdAt: string;
};

type PhotoRow = {
  id: string;
  market_event_id: string;
  storage_path: string;
  created_at: string;
};

export async function listMarketNotePhotos(profile: Profile, marketEventId: string): Promise<MarketNotePhoto[]> {
  if (isMarketNoteGuestProfile(profile)) {
    const records = await listGuestPhotoRecords(marketEventId);
    return Promise.all(records.map(async (record) => ({
      id: record.id,
      marketEventId: record.marketEventId,
      storagePath: null,
      imageUrl: await blobToDataUrl(record.blob),
      createdAt: record.createdAt,
      guest: true
    })));
  }

  const { data, error } = await supabase
    .from("market_reflection_photos")
    .select("id, market_event_id, storage_path, created_at")
    .eq("profile_id", profile.id)
    .eq("market_event_id", marketEventId)
    .order("sort_order")
    .order("created_at");

  if (error) throw error;

  return Promise.all((data as PhotoRow[] ?? []).map(async (row) => {
    const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, 60 * 60);
    if (signedError) throw signedError;
    return {
      id: row.id,
      marketEventId: row.market_event_id,
      storagePath: row.storage_path,
      imageUrl: signed.signedUrl,
      createdAt: row.created_at,
      guest: false
    };
  }));
}

export async function listMarketNotePhotoPreviews(
  profile: Profile,
  marketEventIds: string[]
): Promise<MarketNotePhotoPreviewMap> {
  const eventIds = Array.from(new Set(marketEventIds.filter(Boolean)));
  if (eventIds.length === 0) return {};

  if (isMarketNoteGuestProfile(profile)) {
    const wanted = new Set(eventIds);
    const records = (await listAllGuestPhotoRecords())
      .filter((record) => wanted.has(record.marketEventId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const previews: MarketNotePhotoPreviewMap = {};
    for (const record of records) {
      if (previews[record.marketEventId]) continue;
      previews[record.marketEventId] = {
        id: record.id,
        marketEventId: record.marketEventId,
        storagePath: null,
        imageUrl: await blobToDataUrl(record.blob),
        createdAt: record.createdAt,
        guest: true
      };
    }
    return previews;
  }

  const { data, error } = await supabase
    .from("market_reflection_photos")
    .select("id, market_event_id, storage_path, created_at")
    .eq("profile_id", profile.id)
    .in("market_event_id", eventIds)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  const firstRows = new Map<string, PhotoRow>();
  for (const row of (data as PhotoRow[] ?? [])) {
    if (!firstRows.has(row.market_event_id)) firstRows.set(row.market_event_id, row);
  }

  const previews: MarketNotePhotoPreviewMap = {};
  await Promise.all(Array.from(firstRows.values()).map(async (row) => {
    const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, 60 * 60);
    if (signedError) throw signedError;
    previews[row.market_event_id] = {
      id: row.id,
      marketEventId: row.market_event_id,
      storagePath: row.storage_path,
      imageUrl: signed.signedUrl,
      createdAt: row.created_at,
      guest: false
    };
  }));
  return previews;
}

export async function addMarketNotePhoto(profile: Profile, marketEventId: string, file: File) {
  const blob = await compressPhoto(file);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (isMarketNoteGuestProfile(profile)) {
    await putGuestPhotoRecord({ id, marketEventId, blob, createdAt });
    return;
  }

  const storagePath = `${profile.user_id}/${marketEventId}/${id}.webp`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, blob, {
    contentType: "image/webp",
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("market_reflection_photos").insert({
    id,
    user_id: profile.user_id,
    profile_id: profile.id,
    market_event_id: marketEventId,
    storage_path: storagePath
  });

  if (insertError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    throw insertError;
  }
}

export async function deleteMarketNotePhoto(photo: MarketNotePhoto) {
  if (photo.guest) {
    await deleteGuestPhotoRecord(photo.id);
    return;
  }
  if (!photo.storagePath) return;

  const { error: deleteError } = await supabase
    .from("market_reflection_photos")
    .delete()
    .eq("id", photo.id);
  if (deleteError) throw deleteError;

  const { error: storageError } = await supabase.storage.from(bucket).remove([photo.storagePath]);
  if (storageError) throw storageError;
}

const pendingCleanupKey = "mikke-marketnote-photo-cleanup-v1";

export async function prepareMarketNotePhotoDeletion(profile: Profile, marketEventId: string): Promise<MarketNotePhotoDeletionPlan> {
  if (isMarketNoteGuestProfile(profile)) {
    const records = await listGuestPhotoRecords(marketEventId);
    return {
      id: `${profile.user_id}:${marketEventId}`,
      ownerKey: profile.user_id,
      guestPhotoIds: records.map((record) => record.id),
      storagePaths: []
    };
  }

  const { data, error } = await supabase
    .from("market_reflection_photos")
    .select("storage_path")
    .eq("profile_id", profile.id)
    .eq("market_event_id", marketEventId);
  if (error) throw error;

  return {
    id: `${profile.user_id}:${marketEventId}`,
    ownerKey: profile.user_id,
    guestPhotoIds: [],
    storagePaths: (data ?? [])
      .map((row) => String(row.storage_path ?? ""))
      .filter(Boolean)
  };
}

export async function completeMarketNotePhotoDeletion(plan: MarketNotePhotoDeletionPlan) {
  try {
    await Promise.all(plan.guestPhotoIds.map((id) => deleteGuestPhotoRecord(id)));
    if (plan.storagePaths.length > 0) {
      const { error } = await supabase.storage.from(bucket).remove(plan.storagePaths);
      if (error) throw error;
    }
    removePendingCleanup(plan.id);
    return true;
  } catch {
    savePendingCleanup(plan);
    return false;
  }
}

export async function retryPendingMarketNotePhotoCleanup(profile: Profile) {
  const plans = readPendingCleanups().filter((plan) => plan.ownerKey === profile.user_id);
  if (plans.length === 0) return false;

  for (const plan of plans) {
    await completeMarketNotePhotoDeletion(plan);
  }
  return readPendingCleanups().some((plan) => plan.ownerKey === profile.user_id);
}

function readPendingCleanups(): MarketNotePhotoDeletionPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pendingCleanupKey) ?? "[]") as MarketNotePhotoDeletionPlan[];
    return Array.isArray(parsed) ? parsed.filter((plan) => plan && typeof plan.id === "string") : [];
  } catch {
    return [];
  }
}

function savePendingCleanup(plan: MarketNotePhotoDeletionPlan) {
  if (typeof window === "undefined") return;
  try {
    const plans = readPendingCleanups().filter((current) => current.id !== plan.id);
    window.localStorage.setItem(pendingCleanupKey, JSON.stringify([...plans, plan]));
  } catch {
    // The deleted event remains private even if the browser refuses the retry queue.
  }
}

function removePendingCleanup(planId: string) {
  if (typeof window === "undefined") return;
  try {
    const plans = readPendingCleanups().filter((plan) => plan.id !== planId);
    if (plans.length === 0) window.localStorage.removeItem(pendingCleanupKey);
    else window.localStorage.setItem(pendingCleanupKey, JSON.stringify(plans));
  } catch {
    // A stale retry marker is harmless and will be retried on the next visit.
  }
}

export async function importGuestMarketNotePhotos(profile: Profile, eventIdMap: Map<string, string>) {
  if (isMarketNoteGuestProfile(profile)) return 0;
  const records = await listAllGuestPhotoRecords();
  let imported = 0;

  for (const record of records) {
    const marketEventId = eventIdMap.get(record.marketEventId);
    if (!marketEventId) continue;
    const storagePath = `${profile.user_id}/${marketEventId}/${record.id}.webp`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, record.blob, {
      contentType: "image/webp",
      upsert: true
    });
    if (uploadError) throw uploadError;

    const { error: rowError } = await supabase.from("market_reflection_photos").upsert({
      id: record.id,
      user_id: profile.user_id,
      profile_id: profile.id,
      market_event_id: marketEventId,
      storage_path: storagePath
    }, { onConflict: "id" });
    if (rowError) throw rowError;

    await deleteGuestPhotoRecord(record.id);
    imported += 1;
  }

  return imported;
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("画像ファイルを選んでください。");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を読み込めませんでした。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob) throw new Error("画像を保存用に変換できませんでした。");
    if (blob.size > 4 * 1024 * 1024) throw new Error("画像の容量が大きすぎます。");
    return blob;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("この画像形式は読み込めません。"));
    image.src = sourceUrl;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("写真を読み込めませんでした。"));
    reader.readAsDataURL(blob);
  });
}

function openPhotoDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "id" });
        store.createIndex("marketEventId", "marketEventId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("写真の端末保存を開始できませんでした。"));
  });
}

async function listGuestPhotoRecords(marketEventId: string) {
  const database = await openPhotoDatabase();
  try {
    return await new Promise<GuestPhotoRecord[]>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).index("marketEventId").getAll(marketEventId);
      request.onsuccess = () => resolve((request.result as GuestPhotoRecord[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      request.onerror = () => reject(request.error ?? new Error("写真を読み込めませんでした。"));
    });
  } finally {
    database.close();
  }
}

async function listAllGuestPhotoRecords() {
  const database = await openPhotoDatabase();
  try {
    return await new Promise<GuestPhotoRecord[]>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as GuestPhotoRecord[]);
      request.onerror = () => reject(request.error ?? new Error("写真を読み込めませんでした。"));
    });
  } finally {
    database.close();
  }
}

async function putGuestPhotoRecord(record: GuestPhotoRecord) {
  const database = await openPhotoDatabase();
  try {
    await runGuestPhotoRequest(database, "readwrite", (store) => store.put(record));
  } finally {
    database.close();
  }
}

async function deleteGuestPhotoRecord(id: string) {
  const database = await openPhotoDatabase();
  try {
    await runGuestPhotoRequest(database, "readwrite", (store) => store.delete(id));
  } finally {
    database.close();
  }
}

function runGuestPhotoRequest(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  makeRequest: (store: IDBObjectStore) => IDBRequest
) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = makeRequest(transaction.objectStore(storeName));
    request.onerror = () => reject(request.error ?? new Error("写真を端末に保存できませんでした。"));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("写真を端末に保存できませんでした。"));
  });
}
