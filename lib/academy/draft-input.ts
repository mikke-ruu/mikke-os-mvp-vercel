import type { CourseInput } from "./courses";

/** Uses the existing course contract: no implicit free price and no automatic publication. */
export function createAcademyDraftInput(name: string, price: string): CourseInput {
  const amount = Number(price);
  if (!name.trim()) throw new Error("講座名を入力してください。");
  if (!price.trim() || !Number.isSafeInteger(amount) || amount < 0) throw new Error("受講料を0円以上の整数で入力してください。");
  return {
    code: `COURSE-${crypto.randomUUID()}`, name: name.trim(), price: amount,
    subtitle: "", mainImageUrl: "", description: "", durationText: "", formats: [],
    certificationConditions: "", canDoAfter: "", kitContents: "", materialContents: "",
    faq: [], applicationFormFields: [], acceptAtHonbu: true, acceptAtKoushi: false,
    paymentUrl: "", paymentProvider: "manual", kitPrice: 0, kitPaymentUrl: "", requiresKit: false,
    learnerAccessMode: "unlimited", learnerAccessDays: null, learnerAccessFixedEndAt: "",
    featureSettings: {
      stepLearning: false, materialLicenses: false, materialAssignments: false, applications: true,
      classes: true, kits: false, certification: false, renewal: false, subscriptions: false, publicCoursePage: true,
      portal: { learning: false, applications: false, classes: false, approvals: false, kits: false, procurement: false, credentials: false, subscription: false }
    }
  };
}
