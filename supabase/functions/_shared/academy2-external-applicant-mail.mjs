import { renderHtmlBody, MAIL_SUBJECTS } from './offering-mail-content.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

// Version 1 is immutable. A retry uses the accepted application's URL and body,
// never today's plan/settings. Following a payment link does not confirm payment.
export function prepareAcademy2ExternalApplicantMail({ user, request, application, offering, headquarters, contentSnapshot }) {
  if (!user || !uuid.test(user.id) || !user.email_confirmed_at || !email.test(normalize(user.email))) throw Error('verified_applicant_required');
  if (!request || !uuid.test(request.requestToken) || !uuid.test(request.offeringId)) throw Error('invalid_intake_request');
  if (!application || !uuid.test(application.id) || !uuid.test(application.headquarters_id)) throw Error('stored_application_required');
  if (application.learner_user_id !== user.id || application.request_token !== request.requestToken || application.offering_id !== request.offeringId || application.payment_method !== 'external') throw Error('application_mismatch');
  if (!offering || offering.id !== application.offering_id || offering.headquarters_id !== application.headquarters_id || offering.status !== 'published') throw Error('offering_mismatch');
  if (!headquarters || headquarters.id !== application.headquarters_id) throw Error('headquarters_mismatch');
  const recipient = normalize(application.applicant_email);
  if (!email.test(recipient) || recipient !== normalize(user.email)) throw Error('applicant_email_mismatch');
  if (!contentSnapshot || contentSnapshot.rendering_version !== 1) throw Error('unsupported_receipt_version');
  const sourceUrl = contentSnapshot.external_payment_url;
  if (typeof sourceUrl !== 'string' || /[\s\u0000-\u001f\u007f]/u.test(sourceUrl)) throw Error('external_instruction_unavailable');
  let url;
  try { url = new URL(sourceUrl); } catch { throw Error('external_instruction_unavailable'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw Error('external_instruction_unavailable');
  const name = typeof application.applicant_name === 'string' ? application.applicant_name.trim() : '';
  const title = typeof application.offering_title === 'string' ? application.offering_title.trim() : '';
  if (!name || !title || name.length > 200 || title.length > 200 || application.currency !== 'JPY' || !Number.isSafeInteger(application.price) || application.price < 0) throw Error('stored_application_invalid');
  const body = renderHtmlBody('receipt', contentSnapshot.body_override, {
    headquarters_id: application.headquarters_id, application_id: application.id,
    name, title, price: application.price, payment_method: 'external'
  });
  return {
    to: recipient, subject: MAIL_SUBJECTS.receipt,
    html: `${body}<h2>お支払いのご案内</h2><p><a href="${escape(url.href)}">外部の決済ページでお支払い</a></p><p>このメールはお申込みの受付をお知らせするものです。お支払いの確認後、本部が受講情報に反映します。</p>`,
    idempotencyKey: `academy-offering-application-${application.id}-applicant`
  };
}
