type CapacityContext = {
  eventId?: string;
  existing: {schedule_mode: 'fixed' | 'arranged_after_application'; capacity: number | null} | null;
  scheduleMode: 'fixed' | 'arranged_after_application';
  capacity: number | null;
};

/** Preserve an existing unbounded fixed event; never create a new unbounded event. */
export function preservesExistingUnboundedCapacity(input: CapacityContext): boolean {
  return !!input.eventId && input.existing?.schedule_mode === 'fixed'
    && input.existing.capacity === null && input.scheduleMode === 'fixed' && input.capacity === null;
}

export function eventCapacityError(input: CapacityContext & {individualRequested: boolean}): string | null {
  if(input.scheduleMode === 'fixed' && input.capacity === null && !preservesExistingUnboundedCapacity(input))
    return '定員は1人以上で入力してください。';
  if(!input.individualRequested && input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity < 1))
    return '定員は1人以上の整数で入力してください。';
  return null;
}
