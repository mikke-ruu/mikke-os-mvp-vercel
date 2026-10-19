import type { SupabaseClient } from "@supabase/supabase-js";

// Archived people are no longer selectable, but existing session records still
// reference them. Resolve only those missing names within the loaded projects.
export async function loadOperationsRosterNames(
  client: SupabaseClient,
  projectIds: string[],
  participants: { id: string; name: string }[],
  roster: { participant_id: string }[]
): Promise<Map<string, string>> {
  const names = new Map(participants.map((person) => [person.id, person.name]));
  const missingIds = [...new Set(roster.map((row) => row.participant_id))].filter((id) => !names.has(id));
  if (!missingIds.length || !projectIds.length) return names;
  const { data, error } = await client.from("team_works_participants")
    .select("id,name").in("project_id", projectIds).in("id", missingIds);
  if (error) throw error;
  for (const person of (data ?? []) as { id: string; name: string }[]) names.set(person.id, person.name);
  return names;
}
