import { AcademyRenewalRedirect } from "@/components/academy/AcademyRenewalRedirect";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AcademyRenewalRedirect to={`/academy/courses/${encodeURIComponent(id)}/instructor-page?audience=learner`} />; }
