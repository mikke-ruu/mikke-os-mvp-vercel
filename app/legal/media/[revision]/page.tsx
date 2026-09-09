import { notFound } from "next/navigation";

// Real legal revisions are added only after approval and matched to the DB digest.
// This synthetic document is confined to local Auth/UI verification.
export default async function MediaLegalDocument({params}:{params:Promise<{revision:string}>}) {
  const {revision}=await params;
  if(process.env.NODE_ENV!=="development"||revision!=="local-media-test-v1")notFound();
  return <main className="mx-auto max-w-3xl px-5 py-12"><h1 className="text-2xl font-bold">動作確認用の架空規約</h1><p className="mt-5">この文書はローカル検証専用です。実際の利用条件や契約ではありません。</p><pre className="mt-5 whitespace-pre-wrap">Media local test terms. Not a legal agreement.</pre></main>;
}
