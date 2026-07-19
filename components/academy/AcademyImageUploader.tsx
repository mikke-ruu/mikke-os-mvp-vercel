"use client";

// Wave C (AC-C5): Academy内の画像入力をMikkeMediaPickerへ統一するための薄いラッパー。
// components/page/PageImageUploader.tsx のパターンを参考にしているが、Academyのブロック型は
// 画像URLを単純な文字列で保持するため、ここではpublicUrlだけを呼び出し元へ返す。
// 過去に保存された文字列URLはそのままcurrentUrlとして表示され、選択し直すと上書きされる
// （段階移行。既存データを壊さない）。
import { MikkeMediaPicker } from "@/components/media/MikkeMediaPicker";

export function AcademyImageUploader({ currentUrl, onUploaded, compact = false }: {
  currentUrl?: string;
  onUploaded: (url: string) => void;
  compact?: boolean;
}) {
  return (
    <MikkeMediaPicker
      currentUrl={currentUrl || undefined}
      sourceApp="academy"
      compact={compact}
      onSelect={(asset) => onUploaded(asset.publicUrl)}
    />
  );
}
