import { PublicOffering } from "@/components/academy/PublicOffering";

export default async function InstructorOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicOffering id={id} instructor />;
}
