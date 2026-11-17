import assert from "node:assert/strict";
import test from "node:test";
import { laboratorySlots, isValidSlot } from "../src/slots";

test("defines twelve one-hour laboratory slots from 07:00 to 19:00", () => {
  const slots = laboratorySlots();

  assert.equal(slots.length, 12);
  assert.deepEqual(slots[0], { code: "M1", startsAt: "07:00", endsAt: "08:00" });
  assert.deepEqual(slots[11], { code: "M12", startsAt: "18:00", endsAt: "19:00" });
  assert.equal(isValidSlot("M6"), true);
  assert.equal(isValidSlot("M13"), false);
});
