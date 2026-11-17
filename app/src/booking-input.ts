import { isValidSlot } from "./slots";

export interface BookingInput {
  laboratoryId: number;
  teacherName: string;
  courseCode: string;
  date: string;
  slot: string;
  attendees: number;
}

type ValidationResult =
  | { ok: true; value: BookingInput }
  | { ok: false; errors: string[] };

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

export function validateBookingInput(payload: unknown): ValidationResult {
  const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const teacherName = typeof data.teacherName === "string" ? data.teacherName.trim() : "";
  const courseCode = typeof data.courseCode === "string" ? data.courseCode.trim().toUpperCase() : "";
  const date = data.date;
  const slot = data.slot;
  const errors: string[] = [];

  if (!Number.isInteger(data.laboratoryId) || (data.laboratoryId as number) < 1) errors.push("laboratoryId");
  if (!teacherName) errors.push("teacherName");
  if (!courseCode) errors.push("courseCode");
  if (!isIsoDate(date)) errors.push("date");
  if (!isValidSlot(slot)) errors.push("slot");
  if (!Number.isInteger(data.attendees) || (data.attendees as number) < 1) errors.push("attendees");

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      laboratoryId: data.laboratoryId as number,
      teacherName,
      courseCode,
      date: date as string,
      slot: slot as string,
      attendees: data.attendees as number,
    },
  };
}
