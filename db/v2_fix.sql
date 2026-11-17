CREATE INDEX IF NOT EXISTS idx_bookings_lab_date_status
    ON bookings (laboratory_id, booking_date, status, slot);

CREATE INDEX IF NOT EXISTS idx_bookings_status_date
    ON bookings (status, booking_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_laboratories_building
    ON laboratories (building, id);

ANALYZE bookings;
