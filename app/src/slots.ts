export interface LaboratorySlot {
  code: string;
  startsAt: string;
  endsAt: string;
}

const slots: LaboratorySlot[] = Array.from({ length: 12 }, (_, index) => {
  const startHour = index + 7;
  const endHour = startHour + 1;
  return {
    code: `M${index + 1}`,
    startsAt: `${String(startHour).padStart(2, "0")}:00`,
    endsAt: `${String(endHour).padStart(2, "0")}:00`,
  };
});

export function laboratorySlots(): LaboratorySlot[] {
  return slots.map((slot) => ({ ...slot }));
}

export function isValidSlot(value: unknown): value is string {
  return typeof value === "string" && slots.some((slot) => slot.code === value);
}
