import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";
import type { InstructorApplicationView } from "./instructor-application-view.mjs";

export type InstructorApplicationSummary = {
  applicationId: string; learnerName: string; planTitle: string; statusLabel: string;
  nextAction: string | null; headquartersId: string; headquartersName: string; activityId: string;
  completionReport: string; certification: string; scheduleStartsAt: string | null; scheduleEndsAt: string | null; format: string | null; eventId: null; appliedAt: string;
};
export type InstructorApplicationDetailData = {
  view: InstructorApplicationView; revision: number; allowedActions: string[];
  headquartersId: string; headquartersName: string; activityId: string;
  details: { statusLabel: string; appliedAt: string; shippingAddress?: string;
    kitDestination?: { recipient: "instructor" | "learner" | null; options: { id: string; label: string; address: string }[]; selectedAddress: string | null; selectedAddressId: string | null };
    shippedAt?: string; trackingNumber?: string; licenseIncludes?: string[];
    scheduleInput?: { date: string; startsAt: string; endsAt: string; onlineUrl: string } };
};
export type InstructorOperationCommand = {
  type: "confirm_tuition" | "confirm_schedule" | "record_attendance" | "submit_completion" | "record_shipping" | "confirm_certification" | "set_kit_destination";
  payload?: { startsAt?: string; endsAt?: string; onlineUrl?: string; report?: string;
    addressId?: string; trackingNumber?: string; shippedAt?: string };
};
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const messages: Record<string, string> = {
      academy2_instructor_authorization_required: "講師契約と活動権限の有効期間を確認してください。",
      academy2_opening_license_unpaid: "開講ライセンス料のお支払い後に進めます。",
      academy2_instructor_scope_on_hold: "この販売プランの運営設定を本部で確認してください。",
      academy2_instructor_schedule_required: "日程を確定してから進めてください。",
      academy2_instructor_report_required: "出席と修了報告の状況を確認してください。",
    };
    const message = Object.hasOwn(messages, error.message) ? messages[error.message]
      : error.code === "42501" ? "この申込を操作する権限がありません。"
      : error.code === "PT409" ? "別の変更が保存されています。最新の状態を確認してください。"
      : error.code === "22023" ? "入力内容と現在の状態を確認してください。入力内容は残っています。"
      : "処理を確認できませんでした。入力内容を残して、もう一度お試しください。";
    throw Object.assign(new Error(message), { code: error.code });
  }
  return data as T;
}
export async function listMyInstructorApplications(): Promise<InstructorApplicationSummary[]> {
  return call("academy2_my_instructor_applications", {});
}
export async function getMyInstructorApplication(applicationId: string): Promise<InstructorApplicationDetailData> {
  return call("academy2_instructor_application", { p_application: applicationId });
}
export async function commandInstructorApplication(applicationId: string, expectedRevision: number, requestId: string, command: InstructorOperationCommand): Promise<InstructorApplicationDetailData> {
  assertAcademyWritable();
  return call("academy2_instructor_operation_command", { p_application: applicationId, p_expected: expectedRevision,
    p_request: requestId, p_action: command.type, p_input: command.payload ?? {} });
}
