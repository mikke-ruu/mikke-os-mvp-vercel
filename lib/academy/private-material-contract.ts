export const ACADEMY_PRIVATE_PDF_MAX_BYTES = 3 * 1024 * 1024;
export type AcademyPrivateMaterialAudience = 'learner' | 'instructor';
export type AcademyPrivateMaterialParent = { audience: AcademyPrivateMaterialAudience; parentId: string };
export type AcademyPrivateInstructorMaterialInput = {
  courseId: string; title: string; requiresActive: boolean; isPublished: boolean;
};
export type AcademyPrivateInstructorMaterial = AcademyPrivateInstructorMaterialInput & {
  id: string; deliveryMode: 'private_file'; url: null;
};
export type AcademyPrivateMaterialAsset = AcademyPrivateMaterialParent & {
  id: string;
  originalName: string;
  byteSize: number;
  createdAt: string;
};
export const isAssetUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function privateMaterialParent(url: URL): AcademyPrivateMaterialParent | null {
  const audience = url.searchParams.get('audience');
  const parentId = url.searchParams.get('parentId') ?? '';
  return (audience === 'learner' || audience === 'instructor') && isAssetUuid(parentId) ? { audience, parentId } : null;
}
export function pdfFilename(header: string | null): string | null {
  try {
    const name = decodeURIComponent(header ?? '').normalize('NFC').trim();
    return name.length > 0 && name.length <= 160 && /\.pdf$/i.test(name) && !/[\x00-\x1f\x7f/\\]/.test(name) ? name : null;
  } catch { return null; }
}
// Basic container validation, not a malware scan. Always delivered as attachment.
export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length > 8 && bytes.length <= ACADEMY_PRIVATE_PDF_MAX_BYTES
    && new TextDecoder().decode(bytes.subarray(0,8)).match(/^%PDF-[12]\.[0-9]/) !== null
    && new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-1024))).includes('%%EOF');
}
