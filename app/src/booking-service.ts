import { Pool } from "pg";
import { LaboratoryBookingService } from "./app";
import { BookingInput } from "./booking-input";
import { laboratorySlots } from "./slots";

interface BookingFilters {
  page: number;
  pageSize: number;
  status?: string;
  building?: string;
}

export function createLaboratoryBookingService(pool: Pool): LaboratoryBookingService {
  return {
    async availability(laboratoryId, date) {
      const laboratory = await pool.query(
        "SELECT id, code, name, building, capacity FROM laboratories WHERE id = $1",
        [laboratoryId],
      );
      if (laboratory.rowCount === 0) throw new Error("laboratory not found");

      const booked = await pool.query(
        `SELECT slot FROM bookings
           WHERE laboratory_id = $1 AND booking_date = $2 AND status = 'confirmed'`,
        [laboratoryId, date],
      );
      const unavailable = new Set(booked.rows.map((row) => row.slot));
      return {
        laboratory: laboratory.rows[0],
        date,
        slots: laboratorySlots().map((slot) => ({ ...slot, available: !unavailable.has(slot.code) })),
      };
    },

    async create(input: BookingInput) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const laboratory = await client.query(
          "SELECT id, capacity FROM laboratories WHERE id = $1 FOR UPDATE",
          [input.laboratoryId],
        );
        if (laboratory.rowCount === 0) throw new Error("laboratory not found");
        if (input.attendees > laboratory.rows[0].capacity) throw new Error("capacity exceeded");

        const occupied = await client.query(
          `SELECT 1 FROM bookings
             WHERE laboratory_id = $1 AND booking_date = $2 AND slot = $3 AND status = 'confirmed'`,
          [input.laboratoryId, input.date, input.slot],
        );
        if (occupied.rowCount !== 0) throw new Error("slot already booked");

        const inserted = await client.query(
          `INSERT INTO bookings (laboratory_id, teacher_name, course_code, booking_date, slot, attendees, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
           RETURNING id, laboratory_id, teacher_name, course_code, booking_date, slot, attendees, status, created_at`,
          [input.laboratoryId, input.teacherName, input.courseCode, input.date, input.slot, input.attendees],
        );
        await client.query("COMMIT");
        return inserted.rows[0];
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async list(filters: BookingFilters) {
      const mode = process.env.QUERY_MODE ?? "baseline";
      const params: unknown[] = [];
      const clauses: string[] = [];
      if (filters.status) {
        params.push(filters.status);
        clauses.push(`b.status = $${params.length}`);
      }
      if (filters.building) {
        params.push(filters.building);
        clauses.push(mode === "optimized"
          ? `l.building = $${params.length}`
          : `b.laboratory_id IN (SELECT id FROM laboratories WHERE building = $${params.length})`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      params.push(filters.pageSize + 1, (filters.page - 1) * filters.pageSize);
      const rows = await pool.query(
        mode === "optimized"
          ? `SELECT b.id, b.teacher_name, b.course_code, b.booking_date, b.slot, b.attendees, b.status,
                    l.code AS laboratory_code, l.name AS laboratory_name, l.building
               FROM bookings b JOIN laboratories l ON l.id = b.laboratory_id
               ${where} ORDER BY b.booking_date DESC, b.id DESC
               LIMIT $${params.length - 1} OFFSET $${params.length}`
          : `SELECT b.id, b.laboratory_id, b.teacher_name, b.course_code, b.booking_date, b.slot, b.attendees, b.status
               FROM bookings b ${where} ORDER BY b.booking_date DESC, b.id DESC
               LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      const data = mode === "optimized"
        ? rows.rows
        : await Promise.all(rows.rows.map(async (booking) => {
            const laboratory = await pool.query(
              "SELECT code, name, building FROM laboratories WHERE id = $1",
              [booking.laboratory_id],
            );
            return { ...booking, laboratory_code: laboratory.rows[0]?.code, laboratory_name: laboratory.rows[0]?.name, building: laboratory.rows[0]?.building };
          }));
      return {
        data: data.slice(0, filters.pageSize),
        page: filters.page,
        pageSize: filters.pageSize,
        hasNext: data.length > filters.pageSize,
      };
    },
  };
}
