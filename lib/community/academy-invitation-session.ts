export function createInvitationSessionState(displayName: string) {
  return {
    accepted: false,
    form: { displayName, legalName: "", phone: "", joinReason: "" },
    consent: { terms: false, rules: false, privacy: false }
  };
}

export function isCurrentInvitationRequest(
  expectedKey: string,
  expectedGeneration: number,
  current: { key: string; generation: number }
) {
  return current.key === expectedKey && current.generation === expectedGeneration;
}
