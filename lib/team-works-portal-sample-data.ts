import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseField } from "@/lib/supabase-schema-compat";
import {
  resolveOperationsFeatureSettings,
  type TeamWorksOperationsFeatureSettings
} from "@/lib/team-works-feature-settings";
import { DEFAULT_LABELS, type TeamWorksLabels } from "@/lib/team-works-labels";
import type { OperationsClientPortalData } from "@/lib/team-works-operations-client";
import type {
  OperationsPartnerManual,
  OperationsPartnerPortalData,
  OperationsPartnerSession
} from "@/lib/team-works-operations-partner";

// Phase P(2026-08-01): 招待前のプロジェクトでもポータルの見た目を確認するための
// サンプルデータ。
//
// 経緯: あゆみ「まだクライアントを招待していない状態では見れないんですか？
// 実際はページを設定してから渡したいのですが。実際データの前にどう表示されて
// いるかも大事です」。従来のプレビューは実データを読む作りだったため、予定も
// 名簿もまだ無いプロジェクトでは枠だけ出て中身が空になり、「この設定でどう
// 見えるか」が判断できなかった。
//
// 方針: プロジェクトのタイトルと機能設定(feature_settings)だけは実物を読み、
// 中身(予定・名簿・メッセージ)は毎回この場で組み立てる。DBには一切書かない。
// 実データが増えたあとの確認は「〜として表示」(実メンバー指定)を使う。

// サンプルであることが一目で分かる接頭辞。実データと混同させないため、
// 名前・本文には必ずこれを付ける。
const SAMPLE_PREFIX = "サンプル";

export const SAMPLE_MEMBER_ID = "sample";

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

type SampleProject = {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  featureSettings: TeamWorksOperationsFeatureSettings;
};

// プロジェクトの「器」だけ実物から読む。ここが読めない=権限が無いので、
// 呼び出し側はサンプル表示自体をあきらめる。
export async function loadSampleProjectShell(
  client: SupabaseClient,
  projectId: string
): Promise<SampleProject | null> {
  let result = await client
    .from("team_works_projects")
    .select("id,title,description,organization_id,feature_settings")
    .eq("id", projectId)
    .maybeSingle();
  if (result.error && isMissingSupabaseField(result.error, ["feature_settings"])) {
    result = await client
      .from("team_works_projects")
      .select("id,title,description,organization_id")
      .eq("id", projectId)
      .maybeSingle() as typeof result;
  }
  if (result.error || !result.data) return null;
  const row = result.data as {
    id: string;
    title: string;
    description: string | null;
    organization_id: string;
    feature_settings?: Partial<TeamWorksOperationsFeatureSettings> | null;
  };

  const organizationResult = await client
    .from("team_works_organizations")
    .select("name")
    .eq("id", row.organization_id)
    .maybeSingle();

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    organizationId: row.organization_id,
    organizationName: ((organizationResult.data as { name: string } | null)?.name) ?? "組織",
    featureSettings: resolveOperationsFeatureSettings(row.feature_settings ?? null)
  };
}

function sampleParticipants(projectId: string, labels: TeamWorksLabels) {
  // 名前は「サンプル 対象A」のように、参加者の呼び名(participantNoun)に追従させる。
  // 家事代行なら「サンプル 作業箇所A」になり、業種を変えても不自然にならない。
  return ["A", "B", "C", "D"].map((suffix, index) => ({
    id: `sample-participant-${suffix}`,
    projectId,
    groupId: index < 2 ? "sample-group-1" : "sample-group-2",
    name: `${SAMPLE_PREFIX} ${labels.participantNoun}${suffix}`,
    level: index % 2 === 0 ? "初級" : "中級"
  }));
}

function sampleGroups(projectId: string, labels: TeamWorksLabels) {
  return [
    { id: "sample-group-1", projectId, name: `${SAMPLE_PREFIX}${labels.groupNoun}1` },
    { id: "sample-group-2", projectId, name: `${SAMPLE_PREFIX}${labels.groupNoun}2` }
  ];
}

// 今日・明日・来週の3件。カレンダーに色が付き、「今日の予定」も埋まる。
function sampleSessionDates(): string[] {
  const today = new Date();
  return [dateKey(today), dateKey(addDays(today, 1)), dateKey(addDays(today, 7))];
}

export function buildSampleClientPortalData(
  project: SampleProject,
  labels: TeamWorksLabels = DEFAULT_LABELS
): OperationsClientPortalData {
  const participants = sampleParticipants(project.id, labels);
  const groups = sampleGroups(project.id, labels);
  const dates = sampleSessionDates();

  const sessions = dates.map((date, index) => ({
    id: `sample-session-${index}`,
    projectId: project.id,
    projectTitle: project.title,
    sessionDate: date,
    startTime: index === 2 ? "14:00" : "10:00",
    durationMin: 60,
    status: "scheduled",
    partnerName: `${SAMPLE_PREFIX} ${labels.workers}`,
    zoomUrl: project.featureSettings.workWindow.zoom ? "https://example.com/sample-zoom" : null,
    zoomMeetingId: project.featureSettings.workWindow.zoom ? "000 0000 0000" : null,
    zoomPasscode: null,
    workDescription: `${SAMPLE_PREFIX}の作業内容です。`,
    // 3件目は「まだ${attendanceNoun}が決まっていない回」にして、
    // 未確定の見え方も確認できるようにする。
    roster:
      index === 2
        ? []
        : participants.slice(0, 2).map((participant, order) => ({
            id: `sample-roster-${index}-${order}`,
            participantId: participant.id,
            orderIndex: order + 1,
            participantName: participant.name
          }))
  }));

  return {
    memberName: `${SAMPLE_PREFIX}${labels.clientNoun}`,
    projectCount: 1,
    projects: [
      {
        id: project.id,
        title: project.title,
        description: project.description,
        clientMemberId: SAMPLE_MEMBER_ID,
        organizationId: project.organizationId,
        organizationName: project.organizationName,
        featureSettings: project.featureSettings
      }
    ],
    groups,
    participants,
    sessions,
    holidays: [],
    contacts: [
      { memberId: "sample-staff", projectId: project.id, projectTitle: project.title, name: `${SAMPLE_PREFIX}本部窓口`, role: "staff" },
      { memberId: "sample-worker", projectId: project.id, projectTitle: project.title, name: `${SAMPLE_PREFIX} ${labels.workers}`, role: "worker" }
    ],
    messages: [
      {
        id: "sample-message-1",
        projectId: project.id,
        authorMemberId: "sample-staff",
        recipientMemberId: SAMPLE_MEMBER_ID,
        body: `${SAMPLE_PREFIX}のメッセージです。実際にはここに本部とのやり取りが並びます。`,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function buildSamplePartnerPortalData(
  project: SampleProject,
  labels: TeamWorksLabels = DEFAULT_LABELS
): OperationsPartnerPortalData {
  const participants = sampleParticipants(project.id, labels);
  const dates = sampleSessionDates();
  const manuals: OperationsPartnerManual[] = [1, 2].map((no) => ({
    no,
    title: `${SAMPLE_PREFIX}${labels.manualNoun} No.${no}`,
    body: `${SAMPLE_PREFIX}の手順本文です。実際にはここに当日の進め方が入ります。`,
    materialType: "none",
    materialUrl: null,
    questions: [],
    expressions: [],
    cautions: null
  }));

  const makeSession = (index: number): OperationsPartnerSession => ({
    id: `sample-session-${index}`,
    projectId: project.id,
    projectTitle: project.title,
    sessionDate: dates[index],
    startTime: index === 2 ? "14:00" : "10:00",
    durationMin: 60,
    status: "scheduled",
    zoomUrl: project.featureSettings.workWindow.zoom ? "https://example.com/sample-zoom" : null,
    zoomMeetingId: project.featureSettings.workWindow.zoom ? "000 0000 0000" : null,
    zoomPasscode: null,
    zoomUsesProjectDefault: true,
    workDescription: `${SAMPLE_PREFIX}の作業内容です。`,
    partnerPresenceStatus: "not_started",
    partnerStandbyAt: null,
    partnerEndedAt: null,
    reportSubmitted: false,
    manuals,
    roster: participants.slice(0, 3).map((participant, order) => ({
      id: `sample-roster-${index}-${order}`,
      orderIndex: order + 1,
      attendanceStatus: "planned",
      participantId: participant.id,
      participantName: participant.name,
      level: participant.level,
      cautions: null,
      currentManualNo: 1,
      manual: manuals[0],
      assessment: { responseSmoothness: 0, comprehension: 0, speakingConfidence: 0 },
      handoffNote: "",
      completedAt: null
    }))
  });

  return {
    memberName: `${SAMPLE_PREFIX} ${labels.workers}`,
    projectCount: 1,
    projects: [
      {
        id: project.id,
        title: project.title,
        description: project.description,
        manuals,
        featureSettings: project.featureSettings
      }
    ],
    offers: [],
    today: [makeSession(0)],
    upcoming: [makeSession(1), makeSession(2)]
  };
}
