# LabReserve – API de reservas de laboratorios

LabReserve es una API REST para reservar laboratorios académicos. Sirve para consultar disponibilidad, crear reservas y consultar reservas paginadas. El proyecto se ejecuta únicamente de forma local con Docker y se mide con k6; no debe usarse para probar servicios públicos ni plataformas externas.

Su propósito de rendimiento es comparar un modo base con un modo optimizado bajo la misma carga, encontrar un cuello de botella respaldado por datos y validar que las reglas de negocio se conservan después de la corrección.

## Tecnologías y arquitectura

- Node.js 20, Express y TypeScript para la API.
- PostgreSQL 16 para persistencia.
- Docker Compose para el entorno local reproducible.
- Grafana k6 para humo, carga, estrés y recuperación.

La API usa un pool de PostgreSQL de 10 conexiones (`PG_POOL_MAX=10`). Docker Compose no impone límites explícitos de CPU o memoria a los contenedores; por eso las mediciones describen este equipo local y no una capacidad universal del sistema.

## Funcionalidad y reglas de negocio

Cada laboratorio tiene 12 bloques de una hora: `M1` a `M12`, desde las 07:00 hasta las 19:00.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado de la API y modo de consulta activo. |
| `GET` | `/laboratories/:id/availability?date=YYYY-MM-DD` | Bloques disponibles de un laboratorio en una fecha. |
| `POST` | `/bookings` | Crea una reserva confirmada. |
| `GET` | `/bookings?page=1&pageSize=25&status=confirmed&building=A` | Listado paginado, filtrable por estado o edificio. |

Ejemplo de creación:

```json
{
  "laboratoryId": 1,
  "teacherName": "María Pérez",
  "courseCode": "QA-501",
  "date": "2027-06-01",
  "slot": "M1",
  "attendees": 20
}
```

Reglas que deben mantenerse en todas las pruebas:

- Los campos, fecha y bloque horario se validan en el servidor.
- Los asistentes no pueden superar la capacidad del laboratorio.
- Una reserva `confirmed` bloquea ese laboratorio, fecha y bloque; un intento concurrente o repetido recibe `409`.
- Las solicitudes inválidas reciben `400`; un laboratorio inexistente recibe `404`.

## Requisitos

- Docker Desktop iniciado.
- k6 instalado: `winget install k6`.
- PowerShell en Windows.

## Inicio, configuración y restablecimiento

Desde la raíz del proyecto:

```powershell
docker compose up -d --build
```

La API queda en `http://localhost:3001` y PostgreSQL en `localhost:5434`.

En PowerShell usa `Invoke-RestMethod`, no el alias `curl`, para evitar la advertencia de análisis de scripts:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/health' | ConvertTo-Json
```

El modo inicial esperado es:

```json
{"status":"ok","application":"LabReserve","queryMode":"baseline"}
```

Si el puerto 3001 está ocupado, antes de iniciar define otro puerto y úsalo también como `BASE_URL` para k6:

```powershell
$env:HOST_PORT = '3002'
$env:BASE_URL = 'http://localhost:3002'
docker compose up -d --build
```

El archivo `db/init.sql` crea 60 laboratorios y aproximadamente 135 mil reservas ficticias reproducibles. Para borrar solo los datos locales de LabReserve y volver a sembrarlos:

```powershell
docker compose down -v
$env:QUERY_MODE = 'baseline'
docker compose up -d --build
```

`docker compose down -v` elimina el volumen PostgreSQL de este proyecto. No afecta servicios externos, pero sí borra las reservas generadas por k6.

## Verificación funcional automática

Las pruebas TypeScript validan bloques y validaciones de entrada:

```powershell
Set-Location app
npm install
npm test
npm run build
Set-Location ..
```

La prueba k6 de humo valida salud, disponibilidad, listado, creación, rechazo de sobrecupo y payload inválido:

```powershell
k6 run --summary-export=results/2026-11-16-baseline-smoke.json k6/smoke.js
```

Debe completarse con `checks rate=100%`, error HTTP menor a 1% y p95 menor a 2 s.

## Plan de pruebas de rendimiento

Todas las pruebas se ejecutan contra `http://localhost:3001` salvo que se defina `BASE_URL`.

| Escenario | Demanda y duración | Finalidad |
|---|---|---|
| Humo | 1 VU, 1 minuto | Confirmar que las rutas y reglas funcionan antes y después de una mejora. |
| Carga sostenida | Modelo abierto `constant-arrival-rate`, 150 iteraciones/s, 5 minutos; 50 VUs preasignados y máximo 300 | Medir capacidad bajo tráfico esperado sin que una respuesta lenta reduzca la presión ofrecida. |
| Estrés y recuperación | 0→20 VUs en 1 min; 20→60 en 2 min; 60→100 en 2 min; 100 VUs por 3 min; descenso a 10 VUs y 3 min de recuperación; cierre de 30 s | Observar el límite seguro y comprobar la recuperación con carga baja. |

Cada iteración de carga y estrés contiene una petición. La mezcla es 70% lectura y 30% escritura:

- 40% `GET /laboratories/:id/availability`.
- 30% `GET /bookings`.
- 30% `POST /bookings`.

Los `POST` usan una combinación determinista y única de laboratorio, fecha y bloque para cada VU e iteración; así la carga mide rendimiento y no falla por conflictos accidentales `409`. Si se ejecutan dos escenarios consecutivos sobre el mismo volumen, asigna un `RUN_INDEX` distinto al segundo escenario. La prueba de humo conserva un caso explícito de conflicto `409` para comprobar la regla de negocio. Las solicitudes dinámicas usan un nombre de métrica estable para evitar series de métricas excesivas en k6.

### Umbrales y límites de seguridad

| Escenario | Criterio |
|---|---|
| Humo | 100% checks, errores HTTP `< 1%`, p95 `< 2,000 ms`. |
| Carga | p95 global `< 200 ms`, p99 `< 500 ms`, errores `< 1%`, checks `> 99%`; p95 por disponibilidad `< 150 ms`, listado y creación `< 250 ms`. |
| Estrés | Errores `< 10%` y p99 `< 5 s`; ambos abortan automáticamente tras 30 s si se incumplen. En recuperación: p95 `< 300 ms`, errores `< 1%`. |

Si el equipo pierde capacidad de respuesta, detén k6 con `Ctrl+C`, registra el momento y motivo, conserva cualquier JSON parcial y ejecuta una prueba de humo posterior. No reduzcas tasa, duración o umbrales para aparentar una mejora; si debes cambiar el perfil por seguridad, declara el nuevo perfil y úsalo igual en ambas versiones.

## Protocolo de medición y evidencia

Antes de cada escenario de rendimiento, toma evidencia del entorno:

```powershell
docker version
k6 version
Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory
docker compose ps
docker exec labreserve-db psql -U labuser -d labreserve -tAc "SELECT COUNT(*) FROM bookings;"
Get-ChildItem app\src\*.ts,db\*.sql,k6\*.js | Get-FileHash
```

En una segunda terminal, durante carga o estrés, registra recursos con:

```powershell
docker stats labreserve-api labreserve-db
```

Cuando k6 termine, detén únicamente `docker stats` con `Ctrl+C`; deja que k6 finalice por sí mismo para que guarde el JSON completo. Registra la prueba como ejecutada con volumen recreado y caché del host no controlada; no afirmes que la caché del sistema operativo estaba fría.

Para producir resultados equivalentes, restablece el volumen antes de **cada** escenario. Así humo, carga y estrés no heredan las escrituras creadas por una prueba anterior.

### Medición baseline

```powershell
# Preparación limpia
docker compose down -v
$env:QUERY_MODE = 'baseline'
docker compose up -d --build

# Humo
k6 run --summary-export=results/2026-11-16-baseline-smoke.json k6/smoke.js

# Para carga, volver a preparar desde datos semilla
docker compose down -v
$env:QUERY_MODE = 'baseline'
docker compose up -d --build
k6 run --summary-export=results/2026-11-16-baseline-load.json k6/load.js

# Para estrés y recuperación, volver a preparar desde datos semilla
docker compose down -v
$env:QUERY_MODE = 'baseline'
docker compose up -d --build
k6 run --summary-export=results/2026-11-16-baseline-stress-recovery.json k6/stress_recovery.js
$env:RUN_INDEX = '1'
k6 run --summary-export=results/2026-11-16-baseline-post-stress-smoke.json k6/smoke.js
```

## Hallazgo y corrección

El hallazgo que se mide es el listado paginado en modo `baseline`: primero obtiene reservas y después realiza una consulta adicional por cada laboratorio mostrado. Este patrón N+1 aumenta los viajes a PostgreSQL; además, el volumen inicial no incluye índices para las búsquedas y ordenamientos críticos.

Hipótesis: usar una única consulta relacional con `JOIN` e índices compuestos para disponibilidad y listado reducirá la latencia, el uso de VUs y las iteraciones descartadas, sin alterar las reglas de reservas.

La corrección tiene dos partes:

1. Activar `QUERY_MODE=optimized`, que usa el `JOIN` para enriquecer el listado.
2. Aplicar `db/v2_fix.sql`, que agrega índices para disponibilidad, listado por estado/fecha y edificio.

### Medición optimized

```powershell
# Preparación limpia con el mismo volumen semilla
docker compose down -v
$env:QUERY_MODE = 'optimized'
docker compose up -d --build
docker compose exec -T db psql -U labuser -d labreserve -f /db/v2_fix.sql

Invoke-RestMethod -Uri 'http://localhost:3001/health' | ConvertTo-Json

# Humo y regresión funcional
k6 run --summary-export=results/2026-11-16-optimized-smoke.json k6/smoke.js

# Carga, desde datos semilla más los mismos índices
docker compose down -v
$env:QUERY_MODE = 'optimized'
docker compose up -d --build
docker compose exec -T db psql -U labuser -d labreserve -f /db/v2_fix.sql
k6 run --summary-export=results/2026-11-16-optimized-load.json k6/load.js

# Estrés y recuperación, desde datos semilla más los mismos índices
docker compose down -v
$env:QUERY_MODE = 'optimized'
docker compose up -d --build
docker compose exec -T db psql -U labuser -d labreserve -f /db/v2_fix.sql
k6 run --summary-export=results/2026-11-16-optimized-stress-recovery.json k6/stress_recovery.js
$env:RUN_INDEX = '1'
k6 run --summary-export=results/2026-11-16-optimized-post-stress-smoke.json k6/smoke.js
```

## Lectura de resultados

En el PDF compara los JSON baseline y optimized, además de capturas de la consola y `docker stats`:

- `http_req_duration`: promedio, mediana, p95 y p99 globales y por endpoint.
- `http_req_failed` y porcentaje de checks correctos.
- `http_reqs` o iteraciones por segundo alcanzadas frente a las 150 programadas.
- `vus` y `vus_max`.
- `dropped_iterations` de la prueba de carga.
- CPU y memoria de API y PostgreSQL.
- p95 y tasa de errores de la fase `recuperacion`.

`dropped_iterations` no prueba por sí solo una falla del servidor. Con `constant-arrival-rate`, significa que k6 no obtuvo un VU libre para iniciar una iteración planificada. Interprétalo junto con latencia, VUs máximos, tasa realmente lograda y recursos. Si se alcanzan 300 VUs mientras la tasa lograda cae y la latencia aumenta, es evidencia consistente con saturación.

## Entrega

Antes de entregar, verifica:

- Repositorio accesible con este README, código, semillas, scripts k6 y JSON originales.
- PDF con nombre, carné, descripción, plan de pruebas, entorno, resultados antes/después, capturas legibles, hallazgo, hipótesis, corrección, límites y análisis.
- Enlace a un video público o accesible de máximo 3 minutos: mostrar `/health`, una reserva o disponibilidad, una prueba k6 y la comparación real antes/después.
- Los resultados y capturas corresponden a LabReserve, no a otro proyecto.

## Detener servicios

```powershell
# Conserva los datos locales
docker compose down

# Elimina los datos locales y el volumen de PostgreSQL
docker compose down -v
```
