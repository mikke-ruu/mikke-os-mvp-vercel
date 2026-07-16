import type {
  ProjectTemplate,
  ProjectTemplateForm,
  ProjectTemplatePhase,
  ProjectTemplateTask
} from "@/lib/team-works-projects";

export const teamWorksJobTypeLabels = {
  recurring_service: "決まった仕事を定期的に繰り返す",
  deliverable_project: "依頼ごとに成果物を作り納品する",
  event_project: "イベントや期限に向けて準備する",
  product_development: "商品を企画・試作して完成させる",
  field_operation: "現場で複数工程を進める",
  appointment_service: "相談・予約サービスを提供する",
  hybrid: "複数の形を組み合わせる"
} as const;

export type TeamWorksJobType = keyof typeof teamWorksJobTypeLabels;

export const teamWorksCompletionLabels = {
  deliverable: "成果物を納品する",
  service: "サービスを実施する",
  event: "イベントを開催する",
  product: "商品を完成する",
  shipment: "商品を出荷する",
  client_approval: "クライアントの承認を得る",
  period_end: "一定期間の業務を終える",
  ongoing: "継続業務のため明確な完了はない",
  other: "その他"
} as const;

export type TeamWorksCompletionCondition = keyof typeof teamWorksCompletionLabels;

export const teamWorksStakeholderLabels = {
  organization_admin: "組織管理者",
  project_leader: "プロジェクトリーダー",
  internal_member: "社内担当者",
  partner: "外注・協力会社",
  client: "クライアント",
  client_contact: "クライアント側担当者",
  participant: "一般利用者・参加者",
  supervisor: "監修者",
  reviewer: "確認者",
  approver: "承認者",
  inspector: "検査担当",
  other: "その他担当"
} as const;

export type TeamWorksStakeholder = keyof typeof teamWorksStakeholderLabels;

export const teamWorksManagementNeedLabels = {
  task_assignment: "担当者へタスクを割り当てる",
  work_report: "作業後に報告する",
  form_input: "フォームへ入力する",
  reference_material: "資料・マニュアルを見る",
  submit_file_or_url: "ファイルやURLを提出する",
  internal_review: "内部担当者が確認する",
  client_review: "クライアントが確認する",
  revision_request: "修正依頼を出す",
  approval_gate: "承認後に次工程へ進む",
  time_tracking: "作業時間を記録する",
  payout_link: "報酬へ反映する",
  invoice_link: "請求へ反映する"
} as const;

export type TeamWorksManagementNeed = keyof typeof teamWorksManagementNeedLabels;

export const teamWorksClientVisibilityLabels = {
  none: "見せない",
  overall_progress: "全体進捗だけ見せる",
  current_phase: "現在の工程まで見せる",
  client_actions: "クライアント対応事項を見せる",
  deliverables: "成果物を見せる",
  comments: "コメントできるようにする",
  approvals: "承認できるようにする"
} as const;

export type TeamWorksClientVisibility = keyof typeof teamWorksClientVisibilityLabels;

export const teamWorksDeliverableTypeLabels = {
  file: "ファイル",
  url: "URL",
  image: "画像",
  video: "動画",
  pdf: "PDF",
  document: "文書",
  product: "商品",
  completion_report: "作業完了報告",
  other: "その他"
} as const;

export type TeamWorksDeliverableType = keyof typeof teamWorksDeliverableTypeLabels;

export type TeamWorksGeneratorAnswers = {
  jobType: TeamWorksJobType;
  completionConditions: TeamWorksCompletionCondition[];
  stakeholders: TeamWorksStakeholder[];
  managementNeeds: TeamWorksManagementNeed[];
  clientVisibility: TeamWorksClientVisibility[];
  deliverables: {
    enabled: boolean;
    types: TeamWorksDeliverableType[];
    internalReview: boolean;
    clientReview: boolean;
    approval: boolean;
    trackRevisions: boolean;
    deliveredStatus: boolean;
  };
  payouts: boolean;
  invoices: boolean;
};

export type GeneratedTeamWorksProjectTemplate = Omit<
  ProjectTemplate,
  "id" | "organizationId" | "status" | "currentVersionId" | "createdAt" | "updatedAt"
>;

export const initialTeamWorksGeneratorAnswers: TeamWorksGeneratorAnswers = {
  jobType: "deliverable_project",
  completionConditions: ["deliverable"],
  stakeholders: ["organization_admin", "project_leader", "internal_member", "client"],
  managementNeeds: ["task_assignment", "internal_review"],
  clientVisibility: ["overall_progress"],
  deliverables: {
    enabled: true,
    types: ["file"],
    internalReview: true,
    clientReview: false,
    approval: false,
    trackRevisions: false,
    deliveredStatus: true
  },
  payouts: false,
  invoices: false
};

const phaseSets: Record<TeamWorksJobType, string[]> = {
  recurring_service: ["依頼受付", "スケジュール設定", "担当割当", "業務実施", "報告", "完了処理"],
  deliverable_project: ["要件確認", "準備", "制作", "内部確認", "クライアント確認", "修正", "納品", "完了"],
  event_project: ["企画", "募集・手配", "事前準備", "当日運営", "終了処理", "完了"],
  product_development: ["企画", "試作", "検証", "製造準備", "販売準備", "完了"],
  field_operation: ["依頼確認", "現地・仕様確認", "準備", "作業", "検査", "引き渡し", "完了"],
  appointment_service: ["受付", "日程調整", "事前確認", "サービス実施", "実施報告", "完了処理"],
  hybrid: ["依頼確認", "計画", "担当割当", "業務実施", "確認", "報告", "完了処理"]
};

export function getTeamWorksProposedPhaseNames(jobType: TeamWorksJobType) {
  return [...phaseSets[jobType]];
}

function stableId(kind: string, index: number) {
  return `generated_${kind}_${index + 1}`;
}

function getRoleNames(answers: TeamWorksGeneratorAnswers) {
  const roles = answers.stakeholders.map((role) => teamWorksStakeholderLabels[role]);
  return roles.length > 0 ? roles : [teamWorksStakeholderLabels.project_leader];
}

function templateName(jobType: TeamWorksJobType) {
  const shortNames: Record<TeamWorksJobType, string> = {
    recurring_service: "継続サービス",
    deliverable_project: "成果物制作",
    event_project: "イベント準備",
    product_development: "商品開発",
    field_operation: "現場作業",
    appointment_service: "相談・予約サービス",
    hybrid: "複合業務"
  };
  return `${shortNames[jobType]}テンプレート`;
}

export function generateTeamWorksProjectTemplate(
  answers: TeamWorksGeneratorAnswers
): GeneratedTeamWorksProjectTemplate {
  const roleNames = getRoleNames(answers);
  const leaderRole = roleNames.includes(teamWorksStakeholderLabels.project_leader)
    ? teamWorksStakeholderLabels.project_leader
    : roleNames[0];
  const workerRole = roleNames.includes(teamWorksStakeholderLabels.internal_member)
    ? teamWorksStakeholderLabels.internal_member
    : leaderRole;
  const clientVisible = !answers.clientVisibility.includes("none") && answers.clientVisibility.length > 0;
  const phaseNames = getTeamWorksProposedPhaseNames(answers.jobType);
  const phaseWeight = Math.floor(100 / phaseNames.length);
  const phases: ProjectTemplatePhase[] = phaseNames.map((name, index) => ({
    id: stableId("phase", index),
    name,
    description: `${name}で必要な作業と確認をまとめます。`,
    position: index,
    standardDays: answers.jobType === "recurring_service" ? 1 : index === phaseNames.length - 1 ? 1 : 3,
    weight: index === phaseNames.length - 1 ? 100 - phaseWeight * (phaseNames.length - 1) : phaseWeight,
    required: true,
    ownerRoleName: leaderRole,
    startCondition: index === 0 ? "プロジェクトを開始できる状態になったら" : "前の工程が完了したら",
    completionCondition: answers.completionConditions.length > 0 && index === phaseNames.length - 1
      ? answers.completionConditions.map((item) => teamWorksCompletionLabels[item]).join("・")
      : `${name}の作業と確認が終わったら`,
    clientVisible: clientVisible && !name.includes("内部")
  }));

  const tasks: ProjectTemplateTask[] = phases.map((phase, index) => ({
    id: stableId("task", index),
    phaseId: phase.id,
    title: `${phase.name}を進める`,
    description: `${phase.name}に必要な作業を確認し、完了条件まで進めます。`,
    position: 0,
    standardOffsetDays: Math.max(1, phase.standardDays),
    priority: "normal",
    required: true,
    assigneeRoleName: workerRole,
    checklist: ["必要な情報を確認する", "完了条件を満たしているか確認する"],
    requiresDeliverable: answers.deliverables.enabled && index === phases.length - 2,
    requiresApproval: answers.deliverables.approval || answers.managementNeeds.includes("approval_gate"),
    requiresClientAction: answers.managementNeeds.includes("client_review") && phase.clientVisible,
    clientVisible: phase.clientVisible
  }));

  if (answers.managementNeeds.includes("work_report")) {
    const reportPhase = phases.at(-2) ?? phases.at(-1);
    if (reportPhase) {
      tasks.push({
        id: stableId("task", tasks.length),
        phaseId: reportPhase.id,
        title: "完了内容を報告する",
        description: "実施内容と次に必要な対応を記録します。",
        position: tasks.filter((task) => task.phaseId === reportPhase.id).length,
        standardOffsetDays: 1,
        priority: "normal",
        required: true,
        assigneeRoleName: workerRole,
        checklist: ["実施内容を記録する", "未完了事項を確認する"],
        requiresDeliverable: false,
        requiresApproval: false,
        requiresClientAction: false,
        clientVisible
      });
    }
  }

  const forms: ProjectTemplateForm[] = [];
  if (answers.managementNeeds.includes("form_input")) {
    const targetPhase = phases[0];
    forms.push({
      id: stableId("form", 0),
      phaseId: targetPhase.id,
      taskId: null,
      name: "事前確認フォーム",
      inputRoleName: clientVisible && roleNames.includes(teamWorksStakeholderLabels.client)
        ? teamWorksStakeholderLabels.client
        : workerRole,
      reviewerRoleName: leaderRole,
      required: true,
      clientVisible
    });
  }

  return {
    name: templateName(answers.jobType),
    description: "質問への回答から作成した汎用的な仕事の流れです。自社の言葉と手順に合わせて編集してください。",
    standardDurationDays: phases.reduce((sum, phase) => sum + phase.standardDays, 0),
    roleNames,
    phases,
    tasks,
    forms,
    featureSettings: {
      clientPortal: clientVisible,
      deliverables: answers.deliverables.enabled,
      comments: answers.clientVisibility.includes("comments"),
      payouts: answers.payouts || answers.managementNeeds.includes("payout_link"),
      invoices: answers.invoices || answers.managementNeeds.includes("invoice_link")
    }
  };
}
