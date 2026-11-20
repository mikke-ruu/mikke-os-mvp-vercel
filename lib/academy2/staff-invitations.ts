import { supabase } from '@/lib/supabase/client';

export type Academy2InvitableRole = 'administrator' | 'learning_operator' | 'course_editor' | 'headquarters_teacher' | 'external_teacher';
export type Academy2StaffInvitation = {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  delivery_status?: 'queued' | 'not_required';
  expires_at?: string;
};

// Uses the authenticated client; server RPC performs all role and identity checks.
// Creating an invitation does not send mail. The shared mail control handles delivery.
export async function inviteAcademy2Staff(input: {
  headquartersId: string;
  channel: 'mikke_id' | 'email';
  target: string;
  role: Academy2InvitableRole;
}): Promise<Academy2StaffInvitation> {
  const { data, error } = input.channel==='email' ? await supabase.rpc('academy2_create_email_staff_invitation' as never, {
    p_headquarters_id: input.headquartersId,
    p_email: input.target,
    p_role: input.role,
  } as never) : await supabase.rpc('academy2_staff_invite' as never, {
    p_headquarters_id: input.headquartersId,
    p_channel: input.channel,
    p_target: input.target,
    p_role: input.role,
  } as never);
  if (error) throw error;
  return data as unknown as Academy2StaffInvitation;
}

export async function respondAcademy2StaffInvitation(
  invitationId: string,
  response: 'accepted' | 'declined',
): Promise<Academy2StaffInvitation> {
  const { data, error } = await supabase.rpc('academy2_staff_respond' as never, {
    p_invitation_id: invitationId,
    p_response: response,
  } as never);
  if (error) throw error;
  return data as unknown as Academy2StaffInvitation;
}
