import assert from "node:assert/strict";
import test from "node:test";
import { validateBookingInput } from "../src/booking-input";

test("normalizes a valid laboratory booking request", () => {
  const result = validateBookingInput({
    laboratoryId: 4,
    teacherName: "  Ana López  ",
    courseCode: " qa-401 ",
    date: "2026-12-08",
    slot: "M3",
    attendees: 18,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      laboratoryId: 4,
      teacherName: "Ana López",
      courseCode: "QA-401",
      date: "2026-12-08",
      slot: "M3",
      attendees: 18,
    },
  });
});

test("rejects invalid laboratory booking fields", () => {
  const result = validateBookingInput({
    laboratoryId: 0,
    teacherName: "",
    courseCode: "",
    date: "08/12/2026",
    slot: "M13",
    attendees: 0,
  });

  assert.deepEqual(result, {
    ok: false,
    errors: ["laboratoryId", "teacherName", "courseCode", "date", "slot", "attendees"],
  });
});
