// Utilidades compartidas por los scripts de k6 de ReservaFlow.
import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// YYYY-MM-DD a "hoy + offset días" (UTC)
export function dateOffset(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

// ---- Lectura 1: disponibilidad de laboratorios (fechas sembradas: hoy-120 .. hoy+120) ----
export function getAvailability(tags = {}) {
  const url = `${BASE_URL}/laboratories/${randInt(1, 60)}/availability?date=${dateOffset(randInt(-120, 120))}`;
  const res = http.get(url, { tags: { endpoint: 'availability', ...tags } });
  check(res, {
    'availability: HTTP 200': (r) => r.status === 200,
    'availability: 12 franjas': (r) => r.status === 200 && r.json('slots').length === 12,
  });
  return res;
}

// ---- Lectura 2: listado paginado de reservas confirmadas ----
export function getList(tags = {}) {
  const url = `${BASE_URL}/bookings?page=${randInt(1, 20)}&pageSize=50&status=confirmed`;
  const res = http.get(url, { tags: { endpoint: 'list', ...tags } });
  check(res, {
    'list: HTTP 200': (r) => r.status === 200,
    'list: devuelve datos': (r) => {
      const body = r.json();
      return Array.isArray(body.data); // Acepta la estructura de arreglo válida
    },
  });
  return res;
}

// ---- Escritura: crear reserva en fechas NO sembradas (hoy+121 .. hoy+365) ----
export function createReservation(tags = {}) {
  const payload = JSON.stringify({
    laboratoryId: randInt(1, 60),
    teacherName: `k6-docente-${__VU}-${__ITER}`,
    courseCode: `QA-${100 + (__ITER % 800)}`,
    date: dateOffset(randInt(121, 365)),
    slot: `M${randInt(1, 12)}`,
    attendees: randInt(5, 12),
  });
  const res = http.post(`${BASE_URL}/bookings`, payload, {
    ...JSON_HEADERS,
    tags: { endpoint: 'create', ...tags },
  });
  check(res, {
    'create: HTTP 201': (r) => r.status === 201,
    'create: devuelve id': (r) => r.status === 201 && r.json('id') !== undefined,
  });
  return res;
}

// Mezcla de tráfico 70% lectura (40% disponibilidad + 30% listado) / 30% escritura.
export function mixedTraffic(tags = {}) {
  const p = Math.random();
  if (p < 0.4) return getAvailability(tags);
  if (p < 0.7) return getList(tags);
  return createReservation(tags);
}

