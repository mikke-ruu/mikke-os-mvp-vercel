import { redirect } from "next/navigation";

/**
 * DESKは未公開。他アプリが揃ってから収支を集約する計画のため、
 * それまで本番では開けないようにする（/os と同じ扱い）。
 */
export default function DeskPage() {
  redirect("https://mikke-os.com/");
}
