import { privateMaterialDownload } from '@/lib/academy/private-material-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request: Request,{params}:{params:Promise<{assetId:string}>}) {
  return privateMaterialDownload(request,(await params).assetId);
}
