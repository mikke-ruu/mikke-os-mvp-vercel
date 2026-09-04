import type { AcademyHeadquartersAccess } from "@/types/database";

export type AcademyAccessNotice = {
  title: string;
  description: string;
  mutationMessage: string;
};

export function getAcademyAccessNotice(
  access: AcademyHeadquartersAccess | null
): AcademyAccessNotice | null {
  if (!access || access.can_manage_drafts) return null;

  if (access.access_kind === "trial") {
    return {
      title: "7日間お試しは終了しました",
      description: "作成した下書きは残っています。有料利用を申し込むまで閲覧のみです。無料期間の終了だけで自動課金されることはありません。",
      mutationMessage: "7日間お試しは終了しています。有料利用を開始するまで変更できません。自動課金はされていません。",
    };
  }

  if (access.status === "past_due") {
    return {
      title: "お支払い状況の確認が必要です",
      description: "現在は閲覧のみです。本部設定の「Academy利用料金」から契約情報を確認してください。",
      mutationMessage: "お支払い状況の確認が必要なため、現在は変更できません。本部設定の「Academy利用料金」を確認してください。",
    };
  }

  if (access.status === "ended" || access.status === "cancelled") {
    return {
      title: "Academyの利用期間は終了しています",
      description: "保存済みの内容は保持されています。本部設定の「Academy利用料金」から利用再開の手続きを確認できます。",
      mutationMessage: "Academyの利用期間が終了しているため、現在は変更できません。本部設定の「Academy利用料金」を確認してください。",
    };
  }

  return {
    title: "Academyの契約情報を確認しています",
    description: "以前から利用している本部の契約情報を確認できないため、現在は閲覧のみです。保存内容は消えていません。本部設定の「Academy利用料金」を確認してください。",
    mutationMessage: "Academyの契約情報を確認できないため、現在は変更できません。本部設定の「Academy利用料金」を確認してください。",
  };
}
