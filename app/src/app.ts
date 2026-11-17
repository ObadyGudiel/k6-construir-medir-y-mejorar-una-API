import express, { NextFunction, Request, Response } from "express";
import { BookingInput, validateBookingInput } from "./booking-input";

export interface LaboratoryBookingService {
  availability(laboratoryId: number, date: string): Promise<unknown>;
  create(input: BookingInput): Promise<unknown>;
  list(filters: { page: number; pageSize: number; status?: string; building?: string }): Promise<unknown>;
}

const toPositiveInt = (value: unknown, fallback?: number): number | undefined => {
  if (value === undefined) return fallback;
  return typeof value === "string" && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined;
};

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

export function createApp(service: LaboratoryBookingService) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", application: "LabReserve", queryMode: process.env.QUERY_MODE ?? "baseline" });
  });

  app.get("/laboratories/:id/availability", async (req, res, next) => {
    const laboratoryId = toPositiveInt(req.params.id);
    const date = req.query.date;
    if (laboratoryId === undefined || !isDate(date)) {
      return res.status(400).json({ error: "laboratory id and ISO date are required" });
    }
    try {
      res.json(await service.availability(laboratoryId, date));
    } catch (error) {
      next(error);
    }
  });

  app.post("/bookings", async (req, res, next) => {
    const validation = validateBookingInput(req.body);
    if (!validation.ok) return res.status(400).json({ error: "invalid booking request", fields: validation.errors });
    try {
      res.status(201).json(await service.create(validation.value));
    } catch (error) {
      next(error);
    }
  });

  app.get("/bookings", async (req, res, next) => {
    const page = toPositiveInt(req.query.page, 1);
    const pageSize = toPositiveInt(req.query.pageSize, 25);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const building = typeof req.query.building === "string" ? req.query.building.trim().toUpperCase() : undefined;
    if (page === undefined || pageSize === undefined || pageSize > 100 || (status !== undefined && !["confirmed", "cancelled"].includes(status))) {
      return res.status(400).json({ error: "invalid list filters" });
    }
    try {
      res.json(await service.list({ page, pageSize, status, building }));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error.message === "capacity exceeded" || error.message === "slot already booked") {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === "laboratory not found") return res.status(404).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "internal error" });
  });

  return app;
}
