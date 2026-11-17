import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app";

const service = {
  availability: async () => ({ laboratoryId: 1, date: "2026-12-08", slots: [] }),
  create: async () => ({ id: 21, status: "confirmed" }),
  list: async () => ({ data: [], page: 1, pageSize: 25, hasNext: false }),
};

async function request(app: ReturnType<typeof createApp>, path: string, init?: RequestInit) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server address unavailable");
  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("reports LabReserve identity and query mode", async () => {
  const response = await request(createApp(service), "/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", application: "LabReserve", queryMode: "baseline" });
});

test("returns validation details for an invalid booking", async () => {
  const response = await request(createApp(service), "/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ laboratoryId: 0 }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "invalid booking request",
    fields: ["laboratoryId", "teacherName", "courseCode", "date", "slot", "attendees"],
  });
});
