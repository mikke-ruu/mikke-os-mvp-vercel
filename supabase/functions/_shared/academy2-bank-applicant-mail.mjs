// Offline candidate only. The existing offering intake RPC remains the application creator.
// This module has no database, Auth, network, or mail-provider side effects.
import {renderHtmlBody, MAIL_SUBJECTS} from './offering-mail-content.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizedEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const safeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const safeParagraph = value => safeHtml(value).replaceAll(/\r\n|\r|\n/g, '<br />');

/**
 * Accept only a persisted bank application belonging to the verified caller.
 * The Edge handler must obtain all three rows server-side after the authenticated RPC succeeds.
 */
export function prepareAcademy2BankApplicantMail({ user, request, application, offering, headquarters, contentSnapshot = null }) {
  if (!user || !uuid.test(user.id) || !user.email_confirmed_at || !email.test(normalizedEmail(user.email))) throw new Error('verified_applicant_required');
  if (!request || !uuid.test(request.requestToken) || !uuid.test(request.offeringId)) throw new Error('invalid_intake_request');
  if (!application || !uuid.test(application.id) || !uuid.test(application.headquarters_id)) throw new Error('stored_application_required');
  if (application.learner_user_id !== user.id || application.request_token !== request.requestToken || application.offering_id !== request.offeringId || application.payment_method !== 'bank') throw new Error('application_mismatch');
  if (!offering || offering.id !== application.offering_id || offering.headquarters_id !== application.headquarters_id || offering.status !== 'published') throw new Error('offering_mismatch');
  if (!headquarters || headquarters.id !== application.headquarters_id) throw new Error('headquarters_mismatch');
  const recipient = normalizedEmail(application.applicant_email);
  if (!email.test(recipient) || recipient !== normalizedEmail(user.email)) throw new Error('applicant_email_mismatch');
  if (contentSnapshot && contentSnapshot.rendering_version !== 1) throw new Error('unsupported_receipt_version');
  const sourceNote = contentSnapshot ? contentSnapshot.bank_note : headquarters.default_payment_note;
  const note = typeof sourceNote === 'string' ? sourceNote.trim() : '';
  if (!note || note.length > 4000) throw new Error('bank_instruction_unavailable');
  const name = typeof application.applicant_name === 'string' ? application.applicant_name.trim() : '';
  const title = typeof application.offering_title === 'string' ? application.offering_title.trim() : '';
  if (!name || !title || name.length > 200 || title.length > 200 || application.currency !== 'JPY' || !Number.isSafeInteger(application.price) || application.price < 0) throw new Error('stored_application_invalid');
  const cleanTitle = title.replaceAll(/[\r\n]/g, ' ').slice(0, 100);
  const customContent = contentSnapshot ? renderHtmlBody('receipt', contentSnapshot.body_override, {
    headquarters_id: application.headquarters_id, application_id: application.id,
    name, title, price: application.price, payment_method: 'bank'
  }) : null;
  return {
    to: recipient,
    subject: contentSnapshot ? MAIL_SUBJECTS.receipt : `【mikkeOS Academy】${cleanTitle}のお申込みを受け付けました`,
    html: customContent ? `${customContent}<h2>銀行振込のご案内</h2><p>${safeParagraph(note)}</p>` : `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#2f2c35;max-width:560px;margin:auto"><h1>お申込みを受け付けました</h1><p>${safeHtml(name)} 様</p><p>${safeHtml(title)} のお申込みありがとうございます。</p><p>受付番号: ${safeHtml(application.id)}</p><h2>銀行振込のご案内</h2><p>${safeParagraph(note)}</p><p>お支払いの確認後、本部が受講情報に反映します。</p></div>`,
    idempotencyKey: `academy-offering-application-${application.id}-applicant`,
  };
}
