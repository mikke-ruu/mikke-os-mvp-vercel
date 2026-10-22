export type SellerReview = {
  publication_request: string;
  offering_id: string;
  price: number;
  legal_name: string;
  additional_fees: string;
  payment_deadline: string;
  provision_timing: string;
  cancellation: string;
};

// The public API returns an explicitly published snapshot, never the settings draft.
export function readSellerReview(value: unknown, offeringId: string): SellerReview | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.offering_id !== offeringId || typeof data.publication_request !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.publication_request)
    || !Number.isSafeInteger(data.price) || Number(data.price) < 0 || data.currency !== 'JPY') return null;
  const policies = data.policies as {cancellation?: {body?: unknown}} | undefined;
  const cancellation = policies?.cancellation?.body;
  if (typeof cancellation !== 'string' || !cancellation.trim()) return null;
  for (const key of ['legal_name', 'additional_fees', 'payment_deadline', 'provision_timing']) {
    if (typeof data[key] !== 'string' || !(data[key] as string).trim()) return null;
  }
  return {publication_request: data.publication_request, offering_id: offeringId, price: Number(data.price),
    legal_name: data.legal_name as string, additional_fees: data.additional_fees as string,
    payment_deadline: data.payment_deadline as string, provision_timing: data.provision_timing as string, cancellation};
}
