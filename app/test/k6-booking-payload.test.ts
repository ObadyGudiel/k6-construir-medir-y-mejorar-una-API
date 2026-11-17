import assert from "node:assert/strict";
import test from "node:test";
import { createUniqueBookingPayload } from "../../k6/booking-payload.js";

test("creates distinct laboratory-date-slot keys for separate virtual-user iterations", () => {
  const baseDate = new Date("2026-11-16T00:00:00.000Z");
  const payloads = [
    createUniqueBookingPayload(1, 0, baseDate),
    createUniqueBookingPayload(1, 1, baseDate),
    createUniqueBookingPayload(2, 0, baseDate),
  ];
  const keys = payloads.map((payload) => `${payload.laboratoryId}|${payload.date}|${payload.slot}`);

  assert.equal(new Set(keys).size, 3);
  assert.ok(payloads.every((payload) => payload.date > "2027-03-16"));
});

test("separates booking keys between consecutive k6 executions", () => {
  const baseDate = new Date("2026-11-16T00:00:00.000Z");
  const firstRun = createUniqueBookingPayload(1, 0, baseDate, 0);
  const secondRun = createUniqueBookingPayload(1, 0, baseDate, 1);

  assert.notEqual(
    `${firstRun.laboratoryId}|${firstRun.date}|${firstRun.slot}`,
    `${secondRun.laboratoryId}|${secondRun.date}|${secondRun.slot}`,
  );
});
