CREATE TABLE laboratories (
    id       SERIAL PRIMARY KEY,
    code     TEXT NOT NULL UNIQUE,
    name     TEXT NOT NULL,
    building TEXT NOT NULL CHECK (building IN ('A', 'B', 'C', 'D')),
    kind     TEXT NOT NULL CHECK (kind IN ('computing', 'electronics', 'languages')),
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 10 AND 45)
);

CREATE TABLE bookings (
    id            BIGSERIAL PRIMARY KEY,
    laboratory_id INTEGER NOT NULL REFERENCES laboratories(id),
    teacher_name  TEXT NOT NULL,
    course_code   TEXT NOT NULL,
    booking_date  DATE NOT NULL,
    slot          TEXT NOT NULL CHECK (slot ~ '^M([1-9]|1[0-2])$'),
    attendees     SMALLINT NOT NULL CHECK (attendees > 0),
    status        TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO laboratories (code, name, building, kind, capacity)
SELECT
  'LAB-' || lpad(n::text, 2, '0'),
  CASE n % 3 WHEN 0 THEN 'Laboratorio de Electrónica ' WHEN 1 THEN 'Laboratorio de Cómputo ' ELSE 'Centro de Idiomas ' END || n,
  chr(65 + ((n - 1) % 4)),
  CASE n % 3 WHEN 0 THEN 'electronics' WHEN 1 THEN 'computing' ELSE 'languages' END,
  24 + (n % 4) * 5
FROM generate_series(1, 60) n;

SELECT setseed(0.2718);

INSERT INTO bookings (laboratory_id, teacher_name, course_code, booking_date, slot, attendees, status, created_at)
SELECT
  l.id,
  'Docente ' || (100 + floor(random() * 900))::int,
  'UMG-' || (100 + floor(random() * 800))::int,
  current_date + d,
  'M' || s,
  8 + floor(random() * LEAST(l.capacity - 7, 22))::int,
  CASE WHEN random() < 0.82 THEN 'confirmed' ELSE 'cancelled' END,
  now() - (random() * interval '180 days')
FROM laboratories l
CROSS JOIN generate_series(-120, 120) d
CROSS JOIN generate_series(1, 12) s
WHERE random() < 0.78;

ANALYZE;
