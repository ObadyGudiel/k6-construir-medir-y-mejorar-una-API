import { pool } from "./db";
import { createApp } from "./app";
import { createLaboratoryBookingService } from "./booking-service";

const port = Number(process.env.PORT ?? 3000);
const app = createApp(createLaboratoryBookingService(pool));
app.listen(port, () => console.log(`LabReserve API listening on :${port}`));

