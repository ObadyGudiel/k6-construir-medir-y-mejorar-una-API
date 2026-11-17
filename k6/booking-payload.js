const LABORATORY_COUNT = 60;
const SLOT_COUNT = 12;
const COMBINATIONS_PER_DAY = LABORATORY_COUNT * SLOT_COUNT;
const VU_STRIDE = 1000;

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Produces a booking key unique for the configured k6 profiles.
 * A sequence combines the VU and per-VU iteration; its date, laboratory
 * and slot mapping prevents normal load writes from colliding with each other.
 */
export function createUniqueBookingPayload(vu, iteration, baseDate = new Date()) {
  const sequence = iteration * VU_STRIDE + (vu - 1);
  const dayOffset = 1000 + Math.floor(sequence / COMBINATIONS_PER_DAY);
  const slotPosition = sequence % COMBINATIONS_PER_DAY;
  const date = new Date(baseDate.getTime() + dayOffset * 86_400_000);

  return {
    laboratoryId: (slotPosition % LABORATORY_COUNT) + 1,
    teacherName: `k6-docente-${vu}-${iteration}`,
    courseCode: `QA-${100 + (sequence % 800)}`,
    date: formatDate(date),
    slot: `M${Math.floor(slotPosition / LABORATORY_COUNT) + 1}`,
    attendees: 5 + (sequence % 8),
  };
}
